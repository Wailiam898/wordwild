"""Read it to Pip (app/js/readaloud.js): the child reads aloud, hears themselves, then hears the model.

Chromium with a fake microphone (--use-fake-device-for-media-stream --use-fake-ui-for-media-stream),
because WebKit cannot fake a device:
  - off by default; the Grown-ups switch turns it on (and asks for the microphone there)
  - tap the microphone -> record -> tap again -> hear the recording, then the model reading
  - the recording is not uploaded, not stored, and is dropped after playback; the microphone is released
  - it is offered after the hop word and after one story page, at most twice a lesson
  - the skip button and the idle timeout never leave the child stuck
WebKit (Safari engine), iPhone and iPad sizes:
  - microphone refused / missing / no MediaRecorder: the step is skipped quietly, nothing is shown to the child
  - the overlay fits on screen; the Grown-ups switch falls back to off with a plain message

Every browser blocks *.supabase.co. Nothing leaves the machine: all requests are checked.

Usage: .venv/Scripts/python.exe -I tests/readaloud.py
"""
import sys, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "app"
SHOTS = ROOT / "work" / "shots" / "readaloud"
SHOTS.mkdir(parents=True, exist_ok=True)
AUTO = (ROOT / "tests" / "autoplay.js").read_text(encoding="utf-8")
PORT = 5183
URL = f"http://localhost:{PORT}/"
fails = []


def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--directory", str(APP)],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                          creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))

# Record what the page does with audio, streams and the network.
SPY = """(() => {
  window.__starts = [];
  const o = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...a) { if (this.buffer) window.__starts.push(+this.buffer.duration.toFixed(4)); return o.apply(this, a); };
  window.__streams = [];
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    const g = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async c => { const s = await g(c); window.__streams.push(s); return s; };
  }
  window.__raCount = 0;
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.classList && n.classList.contains('ra')) window.__raCount++; })))
    .observe(document, { childList: true, subtree: true });
})()"""

# WebKit has no fake microphone: make it look supported but refuse (or have no device at all).
REFUSE = """(() => {
  if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true });
  navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
  if (typeof MediaRecorder === 'undefined') window.MediaRecorder = function () {};
  window.__raCount = 0;
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.classList && n.classList.contains('ra')) window.__raCount++; })))
    .observe(document, { childList: true, subtree: true });
})()"""
NODEVICE = """(() => {
  if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true });
  navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Requested device not found', 'NotFoundError'));
  if (typeof MediaRecorder === 'undefined') window.MediaRecorder = function () {};
  window.__raCount = 0;
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.classList && n.classList.contains('ra')) window.__raCount++; })))
    .observe(document, { childList: true, subtree: true });
})()"""

STAGE = """(kind) => {
  const app = document.getElementById('app');
  app.className = 'screen-lesson theme-farm';
  app.innerHTML = '<div class="lesson"><div class="topbar"></div><div class="stage step-hop"></div></div>';
  window.__G = { stage: app.querySelector('.stage'), known: { g: new Set(['s','u','n','p','i','g','c','a','t']) }, newG: [], gem() {}, setReplay() {}, hat: '', ra: { used: 0, max: 2 },
    pool: [{ w: 'sun', e: '☀️', seg: ['s', 'u', 'n'] }, { w: 'pig', e: '🐷', seg: ['p', 'i', 'g'] }, { w: 'cat', e: '🐱', seg: ['c', 'a', 't'] }] };
  return true;
}"""
ASK = """(kind) => { window.__res = undefined;
  const sentence = kind === 'sentence';
  window.__ww.readaloud.readToPip(window.__G, sentence
    ? { kind, tokens: 'Pip sat on a log.'.split(' '), model: async spans => { for (const s of spans) { s.classList.add('hl'); await new Promise(r => setTimeout(r, 60)); } await window.__sayPlain('w_sun'); } }
    : { kind, tokens: ['sun'], model: () => window.__sayPlain('w_sun') }).then(r => (window.__res = r)); }"""


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


def clip_seconds(page, id):
    return page.evaluate("""async id => { const ac = new AudioContext(); const ab = await (await fetch('audio/' + id + '.mp3')).arrayBuffer();
      return +(await ac.decodeAudioData(ab)).duration.toFixed(4); }""", id)


try:
    with sync_playwright() as p:
        # =========================================================== Chromium + fake microphone
        b = p.chromium.launch(args=["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream",
                                    "--autoplay-policy=no-user-gesture-required"])
        ctx = b.new_context(viewport={"width": 390, "height": 760}, permissions=["microphone"])
        page = ctx.new_page()
        errors, requests = [], []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: m.type == "error" and "ERR_FAILED" not in m.text and errors.append(m.text))
        page.on("request", lambda r: requests.append((r.method, r.url)))
        page.add_init_script(SPY)
        sign_in(page)
        # a helper that plays a clip through the page's own voice channel (the same path the app uses)
        page.evaluate("window.__sayPlain = id => import('./js/audio.js').then(a => a.say(id))")

        # ---- Off by default
        check(page.evaluate("window.__ww.store.state().settings.readAloud") in (False, None, 0), "Read it to Pip is off by default")
        check(page.evaluate("window.__ww.readaloud.enabled()") is False, "…so the step is not offered")
        page.evaluate(STAGE)
        page.evaluate(ASK, "word")
        page.wait_for_function("window.__res !== undefined", timeout=3000)
        check(page.evaluate("window.__res") is False and page.locator(".ra").count() == 0, "with the switch off nothing appears and nothing is asked")
        check(page.evaluate("window.__streams.length") == 0, "the microphone was not opened")

        # ---- Grown-ups corner
        page.evaluate("window.__ww.parentScreen()")
        page.wait_for_selector(".pcard")
        sw = page.locator(".pcard label", has_text="Read it to Pip").locator("input")
        check(sw.count() == 1 and not sw.is_checked(), "grown-ups corner has the switch, off")
        txt = page.locator(".pcard", has_text="Read it to Pip").inner_text().lower()
        check("never" in txt and "device" in txt and "deleted" in txt, "the corner explains in one sentence that the recording never leaves the device")
        page.screenshot(path=str(SHOTS / "grownups-switch.png"), full_page=True)
        sw.click()
        page.wait_for_function("window.__ww.store.state().settings.readAloud === true", timeout=5000)
        check(page.evaluate("window.__ww.readaloud.enabled()") is True, "switching it on (microphone allowed) turns the step on")
        check(page.evaluate("window.__streams.every(s => s.getTracks().every(t => t.readyState === 'ended'))"), "the permission check released the microphone straight away")
        page.evaluate("window.__streams.length = 0")

        # ---- The recording flow, for a word
        page.evaluate("window.__ww.mapScreen()")
        page.evaluate(STAGE)
        d_you, d_me, d_word = clip_seconds(page, "pl_ra_you"), clip_seconds(page, "pl_ra_me"), clip_seconds(page, "w_sun")
        page.evaluate("window.__starts.length = 0")
        page.evaluate(ASK, "word")
        page.wait_for_selector(".ra .ra-mic", timeout=3000)
        check(page.locator(".ra-text").inner_text().strip() == "sun", "the word is shown large")
        page.screenshot(path=str(SHOTS / "chromium-word-ask.png"))
        box = page.locator(".ra-mic").bounding_box()
        check(box["width"] >= 100 and box["height"] >= 100, f"the microphone button is big ({round(box['width'])}px)")
        page.wait_for_timeout(2500)   # Pip's invitation plays
        page.locator(".ra-mic").click()
        page.wait_for_selector(".ra-mic.rec", timeout=3000)
        check(page.evaluate("window.__streams.length") == 1 and page.evaluate("window.__streams[0].getAudioTracks()[0].readyState") == "live", "tapping the microphone starts recording")
        page.screenshot(path=str(SHOTS / "chromium-word-recording.png"))
        page.wait_for_timeout(1400)
        page.evaluate("window.__starts.length = 0")
        page.locator(".ra-mic").click()
        page.wait_for_function("window.__res !== undefined", timeout=20000)
        starts = page.evaluate("window.__starts")
        # order: "Listen to you!", the recording, "Now it's my turn!", the model reading
        near = lambda v, d: abs(v - d) < 0.002
        idx = {}
        pos = 0
        for name, test in (("you", lambda v: near(v, d_you)), ("recording", lambda v: 0.8 < v < 3.5 and not near(v, d_you) and not near(v, d_me) and not near(v, d_word)),
                           ("me", lambda v: near(v, d_me)), ("model", lambda v: near(v, d_word))):
            for i in range(pos, len(starts)):
                if test(starts[i]):
                    idx[name] = i; pos = i + 1; break
        check(list(idx) == ["you", "recording", "me", "model"], f"played back in order: 'Listen to you', the child's recording, 'my turn', the model reading {starts}")
        check(page.evaluate("window.__res") is True, "the step finished")
        check(page.locator(".ra").count() == 0, "the overlay is gone afterwards")
        check(page.evaluate("window.__ww.readaloud.clipHeld()") is False, "the recording is not held in memory afterwards")
        check(page.evaluate("window.__streams.every(s => s.getTracks().every(t => t.readyState === 'ended'))"), "the microphone was released")
        # Privacy: nothing uploaded, nothing stored.
        bad = [r for r in requests if r[0] != "GET" and "supabase" not in r[1]]
        outside = [r for r in requests if not r[1].startswith(URL) and not r[1].startswith("data:") and not r[1].startswith("blob:") and "supabase.co" not in r[1]]
        check(not bad and not outside, f"no upload and no request outside this app {bad[:2] or outside[:2] or ''}")
        stored = page.evaluate("""async () => ({ ls: Object.entries(localStorage).map(([k, v]) => [k, v.length]), ss: Object.keys(sessionStorage),
          idb: indexedDB.databases ? (await indexedDB.databases()).map(d => d.name) : [], caches: await caches.keys() })""")
        check(all(k in ("wordwild.v1", "wordwild.vid") and n < 6000 for k, n in stored["ls"]) and not stored["ss"] and not stored["idb"] and not stored["caches"],
              f"nothing is written to any storage (only the usual small save) {stored}")
        check(page.evaluate("JSON.stringify(window.__ww.store.state()).length") < 6000, "the saved progress holds no audio")

        # ---- Sentence, with the model reading lighting the words
        page.evaluate(STAGE)
        page.evaluate(ASK, "sentence")
        page.wait_for_selector(".ra .ra-text.sentence", timeout=3000)
        check(page.locator(".ra-w").count() == 5, "a sentence is shown word by word")
        page.screenshot(path=str(SHOTS / "chromium-sentence-ask.png"))
        page.wait_for_timeout(2200)
        page.locator(".ra-mic").click(); page.wait_for_selector(".ra-mic.rec")
        page.wait_for_timeout(1200)
        page.locator(".ra-mic").click()
        page.wait_for_function("window.__res !== undefined", timeout=25000)
        check(page.evaluate("window.__res") is True and page.evaluate("window.__ww.readaloud.clipHeld()") is False, "sentence read aloud, played back and discarded")

        # ---- Skip, and the quota
        page.evaluate(STAGE)
        page.evaluate(ASK, "word")
        page.wait_for_selector(".ra-skip")
        page.locator(".ra-skip").click()
        page.wait_for_function("window.__res !== undefined", timeout=3000)
        check(page.evaluate("window.__res") is False and page.locator(".ra").count() == 0, "the skip button leaves the step at once")
        n_streams = page.evaluate("window.__streams.length")
        page.evaluate("window.__G.ra.used = 2")
        page.evaluate(ASK, "word")
        page.wait_for_function("window.__res !== undefined", timeout=3000)
        check(page.evaluate("window.__res") is False and page.locator(".ra").count() == 0, "after two uses in a lesson it is not offered again")
        check(page.evaluate("window.__streams.length") == n_streams, "…and the skipped steps never opened the microphone")

        # ---- In the real activities: hop word, then every story page
        page.evaluate(AUTO)
        page.evaluate(STAGE)
        page.evaluate("window.__raCount = 0")
        sid = page.evaluate("window.__ww.LESSONS.find(l => l.story).story")
        page.evaluate("""async () => { window.__hop = undefined; window.__ww.games.hop(window.__G, window.__G.pool[0], true).then(r => (window.__hop = r)); }""")
        page.evaluate("startAuto(500)")
        for _ in range(120):
            if page.evaluate("window.__hop !== undefined"):
                break
            if page.locator(".ra .ra-mic:not([hidden])").count():
                if page.locator(".ra-mic.rec").count():
                    page.wait_for_timeout(1000)
                    page.locator(".ra-mic").click()
                else:
                    page.wait_for_timeout(700)
                    page.locator(".ra-mic").click()
                page.wait_for_timeout(600)
            page.wait_for_timeout(400)
        check(page.evaluate("window.__hop !== undefined") and page.evaluate("window.__raCount") == 1, f"the hop activity offered it once (after the word was read) {page.evaluate('window.__raCount')}")
        check(page.evaluate("window.__G.ra.used") == 1, "…and it counts towards the lesson's two")
        page.evaluate("stopAuto()")
        page.evaluate(STAGE)
        page.evaluate("window.__G.ra.used = 1")
        page.evaluate("window.__raCount = 0")
        page.evaluate("sid => { window.__story = undefined; window.__ww.games.story(window.__G, sid, {}).then(r => (window.__story = r)); }", sid)
        page.evaluate("startAuto(500)")
        for _ in range(200):
            if page.evaluate("window.__story !== undefined"):
                break
            if page.locator(".ra .ra-mic:not([hidden])").count():
                page.wait_for_timeout(700)
                page.locator(".ra-mic").click()
                page.wait_for_timeout(1100)
                if page.locator(".ra-mic.rec").count():
                    page.locator(".ra-mic").click()
                page.wait_for_timeout(600)
            page.wait_for_timeout(400)
        check(page.evaluate("window.__story !== undefined"), "the story finished")
        npages = page.evaluate("sid => (window.__ww.STORIES[sid] || window.__ww.BOOKS[sid]).pages.length", sid)
        check(page.evaluate("window.__raCount") == npages and page.evaluate("window.__G.ra.used") == 1, f"a story offers it once per page, after the words are tapped ({page.evaluate('window.__raCount')} overlays for {npages} pages), and does not use up the lesson's own limit")
        page.evaluate("stopAuto()")
        check(not errors, f"Chromium: no page errors {errors[:3] or ''}")
        ctx.close(); b.close()

        # =========================================================== WebKit: refused / missing, layout
        for dev in ("iPhone 13", "iPad (gen 7)"):
            tag = dev.split()[0].lower()
            for mode, script in (("refused", REFUSE), ("no device", NODEVICE)):
                b = p.webkit.launch()
                ctx = b.new_context(**p.devices[dev])
                page = ctx.new_page()
                errors = []
                page.on("pageerror", lambda e: errors.append(str(e)))
                page.on("console", lambda m: m.type == "error" and "ERR_FAILED" not in m.text and errors.append(m.text))
                page.add_init_script(script)
                sign_in(page)
                vw, vh = page.evaluate("[innerWidth, innerHeight]")
                print(f"--- {dev} ({vw}x{vh}), microphone {mode}")
                # Grown-ups switch: falls back to off with a plain message
                page.evaluate("window.__ww.parentScreen()")
                page.wait_for_selector(".pcard")
                sw = page.locator(".pcard label", has_text="Read it to Pip").locator("input")
                sw.click()
                page.wait_for_function("document.querySelector('.ra-msg').textContent.length > 10", timeout=5000)
                msg = page.locator(".ra-msg").inner_text()
                check(not sw.is_checked() and page.evaluate("!window.__ww.store.state().settings.readAloud") and ("blocked" in msg or "cannot" in msg),
                      f"the switch stays off with a clear message for the grown-up: {msg[:70]!r}")
                page.screenshot(path=str(SHOTS / f"{tag}-{mode.replace(' ', '')}-grownups.png"), full_page=True)
                # Switched on by an earlier session, then the microphone is refused mid-lesson: quiet skip
                page.evaluate("window.__ww.store.state().settings.readAloud = true")
                page.evaluate("window.__ww.mapScreen()")
                page.evaluate(STAGE)
                page.evaluate("window.__sayPlain = id => Promise.resolve()")
                page.evaluate(ASK, "sentence")
                page.wait_for_selector(".ra .ra-mic", timeout=3000)
                r = page.evaluate("""(() => { const q = s => document.querySelector(s).getBoundingClientRect();
                  const m = q('.ra-mic'), k = q('.ra-skip'), t = q('.ra-text'), ov = document.querySelector('.ra');
                  return { mic: [m.left, m.top, m.right, m.bottom], skip: [k.width, k.height], text: [t.left, t.right], overflowX: ov.scrollWidth > ov.clientWidth,
                           inside: m.left >= 0 && m.right <= innerWidth && m.bottom <= innerHeight && k.right <= innerWidth && k.bottom <= innerHeight }; })()""")
                check(r["inside"] and not r["overflowX"] and r["text"][0] >= 0 and r["text"][1] <= vw and r["skip"][0] >= 44, f"the overlay fits the {vw}x{vh} screen")
                page.screenshot(path=str(SHOTS / f"{tag}-{mode.replace(' ', '')}-ask.png"))
                page.locator(".ra-mic").click()
                page.wait_for_function("window.__res !== undefined", timeout=5000)
                visible = page.evaluate("document.body.innerText").lower()
                check(page.evaluate("window.__res") is False and page.locator(".ra").count() == 0, "microphone refused: the step vanishes and the lesson carries on")
                check(not any(w in visible for w in ("error", "denied", "permission", "not allowed", "failed")), "no error or warning is shown to the child")
                check(page.evaluate("window.__ww.readaloud.enabled()") is False, "it is not offered again this session")
                page.evaluate(ASK, "word")
                page.wait_for_function("window.__res !== undefined", timeout=3000)
                check(page.evaluate("window.__res") is False and page.evaluate("window.__raCount") == 1, "…the next lesson step never shows it")
                check(not errors, f"{dev} {mode}: no page errors {errors[:3] or ''}")
                ctx.close(); b.close()

        # No MediaRecorder / no microphone API at all
        b = p.webkit.launch()
        ctx = b.new_context(**p.devices["iPhone 13"])
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.add_init_script("""(() => { try { Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true }); } catch (e) {} delete window.MediaRecorder; })()""")
        sign_in(page)
        page.evaluate("window.__ww.store.state().settings.readAloud = true")
        check(page.evaluate("window.__ww.readaloud.supported()") is False and page.evaluate("window.__ww.readaloud.enabled()") is False, "no microphone API: the step is simply not offered")
        page.evaluate(STAGE)
        page.evaluate("window.__sayPlain = id => Promise.resolve()")
        page.evaluate(ASK, "word")
        page.wait_for_function("window.__res !== undefined", timeout=3000)
        check(page.evaluate("window.__res") is False and page.locator(".ra").count() == 0, "…and nothing appears")
        check(not errors, f"no page errors {errors[:3] or ''}")
        ctx.close(); b.close()
finally:
    server.terminate()

print()
print("FAILED: " + "; ".join(fails) if fails else "ALL PASSED")
sys.exit(1 if fails else 0)
