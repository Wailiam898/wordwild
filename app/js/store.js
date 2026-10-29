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
  confusions: {},      // 'target|chosen' -> count
  gems: 0,
  hats: ['none'], hat: 'none',
  wordlings: [], books: [],
  best: { pop: 0, rocket: 0 },
  today: { date: '', sec: 0 },
  settings: { music: true, limit: 20 },
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
  const base = S.baseGems == null ? Math.min(S.gems, c.gems || 0) : S.baseGems;
  S.gems = Math.max(0, S.gems + (c.gems || 0) - base);
  S.baseGems = c.gems || 0;
  for (const f of ['hats', 'wordlings', 'books']) S[f] = [...new Set([...(S[f] || []), ...(c[f] || [])])];
  S.best = { pop: Math.max(S.best.pop, (c.best || {}).pop || 0), rocket: Math.max(S.best.rocket, (c.best || {}).rocket || 0) };
  S.unlocked = Math.max(S.unlocked || 0, c.unlocked || 0);
  S.seenIntro = S.seenIntro || !!c.seenIntro;
  persist();
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
export function overLimit() {
  return S.settings.limit > 0 && minutesToday() >= S.settings.limit;
}
export function extendToday() {
  S.today.sec = 0; save();
}
