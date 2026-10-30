// The activities. Each takes a game context G and resolves with { right, total }.
// G = { stage, setReplay(fn), known: {g,h}, pool: [{w,e,seg}], gem(el,n), first(key) }
import { GRAPHEMES, HEART, STORIES, STRETCHY, BOUNCY, NAMES, SILENT_E, isSplit, label, tileText, sentenceWords, splitSyllables } from './data.js';
import { VARIANTS } from './variants.js';
import { say, tap, sfx, clipDuration, load } from './audio.js';
import { h, onTap, sleep, shuffle, pick, anim, praise, oops, burstAt, confetti } from './ui.js';
import { pipSVG, rocketSVG } from './art.js';
import * as store from './store.js';

const P = g => g === SILENT_E ? null : 'p_' + g;
const W = w => 'w_' + w;

// A grapheme inside a word. Split vowels show their vowel letter and the silent e,
// both in gold so the pair stands out (c a k e).
function tileEl(g, cls = '') {
  const t = tileText(g);
  const magic = isSplit(g) || g === SILENT_E;
  const el = h('div', { class: 'tile ' + cls + (t.length > 1 ? ' multi' : '') + (magic ? ' magic' : '') }, t);
  el.dataset.g = g;
  return el;
}
// A grapheme on its own (a-e, not a).
function soundEl(g, cls = '') {
  const t = label(g);
  const el = h('div', { class: 'tile ' + cls + (t.length > 1 ? ' multi' : '') }, t);
  el.dataset.g = g;
  return el;
}

// Other sounds to choose from: never one that sounds the same or looks the same.
function otherGraphemes(g, known, n) {
  const ipa = GRAPHEMES[g].ipa;
  const fine = x => x !== g && GRAPHEMES[x].ipa !== ipa && label(x) !== label(g);
  let pool = [...known].filter(fine);
  if (pool.length < n) {
    pool = pool.concat(Object.keys(GRAPHEMES).filter(x => x.length === 1 && fine(x) && !pool.includes(x)));
  }
  return shuffle(pool).slice(0, n);
}

function pictureChoices(item, pool, n) {
  const others = shuffle(pool.filter(p => p.e && p.w !== item.w && p.e !== item.e));
  const picked = [];
  for (const o of others) {
    if (picked.length >= n - 1) break;
    if (!picked.some(p => p.e === o.e)) picked.push(o);
  }
  return shuffle([item, ...picked]);
}

// ---------------------------------------------------------------- Meet a sound
export async function meet(G, g) {
  const x = GRAPHEMES[g];
  const st = G.stage;
  st.innerHTML = '';
  const crystal = h('div', { class: 'crystal pop-in' + (label(g).length > 2 ? ' wide' : '') }, h('span', {}, label(g)));
  const pic = h('div', { class: 'meet-pic' }, h('span', { class: 'emoji' }, x.e));
  st.append(h('div', { class: 'meet' }, crystal, pic));
  onTap(crystal, () => { anim(crystal, 'wiggle'); tap(P(g)); });
  const twin = [...G.known.g].some(o => o !== g && GRAPHEMES[o].ipa === x.ipa && !G.newG?.includes(o));
  const intro = async () => {
    anim(crystal, 'glow', 900);
    if (isSplit(g)) await say('n_intro_split', 300);
    else if (g === 'y2' || g === 'y3') await say('n_intro_y', 250);
    else if (twin) await say('n_intro_another', 250);
    await say('n_intro_this', 250, P(g), 350, 'n_intro_like');
    anim(pic, 'bounce', 700);
    await say(W(x.key), 300, P(g));
  };
  G.setReplay(intro);
  await intro();
  anim(crystal, 'glow', 2400);
  const how = STRETCHY.has(g) ? ['n_intro_stretchy', 300] : BOUNCY.has(g) ? ['n_intro_bouncy', 300] : [];
  await say(...how, 'n_intro_say', 350, P(g), 700, P(g));
  await sleep(500);

  // Find it.
  const k = store.level() === 0 ? 3 : 4;
  const opts = shuffle([g, ...otherGraphemes(g, G.known.g, k - 1)]);
  st.innerHTML = '';
  const row = h('div', { class: 'choice-row' });
  st.append(h('div', { class: 'center-col' }, h('div', { class: 'big-ear', html: '👂' }), row));
  let tries = 0, done;
  const finished = new Promise(r => (done = r));
  const ask = () => say('n_intro_find', 200, P(g));
  G.setReplay(ask);
  opts.forEach(o => {
    const t = soundEl(o, 'bubble-tile pop-in');
    if (o === g) t.dataset.ok = 1;
    onTap(t, async () => {
      if (t.classList.contains('locked')) return;
      if (o === g) {
        row.querySelectorAll('.tile').forEach(x => x.classList.add('locked'));
        t.classList.add('right'); burstAt(t, 26); G.gem(t, 1);
        store.record('g:' + g, tries === 0);
        await praise([P(g)]);
        done({ right: tries === 0 ? 1 : 0, total: 1 });
      } else {
        tries++; t.classList.add('wrong'); anim(t, 'shake');
        store.confusion(g, o);
        await oops([P(g)]);
      }
    });
    row.append(t);
  });
  await ask();
  return finished;
}

// ---------------------------------------------------------------- Bubble pop
// targets: list of graphemes to find in order. arcade: { seconds } for timed mode.
export function soundPop(G, targets, opts = {}) {
  const st = G.stage;
  st.innerHTML = '';
  const field = h('div', { class: 'pop-field' });
  const hud = h('div', { class: 'pop-hud' });
  st.append(field, hud);
  const lvl = store.level();
  const arcade = !!opts.seconds;
  const known = [...G.known.g];
  let idx = 0, target = targets[0], right = 0, total = 0, missStreak = 0, score = 0, combo = 0;
  let firstTry = true;
  let alive = true, last = performance.now(), spawnT = 0;
  const bubbles = [];
  const speedBase = (arcade ? 70 : 55) + lvl * 18;
  const endAt = arcade ? performance.now() + opts.seconds * 1000 : 0;
  let resolveFn;
  const done = new Promise(r => (resolveFn = r));
  const timerEl = arcade ? h('div', { class: 'timer-bar' }, h('i')) : null;
  const scoreEl = arcade ? h('div', { class: 'score' }, '0') : null;
  const comboEl = h('div', { class: 'combo' });
  if (arcade) hud.append(timerEl, scoreEl);
  hud.append(comboEl);

  const prompt = (first) => { field.dataset.target = target; return say(first ? 'n_pop_go' : 'n_pop_more', 150, P(target)); };
  G.setReplay(() => say(P(target)));

  function spawn(force) {
    const r = field.getBoundingClientRect();
    const size = Math.min(r.width * 0.26, 132);
    const onScreen = bubbles.some(b => b.g === target && !b.popped);
    const isT = force || (!onScreen && Math.random() < 0.6) || Math.random() < 0.3;
    const g = isT ? target : pick(otherGraphemes(target, known, 4));
    const el = h('div', { class: 'bubble' + (label(g).length > 1 ? ' multi' : '') }, h('span', {}, label(g)));
    el.dataset.g = g;
    el.style.width = el.style.height = size + 'px';
    const b = { el, g, x: Math.random() * (r.width - size), y: r.height + 10, sp: speedBase * (0.85 + Math.random() * 0.4), wob: Math.random() * 6, size, popped: false };
    el.style.setProperty('--hue', Math.floor(Math.random() * 360));
    el.style.transform = `translate(${b.x}px, ${b.y}px)`;
    el.addEventListener('pointerdown', () => hit(b));
    field.append(el);
    bubbles.push(b);
  }

  async function hit(b) {
    if (b.popped || !alive) return;
    if (b.g === target) {
      b.popped = true;
      b.el.classList.add('popped');
      burstAt(b.el, 18, 'circle'); sfx('pop');
      setTimeout(() => b.el.remove(), 300);
      combo++;
      if (arcade) {
        score += 10 * Math.min(combo, 5);
        scoreEl.textContent = score;
        anim(scoreEl, 'bump', 300);
      }
      if (combo >= 3) { comboEl.textContent = `x${Math.min(combo, 5)}`; anim(comboEl, 'combo-pop', 700); }
      store.record('g:' + target, firstTry);
      total++; if (firstTry) right++;
      firstTry = true;
      G.gem(b.el, 1);
      tap(P(target));
      idx++;
      if (!arcade && idx >= targets.length) { finish(); return; }
      const nt = arcade ? (idx % 3 === 0 ? pick(targets) : target) : targets[idx];
      if (nt !== target) {
        target = nt;
        await sleep(450);
        if (alive) prompt(false);
      }
    } else {
      b.el.classList.add('nope'); anim(b.el, 'shake', 400);
      sfx('bad'); combo = 0; comboEl.textContent = '';
      if (firstTry) store.confusion(target, b.g);
      firstTry = false;
      await tap(P(b.g));
      if (alive) say(P(target));
    }
  }

  function frame(now) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const r = field.getBoundingClientRect();
    spawnT -= dt;
    if (spawnT <= 0) {
      missStreak++;
      spawn(missStreak > 3);
      if (bubbles.some(b => b.g === target)) missStreak = 0;
      spawnT = (arcade ? 0.75 : 1.0) - lvl * 0.12;
    }
    for (const b of bubbles) {
      if (b.popped) continue;
      b.y -= b.sp * dt;
      b.wob += dt * 2;
      b.el.style.transform = `translate(${b.x + Math.sin(b.wob) * 12}px, ${b.y}px)`;
      if (b.y < -b.size - 10) { b.popped = true; b.el.remove(); }
    }
    for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].popped && !bubbles[i].el.isConnected) bubbles.splice(i, 1);
    if (arcade) {
      const left = (endAt - now) / 1000;
      timerEl.firstChild.style.width = Math.max(0, left / opts.seconds * 100) + '%';
      if (left <= 0) { finish(); return; }
    }
    requestAnimationFrame(frame);
  }

  function finish() {
    alive = false;
    setTimeout(() => resolveFn({ right, total, score }), 600);
  }

  (async () => {
    await prompt(true);
    if (!alive) return;
    last = performance.now();
    spawn(true);
    requestAnimationFrame(frame);
  })();
  G.onExit = () => { alive = false; };
  return done;
}

// ---------------------------------------------------------------- Blast blend
export async function blast(G, item, intro) {
  const st = G.stage;
  st.innerHTML = '';
  const seg = item.seg;
  const rocket = h('div', { class: 'rocket', html: rocketSVG() });
  const tiles = seg.map(g => tileEl(g, 'blend-tile pop-in'));
  const row = h('div', { class: 'tile-row' }, tiles);
  const knob = h('div', { class: 'knob' }, '⭐');
  const track = h('div', { class: 'track' }, h('div', { class: 'track-fill' }), h('div', { class: 'track-arrow' }), knob);
  const choices = h('div', { class: 'choice-row pics' });
  st.append(h('div', { class: 'blast' }, rocket, h('div', { class: 'blend-box' }, row, track), choices));
  let next = 0;
  tiles[0].classList.add('next');
  G.setReplay(() => say('n_blend_tap'));

  const charged = new Promise(resolve => {
    tiles.forEach((t, i) => onTap(t, () => {
      if (seg[i] === SILENT_E) magicE(tiles, seg); else tap(P(seg[i]));
      anim(t, 'boing', 400);
      if (i === next) {
        t.classList.add('lit'); t.classList.remove('next');
        next++;
        if (next < tiles.length) tiles[next].classList.add('next');
        else resolve();
      }
    }));
  });
  if (intro) say('n_blend_tap');
  await charged;
  knob.classList.add('ready');
  sfx('sparkle');

  // Slide to blend: finger drags the star along under the letters.
  await new Promise(resolve => {
    let dragging = false, lastI = -1, finished = false;
    const centers = () => tiles.map(t => { const r = t.getBoundingClientRect(); return r.left + r.width / 2; });
    const tr = () => track.getBoundingClientRect();
    const setPos = x => {
      const r = tr();
      const p = Math.max(0, Math.min(1, (x - r.left) / r.width));
      knob.style.left = p * 100 + '%';
      track.firstChild.style.width = p * 100 + '%';
      const cs = centers();
      let i = -1; cs.forEach((c, k) => { if (x >= c - 10) i = k; });
      if (i > lastI) {
        for (let k = lastI + 1; k <= i; k++) { tiles[k].classList.add('blend'); }
        lastI = i; if (P(seg[i])) tap(P(seg[i])); sfx('slide');
      }
      if (p > 0.96 && lastI === tiles.length - 1 && !finished) { finished = true; dragging = false; resolve(); }
    };
    knob.addEventListener('pointerdown', e => { dragging = true; knob.setPointerCapture(e.pointerId); });
    knob.addEventListener('pointermove', e => { if (dragging) setPos(e.clientX); });
    knob.addEventListener('pointerup', async () => {
      if (finished) return;
      dragging = false;
      // A tap without dragging slides it automatically.
      if (lastI < 0) {
        const r = tr();
        for (let s = 0; s <= 30 && !finished; s++) { setPos(r.left + r.width * s / 30); await sleep(28); }
      }
    });
    track.addEventListener('pointerdown', e => { if (e.target === track) { dragging = true; setPos(e.clientX); } });
  });
  tiles.forEach(t => anim(t, 'wave', 600));
  await sleep(350);

  // Which picture?
  const opts = pictureChoices(item, G.pool, store.level() === 0 ? 2 : 3);
  let tries = 0;
  const result = await new Promise(resolve => {
    opts.forEach(o => {
      const c = h('div', { class: 'pic-card pop-in' }, h('span', { class: 'emoji' }, o.e));
      if (o.w === item.w) c.dataset.ok = 1;
      onTap(c, async () => {
        if (c.classList.contains('locked')) return;
        if (o.w === item.w) {
          choices.querySelectorAll('.pic-card').forEach(x => x.classList.add('locked'));
          c.classList.add('right');
          store.record('w:' + item.w, tries === 0);
          G.gem(c, tries === 0 ? 2 : 1);
          await say(W(item.w));
          rocket.classList.add('launch'); sfx('launch');
          burstAt(rocket, 30);
          await praise();
          resolve({ right: tries === 0 ? 1 : 0, total: 1 });
        } else {
          tries++;
          c.classList.add('wrong', 'locked'); anim(c, 'shake');
          await oops();
          for (const g of seg) { await tap(P(g)); await sleep(80); }
          if (tries >= 2) {
            const rightCard = [...choices.children][opts.indexOf(item)];
            rightCard.classList.add('hint');
          }
        }
      });
      choices.append(c);
    });
    G.setReplay(async () => { for (const g of seg) { await tap(P(g)); await sleep(120); } });
    say('n_blend_which');
  });
  await sleep(500);
  return result;
}

// ---------------------------------------------------------------- Word forge (spelling)
// opts.host: build inside this element instead of the whole stage (dictation, finish).
export async function forge(G, item, opts = {}) {
  const st = G.stage;
  const host = opts.host || st;
  host.innerHTML = '';
  const seg = item.seg;
  const lvl = store.level();
  // Split-vowel words also offer the plain vowel, so the child has to choose a vs a-e.
  const plain = seg.filter(isSplit).map(g => g[0]).filter(g => G.known.g.has(g));
  const extra = [...plain, ...otherGraphemes(seg.find(g => g !== SILENT_E), G.known.g, 6).filter(g => !seg.includes(g))].slice(0, Math.max(plain.length, [1, 2, 3][lvl]));
  const tray = shuffle([...seg, ...extra]);
  const boxes = seg.map(() => h('div', { class: 'sound-box' }));
  const pic = h('div', { class: 'forge-pic pop-in' + (item.e ? '' : ' ear') }, h('span', { class: 'emoji' }, item.e || '👂'));
  const trayEl = h('div', { class: 'tray' });
  host.append(h('div', { class: 'forge' + (opts.host ? ' small' : '') }, pic, h('div', { class: 'box-row' }, boxes), trayEl));
  const filled = seg.map(() => null);
  st.dataset.seq = seg.join(',');
  const ask = () => say('n_forge_build', 200, W(item.w));
  G.setReplay(ask);
  onTap(pic, () => { anim(pic, 'boing'); say(W(item.w)); });
  let tries = 0;

  return new Promise(resolve => {
    const tileEls = tray.map(g => {
      const t = tileEl(g, 'tray-tile pop-in');
      t.dataset.g = g;
      onTap(t, () => {
        if (t.classList.contains('used') || st.classList.contains('busy')) return;
        const slot = filled.indexOf(null);
        if (slot < 0) return;
        if (g === SILENT_E) sfx('sparkle'); else tap(P(g));
        filled[slot] = t;
        t.classList.add('used');
        const ghost = tileEl(g, 'placed');
        boxes[slot].append(ghost);
        anim(ghost, 'drop-in', 400);
        onTap(ghost, () => {
          if (st.classList.contains('busy')) return;
          ghost.remove(); t.classList.remove('used'); filled[slot] = null;
        });
        if (!filled.includes(null)) check();
      });
      trayEl.append(t);
      return t;
    });

    async function check() {
      st.classList.add('busy');
      await sleep(250);
      const ok = filled.every((t, i) => t.dataset.g === seg[i]);
      if (ok) {
        boxes.forEach(b => b.classList.add('right'));
        store.record('w:' + item.w, tries === 0);
        G.gem(boxes[boxes.length - 1], tries === 0 ? 2 : 1);
        sfx('sparkle');
        await say(W(item.w));
        burstAt(pic, 30);
        anim(pic, 'bounce', 700);
        await praise();
        st.classList.remove('busy');
        delete st.dataset.seq;
        resolve({ right: tries === 0 ? 1 : 0, total: 1 });
        return;
      }
      tries++;
      filled.forEach((t, i) => {
        if (t.dataset.g !== seg[i]) {
          const ghost = boxes[i].firstChild;
          anim(ghost, 'shake');
          setTimeout(() => { ghost.remove(); t.classList.remove('used'); }, 450);
          filled[i] = null;
        } else boxes[i].classList.add('right');
      });
      await oops();
      if (tries >= 2) {
        await say('n_forge_listen');
        for (const g of seg) { await tap(P(g)); await sleep(150); }
      }
      if (tries >= 3) {
        // Show the next missing tile.
        const i = filled.indexOf(null);
        const t = tileEls.find(x => x.dataset.g === seg[i] && !x.classList.contains('used'));
        if (t) t.classList.add('hint');
      }
      st.classList.remove('busy');
    }
    ask();
  });
}

// ---------------------------------------------------------------- Teach Pip
export async function teachPip(G, item, hat) {
  const st = G.stage;
  st.innerHTML = '';
  const seg = item.seg;
  const vars = VARIANTS[item.w] || [];
  const wrong = vars.length && Math.random() < 0.65 ? pick(vars) : null;
  const pip = h('div', { class: 'pip-big talk', html: pipSVG('talk', hat) });
  const tiles = seg.map(g => tileEl(g, 'word-tile'));
  const card = h('div', { class: 'word-card pop-in' }, tiles);
  const yes = h('button', { class: 'judge yes' }, '👍');
  const no = h('button', { class: 'judge no' }, '👎');
  const judge = h('div', { class: 'judge-row' }, yes, no);
  judge.style.visibility = 'hidden';
  st.append(h('div', { class: 'teach' }, h('div', { class: 'teach-top' }, pip, h('div', { class: 'speech pop-in' }, '?')), card, judge));
  const pipRead = async () => {
    pip.innerHTML = pipSVG('talk', hat); pip.classList.add('talk');
    await say('pl_try', 200, 'pw_' + (wrong ? wrong.w : item.w));
    pip.classList.remove('talk'); pip.innerHTML = pipSVG('happy', hat);
  };
  G.setReplay(() => say('pw_' + (wrong ? wrong.w : item.w)));
  await pipRead();
  judge.style.visibility = '';
  st.dataset.ok = wrong ? 'no:' + wrong.pos : 'yes';
  say('n_pip_judge');
  const mood = m => { pip.innerHTML = pipSVG(m, hat); };

  const answer = await new Promise(r => { onTap(yes, () => r(true)); onTap(no, () => r(false)); });
  judge.style.visibility = 'hidden';
  if (!wrong && answer) {
    store.record('w:' + item.w, true);
    mood('wow'); anim(pip, 'jump', 700); burstAt(pip, 20); G.gem(card, 2);
    sfx('good');
    await say('pl_yay');
    return { right: 1, total: 1 };
  }
  if (!wrong && !answer) {
    store.record('w:' + item.w, false);
    sfx('bad');
    await say('n_pip_was_right', 200, W(item.w));
    tiles.forEach(t => anim(t, 'wave', 600));
    return { right: 0, total: 1 };
  }
  if (wrong && answer) {
    store.record('w:' + item.w, false);
    sfx('bad');
    tiles[wrong.pos].classList.add('hint');
    await say('n_oops3', 200, 'n_pip_listen', W(item.w));
    mood('sad'); await sleep(300);
    await say('pl_thanks', 150, 'pw_' + item.w);
    mood('happy');
    return { right: 0, total: 1 };
  }
  // Child spotted the mistake: now find the sound.
  sfx('good');
  mood('wow');
  say('n_pip_which');
  let tries = 0;
  await new Promise(resolve => {
    G.setReplay(() => say('n_pip_which'));
    tiles.forEach((t, i) => onTap(t, async () => {
      if (card.classList.contains('locked')) return;
      tap(P(seg[i]));
      if (i === wrong.pos) {
        card.classList.add('locked');
        t.classList.add('right'); burstAt(t, 24);
        resolve();
      } else {
        tries++; anim(t, 'shake');
        if (tries >= 2) { tiles[wrong.pos].classList.add('hint'); }
      }
    }));
  });
  store.record('w:' + item.w, tries === 0);
  G.gem(card, tries === 0 ? 3 : 1);
  anim(pip, 'jump', 700);
  await say('pl_thanks', 150, 'pw_' + item.w);
  mood('happy');
  await praise();
  return { right: tries === 0 ? 1 : 0, total: 1 };
}

// ---------------------------------------------------------------- Heart words
export async function heartWord(G, word, explain) {
  const st = G.stage;
  st.innerHTML = '';
  const tr = HEART[word].tricky;
  const shown = word === 'i' ? 'I' : word;
  const letters = [...shown].map((c, i) => h('span', { class: 'hw-l' + (i >= tr[0] && i < tr[1] ? ' tricky' : '') }, c));
  const card = h('div', { class: 'heart-card pop-in' }, letters);
  st.append(h('div', { class: 'center-col' }, h('div', { class: 'heart-badge' }, '💖'), card));
  onTap(card, () => { anim(card, 'boing'); say(W(word)); });
  const intro = () => explain
    ? say('n_heart_intro', 250, 'n_heart_says', W(word))
    : say('n_heart_says', W(word));
  G.setReplay(intro);
  await intro();
  card.classList.add('glow');
  await sleep(600);

  const others = shuffle([...G.known.h].filter(x => x !== word).concat(G.pool.map(p => p.w).filter(w => w.length <= 4)))
    .filter((x, i, a) => a.indexOf(x) === i && x !== word).slice(0, store.level() === 0 ? 1 : 2);
  const opts = shuffle([word, ...others]);
  st.innerHTML = '';
  const row = h('div', { class: 'choice-row' });
  st.append(h('div', { class: 'center-col' }, h('div', { class: 'heart-badge small' }, '💖'), row));
  const ask = () => say('n_heart_find', 150, W(word));
  G.setReplay(ask);
  let tries = 0;
  const res = new Promise(resolve => {
    opts.forEach(o => {
      const c = h('div', { class: 'word-choice pop-in' }, o === 'i' ? 'I' : o);
      if (o === word) c.dataset.ok = 1;
      onTap(c, async () => {
        if (c.classList.contains('locked')) return;
        if (o === word) {
          row.querySelectorAll('.word-choice').forEach(x => x.classList.add('locked'));
          c.classList.add('right'); burstAt(c, 24); G.gem(c, 2);
          store.record('h:' + word, tries === 0);
          await praise([W(word)]);
          resolve({ right: tries === 0 ? 1 : 0, total: 1 });
        } else {
          tries++; c.classList.add('wrong', 'locked'); anim(c, 'shake');
          await oops([W(word)]);
        }
      });
      row.append(c);
    });
  });
  ask();
  return res;
}

// ---------------------------------------------------------------- Speed read (word -> picture)
export async function speedRead(G, items, opts = {}) {
  const st = G.stage;
  let right = 0, total = 0, score = 0;
  const arcade = !!opts.seconds;
  const endAt = performance.now() + (opts.seconds || 0) * 1000;
  let timerEl, scoreEl, tick;
  if (arcade) {
    timerEl = h('div', { class: 'timer-bar' }, h('i'));
    scoreEl = h('div', { class: 'score' }, '0');
    tick = setInterval(() => {
      const left = (endAt - performance.now()) / 1000;
      timerEl.firstChild.style.width = Math.max(0, left / opts.seconds * 100) + '%';
    }, 100);
  }
  await say('n_speed_go');
  let i = 0;
  while (arcade ? performance.now() < endAt : i < items.length) {
    const item = arcade ? pick(items) : items[i];
    i++;
    st.innerHTML = '';
    const word = h('div', { class: 'speed-word pop-in' }, item.w);
    const row = h('div', { class: 'choice-row pics' });
    st.append(h('div', { class: 'speed' }, arcade ? h('div', { class: 'pop-hud' }, timerEl, scoreEl) : null, word, row));
    G.setReplay(async () => { for (const g of item.seg) { await tap(P(g)); await sleep(120); } });
    let tries = 0;
    await new Promise(resolve => {
      pictureChoices(item, G.pool, store.level() === 0 ? 2 : 3).forEach(o => {
        const c = h('div', { class: 'pic-card pop-in' }, h('span', { class: 'emoji' }, o.e));
        if (o.w === item.w) c.dataset.ok = 1;
        onTap(c, async () => {
          if (c.classList.contains('locked')) return;
          if (o.w === item.w) {
            row.querySelectorAll('.pic-card').forEach(x => x.classList.add('locked'));
            c.classList.add('right'); burstAt(c, 16); sfx('good');
            store.record('w:' + item.w, tries === 0);
            total++; if (!tries) { right++; score += 10; }
            if (arcade) { scoreEl.textContent = score; anim(scoreEl, 'bump', 300); }
            G.gem(c, 1);
            await say(W(item.w));
            resolve();
          } else {
            tries++; c.classList.add('wrong', 'locked'); anim(c, 'shake'); sfx('bad');
            for (const g of item.seg) { await tap(P(g)); await sleep(60); }
          }
        });
        row.append(c);
      });
    });
    await sleep(250);
  }
  clearInterval(tick);
  return { right, total, score };
}

// ---------------------------------------------------------------- Story
export async function story(G, id, opts = {}) {
  const S = STORIES[id];
  const st = G.stage;
  let right = 0, total = 0;
  const ids = [`st_${id}`, `q_${id}`, ...S.pages.map((_, i) => `s_${id}_${i}`)];
  ids.forEach(load);

  // Cover
  st.innerHTML = '';
  const cover = h('div', { class: 'book-cover pop-in' }, h('div', { class: 'cover-emoji' }, S.cover), h('div', { class: 'cover-title' }, S.title));
  const go = h('button', { class: 'btn big go' }, '▶');
  st.append(h('div', { class: 'center-col' }, cover, go));
  G.setReplay(() => say(`st_${id}`));
  const started = new Promise(r => onTap(go, r));
  if (!opts.reread) say('n_story_start', 300, `st_${id}`); else say(`st_${id}`);
  await started;
  sfx('whoosh');

  for (let p = 0; p < S.pages.length; p++) {
    const page = S.pages[p];
    st.innerHTML = '';
    const words = page.t.split(' ').map(tok => {
      const clean = tok.toLowerCase().replace(/[^a-z’']/g, '').replace(/[’']/g, '');
      const el = h('span', { class: 'sw' }, tok);
      onTap(el, () => { anim(el, 'boing', 400); if (clean) say(W(clean)); });
      return el;
    });
    const text = h('div', { class: 'story-text' });
    words.forEach((w, i) => { text.append(w); if (i < words.length - 1) text.append(' '); });
    const scene = h('div', { class: 'scene pop-in' }, h('div', { class: 'scene-pic' }, page.pic),
      /pip/i.test(page.t) ? h('div', { class: 'scene-pip', html: pipSVG(p % 2 ? 'wow' : 'happy', opts.hat || '') }) : null);
    const speaker = h('button', { class: 'btn round speaker' }, '🔊');
    const next = h('button', { class: 'btn big go' }, '▶');
    const dots = h('div', { class: 'page-dots' }, S.pages.map((_, i) => h('i', { class: i === p ? 'on' : i < p ? 'done' : '' })));
    st.append(h('div', { class: 'story' }, dots, scene, text, h('div', { class: 'story-btns' }, speaker, next)));
    const readAloud = async () => {
      const sid = `s_${id}_${p}`;
      await load(sid);
      const dur = clipDuration(sid) * 1000;
      const lens = words.map(w => w.textContent.length + 2);
      const sum = lens.reduce((a, b) => a + b, 0);
      let t = 0;
      const timers = words.map((w, i) => {
        const at = t; t += dur * lens[i] / sum;
        return setTimeout(() => { words.forEach(x => x.classList.remove('hl')); w.classList.add('hl'); }, at);
      });
      await say(sid);
      timers.forEach(clearTimeout);
      words.forEach(x => x.classList.remove('hl'));
    };
    G.setReplay(readAloud);
    onTap(speaker, readAloud);
    await new Promise(r => onTap(next, r));
    sfx('whoosh');
  }

  // Question
  st.innerHTML = '';
  const row = h('div', { class: 'choice-row pics' });
  st.append(h('div', { class: 'center-col' }, h('div', { class: 'big-ear', html: '❓' }), row));
  const ask = () => say(`q_${id}`);
  G.setReplay(ask);
  let tries = 0;
  await new Promise(resolve => {
    S.q.opts.forEach((e, i) => {
      const c = h('div', { class: 'pic-card pop-in' }, h('span', { class: 'emoji' }, e));
      if (i === S.q.a) c.dataset.ok = 1;
      onTap(c, async () => {
        if (c.classList.contains('locked')) return;
        if (i === S.q.a) {
          row.querySelectorAll('.pic-card').forEach(x => x.classList.add('locked'));
          c.classList.add('right'); burstAt(c, 30); G.gem(c, 3);
          total++; if (!tries) right++;
          await praise();
          resolve();
        } else {
          tries++; c.classList.add('wrong', 'locked'); anim(c, 'shake');
          await oops([`q_${id}`]);
        }
      });
      row.append(c);
    });
    ask();
  });
  confetti(90);
  sfx('fanfare');
  store.addBook(id);
  if (!opts.reread) await say('n_story_done');
  return { right, total };
}

// Tapping the silent e: it zaps its vowel, which then says its name.
function magicE(tiles, seg) {
  const v = seg.findIndex(isSplit);
  sfx('sparkle');
  tiles[seg.length - 1].classList.add('zap');
  if (v >= 0) { tiles[v].classList.add('zap'); anim(tiles[v], 'bounce', 600); setTimeout(() => tap(P(seg[v])), 350); }
}

// ================================================================ Sentence games
const isMark = t => /^[.?!]$/.test(t);
const bare = tok => tok.toLowerCase().replace(/[^a-z]/g, '');
const capFirst = w => w[0].toUpperCase() + w.slice(1);
const sayTok = tok => { const c = bare(tok); if (c) tap(W(c)); };
function chipEl(text, cls = '') {
  return h('div', { class: 'wchip' + (isMark(text) ? ' mark' : '') + (cls ? ' ' + cls : '') }, text);
}
// Read a sentence aloud, lighting each word as it goes.
async function readSentence(id, chips) {
  await load(id);
  const dur = clipDuration(id) * 1000;
  const sum = chips.reduce((a, c) => a + c.textContent.length + 2, 0);
  let t = 0;
  const timers = chips.map(c => {
    const at = t; t += dur * (c.textContent.length + 2) / sum;
    return setTimeout(() => { chips.forEach(x => x.classList.remove('hl')); c.classList.add('hl'); }, at);
  });
  await say(id);
  timers.forEach(clearTimeout);
  chips.forEach(x => x.classList.remove('hl'));
}
const sentenceLine = s => [...sentenceWords(s.t), s.t.slice(-1)];

// ---------------------------------------------------------------- Sentence Builder
// Put shuffled word tiles in order to make the sentence for the picture.
export async function buildSentence(G, s) {
  const st = G.stage;
  st.innerHTML = '';
  const parts = sentenceLine(s);
  const slots = parts.map(p => h('div', { class: 'slot' + (isMark(p) ? ' mark' : '') }));
  const line = h('div', { class: 'sent-line' }, slots);
  const trayEl = h('div', { class: 'tray sent-tray' });
  const pic = h('div', { class: 'sent-pic pop-in' }, h('span', { class: 'emoji' }, s.pic));
  st.append(h('div', { class: 'sentence' }, pic, line, trayEl));
  let order = shuffle(parts);
  for (let k = 0; k < 4 && order.join(' ') === parts.join(' '); k++) order = shuffle(parts);
  const els = order.map(p => chipEl(p, 'pop-in'));
  trayEl.append(...els);
  const placed = [];
  let next = 0, tries = 0, wrongHere = 0;
  const markNext = () => {
    els.forEach(e => delete e.dataset.ok);
    const e = els.find(e => !e.classList.contains('used') && e.textContent === parts[next]);
    if (e) e.dataset.ok = 1;
    slots.forEach((sl, k) => sl.classList.toggle('next', k === next));
  };
  markNext();
  G.setReplay(() => say(s.id));
  say('n_build_go');
  return new Promise(resolve => {
    els.forEach(el => onTap(el, async () => {
      if (el.classList.contains('used') || st.classList.contains('busy')) return;
      const p = el.textContent;
      if (p === parts[next]) {
        el.classList.add('used'); el.classList.remove('hint');
        const chip = chipEl(p);
        slots[next].append(chip); placed.push(chip);
        anim(chip, 'drop-in', 400);
        if (isMark(p)) sfx('pop'); else sayTok(p);
        next++; wrongHere = 0;
        markNext();
        if (next === parts.length) {
          st.classList.add('busy');
          await sleep(400);
          sfx('sparkle');
          line.classList.add('done');
          store.record('s:' + s.id, tries === 0);
          G.gem(line, tries === 0 ? 3 : 1);
          await readSentence(s.id, placed);
          await praise();
          st.classList.remove('busy');
          resolve({ right: tries === 0 ? 1 : 0, total: 1 });
        }
      } else {
        tries++; wrongHere++;
        anim(el, 'shake'); sfx('bad');
        if (!isMark(p)) sayTok(p);
        if (wrongHere >= 2) els.find(e => e.dataset.ok)?.classList.add('hint');
      }
    }));
  });
}

// ---------------------------------------------------------------- Silly or Sensible?
export async function sillyOrNot(G, s) {
  const st = G.stage;
  st.innerHTML = '';
  const chips = sentenceLine(s).map(p => {
    const c = chipEl(p);
    if (!isMark(p)) onTap(c, () => { anim(c, 'boing', 400); sayTok(p); });
    return c;
  });
  const pic = h('div', { class: 'sent-pic hidden' }, h('span', { class: 'emoji' }, s.pic));
  const ok = h('button', { class: 'judge yes', 'aria-label': 'Makes sense' }, '👍');
  const silly = h('button', { class: 'judge silly', 'aria-label': 'Silly' }, '🤪');
  (s.silly ? silly : ok).dataset.ok = 1;
  const row = h('div', { class: 'judge-row' }, ok, silly);
  st.append(h('div', { class: 'sentence' }, pic, h('div', { class: 'sent-line read' }, chips), row));
  const ask = () => say('n_silly_q');
  G.setReplay(ask);
  ask();
  const ans = await new Promise(r => { onTap(ok, () => r(false)); onTap(silly, () => r(true)); });
  row.classList.add('locked');
  delete (s.silly ? silly : ok).dataset.ok;
  const right = ans === s.silly;
  const btn = ans ? silly : ok;
  btn.classList.add(right ? 'right' : 'wrong');
  pic.classList.remove('hidden'); anim(pic, 'bounce', 700);
  store.record('s:' + s.id, right);
  if (right) { sfx('good'); burstAt(btn, 24); G.gem(btn, 2); }
  else await oops();
  await sleep(300);
  await readSentence(s.id, chips);
  await say(s.silly ? 'n_silly_yes' : 'n_silly_no');
  if (right) await praise();
  return { right: right ? 1 : 0, total: 1 };
}

// ---------------------------------------------------------------- Fix It!
// Pip's sentence is missing its capital letter, its full stop, or both.
export async function fixIt(G, s, kinds) {
  const st = G.stage;
  st.innerHTML = '';
  const parts = sentenceLine(s);
  const words = parts.slice(0, -1), mark = parts[parts.length - 1];
  const chips = words.map((w, i) => chipEl(i === 0 && kinds.includes('cap') ? w.toLowerCase() : w, 'tap'));
  const end = chipEl(kinds.includes('stop') ? '' : mark, 'tap end' + (kinds.includes('stop') ? ' empty' : ''));
  const all = [...chips, end];
  const pip = h('div', { class: 'pip-mid', html: pipSVG('talk', G.hat || '') });
  st.append(h('div', { class: 'sentence' }, h('div', { class: 'fix-top' }, pip, h('div', { class: 'speech pop-in' }, '✏️')),
    h('div', { class: 'sent-line read paper' }, all)));
  const todo = new Set(kinds);
  if (todo.has('cap')) chips[0].dataset.ok = 1;
  if (todo.has('stop')) end.dataset.ok = 1;
  let tries = 0;
  const ask = () => say('n_fix_go');
  G.setReplay(ask);
  ask().then(() => { if (pip.isConnected) pip.innerHTML = pipSVG('happy', G.hat || ''); });
  await new Promise(resolve => {
    all.forEach((c, i) => onTap(c, async () => {
      if (st.classList.contains('busy') || c.classList.contains('right')) return;
      const kind = i === 0 && todo.has('cap') ? 'cap' : c === end && todo.has('stop') ? 'stop' : null;
      if (!kind) { tries++; anim(c, 'shake'); sfx('bad'); return; }
      st.classList.add('busy');
      todo.delete(kind); delete c.dataset.ok;
      c.classList.add('right'); c.classList.remove('empty');
      c.textContent = kind === 'cap' ? words[0] : mark;
      anim(c, 'bounce', 600); burstAt(c, 18); sfx('sparkle');
      await say(kind === 'cap' ? 'n_fix_capital' : 'n_fix_stop');
      if (todo.size) await say('n_fix_more');
      st.classList.remove('busy');
      if (!todo.size) resolve();
    }));
  });
  store.record('s:' + s.id, tries === 0);
  G.gem(end, tries === 0 ? 3 : 1);
  pip.innerHTML = pipSVG('wow', G.hat || ''); anim(pip, 'jump', 700);
  await readSentence(s.id, all);
  await praise();
  return { right: tries === 0 ? 1 : 0, total: 1 };
}

// ---------------------------------------------------------------- Dictation
// Hear a sentence, then write it: pick each word (with its capital), spell one word
// with sound tiles, and finish with the right end mark.
export async function dictation(G, s, focus) {
  const st = G.stage;
  st.innerHTML = '';
  const parts = sentenceLine(s);
  const words = parts.slice(0, -1), mark = parts[parts.length - 1];
  const slots = parts.map(p => h('div', { class: 'slot' + (isMark(p) ? ' mark' : '') }));
  const ear = h('button', { class: 'btn round ear-btn', 'aria-label': 'Hear the sentence' }, '👂');
  const area = h('div', { class: 'dict-area' });
  st.append(h('div', { class: 'sentence' }, h('div', { class: 'dict-top' }, ear, h('div', { class: 'sent-line' }, slots)), area));
  const hear = () => say(s.id);
  onTap(ear, () => { anim(ear, 'boing'); hear(); });
  G.setReplay(hear);
  await say('n_dict_listen', 250, s.id);
  const placed = [];
  let right = 0, total = 0;
  const pool = [...new Set(G.words.map(x => x.w).concat([...G.known.h]))].filter(w => w.length > 1);

  for (let i = 0; i < words.length; i++) {
    slots.forEach((sl, k) => sl.classList.toggle('next', k === i));
    const word = words[i], low = bare(word);
    let res;
    if (focus && i === focus.index) {
      res = await forge(G, focus.item, { host: area });
    } else {
      const shown = w => (i === 0 ? capFirst(w) : w);
      const near = shuffle(pool.filter(w => w !== low && (w[0] === low[0] || Math.abs(w.length - low.length) <= 1))).slice(0, 2).map(shown);
      // The first word is also offered without its capital letter.
      const opts = shuffle([word, ...(i === 0 && word !== low && low !== 'i' ? [low, near[0]] : near)].filter(Boolean));
      area.innerHTML = '';
      const row = h('div', { class: 'choice-row' });
      area.append(row);
      const ask = () => say('n_dict_find', W(low));
      G.setReplay(ask);
      ask();
      let tries = 0;
      res = await new Promise(resolve => opts.forEach(o => {
        const c = h('div', { class: 'word-choice pop-in' }, o);
        if (o === word) c.dataset.ok = 1;
        onTap(c, async () => {
          if (c.classList.contains('locked')) return;
          if (o === word) {
            row.querySelectorAll('.word-choice').forEach(x => x.classList.add('locked'));
            c.classList.add('right'); sfx('good'); burstAt(c, 14);
            await sleep(350);
            resolve({ right: tries === 0 ? 1 : 0, total: 1 });
          } else {
            tries++; c.classList.add('wrong', 'locked'); anim(c, 'shake'); sfx('bad');
            await say(o.toLowerCase() === low ? 'n_dict_first' : W(low));
          }
        });
        row.append(c);
      }));
    }
    right += res.right; total += res.total;
    const chip = chipEl(word);
    slots[i].append(chip); placed.push(chip); anim(chip, 'drop-in', 400);
  }

  // The end mark.
  slots.forEach((sl, k) => sl.classList.toggle('next', k === words.length));
  area.innerHTML = '';
  const row = h('div', { class: 'choice-row' });
  area.append(row);
  G.setReplay(() => say('n_dict_end'));
  say('n_dict_end');
  let tries = 0;
  await new Promise(resolve => ['.', '?', '!'].forEach(o => {
    const c = h('div', { class: 'word-choice mark pop-in' }, o);
    if (o === mark) c.dataset.ok = 1;
    onTap(c, () => {
      if (c.classList.contains('locked')) return;
      if (o === mark) { row.querySelectorAll('.word-choice').forEach(x => x.classList.add('locked')); c.classList.add('right'); resolve(); }
      else { tries++; c.classList.add('wrong', 'locked'); anim(c, 'shake'); sfx('bad'); }
    });
    row.append(c);
  }));
  right += tries === 0 ? 1 : 0; total++;
  const chip = chipEl(mark);
  slots[words.length].append(chip); placed.push(chip);
  slots.forEach(sl => sl.classList.remove('next'));
  area.innerHTML = '';
  sfx('sparkle');
  const clean = right === total;
  store.record('s:' + s.id, clean);
  G.gem(slots[words.length], clean ? 4 : 2);
  await say('n_dict_read');
  await readSentence(s.id, placed);
  await praise();
  return { right: clean ? 1 : 0, total: 1 };
}

// ---------------------------------------------------------------- Finish My Sentence
// The child picks how the sentence ends, spells that word, and hears their sentence.
export async function finishSentence(G, frame, items) {
  const st = G.stage;
  st.innerHTML = '';
  const chips = frame.t.split(' ').map(w => chipEl(w));
  const blank = h('div', { class: 'slot next' });
  const line = h('div', { class: 'sent-line' }, chips, blank, chipEl('.'));
  const area = h('div', { class: 'dict-area' });
  st.append(h('div', { class: 'sentence' }, line, area));
  const row = h('div', { class: 'choice-row pics' });
  area.append(row);
  const ask = () => say(frame.id, 400, 'n_finish_go');
  G.setReplay(ask);
  ask();
  const item = await new Promise(resolve => items.forEach((it, k) => {
    const c = h('div', { class: 'pic-card pop-in' }, h('span', { class: 'emoji' }, it.e));
    if (k === 0) c.dataset.ok = 1;
    onTap(c, () => { if (row.classList.contains('locked')) return; row.classList.add('locked'); sfx('tap'); c.classList.add('right'); resolve(it); });
    row.append(c);
  }));
  await sleep(300);
  const res = await forge(G, item, { host: area });
  area.innerHTML = '';
  const chip = chipEl(item.w);
  blank.append(chip); blank.classList.remove('next');
  anim(chip, 'drop-in', 400);
  line.classList.add('done');
  G.gem(line, 2);
  await say('n_finish_read', 250);
  const lit = [...line.querySelectorAll('.wchip')];
  lit.forEach(c => c.classList.add('hl'));
  await say(frame.id, W(item.w));
  lit.forEach(c => c.classList.remove('hl'));
  await praise();
  return res;
}

// ================================================================ Word games
// ---------------------------------------------------------------- Memory Match
export async function memory(G, items) {
  const st = G.stage;
  st.innerHTML = '';
  const cards = shuffle(items.flatMap(it => [{ it, kind: 'w' }, { it, kind: 'p' }]));
  const grid = h('div', { class: 'mem-grid n' + cards.length });
  st.append(h('div', { class: 'center-col' }, grid));
  let first = null, busy = false, matched = 0, misses = 0;
  cards.forEach(c => {
    const face = c.kind === 'w' ? h('div', { class: 'mem-face word' }, c.it.w) : h('div', { class: 'mem-face' }, h('span', { class: 'emoji' }, c.it.e));
    c.el = h('div', { class: 'mem-card pop-in' }, h('div', { class: 'mem-back' }, '⭐'), face);
  });
  grid.append(...cards.map(c => c.el));
  const markNext = () => {
    cards.forEach(c => delete c.el.dataset.ok);
    const target = first ? cards.find(c => c !== first && c.it === first.it) : cards.find(c => !c.el.classList.contains('up'));
    if (target) target.el.dataset.ok = 1;
  };
  markNext();
  G.setReplay(() => say('n_memory_go'));
  say('n_memory_go');
  return new Promise(resolve => cards.forEach(c => onTap(c.el, async () => {
    if (busy || c.el.classList.contains('up')) return;
    c.el.classList.add('up'); sfx('tap');
    if (!first) { first = c; markNext(); return; }
    const a = first; first = null;
    if (a.it === c.it) {
      a.el.classList.add('matched'); c.el.classList.add('matched');
      matched++;
      burstAt(c.el, 16); G.gem(c.el, 1);
      store.record('w:' + c.it.w, true);
      markNext();
      await say(W(c.it.w));
      if (matched === items.length) {
        await sleep(300);
        confetti(40);
        await praise();
        resolve({ right: Math.max(0, items.length - Math.floor(misses / 2)), total: items.length, score: Math.max(10, 100 - misses * 8) });
      }
    } else {
      misses++; busy = true; sfx('bad');
      await sleep(900);
      a.el.classList.remove('up'); c.el.classList.remove('up');
      busy = false;
      markNext();
    }
  })));
}

// ---------------------------------------------------------------- Word Ladder
// Change one sound at a time: cat -> cot -> cog.
export async function ladder(G, chain) {
  const st = G.stage;
  st.innerHTML = '';
  const row = h('div', { class: 'word-card' });
  const pic = h('div', { class: 'forge-pic' }, h('span', { class: 'emoji' }, ''));
  const opts = h('div', { class: 'choice-row' });
  const rungs = h('div', { class: 'rungs' });
  st.append(h('div', { class: 'ladder' }, rungs, pic, row, opts));
  let cur = chain[0], tries = 0;
  const draw = () => {
    row.innerHTML = '';
    const tiles = cur.seg.map(g => tileEl(g, 'word-tile'));
    row.append(...tiles);
    return tiles;
  };
  rungs.append(h('span', { class: 'rung' }, cur.w));
  for (let k = 1; k < chain.length; k++) {
    const target = chain[k];
    const pos = cur.seg.findIndex((g, i) => g !== target.seg[i]);
    pic.firstChild.textContent = target.e || '❓';
    anim(pic, 'bounce', 600);
    let tiles = draw();
    const ask = () => say('n_ladder_go', W(target.w));
    G.setReplay(ask);
    ask();
    // Which sound changes?
    await new Promise(resolve => tiles.forEach((t, i) => {
      if (i === pos) t.dataset.ok = 1;
      onTap(t, () => {
        if (row.classList.contains('locked')) return;
        if (P(cur.seg[i])) tap(P(cur.seg[i]));
        if (i === pos) { row.classList.add('locked'); t.classList.add('picked'); delete t.dataset.ok; resolve(); }
        else { tries++; anim(t, 'shake'); if (tries >= 2) tiles[pos].classList.add('hint'); }
      });
    }));
    // Which new sound?
    const want = target.seg[pos];
    const choices = shuffle([want, ...otherGraphemes(want, G.known.g, 4).filter(g => g !== cur.seg[pos]).slice(0, 2)]);
    opts.innerHTML = '';
    say('n_ladder_pick');
    await new Promise(resolve => choices.forEach(g => {
      const t = soundEl(g, 'pop-in');
      if (g === want) t.dataset.ok = 1;
      onTap(t, () => {
        if (t.classList.contains('locked')) return;
        tap(P(g));
        if (g === want) { opts.querySelectorAll('.tile').forEach(x => x.classList.add('locked')); t.classList.add('right'); resolve(); }
        else { tries++; t.classList.add('wrong', 'locked'); anim(t, 'shake'); }
      });
      opts.append(t);
    }));
    await sleep(300);
    opts.innerHTML = '';
    row.classList.remove('locked');
    cur = target;
    tiles = draw();
    tiles[pos].classList.add('right'); anim(tiles[pos], 'drop-in', 400);
    rungs.append(h('span', { class: 'rung pop-in' }, cur.w));
    sfx('sparkle');
    await say(W(cur.w));
    store.record('w:' + cur.w, tries === 0);
  }
  G.gem(row, tries === 0 ? 3 : 1);
  await praise();
  return { right: tries === 0 ? 1 : 0, total: 1 };
}

// ---------------------------------------------------------------- Spelling Detective
// One sound, several spellings: which one is in this word?
export async function spellSort(G, group, words) {
  const st = G.stage;
  st.innerHTML = '';
  const bins = group.map(g => { const b = h('div', { class: 'bin pop-in' }, h('span', {}, label(g))); b.dataset.g = g; return b; });
  const pic = h('div', { class: 'forge-pic' }, h('span', { class: 'emoji' }, ''));
  const row = h('div', { class: 'word-card' });
  st.append(h('div', { class: 'sort' }, pic, row, h('div', { class: 'bins' }, bins)));
  let right = 0, first = true, current = null;
  bins.forEach(b => onTap(b, () => current && current(b)));
  for (const item of words) {
    const hide = g => g === item.g || (g === SILENT_E && isSplit(item.g));
    row.innerHTML = '';
    row.append(...item.seg.map(g => hide(g) ? h('div', { class: 'tile word-tile blank' }, '?') : tileEl(g, 'word-tile')));
    anim(row, 'drop-in', 400);
    pic.firstChild.textContent = item.e || '👂';
    bins.forEach(b => { b.classList.remove('right', 'wrong', 'locked'); if (b.dataset.g === item.g) b.dataset.ok = 1; else delete b.dataset.ok; });
    const ask = () => say(W(item.w));
    G.setReplay(ask);
    if (first) say('n_sort_go', 200, W(item.w)); else ask();
    first = false;
    let tries = 0;
    await new Promise(resolve => {
      current = async b => {
        if (b.classList.contains('locked')) return;
        if (b.dataset.g === item.g) {
          current = null;
          bins.forEach(x => x.classList.add('locked'));
          delete b.dataset.ok;
          b.classList.add('right'); sfx('good'); burstAt(b, 18);
          row.innerHTML = '';
          row.append(...item.seg.map(g => tileEl(g, 'word-tile' + (hide(g) ? ' right' : ''))));
          if (!tries) G.gem(b, 1);
          store.record('w:' + item.w, tries === 0);
          await say(W(item.w));
          resolve();
        } else {
          tries++; b.classList.add('wrong', 'locked'); anim(b, 'shake'); sfx('bad');
          await say(W(item.w));
        }
      };
    });
    if (tries === 0) right++;
    await sleep(500);
  }
  await praise();
  return { right, total: words.length };
}

// ---------------------------------------------------------------- Syllable Chop
export async function chop(G, item) {
  const st = G.stage;
  st.innerHTML = '';
  const parts = splitSyllables(item.seg, item.syl);
  const cuts = new Set();
  parts.slice(0, -1).reduce((n, p) => { cuts.add(n + p.length); return n + p.length; }, 0);
  const tiles = item.seg.map(g => tileEl(g, 'word-tile'));
  const row = h('div', { class: 'chop-row' });
  const gaps = [];
  tiles.forEach((t, i) => {
    if (i > 0) {
      const gap = h('div', { class: 'gap' }, h('i'));
      if (cuts.has(i)) gap.dataset.ok = 1;
      gaps.push(gap);
      row.append(gap);
    }
    row.append(t);
  });
  const pic = h('div', { class: 'forge-pic pop-in' }, h('span', { class: 'emoji' }, item.e || '✂️'));
  st.append(h('div', { class: 'forge' }, pic, row));
  const ask = () => say('n_chop_go');
  G.setReplay(ask);
  ask();
  let tries = 0, done = 0;
  await new Promise(resolve => gaps.forEach(gap => onTap(gap, () => {
    if (gap.classList.contains('cut')) return;
    if (gap.dataset.ok) {
      delete gap.dataset.ok;
      gap.classList.add('cut'); gap.classList.remove('hint'); sfx('pop'); burstAt(gap, 14);
      if (++done === cuts.size) resolve();
    } else { tries++; anim(gap, 'shake'); sfx('bad'); if (tries >= 2) gaps.filter(g => g.dataset.ok).forEach(g => g.classList.add('hint')); }
  })));
  await sleep(300);
  await say('n_chop_read');
  let k = 0;
  for (const p of parts) {
    const ts = tiles.slice(k, k + p.length);
    ts.forEach(t => t.classList.add('lit'));
    for (const g of p) if (P(g)) { await tap(P(g)); await sleep(60); }
    await sleep(250);
    ts.forEach(t => t.classList.remove('lit'));
    k += p.length;
  }
  tiles.forEach(t => anim(t, 'wave', 600));
  await say(W(item.w));
  store.record('w:' + item.w, tries === 0);
  G.gem(row, tries === 0 ? 2 : 1);
  await praise();
  return { right: tries === 0 ? 1 : 0, total: 1 };
}
