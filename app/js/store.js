// Saved progress and the adaptive learning model.
// Each sound, word and heart word has a memory "box" (spaced repetition) and
// accuracy; recent answers steer difficulty towards ~85% success.
import { allLessons } from './data.js';

const KEY = 'wordwild.v1';
const DAY = 86400000;
const INTERVALS = [0, 10 * 60000, DAY, 3 * DAY, 7 * DAY, 21 * DAY];

const fresh = () => ({
  done: {},            // lessonId -> { stars, acc, plays }
  items: {},           // 'g:s' | 'w:sat' | 'h:the' -> { n, c, box, due }
  recent: [],          // last 30 answers, 1/0
  trace: {},           // letter tracing: grapheme -> { n: times finished, c: times finished without being shown how }
  confusions: {},      // 'target|chosen' -> count
  comp: { k: { lit: { n: 0, c: 0 }, think: { n: 0, c: 0 } }, s: {} },  // story questions: n answered, c right first time; by kind and by story
  flu: { wk: {}, w: {} },  // reading speed (grown-ups only): weekly totals per device, and a recent time per word
  reads: {},           // book pages read aloud to Pip: device id -> count (one count per device, so merging never double counts)
  practice: { dates: [], rounds: 0 },  // daily practice: the days it was done, and how many rounds in all
  bonus: {},           // bonus games: world index -> { u: 1 once opened, s: best stars, b: best score }
  gems: 0,
  hats: ['none'], hat: 'none',
  wordlings: [], books: [],
  best: { pop: 0, rocket: 0, memory: 0 },
  today: { date: '', sec: 0 },
  settings: { music: true, readAloud: false },  // readAloud: the optional "Read it to Pip" microphone step (this device only)
  unlocked: 0,         // parent skip-ahead: lessons below this index are open
  seenIntro: false,
  // Account + cloud sync
  name: '', pinHash: '', cloud: false,
  savedAt: 0, syncedAt: 0, baseGems: 0,
});

let S = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return Object.assign(fresh(), JSON.parse(raw));
  } catch (e) {}
  return fresh();
}

let onSave = null;
export function setOnSave(fn) { onSave = fn; }

export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
}

export function save() {
  S.savedAt = Date.now();
  persist();
  if (onSave) onSave();
}

// Replace local progress with a cloud save (keeps this device's settings and code).
export function adopt(data, at) {
  const keep = { pinHash: S.pinHash, settings: S.settings, today: S.today };
  S = Object.assign(fresh(), data, keep, { cloud: true, savedAt: at, syncedAt: at });
  S.baseGems = S.gems;
  persist();
}

// Combine progress from another device so nothing earned on either is lost.
export function merge(c) {
  if (!c) return;
  for (const [id, d] of Object.entries(c.done || {})) {
    const m = S.done[id];
    S.done[id] = m ? { stars: Math.max(m.stars, d.stars), acc: Math.max(m.acc, d.acc), plays: Math.max(m.plays, d.plays) } : d;
  }
  for (const [k, it] of Object.entries(c.items || {})) {
    if (!S.items[k] || (it.n || 0) > (S.items[k].n || 0)) S.items[k] = it;
  }
  for (const [k, n] of Object.entries(c.confusions || {})) S.confusions[k] = Math.max(S.confusions[k] || 0, n);
  // Tracing: counts only ever grow, so the larger of each count from the two devices is safe to keep.
  if (!S.trace || typeof S.trace !== 'object') S.trace = {};
  for (const [k, t] of Object.entries(c.trace || {})) {
    const m = S.trace[k] || { n: 0, c: 0 };
    S.trace[k] = { n: Math.max(m.n || 0, t.n || 0), c: Math.max(m.c || 0, t.c || 0) };
  }
  mergeComp(c.comp);
  mergeFlu(c.flu);
  mergePractice(c.practice);
  mergeReads(c.reads);
  mergeBonus(c.bonus);
  const base = S.baseGems == null ? Math.min(S.gems, c.gems || 0) : S.baseGems;
  S.gems = Math.max(0, S.gems + (c.gems || 0) - base);
  S.baseGems = c.gems || 0;
  for (const f of ['hats', 'wordlings', 'books']) S[f] = [...new Set([...(S[f] || []), ...(c[f] || [])])];
  for (const [k, v] of Object.entries(c.best || {})) S.best[k] = Math.max(S.best[k] || 0, v || 0);
  S.unlocked = Math.max(S.unlocked || 0, c.unlocked || 0);
  S.seenIntro = S.seenIntro || !!c.seenIntro;
  persist();
}

// Story questions: counts only ever grow, so the larger of each count is safe to keep.
const cleanCount = t => ({ n: Math.max(0, +(t && t.n) || 0), c: Math.max(0, +(t && t.c) || 0) });
function compState() {
  if (!S.comp || typeof S.comp !== 'object') S.comp = {};
  if (!S.comp.k || typeof S.comp.k !== 'object') S.comp.k = {};
  if (!S.comp.s || typeof S.comp.s !== 'object') S.comp.s = {};
  for (const k of ['lit', 'think']) S.comp.k[k] = cleanCount(S.comp.k[k]);
  return S.comp;
}
function mergeComp(c) {
  const m = compState();
  if (!c || typeof c !== 'object') return;
  for (const k of ['lit', 'think']) {
    const t = cleanCount(c.k && c.k[k]);
    m.k[k] = { n: Math.max(m.k[k].n, t.n), c: Math.max(m.k[k].c, t.c) };
  }
  for (const [id, t0] of Object.entries(c.s || {})) {
    const t = cleanCount(t0), o = cleanCount(m.s[id]);
    m.s[id] = { n: Math.max(o.n, t.n), c: Math.max(o.c, t.c) };
  }
}

// ---------- Reading speed (shown to grown-ups only) ----------
// flu.wk[monday][device] = [words, seconds, sentenceWords, sentenceSeconds]: one record per device, so
// merging two devices (largest record per device) never double counts. Kept for the last 12 weeks.
// flu.w[word] = [recent seconds, readings, day number]: the last 300 words read.
const WEEKS = 12, WORDS_KEPT = 300;
let memDid = '';
function deviceId() {
  try {
    let v = localStorage.getItem('wordwild.did');
    if (!v) { v = Math.random().toString(16).slice(2, 8).padEnd(6, '0'); localStorage.setItem('wordwild.did', v); }
    return v;
  } catch (e) { return memDid || (memDid = Math.random().toString(16).slice(2, 8).padEnd(6, '0')); }
}
function pad(n) { return String(n).padStart(2, '0'); }
export function weekKey(t = Date.now()) {
  const d = new Date(t);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));   // back to Monday
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fluState() {
  if (!S.flu || typeof S.flu !== 'object') S.flu = {};
  if (!S.flu.wk || typeof S.flu.wk !== 'object') S.flu.wk = {};
  if (!S.flu.w || typeof S.flu.w !== 'object') S.flu.w = {};
  return S.flu;
}
function pruneFlu(f) {
  const weeks = Object.keys(f.wk).sort();
  weeks.slice(0, Math.max(0, weeks.length - WEEKS)).forEach(k => delete f.wk[k]);
  const words = Object.entries(f.w).sort((a, b) => (b[1][2] || 0) - (a[1][2] || 0));
  words.slice(WORDS_KEPT).forEach(([k]) => delete f.w[k]);
}
const okRec = r => Array.isArray(r) && r.length === 4 && r.every(x => Number.isFinite(x) && x >= 0);
// secs: time to read and act (already without audio and hidden time). count: how many words it covers.
export function recordReadTime(word, secs, count = 1) {
  if (!(secs > 0) || !(count >= 1)) return;
  const f = fluState();
  const wk = (f.wk[weekKey()] ||= {});
  const dev = deviceId();
  const r = okRec(wk[dev]) ? wk[dev] : [0, 0, 0, 0];
  if (count === 1) { r[0] += 1; r[1] += secs; } else { r[2] += count; r[3] += secs; }
  wk[dev] = r;
  if (count === 1 && word) {
    const day = Math.floor(Date.now() / DAY);
    const o = f.w[word];
    f.w[word] = o && Array.isArray(o) ? [Math.round((o[0] * 0.6 + secs * 0.4) * 10) / 10, Math.min(999, (o[1] || 0) + 1), day] : [Math.round(secs * 10) / 10, 1, day];
  }
  pruneFlu(f);
  save();
}
function mergeFlu(c) {
  const f = fluState();
  if (!c || typeof c !== 'object') return;
  for (const [wk, devs] of Object.entries(c.wk || {})) {
    if (!devs || typeof devs !== 'object') continue;
    const mine = (f.wk[wk] ||= {});
    for (const [dev, r] of Object.entries(devs)) {
      if (!okRec(r)) continue;
      if (!okRec(mine[dev]) || r[0] + r[2] > mine[dev][0] + mine[dev][2]) mine[dev] = r;
    }
  }
  for (const [w, r] of Object.entries(c.w || {})) {
    if (!Array.isArray(r) || r.length < 3) continue;
    const o = f.w[w];
    if (!o || (r[2] || 0) > (o[2] || 0) || ((r[2] || 0) === (o[2] || 0) && (r[1] || 0) > (o[1] || 0))) f.w[w] = r;
  }
  pruneFlu(f);
}
// Weekly averages, oldest first: seconds per word read on its own, and seconds per word when reading a sentence.
export function readingWeeks() {
  const f = fluState();
  return Object.keys(f.wk).sort().map(week => {
    let nw = 0, sw = 0, ns = 0, ss = 0;
    for (const r of Object.values(f.wk[week])) if (okRec(r)) { nw += r[0]; sw += r[1]; ns += r[2]; ss += r[3]; }
    return { week, words: nw, word: nw ? sw / nw : 0, sentenceWords: ns, sentence: ns ? ss / ns : 0 };
  });
}
// The slowest recently read words (at least `min` readings), slowest first.
export function slowWords(n = 8, min = 3) {
  const f = fluState();
  return Object.entries(f.w).filter(([, r]) => Array.isArray(r) && (r[1] || 0) >= min).sort((a, b) => b[1][0] - a[1][0]).slice(0, n).map(([w, r]) => ({ w, secs: r[0], n: r[1] }));
}

// ---------- Story questions ----------
export function recordComprehension(id, kind, firstTry) {
  const c = compState();
  const k = kind === 'think' ? 'think' : 'lit';
  c.k[k].n++; if (firstTry) c.k[k].c++;
  const t = c.s[id] = cleanCount(c.s[id]);
  t.n++; if (firstTry) t.c++;
  save();
}
export const comprehension = () => compState();

// ---------- Pages read aloud (Read it to Pip, in books) ----------
// reads[device] = pages read aloud on that device. Merging keeps the larger count per device, so nothing
// is lost and nothing is counted twice. The total is the sum over devices.
function readsState() {
  if (!S.reads || typeof S.reads !== 'object' || Array.isArray(S.reads)) S.reads = {};
  return S.reads;
}
function mergeReads(c) {
  const r = readsState();
  if (!c || typeof c !== 'object') return;
  for (const [dev, n] of Object.entries(c)) {
    const v = Math.max(0, Math.floor(+n) || 0);
    if (v) r[dev] = Math.max(r[dev] || 0, v);
  }
}
export function recordReadAloud() {
  const r = readsState();
  const dev = deviceId();
  r[dev] = (r[dev] || 0) + 1;
  save();
}
export const pagesReadAloud = () => Object.values(readsState()).reduce((a, n) => a + (Math.max(0, +n) || 0), 0);

// ---------- Bonus games (one per world) ----------
// A world's game is open once every lesson of the world is done (so children who finished worlds before the games
// existed have them straight away), or once it has been opened by finishing the world's last lesson (bonus[wi].u).
// Best stars and best score are kept per world; merging keeps the larger of each, so nothing is lost across devices.
function bonusState() {
  if (!S.bonus || typeof S.bonus !== 'object' || Array.isArray(S.bonus)) S.bonus = {};
  return S.bonus;
}
const cleanBonus = b => ({ u: b && b.u ? 1 : 0, s: Math.min(3, Math.max(0, Math.floor(+(b && b.s)) || 0)), b: Math.max(0, Math.floor(+(b && b.b)) || 0) });
function mergeBonus(c) {
  const m = bonusState();
  if (!c || typeof c !== 'object') return;
  for (const [wi, b0] of Object.entries(c)) {
    if (!/^[0-6]$/.test(wi)) continue;
    const b = cleanBonus(b0), o = cleanBonus(m[wi]);
    m[wi] = { u: o.u || b.u, s: Math.max(o.s, b.s), b: Math.max(o.b, b.b) };
  }
}
const worldDone = wi => { const ls = LESSONS.filter(l => l.wi === wi); return ls.length > 0 && ls.every(l => S.done[l.id]); };
export const bonusUnlocked = wi => worldDone(wi) || !!cleanBonus(bonusState()[wi]).u;
export const bonusBest = wi => { const b = cleanBonus(bonusState()[wi]); return { stars: b.s, score: b.b }; };
// Opening a game (also when the child quits it at once) unlocks it; a played game keeps its best stars and score.
export function recordBonus(wi, { stars = 0, score = 0 } = {}) {
  const m = bonusState();
  const o = cleanBonus(m[wi]);
  m[wi] = { u: 1, s: Math.max(o.s, Math.min(3, stars)), b: Math.max(o.b, Math.max(0, Math.floor(score))) };
  save();
}

// ---------- Daily practice ----------
function isoDay(t = Date.now()) { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function practiceState() {
  if (!S.practice || typeof S.practice !== 'object') S.practice = {};
  if (!Array.isArray(S.practice.dates)) S.practice.dates = [];
  S.practice.rounds = Math.max(0, +S.practice.rounds || 0);
  return S.practice;
}
function mergePractice(c) {
  const p = practiceState();
  if (!c || typeof c !== 'object') return;
  p.dates = [...new Set([...p.dates, ...(Array.isArray(c.dates) ? c.dates : [])])].filter(x => /^\d{4}-\d\d-\d\d$/.test(x)).sort().slice(-120);
  p.rounds = Math.max(p.rounds, +c.rounds || 0);
}
export const practicedToday = () => practiceState().dates.includes(isoDay());
export function recordPractice() {
  const p = practiceState();
  const today = isoDay();
  const first = !p.dates.includes(today);
  if (first) p.dates = [...p.dates, today].sort().slice(-120);
  p.rounds++;
  save();
  return { first };
}
export function practiceDays(within = 30) {
  const cut = isoDay(Date.now() - within * DAY);
  return practiceState().dates.filter(d => d >= cut).length;
}
export const practiceRounds = () => practiceState().rounds;

// Pick n keys for daily practice: what is due first, then the weakest, then things not yet seen.
export function pickDue(keys, n, prefix) {
  const now = Date.now();
  const scored = keys.map(k => {
    const it = S.items[prefix + k];
    if (!it) return { k, s: 0.9 + Math.random() * 0.3 };
    const overdue = it.due <= now ? 1.2 : 0;
    const acc = it.n ? it.c / it.n : 1;
    return { k, s: overdue + (1 - acc) + (5 - it.box) * 0.15 + Math.random() * 0.3 };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, n).map(x => x.k);
}

// Sign out on this device (progress stays in the cloud).
export function signOut() {
  const keep = { settings: S.settings };
  S = Object.assign(fresh(), keep, { seenIntro: true });
  persist();
}

export const state = () => S;

export function reset() {
  const keep = { name: S.name, pinHash: S.pinHash, cloud: S.cloud, syncedAt: S.syncedAt, seenIntro: true };
  S = Object.assign(fresh(), keep);
  save();
}

// ---------- Lessons ----------
const LESSONS = allLessons();

export function lessonIndex(id) { return LESSONS.findIndex(l => l.id === id); }

// The first lesson not yet completed (the glowing one on the map).
export function currentIndex() {
  const i = LESSONS.findIndex(l => !S.done[l.id]);
  return i === -1 ? LESSONS.length - 1 : i;
}

export function isOpen(i) {
  return i <= currentIndex() || i < S.unlocked || !!S.done[LESSONS[i].id];
}

export function completeLesson(id, acc) {
  const stars = acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : 1;
  const prev = S.done[id];
  S.done[id] = {
    stars: Math.max(stars, prev ? prev.stars : 0),
    acc: Math.max(acc, prev ? prev.acc : 0),
    plays: (prev ? prev.plays : 0) + 1,
  };
  save();
  return { stars, first: !prev };
}

// ---------- Learning model ----------
export function record(key, correct) {
  const it = S.items[key] || (S.items[key] = { n: 0, c: 0, box: 0, due: 0 });
  it.n++;
  if (correct) {
    it.c++;
    it.box = Math.min(it.box + 1, INTERVALS.length - 1);
  } else {
    it.box = Math.max(0, it.box - 2);
  }
  it.due = Date.now() + INTERVALS[it.box];
  S.recent.push(correct ? 1 : 0);
  if (S.recent.length > 30) S.recent.shift();
  save();
}

// A letter or letter group was traced to the end. clean = without being shown how.
export function recordTrace(g, clean) {
  if (!S.trace || typeof S.trace !== 'object') S.trace = {};
  const t = S.trace[g] || (S.trace[g] = { n: 0, c: 0 });
  t.n++;
  if (clean) t.c++;
  save();
}
export const tracedCount = g => (S.trace && S.trace[g] && S.trace[g].n) || 0;

export function confusion(target, chosen) {
  const k = `${target}|${chosen}`;
  S.confusions[k] = (S.confusions[k] || 0) + 1;
  save();
}

export function accuracy() {
  const r = S.recent.slice(-20);
  if (r.length < 5) return 0.85;
  return r.reduce((a, b) => a + b, 0) / r.length;
}

// 0 = easier (fewer choices, more help), 1 = normal, 2 = stretch.
export function level() {
  const a = accuracy();
  if (a < 0.75) return 0;
  if (a > 0.92 && S.recent.length >= 10) return 2;
  return 1;
}

// Pick n keys, most in need of practice first (overdue, low box, low accuracy).
export function pickReview(keys, n, prefix) {
  const now = Date.now();
  const scored = keys.map(k => {
    const it = S.items[prefix + k];
    if (!it) return { k, s: 1.5 + Math.random() * 0.2 };
    const overdue = it.due <= now ? 1 : 0;
    const acc = it.c / it.n;
    return { k, s: overdue + (1 - acc) + (5 - it.box) * 0.15 + Math.random() * 0.3 };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, n).map(x => x.k);
}

export function mastery(key) {
  const it = S.items[key];
  if (!it) return -1;
  return it.box;
}

export function topConfusions(n = 5) {
  return Object.entries(S.confusions).sort((a, b) => b[1] - a[1]).slice(0, n);
}

// ---------- Rewards ----------
export function addGems(n) { S.gems += n; save(); }

export function addWordling(lessonId) {
  if (!S.wordlings.includes(lessonId)) S.wordlings.push(lessonId);
  save();
}

export function addBook(id) {
  if (!S.books.includes(id)) S.books.push(id);
  save();
}

// ---------- Play time ----------
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
export function tickTime(sec) {
  const t = todayStr();
  if (S.today.date !== t) S.today = { date: t, sec: 0 };
  S.today.sec += sec;
  if (Math.round(S.today.sec) % 15 === 0) persist();
}
export function minutesToday() {
  return S.today.date === todayStr() ? S.today.sec / 60 : 0;
}
