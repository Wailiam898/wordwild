"""Books: the child must tap every word, in order, before a page can be turned.

WebKit (Safari engine), iPhone and iPad sizes:
  - on a page, the next button is disabled until every word is tapped in order; the next word glows; a tapped word
    stays highlighted; tapping out of order only says the word and does not count; the whole-sentence button waits
  - lesson stories (via the lesson bot), library re-reads and big books all behave the same on every page
  - the back button still leaves the book; there is no way to skip a page
  - no story or big book word is missing its audio clip (listed if any)
Chromium with a fake microphone:
  - with "Read it to Pip" on, the microphone is offered after each page's words are tapped, the child records, hears
    it back, Pip cheers, one gem and a sparkle are given, the count is saved; nothing is uploaded or stored; the
    microphone is let go of after each use
  - with it off, no microphone is asked for at all; if the microphone is refused the book works with no error
  - the sentence plays only after the last word (Chromium plays real audio)
Saved progress: the count of pages read aloud merges safely and shows in the grown-ups corner.

Usage: .venv/Scripts/python.exe -I tests/books.py
Every browser blocks *.supabase.co.
"""
import sys, subprocess, json
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "app"
AUTO = (ROOT / "tests" / "autoplay.js").read_text(encoding="utf-8")
SHOTS = ROOT / "work" / "shots" / "books"
SHOTS.mkdir(parents=True, exist_ok=True)
PORT = 5196
URL = f"http://127.0.0.1:{PORT}/"
fails = []
QUICK = '--quick' in sys.argv   # skip the long WebKit parts (re-run only the microphone checks)


def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1", "--directory", str(APP)],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                          creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))


def boot(page):
    page.route("**/*.supabase.co/**", lambda route: route.abort())
    page.goto(URL)
    page.wait_for_timeout(800)
    page.locator(".play").tap(force=True)
    page.wait_for_selector(".name-input", timeout=15000)
    page.fill(".name-input", "Test Kid")
    page.locator(".name-row .go").tap(force=True)
    page.wait_for_selector("[data-act=offline]", timeout=15000)
    page.locator("[data-act=offline]").click()
    page.wait_for_selector(".node.current", timeout=15000)
    page.wait_for_timeout(1500)


# Everything finished: the library has every story and the big books are open.
FINISH = """() => { const w = window.__ww, s = w.store.state();
  w.LESSONS.forEach(L => { s.done[L.id] = { stars: 3, acc: 1, plays: 1 }; });
  s.books = [...Object.keys(w.STORIES)]; w.store.save(); w.mapScreen(); }"""

# Watches every page: the next button must never be enabled while a word is still untapped.
WATCH = """() => {
  window.__w = { violations: 0, pages: new Set(), enabledAtLast: 0 };
  setInterval(() => {
    const t = document.querySelector('.story-text'), go = document.querySelector('.story .story-btns .btn.go');
    if (!t || !go) return;
    const key = document.querySelector('.page-dots') ? [...document.querySelectorAll('.page-dots i')].findIndex(i => i.classList.contains('on')) + ':' + t.textContent : '';
    window.__w.pages.add(key);
    const undone = t.querySelectorAll('.sw:not(.done)').length;
    if (!go.disabled && undone) window.__w.violations++;
  }, 15);
}"""

PAGE = """() => {
  const t = document.querySelector('.story-text'); if (!t) return null;
  const go = document.querySelector('.story .story-btns .btn.go');
  const sws = [...t.querySelectorAll('.sw')];
  return { n: sws.length, done: sws.filter(w => w.classList.contains('done')).length, next: sws.filter(w => w.classList.contains('next')).map(w => sws.indexOf(w)),
           goDisabled: !!(go && go.disabled), dot: [...document.querySelectorAll('.page-dots i')].findIndex(i => i.classList.contains('on')),
           words: sws.map(w => w.textContent), lettered: sws.map(w => /[a-z]/i.test(w.textContent)) };
}"""


def pg(page):
    return page.evaluate(PAGE)


def open_story(page, kind, idx=0):
    page.evaluate(FINISH)
    page.wait_for_selector(".node", timeout=5000)
    sid = page.evaluate("([kind, idx]) => Object.keys(kind === 'big' ? window.__ww.BOOKS : window.__ww.STORIES)[idx]", [kind, idx])
    page.evaluate("id => { window.__ww.rereadStory(id); }", sid)
    page.wait_for_selector(".book-cover", timeout=8000)
    page.locator(".book-cover ~ .go, .center-col .go").first.tap(force=True)
    page.wait_for_selector(".story-text", timeout=8000)
    return sid


def check_first_page(page, tag):
    """Detailed checks of the first page: order, glow, disabled button, out-of-order taps."""
    s = pg(page)
    check(s["goDisabled"], f"{tag}: the next button is disabled when the page opens")
    check(len(s["next"]) == 1 and s["next"][0] == s["lettered"].index(True), f"{tag}: exactly one word glows, the first one")
    words = page.locator(".story-text .sw")
    idxs = [i for i, ok in enumerate(s["lettered"]) if ok]
    # out of order: the last word, then the second word, do not count
    if len(idxs) >= 3:
        words.nth(idxs[-1]).tap(force=True)
        words.nth(idxs[1]).tap(force=True)
        page.wait_for_timeout(250)
        s2 = pg(page)
        check(s2["done"] == s["done"] and s2["goDisabled"] and s2["next"] == s["next"], f"{tag}: tapping words out of order does not count and the button stays disabled")
    # a tap on the disabled next button does not turn the page
    page.locator(".story .story-btns .btn.go").tap(force=True)
    page.wait_for_timeout(250)
    check(pg(page)["dot"] == s["dot"], f"{tag}: tapping the disabled next button does not turn the page")
    # now in order, with real touch taps, checking after every word
    ok_order = True
    for k, i in enumerate(idxs):
        words.nth(i).tap(force=True)
        page.wait_for_timeout(120)
        c = pg(page)
        last = k == len(idxs) - 1
        if not last:
            if not (c["goDisabled"] and c["done"] == s["done"] + k + 1 and c["next"] == [idxs[k + 1]]):
                ok_order = False
        else:
            if c["done"] != c["n"] or c["next"]:
                ok_order = False
    check(ok_order, f"{tag}: each word tapped in order stays highlighted and the glow moves to the next; the button stays disabled until the last")
    page.wait_for_function("document.querySelector('.story .story-btns .btn.go') && !document.querySelector('.story .story-btns .btn.go').disabled", timeout=20000)
    c = pg(page)
    check(c["done"] == c["n"] and not c["goDisabled"], f"{tag}: after the last word the next button opens, all words stay highlighted")


def run_through(page, tag, want_pages):
    """Let the bot (which taps each word in order) play on; the watcher flags any enabled button with untapped words."""
    page.evaluate(AUTO)
    page.evaluate(WATCH)
    page.evaluate("window.log = []; startAuto(350)")
    page.wait_for_function("document.querySelector('.library') !== null || document.querySelector('.reward-row') !== null", timeout=240000)
    page.evaluate("stopAuto()")
    w = page.evaluate("({ v: window.__w.violations, pages: window.__w.pages.size, words: log.filter(x => x === 'word').length })")
    check(w["v"] == 0, f"{tag}: the next button was never enabled while a word was untapped ({w['v']} violations)")
    check(w["pages"] >= want_pages, f"{tag}: the bot tapped words on {w['pages']} page(s) (book has {want_pages} incl. the first)")
    check(w["words"] > 0, f"{tag}: the bot tapped {w['words']} words")


try:
    with sync_playwright() as p:
        # ---------------- WebKit: iPhone and iPad
        for dev_tag, dev in (() if QUICK else (("iphone", "iPhone 13"), ("ipad", "iPad (gen 7)"))):
            b = p.webkit.launch()
            ctx = b.new_context(**p.devices[dev])
            page = ctx.new_page()
            errs = []
            page.on("pageerror", lambda e: errs.append(str(e)))
            page.on("console", lambda m: m.type == "error" and "ERR_FAILED" not in m.text and errs.append(m.text))
            boot(page)

            # library re-read of a lesson story
            sid = open_story(page, "story", 0)
            tag = f"{dev_tag} library story {sid}"
            page.screenshot(path=str(SHOTS / f"{dev_tag}-1-start.png"))
            check_first_page(page, tag)
            page.screenshot(path=str(SHOTS / f"{dev_tag}-2-open.png"))
            # the back button still gets out of the book
            page.locator(".back").first.tap(force=True)
            page.wait_for_selector(".library", timeout=5000)
            check(True, f"{tag}: the back button leaves the book (library shown)")

            # run a whole library story with the bot
            n_pages = page.evaluate("id => window.__ww.STORIES[id].pages.length", sid)
            open_story(page, "story", 0)
            run_through(page, f"{dev_tag} library re-read", n_pages)

            # a big book
            page.evaluate(FINISH)
            page.wait_for_selector(".node", timeout=5000)
            bid = open_story(page, "big", 0)
            tag = f"{dev_tag} big book {bid}"
            check_first_page(page, tag)
            page.screenshot(path=str(SHOTS / f"{dev_tag}-3-bigbook.png"))
            # no skip: tapping the speaker before all words does not open the button, and the dots are not buttons
            check(page.evaluate("document.querySelectorAll('.page-dots button, .page-dots a, .page-dots [onclick]').length") == 0, f"{tag}: the page dots are not buttons (no page skip)")
            page.locator(".back").first.tap(force=True)
            page.wait_for_selector(".library", timeout=5000)
            check(True, f"{tag}: the back button leaves the big book")
            n_pages = page.evaluate("id => window.__ww.BOOKS[id].pages.length", bid)
            open_story(page, "big", 0)
            run_through(page, f"{dev_tag} big book", n_pages)
            check(not errs, f"{dev_tag}: no console errors {errs[:3]}")
            b.close()

        # ---------------- WebKit: a real lesson story, played by the bot with the rest of the lesson
        b = None if QUICK else p.webkit.launch()
        if not QUICK:
            ctx = b.new_context(**p.devices["iPhone 13"])
            page = ctx.new_page()
            errs = []
            page.on("pageerror", lambda e: errs.append(str(e)))
            page.on("console", lambda m: m.type == "error" and "ERR_FAILED" not in m.text and errs.append(m.text))
            boot(page)
            page.evaluate(AUTO)
            page.evaluate(WATCH)
            page.evaluate("startAuto(500)")
            page.wait_for_function("log.includes('lesson done')", timeout=480000)
            w = page.evaluate("({ v: window.__w.violations, pages: window.__w.pages.size, words: log.filter(x => x === 'word').length })")
            check(w["v"] == 0 and w["pages"] >= 2 and w["words"] > 0, f"lesson 1 story inside a real lesson: tapped {w['words']} words on {w['pages']} pages, {w['v']} violations")
            check(not errs, f"lesson flow: no console errors {errs[:3]}")
            b.close()

        # ---------------- Every story word has its audio clip
        b = p.webkit.launch()
        page = b.new_page()
        page.route("**/*.supabase.co/**", lambda route: route.abort())
        page.goto(URL)
        page.wait_for_timeout(600)
        miss = page.evaluate("""async () => {
          const d = await import('./js/data.js'); const need = new Map();
          for (const [id, S] of Object.entries({ ...d.STORIES, ...d.BOOKS })) S.pages.forEach((pg, i) => pg.t.split(' ').forEach(tok => {
            if (!/[a-z]/i.test(tok)) return;
            const c = tok.toLowerCase().replace(/[^a-z’']/g, '').replace(/[’']/g, '');
            (need.get(c) || need.set(c, []).get(c)).push(id + '#' + i);
          }));
          const out = [];
          for (const [w, where] of need) { const r = await fetch('audio/w_' + w + '.mp3', { method: 'HEAD' }); if (!r.ok) out.push(w + ' (' + where.slice(0, 2).join(', ') + ')'); }
          return { checked: need.size, missing: out };
        }""")
        check(not miss["missing"], f"all {miss['checked']} different story words have a clip; missing: {miss['missing']}")
        b.close()

        # ---------------- Chromium with a fake microphone: Read it to Pip in books
        LAUNCH = ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"]
        SPY = """() => {
          window.__mic = { calls: 0, streams: [] };
          const md = navigator.mediaDevices, orig = md.getUserMedia.bind(md);
          md.getUserMedia = async c => { window.__mic.calls++; const s = await orig(c); window.__mic.streams.push(s); return s; };
        }"""

        def tap_words(page):
            page.evaluate(AUTO)
            n = pg(page)["n"]
            for _ in range(n + 2):
                page.evaluate("() => { const w = document.querySelector('.story-text .sw.next'); if (w) tapEl(w); }")
                page.wait_for_timeout(110)

        for mode in ("on", "off", "refused"):
            b = p.chromium.launch(args=LAUNCH)
            ctx = b.new_context(viewport={"width": 375, "height": 812}, has_touch=True, permissions=["microphone"] if mode == "on" else [])
            page = ctx.new_page()
            errs, reqs = [], []
            page.on("pageerror", lambda e: errs.append(str(e)))
            page.on("console", lambda m: m.type == "error" and "ERR_FAILED" not in m.text and errs.append(m.text))
            page.on("request", lambda r: reqs.append((r.method, r.url)))
            if mode == "refused":
                page.add_init_script("""navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('no', 'NotAllowedError'));""")
            boot(page)
            page.evaluate(SPY)
            page.evaluate("() => { window.__ww.store.state().settings.readAloud = %s; }" % ("true" if mode != "off" else "false"))
            before_keys = page.evaluate("JSON.stringify(Object.keys(localStorage).filter(k => k !== 'wordwild.did').sort())")
            sid = open_story(page, "story", 1)
            tag = f"Chromium, Read it to Pip {mode}"
            gems0 = page.evaluate("window.__ww.store.state().gems")
            sentence_checked = False
            for pidx in range(2):
                s = pg(page)
                # before any word: the sound button must not play the whole sentence, and no microphone is offered yet
                page.locator(".story .speaker").first.tap(force=True)
                page.wait_for_timeout(300)
                check(page.evaluate("!document.querySelector('.ra')") and pg(page)["goDisabled"], f"{tag}, page {pidx + 1}: before the words are tapped there is no microphone step and the next button is disabled")
                calls_before = page.evaluate("window.__mic.calls")
                tap_words(page)
                if mode == "on":
                    page.wait_for_selector(".ra .ra-mic", timeout=25000)
                    check(page.evaluate("window.__mic.calls") == calls_before, f"{tag}, page {pidx + 1}: the microphone is offered but not opened until the child taps it")
                    next_ready = not pg(page)["goDisabled"]
                    check(next_ready, f"{tag}, page {pidx + 1}: the sentence has played and the next button is open while the microphone is offered")
                    if pidx == 0:
                        page.screenshot(path=str(SHOTS / "chromium-readaloud-offer.png"))
                        page.locator(".ra-mic").click()
                        page.wait_for_timeout(1200)
                        check(page.evaluate("window.__mic.calls") == calls_before + 1, f"{tag}: the microphone opens only after the tap")
                        page.locator(".ra-mic").click()   # stop
                        page.wait_for_selector(".ra-reward", timeout=30000)
                        page.screenshot(path=str(SHOTS / "chromium-readaloud-reward.png"))
                        page.wait_for_timeout(500)
                        gems1 = page.evaluate("window.__ww.store.state().gems")
                        check(gems1 == gems0 + 1, f"{tag}: one gem for the page read aloud ({gems0} -> {gems1})")
                        check(page.evaluate("window.__ww.store.pagesReadAloud()") == 1, f"{tag}: the page is counted in the saved progress")
                        ended = page.evaluate("window.__mic.streams.every(s => s.getTracks().every(t => t.readyState === 'ended'))")
                        check(ended, f"{tag}: the microphone was released after use")
                        check(page.evaluate("!window.__ww.readaloud.clipHeld()"), f"{tag}: the recording is not kept")
                    else:
                        # second page: offered again; skipping it is fine and earns nothing
                        gems_a = page.evaluate("window.__ww.store.state().gems")
                        page.locator(".ra-skip").click()
                        page.wait_for_timeout(500)
                        check(page.evaluate("window.__ww.store.state().gems") == gems_a and page.evaluate("window.__ww.store.pagesReadAloud()") == 1, f"{tag}, page 2: skipping the microphone earns nothing and nothing breaks")
                elif mode == "refused" and pidx > 0:
                    # once refused, the game stops asking for the rest of the session
                    page.wait_for_function("document.querySelector('.story .story-btns .btn.go') && !document.querySelector('.story .story-btns .btn.go').disabled", timeout=25000)
                    check(page.evaluate("!document.querySelector('.ra')"), f"{tag}, page {pidx + 1}: after a refusal the microphone is not offered again and the next button opens")
                elif mode == "refused":
                    page.wait_for_selector(".ra .ra-mic", timeout=25000)
                    page.locator(".ra-mic").click()          # the child taps the microphone; the browser refuses
                    page.wait_for_selector(".ra", state="detached", timeout=8000)
                    check(page.evaluate("!document.querySelector('.ra-reward')") and not pg(page)["goDisabled"] and page.locator(".story-text").count() == 1, f"{tag}, page {pidx + 1}: refused microphone is skipped quietly and the book carries on")
                else:
                    page.wait_for_function("document.querySelector('.story .story-btns .btn.go') && !document.querySelector('.story .story-btns .btn.go').disabled", timeout=25000)
                    check(page.evaluate("!document.querySelector('.ra') && window.__mic.calls === 0"), f"{tag}, page {pidx + 1}: no microphone prompt and the next button opens")
                page.wait_for_function("document.querySelector('.story .story-btns .btn.go') && !document.querySelector('.story .story-btns .btn.go').disabled", timeout=25000)
                if pidx == 0:
                    page.screenshot(path=str(SHOTS / f"chromium-page-done-{mode}.png"))
                page.locator(".story .story-btns .btn.go").click()
                page.wait_for_timeout(700)
            if mode == "on":
                # grown-ups corner shows the count
                page.evaluate("window.__ww.parentScreen()")
                page.wait_for_selector(".p-reads", timeout=5000)
                txt = page.locator(".p-reads").inner_text()
                check("1" in txt, f"grown-ups corner shows the pages read aloud: '{txt}'")
                after_keys = page.evaluate("JSON.stringify(Object.keys(localStorage).filter(k => k !== 'wordwild.did').sort())")
                ls = page.evaluate("Object.values(localStorage).join('').length")
                dump = page.evaluate("Object.values(localStorage).join('')")
                check(before_keys == after_keys and 'blob:' not in dump and 'data:audio' not in dump and ls < 200000, f"{tag}: nothing from the recording is stored (storage keys unchanged, {ls} characters)")
                bad = [r for r in reqs if (r[0] != "GET" and r[0] != "HEAD") or not r[1].startswith(URL)]
                bad = [r for r in bad if not r[1].startswith("data:") and not r[1].startswith("blob:") and ".supabase.co/" not in r[1]]   # the cloud is blocked in this test; those calls are aborted and carry no recording
                check(not bad, f"{tag}: nothing was uploaded: every request was a GET from this app ({bad[:3]})")
                check(page.evaluate("window.__mic.streams.length") >= 1, f"{tag}: the fake microphone was used")
            if mode == "refused":
                check(page.evaluate("window.__ww.store.state().gems") == gems0 and page.evaluate("window.__ww.store.pagesReadAloud()") == 0, f"{tag}: no reward and no count when the microphone is refused")
            check(page.evaluate("window.__ww.store.pagesReadAloud()") == (1 if mode == "on" else 0), f"{tag}: pages read aloud saved = {page.evaluate('window.__ww.store.pagesReadAloud()')}")
            check(not errs, f"{tag}: no console errors {errs[:3]}")
            b.close()

        # ---------------- Chromium: the whole sentence plays only after the last word
        b = p.chromium.launch(args=LAUNCH)
        ctx = b.new_context(viewport={"width": 375, "height": 812}, has_touch=True)
        page = ctx.new_page()
        boot(page)
        sid = open_story(page, "story", 2)
        res = page.evaluate("""async (sid) => {
          const au = await import('./js/audio.js');
          const AC = window.AudioContext, S = Object.getPrototypeOf(new AC().createBufferSource()), st = S.start;
          const sent = await au.load('s_' + sid + '_0'); const log = [];
          S.start = function () { if (this.buffer === sent) log.push(['sentence', performance.now(), document.querySelectorAll('.story-text .sw:not(.done)').length]); return st.apply(this, arguments); };
          window.__sent = log; return !!sent; }""", sid)
        check(res, "the sentence clip for the test page is available")
        page.evaluate(AUTO)
        page.locator(".story .speaker").first.tap(force=True)
        page.locator(".story .sw").first.tap(force=True)
        page.wait_for_timeout(600)
        s0 = page.evaluate("window.__sent.length")
        check(s0 == 0, "sentence did not play from the sound button or the first word")
        n = pg(page)["n"]
        for _ in range(n + 1):
            page.evaluate("() => { const w = document.querySelector('.story-text .sw.next'); if (w) tapEl(w); }")
            page.wait_for_timeout(250)
        page.wait_for_timeout(1500)
        log = page.evaluate("window.__sent")
        check(len(log) >= 1 and log[0][2] == 0, f"the whole sentence plays once every word is tapped (plays: {len(log)}, untapped words at that moment: {log[0][2] if log else '-'})")
        b.close()

        # ---------------- Saved progress: pages read aloud merge safely
        b = p.webkit.launch()
        page = b.new_page()
        page.route("**/*.supabase.co/**", lambda route: route.abort())
        page.goto(URL)
        page.wait_for_timeout(600)
        r = page.evaluate("""async () => {
          const st = await import('./js/store.js');
          const S = st.state(); S.reads = { aaa: 2 };
          st.merge({ reads: { aaa: 1, bbb: 3 } });
          const a = st.pagesReadAloud();
          st.merge({ reads: { aaa: 1, bbb: 3 } });          // the same again: nothing is counted twice
          const b = st.pagesReadAloud();
          st.merge({ reads: { aaa: 'x', ccc: -4, ddd: 2.9 } }); // rubbish is ignored
          const c = st.pagesReadAloud();
          st.merge({});                                        // an old save with no count at all
          return [a, b, c, st.pagesReadAloud()];
        }""")
        check(r == [5, 5, 7, 7], f"pages read aloud merge by device and never double count: {r}")
        b.close()
finally:
    server.terminate()

print()
print("FAILED" if fails else "ALL PASSED", len(fails))
sys.exit(1 if fails else 0)
