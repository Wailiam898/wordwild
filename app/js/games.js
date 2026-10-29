// The activities. Each takes a game context G and resolves with { right, total }.
// G = { stage, setReplay(fn), known: {g,h}, pool: [{w,e,seg}], gem(el,n), first(key) }
import { GRAPHEMES, HEART, STORIES } from './data.js';
import { VARIANTS } from './variants.js';
import { say, tap, sfx, clipDuration, load } from './audio.js';
import { h, onTap, sleep, shuffle, pick, anim, praise, oops, burstAt, confetti } from './ui.js';
import { pipSVG, rocketSVG } from './art.js';
import * as store from './store.js';

const P = g => 'p_' + g;
const W = w => 'w_' + w;

function tileEl(g, cls = '') {
  return h('div', { class: 'tile ' + cls + (g.length > 1 ? ' multi' : '') }, g);
}

function otherGraphemes(g, known, n) {
  const ipa = GRAPHEMES[g].ipa;
  let pool = [...known].filter(x => x !== g && GRAPHEMES[x].ipa !== ipa);
  if (pool.length < n) {
    pool = pool.concat(Object.keys(GRAPHEMES).filter(x => x.length === 1 && x !== g && GRAPHEMES[x].ipa !== ipa && !pool.includes(x)));
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
  const crystal = h('div', { class: 'crystal pop-in' }, h('span', {}, g));
  const pic = h('div', { class: 'meet-pic' }, h('span', { class: 'emoji' }, x.e));
  st.append(h('div', { class: 'meet' }, crystal, pic));
  onTap(crystal, () => { anim(crystal, 'wiggle'); tap(P(g)); });
  const intro = async () => {
    anim(crystal, 'glow', 900);
    await say('n_intro_this', 250, P(g), 350, 'n_intro_like');
    anim(pic, 'bounce', 700);
    await say(W(x.key), 300, P(g));
  };
  G.setReplay(intro);
  await intro();
  anim(crystal, 'glow', 2400);
  await say('n_intro_say', 350, P(g), 700, P(g));
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
    const t = tileEl(o, 'bubble-tile pop-in');
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
    const el = h('div', { class: 'bubble' + (g.length > 1 ? ' multi' : '') }, h('span', {}, g));
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
      tap(P(seg[i]));
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
        lastI = i; tap(P(seg[i])); sfx('slide');
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
export async function forge(G, item) {
  const st = G.stage;
  st.innerHTML = '';
  const seg = item.seg;
  const lvl = store.level();
  const extra = otherGraphemes(seg[0], G.known.g, 6).filter(g => !seg.includes(g)).slice(0, [1, 2, 3][lvl]);
  const tray = shuffle([...seg, ...extra]);
  const boxes = seg.map(() => h('div', { class: 'sound-box' }));
  const pic = h('div', { class: 'forge-pic pop-in' }, h('span', { class: 'emoji' }, item.e));
  const trayEl = h('div', { class: 'tray' });
  st.append(h('div', { class: 'forge' }, pic, h('div', { class: 'box-row' }, boxes), trayEl));
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
        tap(P(g));
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
  await say('n_pip_which');
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
  if (!opts.reread) await say('n_story_start', 300, `st_${id}`); else await say(`st_${id}`);
  await new Promise(r => onTap(go, r));
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
