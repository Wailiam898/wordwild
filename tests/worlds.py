"""Plays chosen lessons from every world in WebKit (Safari engine) at iPhone and iPad sizes,
answering correctly with tests/autoplay.js. Reports the activities each lesson used,
page errors and lessons that stall; screenshots of each new activity go to work/shots/worlds/.

--chromium plays in Chromium instead, where speech really plays (WebKit on Windows has no Web Audio).

Usage: .venv/Scripts/python.exe -I tests/worlds.py [URL] [--lessons L5,L20,...] [--device iphone|ipad] [--chromium]
"""
import sys, time, json
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
URL = next((a for a in sys.argv[1:] if a.startswith("http")), "http://localhost:5180/")
arg = lambda k, d: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
PICK = arg("--lessons", "L5,L9,L12,L20,L22,L23,L24,L25,L26,L27,L28,L30,L31,L32,L33,L34").split(",")
DEVICES = {"iphone": "iPhone 13", "ipad": "iPad (gen 7)"}
if "--device" in sys.argv:
    DEVICES = {arg("--device", "iphone"): DEVICES[arg("--device", "iphone")]}
AUTO = (ROOT / "tests" / "autoplay.js").read_text(encoding="utf-8")
OUT = ROOT / "work" / "shots" / "worlds"
OUT.mkdir(parents=True, exist_ok=True)
failures, seen_types = [], set()

with sync_playwright() as p:
    for tag, dev in DEVICES.items():
        browser = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"]) if "--chromium" in sys.argv else p.webkit.launch()
        ctx = browser.new_context(**{k: v for k, v in p.devices[dev].items() if not ("--chromium" in sys.argv and k == "default_browser_type")})
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        # Aborted Supabase calls (offline play) log ERR_FAILED in Chromium; anything else counts.
        page.on("console", lambda m: m.type == "error" and "ERR_FAILED" not in m.text and errors.append(m.text))
        page.route("**/*.supabase.co/**", lambda route: route.abort())
        page.goto(URL)
        ids = page.evaluate("import('./js/data.js').then(m => m.allLessons().map(l => l.id))")
        for lid in PICK:
            idx = ids.index(lid)
            # Fresh progress with every earlier lesson done, then open the map.
            page.evaluate("""([ids, idx]) => {
              const s = { done: {}, items: {}, recent: [], confusions: {}, gems: 0, hats: ['none'], hat: 'none', wordlings: [], books: [],
                best: { pop: 0, rocket: 0, memory: 0 }, today: { date: '', sec: 0 }, settings: { music: false, limit: 0 }, unlocked: 0,
                seenIntro: true, name: 'Test Kid', pinHash: '', cloud: false, savedAt: 0, syncedAt: 0, baseGems: 0 };
              ids.slice(0, idx).forEach(id => s.done[id] = { stars: 3, acc: 1, plays: 1 });
              localStorage.setItem('wordwild.v1', JSON.stringify(s));
            }""", [ids, idx])
            page.goto(URL)
            page.wait_for_timeout(700)
            page.locator(".play").tap(force=True)
            page.wait_for_selector(".node.current", timeout=15000)
            page.evaluate(AUTO)
            page.evaluate("log.length = 0; window.__types = []")
            page.locator(".node.current").tap(force=True)
            page.wait_for_timeout(500)
            page.evaluate("startAuto(700)")
            t0, last, stuck_since, types = time.time(), None, time.time(), []
            while time.time() - t0 < 600:
                page.wait_for_timeout(500)
                st = page.evaluate("""() => { const s = document.querySelector('.stage');
                  return s ? s.className.replace('stage ', '').replace(' busy', '').replace('step-', '') : document.getElementById('app').className; }""")
                if st != last:
                    last, stuck_since = st, time.time()
                    if not types or types[-1] != st:
                        types.append(st)
                    key = f"{tag}-{st}"
                    if st not in ("screen-hatch",) and not (OUT / f"{key}.png").exists():
                        page.wait_for_timeout(900)
                        page.screenshot(path=str(OUT / f"{key}.png"))
                if page.evaluate("log.includes('lesson done')"):
                    break
                if time.time() - stuck_since > 90:
                    failures.append(f"{tag} {lid}: stuck on {st}; log={page.evaluate('log.slice(-8)')}")
                    page.screenshot(path=str(OUT / f"STUCK-{tag}-{lid}.png"))
                    break
            else:
                failures.append(f"{tag} {lid}: did not finish in time")
            page.evaluate("window.stopAuto && stopAuto()")
            seen_types.update(types)
            done = page.evaluate("Object.keys(JSON.parse(localStorage.getItem('wordwild.v1')).done).length")
            print(f"{tag} {lid}: {' > '.join(types)}  (done={done})", flush=True)
        # Map scrolled to the end, the arcade's Memory Match, and the parent corner.
        page.goto(URL); page.wait_for_timeout(600)
        page.locator(".play").tap(force=True)
        page.wait_for_selector(".map-scroll", timeout=15000)
        page.evaluate("document.querySelector('.map-scroll').scrollTop = 1e6")
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT / f"{tag}-map-end.png"))
        page.evaluate("document.querySelectorAll('.world-banner')[5].scrollIntoView()")
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUT / f"{tag}-map-space.png"))
        page.locator(".dock-btn", has_text="Play").tap(force=True)
        page.wait_for_timeout(600)
        page.screenshot(path=str(OUT / f"{tag}-arcade.png"))
        page.locator(".arcade-card", has_text="Memory").tap(force=True)
        page.evaluate(AUTO)
        page.evaluate("startAuto(500)")
        try:
            page.wait_for_selector(".final-score", timeout=90000)
            page.screenshot(path=str(OUT / f"{tag}-memory-score.png"))
        except Exception:
            failures.append(f"{tag}: Memory Match arcade did not finish")
        page.evaluate("window.stopAuto && stopAuto()")
        page.evaluate("__ww.parentScreen()")
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT / f"{tag}-parent.png"), full_page=True)
        wide = page.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
        if wide:
            failures.append(f"{tag}: sideways scroll on parent screen")
        if errors:
            failures.append(f"{tag}: page errors: {errors[:6]}")
        browser.close()

want = {"pop", "meet", "blast", "forge", "heart", "pip", "story", "chop", "memory", "ladder", "sort", "build", "silly", "fix", "dict", "finish", "speed"}
missing = want - seen_types
if missing:
    print("activities not reached:", sorted(missing))
print("FAILURES:\n" + "\n".join(failures) if failures else "ALL OK")
sys.exit(1 if failures else 0)
