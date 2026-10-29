"""Automated playthrough in WebKit (Safari engine) on iPhone and iPad sizes.
Plays a full lesson answering correctly, visits every screen, saves screenshots
to work/shots/<device>/ and reports page errors.

Usage: .venv/Scripts/python.exe -I tests/play.py [URL] [--lessons N]
"""
import sys, time, json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
URL = next((a for a in sys.argv[1:] if a.startswith("http")), "http://localhost:5180/")
N = int(sys.argv[sys.argv.index("--lessons") + 1]) if "--lessons" in sys.argv else 1
AUTO = (ROOT / "tests" / "autoplay.js").read_text(encoding="utf-8")

DEVICES = {"iphone": "iPhone 13", "ipad": "iPad (gen 7)"}
failures = []

with sync_playwright() as p:
    for tag, dev in DEVICES.items():
        out = ROOT / "work" / "shots" / tag
        out.mkdir(parents=True, exist_ok=True)
        for f in out.glob("*.png"):
            f.unlink()
        browser = p.webkit.launch()
        ctx = browser.new_context(**p.devices[dev])
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: m.type == "error" and errors.append(m.text))
        page.goto(URL)
        page.wait_for_timeout(800)
        page.screenshot(path=str(out / "00-title.png"))
        page.locator(".play").tap(force=True)
        page.wait_for_timeout(1500)
        page.screenshot(path=str(out / "01-map.png"))
        page.evaluate(AUTO)
        seen, shot = set(), 2
        for lesson in range(N):
            page.evaluate("startAuto(900)")
            t0 = time.time()
            while time.time() - t0 < 420:
                page.wait_for_timeout(700)
                key = page.evaluate("""() => {
                  const st = document.querySelector('.stage');
                  const app = document.getElementById('app').className.split(' ')[0];
                  return st ? st.className.replace('stage ', '').replace(' busy', '') + (document.querySelector('.story-text') ? '-page' : document.querySelector('.book-cover') ? '-cover' : '') : app;
                }""")
                if key not in seen and lesson == 0:
                    seen.add(key)
                    page.wait_for_timeout(500)
                    page.screenshot(path=str(out / f"{shot:02d}-{key}.png"))
                    shot += 1
                if page.evaluate("log.includes('lesson done')"):
                    break
            else:
                failures.append(f"{tag}: lesson {lesson + 1} did not finish; last={key}; log={page.evaluate('log.slice(-6)')}")
                break
            page.screenshot(path=str(out / f"{shot:02d}-reward-L{lesson + 1}.png")); shot += 1
            page.evaluate("log.length = 0")
            page.locator(".reward-row .go").tap(force=True)
            page.wait_for_timeout(1200)
        page.screenshot(path=str(out / f"{shot:02d}-map-after.png")); shot += 1
        for name in ["Zoo", "Shop", "Books", "Play"]:
            page.locator(".dock-btn", has_text=name).tap(force=True)
            page.wait_for_timeout(1200)
            page.screenshot(path=str(out / f"{shot:02d}-{name.lower()}.png")); shot += 1
            page.locator(".back").first.tap(force=True)
            page.wait_for_timeout(600)
        # Parent corner: hold the gear.
        page.evaluate("document.querySelector('.gear').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))")
        page.wait_for_timeout(1900)
        page.screenshot(path=str(out / f"{shot:02d}-parent.png"), full_page=True); shot += 1
        state = page.evaluate("JSON.parse(localStorage.getItem('wordwild.v1'))")
        print(f"{tag}: lessons done {list(state['done'])}, gems {state['gems']}, wordlings {state['wordlings']}, books {state['books']}")
        if errors:
            failures.append(f"{tag}: page errors: {errors[:5]}")
        browser.close()

print("FAILURES:\n" + "\n".join(failures) if failures else "ALL OK")
