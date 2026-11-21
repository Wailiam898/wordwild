"""Reduced motion: when the device asks for it, the big movements are calmed in CSS and in
JavaScript, and the game still plays. A normal (no preference) browser is the control, so
the test also proves the normal game still moves.

WebKit (the Safari engine), iPhone and iPad sizes. Every browser blocks *.supabase.co.

Usage: .venv/Scripts/python.exe -I tests/motion.py
"""
import sys, subprocess, time
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "app"
SHOTS = ROOT / "work" / "shots" / "motion"
SHOTS.mkdir(parents=True, exist_ok=True)
AUTO = (ROOT / "tests" / "autoplay.js").read_text(encoding="utf-8")
PORT = 5184
URL = f"http://localhost:{PORT}/"
fails = []


def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--directory", str(APP)],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                          creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))

# Animations that are allowed to run when motion is reduced: Pip's blink and mouth (tiny), the hold-to-open ring
# (it shows progress), the fade-in, and the tracing guide's own pulses are switched off separately.
ALLOWED = {"blink", "talk", "holdFill", "popIn", "dropIn", "comboPop", "shake", "bounce", "jump", "boing", "wiggle", "wave", "bump"}

# Lists the CSS animations currently running that move or spin something noticeably.
BIG_MOTION = """(allowed) => {
  const ident = v => v == null || ['none', 'normal', '1'].includes(String(v).trim()) || !/[1-9]/.test(String(v));
  const mild = v => { const s = String(v).trim(); if (ident(s)) return true; const m = s.match(/^scale\\(([\\d.]+)\\)$/); return !!m && Math.abs(+m[1] - 1) <= 0.1; };
  const out = [];
  for (const a of document.getAnimations()) {
    const name = a.animationName; if (!name || allowed.includes(name)) continue;
    let kfs = []; try { kfs = a.effect.getKeyframes(); } catch (e) {}
    const moving = kfs.some(k => !mild(k.transform) || !ident(k.translate) || !ident(k.rotate) || !(ident(k.scale) || Math.abs(parseFloat(k.scale) - 1) <= 0.1));
    if (moving) out.push(name);
  }
  return [...new Set(out)];
}"""

CALM_FX = """async () => {
  const ui = await import('./js/ui.js');
  const seen = [];
  const orig = HTMLElement.prototype.animate;
  HTMLElement.prototype.animate = function (frames, opts) { seen.push({ frames, opts }); return orig.call(this, frames, opts); };
  const el = document.createElement('div'); document.body.append(el);
  const names = ['shake', 'bounce', 'jump', 'boing', 'wiggle', 'wave', 'bump', 'combo-pop', 'drop-in'];
  for (const n of names) ui.anim(el, n, 900);
  HTMLElement.prototype.animate = orig;
  el.remove();
  const big = (f) => Object.keys(f).some(k => /translate|rotate/i.test(k) || (k === 'transform' && /translate|rotate|skew/.test(f[k]) || (k === 'transform' && /scale\\(([\\d.]+)/.test(f[k]) && Math.abs(parseFloat(f[k].match(/scale\\(([\\d.]+)/)[1]) - 1) > 0.1)));
  return { n: seen.length, big: seen.filter(s => s.frames.some(big)).length, iter: Math.max(...seen.map(s => s.opts.iterations || 1)) };
}"""

PARTICLES = """async () => {
  const ui = await import('./js/ui.js');
  ui.clearFx();
  ui.confetti(140);
  ui.burst(200, 300, 60);
  await new Promise(r => setTimeout(r, 300));
  const c = document.querySelector('canvas.fx');
  if (!c) return { pixels: 0 };
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++;
  ui.clearFx();
  return { pixels: n };
}"""

GEMS = """async () => {
  const ui = await import('./js/ui.js');
  const from = document.createElement('div'); from.style.cssText = 'position:fixed;left:50px;top:300px;width:20px;height:20px'; document.body.append(from);
  ui.flyGems(from, 3);
  const n = document.querySelectorAll('.fly-gem').length;
  from.remove(); document.querySelectorAll('.fly-gem').forEach(g => g.remove());
  return n;
}"""

CSS_PROBE = """async () => {
  const app = document.getElementById('app');
  app.className = 'screen-lesson theme-farm';
  app.innerHTML = '<div class="lesson"><div class="stage">' +
    '<div class="hop-chick placed fly" id="rk" style="translate: 80px -40px"></div>' +
    '<div class="mem-card up" id="mc"><div class="mem-back"></div><div class="mem-face"></div></div>' +
    '<div class="knob ready" id="kn"></div><div class="node current" id="nd"></div>' +
    '<div class="bubble popped" id="bb"></div><div class="sw hl" id="sw"></div></div></div>';
  await new Promise(r => setTimeout(r, 1300));
  const cs = id => getComputedStyle(document.getElementById(id));
  const face = getComputedStyle(document.querySelector('#mc .mem-face')), back = getComputedStyle(document.querySelector('#mc .mem-back'));
  return { chickTransform: cs('rk').transform, chickOpacity: cs('rk').opacity, faceTransform: face.transform, faceOpacity: face.opacity, backOpacity: back.opacity,
    knobAnim: cs('kn').animationName, nodeAnim: cs('nd').animationName, bubbleScale: cs('bb').scale, swTransform: cs('sw').transform };
}"""

BUBBLES = """async () => {
  const app = document.getElementById('app');
  app.className = 'screen-lesson theme-farm';
  app.innerHTML = '<div class="lesson"><div class="topbar"></div><div class="stage step-pop"></div></div>';
  const G = { stage: app.querySelector('.stage'), known: { g: new Set(['s', 'a', 't', 'p']) }, gem() {}, setReplay() {} };
  const run = window.__ww.games.soundPop(G, ['s', 's', 's', 's', 's', 's']);
  await new Promise(r => setTimeout(r, 1500));
  await new Promise(r => setTimeout(r, 2500));
  const ys = () => new Map([...document.querySelectorAll('.pop-field .bubble')].map(b => { const m = b.style.transform.match(/translate\\(([-\\d.]+)px, ([-\\d.]+)px\\)/); return [b, m ? +m[2] : null]; }));
  const a = ys(), t0 = performance.now();
  await new Promise(r => setTimeout(r, 1000));
  const b2 = ys(), dt = (performance.now() - t0) / 1000;
  const sp = [...a].filter(([el, y]) => b2.has(el) && y != null && b2.get(el) != null).map(([el, y]) => (y - b2.get(el)) / dt);
  G.onExit && G.onExit();
  return sp.length ? sp.reduce((x, y) => x + y, 0) / sp.length : null;
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


results = {}
try:
    with sync_playwright() as p:
        for dev in ("iPhone 13", "iPad (gen 7)"):
            tag = dev.split()[0].lower()
            for mode in ("normal", "reduced"):
                b = p.webkit.launch()
                opts = dict(p.devices[dev])
                if mode == "reduced":
                    opts["reduced_motion"] = "reduce"
                ctx = b.new_context(**opts)
                page = ctx.new_page()
                errors = []
                page.on("pageerror", lambda e: errors.append(str(e)))
                page.on("console", lambda m: m.type == "error" and "ERR_FAILED" not in m.text and errors.append(m.text))
                page.route("**/*.supabase.co/**", lambda route: route.abort())
                page.goto(URL)
                page.wait_for_timeout(900)
                print(f"--- {dev}, {mode}")
                R = {}
                want = mode == "reduced"
                check(page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches") is want, f"the browser reports prefers-reduced-motion: {'reduce' if want else 'no-preference'}")
                check(page.evaluate("import('./js/ui.js').then(m => m.calm())") is want, "calm() agrees")
                # CSS on the title screen
                R["title"] = page.evaluate(BIG_MOTION, sorted(ALLOWED))
                page.screenshot(path=str(SHOTS / f"{tag}-{mode}-title.png"))
                # JS effects
                R["fx"] = page.evaluate(CALM_FX)
                R["particles"] = page.evaluate(PARTICLES)["pixels"]
                R["gems"] = page.evaluate(GEMS)
                sign_in(page)
                R["map"] = page.evaluate(BIG_MOTION, sorted(ALLOWED))
                page.screenshot(path=str(SHOTS / f"{tag}-{mode}-map.png"))
                R["css"] = page.evaluate(CSS_PROBE)
                R["bubble_speed"] = page.evaluate(BUBBLES)
                if want:
                    check(not R["title"], f"title screen: no big looping motion {R['title']}")
                    check(not R["map"], f"map: no big looping motion {R['map']}")
                    check(R["fx"]["big"] == 0 and R["fx"]["iter"] == 1, f"shake/bounce/jump/boing/wiggle/wave/bump become fades or tiny swells ({R['fx']})")
                    check(R["gems"] == 0, "gems do not fly across the screen")
                    css = R["css"]
                    check(css["chickTransform"] == "none" and float(css["chickOpacity"]) < 0.05, f"Pip fades over to the picture instead of hopping and flying {css['chickTransform']} / {css['chickOpacity']}")
                    check(css["faceTransform"] == "none" and css["faceOpacity"] == "1" and css["backOpacity"] == "0", "memory cards cross-fade instead of flipping")
                    check(css["knobAnim"] == "none" and css["nodeAnim"] == "none", "the slide knob and the glowing egg stop pulsing (they keep a steady glow)")
                    check(css["swTransform"] == "none", "the story word highlight does not jump")
                else:
                    check(len(R["title"]) >= 2, f"title screen still moves in normal mode {R['title']}")
                    check(R["fx"]["big"] > 0, f"normal mode keeps its bounces and shakes ({R['fx']})")
                    check(R["gems"] == 3, "normal mode still flies gems")
                    css = R["css"]
                    check(css["chickTransform"] != "none", "normal mode: Pip still flaps over to the picture")
                    check(css["faceTransform"] != "none" and css["knobAnim"] != "none", "normal mode: cards still flip, knob still nudges")
                results[(tag, mode)] = R
                # play a lesson to the end
                page.evaluate("localStorage.clear()")
                page.goto(URL)
                sign_in(page)
                page.evaluate(AUTO)
                page.evaluate("startAuto(600)")
                t0 = time.time()
                done = False
                while time.time() - t0 < 420:
                    page.wait_for_timeout(700)
                    if page.evaluate("log.includes('lesson done')"):
                        done = True
                        break
                page.screenshot(path=str(SHOTS / f"{tag}-{mode}-reward.png"))
                check(done, f"{dev} {mode}: Lesson 1 can be played to the end ({round(time.time() - t0)}s)")
                check(not errors, f"{dev} {mode}: no page errors {errors[:3] or ''}")
                ctx.close(); b.close()
        # Particles and bubble speed compare the two modes
        for tag in ("iphone", "ipad"):
            n, r = results[(tag, "normal")], results[(tag, "reduced")]
            check(r["particles"] < n["particles"] * 0.4, f"{tag}: confetti and bursts are far smaller when reduced ({r['particles']} vs {n['particles']} pixels)")
            if n["bubble_speed"] and r["bubble_speed"]:
                check(r["bubble_speed"] < n["bubble_speed"] * 0.85, f"{tag}: bubbles drift more slowly when reduced ({r['bubble_speed']:.0f} vs {n['bubble_speed']:.0f} px/s)")
            else:
                check(False, f"{tag}: could not measure the bubble speed {n['bubble_speed']} {r['bubble_speed']}")
finally:
    server.terminate()

print()
print("FAILED: " + "; ".join(fails) if fails else "ALL PASSED")
sys.exit(1 if fails else 0)
