// DOM helpers, particles and shared feedback.
import { say, sfx } from './audio.js';
import { PRAISE, OOPS } from './data.js';

export const sleep = ms => new Promise(r => setTimeout(r, ms));

// Entry animations run once; drop the class so later effects don't replay them.
document.addEventListener('animationend', e => {
  if (e.animationName === 'popIn') e.target.classList.remove('pop-in');
});

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(kid));
  }
  return el;
}

// Fast, reliable taps on touch screens (fires on pointerup inside the element).
export function onTap(el, fn) {
  let down = false;
  el.addEventListener('pointerdown', e => { down = true; el.classList.add('pressed'); });
  el.addEventListener('pointerleave', () => { down = false; el.classList.remove('pressed'); });
  el.addEventListener('pointercancel', () => { down = false; el.classList.remove('pressed'); });
  el.addEventListener('pointerup', e => {
    el.classList.remove('pressed');
    if (!down) return;
    down = false;
    fn(e);
  });
  return el;
}

export const shuffle = a => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
};
export const pick = a => a[Math.floor(Math.random() * a.length)];

// One-shot effects via Web Animations, so they layer over (not replace) CSS animations.
const FX = {
  shake: [[{ transform: 'translateX(0)' }, { transform: 'translateX(-12px) rotate(-3deg)' }, { transform: 'translateX(10px) rotate(3deg)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }], 450],
  bounce: [[{ transform: 'none' }, { transform: 'translateY(-28px) scale(1.06,.95)' }, { transform: 'scale(1.08,.9)' }, { transform: 'translateY(-10px)' }, { transform: 'none' }], 700],
  jump: [[{ transform: 'none' }, { transform: 'translateY(6px) scale(1.12,.86)', offset: .15 }, { transform: 'translateY(-46px) scale(.92,1.1)', offset: .45 }, { transform: 'scale(1.1,.9)', offset: .75 }, { transform: 'none' }], 700],
  boing: [[{ transform: 'none' }, { transform: 'scale(1.18,.85)', offset: .4 }, { transform: 'scale(.94,1.08)', offset: .7 }, { transform: 'none' }], 400],
  wiggle: [[{ transform: 'none' }, { transform: 'rotate(-8deg) scale(1.05)' }, { transform: 'rotate(8deg) scale(1.05)' }, { transform: 'none' }], 500],
  bump: [[{ transform: 'none' }, { transform: 'scale(1.3)' }, { transform: 'none' }], 300],
  wave: [[{ transform: 'none' }, { transform: 'translateY(-16px)' }, { transform: 'none' }], 500],
  glow: [[{ filter: 'drop-shadow(0 0 0 rgba(255,230,80,0))' }, { filter: 'drop-shadow(0 0 26px rgba(255,230,80,1))' }, { filter: 'drop-shadow(0 0 0 rgba(255,230,80,0))' }], 900],
  'combo-pop': [[{ transform: 'scale(.2) rotate(-20deg)', opacity: 0 }, { transform: 'scale(1.4) rotate(6deg)', opacity: 1, offset: .4 }, { transform: 'none', opacity: 1 }], 700],
  'drop-in': [[{ transform: 'translateY(-60px) scale(.6)', opacity: 0 }, { transform: 'translateY(6px) scale(1.05)', opacity: 1, offset: .7 }, { transform: 'none', opacity: 1 }], 400],
};
export function anim(el, name, ms) {
  if (!el || !FX[name]) return;
  const [frames, dur] = FX[name];
  const iterations = ms && ms > dur ? Math.round(ms / dur) : 1;
  el.animate(frames, { duration: dur, iterations, easing: 'ease-out', composite: 'replace' });
}

let lastPraise = '';
export function praise(extra = []) {
  sfx('good');
  let p;
  do { p = pick(PRAISE); } while (p === lastPraise);
  lastPraise = p;
  return say('n_' + p, ...extra);
}
export function oops(extra = []) {
  sfx('bad');
  return say('n_' + pick(OOPS), ...extra);
}

// ---------- Particles ----------
let canvas, cx, parts = [], raf = 0;
function ensureCanvas() {
  if (canvas) return;
  canvas = h('canvas', { class: 'fx' });
  document.body.append(canvas);
  const fit = () => {
    const d = window.devicePixelRatio || 1;
    canvas.width = innerWidth * d; canvas.height = innerHeight * d;
    cx = canvas.getContext('2d'); cx.setTransform(d, 0, 0, d, 0, 0);
  };
  fit(); addEventListener('resize', fit);
}
function loop() {
  cx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter(p => p.life > 0);
  for (const p of parts) {
    p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.rot += p.vr; p.life -= 1;
    cx.save();
    cx.globalAlpha = Math.min(1, p.life / 25);
    cx.translate(p.x, p.y); cx.rotate(p.rot);
    if (p.kind === 'star') {
      cx.fillStyle = p.c; cx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? p.s * 0.45 : p.s;
        cx.lineTo(Math.cos(i * Math.PI / 5) * r, Math.sin(i * Math.PI / 5) * r);
      }
      cx.fill();
    } else if (p.kind === 'circle') {
      cx.fillStyle = p.c; cx.beginPath(); cx.arc(0, 0, p.s, 0, Math.PI * 2); cx.fill();
    } else {
      cx.fillStyle = p.c; cx.fillRect(-p.s, -p.s * 0.5, p.s * 2, p.s);
    }
    cx.restore();
  }
  raf = parts.length ? requestAnimationFrame(loop) : 0;
}
const COLORS = ['#ff5d73', '#ffd23f', '#34d17a', '#3fb8ff', '#a28bff', '#ff9a3d', '#ffffff'];

export function clearFx() { parts = []; if (cx) cx.clearRect(0, 0, innerWidth, innerHeight); }

export function burst(x, y, n = 24, kind = 'star', spread = 9) {
  ensureCanvas();
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = Math.random() * spread + 3;
    parts.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3, g: 0.28,
      s: Math.random() * 8 + 5, c: pick(COLORS), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
      life: 50 + Math.random() * 30, kind,
    });
  }
  if (!raf) raf = requestAnimationFrame(loop);
}
export function burstAt(el, n, kind) {
  const r = el.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, n, kind);
}
export function confetti(n = 140) {
  ensureCanvas();
  for (let i = 0; i < n; i++) {
    parts.push({
      x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * 0.5,
      vx: (Math.random() - 0.5) * 3, vy: Math.random() * 3 + 2, g: 0.05,
      s: Math.random() * 6 + 4, c: pick(COLORS), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
      life: 160 + Math.random() * 80, kind: Math.random() < 0.3 ? 'star' : 'rect',
    });
  }
  if (!raf) raf = requestAnimationFrame(loop);
}

// Gems fly from an element to the gem counter.
export function flyGems(fromEl, n = 1) {
  const target = document.querySelector('.gem-pill');
  const r = fromEl.getBoundingClientRect();
  const tr = target ? target.getBoundingClientRect() : { left: innerWidth - 60, top: 20, width: 40, height: 40 };
  for (let i = 0; i < Math.min(n, 8); i++) {
    const g = h('div', { class: 'fly-gem' }, '💎');
    g.style.left = r.left + r.width / 2 + 'px';
    g.style.top = r.top + r.height / 2 + 'px';
    document.body.append(g);
    const dx = tr.left + tr.width / 2 - (r.left + r.width / 2);
    const dy = tr.top + tr.height / 2 - (r.top + r.height / 2);
    g.animate([
      { transform: 'translate(-50%,-50%) scale(.4)' },
      { transform: `translate(calc(-50% + ${dx * 0.3 + (Math.random() - 0.5) * 120}px), calc(-50% + ${dy * 0.3 - 80}px)) scale(1.3)`, offset: 0.4 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.6)` },
    ], { duration: 900 + i * 90, easing: 'cubic-bezier(.5,0,.5,1)' }).onfinish = () => {
      g.remove();
      if (target) anim(target, 'bump', 300);
      sfx('coin');
    };
  }
}
