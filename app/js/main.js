import { WORLDS, GRAPHEMES, STORIES, BOOKS, storyOf, WORDLINGS, HATS, LINES, PIP_LINES, FRAMES, NOT_THINGS, NAMES, SILENT_E, isSplit,
  label, parseWords, parseSentences, sentenceWords, segment, allLessons, knownAt, BONUS_KINDS, BONUS_INFO } from './data.js';
import * as audio from './audio.js';
import { say, sfx, preload, stopSpeech } from './audio.js';
import { h, onTap, sleep, shuffle, anim, burstAt, confetti, flyGems, clearFx } from './ui.js';
import { pipSVG, wordlingSVG, eggSVG } from './art.js';
import * as store from './store.js';
import * as games from './games.js';
import * as cloud from './cloud.js';
import * as trace from './trace.js';
import * as readaloud from './readaloud.js';
import { loginFlow, changeCode, joinCloud } from './login.js';
import { playMilestone } from './milestone.js';
import { skySVG, groundSVG } from './scenery.js';

const app = document.getElementById('app');
const LESSONS = allLessons();
const hatEmoji = () => (HATS.find(x => x.id === store.state().hat) || HATS[0]).e;
let screenName = '';

function show(name, el, theme) {
  stopSpeech();
  if (name !== 'hatch') clearFx();
  screenName = name;
  app.innerHTML = '';
  app.className = 'screen-' + name + (theme ? ' theme-' + theme : '');
  app.append(el);
  if (theme) audio.setTheme(theme);
}

function gemPill() {
  return h('div', { class: 'gem-pill' }, h('span', { class: 'gem-ico' }, '💎'), h('b', {}, String(store.state().gems)));
}
function refreshGems() {
  document.querySelectorAll('.gem-pill b').forEach(b => (b.textContent = store.state().gems));
}
function backBtn(fn) {
  return onTap(h('button', { class: 'btn round back', 'aria-label': 'Back' }, '⬅'), () => { sfx('tap'); fn(); });
}

// Time played (shown in the parents' area).
setInterval(() => {
  if (!document.hidden && ['lesson', 'arcade', 'story'].includes(screenName)) store.tickTime(1);
}, 1000);

// ================================================================ Title
function titleScreen() {
  const pip = h('div', { class: 'title-pip', html: pipSVG('happy', hatEmoji()) });
  const play = h('button', { class: 'btn huge play' }, '▶');
  const el = h('div', { class: 'title' },
    h('div', { class: 'title-sky' }, ...Array.from({ length: 6 }, (_, i) => h('div', { class: 'cloud c' + i }))),
    h('div', { class: 'isle isle1' }), h('div', { class: 'isle isle2' }),
    h('h1', { class: 'logo' }, ...[...'Wordwild'].map((c, i) => h('span', { style: { '--i': i } }, c))),
    pip, play,
    h('button', { class: 'credits-link', onclick: () => creditsScreen(titleScreen) }, 'Credits & licences'),
  );
  let starting = false;
  onTap(play, async () => {
    if (starting) return;
    starting = true;
    audio.unlock();
    audio.setMusic(store.state().settings.music);
    sfx('boing');
    const s = store.state();
    if (!s.seenIntro) {
      pip.innerHTML = pipSVG('talk', hatEmoji());
      anim(pip, 'jump', 700);
      s.seenIntro = true; store.save();
      await say('pl_hi');
    }
    if (!s.name) await loginFlow();
    mapScreen();
  });
  show('title', el, 'title');
}

// ================================================================ Map
const NODE_X = [50, 74, 56, 28, 44, 70];
const DECOR = {
  farm: ['🌻', '🚜', '🐄', '🌾', '🐑', '🏡', '🌻', '🐖'],
  meadow: ['🌼', '🦋', '🐞', '🌷', '🍄', '🐝', '🌳', '🌸'],
  pond: ['🦆', '🐸', '🌿', '🐟', '🦆', '🫧', '🐢', '🌱'],
  loft: ['🌾', '🐈', '🧺', '🐭', '🥕', '🌽', '🕯️', '🦉'],
  coop: ['☁️', '🥚', '🌈', '🐓', '🕊️', '☁️', '🌤️', '🥚'],
  shore: ['🐚', '🦀', '🏖️', '🌊', '🐠', '⛱️', '🐚', '🐢'],
  roost: ['🌙', '⭐', '🦉', '✨', '🌟', '🐞', '🏡', '✨'],
};

function mapScreen() {
  const s = store.state();
  const cur = store.currentIndex();
  const scroller = h('div', { class: 'map-scroll' });
  let curNode = null;
  let li = 0;
  WORLDS.forEach((wd, wi) => {
    const n = wd.lessons.length;
    const rowH = 150;
    const sec = h('section', { class: 'world theme-' + wd.theme });
    sec.append(h('div', { class: 'world-scenery', html: skySVG(wd.theme) + groundSVG(wd.theme) }));
    sec.append(h('div', { class: 'world-banner' }, h('span', {}, DECOR[wd.theme][0]), wd.name));
    const field = h('div', { class: 'world-field', style: { height: n * rowH + 110 + 'px' } });
    const pts = wd.lessons.map((_, k) => [NODE_X[(li + k) % NODE_X.length], k * rowH + 150]);
    const path = pts.map((p, k) => (k ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
    field.innerHTML = `<svg class="path" viewBox="0 0 100 ${n * rowH + 110}" preserveAspectRatio="none"><path d="${path}" vector-effect="non-scaling-stroke"/></svg>`;
    DECOR[wd.theme].forEach((e, k) => {
      const d = h('div', { class: 'decor', style: { left: (k % 2 ? 80 + (k * 7) % 14 : 3 + (k * 5) % 12) + '%', top: (k * 97) % (n * rowH) + 20 + 'px', animationDelay: k * 0.4 + 's' } }, e);
      field.append(d);
    });
    wd.lessons.forEach((L, k) => {
      const idx = li + k;
      const done = s.done[L.id];
      const open = store.isOpen(idx);
      const isCur = idx === cur;
      const node = h('div', { class: 'node' + (done ? ' done' : '') + (isCur ? ' current' : '') + (!open ? ' locked' : '') + (L.review ? ' review' : ''), style: { left: pts[k][0] + '%', top: pts[k][1] + 'px' } });
      if (done) {
        node.append(h('div', { class: 'node-wl', html: wordlingSVG(WORDLINGS[L.id]) }),
          h('div', { class: 'stars' }, '⭐'.repeat(done.stars) + '☆'.repeat(3 - done.stars)));
      } else if (open) {
        node.append(h('div', { class: 'node-egg', html: eggSVG(WORDLINGS[L.id], 0, L.review) }));
        if (isCur) node.append(h('div', { class: 'node-pip', html: pipSVG('happy', hatEmoji()) }));
      } else {
        node.append(h('div', { class: 'node-lock' }, L.review ? '🏆' : '🔒'));
      }
      if (open) onTap(node, () => { sfx('tap'); startLesson(idx); });
      else onTap(node, () => { sfx('bad'); anim(node, 'shake'); });
      if (isCur) curNode = node;
      field.append(node);
    });
    li += n;
    sec.append(field);
    scroller.append(sec);
  });
  const allDone = everythingDone();
  const doneBtns = allDone ? h('div', { class: 'end-btns' },
    bigBtn('🌟', 'Daily practice', startPractice), bigBtn('📚', 'Big books', () => libraryScreen('big'))) : null;
  scroller.append(h('section', { class: 'world theme-sky' },
    h('div', { class: 'world-banner' }, h('span', {}, '🏆'), 'Super Reader'),
    h('div', { class: 'coming' }, allDone ? '🏆 🎉 🏆' : '🏆', h('small', {}, allDone ? 'You finished every world!' : 'Finish every world to get here'), doneBtns)));

  const settingsBtn = h('button', { class: 'btn round gear', 'aria-label': 'Grown-ups' }, h('span', {}, '⚙️'), h('i', { class: 'hold-ring' }));
  holdToOpen(settingsBtn, parentScreen);
  const hud = h('div', { class: 'hud' }, settingsBtn, h('div', { class: 'hud-spacer' }), cloudPill(), gemPill());
  const dock = h('nav', { class: 'dock' },
    dockBtn('🐾', 'Zoo', zooScreen, s.wordlings.length),
    dockBtn('🎩', 'Shop', shopScreen),
    dockBtn('📚', 'Books', libraryScreen, s.books.length),
    dockBtn('🎮', 'Play', arcadeScreen),
  );
  // Daily practice opens once World 1 is finished.
  const fab = worldOneDone() ? onTap(h('button', { class: 'practice-fab' + (store.practicedToday() ? '' : ' fresh'), 'aria-label': 'Daily practice' },
    h('span', { class: 'fab-ico' }, '🌟'), h('span', { class: 'fab-lbl' }, 'Practice'), store.practicedToday() ? null : h('i', { class: 'fab-new' }, '✨')),
    () => { sfx('tap'); startPractice(); }) : null;
  show('map', h('div', { class: 'map' }, scroller, hud, fab, dock));
  audio.startMusicIfOn();
  requestAnimationFrame(() => {
    if (curNode) curNode.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  if (!s.done.L1) setTimeout(() => say('n_map_tap'), 600);
}

// ☁️✓ saved · ☁️… saving · ☁️✕ offline (progress kept on this device and synced later).
function cloudPill() {
  const s = store.state();
  if (!s.name) return null;
  const el = h('div', { class: 'cloud-pill' }, h('span', {}, '☁️'), h('b'), h('small', {}, s.name));
  const set = st => {
    el.querySelector('b').textContent = !s.cloud ? '✕' : st === 'saving' ? '…' : st === 'off' || st === 'denied' ? '✕' : '✓';
    el.classList.toggle('off', !s.cloud || st === 'off' || st === 'denied');
  };
  const stop = cloud.onStatus(set);
  new MutationObserver((_, o) => { if (!el.isConnected) { stop(); o.disconnect(); } }).observe(app, { childList: true });
  return el;
}

function dockBtn(icon, label, fn, badge) {
  const b = h('button', { class: 'dock-btn' }, h('span', { class: 'dock-ico' }, icon), h('span', { class: 'dock-lbl' }, label),
    badge ? h('i', { class: 'badge' }, String(badge)) : null);
  return onTap(b, () => { sfx('tap'); fn(); });
}

function holdToOpen(btn, fn) {
  let t = null;
  const start = () => {
    btn.classList.add('holding');
    t = setTimeout(() => { btn.classList.remove('holding'); fn(); }, 1600);
  };
  const end = () => { btn.classList.remove('holding'); clearTimeout(t); };
  btn.addEventListener('pointerdown', start);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(e => btn.addEventListener(e, end));
}

// ================================================================ Lesson runner
function wordsUpTo(i) {
  const seen = new Map();
  LESSONS.slice(0, i + 1).forEach((L, k) => {
    const known = knownAt(k);
    parseWords(L.words).forEach(x => {
      if (!seen.has(x.w) || (x.e && !seen.get(x.w).e)) seen.set(x.w, { ...x, seg: segment(x.w, known.g), lesson: k });
    });
  });
  return [...seen.values()];
}
const pictureWordsUpTo = i => wordsUpTo(i).filter(x => x.e);

// Sentences known by lesson i, newest first.
function sentencesUpTo(i) {
  return LESSONS.slice(0, i + 1).reverse().flatMap(L => parseSentences(L.id));
}

// Word Ladder: a chain of 3 (or 2) words, each one sound away from the last.
function ladderChain(words, prefer) {
  const ok = words.filter(x => x.seg && x.seg.length >= 3 && x.seg.length <= 4 && !x.seg.some(g => isSplit(g) || g === SILENT_E));
  const step = (a, b) => a.w !== b.w && a.seg.length === b.seg.length && a.seg.filter((g, k) => g !== b.seg[k]).length === 1;
  for (const start of shuffle(ok.filter(x => prefer.has(x.lesson))).concat(shuffle(ok))) {
    const next = shuffle(ok.filter(x => step(start, x)));
    for (const b of next) {
      const c = shuffle(ok.filter(x => x !== start && step(b, x)))[0];
      if (c) return [start, b, c];
    }
    if (next.length) return [start, next[0]];
  }
  return null;
}

// Spelling Detective: one sound with 2-3 known spellings, and words for each.
function sortRound(words, known, fresh) {
  const byIpa = {};
  [...known.g].forEach(g => (byIpa[GRAPHEMES[g].ipa] ||= []).push(g));
  const groups = Object.values(byIpa).filter(gs => gs.length >= 2)
    .map(gs => {
      const ws = {};
      gs.forEach(g => { ws[g] = words.filter(x => x.seg && x.seg.filter(t => gs.includes(t)).length === 1 && x.seg.includes(g)); });
      const usable = gs.filter(g => ws[g].length >= 2).slice(0, 3);
      return { gs: usable, ws, fresh: usable.some(g => fresh.includes(g)) };
    })
    .filter(x => x.gs.length >= 2);
  if (!groups.length) return null;
  const grp = shuffle(groups.filter(x => x.fresh))[0] || shuffle(groups)[0];
  const picked = shuffle(grp.gs.flatMap(g => shuffle(grp.ws[g]).slice(0, 2).map(x => ({ ...x, g })))).slice(0, 4);
  return { group: grp.gs, words: picked, fresh: grp.fresh };
}

// Dictation: which word gets spelled with sound tiles (the rest are picked).
function dictationFocus(s, known) {
  const cands = sentenceWords(s.t).map((w, index) => ({ w: w.toLowerCase(), index }))
    .filter(x => !known.h.has(x.w) && !NAMES.has(x.w) && x.w.length >= 3)
    .map(x => ({ ...x, seg: segment(x.w, known.g) }))
    .filter(x => x.seg && x.seg.length >= 3 && x.seg.length <= 5);
  const f = shuffle(cands)[0];
  return f ? { index: f.index, item: { w: f.w, seg: f.seg, e: null } } : null;
}

function lessonPlan(i) {
  const L = LESSONS[i];
  const known = knownAt(i);
  const prev = i > 0 ? knownAt(i - 1) : { g: new Set(), h: new Set() };
  const words = parseWords(L.words).map(x => ({ ...x, seg: segment(x.w, known.g), lesson: i }));
  const pics = words.filter(x => x.e);
  const hasNew = x => L.g.some(g => x.seg.includes(g));
  const ordered = [...shuffle(pics.filter(hasNew)), ...shuffle(pics.filter(x => !hasNew(x)))];
  const steps = [];

  if (prev.g.size) {
    const weak = store.pickReview([...prev.g], 4, 'g:');
    store.topConfusions(3).forEach(([k]) => { const t = k.split('|')[0]; if (prev.g.has(t) && !weak.includes(t)) weak.unshift(t); });
    steps.push(['pop', weak.slice(0, 5)]);
  }
  // New sounds in groups of up to 3, each group followed by a quick pop game.
  for (let k = 0; k < L.g.length; k += 3) {
    const grp = L.g.slice(k, k + 3);
    grp.forEach(g => steps.push(['meet', g]));
    // Every new sound is a target at least once; the rest are repeats or this lesson's earlier sounds.
    const n = Math.max(4, grp.length * 2);
    steps.push(['pop', shuffle([...grp, ...shuffle([...grp, ...L.g.slice(0, k)]).slice(0, n - grp.length)])]);
  }
  const nb = 2;
  ordered.slice(0, nb).forEach((w, k) => steps.push(['hop', w, k === 0]));
  if (L.review) steps.push(['speed', shuffle(pics).slice(0, 6)]);
  // Long words: chop them into parts.
  shuffle(words.filter(w => w.syl)).slice(0, 2).forEach(w => steps.push(['chop', w]));
  const forgeWords = shuffle(ordered.slice(nb).length >= 2 ? ordered.slice(nb) : ordered).slice(0, L.review ? 2 : 1);
  forgeWords.forEach(w => steps.push(['forge', w]));
  L.heart.forEach((hw, k) => steps.push(['heart', hw, k === 0]));

  // One word game and one sentence game (two in reviews), taking turns across lessons.
  const all = wordsUpTo(i);
  const recent = new Set([i, i - 1, i - 2]);
  const wordGames = [];
  if (pics.length >= 3) wordGames.push(() => ['memory', shuffle(pics).slice(0, store.level() === 0 ? 3 : 4)]);
  const chain = i >= 2 && ladderChain(all, recent);
  if (chain) wordGames.push(() => ['ladder', chain]);
  const sort = i >= 4 && sortRound(all, known, L.g);
  if (sort) wordGames.push(() => ['sort', sort.group, sort.words]);
  const variety = [];
  // A lesson that adds another spelling of a known sound always gets Spelling Detective.
  if (sort && sort.fresh) variety.push(['sort', sort.group, sort.words]);
  else if (wordGames.length) variety.push(wordGames[i % wordGames.length]());

  const sents = sentencesUpTo(i);
  const sensible = sents.filter(x => !x.silly), silly = sents.filter(x => x.silly);
  const sentGames = [];
  if (sensible.length) sentGames.push(() => ['build', sensible.find(x => x.lesson === L.id) || sensible[0]]);
  if (i >= 2 && silly.length) sentGames.push(() => ['silly', shuffle(silly.slice(0, 4))[0]]);
  if (i >= 4) {
    const s = shuffle(sensible.slice(0, 6))[0];
    const first = sentenceWords(s.t)[0];
    const canCap = !NAMES.has(first.toLowerCase()) && first !== 'I';
    const kinds = canCap ? (i >= 19 ? ['cap', 'stop'] : [Math.random() < 0.5 ? 'cap' : 'stop']) : ['stop'];
    sentGames.push(() => ['fix', s, kinds]);
  }
  if (i >= 7) {
    const short = sensible.filter(x => sentenceWords(x.t).length <= 5).slice(0, 8);
    const s = short.find(x => x.lesson === L.id) || shuffle(short)[0];
    if (s) sentGames.push(() => ['dict', s, dictationFocus(s, known)]);
  }
  const frames = FRAMES.filter(f => LESSONS.findIndex(x => x.id === f.from) <= i);
  if (frames.length) {
    const frame = frames[Math.max(0, frames.length - 1 - Math.floor(Math.random() * 2))];
    const things = shuffle(pictureWordsUpTo(i).filter(x => !NOT_THINGS.has(x.w) && x.seg.length <= 5));
    const fresh = things.filter(x => recent.has(x.lesson));
    const opts = [...fresh, ...things.filter(x => !fresh.includes(x))].slice(0, 3);
    if (opts.length === 3) sentGames.push(() => ['finish', frame, opts]);
  }
  if (sentGames.length) {
    variety.push(sentGames[i % sentGames.length]());
    if (L.review && sentGames.length > 1) variety.push(sentGames[(i + 1) % sentGames.length]());
  }

  const teach = shuffle(words.filter(w => !w.e && !w.syl)).concat(shuffle(pics)).slice(0, 2);
  steps.push(variety[0]);
  teach.forEach(w => steps.push(['pip', w]));
  variety.slice(1).forEach(v => steps.push(v));
  if (L.story) steps.push(['story', L.story]);
  return { L, known, steps: steps.filter(Boolean), all };
}

// Starts one activity of a lesson or of daily practice.
function runStep(G, type, a, b) {
  if (type === 'pop') return games.soundPop(G, a);
  if (type === 'meet') return games.meet(G, a);
  if (type === 'hop') return games.hop(G, a, b);
  if (type === 'forge') return games.forge(G, a);
  if (type === 'heart') return games.heartWord(G, a, b);
  if (type === 'pip') return games.teachPip(G, a, hatEmoji());
  if (type === 'speed') return games.speedRead(G, a);
  if (type === 'story') return games.story(G, a, { hat: hatEmoji() });
  if (type === 'chop') return games.chop(G, a);
  if (type === 'memory') return games.memory(G, a);
  if (type === 'ladder') return games.ladder(G, a);
  if (type === 'sort') return games.spellSort(G, a, b);
  if (type === 'build') return games.buildSentence(G, a);
  if (type === 'silly') return games.sillyOrNot(G, a);
  if (type === 'fix') return games.fixIt(G, a, b);
  if (type === 'dict') return games.dictation(G, a, b);
  if (type === 'finish') return games.finishSentence(G, a, b);
  return Promise.resolve({ right: 0, total: 0 });
}

async function startLesson(i) {
  const { L, known, steps, all } = lessonPlan(i);
  const wd = WORLDS[L.wi];
  const pool = pictureWordsUpTo(i);

  // Preload the audio this lesson needs.
  const need = ['n_praise1', 'n_oops1'];
  [...known.g].forEach(g => need.push('p_' + g, 'w_' + GRAPHEMES[g].key));
  pool.forEach(p => need.push('w_' + p.w));
  steps.forEach(s => {
    if (s[0] === 'pip') need.push('pw_' + s[1].w);
    if (['build', 'silly', 'fix', 'dict'].includes(s[0])) need.push(s[1].id, ...sentenceWords(s[1].t).map(w => 'w_' + w.toLowerCase()));
    if (s[0] === 'finish') need.push(s[1].id);
  });
  preload(Object.keys(LINES).map(k => 'n_' + k).concat(Object.keys(PIP_LINES).map(k => 'pl_' + k), need));

  const stage = h('div', { class: 'stage' });
  const dots = h('div', { class: 'progress' }, h('div', { class: 'progress-fill' }), h('div', { class: 'progress-pip', html: pipSVG('happy', hatEmoji()) }));
  const replayBtn = h('button', { class: 'btn round replay', 'aria-label': 'Hear again' }, '🔊');
  const home = h('button', { class: 'btn round back', 'aria-label': 'Map' }, '🏠');
  let aborted = false, abort;
  const abortP = new Promise(r => (abort = r));
  onTap(home, () => confirmLeave(() => { aborted = true; abort(null); stopSpeech(); G.onExit && G.onExit(); mapScreen(); }));
  let replayFn = null;
  onTap(replayBtn, () => { sfx('tap'); anim(replayBtn, 'boing'); replayFn && replayFn(); });
  const bg = themeBg(wd.theme);
  show('lesson', h('div', { class: 'lesson' }, bg, h('div', { class: 'topbar' }, home, dots, gemPill(), replayBtn), stage), wd.theme);
  audio.startMusicIfOn();

  let gemsEarned = 0;
  const G = {
    stage, known, pool, words: all, newG: L.g, hat: hatEmoji(),
    ra: { used: 0, max: 2 },   // "Read it to Pip" (optional): at most twice per lesson
    setReplay: fn => (replayFn = fn),
    gem: (el, n) => { gemsEarned += n; store.addGems(n); flyGems(el, n); setTimeout(refreshGems, 900); },
  };
  let right = 0, total = 0;
  for (let k = 0; k < steps.length; k++) {
    if (aborted) return;
    const p = k / steps.length;
    dots.firstChild.style.width = p * 100 + '%';
    dots.lastChild.style.left = p * 100 + '%';
    const [type, a, b] = steps[k];
    stage.className = 'stage step-' + type;
    for (const k in stage.dataset) delete stage.dataset[k];
    G.onExit = null;
    const run = runStep(G, type, a, b);
    const res = await Promise.race([run, abortP]);
    if (!res || aborted) return;
    right += res.right; total += res.total;
    await sleep(250);
  }
  dots.firstChild.style.width = '100%';
  dots.lastChild.style.left = '100%';
  const acc = total ? right / total : 1;
  const { stars, first } = store.completeLesson(L.id, acc);
  store.addGems(5);
  hatchScreen(L, stars, first, gemsEarned + 5);
}

// Soft floating shapes plus a few faint theme props behind the activities.
function themeBg(theme) {
  const spots = [[4, 18], [86, 26], [8, 62], [84, 70], [46, 8]];
  return h('div', { class: 'lesson-bg' },
    ...Array.from({ length: 8 }, (_, k) => h('i', { style: { '--k': k } })),
    h('div', { class: 'bg-scene', html: groundSVG(theme) }),
    ...DECOR[theme].slice(0, 5).map((e, k) => h('b', { class: 'bg-decor', style: { left: spots[k][0] + '%', top: spots[k][1] + '%', animationDelay: -k * 0.7 + 's' } }, e)));
}

function confirmLeave(yes) {
  const yesB = h('button', { class: 'btn big yes' }, '🏠');
  const noB = h('button', { class: 'btn big no' }, '▶');
  const m = h('div', { class: 'modal' }, h('div', { class: 'modal-card pop-in' },
    h('div', { class: 'modal-pip', html: pipSVG('sad', hatEmoji()) }), h('div', { class: 'row' }, noB, yesB)));
  onTap(yesB, () => { m.remove(); yes(); });
  onTap(noB, () => m.remove());
  document.body.append(m);
}

// ================================================================ Egg hatch + rewards
// How long the egg wobbles before it cracks (about a second; a tap cracks it sooner).
const HATCH_WAIT_MS = 1000;
async function hatchScreen(L, stars, first, gems) {
  const name = WORDLINGS[L.id];
  const egg = h('div', { class: 'hatch-egg', html: eggSVG(name, 0, L.review) });
  const rays = h('div', { class: 'rays' });
  const starsEl = h('div', { class: 'big-stars' }, ...[0, 1, 2].map(k => h('span', { class: k < stars ? 'on' : '' }, '⭐')));
  const wrap = h('div', { class: 'hatch' }, rays, starsEl, egg);
  show('hatch', wrap);
  starsEl.querySelectorAll('.on').forEach((s, k) => setTimeout(() => { s.classList.add('pop'); sfx('coin'); }, 400 + k * 350));
  confetti(60);
  performance.mark('hatch-shown');
  const repeat = !first && store.state().wordlings.includes(L.id);
  if (repeat) {
    // Replays award gems, not a second Wordling.
    await say('n_lesson_done');
    egg.remove();
    return finishRewards(wrap, gems, null);
  }
  const lastLesson = L.id === LESSONS[LESSONS.length - 1].id;
  // "Lesson complete!" plays while the egg wobbles; nothing waits for it before the crack.
  // The egg wobbles for about a second, then cracks by itself (a tap makes it crack sooner).
  const spoken = say('n_lesson_done');
  egg.classList.add('wobble');
  await new Promise(resolve => {
    let t = setTimeout(resolve, HATCH_WAIT_MS);
    onTap(egg, () => { clearTimeout(t); resolve(); });
  });
  egg.classList.remove('wobble');
  performance.mark('hatch-crack');
  for (let cracks = 1; cracks <= 3; cracks++) {
    sfx('crack');
    egg.innerHTML = eggSVG(name, cracks, L.review);
    anim(egg, 'shake', 400);
    burstAt(egg, 10, 'circle');
    if (cracks < 3) await sleep(250);
  }
  await sleep(300);
  sfx('fanfare');
  egg.classList.add('burst');
  burstAt(egg, 60);
  confetti(120);
  await sleep(350);
  const wl = h('div', { class: 'hatch-wl pop-in', html: wordlingSVG(name, false, { shell: true }) });
  const label = h('div', { class: 'wl-name pop-in' }, name);
  egg.replaceWith(h('div', { class: 'hatch-reveal' }, wl, label));
  store.addWordling(L.id);
  await spoken;   // never cut off "Lesson complete!"
  await say('n_egg_meet', 200, 'w_' + name.toLowerCase());
  onTap(wl, () => { anim(wl, 'jump', 700); say('w_' + name.toLowerCase()); });
  if (lastLesson) { confetti(200); sfx('fanfare'); await say('n_the_end'); }
  const worldEnd = LESSONS.filter(x => x.wi === L.wi).pop().id === L.id;
  finishRewards(wrap, gems, wl, lastLesson, first && worldEnd ? L.wi : null);
}

// bonusWi: after the first time a world's last lesson is finished, the "World complete! Bonus game!" moment comes next.
// after: something else to do instead of going back to the map (used by the bonus reward screen).
function finishRewards(wrap, gems, from, toFinished, bonusWi = null, after = null) {
  const pill = gemPill();
  const go = h('button', { class: 'btn big go pop-in' }, '▶');
  wrap.append(h('div', { class: 'reward-row' }, pill, go));
  flyGems(from || wrap, Math.min(8, gems));
  setTimeout(refreshGems, 1200);
  onTap(go, () => {
    sfx('tap');
    const next = after || (toFinished ? finishedScreen : mapScreen);
    if (bonusWi != null) worldCompleteMoment(bonusWi, next); else next();
  });
}

// ================================================================ Bonus games (one per world)
const BONUS_GEMS_PER_STAR = 5;

// "World complete! Bonus game!" then the world's game. Opening it counts as unlocking it, even if the child quits.
async function worldCompleteMoment(wi, next) {
  const kind = BONUS_KINDS[wi], info = BONUS_INFO[kind], wd = WORLDS[wi];
  store.recordBonus(wi);
  const go = h('button', { class: 'btn big go pop-in', 'aria-label': 'Play ' + info.title }, '▶');
  const pip = h('div', { class: 'practice-pip', html: pipSVG('wow', hatEmoji()) });
  const wrap = h('div', { class: 'hatch world-done' }, h('div', { class: 'rays' }), pip,
    h('div', { class: 'wd-title pop-in' }, 'World complete!'),
    h('div', { class: 'wd-world' }, wd.name),
    h('div', { class: 'wd-game pop-in' }, h('span', {}, info.icon), 'Bonus game: ' + info.title),
    go);
  show('hatch', wrap, wd.theme);
  confetti(100); sfx('fanfare');
  onTap(pip, () => { anim(pip, 'jump', 700); sfx('boing'); });
  say('n_world_done');
  let started = false;
  onTap(go, async () => {
    if (started) return;
    started = true; sfx('tap');
    await runBonus(wi, next);
  });
}

// Plays the game; a quit gives nothing; stars give gems (5 each) and a best that is kept.
async function runBonus(wi, next) {
  const kind = BONUS_KINDS[wi];
  let r;
  try { r = await (window.__wwPlayMilestone || playMilestone)(kind, wi); } catch (e) { console.error("bonus game failed", e); r = { score: 0, stars: 0, quit: true }; }
  store.recordBonus(wi, r.quit ? {} : { stars: r.stars, score: r.score });
  const stars = r.quit ? 0 : r.stars | 0;
  if (stars > 0) bonusReward(stars, stars * BONUS_GEMS_PER_STAR, next); else next();
}

function bonusReward(stars, gems, next) {
  store.addGems(gems);
  const starsEl = h('div', { class: 'big-stars' }, ...[0, 1, 2].map(k => h('span', { class: k < stars ? 'on' : '' }, '⭐')));
  const pip = h('div', { class: 'practice-pip', html: pipSVG('wow', hatEmoji()) });
  const wrap = h('div', { class: 'hatch practice-done' }, h('div', { class: 'rays' }), starsEl, pip);
  show('hatch', wrap);
  starsEl.querySelectorAll('.on').forEach((el, k) => setTimeout(() => { el.classList.add('pop'); sfx('coin'); }, 400 + k * 350));
  confetti(80); sfx('fanfare');
  onTap(pip, () => { anim(pip, 'jump', 700); sfx('boing'); });
  say('n_praise' + (1 + Math.floor(Math.random() * 12)));
  finishRewards(wrap, gems, pip, false, null, next);
}

// ================================================================ Daily practice
// A short mix of what is due for review across every world finished so far, using the usual activities.
// It never runs out: what is due comes first, then the weakest, then anything not yet seen.
const finishedIndex = () => LESSONS.reduce((m, L, i) => (store.state().done[L.id] ? i : m), -1);

function practicePlan() {
  const idx = Math.max(3, finishedIndex());
  const known = knownAt(idx);
  const all = wordsUpTo(idx);
  const pics = all.filter(x => x.e && x.seg);
  const byWord = new Map(all.map(x => [x.w, x]));
  const used = new Set();
  const pickWords = (pool, n) => store.pickDue(pool.filter(x => !used.has(x.w)).map(x => x.w), n, 'w:').map(w => { used.add(w); return byWord.get(w); });
  const steps = [];
  steps.push(['pop', store.pickDue([...known.g], 4, 'g:')]);
  pickWords(pics, 2).forEach((w, k) => steps.push(['hop', w, k === 0]));
  store.pickDue([...known.h], 2, 'h:').forEach(hw => steps.push(['heart', hw, false]));
  steps.push(['speed', pickWords(pics, 3)]);
  steps.push(['memory', pickWords(pics, 3)]);
  const sents = sentencesUpTo(idx);
  const sensible = sents.filter(x => !x.silly), silly = sents.filter(x => x.silly);
  const day = Math.floor(Date.now() / 86400000);
  if (silly.length && (day % 2 === 0 || !sensible.length)) steps.push(['silly', shuffle(silly)[0]]);
  else if (sensible.length) steps.push(['build', shuffle(sensible.slice(0, 10))[0]]);
  const spell = pickWords(all.filter(x => x.seg.length <= 5 && x.seg.length >= 3 && !x.syl), 1)[0];
  if (spell) steps.push(['forge', spell]);
  return { idx, known, all, pics, steps: steps.filter(Boolean) };
}

async function startPractice() {
  const { idx, known, all, pics, steps } = practicePlan();
  const doneIdx = LESSONS.map((L, i) => (store.state().done[L.id] ? i : -1)).filter(i => i >= 0);
  const wd = WORLDS[LESSONS[shuffle(doneIdx)[0] ?? idx].wi];
  const need = ['n_praise1', 'n_oops1', 'n_practice_go'];
  steps.forEach(st => {
    if (st[0] === 'pop') st[1].forEach(g => need.push('p_' + g));
    if (st[0] === 'hop' || st[0] === 'forge') { need.push('w_' + st[1].w); st[1].seg.forEach(g => need.push('p_' + g)); }
    if (st[0] === 'heart') need.push('w_' + st[1]);
    if (st[0] === 'speed' || st[0] === 'memory') st[1].forEach(x => { need.push('w_' + x.w); x.seg.forEach(g => need.push('p_' + g)); });
    if (st[0] === 'build' || st[0] === 'silly') need.push(st[1].id, ...sentenceWords(st[1].t).map(w => 'w_' + w.toLowerCase()));
  });
  preload(Object.keys(LINES).map(k => 'n_' + k).concat(Object.keys(PIP_LINES).map(k => 'pl_' + k), need));

  const stage = h('div', { class: 'stage' });
  const dots = h('div', { class: 'progress' }, h('div', { class: 'progress-fill' }), h('div', { class: 'progress-pip', html: pipSVG('happy', hatEmoji()) }));
  const replayBtn = h('button', { class: 'btn round replay', 'aria-label': 'Hear again' }, '🔊');
  const home = h('button', { class: 'btn round back', 'aria-label': 'Map' }, '🏠');
  let aborted = false, abort;
  const abortP = new Promise(r => (abort = r));
  onTap(home, () => confirmLeave(() => { aborted = true; abort(null); stopSpeech(); G.onExit && G.onExit(); mapScreen(); }));
  let replayFn = null;
  onTap(replayBtn, () => { sfx('tap'); anim(replayBtn, 'boing'); replayFn && replayFn(); });
  show('lesson', h('div', { class: 'lesson' }, themeBg(wd.theme), h('div', { class: 'topbar' }, home, dots, gemPill(), replayBtn), stage), wd.theme);
  audio.startMusicIfOn();

  let gemsEarned = 0;
  const G = {
    stage, known, pool: pics, words: all, newG: [], hat: hatEmoji(), practice: true,
    ra: { used: 2, max: 2 },   // no microphone step in daily practice
    setReplay: fn => (replayFn = fn),
    gem: (el, n) => { gemsEarned += n; store.addGems(n); flyGems(el, n); setTimeout(refreshGems, 900); },
  };
  say('n_practice_go');
  await sleep(1800);
  let right = 0, total = 0;
  for (let k = 0; k < steps.length; k++) {
    if (aborted) return;
    const p = k / steps.length;
    dots.firstChild.style.width = p * 100 + '%';
    dots.lastChild.style.left = p * 100 + '%';
    const [type, a, b] = steps[k];
    stage.className = 'stage step-' + type;
    for (const key in stage.dataset) delete stage.dataset[key];
    G.onExit = null;
    const res = await Promise.race([runStep(G, type, a, b), abortP]);
    if (!res || aborted) return;
    right += res.right; total += res.total;
    await sleep(250);
  }
  dots.firstChild.style.width = '100%';
  dots.lastChild.style.left = '100%';
  practiceDone(total ? right / total : 1, gemsEarned);
}

// The small reward at the end of daily practice: a stamp, and gems (more for the first round of the day).
async function practiceDone(acc, earned) {
  const stars = acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : 1;
  const { first } = store.recordPractice();
  const bonus = first ? 10 : 3;
  store.addGems(bonus);
  const badge = h('div', { class: 'practice-badge pop-in' }, '🌟');
  const starsEl = h('div', { class: 'big-stars' }, ...[0, 1, 2].map(k => h('span', { class: k < stars ? 'on' : '' }, '⭐')));
  const pip = h('div', { class: 'practice-pip', html: pipSVG('wow', hatEmoji()) });
  const wrap = h('div', { class: 'hatch practice-done' }, h('div', { class: 'rays' }), starsEl, badge, pip);
  show('hatch', wrap);
  starsEl.querySelectorAll('.on').forEach((s, k) => setTimeout(() => { s.classList.add('pop'); sfx('coin'); }, 400 + k * 350));
  confetti(80); sfx('fanfare');
  onTap(badge, () => { anim(badge, 'jump', 700); sfx('boing'); });
  await say('n_practice_done');
  finishRewards(wrap, earned + bonus, badge);
}

// Shown after the very last lesson: where to go next.
function bigBtn(icon, label, fn) {
  return onTap(h('button', { class: 'end-btn' }, h('span', { class: 'end-ico' }, icon), h('span', { class: 'end-lbl' }, label)), () => { sfx('tap'); fn(); });
}
function finishedScreen() {
  const card = (icon, title, fn, cls) => onTap(h('button', { class: 'arcade-card pop-in ' + cls },
    h('div', { class: 'arc-ico' }, icon), h('div', { class: 'arc-title' }, title)), () => { sfx('tap'); fn(); });
  show('arcade-menu', h('div', { class: 'arcade finished' },
    h('div', { class: 'hud' }, backBtn(mapScreen), h('div', { class: 'hud-spacer' }), gemPill()),
    h('div', { class: 'finished-pip', html: pipSVG('wow', hatEmoji()) }),
    h('div', { class: 'arcade-cards' }, card('🌟', 'Daily practice', startPractice, 'fin-practice'), card('📚', 'Big books', () => libraryScreen('big'), 'fin-books'))));
  confetti(60);
  say('n_end_next');
}

// ================================================================ Zoo
function zooScreen() {
  const s = store.state();
  const meadow = h('div', { class: 'meadow' });
  const roamers = s.wordlings.map((id, k) => {
    const name = WORDLINGS[id];
    const wl = h('div', { class: 'roam', style: { '--d': (6 + (k % 5)) + 's', '--dx': ((k % 2 ? 1 : -1) * (8 + k * 7 % 14)) + 'px' } },
      h('div', { class: 'roam-body', html: wordlingSVG(name) }), h('div', { class: 'roam-name' }, name));
    onTap(wl, () => { anim(wl, 'jump', 700); sfx('boing'); say('w_' + name.toLowerCase()); burstAt(wl, 12); });
    meadow.append(wl);
    return wl;
  });
  // Lay the chicks out on a loose grid sized to the meadow, so even 34 of them each have their own spot.
  const layout = () => {
    const r = meadow.getBoundingClientRect(), n = roamers.length;
    if (!n || !r.width) return;
    const cols = Math.max(1, Math.round(Math.sqrt(n * r.width / Math.max(1, r.height))));
    const rows = Math.ceil(n / cols);
    const cw = r.width / cols, ch = r.height / rows;
    const size = Math.max(46, Math.min(cw * 0.96, ch * 0.78, 150));
    roamers.forEach((wl, k) => {
      const c = k % cols, row = Math.floor(k / cols);
      wl.style.width = size + 'px';
      wl.style.left = c * cw + (cw - size) / 2 + ((row % 2) ? cw * 0.06 : -cw * 0.04) + 'px';
      wl.style.top = row * ch + (ch - size * 1.15) / 2 + 'px';
      wl.firstChild.nextSibling.style.fontSize = Math.max(11, Math.min(24, size * 0.2)) + 'px';
    });
  };
  const shelf = h('div', { class: 'collection' }, Object.entries(WORDLINGS).map(([id, name]) => {
    const got = s.wordlings.includes(id);
    const card = h('div', { class: 'zslot' + (got ? ' got' : ''), 'data-id': id },
      h('div', { class: 'zslot-art', html: wordlingSVG(name, !got) }), h('div', { class: 'zslot-name' }, got ? name : '?'));
    if (got) onTap(card, () => { anim(card, 'boing'); sfx('boing'); say('w_' + name.toLowerCase()); });
    return card;
  }));
  show('zoo', h('div', { class: 'zoo' },
    h('div', { class: 'hud' }, backBtn(mapScreen), h('div', { class: 'count-pill' }, `🐾 ${s.wordlings.length} / ${Object.keys(WORDLINGS).length}`), gemPill()),
    meadow, shelf));
  layout();
  requestAnimationFrame(layout);
  say(s.wordlings.length ? 'n_zoo' : 'n_map_tap');
}

// ================================================================ Shop
function shopScreen() {
  const s = store.state();
  const pip = h('div', { class: 'shop-pip', html: pipSVG('happy', hatEmoji()) });
  const grid = h('div', { class: 'hat-grid' });
  const render = () => {
    grid.innerHTML = '';
    HATS.forEach(hat => {
      const owned = s.hats.includes(hat.id);
      const b = h('button', { class: 'hat-btn' + (s.hat === hat.id ? ' on' : '') + (owned ? ' owned' : '') },
        h('span', { class: 'hat-e' }, hat.e || '🚫'),
        owned ? h('span', { class: 'hat-cost ok' }, s.hat === hat.id ? '✔' : '') : h('span', { class: 'hat-cost' }, '💎' + hat.cost));
      onTap(b, () => {
        if (!owned) {
          if (s.gems < hat.cost) { sfx('bad'); anim(b, 'shake'); anim(document.querySelector('.gem-pill'), 'shake'); return; }
          store.addGems(-hat.cost); s.hats.push(hat.id); sfx('coin'); burstAt(b, 20); refreshGems();
        }
        s.hat = hat.id; store.save(); sfx('sparkle');
        pip.innerHTML = pipSVG('wow', hat.e); anim(pip, 'jump', 700);
        setTimeout(() => (pip.innerHTML = pipSVG('happy', hat.e)), 900);
        render();
      });
      grid.append(b);
    });
  };
  render();
  show('shop', h('div', { class: 'shop' }, h('div', { class: 'hud' }, backBtn(mapScreen), h('div', { class: 'hud-spacer' }), gemPill()), pip, grid));
  say('n_shop');
}

// ================================================================ Library
// Big books are for children who have finished every world. Each one opens after the one before it has been read.
const worldOneDone = () => WORLDS[0].lessons.every(L => store.state().done[L.id]);
const everythingDone = () => LESSONS.every(L => store.state().done[L.id]);
function bigBookState() {
  const s = store.state();
  const ids = Object.keys(BOOKS);
  const all = everythingDone();
  return ids.map((id, i) => ({ id, read: s.books.includes(id), open: all && (i === 0 || s.books.includes(ids[i - 1])) }));
}

function libraryScreen(focus) {
  const s = store.state();
  const shelf = h('div', { class: 'shelf' });
  Object.entries(STORIES).forEach(([id, st]) => {
    const got = s.books.includes(id);
    const b = h('button', { class: 'book' + (got ? '' : ' locked') }, h('span', { class: 'book-e' }, got ? st.cover : '🔒'), h('span', { class: 'book-t' }, got ? st.title : ''));
    if (got) onTap(b, () => { sfx('tap'); rereadStory(id); });
    shelf.append(b);
  });
  let bigShelf = null, bigTitle = null;
  if (everythingDone()) {
    bigTitle = h('div', { class: 'shelf-title' }, h('span', {}, '📚'), 'Big books');
    bigShelf = h('div', { class: 'shelf big-shelf' });
    bigBookState().forEach(b => {
      const bk = BOOKS[b.id];
      const el = h('button', { class: 'book big' + (b.open ? '' : ' locked') + (b.open && !b.read ? ' fresh' : ''), 'data-book': b.id },
        h('span', { class: 'book-e' }, b.open ? bk.cover : '🔒'), h('span', { class: 'book-t' }, b.open ? bk.title : ''));
      onTap(el, () => {
        if (b.open) { sfx('tap'); rereadStory(b.id); }
        else { sfx('bad'); anim(el, 'shake'); say('n_book_locked'); }
      });
      bigShelf.append(el);
    });
  }
  show('library', h('div', { class: 'library' }, h('div', { class: 'hud' }, backBtn(mapScreen), h('div', { class: 'hud-spacer' }), gemPill()), shelf, bigTitle, bigShelf));
  say(focus === 'big' && bigShelf ? 'n_bigbooks' : 'n_library');
  if (focus === 'big' && bigTitle) requestAnimationFrame(() => bigTitle.scrollIntoView({ block: 'start' }));
}

async function rereadStory(id) {
  const isBook = !!BOOKS[id];
  const lessonIdx = isBook ? LESSONS.length - 1 : LESSONS.findIndex(L => L.story === id);
  const stage = h('div', { class: 'stage step-story' });
  let replayFn = null;
  const replayBtn = h('button', { class: 'btn round replay' }, '🔊');
  onTap(replayBtn, () => replayFn && replayFn());
  const theme = WORLDS[LESSONS[lessonIdx].wi].theme;
  let aborted = false, abort; const abortP = new Promise(r => (abort = r));
  // A big book read for the first time is a real first reading (its questions are saved); a book already read is a re-read.
  const alreadyRead = store.state().books.includes(id);
  show('story', h('div', { class: 'lesson' }, themeBg(theme),
    h('div', { class: 'topbar' }, backBtn(() => { aborted = true; abort(null); libraryScreen(isBook ? 'big' : undefined); }), h('div', { class: 'hud-spacer' }), gemPill(), replayBtn), stage), theme);
  const G = { stage, known: knownAt(lessonIdx), pool: pictureWordsUpTo(lessonIdx), setReplay: f => (replayFn = f), hat: hatEmoji(), ra: { used: 0, max: 1 },
    gem: (el, n) => { store.addGems(n); flyGems(el, n); setTimeout(refreshGems, 900); } };
  const res = await Promise.race([games.story(G, id, { reread: alreadyRead, hat: hatEmoji() }), abortP]);
  if (res && !aborted) libraryScreen(isBook ? 'big' : undefined);
}

// ================================================================ Arcade
function arcadeScreen() {
  const s = store.state();
  const doneIdx = Math.max(0, LESSONS.reduce((m, L, i) => (s.done[L.id] ? i : m), 0));
  const card = (icon, title, best, fn) => onTap(h('button', { class: 'arcade-card pop-in' },
    h('div', { class: 'arc-ico' }, icon), h('div', { class: 'arc-title' }, title), h('div', { class: 'arc-best' }, '🏆 ' + best)), () => { sfx('tap'); fn(); });
  // One bonus game per world: locked until the world is finished, then replayable with the best stars kept.
  const bonus = WORLDS.map((wd, wi) => {
    const info = BONUS_INFO[BONUS_KINDS[wi]];
    const open = store.bonusUnlocked(wi), best = store.bonusBest(wi);
    const b = h('button', { class: 'bonus-card pop-in' + (open ? '' : ' locked'), 'data-world': String(wi), 'data-kind': BONUS_KINDS[wi], 'aria-label': open ? info.title : info.title + ' (locked)' },
      h('div', { class: 'bonus-ico' }, open ? info.icon : '🔒'),
      h('div', { class: 'bonus-name' }, info.title),
      h('div', { class: 'bonus-sub' }, open ? '⭐'.repeat(best.stars) + '☆'.repeat(3 - best.stars) : 'Finish World ' + (wi + 1) + '!'));
    onTap(b, () => {
      if (open) { sfx('tap'); runBonus(wi, arcadeScreen); } else { sfx('bad'); anim(b, 'shake'); }
    });
    return b;
  });
  show('arcade-menu', h('div', { class: 'arcade play' },
    h('div', { class: 'hud' }, backBtn(mapScreen), h('div', { class: 'hud-spacer' }), gemPill()),
    h('div', { class: 'arcade-scroll' },
      h('div', { class: 'arcade-cards' },
        card('🫧', 'Bubble Blitz', s.best.pop, () => playArcade('pop', doneIdx)),
        card('🐤', 'Hop Read', s.best.rocket, () => playArcade('hop', doneIdx)),   // the saved best keeps its old key (best.rocket)
        card('🃏', 'Memory Match', s.best.memory || 0, () => playArcade('memory', doneIdx))),
      h('div', { class: 'bonus-title' }, '🌟 Bonus games'),
      h('div', { class: 'bonus-grid' }, ...bonus))));
}

async function playArcade(kind, idx) {
  const known = knownAt(idx);
  const pool = pictureWordsUpTo(idx);
  const stage = h('div', { class: 'stage step-' + { pop: 'pop', hop: 'speed', memory: 'memory' }[kind] });
  let replayFn = null;
  const replayBtn = h('button', { class: 'btn round replay' }, '🔊');
  onTap(replayBtn, () => replayFn && replayFn());
  let aborted = false, abort; const abortP = new Promise(r => (abort = r));
  const G = { stage, known, pool, setReplay: f => (replayFn = f),
    gem: (el, n) => { store.addGems(n); flyGems(el, n); setTimeout(refreshGems, 900); } };
  show('arcade', h('div', { class: 'lesson' }, themeBg(WORLDS[LESSONS[idx].wi].theme),
    h('div', { class: 'topbar' }, backBtn(() => { aborted = true; abort(null); G.onExit && G.onExit(); arcadeScreen(); }), h('div', { class: 'hud-spacer' }), gemPill(), replayBtn), stage),
  WORLDS[LESSONS[idx].wi].theme);
  audio.startMusicIfOn();
  preload([...known.g].map(g => 'p_' + g).concat(pool.map(p => 'w_' + p.w), ['n_memory_go']));
  await say('n_arcade_go');
  const run = kind === 'pop' ? games.soundPop(G, shuffle([...known.g]), { seconds: 60 })
    : kind === 'memory' ? games.memory(G, shuffle(pool).slice(0, 6))
    : games.speedRead(G, pool, { seconds: 60 });
  const res = await Promise.race([run, abortP]);
  if (!res || aborted) return;
  const s = store.state();
  const key = kind === 'hop' ? 'rocket' : kind;   // saved under its old name so earlier saves keep their best
  const isBest = res.score > (s.best[key] || 0);
  if (isBest) { s.best[key] = res.score; store.save(); }
  stage.innerHTML = '';
  const go = h('button', { class: 'btn big go' }, '▶');
  stage.append(h('div', { class: 'center-col' }, h('div', { class: 'final-score pop-in' }, (isBest ? '🏆 ' : '') + res.score), go));
  confetti(isBest ? 160 : 60);
  sfx('fanfare');
  await say('n_arcade_done');
  onTap(go, arcadeScreen);
}

// ================================================================ Parent corner
function parentScreen() {
  stopSpeech();
  const s = store.state();
  const cur = store.currentIndex();
  const L = LESSONS[cur];
  const acc = Math.round(store.accuracy() * 100);
  const sounds = Object.keys(GRAPHEMES).map(g => {
    const m = store.mastery('g:' + g);
    const b = h('button', { class: 'snd m' + m, title: 'Play sound', 'data-g': g }, label(g) + (g === 'y2' ? ' (ee)' : g === 'y3' ? ' (igh)' : ''));
    onTap(b, () => { audio.unlock(); audio.tap('p_' + g); });
    return b;
  });
  const conf = store.topConfusions(5);
  const weakWords = Object.entries(s.items).filter(([k, v]) => k.startsWith('w:') && v.n >= 2 && v.c / v.n < 0.6).map(([k]) => k.slice(2)).slice(0, 12);
  const music = h('input', { type: 'checkbox', checked: s.settings.music ? '' : null });
  music.onchange = () => { s.settings.music = music.checked; store.save(); audio.setMusic(music.checked); };
  // "Read it to Pip": off unless a grown-up turns it on. Turning it on asks for the microphone right here.
  const rap = h('input', { type: 'checkbox', checked: s.settings.readAloud ? '' : null });
  const raMsg = h('p', { class: 'tip ra-msg' });
  rap.onchange = async () => {
    if (!rap.checked) { s.settings.readAloud = false; store.save(); raMsg.textContent = ''; return; }
    raMsg.textContent = 'Asking this device for the microphone…';
    const r = await readaloud.probe();
    if (r === 'ok') { s.settings.readAloud = true; store.save(); raMsg.textContent = 'On. The microphone is only used when your child taps it.'; }
    else {
      rap.checked = false; s.settings.readAloud = false; store.save();
      raMsg.textContent = r === 'unsupported' ? 'This device or browser cannot record, so Read it to Pip stays off.'
        : 'The microphone is blocked. Allow it for this site in the browser or device settings, then try again.';
    }
  };
  const what = l => l.g.length ? l.g.map(label).join(' ') : l.focus || 'review';
  const jumpSel = h('select', {}, ...LESSONS.map((l, i) => h('option', { value: i, selected: i === Math.max(cur, s.unlocked) ? '' : null }, `${l.id} — ${WORLDS[l.wi].name}: ${what(l)}`)));
  const jumpBtn = h('button', { class: 'pbtn' }, 'Open up to here');
  jumpBtn.onclick = () => {
    const to = +jumpSel.value;
    s.unlocked = to + 1;
    // Mark earlier lessons as done so the path continues from the chosen point.
    LESSONS.slice(0, to).forEach(l => { if (!s.done[l.id]) s.done[l.id] = { stars: 1, acc: 0, plays: 0, skipped: true }; });
    store.save(); jumpBtn.textContent = 'Done ✓';
  };
  const resetBtn = h('button', { class: 'pbtn danger' }, 'Reset all progress');
  let resetArm = false;
  resetBtn.onclick = () => {
    if (!resetArm) { resetArm = true; resetBtn.textContent = 'Tap again to erase everything'; return; }
    store.reset(); mapScreen();
  };

  const st = cloud.cloudStatus();
  const acctMsg = h('p', { class: 'tip' });
  const acctBtns = [];
  if (s.name && s.cloud) {
    const chg = h('button', { class: 'pbtn' }, 'Change secret code');
    chg.onclick = async () => { const ok = await changeCode(); parentScreen(); setTimeout(() => { const m = document.querySelector('.acct-msg'); if (m) m.textContent = ok ? 'New secret code saved.' : 'Code not changed (are you online?).'; }, 50); };
    const sync = h('button', { class: 'pbtn' }, 'Sync now');
    sync.onclick = async () => { sync.textContent = 'Syncing…'; await cloud.sync(); await cloud.push(); sync.textContent = cloud.cloudStatus() === 'ok' ? 'Synced ✓' : 'Offline — will retry'; };
    acctBtns.push(chg, sync);
  } else if (s.name) {
    const join = h('button', { class: 'pbtn' }, 'Turn on cloud save');
    join.onclick = async () => {
      const r = await joinCloud(); parentScreen();
      const msg = { ok: 'Cloud save is on.', taken: `Someone already has a cloud save called ${s.name}. Sign out and pick a different name.`, offline: 'No internet right now. Try again later.', name: 'Sign out and sign in with a real name first.', cancel: '' }[r];
      setTimeout(() => { const m = document.querySelector('.acct-msg'); if (m) m.textContent = msg; }, 50);
    };
    acctBtns.push(join);
  }
  const out = h('button', { class: 'pbtn' }, s.name ? 'Sign out / switch player' : 'Sign in');
  let outArm = false;
  out.onclick = async () => {
    if (s.name && !s.cloud && !outArm) { outArm = true; out.textContent = 'Not saved to the cloud: tap again to sign out and lose it'; return; }
    if (s.cloud) await cloud.push();
    if (s.name) store.signOut();
    titleScreen();
  };
  acctBtns.push(out);
  acctMsg.className = 'tip acct-msg';

  const el = h('div', { class: 'parent' },
    h('div', { class: 'p-head' }, h('button', { class: 'pbtn', onclick: mapScreen }, '← Back to the game'), h('h2', {}, 'Grown-ups')),
    h('div', { class: 'p-grid' },
      pcard('Player',
        h('p', {}, s.name ? h('b', {}, s.name) : 'Not signed in', s.name ? (s.cloud ? ` · cloud save ${st === 'ok' ? 'up to date ✓' : st === 'saving' ? 'saving…' : st === 'denied' ? 'refused (code changed on another device? sign out and back in)' : 'waiting for internet'}` : ' · saved on this device only') : ''),
        h('p', { class: 'tip' }, 'Sign in on any iPad or iPhone with the same name and secret code to carry on from where you left off.'),
        h('div', { class: 'p-row' }, acctBtns), acctMsg),
      pcard('Progress',
        h('p', {}, h('b', {}, `${Object.keys(s.done).length} of ${LESSONS.length}`), ' lessons done. Next up: ', h('b', {}, `${L.id} (${what(L)})`)),
        h('p', {}, 'Recent accuracy: ', h('b', {}, acc + '%'), ' — the game adjusts difficulty to keep this near 85%.'),
        h('p', {}, 'Letters traced: ', h('b', {}, String(Object.keys(s.trace || {}).length)), ' sounds so far (a finger-tracing step follows each new sound).'),
        h('p', {}, 'Played today: ', h('b', {}, Math.round(store.minutesToday()) + ' min'), `. Books read: ${s.books.length}. Wordlings: ${s.wordlings.length}.`),
        h('p', { class: 'p-reads' }, 'Book pages read aloud to Pip: ', h('b', {}, String(store.pagesReadAloud())), s.settings.readAloud ? '.' : ' (the microphone option in Settings offers it after each page).')),
      pcard('Understanding stories', ...comprehensionCard()),
      pcard('Reading speed', ...speedCard()),
      pcard('Daily practice and big books', ...practiceCard()),
      pcard('Sounds (tap to hear)',
        h('div', { class: 'snd-grid' }, sounds),
        h('p', { class: 'legend' }, h('i', { class: 'snd m-1' }), 'not seen ', h('i', { class: 'snd m0' }), 'learning ', h('i', { class: 'snd m2' }), 'getting there ', h('i', { class: 'snd m4' }), 'secure')),
      pcard('Worth practising together',
        conf.length ? h('p', {}, 'Mix-ups: ', conf.map(([k, n]) => { const [a, b] = k.split('|'); return h('span', { class: 'chip' }, `heard ${a}, picked ${b} ×${n}`); })) : h('p', {}, 'No repeated mix-ups yet.'),
        weakWords.length ? h('p', {}, 'Tricky words: ', weakWords.map(w => h('span', { class: 'chip' }, w))) : null,
        h('p', { class: 'tip' }, 'Tip: after each story, ask your child to read it to you again. Re-reading builds fluency.')),
      pcard('Settings',
        h('label', {}, music, ' Background music'),
        h('label', {}, rap, ' “Read it to Pip” (microphone)'),
        h('p', { class: 'tip' }, 'Your child can read a word or a book page aloud (the book pages are offered after every word has been tapped) and hear themselves, then hear the model. The recording stays on this device, is never saved or sent anywhere, and is deleted straight after it plays.'),
        raMsg,
        h('label', {}, 'Already reading? Skip ahead to ', jumpSel), jumpBtn,
        h('div', { class: 'p-row' }, resetBtn)),
      pcard('How Wordwild teaches',
        h('p', {}, 'Systematic synthetic phonics: a few sounds at a time, blending them into words, then reading short books that use only the sounds already taught — no guessing from pictures.'),
        h('p', {}, 'Each lesson: review → new sound → pop, blend, spell and “teach Pip” games → a word game (memory, word ladder, spelling detective, syllable chop) → a sentence game (build it, silly or sensible, fix it, dictation, finish the sentence) → a decodable story → a Wordling egg. Sounds and words come back for review on a spaced schedule.'),
        h('p', {}, 'Seven worlds: single sounds, digraphs and long vowels (worlds 1–4); consonant blends, two-part words and y saying “ee” (5); other spellings of vowel sounds such as ay, ou, ea, ie, oy, ir, er, aw and ew (6); split vowels a‑e, i‑e, o‑e, u‑e, plus wh and ph (7).')),
      pcard('Credits & licences',
        h('p', {}, 'The letter sounds are recordings from Literacy Hub (© Commonwealth of Australia), used under CC BY 4.0.'),
        h('button', { class: 'pbtn', onclick: () => creditsScreen(parentScreen) }, 'Credits & licences')),
    ));
  show('parent', el);
}
// ---------- Grown-ups corner: story questions, reading speed, daily practice ----------
const pct = (c, n) => (n ? Math.round(100 * c / n) : 0);
const secs = x => Math.max(1, Math.round(x));

function comprehensionCard() {
  const c = store.comprehension();
  const n = c.k.lit.n + c.k.think.n, r = c.k.lit.c + c.k.think.c;
  if (!n) return [
    h('p', { class: 'p-comp' }, 'No story questions answered yet.'),
    h('p', { class: 'tip' }, 'After each story your child answers 2 or 3 spoken questions about it: who, what or where, and (from World 3) a “why” or “how did they feel” question.'),
  ];
  const weak = Object.entries(c.s).filter(([, t]) => t.n >= 2 && t.c / t.n < 0.5).map(([id]) => storyOf(id) && storyOf(id).title).filter(Boolean).slice(0, 5);
  return [
    h('p', { class: 'p-comp' }, h('b', {}, `${r} of ${n}`), ` story questions answered right first time (${pct(r, n)}%).`),
    h('p', { class: 'p-comp-kinds' }, 'Who, what, where: ', h('b', {}, `${c.k.lit.c} of ${c.k.lit.n}`),
      c.k.think.n ? [' · Why, how they felt, what happens next: ', h('b', {}, `${c.k.think.c} of ${c.k.think.n}`)] : null),
    weak.length ? h('p', {}, 'Worth reading again together: ', weak.map(t => h('span', { class: 'chip' }, t))) : null,
    h('p', { class: 'tip' }, 'Thinking questions are harder than who/what/where. When you read together, ask “why?” or “how do you think they felt?” on a page.'),
  ];
}

// "Reads a word in about 4 seconds, down from 7": earliest week against the latest, weeks with at least 5 readings.
function trend(rows, key, count, enough, lead, unit) {
  const ok = rows.filter(w => w[count] >= enough);
  if (!ok.length) return null;
  const last = ok[ok.length - 1][key];
  if (ok.length < 2) return `${lead} about ${secs(last)} ${unit} so far.`;
  const first = ok[0][key];
  if (secs(last) < secs(first) && last <= first - 0.4) return `${lead} about ${secs(last)} ${unit}, down from ${secs(first)}.`;
  if (secs(last) > secs(first) && last >= first + 0.4) return `${lead} about ${secs(last)} ${unit}, up from ${secs(first)}.`;
  return `${lead} about ${secs(last)} ${unit}, about the same as at the start.`;
}

function speedCard() {
  const weeks = store.readingWeeks();
  const word = trend(weeks.map(w => ({ words: w.words, word: w.word })), 'word', 'words', 5, 'Reads a word in', 'seconds');
  const sent = trend(weeks.map(w => ({ sentenceWords: w.sentenceWords, sentence: w.sentence })), 'sentence', 'sentenceWords', 10, 'In sentences, takes', 'seconds a word');
  const slow = store.slowWords(8, 3);
  const shown = weeks.filter(w => w.words > 0);
  const top = Math.max(1, ...shown.map(w => w.word));
  return [
    word || sent ? [word ? h('p', { class: 'p-speed' }, h('b', {}, word)) : null, sent ? h('p', { class: 'p-speed-sent' }, sent) : null]
      : h('p', { class: 'p-speed' }, 'Not enough yet. Reading speed is timed quietly while your child plays (about 5 words in a week are needed).'),
    shown.length > 1 ? h('div', { class: 'flu-bars', 'aria-label': 'Seconds per word, week by week' },
      shown.map(w => h('i', { style: { height: Math.max(8, Math.round(60 * w.word / top)) + 'px' }, title: `Week of ${w.week}: about ${secs(w.word)} seconds a word` }))) : null,
    slow.length ? h('p', { class: 'p-slow' }, 'Slowest words to practise together: ', slow.map(x => h('span', { class: 'chip' }, `${x.w} · ${secs(x.secs)} s`))) : h('p', { class: 'tip' }, 'Slow words will be listed here once some words have been read a few times.'),
    h('p', { class: 'tip' }, 'Timed from when a word appears until the right answer, not counting the time the voice is talking. Your child never sees a timer, and it has no effect on stars or gems. Use it as a trend, not a score.'),
  ];
}

function practiceCard() {
  const s = store.state();
  const read = Object.keys(BOOKS).filter(id => s.books.includes(id)).length;
  return [
    worldOneDone()
      ? h('p', { class: 'p-practice' }, 'Daily practice: ', h('b', {}, `${store.practiceDays(30)} of the last 30 days`), ` (${store.practiceRounds()} rounds in all). `, store.practicedToday() ? 'Done today.' : 'Not yet today.')
      : h('p', { class: 'p-practice' }, 'Daily practice opens on the map once World 1 is finished.'),
    everythingDone()
      ? h('p', { class: 'p-books' }, 'Big books read: ', h('b', {}, `${read} of ${Object.keys(BOOKS).length}`), '.')
      : h('p', { class: 'p-books' }, 'Eight longer books open one at a time once every world is finished.'),
    h('p', { class: 'tip' }, 'Daily practice mixes the sounds, words and heart words that are due for review across all the finished worlds, then ends with a small reward. It never runs out.'),
  ];
}

function pcard(title, ...kids) { return h('div', { class: 'pcard' }, h('h3', {}, title), ...kids); }

// ================================================================ Credits & licences
// Keep in step with app/THIRD_PARTY_NOTICES.md (tests/credits.py checks they match).
const link = url => h('a', { href: url, target: '_blank', rel: 'noopener' }, url);
function creditsScreen(back) {
  stopSpeech();
  const el = h('div', { class: 'parent credits' },
    h('div', { class: 'p-head' }, h('button', { class: 'pbtn', onclick: back }, '← Back'), h('h2', {}, 'Credits & licences')),
    h('div', { class: 'p-grid' },
      pcard('Letter sounds',
        h('p', { class: 'credit' },
          'Phonics audio adapted from “Phonemes and graphemes daily review”, Literacy Hub, © Commonwealth of Australia.', h('br'),
          'Licensed under Creative Commons Attribution 4.0 International (CC BY 4.0).', h('br'),
          'Source: ', link('https://www.literacyhub.edu.au/search/phonemes-and-graphemes-daily-review'), h('br'),
          'Licence: ', link('https://creativecommons.org/licenses/by/4.0/'), h('br'),
          'Changes: Audio extracted from the original PowerPoint presentation. Converted from M4A (AAC) to MP3 and from stereo (identical channels) to mono, trimmed leading/trailing silence and stray breath noise, kept only the first sound of one recording that says three sounds in a row, added short fades over the trimmed silence, and adjusted volume.', h('br'),
          'No endorsement by the original publisher or copyright owner is implied.'),
        h('p', { class: 'tip' }, 'This licence covers only the letter-sound recordings, not the rest of Wordwild. ',
          h('a', { href: 'THIRD_PARTY_NOTICES.md', target: '_blank', rel: 'noopener' }, 'Notices file'), ' · ',
          h('a', { href: 'licences/literacyhub-audio-manifest.json', target: '_blank', rel: 'noopener' }, 'Clip-by-clip details'))),
      pcard('Everything else',
        h('p', {}, 'All other speech (words, stories and Pip) is synthesised for Wordwild.'))));
  show('credits', el);
}

// ================================================================ Boot
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());
store.setOnSave(() => cloud.queue());
titleScreen();
cloud.countPlay();
if (store.state().name && store.state().cloud) {
  cloud.sync().then(r => { if (r === 'adopted' && screenName === 'map') mapScreen(); });
}
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
window.__ww = { store, mapScreen, startLesson, hatchScreen, parentScreen, creditsScreen, LESSONS, games, trace, readaloud,
  startPractice, practicePlan, arcadeScreen, worldCompleteMoment, runBonus, finishedScreen, libraryScreen, rereadStory, bigBookState, STORIES, BOOKS };
