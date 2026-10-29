// Cloud saves (Supabase, same project as Whisker Academy, ww_* functions).
// A player is a name + 4-digit secret code. Progress syncs automatically;
// two devices playing as the same child merge so nothing earned is lost.
import * as store from './store.js';

const URL_ = 'https://qevfbqsutnhgpvnyfopb.supabase.co/rest/v1/rpc/';
const KEY = 'sb_publishable_yX82xUvRtTFyPscUBp5huA_sZR47ql6';

let timer = null, busy = false, again = false, status = 'idle';
const listeners = new Set();

export function onStatus(fn) { listeners.add(fn); fn(status); return () => listeners.delete(fn); }
function setStatus(s) { status = s; listeners.forEach(fn => fn(s)); }
export const cloudStatus = () => status;

async function rpc(fn, body, ms = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(URL_ + fn, {
      method: 'POST', signal: ctl.signal,
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('cloud ' + r.status);
    const txt = await r.text();
    return txt ? JSON.parse(txt) : null;
  } finally { clearTimeout(t); }
}

export const nameKey = n => String(n || '').trim().replace(/\s+/g, ' ').toLowerCase();

export async function pinHash(name, pin) {
  const data = new TextEncoder().encode(nameKey(name) + '#wordwild#' + pin);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return 'w1:' + [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export const exists = name => rpc('ww_exists', { p_name: name });
export const load = (name, pin) => rpc('ww_load', { p_name: name, p_pin: pin });
export const setPin = (name, pin, next) => rpc('ww_set_pin', { p_name: name, p_pin: pin, p_new: next });

const on = () => { const s = store.state(); return !!(s.name && s.pinHash && s.cloud); };

// What goes to the cloud: everything except this device's code hash and sync bookkeeping.
function payload() {
  const { pinHash: _p, syncedAt: _s, baseGems: _b, cloud: _c, ...rest } = store.state();
  return rest;
}

export function queue() {
  if (!on()) return;
  clearTimeout(timer);
  timer = setTimeout(push, 1500);
}

export async function push() {
  if (!on()) return;
  if (busy) { again = true; return; }
  busy = true; setStatus('saving');
  const s = store.state();
  try {
    const at = s.savedAt || Date.now();
    let r = await rpc('ww_save', { p_name: s.name, p_pin: s.pinHash, p_data: payload(), p_saved_at: at, p_base: s.syncedAt || 0 });
    for (let tries = 0; r && r.status === 'conflict' && tries < 3; tries++) {
      // Another device saved since we last synced: merge both, then save again.
      const c = await load(s.name, s.pinHash);
      if (c && c.status === 'ok' && c.data) store.merge(c.data);
      const t = Math.max(Date.now(), (c && c.saved_at || 0) + 1);
      store.state().savedAt = t;
      r = await rpc('ww_save', { p_name: s.name, p_pin: s.pinHash, p_data: payload(), p_saved_at: t, p_base: c ? c.saved_at : 0 });
    }
    if (r && r.ok) {
      s.syncedAt = r.saved_at; s.baseGems = s.gems; store.persist();
      setStatus('ok');
    } else if (r && (r.status === 'bad' || r.status === 'taken')) {
      setStatus('denied'); // code changed on another device, or the name was taken
    } else setStatus('off');
  } catch (e) { setStatus('off'); }
  busy = false;
  if (again) { again = false; queue(); }
}

// On start-up / returning to the app: pull newer progress made on another device.
export async function sync() {
  if (!on()) return;
  const s = store.state();
  try {
    const c = await load(s.name, s.pinHash);
    if (!c || c.status === 'none') return push();
    if (c.status !== 'ok') { setStatus(c.status === 'bad' ? 'denied' : 'off'); return; }
    const cloudNewer = (c.saved_at || 0) > (s.syncedAt || 0);
    const localNewer = (s.savedAt || 0) > (s.syncedAt || 0);
    if (cloudNewer && !localNewer) { store.adopt(c.data, c.saved_at); setStatus('ok'); return 'adopted'; }
    if (cloudNewer && localNewer) { store.merge(c.data); return push(); }
    if (localNewer) return push();
    setStatus('ok');
  } catch (e) { setStatus('off'); }
}

addEventListener('online', () => on() && push());
document.addEventListener('visibilitychange', () => {
  if (!on()) return;
  if (document.hidden) { clearTimeout(timer); push(); } else sync();
});

// Anonymous play counter: random device id, no names, fire-and-forget.
export function countPlay() {
  try {
    const K = 'wordwild.vid';
    let v = localStorage.getItem(K), fresh = false;
    if (!v) {
      const b = new Uint8Array(8); crypto.getRandomValues(b);
      v = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(K, v); fresh = true;
    }
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    let ref = null; try { ref = document.referrer ? new URL(document.referrer).hostname.slice(0, 64) : null; } catch (e) {}
    fetch(URL_ + 'ww_hit', {
      method: 'POST', keepalive: true,
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_visitor: v, p_new: fresh, p_ref: ref, p_mode: standalone ? 'app' : 'browser', p_w: Math.round(innerWidth) || null }),
    }).catch(() => {});
  } catch (e) {}
}
