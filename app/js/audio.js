// Voice clips (decoded once, played through Web Audio for instant response on iOS),
// synthesised sound effects, and a gentle generative music loop that ducks under speech.

let ctx = null;
let master, voiceBus, sfxBus, musicBus;
const buffers = new Map();
const loading = new Map();
let speechToken = 0;
let activeSources = [];
let musicOn = true;
let musicTimer = null;
let theme = 'sands';

export function audioReady() { return !!ctx; }

export function unlock() {
  if (!ctx) {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return; // No Web Audio: the game still runs, silently.
    try { ctx = new AC(); } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
    voiceBus = ctx.createGain(); voiceBus.gain.value = 1.0; voiceBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.5; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
    // iOS needs a sound started inside the gesture to fully unlock.
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource(); s.buffer = b; s.connect(master); s.start(0);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ctx.suspend(); else ctx.resume();
    });
  }
  if (ctx.state !== 'running') ctx.resume();
}

function url(id) { return `audio/${id}.mp3`; }

export function load(id) {
  if (buffers.has(id)) return Promise.resolve(buffers.get(id));
  if (loading.has(id)) return loading.get(id);
  const p = fetch(url(id))
    .then(r => { if (!r.ok) throw new Error(id); return r.arrayBuffer(); })
    .then(ab => new Promise((res, rej) => {
      // A clip that can't be decoded must never stall the game.
      const t = setTimeout(() => rej(new Error('decode timeout')), 5000);
      ctx.decodeAudioData(ab, b => { clearTimeout(t); res(b); }, e => { clearTimeout(t); rej(e); });
    }))
    .then(buf => { buffers.set(id, buf); loading.delete(id); return buf; })
    .catch(() => { loading.delete(id); buffers.set(id, null); return null; });
  loading.set(id, p);
  return p;
}

// Preload in the background with limited concurrency.
export async function preload(ids) {
  if (!ctx) return;
  const queue = [...new Set(ids)].filter(id => !buffers.has(id));
  const worker = async () => { while (queue.length) await load(queue.shift()); };
  await Promise.all(Array.from({ length: 6 }, worker));
}

function playBuffer(buf, rate = 1) {
  return new Promise(res => {
    const s = ctx.createBufferSource();
    s.buffer = buf; s.playbackRate.value = rate;
    s.connect(voiceBus);
    let done = false;
    const end = () => { if (done) return; done = true; activeSources = activeSources.filter(x => x !== s); res(); };
    s.onended = end;
    // If the audio context is interrupted (e.g. iOS call/lock), never leave the game waiting.
    setTimeout(end, buf.duration / rate * 1000 + 400);
    activeSources.push(s);
    s.start();
  });
}

export function stopSpeech() {
  speechToken++;
  activeSources.forEach(s => { try { s.stop(); } catch (e) {} });
  activeSources = [];
  duck(false);
}

// say('n_pop_go', 'p_s') plays clips in order. Numbers are pauses in ms.
// Cancels anything already being said. Resolves true if it finished.
export async function say(...seq) {
  if (!ctx) return false;
  stopSpeech();
  const token = speechToken;
  duck(true);
  for (const item of seq.flat()) {
    if (token !== speechToken) return false;
    if (typeof item === 'number') { await wait(item); continue; }
    if (!item) continue;
    const buf = await load(item);
    if (token !== speechToken) return false;
    if (buf) await playBuffer(buf);
    await wait(90);
  }
  if (token === speechToken) duck(false);
  return token === speechToken;
}

// Plays without cancelling current speech (e.g. tapping letters quickly).
export async function tap(id) {
  if (!ctx || !id) return;
  const buf = await load(id);
  if (buf) {
    activeSources.forEach(s => { try { s.stop(); } catch (e) {} });
    activeSources = [];
    await playBuffer(buf);
  }
}

export function clipDuration(id) {
  const b = buffers.get(id);
  return b ? b.duration : 0;
}

const wait = ms => new Promise(r => setTimeout(r, ms));

// ---------- Sound effects ----------
function env(g, t, a, d, peak) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function tone(freq, t, dur, type = 'sine', peak = 0.3, bus = sfxBus, slideTo) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  env(g, t, 0.008, dur, peak);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
}
let noiseBuf;
function noise(t, dur, peak = 0.2, f1 = 1000, f2, q = 1) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
  f.frequency.setValueAtTime(f1, t);
  if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain(); env(g, t, 0.01, dur, peak);
  s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); s.stop(t + dur + 0.05);
}

const SFX = {
  tap(t) { tone(880, t, 0.06, 'triangle', 0.15); },
  pop(t) { tone(500, t, 0.12, 'sine', 0.35, sfxBus, 1400); noise(t, 0.05, 0.15, 3000); },
  good(t) { [1046, 1318, 1568].forEach((f, i) => tone(f, t + i * 0.07, 0.35, 'sine', 0.22)); },
  bad(t) { tone(330, t, 0.16, 'triangle', 0.16); tone(247, t + 0.13, 0.22, 'triangle', 0.14); },
  coin(t) { tone(988, t, 0.08, 'square', 0.08); tone(1319, t + 0.07, 0.3, 'square', 0.08); },
  whoosh(t) { noise(t, 0.45, 0.25, 400, 3000, 0.8); },
  launch(t) { noise(t, 1.2, 0.3, 200, 4000, 0.6); tone(120, t, 1.1, 'sawtooth', 0.06, sfxBus, 900); },
  sparkle(t) { [1568, 2093, 2637, 3136, 2637, 3520].forEach((f, i) => tone(f, t + i * 0.05, 0.25, 'sine', 0.1)); },
  crack(t) { noise(t, 0.12, 0.4, 2500, 800, 2); tone(180, t, 0.08, 'square', 0.05); },
  fanfare(t) { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, t + i * 0.11, i === 5 ? 0.6 : 0.18, 'triangle', 0.2)); },
  boing(t) { tone(200, t, 0.35, 'sine', 0.3, sfxBus, 600); },
  slide(t) { tone(400, t, 0.12, 'sine', 0.12, sfxBus, 700); },
};
export function sfx(name) {
  if (!ctx || !SFX[name]) return;
  SFX[name](ctx.currentTime + 0.005);
}

// ---------- Music ----------
const SCALES = {
  sands:   { root: 60, bpm: 104, prog: [0, 5, 7, 5] },
  jungle:  { root: 57, bpm: 112, prog: [0, 3, 5, 7] },
  volcano: { root: 55, bpm: 100, prog: [0, 5, 3, 7] },
  caves:   { root: 62, bpm: 92,  prog: [0, 7, 5, 3] },
  clouds:  { root: 65, bpm: 96,  prog: [0, 5, 7, 3] },
  reef:    { root: 58, bpm: 108, prog: [0, 3, 7, 5] },
  space:   { root: 63, bpm: 88,  prog: [0, 7, 3, 5] },
  title:   { root: 60, bpm: 100, prog: [0, 5, 3, 7] },
};
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

function marimba(freq, t, vol) {
  tone(freq, t, 0.5, 'sine', vol, musicBus);
  tone(freq * 4, t, 0.08, 'sine', vol * 0.25, musicBus);
}

export function setTheme(name) { theme = SCALES[name] ? name : 'sands'; }

export function setMusic(on) {
  musicOn = on;
  if (!ctx) return;
  if (on) startMusic(); else stopMusic();
}

function startMusic() {
  if (musicTimer || !ctx) return;
  musicBus.gain.setTargetAtTime(0.5, ctx.currentTime, 0.5);
  let step = 0;
  let next = ctx.currentTime + 0.1;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  musicTimer = setInterval(() => {
    const sc = SCALES[theme];
    const beat = 60 / sc.bpm / 2;
    while (next < ctx.currentTime + 0.3) {
      const bar = Math.floor(step / 8) % sc.prog.length;
      const chord = sc.root + sc.prog[bar];
      if (step % 8 === 0) tone(mtof(chord - 24), next, beat * 7, 'triangle', 0.18, musicBus);
      if (step % 8 === 4) tone(mtof(chord - 17), next, beat * 3, 'triangle', 0.1, musicBus);
      if (rnd() < 0.62) {
        const n = PENTA[Math.floor(rnd() * PENTA.length)];
        marimba(mtof(chord + 12 + n), next, 0.09);
      }
      if (step % 2 === 1) noise(next, 0.04, 0.025, 8000, null, 1);
      next += beat; step++;
    }
  }, 100);
}

function stopMusic() {
  clearInterval(musicTimer); musicTimer = null;
  if (musicBus) musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
}

function duck(on) {
  if (!ctx || !musicOn || !musicTimer) return;
  musicBus.gain.setTargetAtTime(on ? 0.15 : 0.5, ctx.currentTime, 0.15);
}

export function startMusicIfOn() { if (musicOn) startMusic(); }
