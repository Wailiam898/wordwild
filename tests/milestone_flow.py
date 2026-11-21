"""Bonus games wired into Wordwild: finishing a world's last lesson, gems, quitting, the Play corner, old saves, merging.

WebKit at iPhone SE (375 px) and iPad size. Every browser blocks *.supabase.co.
The game itself is only stubbed where a test needs a known score (window.__wwPlayMilestone); the real Chick Run is
launched and quit in the first scenario, and the three games are played by tests/milestone.py.
Usage: .venv/Scripts/python.exe -I tests/milestone_flow.py
"""
import sys, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "work" / "shots" / "chick-theme"
SHOTS.mkdir(parents=True, exist_ok=True)
PORT = 5198
URL = f"http://127.0.0.1:{PORT}/"
fails = []


def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg, flush=True)
    if not ok:
        fails.append(msg)


server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1", "--directory", str(ROOT / "app")],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
SEED = """([ids, n, extra]) => { const s = { done: {}, items: {}, recent: [], confusions: {}, gems: 100, hats: ['none'], hat: 'none', wordlings: [], books: [],
  best: { pop: 0, rocket: 0, memory: 0 }, today: { date: '', sec: 0 }, settings: { music: false }, unlocked: 0, seenIntro: true, name: 'Test Kid', pinHash: '', cloud: false, savedAt: 0, syncedAt: 0, baseGems: 0 };
  ids.slice(0, n).forEach(id => s.done[id] = { stars: 3, acc: 1, plays: 1 }); Object.assign(s, extra || {});
  localStorage.setItem('wordwild.v1', JSON.stringify(s)); }"""
FINISH = """([i, stars]) => { window.__wwKind = null;
  if (stars) window.__wwPlayMilestone = async (k, w) => { window.__wwKind = k + ':' + w; return { score: 77, stars }; };
  const L = window.__ww.LESSONS[i]; const r = window.__ww.store.completeLesson(L.id, 1); window.__ww.hatchScreen(L, r.stars, r.first, 5); }"""


def boot(page, ids, n, extra=None):
    page.evaluate(SEED, [ids, n, extra])
    page.goto(URL)
    page.wait_for_timeout(600)
    page.locator(".play").tap(force=True)
    page.wait_for_selector(".map-scroll", timeout=15000)
    page.wait_for_timeout(500)


try:
    with sync_playwright() as p:
        for dev_tag, dev in (("iphone375", "iPhone SE"), ("ipad", "iPad (gen 7)")):
            b = p.webkit.launch()
            ctx = b.new_context(**p.devices[dev])
            ctx.route("**/*.supabase.co/**", lambda r: r.abort())
            page = ctx.new_page()
            errs = []
            page.on("pageerror", lambda e: errs.append(str(e)))
            page.on("console", lambda m: m.type == "error" and "ERR_FAILED" not in m.text and errs.append(m.text))
            page.goto(URL)
            page.wait_for_timeout(600)
            info = page.evaluate("""() => { const L = window.__ww.LESSONS; const out = [];
              [0, 1, 2, 3, 4, 5, 6].forEach(w => { const idx = L.map((l, i) => l.wi === w ? i : -1).filter(i => i >= 0); out.push(idx[idx.length - 1]); }); return { ids: L.map(l => l.id), last: out }; }""")
            ids, last = info["ids"], info["last"]
            t = dev_tag + ": "
            check(len(last) == 7, t + "seven worlds")

            # ---- 1. world 1's last lesson: egg hatch, then World complete, then the real Chick Run; quit with the cross
            boot(page, ids, last[0])
            gems0 = page.evaluate("window.__ww.store.state().gems")
            page.evaluate(FINISH, [last[0], 0])
            page.wait_for_selector(".hatch-egg", timeout=5000)
            check(True, t + "the egg hatch shows first")
            page.wait_for_selector(".reward-row .go", timeout=20000)
            check(page.locator(".ms-root").count() == 0, t + "the game does not start before the child taps")
            page.locator(".reward-row .go").tap(force=True)
            page.wait_for_selector(".world-done", timeout=5000)
            txt = page.inner_text(".world-done")
            check("World complete!" in txt and "Chick Run" in txt, t + f"World complete moment names Chick Run ({txt!r})")
            page.wait_for_timeout(1200)
            page.screenshot(path=str(SHOTS / f"flow-{dev_tag}-world-complete.png"))
            page.locator(".world-done .go").tap(force=True)
            try:
                page.wait_for_selector(".ms-root.ms-run", timeout=8000)
            except Exception:
                print("DEBUG", errs, page.evaluate("document.getElementById('app').className + ' | ' + document.querySelectorAll('.ms-root').length"))
                raise
            check(True, t + "Chick Run launches")
            page.wait_for_timeout(1500)
            page.locator(".ms-quit").tap(force=True)
            page.wait_for_selector(".map-scroll", timeout=5000)
            st = page.evaluate("({ g: window.__ww.store.state().gems, b: window.__ww.store.state().bonus, u: window.__ww.store.bonusUnlocked(0) })")
            check(st["g"] == gems0 and st["u"] and st["b"]["0"]["u"] == 1, t + f"quitting gives no gems, still unlocks, returns to the map ({st})")
            check(page.locator(".ms-root").count() == 0, t + "the game is gone after quitting")

            # ---- 2. stars give 5 gems each (game stubbed with a known result)
            for wi, kind, stars in ((1, "feed", 3), (2, "hide", 1)):
                boot(page, ids, last[wi])
                gems0 = page.evaluate("window.__ww.store.state().gems")
                page.evaluate(FINISH, [last[wi], stars])
                page.wait_for_selector(".reward-row .go", timeout=20000)
                page.locator(".reward-row .go").tap(force=True)
                page.wait_for_selector(".world-done .go", timeout=5000)
                page.locator(".world-done .go").tap(force=True)
                page.wait_for_selector(".practice-done .reward-row .go", timeout=8000)
                st = page.evaluate("({ g: window.__ww.store.state().gems, k: window.__wwKind, b: window.__ww.store.bonusBest(%d) })" % wi)
                check(st["k"] == f"{kind}:{wi}", t + f"world {wi + 1} launches {kind} ({st['k']})")
                check(st["g"] - gems0 == 5 * stars and st["b"] == {"stars": stars, "score": 77}, t + f"world {wi + 1}: {stars} star(s) give {5 * stars} gems, best saved ({st})")
                page.locator(".practice-done .reward-row .go").tap(force=True)
                page.wait_for_selector(".map-scroll", timeout=5000)
                page.evaluate("window.__wwPlayMilestone = undefined")

            # ---- 3. a save that finished worlds 1-3 before the games existed
            boot(page, ids, last[2] + 1)
            check(page.locator(".ms-root, .world-done").count() == 0, t + "old save: no game and no World complete screen on start")
            page.locator(".dock-btn", has_text="Play").tap(force=True)
            page.wait_for_selector(".bonus-card", timeout=5000)
            cards = page.evaluate("[...document.querySelectorAll('.bonus-card')].map(c => ({ locked: c.classList.contains('locked'), text: c.innerText.replace(/\\n/g, ' | ') }))")
            check(len(cards) == 7 and [c["locked"] for c in cards] == [False] * 3 + [True] * 4, t + f"old save: three games open, four locked ({[c['locked'] for c in cards]})")
            check(cards[3]["text"].endswith("Finish World 4!") and "Finish World 7!" in cards[6]["text"], t + f"locked games say what to finish ({cards[3]['text']!r})")
            page.screenshot(path=str(SHOTS / f"flow-{dev_tag}-old-save-play-corner.png"))
            page.locator(".bonus-card.locked").first.tap(force=True)
            page.wait_for_timeout(400)
            check(page.locator(".ms-root").count() == 0, t + "tapping a locked game does nothing")
            page.evaluate("window.__wwPlayMilestone = async () => ({ score: 40, stars: 2 })")
            g0 = page.evaluate("window.__ww.store.state().gems")
            page.locator(".bonus-card").first.tap(force=True)
            page.wait_for_selector(".practice-done .reward-row .go", timeout=5000)
            page.locator(".practice-done .reward-row .go").tap(force=True)
            page.wait_for_selector(".bonus-card", timeout=5000)
            page.evaluate("window.__wwPlayMilestone = async () => ({ score: 10, stars: 1 })")
            page.locator(".bonus-card").first.tap(force=True)
            page.wait_for_selector(".practice-done .reward-row .go", timeout=5000)
            page.locator(".practice-done .reward-row .go").tap(force=True)
            page.wait_for_selector(".bonus-card", timeout=5000)
            st = page.evaluate("({ g: window.__ww.store.state().gems, b: window.__ww.store.bonusBest(0) })")
            check(st["g"] - g0 == 15 and st["b"] == {"stars": 2, "score": 40}, t + f"replays give gems each time, the best stays at the higher ({st})")
            check(page.locator(".bonus-card").first.inner_text().count("⭐") == 2, t + "the card shows the best stars")
            check(not page.evaluate("document.documentElement.scrollWidth > innerWidth + 1"), t + "no sideways scroll in the Play corner")

            # ---- 4. merging saves from two devices, and a save with no bonus field
            r = page.evaluate("""() => { const s = window.__ww.store; const S = s.state();
              S.bonus = { 0: { u: 0, s: 3, b: 20 }, 4: { u: 1, s: 1, b: 5 } };
              s.merge({ bonus: { 0: { u: 1, s: 2, b: 50 }, 1: { u: 0, s: 3, b: 10 }, 9: { u: 1, s: 3, b: 99 }, 2: 'junk' } });
              return { b: S.bonus, open4: s.bonusUnlocked(4) }; }""")
            bb = r["b"]
            check(bb["0"] == {"u": 1, "s": 3, "b": 50} and bb["1"]["s"] == 3 and bb["4"] == {"u": 1, "s": 1, "b": 5} and "9" not in bb,
                  t + f"merge keeps the larger stars and score, ORs unlocked, ignores junk ({bb})")
            check(r["open4"] is True, t + "a merged unlock opens a game")
            page.evaluate(SEED, [ids, 2, None])
            page.evaluate("localStorage.setItem('wordwild.v1', JSON.stringify((() => { const s = JSON.parse(localStorage.getItem('wordwild.v1')); delete s.bonus; return s; })()))")
            page.goto(URL); page.wait_for_timeout(600)
            page.locator(".play").tap(force=True)
            page.wait_for_selector(".map-scroll", timeout=15000)
            check(page.evaluate("window.__ww.store.bonusUnlocked(0) === false"), t + "a save without the bonus field loads fine")
            check(not errs, t + f"no console errors {errs[:3]}")
            b.close()
finally:
    server.terminate()
print("\nFAILED:" if fails else "\nAll checks passed.", fails if fails else "")
sys.exit(1 if fails else 0)
