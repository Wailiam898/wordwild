"""Milestone bonus games (Chick Run, Feed the Chicks, Barnyard Hide and Seek), through work/milestone_demo.html.

For every configuration (WebKit at iPhone and iPad sizes, Chromium at phone size, and a reduced-motion run) each game is
started, a bot plays it to the end (jumps, pecks, drags right seeds and one wrong seed, taps hiding places), the score
screen must show 1 to 3 stars, the returned Promise must resolve, and nothing may be left running afterwards (animation
frames, timers, intervals, window/document listeners). Also: no console errors, no sideways scroll, only taught words with
clips, screenshots saved to work/shots/milestone/.

Usage:  .venv/Scripts/python.exe -I tests/milestone.py          (about 12 minutes; starts and stops its own server on 5191)
        .venv/Scripts/python.exe -I tests/milestone.py quick    (25 s games everywhere, fewer configurations)
"""
import sys, subprocess, time, json
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "work" / "shots" / "milestone"
SHOTS.mkdir(parents=True, exist_ok=True)
PORT = 5191
BASE = f"http://127.0.0.1:{PORT}"
QUICK = "quick" in sys.argv
ONLY_CFG = [int(a[4:]) for a in sys.argv if a.startswith("cfg=")]
ONLY_KIND = [a[5:] for a in sys.argv if a.startswith("kind=")]
NO_WORDS = "nowords" in sys.argv
fails = []
passed = 0


def check(ok, msg):
    global passed
    print(("ok   " if ok else "FAIL ") + msg, flush=True)
    if ok:
        passed += 1
    else:
        fails.append(msg)


# Counts what is alive in the page: animation frames, timeouts, intervals, window/document listeners.
INSTR = """
(() => {
  const L = { raf: new Set(), iv: new Set(), to: new Set(), rafCalls: 0, ls: new Map() };
  window.__L = L;
  const _raf = window.requestAnimationFrame.bind(window), _caf = window.cancelAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => { L.rafCalls++; let id; id = _raf(t => { L.raf.delete(id); cb(t); }); L.raf.add(id); return id; };
  window.cancelAnimationFrame = id => { L.raf.delete(id); _caf(id); };
  const _si = window.setInterval.bind(window), _ci = window.clearInterval.bind(window);
  window.setInterval = (f, ms, ...a) => { const id = _si(f, ms, ...a); L.iv.add(id); return id; };
  window.clearInterval = id => { L.iv.delete(id); _ci(id); };
  const _st = window.setTimeout.bind(window), _ct = window.clearTimeout.bind(window);
  window.setTimeout = (f, ms, ...a) => { let id; id = _st(function (...x) { L.to.delete(id); return typeof f === 'function' ? f(...x) : undefined; }, ms, ...a); L.to.add(id); return id; };
  window.clearTimeout = id => { L.to.delete(id); _ct(id); };
  const add = EventTarget.prototype.addEventListener, rem = EventTarget.prototype.removeEventListener;
  const key = (t, type) => (t === window ? 'w:' : 'd:') + type;
  EventTarget.prototype.addEventListener = function (type, fn, o) { if (this === window || this === document) L.ls.set(key(this, type), (L.ls.get(key(this, type)) || 0) + 1); return add.call(this, type, fn, o); };
  EventTarget.prototype.removeEventListener = function (type, fn, o) { if (this === window || this === document) L.ls.set(key(this, type), (L.ls.get(key(this, type)) || 0) - 1); return rem.call(this, type, fn, o); };
  window.__snap = () => ({ raf: L.raf.size, iv: L.iv.size, to: L.to.size, rafCalls: L.rafCalls, ls: Object.fromEntries([...L.ls].filter(([k, v]) => v !== 0)) });
})();
"""

# Prepares things the app would already have done, so the baseline is taken after them.
PREP = """async () => {
  const a = await import('./js/audio.js'); a.unlock();
  const u = await import('./js/ui.js'); u.burst(0, 0, 1);
  await new Promise(r => setTimeout(r, 400));
  window.__base = window.__snap();
  return window.__base;
}"""

WORDS_JS = """() => [...document.querySelectorAll('.ms-corn b, .ms-nest .ms-sign b, .ms-spot .ms-sign b, .ms-card b, .ms-pip-say b')].map(e => e.textContent.trim()).filter(Boolean)"""

RUN_BOT = """() => {
  window.__jumps = 0;
  window.__bot = setInterval(() => {
    const r = document.querySelector('.ms-runner'), st = document.querySelector('.ms-stage'), root = document.querySelector('.ms-root');
    if (!r || !st || !root) return;
    const u = parseFloat(getComputedStyle(root).getPropertyValue('--u')) || 60;
    const cr = r.getBoundingClientRect(), cx = cr.left + cr.width / 2;
    for (const o of document.querySelectorAll('.ms-obst')) {
      if (o.__done) continue;
      const b = o.getBoundingClientRect(), d = b.left + b.width / 2 - cx;
      if (d > 0 && d < 1.25 * u) { o.__done = 1; st.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, pointerType: 'touch', isPrimary: true })); window.__jumps++; break; }
    }
  }, 16);
}"""


def snap_state(pg):
    return pg.evaluate("""() => ({
      final: !!document.querySelector('.ms-final'),
      stars: document.querySelectorAll('.ms-final .ms-star.on').length,
      starsAll: document.querySelectorAll('.ms-final .ms-star').length,
      rootThere: !!document.querySelector('.ms-root'),
      score: (document.querySelector('.ms-score b') || {}).textContent,
      scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight, iw: innerWidth, ih: innerHeight,
      scrollX: scrollX, scrollY: scrollY })""")


def wait_final(pg, timeout):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if pg.evaluate("() => !!document.querySelector('.ms-final')"):
            return True
        time.sleep(0.25)
    return False


def drag(pg, a, b, steps=10, hold=0.0):
    pg.mouse.move(a[0], a[1]); pg.mouse.down()
    pg.mouse.move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, steps=max(2, steps // 2))
    pg.mouse.move(b[0], b[1], steps=steps)
    if hold: time.sleep(hold)
    pg.mouse.up()


def play(pw, cfg, kind):
    """Plays one game in one configuration. Returns nothing; records checks."""
    tag = f"{cfg['name']} / {kind}"
    browser = getattr(pw, cfg["engine"]).launch()
    ctx = browser.new_context(viewport={"width": cfg["w"], "height": cfg["h"]}, device_scale_factor=2, has_touch=cfg["touch"],
                              is_mobile=cfg["mobile"] and cfg["engine"] == "chromium", reduced_motion="reduce" if cfg["reduced"] else "no-preference")
    ctx.route("**/*.supabase.co/**", lambda r: r.abort())
    pg = ctx.new_page()
    errors, bad_audio, audio_seen = [], [], set()
    pg.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
    pg.on("pageerror", lambda e: errors.append("PAGEERROR " + str(e)))

    def on_resp(r):
        if "/audio/" in r.url:
            audio_seen.add(r.url.rsplit("/", 1)[1])
            if r.status != 200:
                bad_audio.append(r.url)
    pg.on("response", on_resp)
    pg.add_init_script(INSTR)
    pg.goto(f"{BASE}/work/milestone_demo.html?world={cfg['world']}" + (f"&seconds={cfg['seconds']}" if cfg["seconds"] else ""))
    pg.wait_for_selector("#demo")
    pg.wait_for_function("() => typeof window.__start === 'function'", timeout=30000)
    base = pg.evaluate(PREP)
    check(pg.evaluate("() => matchMedia('(prefers-reduced-motion: reduce)').matches") == cfg["reduced"], f"{tag}: reduced-motion setting is {cfg['reduced']}")
    pg.evaluate("kind => { window.__p = window.__start(kind); }", kind)
    pg.wait_for_selector(".ms-root")
    time.sleep(1.2)
    words_seen = set()
    shot = lambda name: pg.screenshot(path=str(SHOTS / f"{kind}_{cfg['shot']}_{name}.png"))
    started = time.time()
    if kind in ("run", "feed"):
        # a hidden tab pauses the game clock (the progress bar must not move), and it carries on when the tab is back
        bar = "() => document.querySelector('.ms-bar i').style.transform"
        for _ in range(60):
            if pg.evaluate(bar): break
            time.sleep(0.2)
        pg.evaluate("() => { window.__hid = true; Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__hid }); document.dispatchEvent(new Event('visibilitychange')); }")
        time.sleep(0.3); b1 = pg.evaluate(bar); time.sleep(1.5); b2 = pg.evaluate(bar)
        check(b1 == b2, f"{tag}: the game pauses while the tab is hidden ({b1} = {b2})")
        pg.evaluate("() => { window.__hid = false; document.dispatchEvent(new Event('visibilitychange')); }")
        time.sleep(1.5); b3 = pg.evaluate(bar)
        check(b3 != b2, f"{tag}: and carries on when the tab is back ({b2} -> {b3})")
    st = snap_state(pg)
    check(st["scrollW"] <= st["iw"] + 1 and st["scrollH"] <= st["ih"] + 1, f"{tag}: no sideways/vertical page scroll at start ({st['scrollW']}x{st['scrollH']} in {st['iw']}x{st['ih']})")

    if kind == "run":
        pg.evaluate(RUN_BOT)
        # one real input: tap the screen, the chick must leave the ground
        y0 = pg.evaluate("() => document.querySelector('.ms-runner').getBoundingClientRect().top")
        time.sleep(0.3)
        pg.evaluate("() => { clearInterval(window.__bot); }")
        y0 = pg.evaluate("() => document.querySelector('.ms-runner').getBoundingClientRect().top")
        if cfg["touch"] and cfg["engine"] == "webkit":
            pg.touchscreen.tap(cfg["w"] // 2, cfg["h"] // 2)
        else:
            pg.mouse.click(cfg["w"] // 2, cfg["h"] // 2)
        ys = []
        for _ in range(9):
            ys.append(pg.evaluate("() => document.querySelector('.ms-runner').getBoundingClientRect().top")); time.sleep(0.05)
        check(min(ys) < y0 - 15, f"{tag}: a real tap makes the chick jump (top {y0:.0f} -> {min(ys):.0f})")
        time.sleep(0.9)
        pg.evaluate(RUN_BOT)
        shot_at = 14 if cfg["seconds"] == 0 else min(14, cfg["seconds"] * 0.55)
        did_shot = False
        saw_call = False
        while not pg.evaluate("() => !!document.querySelector('.ms-final')"):
            time.sleep(0.4)
            words_seen.update(pg.evaluate(WORDS_JS))
            if pg.evaluate("() => !!document.querySelector('.ms-banner.show')"):
                saw_call = True
            if not did_shot and time.time() - started > shot_at and cfg["shots"]:
                shot("mid"); did_shot = True
            if time.time() - started > (cfg["seconds"] or 75) + 40:
                break
        pg.evaluate("() => clearInterval(window.__bot)")
        jumps = pg.evaluate("() => window.__jumps")
        check(jumps >= (3 if not cfg["seconds"] else 1), f"{tag}: bot jumped {jumps} times")
        check(saw_call, f"{tag}: Pip called out a word to find")
    elif kind == "feed":
        did_wrong = did_flick = False
        did_shot = False
        fed_seen = False
        t_end = time.time() + (cfg["seconds"] or 75) + 45
        while time.time() < t_end and not pg.evaluate("() => !!document.querySelector('.ms-final')"):
            words_seen.update(pg.evaluate(WORDS_JS))
            info = pg.evaluate("""() => {
              const c = e => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
              return {
                seeds: [...document.querySelectorAll('.ms-seed')].filter(e => e.style.opacity !== '0').map(e => ({ w: e.dataset.word, c: c(e) })),
                nests: [...document.querySelectorAll('.ms-nest.up')].map(e => ({ w: e.querySelector('.ms-sign b').textContent, c: (() => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height * 0.6]; })() })),
                score: +document.querySelector('.ms-score b').textContent,
                fat: [...document.querySelectorAll('.ms-nest')].map(e => parseFloat(e.style.getPropertyValue('--fat') || '1')) } }""")
            if max(info["fat"] or [1]) > 1: fed_seen = True
            if not did_shot and cfg["shots"] and time.time() - started > min(14, (cfg["seconds"] or 75) * 0.5) and info["nests"]:
                shot("mid"); did_shot = True
            acted = False
            if info["seeds"] and info["nests"]:
                s = info["seeds"][0]
                if not did_wrong:
                    wrongs = [n for n in info["nests"] if n["w"] != s["w"]]
                    if wrongs:
                        time.sleep(0.6)   # let the seed finish dropping into its place
                        s["c"] = pg.evaluate("w => { const e = document.querySelector(`.ms-seed[data-word='${w}']`); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }", s["w"]) or s["c"]
                        before = s["c"]; score0 = info["score"]
                        drag(pg, s["c"], wrongs[0]["c"])
                        did_wrong = True; acted = True
                        time.sleep(0.8)
                        after = pg.evaluate("w => { const e = document.querySelector(`.ms-seed[data-word='${w}']`); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }", s["w"])
                        score1 = pg.evaluate("() => +document.querySelector('.ms-score b').textContent")
                        check(after is not None and abs(after[0] - before[0]) < 8 and abs(after[1] - before[1]) < 8, f"{tag}: the wrong seed bounces back to its place (was {before}, now {after})")
                        check(score1 == score0, f"{tag}: a wrong seed costs no points ({score0} -> {score1})")
                        continue
                match = [(sd, n) for sd in info["seeds"] for n in info["nests"] if n["w"] == sd["w"]]
                if match:
                    sd, n = match[0]
                    if not did_flick and len(match) > 1:
                        # a quick flick that stops short of the chick: it should still find its way (or come back), never get stuck
                        mx = sd["c"][0] + (n["c"][0] - sd["c"][0]) * 0.55; my = sd["c"][1] + (n["c"][1] - sd["c"][1]) * 0.55
                        pg.mouse.move(*sd["c"]); pg.mouse.down(); pg.mouse.move((sd["c"][0] + mx) / 2, (sd["c"][1] + my) / 2, steps=1); pg.mouse.move(mx, my, steps=1); pg.mouse.up()
                        did_flick = True; time.sleep(0.8); acted = True
                    else:
                        drag(pg, sd["c"], n["c"]); acted = True
            time.sleep(0.35 if acted else 0.25)
        check(did_wrong, f"{tag}: a wrong seed was tried")
        check(fed_seen, f"{tag}: a fed chick grew rounder")
    else:  # hide
        # stuck for 8 seconds: a hint glow must appear on a place that hides a chick
        pg.wait_for_selector(".ms-spot", timeout=30000)
        t_spots = time.time()
        time.sleep(6.5)
        early = pg.evaluate("() => !!document.querySelector('.ms-spot.hint')")
        hint = None
        for _ in range(40):
            hint = pg.evaluate("() => { const e = document.querySelector('.ms-spot.hint'); return e ? e.dataset.role : null; }")
            if hint: break
            time.sleep(0.25)
        waited = time.time() - t_spots
        check(not early and hint == "chick" and 7.5 <= waited <= 16, f"{tag}: no hint before 8 s, then a glow on a chick's hiding place ({waited:.1f} s after the yard appeared, got {hint})")
        if cfg["shots"]:
            shot("hint")
        n_chicks = pg.evaluate("() => document.querySelectorAll('.ms-spot[data-role=chick]').length")
        n_spots = pg.evaluate("() => document.querySelectorAll('.ms-spot').length")
        check(n_chicks in (6, 8, 10) and n_spots == n_chicks + 3, f"{tag}: {n_chicks} chicks in {n_spots} hiding places")
        spots = pg.evaluate("""() => [...document.querySelectorAll('.ms-spot')].map(e => { const r = e.getBoundingClientRect(); return { i: +e.dataset.i, role: e.dataset.role, c: [r.left + r.width / 2, r.top + r.height / 2], w: r.width, h: r.height } })""")
        check(all(s["w"] >= 60 and s["h"] >= 60 for s in spots), f"{tag}: every hiding place is at least 60 px ({min(s['w'] for s in spots):.0f} px smallest)")
        order = sorted(spots, key=lambda s: (s["role"] != "chick", s["i"])) if False else spots
        did_shot = False
        for k, s in enumerate(order):
            if cfg["touch"] and cfg["engine"] == "webkit":
                pg.touchscreen.tap(*s["c"])
            else:
                pg.mouse.click(*s["c"])
            time.sleep(0.45)
            words_seen.update(pg.evaluate(WORDS_JS))
            if cfg["shots"] and not did_shot and k >= len(order) // 2:
                shot("mid"); did_shot = True
        # a second tap on an opened place changes nothing
        time.sleep(1.2)   # the last reveal is on the game clock; let it settle
        sc = pg.evaluate("() => +document.querySelector('.ms-score b').textContent")
        pg.mouse.click(*order[0]["c"]); time.sleep(0.4)
        check(pg.evaluate("() => +document.querySelector('.ms-score b').textContent") == sc, f"{tag}: tapping an opened place again changes nothing")
        time.sleep(1.4)
        # dance party: every chick dances (calm fade in reduced motion)
        anims = pg.evaluate("() => [...new Set([...document.querySelectorAll('.ms-spot.dance .ms-behind')].map(e => getComputedStyle(e).animationName))]")
        want = "msFadeHint" if cfg["reduced"] else "msDance"
        check(anims == [want], f"{tag}: dance party animation is {want} (got {anims})")
        if cfg["shots"]:
            shot("dance")

    ok_final = wait_final(pg, 15)
    check(ok_final, f"{tag}: the score screen appears")
    time.sleep(1.6)
    st = snap_state(pg)
    check(1 <= st["stars"] <= 3 and st["starsAll"] == 3, f"{tag}: score screen shows {st['stars']} star(s) of 3, score {st['score']}")
    final_anim = pg.evaluate("() => { const e = document.querySelector('.ms-fchick'); return e ? getComputedStyle(e).animationName : null; }")
    check(final_anim == ("none" if cfg["reduced"] else "msHop"), f"{tag}: score-screen chick animation is {final_anim}")
    if cfg["shots"]:
        shot("end")
    # in-game the game state must be stopped now (the loop is cancelled when the score screen opens)
    t = pg.evaluate("() => window.__snap().rafCalls"); time.sleep(0.8)
    t2 = pg.evaluate("() => window.__snap().rafCalls")
    check(t2 - t < 60, f"{tag}: with the score screen up only effects use animation frames ({t2 - t} in 0.8 s)")
    pg.evaluate("() => document.querySelector('.ms-go').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 3 }))")
    pg.evaluate("() => document.querySelector('.ms-go').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 3 }))")
    res = None
    for _ in range(40):
        res = pg.evaluate("() => window.__lastResult")
        if res: break
        time.sleep(0.1)
    check(bool(res) and isinstance(res.get("score"), int) and res.get("stars") in (1, 2, 3), f"{tag}: the returned Promise resolved with {json.dumps(res)}")
    check(not pg.evaluate("() => !!document.querySelector('.ms-root')"), f"{tag}: the game screen is removed")
    if kind == "run" and not cfg["seconds"]:
        check(res and res.get("targetsHit", 0) >= 1, f"{tag}: the called word's corn was caught at least once ({res.get('targetsHit') if res else None})")
    # let sounds and sparkles finish, then nothing of ours may still be running
    time.sleep(5.5)
    n = pg.evaluate("() => window.__snap()")
    b = base
    check(n["raf"] == 0, f"{tag}: no animation frame still scheduled after the game ({n['raf']})")
    r1 = pg.evaluate("() => window.__snap().rafCalls"); time.sleep(0.7); r2 = pg.evaluate("() => window.__snap().rafCalls")
    check(r2 == r1, f"{tag}: no animation-frame callbacks 0.7 s later ({r2 - r1})")
    check(n["iv"] == b["iv"], f"{tag}: no new intervals left (now {n['iv']}, before {b['iv']})")
    check(n["to"] == b["to"], f"{tag}: no timeouts left (now {n['to']}, before {b['to']})")
    leaked = {k: n["ls"].get(k, 0) - b["ls"].get(k, 0) for k in set(n["ls"]) | set(b["ls"]) if n["ls"].get(k, 0) != b["ls"].get(k, 0)}
    check(not leaked, f"{tag}: no window/document listeners leaked" + ("" if not leaked else f" -> extra: {leaked}"))
    st = snap_state(pg)
    check(st["scrollW"] <= st["iw"] + 1 and st["scrollH"] <= st["ih"] + 1, f"{tag}: no page scroll at the end")
    check(not errors, f"{tag}: no console errors" + ("" if not errors else " -> " + "; ".join(errors[:3])))
    check(not bad_audio, f"{tag}: every audio clip requested loaded" + ("" if not bad_audio else " -> " + ", ".join(bad_audio[:3])))
    # only words taught by the end of this world, and with clips
    allowed = pg.evaluate("""async w => { const m = await import('./js/milestone.js'); return (await m.checkedPool(w)).map(p => p.w); }""", cfg["world"] - 1)
    stray = {w for w in words_seen if w not in set(allowed) and w.lower() != "find"}
    check(not stray, f"{tag}: every word shown ({len(words_seen)}) is a taught word with a clip" + ("" if not stray else " -> stray " + ", ".join(sorted(stray))))
    played_w = {a[:-4][2:] for a in audio_seen if a.startswith("w_")}
    check(played_w <= set(allowed), f"{tag}: every word clip requested ({len(played_w)}) belongs to the pool")
    browser.close()


def word_lists(pw):
    browser = pw.chromium.launch()
    pg = browser.new_page()
    pg.goto(f"{BASE}/work/milestone_demo.html"); pg.wait_for_selector("#demo")
    out = pg.evaluate("""async () => {
      const m = await import('./js/milestone.js'); const d = await import('./js/data.js');
      const lessons = d.allLessons();
      const res = {};
      for (const wi of [0, 3, 6]) {
        let end = -1; lessons.forEach((l, i) => { if (l.wi === wi) end = i; });
        const taught = new Set(); lessons.slice(0, end + 1).forEach(l => d.parseWords(l.words).forEach(x => taught.add(x.w)));
        const pool = m.wordPool(wi), checked = await m.checkedPool(wi);
        const missing = [];
        for (const p of checked) { const r = await fetch('audio/w_' + p.w + '.mp3', { method: 'HEAD' }); if (!r.ok) missing.push(p.w); }
        const noclip = [];
        for (const p of pool) { if (!checked.some(c => c.w === p.w)) noclip.push(p.w); }
        for (const p of noclip) { const r = await fetch('audio/w_' + p + '.mp3', { method: 'HEAD' }); if (r.ok) missing.push('WRONGLY DROPPED ' + p); }
        res[wi] = { pool: pool.map(p => p.w), checked: checked.map(p => p.w), notTaught: pool.filter(p => !taught.has(p.w)).map(p => p.w), missing, noclip, pics: checked.filter(p => p.e).length,
                    laterWorld: pool.filter(p => p.world > wi).length };
      }
      return res; }""")
    browser.close()
    sizes = []
    for wi in ("0", "3", "6"):
        o = out[wi]
        check(not o["notTaught"], f"word list, world {int(wi) + 1}: only taught words ({len(o['pool'])} words, {len(o['checked'])} with clips, {o['pics']} with pictures)")
        check(not o["missing"], f"word list, world {int(wi) + 1}: every word kept has a clip" + ("" if not o["missing"] else " -> " + ", ".join(o["missing"][:5])))
        check(o["laterWorld"] == 0, f"word list, world {int(wi) + 1}: nothing from a later world")
        if o["noclip"]:
            print(f"     (skipped for no clip: {', '.join(o['noclip'])})")
        sizes.append(len(o["checked"]))
    check(sizes[0] < sizes[1] < sizes[2], f"word lists grow with the world number: {sizes}")
    a, b = set(out["0"]["checked"]), set(out["3"]["checked"])
    check(a < b and set(out["3"]["checked"]) < set(out["6"]["checked"]), "each world's list contains the one before")


CONFIGS = [
    dict(name="WebKit iPhone 375x667, world 1", engine="webkit", w=375, h=667, touch=True, mobile=True, reduced=False, world=1, seconds=0, shot="phone", shots=True),
    dict(name="WebKit iPad portrait 820x1180, world 4", engine="webkit", w=820, h=1180, touch=True, mobile=False, reduced=False, world=4, seconds=25, shot="ipad", shots=True),
    dict(name="WebKit iPad landscape 1180x820, world 7", engine="webkit", w=1180, h=820, touch=True, mobile=False, reduced=False, world=7, seconds=25, shot="ipadland", shots=True),
    dict(name="Chromium 375x667, world 7", engine="chromium", w=375, h=667, touch=True, mobile=True, reduced=False, world=7, seconds=25, shot="chromium", shots=False),
    dict(name="WebKit iPhone reduced motion, world 4", engine="webkit", w=375, h=667, touch=True, mobile=True, reduced=True, world=4, seconds=25, shot="reduced", shots=True),
]
if QUICK:
    CONFIGS = [dict(c, seconds=25 if c["seconds"] == 0 else c["seconds"]) for c in CONFIGS]
    CONFIGS = [CONFIGS[0], CONFIGS[3], CONFIGS[4]]

server = subprocess.Popen([sys.executable, "-I", "-m", "http.server", str(PORT), "--bind", "127.0.0.1", "--directory", str(ROOT)],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
try:
    time.sleep(1.5)
    with sync_playwright() as pw:
        if not NO_WORDS: word_lists(pw)
        for ci, cfg in enumerate(CONFIGS):
            if ONLY_CFG and ci not in ONLY_CFG: continue
            for kind in ONLY_KIND or ("run", "feed", "hide"):
                print(f"--- {cfg['name']} / {kind}", flush=True)
                try:
                    play(pw, cfg, kind)
                except Exception as e:  # a crash in the bot is a failure, but the other games still run
                    check(False, f"{cfg['name']} / {kind}: test crashed: {type(e).__name__}: {str(e)[:300]}")
finally:
    server.terminate()
    try:
        server.wait(5)
    except Exception:
        server.kill()

print(f"\n{passed} checks passed, {len(fails)} failed")
for f in fails:
    print("  FAIL:", f)
sys.exit(1 if fails else 0)
