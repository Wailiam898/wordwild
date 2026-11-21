// Validates the curriculum (decodability), generates Pip's mistake variants,
// and writes the audio manifest that tools/gen_audio.py renders.
// Usage: node tools/build_content.mjs
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import {
  GRAPHEMES, HEART, WORLDS, STORIES, BOOKS, qid, WORDLINGS, LINES, MS_LINES, PIP_LINES, SENTENCES, FRAMES,
  parseWords, parseSentences, sentenceWords, segment, splitSyllables, spell, isSplit, SILENT_E, allLessons, knownAt,
} from '../app/js/data.js';

const errors = [];
const warn = [];
const lessons = allLessons();

const tokens = text => text.toLowerCase().replace(/[’']/g, '').split(/[^a-z]+/).filter(Boolean);

function decodable(word, known) {
  if (known.h.has(word)) return true;
  if (segment(word, known.g)) return true;
  // Plural / verb -s on a decodable base.
  if (word.endsWith('s') && segment(word.slice(0, -1), known.g)) return true;
  return false;
}


// ---- Words that look decodable but are not said the way their letters suggest ----
// segment() only checks that letters can be cut into taught sounds. These words pass that test
// yet are said differently (of, give, snow, took...), so they must not appear in anything a child reads.
const TRAPS = new Set(('of put pull push full bull bush give live move done gone none once only other mother brother another so want wash watch '
  + 'swap wasp swan wand word work world worm war warm very every again head bread dead ready steady heavy weather breath instead spread thread '
  + 'break great steak look book took good foot wood wool hook cook shook stood brook hood goes does oh hi find kind mind behind tiny sorry '
  + 'snow grow show low slow know own blow flow glow row bow throw window pillow yellow below follow elbow floor door poor thumb lamb climb comb bomb '
  + 'young touch enough trouble soup group through thought bought four pour tour son ton month glove above dove shove oven cover nothing won wonder '
  + 'ball call fall hall tall wall small talk walk chalk key money monkey donkey honey field chief thief brief piece school stomach '
  + 'gem gems giant gentle giraffe cage page huge age stage ice nice mice rice face race place space dance').split(' '));
// Returns why a word could be mis-sounded, or '' if fine. `known` = what has been taught.
function trapReason(w, known) {
  if (known.h.has(w) || w === 'pip') return '';
  if (TRAPS.has(w) || TRAPS.has(w.replace(/s$/, ''))) return 'said differently from its letters';
  const seg = segment(w, known.g) || (w.endsWith('s') ? segment(w.slice(0, -1), known.g) : null);
  if (!seg) return '';
  if (seg.length > 1 && seg[seg.length - 1] === 'e') return 'ends in a silent e that has not been taught';
  const i = seg.findIndex(isSplit);
  if (i >= 0 && seg[i + 1] === 'r' && seg[i + 2] === SILENT_E) return 'vowel + r + e changes the vowel sound';
  if (/c[eiy]/.test(w)) return 'soft c';
  if (/ea(r|d)/.test(w) && !/^(read|lead|bead)/.test(w)) return 'ea before r or d is said differently';
  if (w.length >= 5 && w.endsWith('ed') && !w.endsWith('eed')) return 'ends in -ed (not taught)';
  return '';
}

// ---- Stories and big books ----
// Sentences on a page. Sounds like "Hic!" or "Dig, dig, dig!" (two words or fewer, or one word repeated) are not counted.
function sentenceCount(t) {
  return t.split(/(?<=[.!?])\s+(?=[A-Z])/).filter(c => {
    const ws = tokens(c);
    return ws.length > 2 && new Set(ws).size > 1;
  }).length;
}
const isEmojiOpt = o => !/[A-Za-z]/.test(o);
function checkStory(where, st, known, wi, isBook) {
  const bad = isBook ? errors : warn;       // lesson stories already in the game only warn about sound-alike traps
  st.pages.forEach(p => tokens(p.t).forEach(w => {
    if (w !== 'pip' && !decodable(w, known)) errors.push(`${where}: "${w}" not decodable in "${p.t}"`);
    else { const r = trapReason(w, known); if (r) bad.push(`${where}: "${w}" ${r} in "${p.t}"`); }
  }));
  tokens(st.title).forEach(w => { if (!decodable(w, known)) errors.push(`${where} title: "${w}" not decodable`); });
  if (!st.cover) errors.push(`${where}: no cover picture`);
  st.pages.forEach(p => { if (!p.pic) errors.push(`${where}: page has no picture: ${p.t}`); });
  if (isBook) {
    if (st.pages.length < 6 || st.pages.length > 10) errors.push(`${where}: a big book needs 6 to 10 pages, has ${st.pages.length}`);
    st.pages.forEach(p => {
      const n = sentenceCount(p.t);
      if (n < 1 || n > 2) errors.push(`${where}: a page needs 1 or 2 sentences, has ${n}: ${p.t}`);
      if (p.t.split(' ').length > 20) errors.push(`${where}: page is too long: ${p.t}`);
    });
  }
  // Questions: 2 or 3, spoken; answers are pictures or short decodable words; exactly one is right.
  const qs = st.qs;
  if (!Array.isArray(qs)) { errors.push(`${where}: no questions (qs)`); return; }
  if (qs.length < 2 || qs.length > 3) errors.push(`${where}: needs 2 or 3 questions, has ${qs.length}`);
  qs.forEach((q, i) => {
    const at = `${where} question ${i + 1}`;
    if (!q.text || !/[?]$/.test(q.text)) errors.push(`${at}: needs spoken text ending in ?`);
    if (!['lit', 'think'].includes(q.k)) errors.push(`${at}: kind must be lit or think`);
    if (!Array.isArray(q.opts) || q.opts.length < 2 || q.opts.length > 4) { errors.push(`${at}: needs 2 to 4 answers`); return; }
    if (!Number.isInteger(q.a) || q.a < 0 || q.a >= q.opts.length) { errors.push(`${at}: right answer index ${q.a} is not one of the answers`); return; }
    const norm = o => o.toLowerCase().trim();
    if (new Set(q.opts.map(norm)).size !== q.opts.length) errors.push(`${at}: an answer appears twice`);
    const right = q.opts.filter(o => norm(o) === norm(q.opts[q.a]));
    if (right.length !== 1) errors.push(`${at}: the right answer is listed ${right.length} times`);
    const emoji = q.opts.filter(isEmojiOpt).length;
    if (emoji !== 0 && emoji !== q.opts.length) errors.push(`${at}: answers must be all pictures or all words`);
    q.opts.forEach(o => {
      if (isEmojiOpt(o)) return;
      if (o.length > 24) errors.push(`${at}: answer too long: ${o}`);
      tokens(o).forEach(w => {
        if (w !== 'pip' && !decodable(w, known)) errors.push(`${at}: answer word "${w}" not decodable`);
        else { const r = trapReason(w, known); if (r) errors.push(`${at}: answer word "${w}" ${r}`); }
      });
    });
  });
  if (!qs.some(q => q.k === 'lit')) errors.push(`${where}: needs at least one literal (who/what/where) question`);
  if ((isBook || wi >= 2) && !qs.some(q => q.k === 'think')) errors.push(`${where}: needs a thinking question (why / how did they feel / what happens next)`);
}

// ---- Validate ----
const seenStory = new Set();
lessons.forEach((l, i) => {
  const known = knownAt(i);
  l.g.forEach(g => { if (!GRAPHEMES[g]) errors.push(`${l.id}: unknown grapheme ${g}`); });
  l.heart.forEach(h => { if (!HEART[h]) errors.push(`${l.id}: unknown heart word ${h}`); });
  const emojis = new Set();
  parseWords(l.words).forEach(({ w, e, syl }) => {
    const seg = segment(w, known.g);
    if (!seg) errors.push(`${l.id}: word not decodable: ${w}`);
    else if (syl && !splitSyllables(seg, syl)) errors.push(`${l.id}: syllables ${syl.join('|')} don't fall between sounds (${seg.join(' ')})`);
    if (e) { if (emojis.has(e)) warn.push(`${l.id}: duplicate picture ${e} (${w})`); emojis.add(e); }
  });
  if (emojis.size < 4) errors.push(`${l.id}: needs at least 4 picture words, has ${emojis.size}`);
  if (l.story) {
    const st = STORIES[l.story];
    if (!st) { errors.push(`${l.id}: missing story ${l.story}`); return; }
    seenStory.add(l.story);
    checkStory(`${l.id} story ${l.story}`, st, known, l.wi, false);
  }
  parseSentences(l.id).forEach(x => {
    if (!/[.?!]$/.test(x.t) || !/^[A-Z]/.test(x.t)) errors.push(`${l.id}: sentence needs a capital and an end mark: ${x.t}`);
    if (!x.pic) errors.push(`${l.id}: sentence has no picture: ${x.t}`);
    tokens(x.t).forEach(w => { if (w !== 'pip' && !decodable(w, known)) errors.push(`${l.id} sentence: "${w}" not decodable in "${x.t}"`); });
  });
  const name = WORDLINGS[l.id];
  if (!name) errors.push(`${l.id}: no Wordling`);
  else if (!segment(name.toLowerCase(), known.g)) errors.push(`${l.id}: Wordling name not decodable: ${name}`);
});
Object.keys(SENTENCES).forEach(k => { if (!lessons.some(l => l.id === k)) errors.push(`sentences for unknown lesson ${k}`); });
FRAMES.forEach(f => {
  const i = lessons.findIndex(l => l.id === f.from);
  if (i < 0) errors.push(`frame ${f.id}: unknown lesson ${f.from}`);
  else tokens(f.t).forEach(w => { if (!decodable(w, knownAt(i))) errors.push(`frame ${f.id}: "${w}" not decodable at ${f.from}`); });
});
Object.keys(STORIES).forEach(k => { if (!seenStory.has(k)) warn.push(`story ${k} not used by any lesson`); });
// Big books are for children who have finished everything: they may use all the sounds and heart words.
const allKnown = knownAt(lessons.length - 1);
Object.keys(BOOKS).forEach(k => {
  if (STORIES[k]) errors.push(`book ${k}: same name as a lesson story`);
  checkStory(`book ${k}`, BOOKS[k], allKnown, 99, true);
});
if (Object.keys(BOOKS).length < 8) errors.push(`need at least 8 big books, have ${Object.keys(BOOKS).length}`);

warn.forEach(w => console.log('warn:', w));
if (errors.length) {
  errors.forEach(e => console.log('ERROR:', e));
  process.exit(1);
}

// ---- Pip's mistake variants (one grapheme swapped for a same-type taught grapheme) ----
function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
const variants = {};
lessons.forEach((l, i) => {
  const known = knownAt(i);
  const pool = [...known.g];
  parseWords(l.words).forEach(({ w }) => {
    if (variants[w]) return;
    const seg = segment(w, known.g);
    const out = [];
    const h = hash(w);
    // Split vowel: Pip forgets the magic e (cake -> cak) when the short word is real.
    const sp = seg.findIndex(isSplit);
    if (sp >= 0) {
      const short = seg.filter(g => g !== SILENT_E).map(g => isSplit(g) ? g[0] : g);
      out.push({ pos: sp, g: seg[sp][0], w: short.join('') });
    }
    for (let k = 0; sp < 0 && k < seg.length && out.length < 2; k++) {
      const pos = (h + k * 7) % seg.length;
      const orig = seg[pos];
      if (orig === SILENT_E || isSplit(orig)) continue;
      const cands = pool.filter(g => g !== orig && GRAPHEMES[g].v === GRAPHEMES[orig].v
        && GRAPHEMES[g].ipa !== GRAPHEMES[orig].ipa && g.length <= 2 && !/\d/.test(g)
        && !(pos === 0 && ['ng', 'ck'].includes(g)) && g !== seg[pos - 1] && g !== seg[pos + 1]);
      if (!cands.length) continue;
      const rep = cands[((h >> 3) % cands.length + cands.length) % cands.length];
      const v = seg.slice(); v[pos] = rep;
      if (!out.some(o => o.pos === pos)) out.push({ pos, g: rep, w: spell(v) });
    }
    variants[w] = out;
  });
});
writeFileSync(new URL('../app/js/variants.js', import.meta.url),
  '// Generated by tools/build_content.mjs. Pip\'s reading mistakes: swap grapheme at pos for g.\n'
  + 'export const VARIANTS = ' + JSON.stringify(variants) + ';\n');

// ---- Audio manifest ----
const items = new Map();
const add = (id, o) => { if (!items.has(id)) items.set(id, { id, ...o }); };
const ipaOf = seg => {
  // Stress mark before the first vowel grapheme.
  let stressed = false;
  return seg.filter(g => g !== SILENT_E).map(g => {
    const x = GRAPHEMES[g];
    if (x.v && !stressed) { stressed = true; return 'ˈ' + x.ipa; }
    return x.ipa;
  }).join('');
};

for (const [k, t] of Object.entries(LINES)) add('n_' + k, { voice: 'narr', text: t });
for (const [k, t] of Object.entries(MS_LINES)) add(k, { voice: 'narr', text: t });
for (const [k, t] of Object.entries(PIP_LINES)) add('pl_' + k, { voice: 'pip', text: t });
for (const [g, x] of Object.entries(GRAPHEMES)) {
  add('p_' + g, { voice: 'narr', phoneme: x.ipa, v: x.v });
  add('w_' + x.key, { voice: 'narr', text: x.key === 'yoyo' ? 'yo-yo' : x.key });
}
const word = w => add('w_' + w, { voice: 'narr', text: w === 'i' ? 'I' : w });
lessons.forEach(l => {
  parseWords(l.words).forEach(({ w }) => {
    word(w);
    add('pw_' + w, { voice: 'pip', text: w });
    (variants[w] || []).forEach(v => {
      if (!items.has('pw_' + v.w)) add('pw_' + v.w, { voice: 'pip', phoneme: ipaOf(segment(v.w) || []), word: true, word_text: v.w });
    });
  });
  l.heart.forEach(word);
  parseSentences(l.id).forEach(x => {
    add(x.id, { voice: 'narr', text: x.t, slow: true });
    tokens(x.t).forEach(word);
  });
  add('w_' + WORDLINGS[l.id].toLowerCase(), { voice: 'narr', text: WORDLINGS[l.id] });
});
FRAMES.forEach(f => add(f.id, { voice: 'narr', text: f.t + ' …', frame: true }));
for (const [k, st] of Object.entries({ ...STORIES, ...BOOKS })) {
  add(`st_${k}`, { voice: 'narr', text: st.title });
  tokens(st.title).forEach(word);
  st.qs.forEach((q, i) => {
    add(qid(k, i), { voice: 'narr', text: q.text });
    q.opts.forEach(o => { if (!isEmojiOpt(o)) tokens(o).forEach(word); });
  });
  st.pages.forEach((p, i) => {
    add(`s_${k}_${i}`, { voice: 'narr', text: p.t, slow: true });
    tokens(p.t).forEach(word);
  });
}
// Every story and book must have all of its audio listed (it is rendered by tools/gen_audio.py).
for (const [k, st] of Object.entries({ ...STORIES, ...BOOKS })) {
  const need = [`st_${k}`, ...st.qs.map((_, i) => qid(k, i)), ...st.pages.map((_, i) => `s_${k}_${i}`)];
  st.qs.forEach(q => q.opts.forEach(o => { if (!isEmojiOpt(o)) tokens(o).forEach(w => need.push('w_' + w)); }));
  need.forEach(id => { if (!items.has(id)) errors.push(`${k}: audio ${id} is not in the manifest`); });
}
if (errors.length) { errors.forEach(e => console.log('ERROR:', e)); process.exit(1); }
mkdirSync(new URL('../work/', import.meta.url), { recursive: true });
writeFileSync(new URL('../work/manifest.json', import.meta.url), JSON.stringify([...items.values()], null, 1));
const missing = [...items.keys()].filter(id => !id.startsWith('p_') && !existsSync(new URL(`../app/audio/${id}.mp3`, import.meta.url)));
if (missing.length) {
  console.log(`note: ${missing.length} audio clips are listed but not rendered yet: ${missing.slice(0, 12).join(' ')}${missing.length > 12 ? ' ...' : ''}`);
  if (process.argv.includes('--require-audio')) { console.log('ERROR: audio missing'); process.exit(1); }
}
console.log(`ok: ${lessons.length} lessons, ${Object.keys(STORIES).length} stories, ${Object.keys(BOOKS).length} big books, ${items.size} audio clips`);
