"""Reading speed (grown-ups only): how it is measured, saved and shown.

Chromium (real speech): the timer does not count time while the voice is talking or while the tab is hidden.
WebKit (Safari engine): silly values are dropped; a word read right first time is saved from the hop picture
pick, Memory Match (word card first) and Silly or Sensible; wrong answers and the timed arcade game are not saved;
the child sees no timer and no speed text; stars and gems are unchanged. Saved progress: a small bounded history
(last 12 weeks, last 300 words) that merges across devices without double counting and with old or damaged saves.
The grown-ups corner shows "Reads a word in about 4 seconds, down from 7" and the slowest words.

Supabase is blocked in every browser. Usage: .venv/Scripts/python.exe -I tests/fluency.py
"""
import sys, subprocess, json
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
APP = Path(sys.argv[sys.argv.index("--app") + 1]) if "--app" in sys.argv else ROOT / "app"   # --app DIR: test a copy of the app (used to show the checks catch a broken rule)
SHOTS = ROOT / "work" / "shots" / "fluency"
SHOTS.mkdir(parents=True, exist_ok=True)
AUTO = (ROOT / "tests" / "autoplay.js").read_text(encoding="utf-8")
PORT = int(sys.argv[sys.argv.index("--port") + 1]) if "--port" in sys.argv else 5185
URL = f"http://localhost:{PORT}/"
fails = []


def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--directory", str(APP)],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                          creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))

FRESH = """() => { localStorage.clear(); localStorage.setItem('wordwild.v1', JSON.stringify({ done: {}, items: {}, recent: [], confusions: {}, gems: 0, hats: ['none'], hat: 'none',
  wordlings: [], books: [], best: { pop: 0, rocket: 0, memory: 0 }, today: { date: '', sec: 0 }, settings: { music: false }, unlocked: 0, seenIntro: true, name: 'Test Kid',
  pinHash: '', cloud: false, savedAt: 0, syncedAt: 0, baseGems: 0 })); }"""
STAGE = """(step) => {
  const app = document.getElementById('app');
  app.className = 'screen-lesson theme-farm';
  app.innerHTML = '<div class="lesson"><div class="topbar"></div><div class="stage step-' + step + '"></div></div>';
  window.__gems = 0;
  const seg = w => [...w];
  window.__pool = [{ w: 'sun', e: '☀️', seg: ['s', 'u', 'n'] }, { w: 'pig', e: '🐷', seg: ['p', 'i', 'g'] }, { w: 'cat', e: '🐱', seg: ['c', 'a', 't'] }, { w: 'dog', e: '🐶', seg: ['d', 'o', 'g'] }];
  window.__G = { stage: app.querySelector('.stage'), known: { g: new Set(['s','u','n','p','i','g','c','a','t','d','o']), h: new Set() }, newG: [], gem(el, n) { window.__gems += n; }, setReplay() {}, hat: '', ra: { used: 2, max: 2 }, pool: window.__pool };
  return true;
}"""
FLU = "() => JSON.parse(JSON.stringify(window.__ww.store.state().flu))"
COUNT = """() => { const f = window.__ww.store.state().flu; let w = 0, sw = 0; Object.values(f.wk).forEach(d => Object.values(d).forEach(r => { w += r[0]; sw += r[2]; })); return { words: w, sentenceWords: sw, kept: Object.keys(f.w) }; }"""

with sync_playwright() as p:
    # ------------------------------------------------------------------ the timer, with real speech (Chromium)
    b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
    ctx = b.new_context(viewport={"width": 800, "height": 600})
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and "ERR_FAILED" not in m.text and errors.append(m.text))
    page.route("**/*.supabase.co/**", lambda route: route.abort())
    page.goto(URL)
    page.evaluate(FRESH)
    page.reload()
    page.wait_for_timeout(600)
    r = page.evaluate("""async () => {
      const A = await import('./js/audio.js'), F = await import('./js/fluency.js');
      A.unlock(); await new Promise(r => setTimeout(r, 300));
      await A.load('n_story_start');
      const dur = A.clipDuration('n_story_start') * 1000;
      // 1. wait 1.2 s of silence, then the voice talks for its whole length, then 0.6 s more of silence
      const t = F.startTimer();
      await new Promise(r => setTimeout(r, 1200));
      await A.say('n_story_start');
      await new Promise(r => setTimeout(r, 600));
      const withVoice = t.elapsed();
      // 2. the same without any voice
      const t2 = F.startTimer(); await new Promise(r => setTimeout(r, 1800)); const plain = t2.elapsed();
      // 3. a tab that is hidden for 3 s
      const t3 = F.startTimer();
      await new Promise(r => setTimeout(r, 700));
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise(r => setTimeout(r, 3000));
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise(r => setTimeout(r, 500));
      const hidden = t3.elapsed();
      return { dur, withVoice, plain, hidden, sensible: [0.2, 0.5, 4, 30, 31, NaN, 400].map(F.sensible) };
    }""")
    check(r["dur"] > 1500, f"the test clip is long enough to measure ({r['dur'] / 1000:.1f}s)")
    check(1.5 < r["withVoice"] < 2.4, f"time while the voice talks is not counted: 1.2 s + {r['dur'] / 1000:.1f} s of speech + 0.6 s measured as {r['withVoice']:.2f} s (about 1.8)")
    check(1.6 < r["plain"] < 2.1, f"with no voice the timer reads true time ({r['plain']:.2f} s for 1.8 s)")
    check(1.0 < r["hidden"] < 1.6, f"time while the tab is hidden is not counted: 0.7 + 3 hidden + 0.5 measured as {r['hidden']:.2f} s (about 1.2)")
    check(r["sensible"] == [False, True, True, True, False, False, False], f"silly values are dropped: under 0.5 s, over 30 s, not a number {r['sensible']}")
    check(not errors, f"Chromium: no page errors {errors[:3] or ''}")
    b.close()

    if "--timer-only" in sys.argv:
        server.terminate()
        print(("FAILURES:" + chr(10) + chr(10).join(fails)) if fails else "ALL OK")
        sys.exit(1 if fails else 0)
    # ------------------------------------------------------------------ saving and merging
    b = p.webkit.launch()
    ctx = b.new_context(**p.devices["iPhone SE (3rd gen)"])
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and "ERR_FAILED" not in m.text and errors.append(m.text))
    page.route("**/*.supabase.co/**", lambda route: route.abort())
    page.goto(URL)
    page.evaluate(FRESH)
    page.reload()
    page.wait_for_timeout(600)
    page.evaluate(AUTO)
    # An old save (no reading-speed data at all) loads.
    old = page.evaluate("""() => { const s = JSON.parse(localStorage.getItem('wordwild.v1')); delete s.flu; delete s.comp; delete s.practice; localStorage.setItem('wordwild.v1', JSON.stringify(s)); return true; }""")
    page.reload()
    page.wait_for_timeout(500)
    check(page.evaluate("window.__ww.store.readingWeeks().length") == 0 and page.evaluate("window.__ww.store.slowWords().length") == 0, "an old save with no reading-speed data loads and shows nothing")
    page.evaluate("""() => { const s = window.__ww.store; s.recordReadTime('sun', 5); s.recordReadTime('sun', 3); s.recordReadTime('sun', 4); s.recordReadTime('pig', 9); s.recordReadTime(null, 12, 6); }""")
    wk = page.evaluate("window.__ww.store.readingWeeks()")
    check(len(wk) == 1 and wk[0]["words"] == 4 and abs(wk[0]["word"] - 21 / 4) < 0.01, f"a week adds up: 4 words, 5.25 s each ({wk[0]['words']}, {wk[0]['word']:.2f})")
    check(wk[0]["sentenceWords"] == 6 and abs(wk[0]["sentence"] - 2.0) < 0.01, f"a 6-word sentence read in 12 s is 2 s a word ({wk[0]['sentenceWords']}, {wk[0]['sentence']:.2f})")
    slow = page.evaluate("window.__ww.store.slowWords(8, 3)")
    check([x["w"] for x in slow] == ["sun"], f"the slow-words list needs a word read 3 times ({slow})")
    before = page.evaluate("({ gems: window.__ww.store.state().gems, done: Object.keys(window.__ww.store.state().done).length, items: Object.keys(window.__ww.store.state().items).length })")
    page.evaluate("window.__ww.store.recordReadTime('cat', 20)")
    after = page.evaluate("({ gems: window.__ww.store.state().gems, done: Object.keys(window.__ww.store.state().done).length, items: Object.keys(window.__ww.store.state().items).length })")
    check(before == after, "saving a time never changes gems, lessons done or the learning boxes")
    # Two devices.
    two = {"flu": {"wk": {}, "w": {"sun": [9, 4, 99999]}}}
    wkey = page.evaluate("window.__ww.store.weekKey()")
    two["flu"]["wk"][wkey] = {"devB": [10, 50, 20, 40], "devC": [2, 8, 0, 0]}
    m = page.evaluate("(o) => { const s = window.__ww.store; s.merge(o); s.merge(o); s.merge(o); return s.readingWeeks(); }", two)
    # this device: 5 words (sun x3, pig, cat), 36+... recompute from the state instead of guessing
    mine = page.evaluate("Object.values(window.__ww.store.state().flu.wk[window.__ww.store.weekKey()]).map(r => r.slice())")
    tw = sum(r[0] for r in mine); ts = sum(r[1] for r in mine)
    check(abs(m[-1]["words"] - tw) < 1e-6 and abs(m[-1]["word"] - ts / tw) < 1e-6 and len(mine) == 3, f"two devices add up, and merging three times does not double count ({m[-1]['words']} words over {len(mine)} devices)")
    check(page.evaluate("window.__ww.store.state().flu.w.sun")[0] == 9, "the newer reading of a word wins when two devices disagree")
    # A device that played more replaces its own older record; an older copy never shrinks it.
    page.evaluate("""(w) => { const s = window.__ww.store; s.merge({ flu: { wk: { [w]: { devB: [3, 9, 0, 0] } }, w: {} } }); }""", wkey)
    check(page.evaluate("window.__ww.store.state().flu.wk[window.__ww.store.weekKey()].devB")[0] == 10, "an older copy of a device's record never replaces a newer one")
    # Bounds: 12 weeks, 300 words.
    heavy = {"flu": {"wk": {}, "w": {}}}
    for i in range(30):
        heavy["flu"]["wk"][f"2025-{(i % 12) + 1:02d}-{(i // 12) + 1:02d}"] = {"devA": [5, 20, 0, 0]}
    for i in range(500):
        heavy["flu"]["w"][f"word{i}"] = [4, 3, 20000 + i]
    page.evaluate("(o) => window.__ww.store.merge(o)", heavy)
    c = page.evaluate("({ weeks: Object.keys(window.__ww.store.state().flu.wk).length, words: Object.keys(window.__ww.store.state().flu.w).length, bytes: JSON.stringify(window.__ww.store.state().flu).length })")
    check(c["weeks"] <= 12 and c["words"] <= 300, f"history stays small: {c['weeks']} weeks, {c['words']} words, {c['bytes'] // 1024} KB")
    page.evaluate("() => window.__ww.store.merge({ flu: { wk: { 'x': 5, '2026-01-05': { d: [1, 'a'] }, '2026-01-12': { d: [-1, 2, 3, 4] } }, w: { bad: 'x', ok: [3, 3, 5] } }, comp: 'junk', practice: 7 })")
    check(not errors, f"saving and merging: no page errors {errors[:3] or ''}")

    # ------------------------------------------------------------------ in the activities
    page.evaluate(FRESH)
    page.reload()
    page.wait_for_timeout(500)
    page.evaluate(AUTO)

    # A bot that waits a moment on each question, like a child reading it (so quick guesses are not mistaken for reads).
    SLOWBOT = """() => { if (window.__slowbot) return; window.__slowbot = true; const orig = window.autoStep; window.__key = null; window.__t0 = 0; window.__wrongFirst = false;
      window.autoStep = () => {
        const first = document.querySelector('.stage .pic-card, .stage .judge');
        if (first) {
          if (window.__key !== first) { window.__key = first; window.__t0 = performance.now(); return; }
          if (performance.now() - window.__t0 < 900) return;
          if (window.__wrongFirst && first.classList.contains('pic-card')) { window.__wrongFirst = false; const bad = document.querySelector('.stage .pic-card:not([data-ok])'); if (bad) { tapEl(bad); return; } }
        }
        orig();
      }; }"""
    page.evaluate(SLOWBOT)

    def run(js, step, arg=None, secs=60):
        page.evaluate(STAGE, step)
        page.evaluate("window.__res = undefined")
        page.evaluate(js, arg)
        page.evaluate("startAuto(400)")
        for _ in range(secs * 4):
            if page.evaluate("window.__res !== undefined"):
                break
            # What the child sees must never mention time or speed.
            page.wait_for_timeout(250)
        page.evaluate("stopAuto()")
        return page.evaluate("window.__res")

    seen_text = []
    # Hop blending: the bot answers right first time.
    page.evaluate("window.__ww.store.state().flu = { wk: {}, w: {} }")
    res = run("() => window.__ww.games.hop(window.__G, window.__pool[0], false).then(r => (window.__res = r)) && 0", "hop")
    n = page.evaluate(COUNT)
    check(res and res["right"] == 1 and n["words"] == 1 and "sun" in n["kept"], f"hop blending: a word read right first time is saved ({n})")
    check(page.evaluate("window.__gems") == 2 and res["total"] == 1, f"…and the gems are unchanged (2 for a first-time answer; got {page.evaluate('window.__gems')})")
    txt = page.evaluate("document.body.innerText.toLowerCase()")
    check(not any(x in txt for x in ["second", "speed", "slow", "faster", "timer", " s "]) and page.locator(".timer-bar, .timer, .stopwatch").count() == 0, "the child sees no timer and no speed message")
    # A wrong answer first: not saved.
    page.evaluate(STAGE, "hop")
    page.evaluate("window.__res = undefined; window.__wrongFirst = true")
    page.evaluate("() => window.__ww.games.hop(window.__G, window.__pool[1], false).then(r => (window.__res = r)) && 0")
    page.evaluate("startAuto(400)")
    for _ in range(120):
        if page.evaluate("window.__res !== undefined"): break
        page.wait_for_timeout(500)
    page.evaluate("stopAuto()")
    n2 = page.evaluate(COUNT)
    res2 = page.evaluate("window.__res")
    check(res2 and res2["right"] == 0 and n2["words"] == n["words"], f"a word that needed a second try is not saved ({n2['words']} words; right={res2 and res2['right']})")
    # Speed Read: lesson version saves, the timed arcade game does not.
    res = run("() => window.__ww.games.speedRead(window.__G, window.__pool.slice(0, 3)).then(r => (window.__res = r)) && 0", "speed")
    n3 = page.evaluate(COUNT)
    check(res and res["right"] == 3 and n3["words"] - n2["words"] == 3, f"Speed Read (in a lesson): 3 words read right first time are saved ({n3['words'] - n2['words']})")
    res = run("() => window.__ww.games.speedRead(window.__G, window.__pool, { seconds: 6 }).then(r => (window.__res = r)) && 0", "speed", secs=20)
    n4 = page.evaluate(COUNT)
    check(res and res["right"] >= 1 and n4["words"] == n3["words"], f"the timed arcade game, where the child hurries, is not saved ({res['right']} right, saved {n4['words'] - n3['words']})")
    # Memory Match: a word card turned first, then its picture.
    res = run("() => window.__ww.games.memory(window.__G, window.__pool.slice(0, 3)).then(r => (window.__res = r)) && 0", "memory")
    n5 = page.evaluate(COUNT)
    added = n5["words"] - n4["words"]
    check(res is not None and 0 <= added <= 3, f"Memory Match: only pairs found by turning the word first are saved ({added} of 3 pairs)")
    # drive memory by hand: word first then its picture, vs picture first then its word, vs a miss
    page.evaluate(STAGE, "memory")
    page.evaluate("window.__res = undefined; window.__ww.games.memory(window.__G, window.__pool.slice(0, 3)).then(r => (window.__res = r)) && 0")
    page.wait_for_timeout(600)
    base = page.evaluate(COUNT)["words"]
    page.evaluate("""async () => { const sleep = ms => new Promise(r => setTimeout(r, ms));
      const cards = [...document.querySelectorAll('.mem-card')];
      const info = c => ({ w: c.querySelector('.mem-face.word') ? c.querySelector('.mem-face').textContent : null, p: c.querySelector('.emoji') ? c.querySelector('.emoji').textContent : null });
      const word = w => cards.find(c => info(c).w === w), pic = e => cards.find(c => info(c).p === e);
      await sleep(700);
      tapEl(word('sun')); await sleep(800); tapEl(pic('☀️')); await sleep(900);   // word first, then its picture: saved
      tapEl(pic('🐷')); await sleep(800); tapEl(word('pig')); await sleep(900);   // picture first: not saved
      tapEl(word('cat')); await sleep(800); tapEl(pic('🐷')); await sleep(1400);   // a miss: not saved
    }""")
    got = page.evaluate(COUNT)["words"] - base
    check(got == 1, f"Memory Match by hand: word-first match saved, picture-first and a miss not saved ({got} saved)")
    page.evaluate("window.__ww.store.state().flu = { wk: {}, w: {} }")
    # Silly or Sensible: sentence read, right answer saved per word; wrong not saved.
    page.evaluate("window.__SILLY = { id: 'x_L5_0', t: 'The cat sat on a mat.', pic: '🐱', silly: false }")
    res = run("() => window.__ww.games.sillyOrNot(window.__G, window.__SILLY).then(r => (window.__res = r)) && 0", "silly")
    n6 = page.evaluate(COUNT)
    check(res and res["right"] == 1 and n6["sentenceWords"] == 6, f"Silly or Sensible: a right answer saves the sentence's 6 words ({n6['sentenceWords']})")
    page.evaluate(STAGE, "silly")
    page.evaluate("window.__res = undefined; window.__ww.games.sillyOrNot(window.__G, window.__SILLY).then(r => (window.__res = r)) && 0")
    page.wait_for_timeout(500)
    page.evaluate("tapEl(document.querySelector('.judge.silly'))")
    page.wait_for_function("window.__res !== undefined", timeout=8000)
    n7 = page.evaluate(COUNT)
    check(n7["sentenceWords"] == n6["sentenceWords"], f"a wrong answer is not saved ({n7['sentenceWords']})")
    # It is all invisible in the finished lesson too: a real lesson's stars are what they were.
    check(not errors, f"activities: no page errors {errors[:3] or ''}")
    b.close()

    # ------------------------------------------------------------------ the grown-ups corner
    for tag, dev in [("iphone-se", "iPhone SE (3rd gen)"), ("ipad", "iPad (gen 7)")]:
        b = p.webkit.launch()
        ctx = b.new_context(**p.devices[dev])
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.route("**/*.supabase.co/**", lambda route: route.abort())
        page.goto(URL)
        page.evaluate(FRESH)
        page.reload()
        page.wait_for_timeout(500)
        page.evaluate("window.__ww.parentScreen()")
        page.wait_for_selector(".pcard")
        t = page.locator(".pcard", has_text="Reading speed").inner_text()
        check("Not enough yet" in t, f"{tag}: with no data it says so plainly: {t[:80]!r}")
        # one week
        page.evaluate("""() => { const s = window.__ww.store, d = Date.now(); const wk = (n) => s.weekKey(d - n * 7 * 86400000);
          const m = { flu: { wk: {}, w: {} } }; m.flu.wk[wk(0)] = { a: [20, 100, 40, 80] }; s.merge(m); }""")
        page.evaluate("window.__ww.parentScreen()")
        t = page.locator(".pcard", has_text="Reading speed").inner_text()
        check("about 5 seconds so far" in t, f"{tag}: one week gives the level without a trend: {t[:90]!r}")
        # a falling trend, 5 weeks, and slow words
        page.evaluate("""() => { const s = window.__ww.store, d = Date.now(); const wk = (n) => s.weekKey(d - n * 7 * 86400000);
          s.state().flu = { wk: {}, w: {} };
          const m = { flu: { wk: {}, w: {} } };
          [[4, 7.4], [3, 6], [2, 5.2], [1, 4.4], [0, 3.6]].forEach(([n, v]) => { m.flu.wk[wk(n)] = { a: [20, 20 * v, 30, 30 * (v / 2)] }; });
          ['thump', 'crunch', 'strap', 'frog'].forEach((w, i) => { m.flu.w[w] = [12 - i * 2, 4 + i, Math.floor(d / 86400000)]; });
          m.flu.w.once = [30, 1, Math.floor(d / 86400000)];   // read only once: not listed
          s.merge(m); }""")
        page.evaluate("window.__ww.parentScreen()")
        card = page.locator(".pcard", has_text="Reading speed")
        t = card.inner_text()
        check("Reads a word in about 4 seconds, down from 7" in t, f"{tag}: the plain trend reads 'about 4 seconds, down from 7': {t[:100]!r}")
        check("a word" in t and "In sentences" in t, f"{tag}: sentences have their own line")
        slow = page.locator(".p-slow .chip").all_inner_texts()
        check(slow[:2] == ["thump · 12 s", "crunch · 10 s"] and not any("once" in x for x in slow), f"{tag}: slowest words are listed slowest first, and one-off reads are left out {slow}")
        check(page.locator(".flu-bars i").count() == 5, f"{tag}: one small bar for each week ({page.locator('.flu-bars i').count()})")
        card.scroll_into_view_if_needed()
        page.screenshot(path=str(SHOTS / f"{tag}-parent.png"), full_page=True)
        check(page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"{tag}: the grown-ups corner does not scroll sideways")
        check(not errors, f"{tag}: no page errors {errors[:3] or ''}")
        b.close()

server.terminate()
print("FAILURES:\n" + "\n".join(fails) if fails else "ALL OK")
sys.exit(1 if fails else 0)
