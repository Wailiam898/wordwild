// Letter tracing: the child draws each letter of a new sound with a finger.
//
// Every letter has stroke data in the print style taught in Australian schools: where
// each stroke starts, which way it goes, and the order of the strokes (see LETTERS).
// The letter is drawn large in Andika (the same shapes as the tiles) with a green
// start dot and a yellow guide ball that shows the way. The child follows with a finger
// (pointer events: touch, mouse and pencil all work; the page cannot scroll meanwhile).
//
// It is forgiving on purpose: the finger only has to stay roughly near the line, and
// after two failed tries the stroke is drawn for the child and the lesson moves on.
// Nothing in here can block a lesson: every stroke also times out into a demonstration,
// and a skip button is always on screen.
import { h, onTap, sleep, burstAt } from './ui.js';
import { say, sfx } from './audio.js';
import * as store from './store.js';

// ---------------------------------------------------------------- Stroke data
// Drawing space: one letter is 100 units tall on a baseline at y = 90. The x-height
// line is y = 39 (stroke centres run at 45), the tall letters reach y = 11 and the
// tails reach y = 114. x grows to the right from the letter's own left edge.
// A stroke is a list of [x, y] points, or { dot: [x, y] } for the dot on i and j.
const MID = 64.5, RY = 19.5; // middle and half-height of the centre-line of round letters
const rad = a => a * Math.PI / 180;
// A piece of ellipse. Angles run anticlockwise as seen on screen from 3 o'clock, so
// 0 = right, 90 = top, 180 = left, 270 = bottom. a1 < a0 goes clockwise.
const arc = (cx, cy, rx, ry, a0, a1) => {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 6));
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = rad(a0 + (a1 - a0) * i / n);
    return [cx + rx * Math.cos(a), cy - ry * Math.sin(a)];
  });
};
// Join pieces into one stroke, dropping repeated points where pieces meet.
const P = (...parts) => {
  const out = [];
  for (const part of parts) for (const pt of part) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last[0] - pt[0]) > 0.05 || Math.abs(last[1] - pt[1]) > 0.05) out.push(pt);
  }
  return out;
};
const stem = (x, y0, y1) => [[x, y0], [x, y1]];
// The round part of a, d, g, o, q: starts at 1 o'clock and goes anticlockwise all the way round.
const bowl = (left, right) => arc((left + right) / 2, MID, (right - left) / 2, RY, 60, 420);
// The round part of b and p: up the stem, then over and round clockwise.
const bump = (left, right) => P(stem(left, 84, MID), arc((left + right) / 2, MID, (right - left) / 2, RY, 180, -145));
// The arch of h, n, m: starts on the stem, up and over, then down.
const arch = (left, right, top = 62) => P([[left, top]], arc((left + right) / 2, top, (right - left) / 2, 17, 180, 0), stem(right, top, 88));

export const LETTERS = {
  a: { w: 61, strokes: [bowl(10, 52.5), stem(52.5, 44, 88)] },
  b: { w: 59, up: 1, strokes: [stem(11, 17, 88), bump(11, 50.5)] },
  c: { w: 50, strokes: [arc(28, MID, 18, RY, 50, 310)] },
  d: { w: 62, up: 1, strokes: [bowl(10, 53.5), stem(53.5, 17, 88)] },
  e: { w: 54, strokes: [P([[10, MID], [44, MID]], arc(27, MID, 17, RY, 0, 320))] },
  f: { w: 39, up: 1, strokes: [P(arc(29, 24, 12, 12, 60, 180), stem(17, 24, 88)), [[3, 45], [33, 45]]] },
  g: { w: 58, down: 1, strokes: [bowl(10, 47.5), P(stem(47.5, 44, 92), arc(31.5, 92, 16, 16, 0, -140))] },
  h: { w: 60, up: 1, strokes: [stem(11, 17, 88), arch(11, 49.5)] },
  i: { w: 31, up: 1, strokes: [stem(15.5, 44, 88), { dot: [15.5, 20] }] },
  j: { w: 33, lead: 10, up: 1, down: 1, strokes: [P(stem(20, 44, 92), arc(5, 92, 15, 15, 0, -135)), { dot: [20, 20] }] },
  k: { w: 56, up: 1, strokes: [stem(11, 17, 88), [[51, 44], [14, 66], [52, 88]]] },
  l: { w: 31, up: 1, strokes: [stem(15.5, 17, 88)] },
  m: { w: 86, strokes: [stem(11, 44, 88), arch(11, 43), arch(43, 74.5)] },
  n: { w: 61, strokes: [stem(10, 44, 88), arch(10, 49.5)] },
  o: { w: 57, strokes: [bowl(10, 47.5)] },
  p: { w: 60, down: 1, strokes: [stem(10, 44, 108), bump(10, 51.5)] },
  q: { w: 59, down: 1, strokes: [bowl(10, 48.5), stem(48.5, 44, 108)] },
  r: { w: 49, strokes: [stem(10, 44, 88), P([[10, 62]], arc(28, 62, 18, 17, 180, 40))] },
  s: { w: 51, strokes: [P(arc(26, 54.5, 15.5, 9.5, 40, 270), arc(26, 74.5, 15.5, 9.5, 90, -140))] },
  t: { w: 43, up: 1, strokes: [P(stem(16, 25, 76), arc(28, 76, 12, 8, 180, 300)), [[3, 45], [38, 45]]] },
  u: { w: 61, strokes: [P(stem(11, 44, 62), arc(31.25, 62, 20.25, 22, 180, 360), stem(51.5, 62, 44)), stem(51.5, 44, 88)] },
  v: { w: 54, strokes: [[[5, 44], [27, 86], [49, 44]]] },
  w: { w: 77, strokes: [[[5, 44], [21, 86], [38.5, 48], [56, 86], [72, 44]]] },
  x: { w: 58, strokes: [[[6, 44], [51, 86]], [[51, 44], [6, 86]]] },
  y: { w: 54, lead: 1, down: 1, strokes: [[[5, 44], [27, 86]], [[49, 44], [10, 110]]] },
  z: { w: 52, strokes: [[[8, 44], [44, 44], [8, 85], [44, 85]]] },
};

// 'sh' -> s, h. 'igh' -> i, g, h. Split vowels 'a_e' -> a, e. 'y2' -> y.
export const lettersOf = g => [...g.replace(/\d+$/, '').replace(/_/g, '')];

const NS = 'http://www.w3.org/2000/svg';
const num = v => (Math.round(v * 10) / 10).toString();
const pathD = pts => pts.map((p, i) => (i ? 'L' : 'M') + num(p[0]) + ' ' + num(p[1])).join(' ');

// Lay the letters out side by side. Returns the SVG markup pieces and the drawing box.
export function layout(letters) {
  let x = 0, up = false, down = false;
  const items = letters.map(ch => {
    const L = LETTERS[ch];
    const at = x + (L.lead || 0);
    x = at + L.w + 4;
    up = up || !!L.up; down = down || !!L.down;
    return { ch, L, at };
  });
  const top = up ? 4 : 28, bottom = down ? 122 : 100;
  return { items, box: [-12, top, x - 4 + 24, bottom - top] };
}

// ---------------------------------------------------------------- The activity
const STEP = 1.5;      // spacing of the points sampled along a stroke (drawing units)
const START_TOL = 30;  // how near the start dot a touch must begin
const TOL = 27;        // how far the finger may stray from the line
const LOOK = 80;       // how far ahead along the line the finger may jump (units)
const OFF_MS = 1500;   // wandering this long off the line counts as a failed try
const IDLE_MS = 7000;  // no touch for this long: show the stroke again
const END_GAP = 9;     // finished when the ink is this near the end of the stroke

// Trace every letter of grapheme g, then say its sound. Resolves when finished or skipped.
export function run(G, g) {
  const st = G.stage;
  const letters = lettersOf(g);
  const { items, box } = layout(letters);
  st.innerHTML = '';

  // ---- Build the scene
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'trace-svg');
  svg.setAttribute('viewBox', box.join(' '));
  svg.setAttribute('aria-label', 'Trace the letter with your finger');
  const pieces = [];
  items.forEach((it, li) => {
    pieces.push(`<g class="tr-letter" data-i="${li}" transform="translate(${num(it.at)} 0)">`);
    pieces.push(`<text class="tr-ghost" x="0" y="90" font-size="100">${it.ch}</text>`);
    it.L.strokes.forEach((s, si) => {
      if (s.dot) pieces.push(`<circle class="tr-guide tr-dotspot" data-s="${si}" cx="${s.dot[0]}" cy="${s.dot[1]}" r="6"/>`,
        `<circle class="tr-ink tr-dot" data-s="${si}" cx="${s.dot[0]}" cy="${s.dot[1]}" r="0"/>`);
      else pieces.push(`<path class="tr-guide" data-s="${si}" d="${pathD(s)}"/>`, `<path class="tr-ink" data-s="${si}" d="${pathD(s)}"/>`);
    });
    pieces.push('</g>');
  });
  pieces.push('<g class="tr-marks"></g>',
    '<g class="tr-start"><circle class="tr-ring" r="10"/><circle class="tr-startdot" r="7.5"/><text class="tr-num" dy="3.6"></text></g>',
    '<g class="tr-ball" opacity="0"><circle r="8.5"/></g>');
  svg.innerHTML = pieces.join('');
  const skip = h('button', { class: 'btn round trace-skip', 'aria-label': 'Skip tracing' }, '⏭');
  const card = h('div', { class: 'trace-card' }, svg);
  st.append(h('div', { class: 'trace' }, card, skip));

  const startG = svg.querySelector('.tr-start'), ball = svg.querySelector('.tr-ball');
  const numEl = svg.querySelector('.tr-num'), marks = svg.querySelector('.tr-marks');

  // ---- State
  let li = -1, si = -1;        // current letter and stroke
  let cur = null;               // the current stroke: { guide, ink, pts, total, dot, off }
  let prog = 0;                 // index into cur.pts the ink has reached
  let fails = 0, idleShows = 0; // for the current stroke
  let helped = false, finished = false, busy = false, active = null, lastOn = 0;
  let idleTimer = 0, raf = 0, stopDemo = null;
  let done;
  const result = new Promise(r => (done = r));

  const letterEl = i => svg.querySelector(`.tr-letter[data-i="${i}"]`);
  const toLocal = e => {
    const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const m = svg.getScreenCTM();
    const q = m ? p.matrixTransform(m.inverse()) : p;
    const it = items[li];
    return { x: q.x - it.at, y: q.y };
  };
  const dist = (a, b) => Math.hypot(a.x - b[0], a.y - b[1]);

  function cleanup() {
    finished = true;
    clearTimeout(idleTimer); cancelAnimationFrame(raf);
    if (stopDemo) stopDemo();
  }
  G.onExit = cleanup;

  // ---- Showing progress
  const place = (el, x, y) => el.setAttribute('transform', `translate(${num(x + items[li].at)} ${num(y)})`);
  function showInk() {
    if (cur.dot) return;
    const len = Math.min(cur.total, prog * STEP);
    cur.ink.style.strokeDasharray = `${len} ${cur.total + 10}`;
  }
  function moveBall(i) {
    const pt = cur.pts[Math.max(0, Math.min(cur.pts.length - 1, i))];
    place(ball, pt[0], pt[1]);
  }
  function resetInk() {
    prog = 0;
    if (!cur.dot) cur.ink.style.strokeDasharray = `0 ${cur.total + 10}`;
    moveBall(0);
  }

  // Sample a stroke into points the finger can be matched against.
  function sample(guide, dot) {
    if (dot) return { guide, ink: guide.nextElementSibling, pts: [dot], total: 0, dot };
    const total = guide.getTotalLength();
    const n = Math.max(2, Math.ceil(total / STEP));
    const pts = [];
    for (let k = 0; k <= n; k++) { const p = guide.getPointAtLength(Math.min(total, k * total / n)); pts.push([p.x, p.y]); }
    return { guide, ink: guide.nextElementSibling, pts, total, dot: null };
  }

  // Markers for the stroke order, and the start dot of the current stroke.
  function drawMarks() {
    marks.innerHTML = '';
    const it = items[li], n = it.L.strokes.length;
    svg.querySelectorAll('.tr-guide').forEach(el => el.classList.remove('cur'));
    if (cur) cur.guide.classList.add('cur');
    if (n > 1) it.L.strokes.forEach((s, k) => {
      if (k <= si) return;
      const p = s.dot || s[0];
      const m = document.createElementNS(NS, 'g');
      m.setAttribute('transform', `translate(${num(p[0] + it.at)} ${num(p[1])})`);
      m.innerHTML = `<circle class="tr-later" r="7"/><text class="tr-num small" dy="2.8">${k + 1}</text>`;
      marks.append(m);
    });
    const p = cur.dot || cur.pts[0];
    place(startG, p[0], p[1]);
    startG.classList.toggle('is-dot', !!cur.dot);
    numEl.textContent = n > 1 ? String(si + 1) : '';
    startG.setAttribute('opacity', 1);
  }

  // ---- Demonstration: the guide ball travels along the stroke (optionally drawing it).
  function demo(withInk) {
    if (stopDemo) stopDemo();
    if (cur.dot) {
      ball.setAttribute('opacity', 1); moveBall(0);
      const t = setTimeout(() => ball.setAttribute('opacity', 0), 900);
      stopDemo = () => { clearTimeout(t); ball.setAttribute('opacity', 0); stopDemo = null; };
      return sleep(900);
    }
    return new Promise(resolve => {
      const dur = Math.min(2400, 800 + cur.total * 11);
      const t0 = performance.now();
      ball.setAttribute('opacity', 1);
      const stop = () => { cancelAnimationFrame(raf); stopDemo = null; if (!finished) ball.setAttribute('opacity', active == null ? 0 : 1); resolve(); };
      stopDemo = stop;
      const tick = now => {
        if (finished) return stop();
        const k = Math.min(1, (now - t0) / dur);
        const i = Math.round(k * (cur.pts.length - 1));
        moveBall(i);
        if (withInk) { prog = i; showInk(); }
        if (k < 1) raf = requestAnimationFrame(tick); else { stopDemo = null; resolve(); }
      };
      raf = requestAnimationFrame(tick);
    }).then(() => { if (!finished && !withInk && active == null) ball.setAttribute('opacity', 0); });
  }

  // ---- Stroke flow
  function armIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(async () => {
      if (finished || busy || active != null) return armIdle();
      idleShows++;
      if (idleShows > 3) { helped = true; return completeStroke(true); }
      await demo(false);
      armIdle();
    }, IDLE_MS);
  }

  async function beginStroke() {
    const L = items[li].L;
    cur = sample(svg.querySelector(`.tr-letter[data-i="${li}"] .tr-guide[data-s="${si}"]`), L.strokes[si].dot);
    fails = 0; idleShows = 0; active = null;
    resetInk();
    cur.ink.classList.add('on');
    drawMarks();
    ball.setAttribute('opacity', 0);
    busy = true;
    await sleep(350);
    if (finished) return;
    busy = false;
    armIdle();
    await demo(false);
  }

  async function completeStroke(auto) {
    if (busy && !auto || finished) return;
    busy = true; active = null;
    clearTimeout(idleTimer);
    if (stopDemo) stopDemo();
    if (cur.dot) cur.ink.setAttribute('r', 7);
    else { prog = cur.pts.length - 1; showInk(); }
    cur.ink.classList.add('done');
    ball.setAttribute('opacity', 0);
    sfx('pop');
    const L = items[li].L;
    if (si + 1 < L.strokes.length) { si++; await sleep(250); if (!finished) beginStroke(); return; }
    // The letter is finished.
    letterEl(li).classList.add('done');
    svg.querySelectorAll(`.tr-letter[data-i="${li}"] .tr-ink`).forEach(el => el.classList.add('done'));
    startG.setAttribute('opacity', 0); marks.innerHTML = '';
    sfx('sparkle');
    if (li + 1 < items.length) {
      await sleep(350);
      if (finished) return;
      say('n_trace_next');
      await sleep(900);
      if (finished) return;
      li++; si = 0; beginStroke();
      return;
    }
    // Every letter done: celebrate and say the sound.
    await sleep(250);
    if (finished) return;
    burstAt(svg, 28);
    store.recordTrace(g, !helped);
    cleanupInput();
    await sleep(200);
    sfx('good');
    await say('p_' + g);
    await sleep(500);
    cleanup();
    done({ traced: true, helped });
  }

  async function failTry() {
    fails++;
    active = null;
    resetInk();
    if (fails >= 2) {
      // Two tries: draw it for them and carry on.
      busy = true; helped = true;
      clearTimeout(idleTimer);
      say('n_trace_watch');
      await sleep(900);
      if (finished) return;
      ball.setAttribute('opacity', 1);
      await demo(true);
      if (finished) return;
      busy = false;
      completeStroke(true);
      return;
    }
    sfx('tap');
    say('n_trace_again');
    armIdle();
  }

  // ---- The finger
  const advance = p => {
    const lo = Math.max(0, prog - 4), hi = Math.min(cur.pts.length - 1, prog + Math.ceil(LOOK / STEP));
    let best = -1, bd = 1e9;
    for (let k = lo; k <= hi; k++) {
      const d = Math.hypot(p.x - cur.pts[k][0], p.y - cur.pts[k][1]);
      if (d < bd) { bd = d; best = k; }
    }
    const now = performance.now();
    if (bd <= TOL) {
      lastOn = now;
      if (best > prog) { prog = best; showInk(); moveBall(prog); }
      if (prog >= cur.pts.length - 1 - Math.ceil(END_GAP / STEP)) return completeStroke();
    } else if (now - lastOn > OFF_MS) {
      failTry();
    }
  };

  const onDown = e => {
    if (finished || e.button > 0) return;
    e.preventDefault();
    if (busy || active != null || !cur) return;
    const p = toLocal(e);
    if (cur.dot) {
      if (dist(p, cur.dot) <= START_TOL) { active = e.pointerId; completeStroke(); }
      else startG.classList.add('nudge'), setTimeout(() => startG.classList.remove('nudge'), 600);
      return;
    }
    // The touch must begin near the start dot, so the stroke goes the right way.
    let best = -1, bd = 1e9;
    const lim = Math.min(cur.pts.length - 1, Math.ceil(cur.pts.length * 0.15));
    for (let k = 0; k <= lim; k++) {
      const d = Math.hypot(p.x - cur.pts[k][0], p.y - cur.pts[k][1]);
      if (d < bd) { bd = d; best = k; }
    }
    if (bd > START_TOL) {
      startG.classList.add('nudge'); setTimeout(() => startG.classList.remove('nudge'), 600);
      return;
    }
    active = e.pointerId;
    try { svg.setPointerCapture(e.pointerId); } catch (err) {}
    if (stopDemo) stopDemo();
    clearTimeout(idleTimer);
    idleShows = 0;
    prog = Math.max(0, best); lastOn = performance.now();
    ball.setAttribute('opacity', 1); moveBall(prog); showInk();
  };
  const onMove = e => {
    if (finished || e.pointerId !== active || busy) return;
    e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const ev of (evs.length ? evs : [e])) { if (busy || active == null) break; advance(toLocal(ev)); }
  };
  const onUp = e => {
    if (e.pointerId !== active) return;
    active = null;
    try { svg.releasePointerCapture(e.pointerId); } catch (err) {}
    if (finished || busy) return;
    // A tiny touch is not a try; a real attempt that stopped short is.
    if (prog > cur.pts.length * 0.05) failTry();
    else { resetInk(); ball.setAttribute('opacity', 0); armIdle(); }
  };
  svg.addEventListener('pointerdown', onDown);
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerup', onUp);
  svg.addEventListener('pointercancel', onUp);
  // Keep the page still while a finger is on the letter (older iOS ignores touch-action on SVG).
  ['touchstart', 'touchmove'].forEach(t => svg.addEventListener(t, e => e.preventDefault(), { passive: false }));
  svg.addEventListener('contextmenu', e => e.preventDefault());
  function cleanupInput() { active = null; busy = true; }

  onTap(skip, () => { if (finished) return; sfx('tap'); cleanup(); done({ traced: false, skipped: true }); });
  G.setReplay(async () => {
    if (finished || busy || active != null || !cur) return;
    say('n_trace_go');
    await demo(false);
  });

  // ---- Go
  (async () => {
    await sleep(300);
    if (finished) return;
    say('n_trace_go');
    li = 0; si = 0;
    await beginStroke();
  })();
  return result;
}
