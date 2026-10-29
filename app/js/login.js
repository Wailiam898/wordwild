// Sign-in: player name + 4-digit secret code (same idea as Whisker Academy).
// New name -> make a code (twice) -> cloud save created. Known name -> type the code.
import { say, sfx } from './audio.js';
import { h, onTap, anim, burstAt, sleep } from './ui.js';
import { pipSVG } from './art.js';
import * as store from './store.js';
import * as cloud from './cloud.js';

function screen(el) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  app.className = 'screen-login';
  app.append(el);
}

// Shows a keypad and resolves with a 4-digit string (or null if Back is tapped).
function pinPad({ title, sub, line, err, onBack, mood = 'happy' }) {
  return new Promise(resolve => {
    let val = '';
    const dots = h('div', { class: 'pin-dots' }, [0, 1, 2, 3].map(() => h('i')));
    const errEl = h('p', { class: 'login-err' }, err || '');
    const pip = h('div', { class: 'login-pip', html: pipSVG(err ? 'sad' : mood) });
    const draw = () => dots.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i < val.length));
    const key = k => {
      if (k === 'del') { val = val.slice(0, -1); sfx('tap'); return draw(); }
      if (val.length >= 4) return;
      val += k; sfx('tap'); draw();
      if (val.length === 4) setTimeout(() => resolve(val), 220);
    };
    const pad = h('div', { class: 'pin-pad' },
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => onTap(h('button', { class: 'pin-key' }, String(n)), () => key(String(n)))),
      onBack ? onTap(h('button', { class: 'pin-key small' }, '◀'), () => resolve(null)) : h('span'),
      onTap(h('button', { class: 'pin-key' }, '0'), () => key('0')),
      onTap(h('button', { class: 'pin-key small' }, '⌫'), () => key('del')));
    screen(h('div', { class: 'login' }, pip, h('h2', {}, title), sub ? h('p', { class: 'login-sub' }, sub) : null, dots, errEl, pad));
    if (err) anim(dots, 'shake');
    if (line) say(...[].concat(line));
  });
}

// Asks for a new code twice. Resolves with the code, or null if Back.
async function makeCode(name, title = 'Make a secret code 🔐') {
  let err = '';
  for (;;) {
    const a = await pinPad({ title, sub: 'Pick 4 numbers you will remember.', line: err ? 'n_pin_mismatch' : 'n_pin_new', err, onBack: true });
    if (a == null) return null;
    const b = await pinPad({ title: 'Type it one more time', sub: `${name}'s secret code`, line: 'n_pin_again', onBack: true });
    if (b == null) return null;
    if (a === b) return a;
    sfx('bad');
    err = "Those didn't match. Let's pick it again!";
  }
}

function nameScreen(err = '', value = '') {
  return new Promise(resolve => {
    const input = h('input', { class: 'name-input', type: 'text', maxlength: 16, autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', placeholder: 'Name', value });
    const go = h('button', { class: 'btn big go' }, '▶');
    const errEl = h('div', { class: 'login-err' });
    errEl.innerHTML = err;
    const submit = () => {
      const v = input.value.trim().replace(/\s+/g, ' ');
      if (v.length < 2) { errEl.textContent = 'Your name needs at least 2 letters.'; anim(input, 'shake'); sfx('bad'); return; }
      input.blur();
      resolve({ name: v.slice(0, 16) });
    };
    onTap(go, submit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    errEl.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (b) resolve({ act: b.dataset.act, name: input.value.trim() });
    });
    screen(h('div', { class: 'login' },
      h('div', { class: 'login-pip', html: pipSVG('wow') }),
      h('h2', {}, "Who's playing?"),
      h('p', { class: 'login-sub' }, 'Ask a grown-up to type your name.'),
      h('div', { class: 'name-row' }, input, go), errEl));
    say('n_who');
    setTimeout(() => input.focus(), 300);
  });
}

// Full sign-in flow. Resolves when the player is ready to play.
export async function loginFlow() {
  let err = '', value = '';
  for (;;) {
    const r = await nameScreen(err, value);
    err = ''; value = r.name || '';
    if (r.act === 'offline') {
      const s = store.state();
      s.name = r.name || 'Player'; s.cloud = false; s.pinHash = '';
      store.save();
      return;
    }
    const name = r.name;
    if (!name || name.length < 2) continue;
    let exists;
    try { exists = await cloud.exists(name); }
    catch (e) {
      err = "Hmm, I can't reach the internet.<br><button class='chip' data-act='retry'>↻ Try again</button> <button class='chip' data-act='offline'>Play without saving</button>";
      continue;
    }
    if (exists) {
      // Sign in to an existing player.
      let perr = '';
      for (;;) {
        const pin = await pinPad({ title: `Hi ${name}! 👋`, sub: 'Type your secret code', line: perr ? 'n_pin_wrong' : 'n_pin_enter', err: perr, onBack: true });
        if (pin == null) break;
        const hash = await cloud.pinHash(name, pin);
        let res;
        try { res = await cloud.load(name, hash); } catch (e) { perr = "I can't reach the internet. Try again in a moment."; continue; }
        if (res && res.status === 'ok') {
          const local = JSON.parse(JSON.stringify(store.state()));
          store.adopt(res.data, res.saved_at);
          store.state().pinHash = hash;
          if (Object.keys(local.done || {}).length && !local.name) { store.merge(local); store.save(); } // keep progress made before signing in
          store.persist();
          sfx('fanfare');
          await say('n_welcome_back');
          return;
        }
        sfx('bad');
        perr = res && res.status === 'locked' ? 'Too many tries. Wait 30 seconds, then try again.' : "That's not the right code. Try again!";
      }
      continue;
    }
    // New player.
    const pin = await makeCode(name);
    if (pin == null) continue;
    const s = store.state();
    s.name = name; s.pinHash = await cloud.pinHash(name, pin); s.cloud = true; s.syncedAt = 0;
    store.save();
    await cloud.push();
    if (cloud.cloudStatus() === 'denied') {
      s.name = ''; s.pinHash = ''; s.cloud = false; store.persist();
      err = 'Someone just took that name. Try a different one!';
      continue;
    }
    sfx('fanfare');
    burstAt(document.querySelector('.login-pip') || document.body, 40);
    await sleep(400);
    return;
  }
}

// Grown-ups corner: change the secret code.
export async function changeCode() {
  const s = store.state();
  const pin = await makeCode(s.name, 'Pick a new secret code 🔐');
  if (pin == null) return false;
  const next = await cloud.pinHash(s.name, pin);
  try {
    const ok = await cloud.setPin(s.name, s.pinHash, next);
    if (!ok) return false;
  } catch (e) { return false; }
  s.pinHash = next; store.persist();
  return true;
}

// Grown-ups corner: switch on cloud save for a player who started offline.
export async function joinCloud() {
  const s = store.state();
  if (!s.name || s.name === 'Player') return 'name';
  try { if (await cloud.exists(s.name)) return 'taken'; } catch (e) { return 'offline'; }
  const pin = await makeCode(s.name);
  if (pin == null) return 'cancel';
  s.pinHash = await cloud.pinHash(s.name, pin); s.cloud = true; s.syncedAt = 0;
  store.save();
  await cloud.push();
  return cloud.cloudStatus() === 'ok' ? 'ok' : 'offline';
}
