// Reading-speed timing, for grown-ups only. Nothing here shows anything to the child, and nothing
// here touches stars, gems or the lesson: a timer is started when a word (or sentence) appears, and
// when the child gets it right first time the time is saved with store.recordReadTime().
// Time while the voice is talking, and time while the tab is hidden, is not counted.
import { voiceBusyMs } from './audio.js';
import * as store from './store.js';

export const MIN_SECS = 0.5;    // quicker than this was a guess, not a read
export const MAX_SECS = 30;     // longer than this and the child had wandered off

let hiddenTotal = 0, hiddenSince = typeof document !== 'undefined' && document.hidden ? performance.now() : 0;
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenSince = performance.now();
    else if (hiddenSince) { hiddenTotal += performance.now() - hiddenSince; hiddenSince = 0; }
  });
}
const hiddenNow = () => hiddenTotal + (hiddenSince ? performance.now() - hiddenSince : 0);

// A running timer: elapsed() is the seconds so far, without audio and hidden time.
export function startTimer() {
  const t0 = performance.now(), a0 = voiceBusyMs(), h0 = hiddenNow();
  return {
    elapsed: () => Math.max(0, (performance.now() - t0 - (voiceBusyMs() - a0) - (hiddenNow() - h0)) / 1000),
  };
}

export const sensible = secs => Number.isFinite(secs) && secs >= MIN_SECS && secs <= MAX_SECS;

// Save one reading. `count` is the number of words it covers (1 for a single word).
// Returns true if it was kept (not a silly value).
export function save(timer, word, count = 1) {
  if (!timer) return false;
  const secs = timer.elapsed();
  if (!sensible(secs)) return false;
  store.recordReadTime(word, secs, count);
  return true;
}
