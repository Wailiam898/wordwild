"""Letter tracing (app/js/trace.js).

WebKit (the Safari engine) at iPhone and iPad sizes:
  - the stroke data: 26 letters, each stroke has points, the grapheme -> letters mapping
  - the trace screen fits the screen, blocks page scrolling, shows start dot + guide ball
  - every letter can be traced with the mouse (iPhone) and with touch/pen pointer events (iPad)
  - a touch that starts away from the start dot is ignored (right start point enforced)
  - two failed tries: the stroke is drawn for the child and the lesson moves on (never blocks)
  - 'igh', 'sh', 'a_e' are traced letter by letter, in order; the skip button works
  - inside a real lesson, Lesson 1's first new sound is followed by tracing
  - progress record: counts, merging with older saves and with another device (store.merge)
Chromium (it has Web Audio): the sound plays when the trace is finished.

Every browser blocks *.supabase.co, so nothing touches the real cloud.

Usage: .venv/Scripts/python.exe -I tests/trace.py
"""
import sys, json, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "app"
SHOTS = ROOT / "work" / "shots" / "trace"
SHOTS.mkdir(parents=True, exist_ok=True)
PORT = 5182
URL = f"http://localhost:{PORT}/"
fails = []
ALPHABET = "abcdefghijklmnopqrstuvwxyz"


def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--directory", str(APP)],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                          creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))

# The points of the stroke the child should draw now, in page (client) coordinates.
POINTS = """(step = 9) => {
  const svg = document.querySelector('.trace-svg');
  const cur = svg && svg.querySelector('.tr-guide.cur');
  if (!cur) return null;
  const m = cur.getScreenCTM();
  const conv = (x, y) => { const p = new DOMPoint(x, y).matrixTransform(m); return [p.x, p.y]; };
  if (cur.tagName === 'circle') return { dot: conv(+cur.getAttribute('cx'), +cur.getAttribute('cy')) };
  const L = cur.getTotalLength(), pts = [];
  for (let d = 0; d <= L; d += step) { const q = cur.getPointAtLength(d); pts.push(conv(q.x, q.y)); }
  const e = cur.getPointAtLength(L); pts.push(conv(e.x, e.y));
  return { pts };
}"""

# Mount the tracing step on its own and run it for grapheme g.
MOUNT = """async (g) => {
  const app = document.getElementById('app');
  app.className = 'screen-lesson theme-farm';
  app.innerHTML = '<div class="lesson"><div class="topbar"></div><div class="stage step-meet"></div></div>';
  const G = { stage: app.querySelector('.stage'), known: { g: new Set() }, newG: [g], gem() {}, setReplay(f) { window.__replay = f; }, hat: '' };
  window.__tr = { done: false, res: null };
  window.__ww.trace.run(G, g).then(r => { window.__tr.done = true; window.__tr.res = r; });
}"""

# Pointer events straight into the SVG (touch / pen / mouse), as a finger would produce them.
DISPATCH = """([pts, type]) => {
  const svg = document.querySelector('.trace-svg');
  const fire = (t, p) => svg.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 9, pointerType: type, isPrimary: true, clientX: p[0], clientY: p[1] }));
  fire('pointerdown', pts[0]);
  pts.slice(1).forEach(p => fire('pointermove', p));
  fire('pointerup', pts[pts.length - 1]);
}"""


def sign_in(page):
    page.route("**/*.supabase.co/**", lambda route: route.abort())
    page.goto(URL)
    page.wait_for_timeout(600)
    page.locator(".play").click(force=True)
    page.wait_for_selector(".name-input", timeout=15000)
    page.fill(".name-input", "Test Kid")
    page.locator(".name-row .go").click(force=True)
    page.wait_for_selector("[data-act=offline]", timeout=15000)
    page.locator("[data-act=offline]").click()
    page.wait_for_selector(".node.current", timeout=15000)


def wait_cur(page):
    """Wait until a stroke is ready to be drawn (the short pause after the last one is over)."""
    page.wait_for_selector(".tr-guide.cur", state="attached", timeout=8000)
    page.wait_for_timeout(450)


def draw_mouse(page, pts, finish=True):
    page.mouse.move(*pts[0])
    page.mouse.down()
    for p in pts[1:]:
        page.mouse.move(*p)
    if finish:
        page.mouse.up()


def draw_events(page, pts, ptype):
    page.evaluate(DISPATCH, [pts, ptype])


def trace_all(page, ptype, limit=12):
    """Trace the current grapheme correctly, stroke by stroke. Returns the order letters were completed in."""
    order = []
    for _ in range(limit * 3):
        if page.evaluate("window.__tr.done"):
            break
        try:
            wait_cur(page)
        except Exception:
            if page.evaluate("window.__tr.done"):
                break
            raise
        s = page.evaluate(POINTS, 9)
        if s is None:
            continue
        if "dot" in s:
            x, y = s["dot"]
            if ptype == "mouse":
                page.mouse.click(x, y)
            else:
                draw_events(page, [[x, y], [x, y]], ptype)
        elif ptype == "mouse":
            draw_mouse(page, s["pts"])
        else:
            draw_events(page, s["pts"], ptype)
        for i in page.evaluate("[...document.querySelectorAll('.tr-letter.done')].map(e => +e.dataset.i)"):
            if i not in order:
                order.append(i)
        page.wait_for_timeout(120)
    page.wait_for_function("window.__tr.done", timeout=15000)
    return order


try:
    with sync_playwright() as p:
        # ------------------------------------------------------------ WebKit: iPhone and iPad
        for dev, ptype in (("iPhone 13", "mouse"), ("iPad (gen 7)", "pen")):
            tag = dev.split()[0].lower()
            b = p.webkit.launch()
            ctx = b.new_context(**p.devices[dev])
            page = ctx.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("console", lambda m: m.type == "error" and "ERR_FAILED" not in m.text and errors.append(m.text))
            sign_in(page)
            vw, vh = page.evaluate("[innerWidth, innerHeight]")
            print(f"--- {dev} ({vw}x{vh})")

            # Stroke data
            data = page.evaluate("""() => { const L = window.__ww.trace.LETTERS; return Object.fromEntries(Object.entries(L).map(([k, v]) =>
              [k, { w: v.w, strokes: v.strokes.map(s => s.dot ? 'dot' : s.length) }])); }""")
            check(sorted(data) == list(ALPHABET), "stroke data for exactly the 26 lowercase letters")
            check(all(len(v["strokes"]) >= 1 and all(s == "dot" or s >= 2 for s in v["strokes"]) for v in data.values()), "every stroke has points")
            mapping = page.evaluate("['igh', 'sh', 'a_e', 'y2', 'y3', 'qu', 'ck', 'o'].map(g => window.__ww.trace.lettersOf(g).join(''))")
            check(mapping == ["igh", "sh", "ae", "y", "y", "qu", "ck", "o"], f"grapheme -> letters {mapping}")
            every = page.evaluate("import('./js/data.js').then(m => Object.keys(m.GRAPHEMES).every(g => window.__ww.trace.lettersOf(g).every(c => c in window.__ww.trace.LETTERS)))")
            check(every, "every grapheme in the curriculum can be traced letter by letter")

            # The screen
            page.evaluate(MOUNT, "s")
            page.wait_for_selector(".trace-svg")
            wait_cur(page)
            r = page.evaluate("(() => { const r = document.querySelector('.trace-svg').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })()")
            check(r[0] >= 0 and r[2] <= vw and r[1] >= 0 and r[3] <= vh, f"trace area fits the {vw}x{vh} screen {[round(v) for v in r]}")
            check(r[2] - r[0] >= min(vw * 0.6, 300), f"letter is drawn large ({round(r[2] - r[0])}px wide)")
            check(page.evaluate("getComputedStyle(document.querySelector('.trace-svg')).touchAction") == "none", "touch-action: none (the page cannot scroll while tracing)")
            check(page.evaluate("[...document.querySelectorAll('.tr-startdot, .tr-ball')].length") == 2, "start dot and guide ball are present")
            check(page.evaluate("getComputedStyle(document.querySelector('.tr-ghost')).fontFamily").lower().startswith('andika'), "the letter is drawn in Andika")
            sk = page.evaluate("(() => { const r = document.querySelector('.trace-skip').getBoundingClientRect(); return [r.width, r.height, r.right <= innerWidth && r.bottom <= innerHeight]; })()")
            check(sk[0] >= 44 and sk[1] >= 44 and sk[2], f"skip button is touch sized and on screen {sk[:2]}")
            page.screenshot(path=str(SHOTS / f"{tag}-s-start.png"))

            # A correct trace finishes it
            s = page.evaluate(POINTS, 9)
            half = len(s["pts"]) // 2
            draw_mouse(page, s["pts"][:half], finish=False)
            page.wait_for_timeout(200)
            page.screenshot(path=str(SHOTS / f"{tag}-s-midway.png"))
            for pt in s["pts"][half:]:
                page.mouse.move(*pt)
            page.mouse.up()
            page.wait_for_function("window.__tr.done", timeout=15000)
            res = page.evaluate("window.__tr.res")
            check(res.get("traced") is True, f"tracing 's' finished {res}")
            rec = page.evaluate("window.__ww.store.state().trace.s")
            check(rec and rec["n"] == 1, f"progress recorded for 's' {rec}")
            check(page.evaluate("scrollY") == 0, "page did not scroll")

            # Wrong start (a touch mid-way down the line is ignored), then one failed try (stopping half way)
            page.evaluate(MOUNT, "l")
            wait_cur(page)
            s = page.evaluate(POINTS, 9)
            n = len(s["pts"])
            draw_mouse(page, s["pts"][int(n * 0.6):])
            page.wait_for_timeout(300)
            check(page.evaluate("document.querySelectorAll('.tr-ink.done').length") == 0 and not page.evaluate("window.__tr.done")
                  and page.evaluate("document.querySelector('.tr-ink').style.strokeDasharray").startswith("0"),
                  "a touch that starts away from the start dot is ignored")
            draw_mouse(page, s["pts"][: n // 2])
            page.wait_for_timeout(300)
            page.screenshot(path=str(SHOTS / f"{tag}-l-failed-try.png"))
            check(page.evaluate("document.querySelectorAll('.tr-ink.done').length") == 0, "one failed try does not finish the stroke (and the line starts again)")
            wait_cur(page)
            draw_mouse(page, s["pts"])
            page.wait_for_function("window.__tr.done", timeout=15000)
            check(page.evaluate("window.__tr.res.traced") is True and page.evaluate("window.__tr.res.helped") is False, "after one failed try the child can still finish unaided")

            # Two failed tries: shown how, and moves on
            page.evaluate(MOUNT, "a")
            wait_cur(page)
            s = page.evaluate(POINTS, 9)
            part = s["pts"][: max(8, len(s["pts"]) // 5)]
            draw_mouse(page, part); page.wait_for_timeout(250)
            draw_mouse(page, part)
            page.wait_for_function("document.querySelectorAll('.tr-ink.done').length >= 1", timeout=15000)
            page.wait_for_function("document.querySelector('.tr-start .tr-num').textContent === '2'", timeout=8000)
            check(True, "after two failed tries the stroke is drawn for the child and the next stroke is ready")
            page.screenshot(path=str(SHOTS / f"{tag}-a-second-stroke.png"))
            trace_all(page, ptype if ptype != "mouse" else "mouse")
            rec = page.evaluate("window.__ww.store.state().trace.a")
            check(page.evaluate("window.__tr.res.helped") is True and rec["n"] == 1 and rec["c"] == 0, f"a helped letter is recorded as such {rec}")

            # Several letters, in order
            for g, want in (("igh", [0, 1, 2]), ("sh", [0, 1]), ("a_e", [0, 1])):
                page.evaluate(MOUNT, g)
                page.wait_for_selector(".trace-svg")
                order = trace_all(page, ptype)
                check(order == want and page.evaluate("window.__tr.res.traced"), f"'{g}' traced letter by letter, in order {order}")
                if g == "igh":
                    pass
            page.evaluate(MOUNT, "igh")
            wait_cur(page)
            page.screenshot(path=str(SHOTS / f"{tag}-igh-start.png"))
            wb = page.evaluate("(() => { const r = document.querySelector('.trace-svg').getBoundingClientRect(); return r.right <= innerWidth && r.left >= 0; })()")
            check(wb, "three-letter grapheme fits the screen width")

            # Skip button
            page.evaluate(MOUNT, "o")
            wait_cur(page)
            page.locator(".trace-skip").click(force=True)
            page.wait_for_function("window.__tr.done", timeout=5000)
            check(page.evaluate("window.__tr.res.skipped") is True, "skip button ends the step")

            # All 26 letters
            bad = []
            for ch in ALPHABET:
                page.evaluate(MOUNT, ch)
                try:
                    trace_all(page, ptype)
                except Exception as e:
                    bad.append(f"{ch}: {str(e)[:60]}")
                    continue
                if page.evaluate("window.__tr.res.helped"):
                    bad.append(f"{ch}: needed help")
            check(not bad, f"all 26 letters traced correctly with {'real mouse input' if ptype == 'mouse' else 'pen pointer events'} {bad or ''}")
            if tag == "iphone":
                page.evaluate(MOUNT, "g"); wait_cur(page)
                page.screenshot(path=str(SHOTS / f"{tag}-g.png"))

            # Inside a real lesson: new sound -> find it -> trace it
            page.evaluate("localStorage.removeItem('wordwild.v1')")
            page.goto(URL)
            sign_in(page)
            page.evaluate("void window.__ww.startLesson(0)")   # (it runs the whole lesson: do not wait for it)
            page.wait_for_selector(".meet", timeout=15000)
            page.wait_for_selector(".choice-row [data-ok]", timeout=20000)
            page.locator(".choice-row [data-ok]").click(force=True)
            page.wait_for_selector(".trace-svg", timeout=20000)
            check(True, "in Lesson 1 the new sound's find-it step is followed by tracing")
            page.screenshot(path=str(SHOTS / f"{tag}-lesson-trace.png"))
            check(page.evaluate("document.querySelector('.stage').className").endswith("step-meet"), "tracing is part of the meet step")
            page.locator(".trace-skip").click(force=True)
            page.wait_for_selector(".meet", timeout=15000)
            check(True, "skipping moves on to the next new sound")
            check(not errors, f"{dev}: no page errors {errors[:3] or ''}")
            ctx.close(); b.close()

        # ------------------------------------------------------------ Progress record and merging
        b = p.webkit.launch()
        ctx = b.new_context(**p.devices["iPhone 13"])
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.route("**/*.supabase.co/**", lambda route: route.abort())
        # An older save (made before tracing existed) loads with an empty trace record.
        page.goto(URL)
        page.evaluate("""() => localStorage.setItem('wordwild.v1', JSON.stringify({ done: { L1: { stars: 2, acc: .8, plays: 1 } }, items: {}, recent: [], confusions: {}, gems: 12,
          hats: ['none'], hat: 'none', wordlings: [], books: [], best: { pop: 0, rocket: 0, memory: 0 }, today: { date: '', sec: 0 }, settings: { music: true }, unlocked: 0,
          seenIntro: true, name: 'Old', pinHash: '', cloud: false, savedAt: 1, syncedAt: 0, baseGems: 12 }))""")
        page.goto(URL)
        page.wait_for_timeout(500)
        st = page.evaluate("(() => { const s = window.__ww.store.state(); return { trace: s.trace, gems: s.gems, done: Object.keys(s.done) }; })()")
        check(st["trace"] == {} and st["gems"] == 12 and st["done"] == ["L1"], f"an older save loads with an empty trace record and nothing lost {st}")
        out = page.evaluate("""() => {
          const S = window.__ww.store, s = S.state();
          S.recordTrace('a', true); S.recordTrace('a', false); S.recordTrace('b', true);
          const local = JSON.parse(JSON.stringify(s.trace));
          // another device that also traced a (more times), plus c; and one whose save is older (no trace field at all)
          S.merge({ trace: { a: { n: 5, c: 1 }, c: { n: 1, c: 1 } }, done: {}, items: {}, confusions: {}, gems: 12 });
          const merged = JSON.parse(JSON.stringify(s.trace));
          S.merge({ done: {}, items: {}, confusions: {}, gems: 12 });
          S.merge(null);
          S.merge({ trace: null, done: {}, gems: 12 });
          const after = JSON.parse(JSON.stringify(s.trace));
          // merging the same data again changes nothing
          S.merge({ trace: { a: { n: 5, c: 1 }, c: { n: 1, c: 1 } }, done: {}, gems: 12 });
          const again = JSON.parse(JSON.stringify(s.trace));
          S.adopt({ done: {}, items: {}, gems: 3 }, 5);   // a cloud save from before tracing existed
          return { local, merged, after, again, adopted: window.__ww.store.state().trace };
        }""")
        check(out["local"] == {"a": {"n": 2, "c": 1}, "b": {"n": 1, "c": 1}}, f"tracing counts record {out['local']}")
        check(out["merged"] == {"a": {"n": 5, "c": 1}, "b": {"n": 1, "c": 1}, "c": {"n": 1, "c": 1}}, f"merge keeps the larger count for each letter {out['merged']}")
        check(out["after"] == out["merged"] and out["again"] == out["merged"], "merging an older save, null, or the same save twice changes nothing")
        check(out["adopted"] == {}, f"adopting a cloud save from before tracing leaves an empty record, not an error {out['adopted']}")
        check(not errors, f"no page errors {errors[:3] or ''}")
        ctx.close(); b.close()

        # ------------------------------------------------------------ Chromium: the sound plays at the end
        b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        page = b.new_page(viewport={"width": 390, "height": 760})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: m.type == "error" and "ERR_FAILED" not in m.text and errors.append(m.text))
        page.add_init_script("""(() => { window.__starts = []; const o = AudioBufferSourceNode.prototype.start;
          AudioBufferSourceNode.prototype.start = function (...a) { if (this.buffer) window.__starts.push(+this.buffer.duration.toFixed(4)); return o.apply(this, a); }; })()""")
        sign_in(page)
        dur = page.evaluate("""async () => { const ac = new AudioContext(); const ab = await (await fetch('audio/p_o.mp3')).arrayBuffer();
          return +(await ac.decodeAudioData(ab)).duration.toFixed(4); }""")
        page.evaluate(MOUNT, "o")
        wait_cur(page)
        page.wait_for_timeout(2500)   # let the introduction finish
        page.evaluate("window.__starts.length = 0")
        s = page.evaluate(POINTS, 9)
        draw_mouse(page, s["pts"])
        page.wait_for_function("window.__tr.done", timeout=15000)
        check(dur in page.evaluate("window.__starts"), f"the sound p_o ({dur}s) plays when the trace is finished {page.evaluate('window.__starts')}")
        check(not errors, f"Chromium: no page errors {errors[:3] or ''}")
        b.close()
finally:
    server.terminate()

print()
print("FAILED: " + "; ".join(fails) if fails else "ALL PASSED")
sys.exit(1 if fails else 0)
