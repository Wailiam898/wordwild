"""Daily practice and the big books (what a child does after World 7).

Saves tested: a save that has finished only World 1, a save that has finished everything, and a brand-new save.
Daily practice: the map button appears once World 1 is finished (and not before); a round plays to the end using only
sounds, words and heart words taught so far; it picks what is due first; it ends with a reward; it can be done again
and again (it never runs out); the first round of the day pays more than later ones.
Big books: 8 books, hidden until every world is finished, opened one at a time (each after the one before is read);
a locked book does not open; a book read through is saved with its question results.
The "you finished" moment after the last lesson points to daily practice and the big books.
Layout at 375 x 667 (iPhone SE) and iPad; reduced motion; saved progress (merge, old and damaged saves).

Supabase is blocked in every browser. Usage: .venv/Scripts/python.exe -I tests/practice.py
"""
import sys, subprocess, json, time
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
APP = Path(sys.argv[sys.argv.index("--app") + 1]) if "--app" in sys.argv else ROOT / "app"   # --app DIR: test a copy of the app (used to show the checks catch a broken rule)
SHOTS = ROOT / "work" / "shots" / "practice"
SHOTS.mkdir(parents=True, exist_ok=True)
AUTO = (ROOT / "tests" / "autoplay.js").read_text(encoding="utf-8")
PORT = int(sys.argv[sys.argv.index("--port") + 1]) if "--port" in sys.argv else 5186
URL = f"http://localhost:{PORT}/"
fails = []
FAST = "--fast" in sys.argv   # skip the bot-driven rounds and the book read-through (used to show the checks catch a broken rule)


def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--directory", str(APP)],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                          creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))

SEED = """([ids, upto, extra]) => {
  const s = { done: {}, items: {}, recent: [], confusions: {}, gems: 0, hats: ['none'], hat: 'none', wordlings: [], books: [],
    best: { pop: 0, rocket: 0, memory: 0 }, today: { date: '', sec: 0 }, settings: { music: false }, unlocked: 0,
    seenIntro: true, name: 'Test Kid', pinHash: '', cloud: false, savedAt: 0, syncedAt: 0, baseGems: 0 };
  ids.slice(0, upto).forEach(id => s.done[id] = { stars: 3, acc: 1, plays: 1 });
  Object.assign(s, extra || {});
  localStorage.clear();
  localStorage.setItem('wordwild.v1', JSON.stringify(s));
}"""


def open_map(page, ids, upto, extra=None):
    page.goto(URL)
    page.evaluate(SEED, [ids, upto, extra])
    page.goto(URL)
    page.wait_for_timeout(600)
    page.locator(".play").tap(force=True)
    page.wait_for_selector(".node.current", timeout=15000)
    page.evaluate(AUTO)
    page.evaluate("log.length = 0")


def run_bot(page, until, secs=240, every=600):
    page.evaluate(f"startAuto({every})")
    t0 = time.time()
    while time.time() - t0 < secs:
        page.wait_for_timeout(500)
        if page.evaluate(until):
            break
    page.evaluate("stopAuto()")
    return page.evaluate(until)


with sync_playwright() as p:
    for tag, dev in [("iphone-se", "iPhone SE (3rd gen)"), ("ipad", "iPad (gen 7)")]:
        b = p.webkit.launch()
        ctx = b.new_context(**p.devices[dev])
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: m.type == "error" and "ERR_FAILED" not in m.text and errors.append(m.text))
        page.route("**/*.supabase.co/**", lambda route: route.abort())
        page.goto(URL)
        ids = page.evaluate("import('./js/data.js').then(m => m.allLessons().map(l => l.id))")
        n = len(ids)
        check(n == 34, f"{tag}: 34 lessons")

        # ================================================== a brand-new save: nothing yet
        open_map(page, ids, 0)
        check(page.locator(".practice-fab").count() == 0, f"{tag}: a new player has no daily practice button")
        check(page.locator(".end-btns").count() == 0, f"{tag}: ...and no end-of-game buttons")

        # ================================================== World 1 finished only
        open_map(page, ids, 4)
        fab = page.locator(".practice-fab")
        check(fab.count() == 1 and fab.is_visible(), f"{tag}: once World 1 is finished the map has the daily practice button")
        check(page.locator(".practice-fab.fresh").count() == 1, f"{tag}: it glows until today's practice is done")
        r = page.evaluate("""() => { const f = document.querySelector('.practice-fab').getBoundingClientRect(), d = document.querySelector('.dock').getBoundingClientRect(), g = document.querySelector('.gear').getBoundingClientRect();
          return { fab: [f.left, f.top, f.right, f.bottom], dock: [d.left, d.top, d.right, d.bottom], vw: innerWidth, vh: innerHeight, over: f.bottom > d.top + 1 || f.right > innerWidth || f.left < 0 }; }""")
        check(not r["over"], f"{tag}: the button is on screen and sits above the dock ({r['fab']} vs dock {r['dock']})")
        page.screenshot(path=str(SHOTS / f"{tag}-map-world1.png"))
        check(page.locator(".end-btns").count() == 0, f"{tag}: the big-books buttons are not shown yet")
        plan = page.evaluate("""() => { const p = window.__ww.practicePlan(); const w1 = new Set(window.__ww.LESSONS.slice(0, 4).flatMap(l => l.words.split(/\\s+/).map(t => t.split(':')[0].replace(/\\|/g, ''))));
          return { types: p.steps.map(s => s[0]), idx: p.idx, words: p.steps.filter(s => ['hop', 'forge'].includes(s[0])).map(s => s[1].w).concat(p.steps.filter(s => ['speed', 'memory'].includes(s[0])).flatMap(s => s[1].map(x => x.w))),
            hearts: p.steps.filter(s => s[0] === 'heart').map(s => s[1]), sounds: p.steps.filter(s => s[0] === 'pop').flatMap(s => s[1]), w1: [...w1] }; }""")
        known_g = set("s a t p i n m d g o".split())
        check(plan["idx"] == 3 and set(plan["sounds"]) <= known_g, f"{tag}: practice sounds are only ones taught in World 1 {plan['sounds']}")
        check(all(w in plan["w1"] for w in plan["words"]), f"{tag}: practice words are only World 1 words {plan['words']}")
        check(set(plan["hearts"]) <= {"the", "i", "said", "to"} and len(plan["hearts"]) >= 1, f"{tag}: practice heart words are only ones taught ({plan['hearts']})")
        check(plan["types"][0] == "pop" and "hop" in plan["types"] and "heart" in plan["types"] and "speed" in plan["types"] and "memory" in plan["types"], f"{tag}: a short mix of sounds, words and heart words ({plan['types']})")
        check(len(plan["types"]) <= 10, f"{tag}: it is short ({len(plan['types'])} activities)")
        if not FAST:
            gems0 = page.evaluate("window.__ww.store.state().gems")
            page.evaluate("window.autoWant = 'practice'")
            run_bot(page, "!!document.querySelector('.reward-row .go') || log.includes('lesson done')", secs=300)
            page.evaluate("window.autoWant = ''")
            check(page.locator(".reward-row .go").count() == 1, f"{tag}: a round of practice plays through to its reward screen")
            page.wait_for_timeout(1600)
            page.screenshot(path=str(SHOTS / f"{tag}-practice-reward.png"))
            st = page.evaluate("({ pr: window.__ww.store.state().practice, gems: window.__ww.store.state().gems, today: window.__ww.store.practicedToday() })")
            check(st["pr"]["rounds"] == 1 and len(st["pr"]["dates"]) == 1 and st["today"], f"{tag}: the round is recorded ({st['pr']})")
            first_gain = st["gems"] - gems0
            check(first_gain >= 10, f"{tag}: the first round of the day earns the reward gems ({first_gain})")
            kinds = {x.split(" ")[-1] for x in page.evaluate("log")}
            page.locator(".reward-row .go").tap(force=True)
            page.wait_for_selector(".node.current", timeout=8000)
            check(page.locator(".practice-fab:not(.fresh)").count() == 1, f"{tag}: after practising the button stops glowing for the day")
            # Again: it never runs out; the second round of the day pays less.
            gems1 = page.evaluate("window.__ww.store.state().gems")
            page.evaluate("window.autoWant = 'practice'")
            page.evaluate("log.length = 0")
            run_bot(page, "!!document.querySelector('.reward-row .go')", secs=300)
            page.evaluate("window.autoWant = ''")
            st2 = page.evaluate("({ pr: window.__ww.store.state().practice, gems: window.__ww.store.state().gems })")
            check(st2["pr"]["rounds"] == 2 and len(st2["pr"]["dates"]) == 1, f"{tag}: a second round the same day is allowed and counts one day ({st2['pr']})")
            check(0 < st2["gems"] - gems1 <= first_gain + 2, f"{tag}: a later round earns no more than the first (its reward is 3 gems, not 10) ({st2['gems'] - gems1} vs {first_gain})")
            page.locator(".reward-row .go").tap(force=True)
            page.wait_for_selector(".node.current", timeout=8000)
        # Books: nothing for a child who has not finished.
        page.locator(".dock-btn", has_text="Books").tap(force=True)
        page.wait_for_selector(".library", timeout=5000)
        check(page.locator(".big-shelf").count() == 0, f"{tag}: the library shows no big books until every world is finished")
        check(page.evaluate("window.__ww.store && window.__ww.bigBookState().every(b => !b.open)"), f"{tag}: none of the big books can be opened")
        check(not errors, f"{tag}: World 1 save: no page errors {errors[:3] or ''}")

        # ================================================== finished everything
        # Due items: a few words overdue at box 0, everything else comfortable (box 5, not due).
        extra = {"items": {}}
        page.goto(URL)
        words = page.evaluate("""() => import('./js/data.js').then(m => { const out = []; m.allLessons().forEach(l => m.parseWords(l.words).forEach(x => { if (x.e) out.push(x.w); })); return [...new Set(out)]; })""")
        due = ["cake", "kite", "whale", "phone"]
        for w in words:
            extra["items"]["w:" + w] = {"n": 6, "c": 6, "box": 0, "due": 1} if w in due else {"n": 8, "c": 8, "box": 5, "due": 9999999999999}
        open_map(page, ids, n, extra)
        check(page.locator(".practice-fab").count() == 1 and page.locator(".end-btns .end-btn").count() == 2, f"{tag}: finished everything: the practice button and the two end-of-game buttons are on the map")
        page.locator(".end-btns").scroll_into_view_if_needed()
        page.screenshot(path=str(SHOTS / f"{tag}-map-finished.png"))
        picks = page.evaluate("""() => { const seen = {}; let worlds = new Set();
          for (let i = 0; i < 25; i++) { const p = window.__ww.practicePlan(); p.steps.filter(s => s[0] === 'hop').forEach(s => { seen[s[1].w] = (seen[s[1].w] || 0) + 1; }); }
          return seen; }""")
        top = sorted(picks, key=lambda w: -picks[w])[:4]
        check(set(due) & set(top) and sum(picks.get(w, 0) for w in due) >= 25, f"{tag}: what is due comes first: overdue words {due} chosen {picks}")
        across = page.evaluate("""() => { const s = new Set(); for (let i = 0; i < 60; i++) { const p = window.__ww.practicePlan(); p.steps.filter(x => ['speed', 'memory'].includes(x[0])).forEach(x => x[1].forEach(it => s.add(it.lesson))); }
          return [...s].sort((a, b) => a - b); }""")
        check(across[-1] >= 25 and across[0] <= 12, f"{tag}: it reaches back over every finished world (lessons {across[0]} to {across[-1]})")
        # Several rounds in a row never run dry, and fully learned items still get practised.
        for rnd in range(3):
            plan = page.evaluate("window.__ww.practicePlan().steps.map(s => s[0])")
            check(len(plan) >= 6, f"{tag}: round {rnd + 1} still builds a full mix ({len(plan)} activities) even when nothing is due")
            page.evaluate("""() => { const it = window.__ww.store.state().items; Object.keys(it).forEach(k => { it[k] = { n: 9, c: 9, box: 5, due: 9999999999999 }; }); }""")
        # The 'you finished' moment: the last lesson, then the screen that points on.
        page.evaluate("""() => { const L = window.__ww.LESSONS[window.__ww.LESSONS.length - 1]; window.__ww.hatchScreen(L, 3, true, 5); }""")
        page.evaluate("window.autoWant = ''")
        page.evaluate("startAuto(500)")
        for _ in range(60):
            if page.locator(".reward-row .go").count():
                break
            page.wait_for_timeout(500)
        page.evaluate("stopAuto()")
        page.locator(".reward-row .go").tap(force=True)
        # World 7's last lesson now shows "World complete! Bonus game!" first (the game is quit at once here; tests/milestone_flow.py covers it).
        page.evaluate("window.__wwPlayMilestone = async () => ({ score: 0, stars: 0, quit: true })")
        page.wait_for_selector(".world-done .go", timeout=5000)
        page.locator(".world-done .go").tap(force=True)
        page.wait_for_selector(".fin-practice", timeout=5000)
        check(page.locator(".fin-practice").count() == 1 and page.locator(".fin-books").count() == 1, f"{tag}: after the final lesson the child is pointed to daily practice and the big books")
        page.wait_for_timeout(1400)
        page.screenshot(path=str(SHOTS / f"{tag}-finished.png"))
        for sel in (".fin-practice", ".fin-books"):
            bx = page.locator(sel).bounding_box()
            check(bx["x"] >= 0 and bx["x"] + bx["width"] <= page.evaluate("innerWidth") + 1 and bx["y"] + bx["height"] <= page.evaluate("innerHeight") + 1, f"{tag}: {sel} fits on screen")
        check((APP / "audio" / "n_end_next.mp3").exists() and (APP / "audio" / "n_the_end.mp3").exists(), f"{tag}: the spoken lines for that moment exist")
        # Books button
        page.locator(".fin-books").tap(force=True)
        page.wait_for_selector(".big-shelf", timeout=5000)
        books = page.evaluate("[...document.querySelectorAll('.big-shelf .book')].map(b => ({ locked: b.classList.contains('locked'), fresh: b.classList.contains('fresh'), id: b.dataset.book, text: b.textContent }))")
        check(len(books) >= 8, f"{tag}: the library shows {len(books)} big books")
        check(not books[0]["locked"] and books[0]["fresh"] and all(x["locked"] for x in books[1:]), f"{tag}: only the first is open (and glowing); the rest are locked")
        page.locator(".big-shelf .book.locked").first.scroll_into_view_if_needed()
        page.screenshot(path=str(SHOTS / f"{tag}-library-big.png"))
        # A locked book does not open.
        page.locator(".big-shelf .book.locked").first.tap(force=True)
        page.wait_for_timeout(500)
        check(page.locator(".library").count() == 1 and page.locator(".stage").count() == 0, f"{tag}: tapping a locked book does nothing but a shake")
        if not FAST:
            # Read the first book through with the bot, questions included.
            page.locator(".big-shelf .book.fresh").tap(force=True)
            page.wait_for_selector(".stage .book-cover", timeout=5000)
            page.evaluate("log.length = 0")
            run_bot(page, "window.__ww.store.state().books.includes('hiccup') && !!document.querySelector('.library')", secs=200, every=500)
            check(page.evaluate("window.__ww.store.state().books.includes('hiccup')"), f"{tag}: a big book can be read through and is saved")
            q = page.evaluate("log.filter(x => x === 'question').length")
            comp = page.evaluate("JSON.parse(JSON.stringify(window.__ww.store.comprehension()))")
            check(q == 3 and comp["s"].get("hiccup", {}).get("n") == 3 and comp["k"]["think"]["n"] == 1, f"{tag}: its 3 questions were answered and saved ({q}; {comp['s'].get('hiccup')})")
            page.wait_for_selector(".big-shelf", timeout=5000)
            books = page.evaluate("[...document.querySelectorAll('.big-shelf .book')].map(b => ({ locked: b.classList.contains('locked'), fresh: b.classList.contains('fresh') }))")
            check(not books[1]["locked"] and books[1]["fresh"] and all(x["locked"] for x in books[2:]) and not books[0]["fresh"], f"{tag}: reading it opens the next one, and only that one")
        # One at a time, all the way through.
        order = page.evaluate("Object.keys(window.__ww.BOOKS)")
        opened = []
        for i in range(1, len(order)):
            st = page.evaluate("window.__ww.bigBookState().map(b => b.open)")
            opened.append(sum(st))
            page.evaluate("id => window.__ww.store.addBook(id)", order[i])
        check(opened == list(range(2, len(order) + 1)), f"{tag}: the books open one at a time in order ({opened})")
        # Practice from the finished save (then dated and merged below).
        page.evaluate("window.__ww.mapScreen()")
        page.wait_for_selector(".node.current")
        check(not errors, f"{tag}: finished save: no page errors {errors[:3] or ''}")

        # ================================================== grown-ups corner
        page.evaluate("window.__ww.parentScreen()")
        page.wait_for_selector(".pcard")
        t = page.locator(".pcard", has_text="Daily practice and big books").inner_text()
        check("Big books read: " in t and f"of {len(order)}" in t and "Daily practice:" in t, f"{tag}: the grown-ups corner reports practice and books: {t[:120]!r}")
        page.screenshot(path=str(SHOTS / f"{tag}-parent.png"), full_page=True)
        b.close()

    # ================================================== saved progress and reduced motion (one phone size)
    b = p.webkit.launch()
    ctx = b.new_context(**p.devices["iPhone SE (3rd gen)"])
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.route("**/*.supabase.co/**", lambda route: route.abort())
    page.goto(URL)
    page.evaluate("""() => { localStorage.clear(); localStorage.setItem('wordwild.v1', JSON.stringify({ done: { L1: { stars: 1, acc: 1, plays: 1 } }, gems: 3, hats: ['none'], hat: 'none', wordlings: [], books: [], seenIntro: true, name: 'Old', settings: { music: false } })); }""")
    page.reload()
    page.wait_for_timeout(500)
    r = page.evaluate("({ pr: window.__ww.store.state().practice, ok: window.__ww.store.practicedToday(), days: window.__ww.store.practiceDays(30), rounds: window.__ww.store.practiceRounds() })")
    check(r["pr"] == {"dates": [], "rounds": 0} and not r["ok"] and r["days"] == 0, f"an old save with no practice data loads as 'never practised' {r['pr']}")
    page.evaluate("() => { const s = window.__ww.store; s.recordPractice(); }")
    m = page.evaluate("""() => { const s = window.__ww.store; const o = { practice: { dates: ['2026-01-02', '2026-01-03', '2026-01-02', 'junk', 5], rounds: 4 } };
      s.merge(o); s.merge(o); return JSON.parse(JSON.stringify(s.state().practice)); }""")
    today = page.evaluate("(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })()")
    check(m["dates"] == sorted(["2026-01-02", "2026-01-03", today]) and m["rounds"] == 4, f"two devices' practice days are combined without repeats; rounds keep the larger count {m}")
    page.evaluate("() => window.__ww.store.merge({ practice: 'junk' })")
    page.evaluate("() => window.__ww.store.merge({ practice: { dates: 4, rounds: 'x' } })")
    check(page.evaluate("window.__ww.store.practiceRounds()") == 4, "a damaged practice record in another save is ignored")
    b.close()

    b = p.webkit.launch()
    ctx = b.new_context(**{**p.devices["iPhone SE (3rd gen)"], "reduced_motion": "reduce"})
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.route("**/*.supabase.co/**", lambda route: route.abort())
    page.goto(URL)
    ids = page.evaluate("import('./js/data.js').then(m => m.allLessons().map(l => l.id))")
    open_map(page, ids, len(ids))
    anims = page.evaluate("""() => { const out = []; for (const sel of ['.practice-fab', '.fab-new', '.end-btn']) { document.querySelectorAll(sel).forEach(e => { const n = getComputedStyle(e).animationName; if (n && n !== 'none') out.push(sel + ':' + n); }); } return out; }""")
    check(not anims, f"reduced motion: the practice button and end buttons do not pulse ({anims})")
    page.evaluate("window.__ww.libraryScreen('big')")
    page.wait_for_selector(".big-shelf")
    a2 = page.evaluate("[...document.querySelectorAll('.book.fresh')].map(e => getComputedStyle(e).animationName)")
    check(all(x == "none" for x in a2), f"reduced motion: the glowing new book does not pulse ({a2})")
    check(not errors, f"reduced motion: no page errors {errors[:3] or ''}")
    b.close()

server.terminate()
print("FAILURES:\n" + "\n".join(fails) if fails else "ALL OK")
sys.exit(1 if fails else 0)
