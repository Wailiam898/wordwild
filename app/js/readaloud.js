// "Read it to Pip": the child reads a word or sentence aloud, hears their own voice
// played back, then hears the model reading.
//
// Privacy: the recording never leaves the device. It is made with getUserMedia +
// MediaRecorder, kept in memory only (never written to storage, never uploaded, never
// sent to speech recognition), played once, then thrown away. Everything in here is
// optional and silent on failure: if the microphone is missing or refused the step is
// skipped and the child sees nothing wrong. It is off until a grown-up switches it on in
// the Grown-ups corner.
import { h, onTap, sleep } from './ui.js';
import { pipSVG } from './art.js';
import { say, sfx, stopSpeech, playBlob, setSession } from './audio.js';
import * as store from './store.js';

let blocked = false;  // the microphone was refused or is missing this session: stop offering
let held = null;      // the clip while it is in memory (only used to check it is dropped)

export const supported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof window.MediaRecorder !== 'undefined');
export const enabled = () => !!(store.state().settings && store.state().settings.readAloud) && supported() && !blocked;
export const clipHeld = () => held !== null;

// For the Grown-ups switch: ask for the microphone now (so the grown-up sees the browser's
// question), then let it go straight away. Returns 'ok', 'unsupported' or 'denied'.
export async function probe() {
  if (!supported()) return 'unsupported';
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach(t => t.stop());
    blocked = false;
    return 'ok';
  } catch (e) {
    return 'denied';
  }
}

// o = { kind: 'word' | 'sentence', tokens: ['sat'] or the words of the sentence,
//       model: async spans => plays the model reading (and may light the word spans) }
// Resolves true if the child went through it, false if it was skipped. Never throws.
// Sets o.recorded when the child really recorded something (used for the page reward; the clip itself is dropped).
export async function readToPip(G, o) {
  // o.perPage: a book page may ask every time (once per page); the lesson flow keeps its small limit.
  if (!enabled()) return false;
  if (!o.perPage) {
    if (!G.ra || G.ra.used >= G.ra.max) return false;
    G.ra.used++;
  }
  const st = G.stage;
  const maxMs = o.kind === 'word' ? 6000 : 15000;
  let stream = null, rec = null, chunks = [], timer = 0, idle = 0, phase = 'ask', t0 = 0, stopped = null;
  let finish;
  const ended = new Promise(r => (finish = r));

  const spans = o.tokens.map(t => h('span', { class: 'ra-w' }, t));
  const text = h('div', { class: 'ra-text' + (o.kind === 'sentence' ? ' sentence' : '') });
  spans.forEach((s, i) => { text.append(s); if (i < spans.length - 1) text.append(' '); });
  const mic = h('button', { class: 'btn huge ra-mic', 'aria-label': 'Read it to Pip' }, '🎤');
  const skip = h('button', { class: 'btn round ra-skip', 'aria-label': 'Skip' }, '▶');
  const pip = h('div', { class: 'ra-pip', html: pipSVG('talk', G.hat || '') });
  const ov = h('div', { class: 'ra' }, pip, text, mic, skip);

  const cleanup = () => {
    clearTimeout(timer); clearTimeout(idle);
    try { if (rec && rec.state !== 'inactive') rec.stop(); } catch (e) {}
    if (stream) { try { stream.getTracks().forEach(t => t.stop()); } catch (e) {} stream = null; }
    setSession('playback');
    rec = null; chunks = []; held = null;   // the recording is discarded here
    phase = 'done';
    ov.remove();
  };
  const quit = ok => { cleanup(); finish(ok); };
  G.onExit = () => { cleanup(); finish(false); };

  async function stopRecording() {
    if (phase !== 'rec') return;
    phase = 'play';
    clearTimeout(timer);
    mic.classList.remove('rec'); mic.hidden = true; skip.hidden = true;
    const ms = performance.now() - t0;
    const recorder = rec;
    try { recorder.stop(); } catch (e) {}
    await Promise.race([stopped, sleep(1500)]);
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    setSession('playback');
    let clip = null;
    try { if (ms >= 350 && chunks.length) clip = new Blob(chunks, { type: (recorder && recorder.mimeType) || 'audio/mp4' }); } catch (e) {}
    chunks = []; held = clip;
    if (clip) o.recorded = true;   // the child really read aloud (nothing of it is kept)
    pip.innerHTML = pipSVG('wow', G.hat || '');
    if (clip && phase === 'play') { await say('pl_ra_you'); await playBlob(clip); }
    clip = null; held = null;                 // discarded: nothing keeps the recording
    if (phase !== 'play') return;
    await say('pl_ra_me');
    if (phase !== 'play') return;
    await o.model(spans);
    if (phase !== 'play') return;
    sfx('good');
    await sleep(500);
    quit(true);
  }

  async function startRecording() {
    phase = 'starting';
    stopSpeech();
    try {
      setSession('play-and-record');
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      rec = new MediaRecorder(stream);
    } catch (e) {
      blocked = true;      // refused or missing: skip quietly for the rest of the session
      return quit(false);
    }
    if (phase !== 'starting') return;
    chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    stopped = new Promise(r => (rec.onstop = r));
    try { rec.start(); } catch (e) { blocked = true; return quit(false); }
    phase = 'rec'; t0 = performance.now();
    clearTimeout(idle);
    mic.classList.add('rec'); mic.textContent = '⏹';
    timer = setTimeout(stopRecording, maxMs);
  }

  onTap(mic, () => { if (phase === 'ask') startRecording(); else if (phase === 'rec') stopRecording(); });
  onTap(skip, () => { if (phase === 'ask' || phase === 'rec') { sfx('tap'); quit(false); } });
  st.append(ov);
  // A child who walks away never leaves the lesson stuck here.
  idle = setTimeout(() => { if (phase === 'ask') quit(false); }, 25000);
  say('pl_ra_go');
  return ended;
}
