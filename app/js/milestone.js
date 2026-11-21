// Milestone bonus games: unlocked by finishing a world.
//   playMilestone('run' | 'feed' | 'hide', worldIndex)  ->  Promise<{ score, stars, quit? }>
//
//   run  = Chick Run            (side-scrolling farm path; tap to jump; peck the corn words)
//   feed = Feed the Chicks      (drag picture seeds to the chick that wants that word)
//   hide = Barnyard Hide & Seek (tap hiding places; find every chick)
//
// worldIndex is 0..6 (index into WORLDS). Only words taught up to the end of that world are used,
// and only words that have a recorded clip (audio/w_<word>.mp3). Everything is drawn in code.
// Link css/milestone.css. Nothing here edits another module; it only imports them.
import { WORLDS, WORDLINGS, NOT_THINGS, MS_LINES, allLessons, parseWords } from './data.js';
import * as audio from './audio.js';
import { say, sfx, stopSpeech, preload } from './audio.js';
import { h, onTap, burst, confetti, clearFx, anim, calm, shuffle, pick } from './ui.js';
import { babySVG, ANIMAL_NAMES } from './babies.js';
import { pipSVG } from './art.js';

// ------------------------------------------------------------------ spoken lines
// The bonus games' own lines (MS_LINES in data.js). A line is only used once its id is in RECORDED; until then an
// existing clip stands in, so nothing 404s.
export const NEW_LINES = MS_LINES;   // the texts live in data.js so tools/build_content.mjs can render them
export const RECORDED = new Set(Object.keys(MS_LINES));   // every clip is in app/audio (rendered by tools/gen_audio.py)
const L = (id, fallback) => (RECORDED.has(id) ? [id] : fallback);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

// ------------------------------------------------------------------ words
const lastLessonOf = wi => { let end = -1; allLessons().forEach((l, i) => { if (l.wi === wi) end = i; }); return end; };

// Every word taught by the end of world wi (curriculum only; clips are checked separately).
export function wordPool(wi) {
  const lessons = allLessons();
  const end = lastLessonOf(wi);
  const seen = new Map();
  lessons.slice(0, end + 1).forEach((l, k) => parseWords(l.words).forEach(x => {
    const cur = seen.get(x.w);
    if (!cur) seen.set(x.w, { w: x.w, e: x.e, lesson: k, world: l.wi });
    else if (x.e && !cur.e) cur.e = x.e;
  }));
  return [...seen.values()];
}

const clipOK = new Map();
// Cheap existence check (a HEAD request, retried once), so starting a game never waits for audio to decode.
async function hasClip(id) {
  if (clipOK.has(id)) return clipOK.get(id);
  let ok = false;
  for (let k = 0; k < 2 && !ok; k++) {
    try { ok = (await fetch(`audio/${id}.mp3`, { method: 'HEAD' })).ok; } catch (e) { ok = false; }
    if (!ok) await new Promise(r => setTimeout(r, 120));
  }
  clipOK.set(id, ok);
  return ok;
}
// The pool without words that have no clip (checked a few at a time). A game only needs a good handful of words,
// so for big pools (later worlds) it checks the newest words plus a random sample, to start quickly.
export async function checkedPool(wi, max = Infinity) {
  let pool = wordPool(wi);
  if (pool.length > max) {
    const top = Math.max(...pool.map(p => p.lesson));
    const fresh = pool.filter(p => p.lesson >= top - 2).slice(0, Math.floor(max * 0.55));
    const rest = shuffle(pool.filter(p => !fresh.includes(p))).slice(0, max - fresh.length);
    pool = [...fresh, ...rest];
  }
  const ok = new Array(pool.length).fill(false);
  let next = 0;
  const worker = async () => { while (next < pool.length) { const i = next++; ok[i] = await hasClip('w_' + pool[i].w); } };
  await Promise.all(Array.from({ length: 6 }, worker));
  return pool.filter((_, i) => ok[i]);
}

// How hard each world is: more words come with the pool itself; these tune speed, nests and chicks.
function tune(wi) {
  return {
    runSpeed: 2.5 + 0.1 * wi,
    nests: [3, 3, 4, 4, 4, 5, 5][wi] || 4,
    patience0: 17 - wi * 0.5, patience1: 10 - wi * 0.4,
    chicks: [6, 6, 6, 8, 8, 10, 10][wi] || 6,
  };
}

// Prefers words from the newest lessons, so the world just finished gets practised most.
function makePicker(pool, lessonOf) {
  const top = Math.max(...pool.map(p => p.lesson));
  const fresh = pool.filter(p => p.lesson >= top - 2);
  const recentlyUsed = [];
  return (avoid = []) => {
    for (let tries = 0; tries < 12; tries++) {
      const src = fresh.length > 2 && Math.random() < 0.55 ? fresh : pool;
      const p = pick(src);
      if (avoid.includes(p.w) || recentlyUsed.includes(p.w)) continue;
      recentlyUsed.push(p.w); if (recentlyUsed.length > Math.min(8, pool.length - 2)) recentlyUsed.shift();
      return p;
    }
    return pick(pool.filter(p => !avoid.includes(p.w)) || pool);
  };
}

// ------------------------------------------------------------------ drawings (all in code)
const STAR_PATH = 'M50 6 L62 36 L94 38 L69 58 L78 90 L50 72 L22 90 L31 58 L6 38 L38 36 Z';
const starSVG = (on = true) => `<svg viewBox="0 0 100 96" class="ms-star${on ? ' on' : ''}"><path d="${STAR_PATH}" fill="${on ? '#ffd23f' : 'rgba(255,255,255,.35)'}" stroke="${on ? '#e3a600' : 'rgba(255,255,255,.55)'}" stroke-width="6" stroke-linejoin="round"/>${on ? '<path d="M38 36 L50 14 L54 28" stroke="#fff6bf" stroke-width="5" fill="none" stroke-linecap="round" opacity=".8"/>' : ''}</svg>`;

const cornSVG = `<svg viewBox="0 0 60 80" class="ms-corn-ico"><path d="M30 78 C8 62 8 24 30 4 C52 24 52 62 30 78Z" fill="#ffd23f" stroke="#e3a600" stroke-width="3"/><path d="M22 20 L22 66 M30 12 L30 72 M38 20 L38 66 M14 36 L46 36 M13 50 L47 50" stroke="#e3a600" stroke-width="2.4" opacity=".55"/><path d="M30 80 C10 70 2 50 6 34 C12 52 20 62 30 66Z" fill="#6fcf6a" stroke="#3fa24a" stroke-width="2.5" stroke-linejoin="round"/><path d="M30 80 C50 70 58 50 54 34 C48 52 40 62 30 66Z" fill="#8be27f" stroke="#3fa24a" stroke-width="2.5" stroke-linejoin="round"/></svg>`;

const OBST = {
  puddle: { w: 1.75, h: 0.55, hh: 0.2, svg: `<svg viewBox="0 0 175 55"><ellipse cx="88" cy="32" rx="80" ry="20" fill="#5aa9e6"/><ellipse cx="88" cy="28" rx="72" ry="15" fill="#8fd0ff"/><ellipse cx="60" cy="25" rx="20" ry="5" fill="#fff" opacity=".6"/><path d="M96 34 q12 -8 24 0 M118 26 q8 -5 16 0" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/></svg>` },
  fence: { w: 1.25, h: 1.0, hh: 0.8, svg: `<svg viewBox="0 0 125 100"><rect x="4" y="38" width="117" height="9" rx="3" fill="#e9d9bd"/><rect x="4" y="66" width="117" height="9" rx="3" fill="#e9d9bd"/>${[10, 38, 66, 94].map(x => `<path d="M${x} 98 L${x} 22 L${x + 11} 8 L${x + 22} 22 L${x + 22} 98Z" fill="#fff" stroke="#d5c3a1" stroke-width="3" stroke-linejoin="round"/>`).join('')}</svg>` },
  hay: { w: 1.35, h: 1.0, hh: 0.8, svg: `<svg viewBox="0 0 135 100"><ellipse cx="68" cy="96" rx="62" ry="6" fill="#000" opacity=".12"/><rect x="8" y="22" width="119" height="72" rx="14" fill="#f4cf55" stroke="#d29f2c" stroke-width="4"/><path d="M20 38 L48 34 M60 40 L96 34 M24 56 L58 62 M76 58 L112 54 M30 76 L64 72 M82 78 L110 74" stroke="#d29f2c" stroke-width="4" stroke-linecap="round"/><rect x="38" y="20" width="9" height="76" fill="#b5742e"/><rect x="88" y="20" width="9" height="76" fill="#b5742e"/></svg>` },
};

// Hiding places for Hide & Seek (120 x 120 viewBox, ground at y ~ 112). `peek`: where a tail or foot sticks out, as % of the spot.
const OBJ = {
  hay: { peek: [78, 52], svg: `<rect x="10" y="44" width="100" height="64" rx="14" fill="#f4cf55" stroke="#d29f2c" stroke-width="4"/><path d="M22 60 L50 56 M62 62 L98 56 M24 80 L58 86 M76 82 L100 78" stroke="#d29f2c" stroke-width="4" stroke-linecap="round"/><rect x="40" y="42" width="9" height="68" fill="#b5742e"/><rect x="82" y="42" width="9" height="68" fill="#b5742e"/>` },
  bucket: { peek: [74, 66], svg: `<path d="M30 40 L90 40 L82 110 L38 110Z" fill="#7fb7e6" stroke="#4d8bc4" stroke-width="4" stroke-linejoin="round"/><ellipse cx="60" cy="40" rx="30" ry="8" fill="#a9d4f5" stroke="#4d8bc4" stroke-width="4"/><path d="M34 40 Q60 -2 86 40" stroke="#4d8bc4" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M42 54 L46 100" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".5"/>` },
  tractor: { peek: [88, 78], svg: `<rect x="10" y="62" width="76" height="34" rx="8" fill="#e8483f" stroke="#b02e29" stroke-width="4"/><rect x="52" y="30" width="38" height="40" rx="7" fill="#e8483f" stroke="#b02e29" stroke-width="4"/><rect x="58" y="36" width="26" height="22" rx="4" fill="#bfe6ff" stroke="#b02e29" stroke-width="3"/><rect x="18" y="38" width="7" height="26" rx="3" fill="#555"/><circle cx="78" cy="96" r="20" fill="#3d3a4d"/><circle cx="78" cy="96" r="9" fill="#ffd23f"/><circle cx="30" cy="102" r="12" fill="#3d3a4d"/><circle cx="30" cy="102" r="5" fill="#ffd23f"/>` },
  trough: { peek: [86, 60], svg: `<path d="M8 50 L112 50 L104 106 L16 106Z" fill="#b97a45" stroke="#8a5528" stroke-width="4" stroke-linejoin="round"/><path d="M14 52 L106 52 L104 62 L16 62Z" fill="#6cc3f5"/><path d="M26 58 q8 -5 16 0 t16 0 t16 0" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/><path d="M30 70 L32 104 M60 70 L60 104 M90 70 L88 104" stroke="#8a5528" stroke-width="3" opacity=".6"/>` },
  fence: { peek: [88, 62], svg: `<rect x="2" y="50" width="116" height="9" rx="3" fill="#e9d9bd"/><rect x="2" y="82" width="116" height="9" rx="3" fill="#e9d9bd"/>${[6, 36, 66, 96].map(x => `<path d="M${x} 110 L${x} 28 L${x + 9} 14 L${x + 18} 28 L${x + 18} 110Z" fill="#fff" stroke="#d5c3a1" stroke-width="3" stroke-linejoin="round"/>`).join('')}` },
  coop: { peek: [88, 80], svg: `<path d="M10 52 L60 14 L110 52Z" fill="#c9473f" stroke="#923029" stroke-width="4" stroke-linejoin="round"/><rect x="18" y="50" width="84" height="58" rx="4" fill="#f0a05a" stroke="#b86d2c" stroke-width="4"/><path d="M42 108 L42 76 Q60 56 78 76 L78 108Z" fill="#6b4226"/><circle cx="60" cy="40" r="6" fill="#fff3d6" stroke="#923029" stroke-width="3"/><path d="M26 60 L26 106 M94 60 L94 106" stroke="#b86d2c" stroke-width="3" opacity=".6"/>` },
  bush: { peek: [80, 62], svg: `<circle cx="36" cy="76" r="30" fill="#4fbf62" stroke="#2f9143" stroke-width="4"/><circle cx="84" cy="76" r="30" fill="#4fbf62" stroke="#2f9143" stroke-width="4"/><circle cx="60" cy="58" r="34" fill="#63d174" stroke="#2f9143" stroke-width="4"/><circle cx="46" cy="50" r="7" fill="#fff" opacity=".28"/><circle cx="40" cy="82" r="4" fill="#ff6f7f"/><circle cx="80" cy="70" r="4" fill="#ff6f7f"/><circle cx="64" cy="90" r="4" fill="#ff6f7f"/>` },
  barrel: { peek: [76, 70], svg: `<path d="M26 20 Q8 64 26 108 L94 108 Q112 64 94 20Z" fill="#b97a45" stroke="#8a5528" stroke-width="4" stroke-linejoin="round"/><path d="M18 40 Q60 52 102 40 M14 66 Q60 78 106 66 M18 92 Q60 104 102 92" stroke="#5e6b7b" stroke-width="6" fill="none"/><path d="M40 24 L38 106 M60 26 L60 108 M80 24 L82 106" stroke="#8a5528" stroke-width="2.5" opacity=".5"/>` },
  barrow: { peek: [84, 56], svg: `<path d="M14 50 L96 50 L84 86 L30 86Z" fill="#e8483f" stroke="#b02e29" stroke-width="4" stroke-linejoin="round"/><path d="M92 54 L116 40 M82 82 L108 98" stroke="#8a5528" stroke-width="6" stroke-linecap="round"/><circle cx="34" cy="94" r="15" fill="#3d3a4d"/><circle cx="34" cy="94" r="6" fill="#d8d4e8"/><path d="M40 86 L36 108" stroke="#8a5528" stroke-width="5" stroke-linecap="round"/>` },
  roll: { peek: [80, 56], svg: `<circle cx="60" cy="66" r="44" fill="#f4cf55" stroke="#d29f2c" stroke-width="4"/><circle cx="60" cy="66" r="30" fill="none" stroke="#d29f2c" stroke-width="3.5"/><circle cx="60" cy="66" r="16" fill="none" stroke="#d29f2c" stroke-width="3.5"/><circle cx="60" cy="66" r="4" fill="#d29f2c"/>` },
};
const OBJ_KINDS = Object.keys(OBJ);
const BARN = `<svg viewBox="0 0 100 80"><rect x="10" y="30" width="62" height="48" rx="3" fill="#e8483f" stroke="#b02e29" stroke-width="3"/><path d="M4 34 L41 4 L78 34Z" fill="#c9473f" stroke="#923029" stroke-width="3" stroke-linejoin="round"/><rect x="28" y="46" width="26" height="32" fill="#fff3d6" stroke="#b02e29" stroke-width="2.5"/><path d="M28 46 L54 78 M54 46 L28 78" stroke="#b02e29" stroke-width="2.5"/><rect x="76" y="22" width="18" height="56" rx="3" fill="#d8dff0" stroke="#9aa6c9" stroke-width="3"/><path d="M73 24 Q85 4 97 24Z" fill="#c9473f"/></svg>`;
const objSVG = k => `<svg viewBox="0 0 120 120" class="ms-objsvg"><ellipse cx="60" cy="112" rx="46" ry="6" fill="#000" opacity=".16"/>${OBJ[k].svg}</svg>`;

const SURPRISE = {
  cat: `<svg viewBox="0 0 120 120"><ellipse cx="60" cy="96" rx="46" ry="26" fill="#f2a24a" stroke="#c97a2a" stroke-width="4"/><path d="M22 96 Q10 70 32 66" stroke="#c97a2a" stroke-width="12" fill="none" stroke-linecap="round"/><circle cx="82" cy="78" r="24" fill="#f2a24a" stroke="#c97a2a" stroke-width="4"/><path d="M64 60 L66 38 L80 54Z M84 54 L98 38 L100 62Z" fill="#f2a24a" stroke="#c97a2a" stroke-width="4" stroke-linejoin="round"/><path d="M72 80 q5 5 10 0 M88 80 q5 5 10 0" stroke="#4a2e18" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M84 88 l3 3 l3 -3Z" fill="#ff8fa8"/><path d="M32 86 L44 84 M36 100 L50 96 M56 76 L58 90" stroke="#c97a2a" stroke-width="4" stroke-linecap="round"/></svg>`,
  sock: `<svg viewBox="0 0 120 120"><path d="M40 20 L74 20 L74 62 Q74 74 88 78 Q112 84 108 100 Q104 112 84 108 Q42 100 40 66Z" fill="#fff" stroke="#c9c2dc" stroke-width="4" stroke-linejoin="round"/><path d="M40 28 L74 28 M40 38 L74 38" stroke="#ff6f7f" stroke-width="6"/><path d="M40 20 L74 20 L74 26 L40 26Z" fill="#ff6f7f"/><circle cx="96" cy="96" r="6" fill="#ffd23f" opacity=".9"/></svg>`,
  bug: `<svg viewBox="0 0 120 120"><ellipse cx="60" cy="86" rx="26" ry="22" fill="#e8483f" stroke="#b02e29" stroke-width="4"/><path d="M60 64 L60 108" stroke="#3a2d4a" stroke-width="4"/><circle cx="48" cy="82" r="5" fill="#3a2d4a"/><circle cx="72" cy="90" r="5" fill="#3a2d4a"/><circle cx="60" cy="62" r="12" fill="#3a2d4a"/><circle cx="55" cy="60" r="3" fill="#fff"/><circle cx="66" cy="60" r="3" fill="#fff"/></svg>`,
};

// Colour of a chick (read back from its gradient) for tails, feet and sparkles.
const chickColour = svg => (svg.match(/offset="\.55" stop-color="(#[0-9a-f]{6})"/i) || [])[1] || '#ffd75e';
const tailSVG = c => `<svg viewBox="0 0 40 50"><path d="M6 46 Q-2 18 14 6 Q16 24 22 36Z" fill="${c}" stroke="rgba(0,0,0,.18)" stroke-width="2"/><path d="M16 48 Q12 18 30 8 Q30 28 30 40Z" fill="${c}" stroke="rgba(0,0,0,.18)" stroke-width="2"/></svg>`;
const footSVG = `<svg viewBox="0 0 40 40"><path d="M20 4 L20 22" stroke="#ffab4a" stroke-width="5" stroke-linecap="round"/><path d="M20 22 L6 36 M20 22 L20 38 M20 22 L34 36" stroke="#ffab4a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const catTailSVG = `<svg viewBox="0 0 40 50"><path d="M8 48 Q0 22 16 8 Q22 4 28 10" stroke="#c97a2a" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M6 36 L14 32 M8 24 L16 22" stroke="#7a4a18" stroke-width="3" stroke-linecap="round"/></svg>`;
const sockToeSVG = `<svg viewBox="0 0 40 40"><path d="M6 34 Q4 14 20 12 Q36 12 34 34Z" fill="#fff" stroke="#c9c2dc" stroke-width="3"/><path d="M6 24 L34 24" stroke="#ff6f7f" stroke-width="5"/></svg>`;

const chickNames = (wi, n) => {
  const owned = allLessons().slice(0, lastLessonOf(wi) + 1).map(l => WORDLINGS[l.id]).filter(x => ANIMAL_NAMES.includes(x));
  const rest = ANIMAL_NAMES.filter(x => !owned.includes(x));
  return [...shuffle(owned), ...shuffle(rest)].slice(0, n);
};

// ------------------------------------------------------------------ the shell shared by the three games
export function playMilestone(kind, worldIndex = 0, opts = {}) {
  const GAMES = { run: chickRun, feed: feedChicks, hide: hideSeek };
  if (!GAMES[kind]) return Promise.reject(new Error('unknown milestone game: ' + kind));
  const wi = clamp(Math.floor(+worldIndex || 0), 0, WORLDS.length - 1);
  return new Promise(resolve => {
    audio.unlock();
    const root = h('div', { class: `ms-root ms-${kind} ms-w${wi}` });
    const stage = h('div', { class: 'ms-stage' });
    const scoreB = h('b', {}, '0');
    const quit = h('button', { class: 'ms-quit', 'aria-label': 'Close game' }, '✕');
    const bar = h('i', {});
    const mid = h('div', { class: 'ms-mid' });
    const hud = h('div', { class: 'ms-hud' }, quit, mid, h('div', { class: 'ms-score' }, h('span', { class: 'ms-score-ico' }, '⭐'), scoreB), h('div', { class: 'ms-bar' }, bar));
    root.append(stage, hud);
    const probe = h("div", { style: { position: "absolute", left: "0", bottom: "0", width: "1px", height: "0", paddingBottom: "env(safe-area-inset-bottom, 0px)", visibility: "hidden", pointerEvents: "none" } });
    root.append(probe);
    (opts.host || document.body).append(root);

    const cleanups = [];
    const timers = new Set();
    const jobs = [];   // [{ at, fn }] scheduled on the game clock, so a hidden tab pauses them too
    let raf = 0, last = 0, hidden = document.hidden, ended = false, disposed = false, score = 0;
    const G = {
      kind, wi, root, stage, hud, mid, bar, tune: tune(wi), time: 0, alive: true, seconds: opts.seconds || 75,
      safeB: () => parseFloat(getComputedStyle(probe).paddingBottom) || 0,
      W: () => root.clientWidth || innerWidth, H: () => root.clientHeight || innerHeight,
      on(t, ev, fn, o) { t.addEventListener(ev, fn, o); cleanups.push(() => t.removeEventListener(ev, fn, o)); },
      after(sec, fn) { jobs.push({ at: G.time + sec, fn }); },
      later(fn, ms) { const id = setTimeout(() => { timers.delete(id); if (G.alive) fn(); }, ms); timers.add(id); },
      say: (...a) => (G.alive ? say(...a) : false),
      get score() { return score; },
      setScore(v) { score = v; scoreB.textContent = String(v); },
      addScore(n) { G.setScore(score + n); },
      update: null,
    };
    const frame = ts => {
      raf = requestAnimationFrame(frame);
      if (!last) { last = ts; return; }
      const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
      if (hidden || ended) return;
      G.time += dt;
      for (let i = jobs.length - 1; i >= 0; i--) if (jobs[i].at <= G.time) { const j = jobs.splice(i, 1)[0]; j.fn(); }
      if (G.update) G.update(dt);
    };
    const dispose = () => {
      if (disposed) return; disposed = true; G.alive = false;
      cancelAnimationFrame(raf); raf = 0; jobs.length = 0;
      timers.forEach(clearTimeout); timers.clear();
      cleanups.splice(0).forEach(f => f());
      stopSpeech(); clearFx();
      root.remove();
    };
    G.on(document, 'visibilitychange', () => { hidden = document.hidden; last = 0; if (hidden) stopSpeech(); });
    G.on(root, 'touchmove', e => e.preventDefault(), { passive: false });
    G.on(root, 'contextmenu', e => e.preventDefault());
    G.on(root, 'dragstart', e => e.preventDefault());

    G.finish = (score2, stars, extra = {}) => {
      if (ended) return;
      ended = true;
      cancelAnimationFrame(raf); raf = 0; jobs.length = 0;
      G.setScore(score2);
      scoreScreen(G, kind, wi, score2, stars, () => { dispose(); resolve({ score: score2, stars, ...extra }); });
    };
    onTap(quit, () => { if (ended) return; sfx('tap'); const s = score; dispose(); resolve({ score: s, stars: 0, quit: true }); });

    // Words with a recorded clip, then start.
    (async () => {
      const pool = opts.pool || await checkedPool(wi, 70);
      if (!G.alive) return;
      G.pool = pool.length >= 4 ? pool : wordPool(wi);
      G.picker = makePicker(G.pool);
      G.recent = G.pool.filter(p => p.lesson >= Math.max(...G.pool.map(q => q.lesson)) - 2);
      preload(G.pool.map(p => 'w_' + p.w).concat(['n_arcade_go', 'n_arcade_done', 'n_dict_find', 'n_praise6', 'n_praise12', ...Object.keys(MS_LINES)]));
      GAMES[kind](G);
      raf = requestAnimationFrame(frame);
    })();
  });
}

function scoreScreen(G, kind, wi, score, stars, onDone) {
  const names = chickNames(wi, 3);
  const row = h('div', { class: 'ms-stars' }, ...[1, 2, 3].map(i => h('span', { class: 'ms-starwrap', style: { '--d': (0.25 + i * 0.28) + 's' }, html: starSVG(i <= stars) })));
  const chicks = h('div', { class: 'ms-final-chicks' }, ...names.map((n, i) => h('div', { class: 'ms-fchick', style: { '--i': i }, html: babySVG(n) })));
  const go = h('button', { class: 'ms-go', 'aria-label': 'Continue' }, '▶');
  const card = h('div', { class: 'ms-final' }, h('div', { class: 'ms-final-title' }, ['Super running!', 'Yummy! Full chicks!', 'You found them all!'][['run', 'feed', 'hide'].indexOf(kind)]), chicks, row,
    h('div', { class: 'ms-final-score' }, h('span', {}, 'Score'), h('b', {}, String(score))), go);
  G.root.append(card);
  sfx('fanfare');
  confetti(stars >= 3 ? 160 : 90);
  for (let i = 1; i <= stars; i++) G.later(() => sfx('coin'), 300 + i * 280);
  G.say(...L('ms_done', [kind === 'hide' ? 'n_praise3' : 'n_arcade_done']));
  let done = false;
  onTap(go, () => { if (done) return; done = true; sfx('tap'); onDone(); });
}

// A little banner from Pip: "Find: hen" with the picture when there is one.
const pipBubble = (word, e) => h('div', { class: 'ms-pip' },
  h('div', { class: 'ms-pip-face', html: pipSVG('talk') }),
  h('div', { class: 'ms-pip-say' }, h('small', {}, 'Find'), h('b', { class: 'ms-read' }, word), e ? h('span', { class: 'ms-emoji' }, e) : null));

// ====================================================================================== 1. CHICK RUN
// Tiled scenery for the runner, drawn in code and turned into background images.
const svgURL = (w, hh, body) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${hh}" preserveAspectRatio="none">${body}</svg>`)}")`;
const TILES = {
  hills: { vw: 1000, vh: 240, img: svgURL(1000, 240,
    '<path d="M0 240 L0 120 Q130 30 270 110 T540 96 T800 100 T1000 120 L1000 240Z" fill="#b7ecb0"/>' +
    '<path d="M0 240 L0 170 Q150 100 330 160 T640 150 T1000 170 L1000 240Z" fill="#93de92"/>' +
    '<g transform="translate(560 60)"><rect x="0" y="40" width="96" height="76" fill="#e8483f" stroke="#b02e29" stroke-width="4"/><path d="M-8 44 L48 -2 L104 44Z" fill="#c9473f" stroke="#923029" stroke-width="4" stroke-linejoin="round"/><rect x="34" y="66" width="28" height="50" fill="#fff3d6" stroke="#b02e29" stroke-width="3"/><path d="M34 66 L62 116 M62 66 L34 116" stroke="#b02e29" stroke-width="3"/><rect x="104" y="30" width="30" height="86" rx="4" fill="#d8dff0" stroke="#9aa6c9" stroke-width="4"/><path d="M100 32 Q119 6 138 32Z" fill="#c9473f"/></g>' +
    '<g transform="translate(120 70)"><rect x="26" y="50" width="12" height="46" fill="#a56b3a"/><circle cx="32" cy="36" r="34" fill="#4fbf62"/><circle cx="14" cy="50" r="22" fill="#63d174"/><circle cx="52" cy="50" r="22" fill="#63d174"/></g>' +
    '<g transform="translate(860 108)"><rect x="18" y="38" width="10" height="38" fill="#a56b3a"/><circle cx="23" cy="26" r="26" fill="#4fbf62"/><circle cx="10" cy="38" r="16" fill="#63d174"/></g>') },
  fence: { vw: 240, vh: 110, img: svgURL(240, 110,
    '<rect x="0" y="34" width="240" height="9" rx="3" fill="#efe2c8"/><rect x="0" y="66" width="240" height="9" rx="3" fill="#efe2c8"/>' +
    [14, 74, 134, 194].map(x => `<path d="M${x} 108 L${x} 22 L${x + 11} 8 L${x + 22} 22 L${x + 22} 108Z" fill="#fff" stroke="#e0d0b0" stroke-width="3" stroke-linejoin="round"/>`).join('')) },
  tufts: { vw: 320, vh: 60, img: svgURL(320, 60,
    [[30, 44], [120, 34], [210, 48], [290, 38]].map(([x, y]) => `<path d="M${x} ${y} q-4 -18 -12 -22 q8 6 12 14 q2 -14 10 -22 q-4 12 -4 28Z" fill="#4fbf62" stroke="#38a04c" stroke-width="2" stroke-linejoin="round"/>`).join('') +
    [[70, 40, '#ff8fb0'], [170, 30, '#fff'], [250, 42, '#ffd23f']].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="7" fill="${c}"/><circle cx="${x}" cy="${y}" r="3" fill="#ffd23f"/><path d="M${x} ${y + 7} L${x} ${y + 20}" stroke="#38a04c" stroke-width="3"/>`).join('')) },
  path: { vw: 220, vh: 100, img: svgURL(220, 100,
    '<path d="M0 22 L220 22" stroke="#d9aa66" stroke-width="6"/>' +
    [[30, 52, 7, 4], [96, 70, 9, 5], [150, 46, 6, 4], [196, 76, 8, 4]].map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#d9ad72"/>`).join('') +
    '<path d="M10 90 L74 90 M120 88 L200 88" stroke="#d9ad72" stroke-width="5" stroke-linecap="round"/>') },
};

function chickRun(G) {
  const { stage, root, tune: T } = G;
  const DUR = G.seconds;
  const AIR = 0.75;
  let W = 0, H = 0, u = 60, groundY = 0, chickPx = 0;
  const hills = h('div', { class: 'ms-layer ms-hills' });
  const fence = h('div', { class: 'ms-layer ms-fencebg' });
  const grass = h('div', { class: 'ms-grassfill' });
  const path = h('div', { class: 'ms-layer ms-path' });
  const tufts = h('div', { class: 'ms-layer ms-tufts' });
  const shadow = h('div', { class: 'ms-shadow' });
  const fore = h('div', { class: 'ms-layer ms-fore' });
  const layers = [[hills, 'hills', 0.1], [fence, 'fence', 0.42], [tufts, 'tufts', 1], [path, 'path', 1], [fore, 'tufts', 1.35]].map(([el, k, sp]) => ({ el, t: TILES[k], k: sp, tile: 1000 }));
  layers.forEach(l => { l.el.style.backgroundImage = l.t.img; });
  // a smaller word pool for the corn pills: short words fit on a pill
  const runPool = G.pool.filter(p => p.w.length <= 5);
  const picker = makePicker(runPool.length >= 12 ? runPool : G.pool);
  const clouds = [0, 1, 2].map(i => h('div', { class: 'ms-cloud', style: { '--k': i } }));
  const sun = h('div', { class: 'ms-sun' });
  const ents = h('div', { class: 'ms-ents' });
  const chickEl = h('div', { class: 'ms-runner', html: babySVG('Tap') });
  const dizzy = h('div', { class: 'ms-dizzy' }, '💫');
  chickEl.append(dizzy);
  const banner = h('div', { class: 'ms-banner' });
  G.mid.append(banner);
  stage.append(sun, ...clouds, hills, fence, grass, tufts, path, fore, ents, shadow, chickEl);

  let dist = 0, speedMult = 1, stumbleT = 0, invT = 0;
  let cy = 0, vy = 0, jumpBuf = 0;
  const obst = [], corns = [];
  let genX = 0, lastWasObst = false;
  let call = null, nextCallAt = 5, caught = 0, pecked = 0, targetsHit = 0, stumbles = 0;
  const onScreenWords = () => corns.map(c => c.w);

  const layout = () => {
    W = G.W(); H = G.H();
    u = clamp(Math.min(W, H) / 5.4, 52, 120);
    groundY = Math.round(H * (W > H ? 0.76 : 0.72));
    chickPx = W * (W > H ? 0.22 : 0.26);
    root.style.setProperty('--u', u + 'px');
    const set = (el, top, hgt) => { el.style.top = top + 'px'; el.style.height = hgt + 'px'; };
    set(hills, groundY - u * 2.7, u * 2.4);
    set(fence, groundY - u * 1.35, u * 1.1);
    set(grass, groundY - u * 0.5, H - (groundY - u * 0.5));
    set(tufts, groundY - u * 0.62, u * 0.5);
    set(path, groundY - u * 0.1, u * 1.2);
    set(fore, groundY + u * 1.2, u * 0.5);
    for (const l of layers) {
      l.tile = parseFloat(l.el.style.height) * l.t.vw / l.t.vh;
      l.el.style.backgroundSize = l.tile + 'px 100%';
      l.el.style.width = (W + l.tile + 4) + 'px';
    }
    chickEl.style.width = chickEl.style.height = u * 1.3 + 'px';
    shadow.style.width = u * 1.0 + 'px'; shadow.style.height = u * 0.26 + 'px';
    for (const o of obst) sizeObst(o);
    for (const c of corns) sizeCorn(c);
  };
  const sizeObst = o => { const d = OBST[o.t]; o.el.style.width = d.w * u + 'px'; o.el.style.height = d.h * u + 'px'; };
  const sizeCorn = c => { c.el.style.width = c.wu * u + 'px'; c.el.style.height = (c.target ? 0.92 : 0.78) * u + 'px'; c.el.style.fontSize = c.fs * u + 'px'; };

  // ----- spawning (world coordinates are in "u" units)
  const speedNow = () => (T.runSpeed + 1.0 * clamp(G.time / DUR, 0, 1)) * (calm() ? 0.8 : 1);
  const addObst = x => {
    const t = pick(['puddle', 'fence', 'hay', 'fence', 'hay', 'puddle']);
    const el = h('div', { class: 'ms-obst ms-' + t, html: OBST[t].svg });
    const o = { t, x, el };
    ents.append(el); obst.push(o); sizeObst(o);
  };
  const addCorn = (x, ccy, word, isTarget) => {
    const el = h('div', { class: 'ms-corn' + (isTarget ? ' target' : ''), 'data-word': word.w, 'data-target': isTarget ? '1' : null },
      h('span', { html: cornSVG, class: 'ms-corn-wrap' }), h('b', { class: 'ms-read' }, word.w), isTarget && word.e ? h('span', { class: 'ms-emoji ms-corn-pic' }, word.e) : null);
    const fs = word.w.length <= 3 ? 0.46 : word.w.length <= 4 ? 0.4 : 0.34;
    const c = { x, cy: ccy, w: word.w, e: word.e, target: !!isTarget, el, got: false, fs, wu: Math.max(1.4, 0.55 + word.w.length * fs * 0.64 + 0.3 + (isTarget && word.e ? 0.55 : 0)) };
    ents.append(el); corns.push(c); sizeCorn(c);
    return c;
  };
  const spawn = () => {
    const horizon = dist + W / u + 3;
    while (genX < horizon) {
      const air = speedNow() * AIR;
      const needTarget = call && call.state === 'wait';
      const r = Math.random();
      let kind = r < 0.36 ? 'obst' : r < 0.6 ? 'arc' : r < 0.9 ? 'row' : 'gap';
      if (needTarget && kind !== 'row') kind = 'row';
      if ((kind === 'obst' || kind === 'arc') && lastWasObst && Math.random() < 0.7) kind = 'row';
      lastWasObst = kind === 'obst' || kind === 'arc';
      const used = onScreenWords();
      if (call) used.push(call.word.w);
      const w = () => { const p = picker(used); used.push(p.w); return p; };
      if (kind === 'obst') { addObst(genX + 0.75); genX += 1.5 + air + 1.2 + rand(0, 1.5); }
      else if (kind === 'arc') {
        addObst(genX + 1.9);
        addCorn(genX + 0.55, 1.05, w()); addCorn(genX + 1.9, 2.3, w()); addCorn(genX + 3.25, 1.05, w());
        genX += 3.8 + air + 1.0 + rand(0, 1.2);
      } else if (kind === 'row') {
        const mid = needTarget ? 1 : -1;
        for (let k = 0; k < 3; k++) {
          const isT = k === mid;
          const c = addCorn(genX + 1.0 + k * 2.2, 0.6, isT ? call.word : w(), isT);
          if (isT) { call.corn = c; call.state = 'live'; }
        }
        genX += 6.8 + rand(0.4, 2.2);
      } else genX += 3 + rand(0, 2);
    }
  };

  // ----- Pip's calls
  const newCall = () => {
    const word = picker(onScreenWords());
    call = { word, state: 'wait', corn: null, said: false };
    banner.replaceChildren(pipBubble(word.w, word.e));
    banner.classList.add('show');
    anim(banner, 'bounce');
    G.say(...L('ms_find', ['n_dict_find']), 'w_' + word.w);
  };
  const endCall = () => { banner.classList.remove('show'); call = null; nextCallAt = G.time + rand(1.6, 3.2); };

  // ----- actions
  const jump = () => {
    if (cy <= 0.001 && stumbleT < 0.35) { vy = 10.8; cy = 0.001; sfx('slide'); jumpBuf = 0; }
    else jumpBuf = 0.14;
  };
  G.on(stage, 'pointerdown', e => { e.preventDefault(); jump(); });

  const floatWord = (text, cls = '') => {
    const f = h('div', { class: 'ms-float ms-read ' + cls, style: { left: chickPx + 'px', top: (groundY - u * (cy + 2.0)) + 'px' } }, text);
    root.append(f);
    G.after(1.1, () => f.remove());
  };
  const peck = c => {
    c.got = true;
    const sx = (c.x - dist) * u, sy = groundY - c.cy * u;
    if (c.target) {
      caught++; targetsHit++;
      G.addScore(50);
      burst(sx, sy, 34, 'star'); sfx('sparkle');
      c.el.classList.add('caught-big');
      floatWord('+50', 'big');
      G.say('w_' + c.w, 120, 'n_praise' + (1 + Math.floor(Math.random() * 12)));
      if (call && call.corn === c) endCall();
    } else {
      pecked++;
      G.addScore(10);
      burst(sx, sy, 8, 'circle'); sfx('coin');
      c.el.classList.add('caught');
      G.say('w_' + c.w);
    }
    G.after(0.35, () => { c.el.remove(); });
  };
  const stumble = o => {
    stumbles++;
    stumbleT = 1.15; invT = 1.5; vy = Math.min(vy, 0);
    sfx('boing');
    dizzy.classList.add('on');
    G.after(1.1, () => dizzy.classList.remove('on'));
  };

  // ----- per-frame
  let tilt = 0;
  const cxw = () => chickPx / u + dist;
  G.update = dt => {
    const t = G.time;
    if (t >= DUR) { finish(); return; }
    // speed
    stumbleT = Math.max(0, stumbleT - dt); invT = Math.max(0, invT - dt);
    const target = stumbleT > 0 ? 0.35 : 1;
    speedMult += (target - speedMult) * Math.min(1, dt * (stumbleT > 0 ? 9 : 2.6));
    dist += speedNow() * speedMult * dt;
    // jump physics
    if (cy > 0 || vy > 0) {
      vy -= 28.8 * dt; cy += vy * dt;
      if (cy <= 0) { cy = 0; vy = 0; if (jumpBuf > 0) jump(); }
    }
    jumpBuf = Math.max(0, jumpBuf - dt);
    spawn();
    // Pip
    if (!call && t >= nextCallAt && t < DUR - 6) newCall();
    if (call && call.state === 'live') {
      const sx = (call.corn.x - dist) * u;
      if (!call.said && sx < W * 0.98) { call.said = true; G.say(...L('ms_find', ['n_dict_find']), 'w_' + call.word.w); }
      if (call.corn.x < dist - 2.5 && !call.corn.got) endCall();   // missed: no fuss, another call soon
    }
    // collisions
    const x0 = cxw();
    for (const o of obst) {
      const d = OBST[o.t];
      if (invT <= 0 && Math.abs(o.x - x0) < d.w * 0.4 + 0.3 && cy < d.hh - 0.06) { stumble(o); break; }
    }
    for (const c of corns) {
      if (c.got) continue;
      if (Math.abs(c.x - x0) < 1.0 && Math.abs(c.cy - (cy + 0.55)) < 0.8) peck(c);
    }
    // draw
    const ch = u * 1.3;
    const bob = calm() || cy > 0 || stumbleT > 0 ? 0 : Math.abs(Math.sin(t * 12)) * 0.07 * u;
    const sq = calm() || cy > 0 ? 1 : 1 + Math.sin(t * 12) * 0.03;
    tilt += ((calm() ? 0 : clamp(-vy * 1.4, -14, 12)) - tilt) * Math.min(1, dt * 10);
    const rot = stumbleT > 0 ? (calm() ? 0 : Math.sin(stumbleT * 20) * 14 * Math.min(1, stumbleT * 2)) : tilt;
    chickEl.style.transform = `translate3d(${chickPx - ch / 2}px, ${groundY - ch * 0.955 - cy * u - bob}px, 0) rotate(${rot}deg) scale(${1 / sq}, ${sq})`;
    chickEl.style.opacity = invT > 0 ? (Math.floor(t * 12) % 2 ? 0.55 : 1) : 1;
    for (let i = obst.length - 1; i >= 0; i--) {
      const o = obst[i], d = OBST[o.t];
      const sx = (o.x - dist) * u;
      if (sx < -3 * u) { o.el.remove(); obst.splice(i, 1); continue; }
      o.el.style.transform = `translate3d(${sx - d.w * u / 2}px, ${groundY - d.h * u + (o.t === 'puddle' ? u * 0.18 : u * 0.05)}px, 0)`;
    }
    for (let i = corns.length - 1; i >= 0; i--) {
      const c = corns[i];
      const sx = (c.x - dist) * u;
      if (sx < -3 * u) { c.el.remove(); corns.splice(i, 1); continue; }
      if (c.got) continue;
      const bobc = calm() ? 0 : Math.sin(t * 3 + c.x) * u * 0.06;
      c.el.style.transform = `translate3d(${sx - c.wu * u / 2}px, ${groundY - c.cy * u - (c.target ? 0.46 : 0.39) * u + bobc}px, 0)`;
    }
    // scenery
    const off = (k, tile) => -((dist * u * k) % tile);
    for (const l of layers) l.el.style.transform = `translate3d(${off(l.k, l.tile)}px,0,0)`;
    shadow.style.transform = `translate3d(${chickPx - u * 0.5}px, ${groundY - u * 0.1}px, 0) scale(${1 - Math.min(0.45, cy * 0.2)})`;
    clouds.forEach((cl, i) => { const span = W + 260; cl.style.transform = `translate3d(${((W * (0.2 + i * 0.35) - dist * u * (0.025 + i * 0.012)) % span + span) % span - 130}px,0,0)`; });
    G.bar.style.transform = `scaleX(${clamp(t / DUR, 0, 1)})`;
  };

  const finish = () => {
    const s = G.score;
    const stars = s >= 600 ? 3 : s >= 300 ? 2 : 1;
    banner.classList.remove('show');
    G.finish(s, stars, { pecked, targetsHit });
  };

  layout();
  G.on(window, 'resize', layout);
  genX = chickPx / u + 8;
  G.say(...L('ms_run_go', ['n_arcade_go']));
}

// ====================================================================================== 2. FEED THE CHICKS
function feedChicks(G) {
  const { stage, root, tune: T } = G;
  const DUR = G.seconds;
  let W = 0, H = 0;
  const picks = G.pool.filter(p => p.e && !NOT_THINGS.has(p.w) && p.w.length <= 7);
  const pool = picks.length >= 6 ? picks : G.pool.filter(p => p.e);
  const pickWord = makePicker(pool);
  const field = h('div', { class: 'ms-feedfield' }, h('div', { class: 'ms-sun' }));
  const tray = h('div', { class: 'ms-tray' });
  stage.append(field, tray);
  const nestsEl = h('div', { class: 'ms-nests' });
  stage.append(nestsEl);

  let nests = [], seeds = [], slots = [];
  let feeds = 0, streak = 0, lastFeedAt = 0, hinted = false, nextSpawn = 0.6, wrong = 0;
  let seedSize = 70;
  const names = chickNames(G.wi, 6);

  const nestSVG = `<svg viewBox="0 0 200 90" preserveAspectRatio="xMidYMid meet"><path d="M6 20 Q100 -8 194 20 Q204 62 150 84 Q100 94 50 84 Q-4 62 6 20Z" fill="#c98a4a" stroke="#8d5a28" stroke-width="5" stroke-linejoin="round"/><path d="M18 30 Q100 8 182 30 M14 46 Q100 26 186 46 M30 62 Q100 44 170 62 M52 76 Q100 62 148 76" stroke="#8d5a28" stroke-width="4" fill="none" stroke-linecap="round" opacity=".7"/><path d="M40 24 L70 56 M90 18 L84 54 M130 20 L150 56 M168 28 L128 62" stroke="#e8b878" stroke-width="3.5" stroke-linecap="round" opacity=".75"/></svg>`;
  const eggSVG = `<svg viewBox="0 0 40 50"><ellipse cx="20" cy="28" rx="15" ry="19" fill="#fff6e6" stroke="#e0c9a6" stroke-width="2.5"/><ellipse cx="14" cy="20" rx="4" ry="7" fill="#fff" opacity=".7" transform="rotate(18 14 20)"/></svg>`;

  const layout = () => {
    W = G.W(); H = G.H();
    seedSize = clamp(Math.min(W, H) * 0.19, 64, 108);
    const slotCount = W > 700 || H > 900 ? 4 : 3;
    const hudH = 74;
    const safeB = G.safeB();
    const trayH = seedSize * 1.55 + safeB;
    const regionTop = hudH, regionBot = H - trayH - 6;
    const portrait = W < H;
    let N = T.nests;
    if (portrait && H < 760) N = Math.min(N, 4);
    const cols = portrait ? 2 : Math.min(N, 3);
    const rows = Math.ceil(N / cols);
    const cw = W / cols, chh = (regionBot - regionTop) / rows;
    root.style.setProperty('--seed', seedSize + 'px');
    tray.style.height = trayH + 'px';
    slots = Array.from({ length: slotCount }, (_, i) => ({ x: W * (i + 1) / (slotCount + 1), y: H - safeB - (trayH - safeB) / 2 - 2, seed: null }));
    if (nests.length !== N) {
      nestsEl.replaceChildren(); nests = [];
      for (let i = 0; i < N; i++) {
        const sign = h('div', { class: 'ms-sign' }, h('b', { class: 'ms-read' }, ''));
        const chick = h('div', { class: 'ms-nchick', html: babySVG(names[i % names.length]) });
        const front = h('div', { class: 'ms-nfront', html: nestSVG });
        const egg = h('div', { class: 'ms-negg', html: eggSVG });
        const el = h('div', { class: 'ms-nest', 'data-i': i }, sign, chick, egg, front);
        nestsEl.append(el);
        const n = { i, el, sign, chick, state: 'empty', word: null, patience: 0, age: 0, fat: 0, rect: null, late: false };
        const sayIt = () => { if (n.word) G.say('w_' + n.word.w); };
        onTap(sign, sayIt); onTap(chick, sayIt);
        nests.push(n);
      }
    }
    nests.forEach((n, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const inRow = r === rows - 1 ? N - r * cols : cols;
      const x0 = r === rows - 1 ? (W - inRow * cw) / 2 + c * cw : c * cw;
      const w = cw - 8, hh = chh - 4;
      n.rect = { x: x0 + 4, y: regionTop + r * chh + 2, w, h: hh };
      const cs = Math.min(w * 0.7, hh * 0.64);
      n.cs = cs;
      Object.assign(n.el.style, { left: n.rect.x + 'px', top: n.rect.y + 'px', width: w + 'px', height: hh + 'px' });
      n.el.style.setProperty('--cs', cs + 'px');
    });
    // seeds that no longer fit a slot: re-home
    seeds.forEach(s => homeSeed(s));
  };

  const slotFree = () => slots.find(s => !s.seed);
  const homeSeed = s => {
    const sl = s.slot; if (!sl) return;
    s.home = { x: sl.x - seedSize / 2, y: sl.y - seedSize / 2 };
    s.el.style.left = s.home.x + 'px'; s.el.style.top = s.home.y + 'px';
  };
  const makeSeed = n => {
    const sl = slotFree(); if (!sl) return;
    const el = h('div', { class: 'ms-seed', 'data-word': n.word.w }, h('span', { class: 'ms-emoji' }, n.word.e));
    const s = { el, word: n.word, slot: sl, dragging: false, n };
    sl.seed = s; seeds.push(s);
    stage.append(el); homeSeed(s);
    anim(el, 'drop-in');
    attachDrag(s);
  };
  const dropSeed = s => { s.slot.seed = null; seeds = seeds.filter(x => x !== s); };   // the caller removes the element
  const homeAnim = (s, fromX, fromY) => {
    s.el.style.transform = '';
    if (calm()) { s.el.animate([{ opacity: .4 }, { opacity: 1 }], { duration: 250 }); return; }
    s.el.animate([{ transform: `translate(${fromX}px,${fromY}px)` }, { transform: 'translate(0,-14px)', offset: .7 }, { transform: 'translate(0,0)' }], { duration: 380, easing: 'ease-out' });
  };

  const nestAt = (px, py, lead) => {
    let best = null, bd = 1e9;
    for (const n of nests) {
      const r = n.rect; const cx = r.x + r.w / 2, cyy = r.y + r.h * 0.6;
      const inside = px > r.x && px < r.x + r.w && py > r.y && py < r.y + r.h;
      const d = Math.hypot(px - cx, py - cyy);
      if (inside && d < bd) { bd = d; best = n; }
    }
    if (best) return best;
    // a flick that stopped short: nearest nest to where it was heading
    for (const n of nests) {
      const r = n.rect; const d = Math.hypot(lead.x - (r.x + r.w / 2), lead.y - (r.y + r.h * 0.6));
      if (d < Math.min(r.w, r.h) * 0.8 && d < bd) { bd = d; best = n; }
    }
    return best;
  };

  function attachDrag(s) {
    const el = s.el;
    let sx = 0, sy = 0, ox = 0, oy = 0, pid = null, samples = [], moved = 0;
    el.addEventListener('pointerdown', e => {
      if (pid !== null) return;
      e.preventDefault();
      pid = e.pointerId; try { el.setPointerCapture(pid); } catch (er) {}
      sx = e.clientX; sy = e.clientY; ox = oy = 0; moved = 0; samples = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
      s.dragging = true; el.classList.add('drag'); el.style.zIndex = 30;
    });
    el.addEventListener('pointermove', e => {
      if (e.pointerId !== pid) return;
      ox = e.clientX - sx; oy = e.clientY - sy; moved = Math.max(moved, Math.hypot(ox, oy));
      el.style.transform = `translate(${ox}px,${oy}px) scale(1.12)`;
      samples.push({ x: e.clientX, y: e.clientY, t: performance.now() }); if (samples.length > 6) samples.shift();
    });
    const end = (e, cancelled) => {
      if (e.pointerId !== pid) return;
      pid = null; s.dragging = false; el.classList.remove('drag'); el.style.zIndex = '';
      try { el.releasePointerCapture(e.pointerId); } catch (er) {}
      if (cancelled || !G.alive) { el.style.transform = ''; return; }
      if (moved < 10) { el.style.transform = ''; G.say('w_' + s.word.w); return; }   // a tap: hear the word
      const a = samples[0], b = samples[samples.length - 1];
      const dtm = Math.max(16, b.t - a.t);
      const vx = (b.x - a.x) / dtm, vy = (b.y - a.y) / dtm;
      const lead = { x: e.clientX + vx * 170, y: e.clientY + vy * 170 };
      const target = nestAt(e.clientX, e.clientY, lead);
      const fromX = ox, fromY = oy;
      if (target && target.state === 'up' && target.word.w === s.word.w) feed(s, target);
      else {
        if (target && target.state === 'up') wrongNest(target);
        homeAnim(s, fromX, fromY);
        el.style.transform = '';
        wrong++; streak = 0;
      }
    };
    el.addEventListener('pointerup', e => end(e, false));
    el.addEventListener('pointercancel', e => end(e, true));
  }

  const wrongNest = n => {
    sfx('bad');
    anim(n.chick, 'shake');
    G.say('w_' + n.word.w);     // the chick tells you what it wants
  };
  const feed = (s, n) => {
    feeds++; streak++; lastFeedAt = G.time; hinted = false;
    G.addScore(20 + Math.min(25, (streak - 1) * 5));
    const r = n.rect, ex = r.x + r.w / 2, ey = r.y + r.h * 0.62;
    const rt = { left: 0, top: 0 };
    s.el.style.transition = 'transform .22s ease-in, opacity .22s';
    s.el.style.transform = `translate(${ex - (s.home.x + seedSize / 2)}px, ${ey - (s.home.y + seedSize / 2)}px) scale(.25)`;
    s.el.style.opacity = '0';
    s.el.style.pointerEvents = 'none';
    dropSeed(s);
    G.after(0.3, () => s.el.remove());
    n.state = 'fed'; n.fat = Math.min(5, n.fat + 1);
    n.el.style.setProperty('--fat', (1 + 0.075 * n.fat).toFixed(3));
    n.el.classList.add('fed'); n.el.classList.remove('late');
    n.sign.classList.add('ok');
    sfx('good'); burst(rt.left + ex, rt.top + ey - n.cs * 0.4, 22, 'star');
    anim(n.chick, 'bounce');
    G.say('w_' + n.word.w);
    n.age = 0;
    n.downAt = G.time + 1.15;
  };

  // ----- the rhythm of the game
  const wantUp = () => Math.min(nests.length, 2 + Math.floor(G.time / 9));
  const patience = () => T.patience0 + (T.patience1 - T.patience0) * clamp(G.time / DUR, 0, 1);
  const spawnNest = () => {
    const empties = nests.filter(n => n.state === 'empty');
    if (!empties.length) return false;
    const n = pick(empties);
    const inUse = nests.filter(x => x.word).map(x => x.word.w);
    const word = pickWord(inUse);
    if (nests.some(x => x.word && x.word.e === word.e)) return false;
    n.word = word; n.state = 'up'; n.patience = patience(); n.age = 0;
    n.sign.firstChild.textContent = word.w;
    n.el.classList.remove('fed', 'late'); n.sign.classList.remove('ok');
    n.el.classList.add('up');
    sfx('pop');
    return true;
  };
  const sendDown = n => {
    n.el.classList.remove('up', 'late', 'fed');
    n.state = 'empty'; n.word = null;
    // a seed for a chick that left quietly goes too
    seeds.filter(s => s.n === n).forEach(s => { s.el.style.opacity = '0'; s.el.style.transition = 'opacity .25s'; s.el.style.pointerEvents = 'none'; dropSeed(s); G.after(0.3, () => s.el.remove()); });
  };

  G.update = dt => {
    const t = G.time;
    if (t >= DUR) { finish(); return; }
    G.bar.style.transform = `scaleX(${clamp(t / DUR, 0, 1)})`;
    // chicks: patience, leaving
    for (const n of nests) {
      if (n.state === 'up') {
        n.age += dt;
        if (n.age > n.patience * 0.65 && !n.late) { n.late = true; n.el.classList.add('late'); }
        if (n.age > n.patience) { n.late = false; sendDown(n); }
      } else if (n.state === 'fed' && t >= n.downAt) { n.late = false; sendDown(n); }
      else if (n.state === 'empty') n.late = false;
    }
    // new chicks
    const up = nests.filter(n => n.state === 'up').length;
    if (up < wantUp() && t >= nextSpawn) { if (spawnNest()) nextSpawn = t + clamp(1.2 - t / DUR, 0.4, 1.2); else nextSpawn = t + 0.3; }
    // seeds for hungry chicks without one
    const hungry = nests.filter(n => n.state === 'up' && !seeds.some(s => s.n === n)).sort((a, b) => b.age - a.age);
    if (hungry.length && slotFree()) makeSeed(hungry[0]);
    // gentle hint: after a while with no feeding, glow the right seed and say the word
    if (!hinted && t - lastFeedAt > 7 && seeds.length) {
      hinted = true;
      const s = seeds.find(x => !x.dragging) || seeds[0];
      s.el.classList.add('hint'); s.n.sign.classList.add('hint');
      G.say('w_' + s.word.w);
      G.after(4, () => { seeds.forEach(x => x.el.classList.remove('hint')); nests.forEach(n => n.sign.classList.remove('hint')); });
      lastFeedAt = t - 2;   // hint again after another 5 s
      hinted = false;
    }
  };

  const finish = () => {
    const stars = feeds >= 16 ? 3 : feeds >= 8 ? 2 : 1;
    G.finish(G.score, stars, { fed: feeds });
  };

  layout();
  G.on(window, 'resize', layout);
  G.say(...L('ms_feed_go', ['n_arcade_go']));
}

// ====================================================================================== 3. BARNYARD HIDE AND SEEK
function hideSeek(G) {
  const { stage, root, tune: T } = G;
  const nChicks = T.chicks;
  const pool = G.pool;
  const names = chickNames(G.wi, nChicks);
  const used = [];
  const words = Array.from({ length: nChicks }, () => { const p = G.picker(used); used.push(p.w); return p; });
  const nSpots = nChicks + 3;

  const yard = h('div', { class: 'ms-yard' },
    h('div', { class: 'ms-sun' }), h('div', { class: 'ms-barn', html: BARN }), h('div', { class: 'ms-yardfence' }), h('div', { class: 'ms-yardgrass' }));
  const spotsEl = h('div', { class: 'ms-spots' });
  const card = h('div', { class: 'ms-card' });
  stage.append(yard, spotsEl, card);
  const dots = h('div', { class: 'ms-dots' }, ...Array.from({ length: nChicks }, () => h('i', {})));
  G.mid.append(dots);

  // what hides where: chicks, two surprises, one empty spot
  const roles = shuffle([...Array(nChicks).fill('chick'), 'cat', 'sock', 'bug']);
  const kinds = [];
  while (kinds.length < nSpots) kinds.push(...shuffle(OBJ_KINDS));
  kinds.length = nSpots;
  let ci = 0;
  const spots = roles.map((role, i) => {
    const kind = kinds[i];
    const sp = { i, role, kind, found: false, el: null };
    if (role === 'chick') { sp.chick = names[ci]; sp.word = words[ci]; ci++; }
    return sp;
  });

  let found = 0, wasted = 0, surprises = 0, lastAct = 0, hintSpot = null;

  const layout = () => {
    const W = G.W(), H = G.H();
    const top = Math.max(86, H * 0.2), bot = H - 8 - G.safeB();
    const rw = W - 8, rh = bot - top;
    // pick columns so cells come out roughly square
    let best = 2, bestS = 0;
    for (let c = 2; c <= 6; c++) { const rows = Math.ceil(nSpots / c); const s = Math.min(rw / c, rh / rows); if (s > bestS) { bestS = s; best = c; } }
    const cols = best, rows = Math.ceil(nSpots / cols);
    const cw = rw / cols, chh = rh / rows;
    const s = Math.min(cw, chh * 1.05) * 0.98;
    root.style.setProperty('--spot', s + 'px');
    spots.forEach((sp, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const inRow = r === rows - 1 ? nSpots - r * cols : cols;
      const x0 = 4 + (r === rows - 1 ? (rw - inRow * cw) / 2 : 0) + c * cw;
      const jx = sp.jx ?? (sp.jx = rand(-0.06, 0.06) * cw), jy = sp.jy ?? (sp.jy = rand(-0.04, 0.04) * chh);
      const sc = 0.88 + 0.12 * (r / Math.max(1, rows - 1));
      const size = s * sc;
      sp.size = size; sp.cx = (x0 + cw / 2) / W;
      Object.assign(sp.el.style, { left: x0 + cw / 2 + jx - size / 2 + 'px', top: top + r * chh + chh / 2 + jy - size / 2 + 'px', width: size + 'px', height: size + 'px', zIndex: 10 + r * 2 });
    });
  };

  const chickBlock = sp => {
    const svg = babySVG(sp.chick);
    sp.colour = chickColour(svg);
    return h('div', { class: 'ms-find' }, h('div', { class: 'ms-fchick-svg', html: svg }),
      h('div', { class: 'ms-sign', style: { fontSize: `calc(var(--spot) * ${Math.min(0.19, 1 / ((sp.word.w.length + 1.8) * 0.64)).toFixed(3)})` } }, h('b', { class: 'ms-read' }, sp.word.w), sp.word.e ? h('span', { class: 'ms-emoji' }, sp.word.e) : null));
  };

  spots.forEach(sp => {
    const behind = h('div', { class: 'ms-behind' });
    let peek = null;
    if (sp.role === 'chick') { behind.append(chickBlock(sp)); peek = h('div', { class: 'ms-peek ' + (sp.i % 2 ? 'foot' : 'tail'), html: sp.i % 2 ? footSVG : tailSVG(sp.colour) }); }
    else { behind.append(h('div', { class: 'ms-surprise ' + sp.role, html: SURPRISE[sp.role] })); if (sp.role === 'cat') peek = h('div', { class: 'ms-peek tail cat', html: catTailSVG }); if (sp.role === 'sock') peek = h('div', { class: 'ms-peek foot sock', html: sockToeSVG }); }
    if (sp.role === 'cat') behind.append(h('div', { class: 'ms-zzz' }, 'z z z'));
    const obj = h('div', { class: 'ms-obj', html: objSVG(sp.kind) });
    if (peek) { const [px, py] = OBJ[sp.kind].peek; peek.style.left = px + '%'; peek.style.top = py + '%'; }
    const el = h('div', { class: 'ms-spot k-' + sp.kind, role: 'button', 'aria-label': 'Hiding place', 'data-role': sp.role, 'data-i': sp.i }, behind, obj, peek);
    sp.el = el; sp.behind = behind; sp.obj = obj; sp.peek = peek;
    spotsEl.append(el);
    onTap(el, () => tapSpot(sp));
  });

  const sideOf = sp => (sp.cx < 0.5 ? -1 : 1);
  const tapSpot = sp => {
    if (sp.found || sp.busy || ended) return;
    sp.busy = true; lastAct = G.time; clearHint();
    sfx('tap');
    anim(sp.obj, 'wiggle');
    G.after(0.28, () => reveal(sp));
  };
  const reveal = sp => {
    sp.found = true; sp.el.classList.add('open', 'k-' + sp.role); sp.obj.style.setProperty('--side', sideOf(sp));
    if (sp.peek) sp.peek.style.display = 'none';
    lastAct = G.time;
    const rr = sp.el.getBoundingClientRect();
    if (sp.role === 'chick') {
      found++; G.addScore(100);
      dots.children[found - 1].classList.add('on');
      sfx('good'); burst(rr.left + rr.width / 2, rr.top + rr.height * 0.4, 20, 'star');
      showCard(sp);
      G.say('w_' + sp.word.w);
      if (found === nChicks) allFound();
    } else {
      surprises++; wasted++; G.addScore(10);
      sfx(sp.role === 'bug' ? 'pop' : 'boing');
      if (RECORDED.has('ms_surprise') && sp.role !== 'bug') G.say('ms_surprise');
      burst(rr.left + rr.width / 2, rr.top + rr.height * 0.5, 8, 'circle');
    }
  };
  let cardTimer = 0;
  const showCard = sp => {
    card.replaceChildren(...[h('b', { class: 'ms-read' }, sp.word.w), sp.word.e ? h('span', { class: 'ms-emoji' }, sp.word.e) : null].filter(Boolean));
    card.classList.remove('show'); void card.offsetWidth; card.classList.add('show');
    const id = ++cardTimer;
    G.after(1.5, () => { if (id === cardTimer) card.classList.remove('show'); });
  };
  const clearHint = () => { if (hintSpot) { hintSpot.el.classList.remove('hint'); hintSpot = null; } };

  let ended = false;
  const allFound = () => {
    ended = true; // the playing is over: stop hinting, ignore taps
    clearHint();
    G.after(0.7, () => {
      root.classList.add('party');
      spots.filter(s => s.role === 'chick').forEach((s, k) => { s.el.style.setProperty('--k', k); s.el.classList.add('dance'); });
      sfx('fanfare'); G.say(...L('ms_found_all', ['n_praise12']));
      const W = G.W(), Hh = G.H();
      for (let k = 0; k < 5; k++) G.after(k * 0.4, () => { burst(rand(W * 0.15, W * 0.85), rand(Hh * 0.25, Hh * 0.7), 22, 'star'); });
      confetti(120);
    });
    G.after(0.7 + 3.4, () => {
      const stars = wasted <= 1 ? 3 : wasted <= 3 ? 2 : 1;
      const bonus = Math.max(0, Math.round(300 - G.time * 2));
      G.finish(G.score + bonus, stars, { found, wasted });
    });
  };

  G.update = dt => {
    const t = G.time;
    G.bar.style.transform = `scaleX(${found / nChicks})`;
    if (ended) return;
    // hint: after 8 s with no tap, glow a hiding place that has a chick
    if (!hintSpot && t - lastAct > 8) {
      const cand = spots.filter(s => s.role === 'chick' && !s.found);
      if (cand.length) { hintSpot = pick(cand); hintSpot.el.classList.add('hint'); sfx('sparkle'); }
    }
  };

  layout();
  G.on(window, 'resize', layout);
  G.say(...L('ms_hide_go', ['n_arcade_go']));
}
