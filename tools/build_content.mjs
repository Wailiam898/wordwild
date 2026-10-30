// Validates the curriculum (decodability), generates Pip's mistake variants,
// and writes the audio manifest that tools/gen_audio.py renders.
// Usage: node tools/build_content.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import {
  GRAPHEMES, HEART, WORLDS, STORIES, WORDLINGS, LINES, PIP_LINES, SENTENCES, FRAMES,
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
    st.pages.forEach(p => tokens(p.t).forEach(w => {
      if (w !== 'pip' && !decodable(w, known)) errors.push(`${l.id} story ${l.story}: "${w}" not decodable in "${p.t}"`);
    }));
    tokens(st.title).forEach(w => { if (!decodable(w, known)) errors.push(`${l.id} story title: "${w}"`); });
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
for (const [k, st] of Object.entries(STORIES)) {
  add(`st_${k}`, { voice: 'narr', text: st.title });
  add(`q_${k}`, { voice: 'narr', text: st.q.text });
  st.pages.forEach((p, i) => {
    add(`s_${k}_${i}`, { voice: 'narr', text: p.t, slow: true });
    tokens(p.t).forEach(word);
  });
}
mkdirSync(new URL('../work/', import.meta.url), { recursive: true });
writeFileSync(new URL('../work/manifest.json', import.meta.url), JSON.stringify([...items.values()], null, 1));
console.log(`ok: ${lessons.length} lessons, ${Object.keys(STORIES).length} stories, ${items.size} audio clips`);
