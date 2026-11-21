"""Egg hatch and the baby chick Wordlings.

- Time from the hatch screen appearing to the first crack is about 1 second, in normal and in reduced motion
  (WebKit iPhone and iPad; Chromium with real speech also checks "Lesson complete!" is never cut off).
- Every Wordling id draws without errors (normal, shadow and with eggshell), each one differs from the others.
- An old save that already has Wordlings still shows every one of them in the zoo.
- Screenshots of the hatch and of the zoo with every chick go to work/shots/babies/ (375 px wide and iPad).

Usage: .venv/Scripts/python.exe -I tests/hatch.py
Every browser blocks *.supabase.co.
"""
import sys, subprocess, json
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "app"
SHOTS = ROOT / "work" / "shots" / "babies"
SHOTS.mkdir(parents=True, exist_ok=True)
PORT = 5195
URL = f"http://127.0.0.1:{PORT}/"
fails = []


def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1", "--directory", str(APP)],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                          creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))

HATCH_JS = """async ([idx, ms]) => {
  const L = window.__ww.LESSONS[idx];
  window.__ww.store.state().wordlings = window.__ww.store.state().wordlings.filter(x => x !== L.id);
  const cuts = []; const started = new Map();
  const au = await import('./js/audio.js');
  const AC = window.AudioContext || window.webkitAudioContext;
  let S = null, st, sp;
  if (AC) { S = Object.getPrototypeOf(new AC().createBufferSource()); st = S.start; sp = S.stop; }
  const voice = AC ? [await au.load('n_lesson_done'), await au.load('n_egg_meet')].filter(Boolean) : [];   // the lines that must never be cut
  if (S) {
    S.start = function () { started.set(this, performance.now()); return st.apply(this, arguments); };
    // cut = stopped while it still had more than 0.1 s left to play
    S.stop = function () { const t = started.get(this); if (t !== undefined && voice.includes(this.buffer) && performance.now() - t < this.buffer.duration * 1000 - 100) cuts.push(Math.round(this.buffer.duration * 1000)); return sp.apply(this, arguments); };
  }
  let t0 = null, crack = null, reveal = null;
  const iv = setInterval(() => {
    const e = document.querySelector('.hatch-egg');
    if (e && t0 === null) t0 = performance.now();
    if (e && crack === null && e.querySelector('path[stroke="#3b2a4f"]')) crack = performance.now() - t0;
    if (reveal === null && document.querySelector('.hatch-wl')) reveal = performance.now() - t0;
  }, 10);
  window.__ww.hatchScreen(L, 3, true, 5);
  await new Promise(r => setTimeout(r, ms));
  clearInterval(iv);
  if (S) { S.start = st; S.stop = sp; }
  return { crack, reveal, cuts, shell: !!document.querySelector('.hatch-wl svg path[stroke^="hsl"]'), marks: performance.getEntriesByType('mark').map(m => m.name) };
}"""


def boot(page, url):
    page.route("**/*.supabase.co/**", lambda route: route.abort())
    page.goto(url)
    page.wait_for_timeout(800)
    page.locator(".play").tap(force=True)
    page.wait_for_selector(".name-input", timeout=15000)
    page.fill(".name-input", "Test Kid")
    page.locator(".name-row .go").tap(force=True)
    page.wait_for_selector("[data-act=offline]", timeout=15000)
    page.locator("[data-act=offline]").click()
    page.wait_for_selector(".node.current", timeout=15000)
    page.wait_for_timeout(1800)   # let the map's own delayed "tap the egg" line finish, so it cannot cut into the hatch


try:
    with sync_playwright() as p:
        # ---------------- Chromium: real speech, timing and nothing cut off
        for reduce in (False, True):
            b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
            ctx = b.new_context(viewport={"width": 375, "height": 812}, has_touch=True,
                                reduced_motion="reduce" if reduce else "no-preference")
            page = ctx.new_page()
            errs = []
            page.on("pageerror", lambda e: errs.append(str(e)))
            page.on("console", lambda m: m.type == "error" and "ERR_FAILED" not in m.text and errs.append(m.text))
            boot(page, URL)
            tag = "reduced motion" if reduce else "normal motion"
            for idx in (0, 33):
                r = page.evaluate(HATCH_JS, [idx, 9000])
                check(r["crack"] is not None and 800 <= r["crack"] <= 1300,
                      f"Chromium, {tag}, lesson {idx + 1}: first crack {r['crack'] and round(r['crack']) / 1000} s after the hatch screen appears (want about 1 s)")
                check(r["reveal"] is not None and r["reveal"] < 3500, f"Chromium, {tag}, lesson {idx + 1}: the chick appears after {r['reveal'] and round(r['reveal']) / 1000} s")
                check(not r["cuts"], f"Chromium, {tag}, lesson {idx + 1}: no spoken line was cut off (cut clips: {r['cuts']})")
                check(r["shell"], f"Chromium, {tag}, lesson {idx + 1}: the newly hatched chick wears eggshell")
                page.evaluate("document.querySelector('.reward-row .go')?.click()")
                page.wait_for_timeout(300)
                page.evaluate("window.__ww.mapScreen()")
                page.wait_for_timeout(1800)   # the map's own delayed "tap the egg" line (first lesson not done) must not cut into the next hatch
            check(not errs, f"Chromium, {tag}: no console errors {errs[:3]}")
            b.close()

        # ---------------- WebKit: Safari engine, iPhone and iPad
        for dev_tag, dev in (("iphone", "iPhone 13"), ("ipad", "iPad (gen 7)")):
            for reduce in (False, True):
                b = p.webkit.launch()
                ctx = b.new_context(**p.devices[dev], reduced_motion="reduce" if reduce else "no-preference")
                page = ctx.new_page()
                errs = []
                page.on("pageerror", lambda e: errs.append(str(e)))
                page.on("console", lambda m: m.type == "error" and "ERR_FAILED" not in m.text and errs.append(m.text))
                boot(page, URL)
                tag = f"WebKit {dev_tag}, {'reduced' if reduce else 'normal'} motion"
                r = page.evaluate(HATCH_JS, [4, 6000])
                check(r["crack"] is not None and 800 <= r["crack"] <= 1300, f"{tag}: first crack {r['crack'] and round(r['crack']) / 1000} s after the hatch screen appears")
                check(r["reveal"] is not None, f"{tag}: the chick is revealed ({r['reveal'] and round(r['reveal']) / 1000} s)")
                check(r["shell"], f"{tag}: the newly hatched chick wears eggshell")
                check(not errs, f"{tag}: no console errors {errs[:3]}")
                if not reduce:
                    # screenshots: the wobble, the crack and the reveal
                    page.evaluate("window.__ww.mapScreen()")
                    page.evaluate("""() => { const s = window.__ww.store.state(); s.wordlings = s.wordlings.filter(x => x !== 'L7'); window.__ww.hatchScreen(window.__ww.LESSONS[6], 3, true, 5); }""")
                    page.wait_for_timeout(500)
                    page.screenshot(path=str(SHOTS / f"hatch-1-wobble-{dev_tag}.png"))
                    page.wait_for_selector(".hatch-egg path[stroke='#3b2a4f']", timeout=4000)
                    page.wait_for_timeout(450)
                    page.screenshot(path=str(SHOTS / f"hatch-2-cracks-{dev_tag}.png"))
                    page.wait_for_selector(".hatch-wl", timeout=6000)
                    page.wait_for_timeout(900)
                    page.screenshot(path=str(SHOTS / f"hatch-3-hatched-{dev_tag}.png"))
                b.close()

        # ---------------- Every Wordling draws, and each is different
        b = p.webkit.launch()
        page = b.new_page(viewport={"width": 375, "height": 812})
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.on("console", lambda m: m.type == "error" and "ERR_FAILED" not in m.text and errs.append(m.text))
        page.route("**/*.supabase.co/**", lambda route: route.abort())
        page.goto(URL)
        page.wait_for_timeout(600)
        res = page.evaluate("""async () => {
          const art = await import('./js/art.js'), data = await import('./js/data.js'), bab = await import('./js/babies.js');
          const out = { bad: [], ids: Object.keys(data.WORDLINGS).length, svgs: new Set(), descs: new Set(), missing: [] };
          for (const [id, name] of Object.entries(data.WORDLINGS)) {
            if (!bab.ANIMAL_NAMES.includes(name)) out.missing.push(name);
            for (const [sil, shell] of [[false, false], [true, false], [false, true]]) {
              const svg = art.wordlingSVG(name, sil, { shell });
              const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
              if (doc.querySelector('parsererror') || !doc.querySelector('svg')) out.bad.push(id + (sil ? ' shadow' : shell ? ' shell' : ''));
              if (!sil && !shell) out.svgs.add(svg.replace(/id="b\\d+b"/g, '').replace(/url\\(#b\\d+b\\)/g, ''));
            }
            out.descs.add(bab.animalOf(name));
          }
          out.svgCount = out.svgs.size; out.descCount = out.descs.size; out.svgs = 0; out.descs = 0;
          return out;
        }""")
        check(res["ids"] == 34 and not res["bad"], f"all {res['ids']} Wordling ids draw (normal, shadow, eggshell) without errors {res['bad']}")
        check(not res["missing"], f"every Wordling name has a chick design {res['missing']}")
        check(res["svgCount"] == 34 and res["descCount"] == 34, f"34 different drawings and 34 different descriptions ({res['svgCount']}, {res['descCount']})")
        check(not errs, f"no console errors while drawing {errs[:3]}")
        b.close()

        # ---------------- Old save with Wordlings, and the zoo with every chick
        for dev_tag, dev in (("iphone", "iPhone 13"), ("ipad", "iPad (gen 7)")):
            b = p.webkit.launch()
            ctx = b.new_context(**p.devices[dev])
            page = ctx.new_page()
            errs = []
            page.on("pageerror", lambda e: errs.append(str(e)))
            page.on("console", lambda m: m.type == "error" and "ERR_FAILED" not in m.text and errs.append(m.text))
            boot(page, URL)
            # an old save: three Wordlings, as an earlier version of the game saved them
            page.evaluate("""() => { const s = window.__ww.store.state(); s.wordlings = ['L1', 'L5', 'L34']; window.__ww.store.save(); }""")
            page.evaluate("window.__ww.mapScreen()"); page.wait_for_selector(".node", timeout=15000)
            page.locator(".dock-btn", has_text="Zoo").tap(force=True)
            page.wait_for_selector(".zoo", timeout=5000)
            page.wait_for_timeout(500)
            got = page.evaluate("[...document.querySelectorAll('.zslot.got .zslot-name')].map(x => x.textContent)")
            roam = page.evaluate("document.querySelectorAll('.roam').length")
            check(got == ["Tap", "Kit", "Starlight"] and roam == 3, f"{dev_tag}: an old save still shows its 3 Wordlings in the zoo ({got}, {roam} in the meadow)")
            page.screenshot(path=str(SHOTS / f"zoo-old-save-{dev_tag}.png"))
            page.evaluate("""() => { const s = window.__ww.store.state(); s.wordlings = Object.keys(window.__ww.LESSONS.reduce((o, L) => (o[L.id] = 1, o), {})); window.__ww.store.save(); }""")
            page.locator(".back").first.tap(force=True); page.wait_for_timeout(500)
            page.locator(".dock-btn", has_text="Zoo").tap(force=True)
            page.wait_for_selector(".zoo", timeout=5000)
            page.wait_for_timeout(600)
            n = page.evaluate("[document.querySelectorAll('.zslot.got').length, document.querySelectorAll('.roam').length]")
            check(n == [34, 34], f"{dev_tag}: the zoo shows all 34 chicks on the shelf and in the meadow ({n})")
            page.screenshot(path=str(SHOTS / f"zoo-meadow-{dev_tag}.png"))
            # the shelf, scrolled in steps so every card is seen
            w = page.evaluate("document.querySelector('.collection').scrollWidth"); vw = page.evaluate("document.querySelector('.collection').clientWidth")
            k = 0
            for x in range(0, max(1, w), max(1, vw - 40)):
                page.evaluate(f"document.querySelector('.collection').scrollLeft = {x}")
                page.wait_for_timeout(150)
                page.locator(".collection").screenshot(path=str(SHOTS / f"zoo-shelf-{dev_tag}-{k:02d}.png"))
                k += 1
            # a contact sheet of all 34, big enough to tell them apart
            page.evaluate("""async () => {
              const a = await import('./js/art.js'), d = await import('./js/data.js');
              const o = document.createElement('div'); o.id = 'sheet';
              o.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#bfe8ff;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:4px;padding:6px;align-content:start';
              o.innerHTML = Object.values(d.WORDLINGS).map(n => `<div style="text-align:center;font:11px sans-serif"><div style="aspect-ratio:1">${a.wordlingSVG(n)}</div>${n}</div>`).join('');
              document.body.append(o); }""")
            page.wait_for_timeout(300)
            page.screenshot(path=str(SHOTS / f"all-34-{dev_tag}.png"))
            overflow = page.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
            check(not overflow, f"{dev_tag}: no sideways scrolling in the zoo")
            check(not errs, f"{dev_tag}: no console errors in the zoo {errs[:3]}")
            b.close()
finally:
    server.terminate()

print()
print("FAILED" if fails else "ALL PASSED", len(fails))
sys.exit(1 if fails else 0)
