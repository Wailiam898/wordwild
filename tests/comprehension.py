"""Story questions: every story and big book asks 2 or 3 spoken questions with one right answer.

Data (all 34 stories and 8 big books): 2-3 questions each, one literal at least, a "thinking" one from
World 3 on, exactly one right answer, pictures or words (never mixed), every spoken question has its audio file,
and the speech for a story's questions is short (the questions take well under a minute).
Playing (WebKit, iPhone SE / iPhone / iPad): the child is asked each question, a wrong answer shakes and a right
one moves on; the results are saved by kind; re-reading does not count; old saves load; two devices merge without
double counting; the grown-ups corner shows "Understanding stories".
Layout: every page of every big book, and the question screens, fit a 375 x 667 phone without scrolling.

Supabase is blocked in every browser. Usage: .venv/Scripts/python.exe -I tests/comprehension.py
"""
import sys, subprocess, json
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
APP = Path(sys.argv[sys.argv.index("--app") + 1]) if "--app" in sys.argv else ROOT / "app"   # --app DIR: test a copy of the app (used to show the checks catch a broken rule)
SHOTS = ROOT / "work" / "shots" / "comprehension"
SHOTS.mkdir(parents=True, exist_ok=True)
AUTO = (ROOT / "tests" / "autoplay.js").read_text(encoding="utf-8")
PORT = int(sys.argv[sys.argv.index("--port") + 1]) if "--port" in sys.argv else 5284
URL = f"http://localhost:{PORT}/"
fails = []


def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--directory", str(APP)],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                          creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))

STAGE = """() => {
  const app = document.getElementById('app');
  app.className = 'screen-lesson theme-roost';
  app.innerHTML = '<div class="lesson"><div class="topbar"></div><div class="stage step-story"></div></div>';
  window.__gems = 0;
  window.__G = { stage: app.querySelector('.stage'), known: { g: new Set() }, newG: [], gem() { window.__gems++; }, setReplay() {}, hat: '', ra: { used: 2, max: 2 }, pool: [] };
  return true;
}"""
OLD_SAVE = """() => { localStorage.setItem('wordwild.v1', JSON.stringify({ done: { L1: { stars: 3, acc: 1, plays: 1 } }, items: {}, recent: [], trace: {}, confusions: {}, gems: 7,
  hats: ['none'], hat: 'none', wordlings: ['L1'], books: ['pip'], best: { pop: 0, rocket: 0, memory: 0 }, today: { date: '', sec: 0 }, settings: { music: false },
  unlocked: 0, seenIntro: true, name: 'Old Save', pinHash: '', cloud: false, savedAt: 1, syncedAt: 0, baseGems: 0 })); }"""
FRESH = """() => { localStorage.clear(); localStorage.setItem('wordwild.v1', JSON.stringify({ done: {}, items: {}, recent: [], confusions: {}, gems: 0, hats: ['none'], hat: 'none',
  wordlings: [], books: [], best: { pop: 0, rocket: 0, memory: 0 }, today: { date: '', sec: 0 }, settings: { music: false }, unlocked: 0, seenIntro: true, name: 'Test Kid',
  pinHash: '', cloud: false, savedAt: 0, syncedAt: 0, baseGems: 0 })); }"""

# Play a story from the cover to the end. wrong_first: a list of question numbers where a wrong answer is tapped first.
PLAY = """async ([sid, reread, wrongFirst]) => {
  window.__story = undefined; window.__asked = []; window.__lastQ = null;
  window.__ww.games.story(window.__G, sid, { reread }).then(r => (window.__story = r));
  const st = window.__G.stage, sleep = ms => new Promise(r => setTimeout(r, ms));
  let guard = 0, wrongDone = new Set();
  while (window.__story === undefined && guard++ < 600) {
    const qEl = st.querySelector('.big-ear');
    if (qEl) {
      const live = st.querySelector('[data-ok]:not(.locked):not(.right)');
      if (live) {
        const cards = [...st.querySelectorAll('.pic-card, .word-choice')];
        if (qEl !== window.__lastQ) {
          window.__lastQ = qEl;
          window.__asked.push({ cards: cards.length, ok: st.querySelectorAll('[data-ok]').length, words: st.querySelectorAll('.word-choice').length, text: cards.map(c => c.textContent) });
        }
        const idx = window.__asked.length - 1;
        if (wrongFirst.includes(idx) && !wrongDone.has(idx)) {
          wrongDone.add(idx);
          const bad = cards.find(c => !c.dataset.ok);
          tapEl(bad); await sleep(500); continue;
        }
        tapEl(live); await sleep(400); continue;
      }
    } else {
      // a story page: tap each word in order (the glowing one), then the next button opens
      const nw = st.querySelector('.story-text .sw.next');
      if (nw) tapEl(nw);
      else { const go = st.querySelector('.go:not([disabled])'); if (go) tapEl(go); }
    }
    await sleep(120);
  }
  return window.__asked;
}"""

with sync_playwright() as p:
    # ------------------------------------------------------------------ data
    b = p.webkit.launch()
    ctx = b.new_context(**p.devices["iPhone 13"])
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and "ERR_FAILED" not in m.text and errors.append(m.text))
    page.route("**/*.supabase.co/**", lambda route: route.abort())
    page.goto(URL)
    page.wait_for_timeout(500)
    info = page.evaluate("""async () => {
      const m = await import('./js/data.js');
      const lessons = m.allLessons();
      const out = [];
      const add = (id, st, wi, book) => out.push({ id, book, wi, qs: st.qs, ids: st.qs.map((_, i) => m.qid(id, i)) });
      lessons.forEach(l => { if (l.story) add(l.story, m.STORIES[l.story], l.wi, false); });
      Object.keys(m.BOOKS).forEach(k => add(k, m.BOOKS[k], 99, true));
      return out;
    }""")
    stories = [x for x in info if not x["book"]]
    books = [x for x in info if x["book"]]
    check(len(stories) == 34 and len(books) >= 8, f"34 lesson stories and {len(books)} big books are in the data")
    bad = []
    for x in info:
        qs = x["qs"]
        if not 2 <= len(qs) <= 3: bad.append(f"{x['id']}: {len(qs)} questions")
        if not any(q["k"] == "lit" for q in qs): bad.append(f"{x['id']}: no literal question")
        if (x["wi"] >= 2) and not any(q["k"] == "think" for q in qs): bad.append(f"{x['id']}: no thinking question")
        for q in qs:
            opts = q["opts"]
            if not (0 <= q["a"] < len(opts)) or len({o.lower() for o in opts}) != len(opts): bad.append(f"{x['id']}: bad answers {opts}")
            kinds = {any(ch.isascii() and ch.isalpha() for ch in o) for o in opts}
            if len(kinds) != 1: bad.append(f"{x['id']}: pictures and words mixed {opts}")
    check(not bad, f"every story and book: 2-3 questions, a literal one, a thinking one from World 3 on, one right answer ({bad[:3] or 'all fine'})")
    thinking = sum(1 for x in stories if x["wi"] >= 2 and any(q["k"] == "think" for q in x["qs"]))
    check(thinking == sum(1 for x in stories if x["wi"] >= 2), f"all {thinking} stories from World 3 on have a thinking question")
    missing = [i for x in info for i in x["ids"] if not (APP / "audio" / f"{i}.mp3").exists()]
    check(not missing, f"every spoken question has its audio file ({len(missing)} missing {missing[:4]})")
    # Speech for the questions of one story: file size / 56 kbit/s. The child's tapping adds a few seconds.
    longest = max((sum((APP / "audio" / f"{i}.mp3").stat().st_size for i in x["ids"] if (APP / "audio" / f"{i}.mp3").exists()) * 8 / 56000, x["id"]) for x in info)
    check(longest[0] < 20, f"the spoken questions of any story take under 20 seconds in all (longest: {longest[1]} {longest[0]:.1f}s), so questions stay well under a minute")
    wordopts = {w for x in info for q in x["qs"] for o in q["opts"] if any(ch.isalpha() and ch.isascii() for ch in o) for w in o.lower().replace("'", "").split()}
    miss_w = [w for w in wordopts if not (APP / "audio" / f"w_{w}.mp3").exists()]
    check(not miss_w, f"every answer word has its audio ({miss_w[:5] or len(wordopts)} words)")
    b.close()

    # ------------------------------------------------------------------ play, three sizes
    for tag, dev in [("iphone-se", "iPhone SE (3rd gen)"), ("iphone", "iPhone 13"), ("ipad", "iPad (gen 7)")]:
        b = p.webkit.launch()
        ctx = b.new_context(**p.devices[dev])
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: m.type == "error" and "ERR_FAILED" not in m.text and errors.append(m.text))
        page.route("**/*.supabase.co/**", lambda route: route.abort())
        page.goto(URL)
        page.wait_for_timeout(500)
        page.evaluate(AUTO)
        page.evaluate(FRESH)
        page.reload()
        page.wait_for_timeout(500)
        page.evaluate(AUTO)
        page.evaluate(STAGE)

        # van: 3 questions (who: pictures, who: words, how did it feel); wrong answer first on question 1 only.
        asked = page.evaluate(PLAY, ["van", False, [0]])
        check(len(asked) == 3, f"{tag}: 'The Vet Van' asks its 3 questions ({len(asked)})")
        check(all(q["ok"] == 1 for q in asked), f"{tag}: each question has exactly one right answer on screen")
        check([q["cards"] for q in asked] == [3, 3, 3], f"{tag}: three answers each ({[q['cards'] for q in asked]})")
        check(asked[1]["words"] == 3 and asked[0]["words"] == 0, f"{tag}: question 2 has word answers {asked[1]['text']}, question 1 has pictures")
        res = page.evaluate("window.__story")
        check(abs(res["right"] - 2 / 3) < 0.01 and res["total"] == 1, f"{tag}: the lesson sees one answer worth 2/3 (right {res['right']:.2f}, total {res['total']})")
        comp = page.evaluate("JSON.parse(JSON.stringify(window.__ww.store.comprehension()))")
        # van = [lit (wrong first), lit, think]
        check(comp["k"]["lit"] == {"n": 2, "c": 1} and comp["k"]["think"] == {"n": 1, "c": 1}, f"{tag}: saved by kind: literal 1 of 2, thinking 1 of 1 ({comp['k']})")
        check(comp["s"]["van"] == {"n": 3, "c": 2}, f"{tag}: saved for the story ({comp['s'].get('van')})")
        check("van" in page.evaluate("window.__ww.store.state().books"), f"{tag}: the book is in the library")
        # Re-reading does not count again.
        page.evaluate(STAGE)
        page.evaluate(PLAY, ["van", True, []])
        comp2 = page.evaluate("JSON.parse(JSON.stringify(window.__ww.store.comprehension()))")
        check(comp2["k"] == comp["k"] and comp2["s"] == comp["s"], f"{tag}: reading it again from the library does not change the results")
        # A wrong answer shakes and stays wrong, the right one is still there to find.
        page.evaluate(STAGE)
        page.evaluate("""() => { window.__story = undefined; window.__ww.games.story(window.__G, 'pip', {}).then(r => (window.__story = r)); }""")
        for _ in range(40):
            if page.locator(".stage .go").count(): break
            page.wait_for_timeout(100)
        for _ in range(300):  # the cover, then each page, until the first question
            if page.locator(".stage .big-ear").count(): break
            page.evaluate("() => { const w = document.querySelector('.stage .story-text .sw.next'); if (w) { tapEl(w); return; } const g = document.querySelector('.stage .go:not([disabled])'); if (g) tapEl(g); }")
            page.wait_for_timeout(150)
        page.wait_for_selector(".stage .big-ear", timeout=5000)
        page.screenshot(path=str(SHOTS / f"{tag}-question.png"))
        wrong = page.locator(".stage .pic-card:not([data-ok])").first
        page.evaluate("tapEl(document.querySelector('.stage .pic-card:not([data-ok])'))")
        page.wait_for_timeout(300)
        check(page.locator(".stage .pic-card.wrong").count() == 1, f"{tag}: a wrong picture is marked and the others stay")
        check(page.locator(".stage .pic-card[data-ok]:not(.locked)").count() == 1, f"{tag}: the right picture can still be tapped")
        page.evaluate("tapEl(document.querySelector('.stage .pic-card[data-ok]'))")
        for _ in range(60):   # the second question: answer it and finish
            if page.evaluate("window.__story !== undefined"): break
            page.evaluate("() => { const o = document.querySelector('.stage [data-ok]:not(.locked):not(.right)'); if (o) tapEl(o); }")
            page.wait_for_timeout(250)
        check(page.evaluate("window.__story !== undefined"), f"{tag}: the story ends after its last question")
        errs = [e for e in errors]
        check(not errs, f"{tag}: no page errors {errs[:3] or ''}")
        b.close()

    # ------------------------------------------------------------------ saved progress: old saves, two devices
    b = p.webkit.launch()
    ctx = b.new_context(**p.devices["iPhone 13"])
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.route("**/*.supabase.co/**", lambda route: route.abort())
    page.goto(URL)
    page.evaluate(OLD_SAVE)
    page.reload()
    page.wait_for_timeout(600)
    r = page.evaluate("""() => { const s = window.__ww.store; const c = s.comprehension();
      return { lit: c.k.lit, think: c.k.think, stories: Object.keys(c.s).length, done: Object.keys(s.state().done) }; }""")
    check(r["lit"] == {"n": 0, "c": 0} and r["think"] == {"n": 0, "c": 0} and r["done"] == ["L1"], f"an old save (no question results) loads cleanly and keeps its progress {r}")
    page.evaluate("""() => { const s = window.__ww.store; s.recordComprehension('pip', 'lit', true); s.recordComprehension('pip', 'lit', false); s.recordComprehension('van', 'think', true); }""")
    other = {"comp": {"k": {"lit": {"n": 5, "c": 4}, "think": {"n": 1, "c": 0}}, "s": {"pip": {"n": 5, "c": 4}, "dig": {"n": 2, "c": 1}}}}
    m = page.evaluate("""(o) => { const s = window.__ww.store; s.merge(o); s.merge(o); s.merge(o); return JSON.parse(JSON.stringify(s.comprehension())); }""", other)
    check(m["k"]["lit"] == {"n": 5, "c": 4} and m["k"]["think"] == {"n": 1, "c": 1}, f"merging another device keeps the larger count of each, and merging again changes nothing {m['k']}")
    check(m["s"]["pip"] == {"n": 5, "c": 4} and m["s"]["dig"] == {"n": 2, "c": 1} and m["s"]["van"] == {"n": 1, "c": 1}, f"…per story too {m['s']}")
    page.evaluate("() => window.__ww.store.merge({ comp: 'junk', flu: 5, practice: [] })")
    check(page.evaluate("window.__ww.store.comprehension().k.lit.n") == 5, "merging a damaged save does not break anything")
    # Grown-ups corner.
    page.evaluate("window.__ww.parentScreen()")
    page.wait_for_selector(".pcard")
    t = page.locator(".pcard", has_text="Understanding stories").inner_text()
    check("Understanding stories" in t and "of" in t and "right first time" in t, f"the grown-ups corner has an 'Understanding stories' line: {t[:90]!r}")
    page.screenshot(path=str(SHOTS / "parent.png"), full_page=True)
    check(not errors, f"parent corner: no page errors {errors[:3] or ''}")
    b.close()

    # ------------------------------------------------------------------ layout: every big-book page and question on a 375 x 667 phone
    b = p.webkit.launch()
    ctx = b.new_context(**p.devices["iPhone SE (3rd gen)"])
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.route("**/*.supabase.co/**", lambda route: route.abort())
    page.goto(URL)
    page.evaluate(AUTO)
    check(page.evaluate("innerWidth") == 375, f"layout test runs at 375 px wide ({page.evaluate('innerWidth')} x {page.evaluate('innerHeight')})")
    LAYOUT = """async (sid) => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      window.__story = undefined;
      window.__ww.games.story(window.__G, sid, { reread: true }).then(r => (window.__story = r));
      const st = window.__G.stage, bad = [];
      let pages = 0, qs = 0, guard = 0;
      while (window.__story === undefined && guard++ < 400) {
        const text = st.querySelector('.story-text'), q = st.querySelector('.big-ear');
        if (text) {
          await sleep(120);
          const r = text.getBoundingClientRect(), go = st.querySelector('.go').getBoundingClientRect();
          pages++;
          if (r.bottom > innerHeight - 4 || go.bottom > innerHeight - 2 || r.left < 0 || r.right > innerWidth || document.documentElement.scrollWidth > innerWidth)
            bad.push(`page ${pages}: text bottom ${Math.round(r.bottom)}, button bottom ${Math.round(go.bottom)} of ${innerHeight}`);
          for (let i = 0; i < 80 && st.querySelector('.go').disabled; i++) { const nw = st.querySelector('.story-text .sw.next'); if (nw) tapEl(nw); await sleep(60); }
          tapEl(st.querySelector('.go')); await sleep(250);
        } else if (q) {
          const live = st.querySelector('[data-ok]:not(.locked):not(.right)');
          if (live) {
            await sleep(120);
            const cards = [...st.querySelectorAll('.pic-card, .word-choice')];
            qs++;
            if (cards.some(c => { const r = c.getBoundingClientRect(); return r.bottom > innerHeight || r.right > innerWidth + 1 || r.left < -1; })) bad.push(`question ${qs} does not fit`);
            tapEl(live); await sleep(350);
          } else await sleep(100);
        } else { const go = st.querySelector('.go:not([disabled])'); if (go) tapEl(go); await sleep(150); }
      }
      return { pages, qs, bad };
    }"""
    page.evaluate(STAGE)
    page.evaluate("""() => { const a = document.getElementById('app'); a.querySelector('.topbar').innerHTML = '<div style="height:82px"></div>'; }""")
    allbad = []
    ids = [x["id"] for x in books] + ["quest", "puppy"]
    for sid in ids:
        r = page.evaluate(LAYOUT, sid)
        if r["bad"]: allbad += [f"{sid}: {x}" for x in r["bad"]]
        if sid == books[0]["id"]:
            check(r["pages"] >= 6 and r["qs"] == 3, f"{sid}: read {r['pages']} pages and answered {r['qs']} questions")
    check(not allbad, f"every page of the {len(books)} big books (and two lesson stories) and every question fits a 375 x 667 phone ({allbad[:3] or 'all fit'})")
    check(not errors, f"layout: no page errors {errors[:3] or ''}")
    b.close()

server.terminate()
print("FAILURES:\n" + "\n".join(fails) if fails else "ALL OK")
sys.exit(1 if fails else 0)
