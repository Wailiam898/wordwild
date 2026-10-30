"""Checks the Literacy Hub phonics audio and its credits.

  1. Files: notices copies match; the in-game credit carries every line of the notice;
     every game grapheme has a p_ clip whose bytes match the provenance manifest.
  2. Sound mapping (Chromium, which has Web Audio): tapping each sound in the Grown-ups
     sound grid fetches audio/p_<that grapheme>.mp3, every clip decodes, and Lesson 1's
     new-sound step requests the clips for its own graphemes.
  3. Credits screen (WebKit on iPhone and iPad): reachable from the title screen and the
     Grown-ups corner, links present, no sideways scrolling.

Usage: .venv/Scripts/python.exe -I tests/credits.py
"""
import sys, json, re, hashlib, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "app"
PORT = 5181
URL = f"http://localhost:{PORT}/"
fails = []


def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


# ---- 1. Files
notice = (APP / "THIRD_PARTY_NOTICES.md").read_text(encoding="utf-8")
check(notice == (ROOT / "THIRD_PARTY_NOTICES.md").read_text(encoding="utf-8"), "root and shipped THIRD_PARTY_NOTICES.md match")
credit = notice.split("## Phonics audio")[1].split("\n\n")[1].splitlines()
main = (APP / "js" / "main.js").read_text(encoding="utf-8")
for line in credit:
    urls = re.findall(r"https?://\S+", line)
    bits = [b.strip() for b in re.split(r"https?://\S+", line) if b.strip()]
    check(all(b in main for b in bits) and all(f"link('{u}')" in main for u in urls), f"in-game credit has: {line[:60]}…")
man = json.loads((APP / "licences" / "literacyhub-audio-manifest.json").read_text(encoding="utf-8"))
graphemes = json.loads(subprocess.run(
    ["node", "-e", "import('./app/js/data.js').then(m=>console.log(JSON.stringify(Object.keys(m.GRAPHEMES))))"],
    cwd=ROOT, capture_output=True, text=True, check=True).stdout)
by_g = {c["grapheme"]: c for c in man["clips"]}
check(sorted(by_g) == sorted(graphemes), f"manifest covers all {len(graphemes)} game sounds")
bad = [g for g, c in by_g.items() if hashlib.sha256((ROOT / c["output_file"]).read_bytes()).hexdigest() != c["output_sha256"]]
check(not bad, f"every p_ clip matches its manifest hash {bad or ''}")

server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--directory", str(APP)],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                          creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))


def sign_in(page, tap=False):
    page.route("**/*.supabase.co/**", lambda route: route.abort())
    page.goto(URL)
    page.wait_for_timeout(600)
    press = (lambda sel: page.locator(sel).tap(force=True)) if tap else (lambda sel: page.locator(sel).click(force=True))
    press(".play")
    page.wait_for_selector(".name-input", timeout=15000)
    page.fill(".name-input", "Test Kid")
    press(".name-row .go")
    page.wait_for_selector("[data-act=offline]", timeout=15000)
    page.locator("[data-act=offline]").click()
    page.wait_for_selector(".node.current", timeout=15000)


try:
    with sync_playwright() as p:
        # ---- 2. Sound mapping
        b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        page = b.new_page()
        errors, reqs = [], []
        page.on("pageerror", lambda e: errors.append(str(e)))
        # Aborted Supabase calls (offline sign-in) log ERR_FAILED; anything else counts.
        page.on("console", lambda m: m.type == "error" and "ERR_FAILED" not in m.text and errors.append(m.text))
        page.on("requestfinished", lambda r: "/audio/p_" in r.url and reqs.append(r.url.split("/audio/")[1]))
        sign_in(page)
        check(page.evaluate("typeof AudioContext") == "function", "Chromium has Web Audio")
        page.evaluate("__ww.parentScreen()")
        page.wait_for_selector(".snd-grid .snd")
        buttons = page.locator(".snd-grid button.snd")
        wrong = []
        for i in range(buttons.count()):
            g = buttons.nth(i).inner_text().strip()
            before = len(reqs)
            buttons.nth(i).click()
            page.wait_for_timeout(250)
            new = reqs[before:]
            if any(n != f"p_{g}.mp3" for n in new):
                wrong.append(f"{g}: also requested {new}")
            elif f"p_{g}.mp3" not in reqs:
                wrong.append(f"{g}: nothing requested")
        check(buttons.count() == len(graphemes) and not wrong,
              f"Grown-ups sound grid: each of {buttons.count()} buttons loads its own p_ clip {wrong or ''}")
        decoded = page.evaluate("""async gs => {
          const ac = new AudioContext(), bad = [];
          for (const g of gs) {
            const buf = await (await fetch('audio/p_' + g + '.mp3')).arrayBuffer();
            try { const a = await ac.decodeAudioData(buf); if (a.duration < 0.2 || a.duration > 1.5) bad.push(g + ' ' + a.duration.toFixed(2)); }
            catch (e) { bad.push(g + ' undecodable'); }
          }
          return bad;
        }""", graphemes)
        check(not decoded, f"all p_ clips decode in the browser, 0.2–1.5 s long {decoded or ''}")
        # Lesson 1 from the map (as a child would start it), on a fresh page so nothing is
        # cached yet: its new-sound step plays its own sounds.
        l1 = page.evaluate("__ww.LESSONS[0].g")
        page = b.new_context().new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("requestfinished", lambda r: "/audio/p_" in r.url and reqs.append(r.url.split("/audio/")[1]))
        sign_in(page)
        reqs.clear()
        page.locator(".node.current").click(force=True)
        page.wait_for_timeout(9000)
        got = sorted({r[2:-4] for r in reqs})
        check(set(l1) <= set(got), f"Lesson 1 requests its sounds {l1} (got {got})")
        check(not errors, f"no page errors in Chromium {errors[:3] or ''}")
        b.close()

        # ---- 3. Credits screen on iPhone / iPad (WebKit)
        need = ["https://www.literacyhub.edu.au/search/phonemes-and-graphemes-daily-review",
                "https://creativecommons.org/licenses/by/4.0/", "THIRD_PARTY_NOTICES.md",
                "licences/literacyhub-audio-manifest.json"]
        for dev in ("iPhone 13", "iPad (gen 7)"):
            b = p.webkit.launch()
            ctx = b.new_context(**p.devices[dev])
            page = ctx.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.route("**/*.supabase.co/**", lambda route: route.abort())
            page.goto(URL)
            page.wait_for_timeout(800)
            link = page.locator(".credits-link")
            check(link.is_visible(), f"{dev}: 'Credits & licences' link visible on title screen")
            page.screenshot(path=str(ROOT / "work" / "shots" / f"credits-title-{dev.split()[0].lower()}.png"))
            link.tap()
            page.wait_for_selector(".credits")
            page.screenshot(path=str(ROOT / "work" / "shots" / f"credits-{dev.split()[0].lower()}.png"), full_page=True)
            hrefs = page.eval_on_selector_all(".credits a", "as => as.map(a => a.getAttribute('href'))")
            check(all(n in hrefs for n in need), f"{dev}: source, licence, notices and manifest links present")
            text = page.inner_text(".credits")
            check("No endorsement by the original publisher or copyright owner is implied." in text and "CC BY 4.0" in text,
                  f"{dev}: full credit text shown")
            check(not page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1 || document.querySelector('.credits').scrollWidth > window.innerWidth + 1"),
                  f"{dev}: no sideways scrolling")
            for rel in ("THIRD_PARTY_NOTICES.md", "licences/literacyhub-audio-manifest.json"):
                r = page.request.get(URL + rel)
                check(r.ok and "Commonwealth of Australia" in r.text(), f"{dev}: {rel} served ({r.status})")
            page.locator(".credits .p-head .pbtn").tap()
            page.wait_for_selector(".title .play")
            check(True, f"{dev}: back returns to title")
            sign_in(page, tap=True)
            page.evaluate("__ww.parentScreen()")
            page.locator(".pcard .pbtn", has_text="Credits & licences").tap()
            page.wait_for_selector(".credits")
            page.locator(".credits .p-head .pbtn").tap()
            page.wait_for_selector(".parent .snd-grid")
            check(True, f"{dev}: reachable from Grown-ups corner and back")
            check(not errors, f"{dev}: no page errors {errors[:3] or ''}")
            b.close()
finally:
    server.terminate()

print("\nALL OK" if not fails else f"\n{len(fails)} FAILED")
sys.exit(1 if fails else 0)
