"""Pure phonics sounds in an Australian voice, made the way teachers say them.

Synthetic-phonics rule (Read Write Inc, Jolly Phonics, Australian Year 1 Phonics Check):
say each sound with no "uh" (schwa) on the end.
  stretchy sounds  m n s f l r v z sh th ng  -> held steady: "mmmm", "nnnn"
  bouncy sounds    p t k c ck b d g ch j h   -> short and crisp, no "uh"
  w, y, qu, x      -> very short glides / clusters
  short vowels     a e i o u                 -> clean and short (a as in ant)
  long vowels      ai ee igh oa oo ar or ur ow oi -> as in the key word

TTS voices can't say isolated sounds (n comes out "nye"). So Natasha (en-AU) says
a real word, and the target sound is cut out with acoustic cues (where the hum of
an "n" ends and the vowel starts, where a hiss stops, where voicing begins).
Stretchy sounds are then held by looping their steady middle.
A phoneme recogniser checks each result has no vowel attached.

Usage: .venv/Scripts/python.exe -I tools/pure_sounds.py
"""
import sys, asyncio, subprocess, json
from pathlib import Path
import numpy as np
import soundfile as sf
import edge_tts

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "app" / "audio"
WAV = ROOT / "work" / "wav"
SRC = ROOT / "work" / "pure_src"
SRC.mkdir(parents=True, exist_ok=True)
VOICE = "en-AU-NatashaNeural"
SR = 24000
NOW = subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0

# grapheme -> (carrier text, method)
PLAN = {
    # stretchy: from the start of a word, up to the vowel
    "s": ("sun", "fric"), "ss": ("sun", "fric"), "f": ("fan", "fric"), "ff": ("fan", "fric"),
    "sh": ("ship", "fric"), "th": ("thin", "fric"), "z": ("zip", "vfric"), "zz": ("zip", "vfric"), "v": ("van", "vfric"),
    "m": ("map", "nasal"), "n": ("nap", "nasal"), "l": ("lap", "nasal"), "ll": ("lap", "nasal"), "r": ("rat", "nasal"),
    "ng": ("sing", "ng"),
    # bouncy: burst up to the vowel
    "p": ("pot", "stop"), "t": ("top", "stop"), "k": ("cat", "stop"), "c": ("cat", "stop"), "ck": ("cat", "stop"),
    "b": ("bat", "stop"), "d": ("dog", "stop"), "g": ("got", "stop"), "ch": ("chip", "stop"), "j": ("jam", "stop"),
    "h": ("hat", "stop"),
    "w": ("wet", "glide"), "y": ("yes", "glide"), "qu": ("quick", "glide"), "x": ("box", "tail"),
    # short vowels: from a word that starts with the vowel
    "a": ("at", "vowel"), "e": ("egg", "vowel"), "i": ("it", "vowel"), "o": ("odd", "vowel"), "u": ("up", "vowel"),
    # long vowels: words that are only that sound
    "ai": ("A", "whole"), "ee": ("E", "whole"), "igh": ("I", "whole"), "oa": ("O", "whole"), "oo": ("ooh", "whole"),
    "ar": ("are", "whole"), "or": ("or", "whole"), "ur": ("err", "whole"), "ow": ("ow", "whole"), "oi": ("oy", "whole"),
}


async def synth_all():
    texts = sorted({t for t, _ in PLAN.values()})
    for t in texts:
        mp3 = SRC / f"{t}.mp3"
        if not mp3.exists():
            await edge_tts.Communicate(t + ".", VOICE, rate="-25%").save(str(mp3))


def read(path):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True, creationflags=NOW).stdout
    return np.frombuffer(raw, np.float32).copy()


HOP = int(0.005 * SR)
WIN = int(0.02 * SR)


def feats(a):
    """Per 5 ms frame: energy, periodicity (voicing), zero-crossing rate, spectral centroid."""
    out = []
    for s in range(0, len(a) - WIN, HOP):
        f = a[s:s + WIN]
        e = float(np.sqrt(np.mean(f ** 2)))
        f0 = f - f.mean()
        ac = np.correlate(f0, f0, "full")[WIN - 1:]
        per = float(ac[int(SR / 400):int(SR / 70)].max() / (ac[0] + 1e-9)) if ac[0] > 1e-9 else 0.0
        zcr = float(np.mean(np.abs(np.diff(np.sign(f)))) / 2)
        spec = np.abs(np.fft.rfft(f * np.hanning(len(f))))
        freqs = np.fft.rfftfreq(len(f), 1 / SR)
        cen = float((spec * freqs).sum() / (spec.sum() + 1e-9))
        out.append((e, per, zcr, cen))
    return np.array(out)


def onset_offset(F):
    e = F[:, 0]
    thr = 0.05 * e.max()
    idx = np.where(e > thr)[0]
    return idx[0], idx[-1]


def sustained(cond, start, n=3):
    for i in range(start, len(cond) - n):
        if all(cond[i:i + n]):
            return i
    return None


def cut(a, method):
    F = feats(a)
    on, off = onset_offset(F)
    e, per, zcr, cen = F[:, 0], F[:, 1], F[:, 2], F[:, 3]
    fr = lambda i: i * HOP
    if method == "fric":
        # Quiet hiss (f, th, v, z) is far softer than the vowel, so find the start with a low threshold.
        vowel = sustained((cen < 2200) & (per > 0.55) & (e > 0.25 * e.max()), max(0, on - 60)) or on
        lo = np.where(e[:vowel] > 0.006 * e.max())[0]
        start = lo[0] if len(lo) else max(0, vowel - 30)
        return a[fr(start): fr(vowel) - int(0.015 * SR)], "hold"
    if method == "vfric":
        # z, v buzz like a vowel but are much quieter: start low, cut before the loudness jump.
        lo = np.where(e > 0.006 * e.max())[0]
        start = lo[0]
        base = np.median(e[start + 2:start + 10])
        vowel = sustained(e > 3.0 * base, start + 8) or start + 30
        return a[fr(start): fr(vowel) - int(0.02 * SR)], "hold"
    if method == "nasal":
        # Nasals and l/r are voiced but quieter than the vowel: cut before the energy jump.
        base = np.median(e[on + 2:on + 10])
        vowel = sustained(e > 2.0 * base, on + 8) or on + 30
        return a[fr(on): fr(vowel) - int(0.02 * SR)], "hold"
    if method == "ng":
        # Vowel then nasal: take the quieter tail after the vowel's loud peak.
        pk = on + int(np.argmax(e[on:off]))
        start = sustained(e < 0.45 * e[pk], pk) or pk + 20
        return a[fr(start) + int(0.02 * SR): fr(off)], "hold"
    if method == "stop":
        # Burst (+ breath for p/t/k/h) up to just after the vowel's voicing begins.
        voice = sustained((per > 0.6) & (e > 0.3 * e.max()), on + 2) or on + 16
        seg = a[max(0, fr(on) - int(0.01 * SR)): fr(voice) + int(0.012 * SR)]
        return seg[: int(0.17 * SR)], "short"
    if method == "glide":
        n = {"w": 0.11, "y": 0.10, "qu": 0.17}
        return a[fr(on): fr(on) + int(0.14 * SR)], "short"
    if method == "tail":
        # x = /ks/ after the vowel: everything after voicing ends.
        last_v = max(i for i in range(on, off) if per[i] > 0.55 and e[i] > 0.2 * e.max())
        return a[fr(last_v) + int(0.015 * SR): fr(off) + int(0.03 * SR)], "short"
    if method == "vowel":
        # Vowel from the start of the word up to the following consonant (energy drop or hiss).
        pk = on + int(np.argmax(e[on:off]))
        end = sustained((e < 0.35 * e[pk]) | (cen > 3000), pk) or off
        return a[fr(on): fr(end)], "vowel"
    if method == "whole":
        return a[fr(on): fr(off) + int(0.03 * SR)], "whole"
    raise ValueError(method)


def sustain(seg, target_s, voiced, hiss=False):
    """Hold a sound smoothly ("nnnn", "ssss") with a spectral freeze: the steady
    middle's average spectrum is played continuously. Voiced sounds keep a steady
    pitch via phase-vocoder phase advance; hiss uses fresh random phase each frame.
    (Looping a short slice instead makes a fast yo-yo warble.)"""
    n_fft, hop = 1024, 256
    win = np.hanning(n_fft).astype(np.float32)
    n = len(seg)
    core = seg[int(n * 0.2): int(n * 0.85)]
    if len(core) < n_fft + 4 * hop:
        core = seg
    frames = [np.fft.rfft(core[i:i + n_fft] * win) for i in range(0, len(core) - n_fft, hop)]
    F = np.array(frames)
    mag = np.median(np.abs(F), axis=0)
    rng = np.random.default_rng(1)
    total = int(target_s * SR)
    if voiced:
        # Harmonic resynthesis: the voice's own pitch and tone colour, as one steady hum.
        c0 = core - core.mean()
        ac = np.correlate(c0, c0, "full")[len(c0) - 1:]
        lo, hi = int(SR / 400), int(SR / 70)
        f0 = SR / (lo + int(np.argmax(ac[lo:hi])))
        freqs = np.fft.rfftfreq(n_fft, 1 / SR)
        env = np.convolve(mag, np.ones(5) / 5, mode="same")
        t = np.arange(total) / SR
        out = np.zeros(total, np.float32)
        top = 2800 if hiss else 7500
        for k in range(1, int(top / f0)):
            amp = float(np.interp(k * f0, freqs, env))
            out += (amp * np.sin(2 * np.pi * k * f0 * t + rng.uniform(0, 2 * np.pi))).astype(np.float32)
        if hiss:
            # z and v: add their steady high-frequency friction on top of the hum.
            hmag = np.where(freqs >= 2800, mag, 0)
            nz = np.zeros(total + n_fft, np.float32); nrm = np.zeros_like(nz)
            for t0 in range(0, total, hop):
                fr = np.fft.irfft(hmag * np.exp(1j * rng.uniform(-np.pi, np.pi, hmag.shape)), n_fft).astype(np.float32) * win
                nz[t0:t0 + n_fft] += fr; nrm[t0:t0 + n_fft] += win ** 2
            nz = nz[:total] / np.maximum(nrm[:total], 1e-3)
            hum_e, nz_e = np.sqrt(np.mean(out ** 2)), np.sqrt(np.mean(nz ** 2)) + 1e-9
            out = out + nz * (hum_e / nz_e) * 0.7
    else:
        # Hiss: the same noise colour throughout, with fresh random phase each frame.
        out = np.zeros(total + n_fft, np.float32)
        norm = np.zeros_like(out)
        for t0 in range(0, total, hop):
            phase = rng.uniform(-np.pi, np.pi, mag.shape)
            fr = np.fft.irfft(mag * np.exp(1j * phase), n_fft).astype(np.float32) * win
            out[t0:t0 + n_fft] += fr
            norm[t0:t0 + n_fft] += win ** 2
        out = out[:total] / np.maximum(norm[:total], 1e-3)
    # Natural attack: start with the real onset, crossfade into the held sound.
    att = min(len(seg), int(0.06 * SR))
    xf = int(0.03 * SR)
    lead = seg[:att].copy()
    out = out * (np.sqrt(np.mean(lead ** 2)) / (np.sqrt(np.mean(out ** 2)) + 1e-9))
    ramp = np.linspace(0, 1, xf, dtype=np.float32)
    head = lead.copy()
    head[-xf:] = lead[-xf:] * (1 - ramp) + out[:xf] * ramp
    return np.concatenate([head, out[xf:total - att + xf]])


def finish(a, fade_out=0.04):
    a = a * (0.11 / (np.sqrt(np.mean(a ** 2)) + 1e-9))
    pk = np.max(np.abs(a))
    if pk > 0.95:
        a *= 0.95 / pk
    fi, fo = int(0.008 * SR), int(fade_out * SR)
    if len(a) > fi + fo:
        a[:fi] *= np.linspace(0, 1, fi)
        a[-fo:] *= np.linspace(1, 0, fo)
    return a.astype(np.float32)


def encode(wav, mp3):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-ac", "1", "-ar", str(SR),
                    "-c:a", "libmp3lame", "-b:a", "64k", str(mp3)], check=True, creationflags=NOW)


def recogniser():
    import torch
    from transformers import Wav2Vec2ForCTC, Wav2Vec2PhonemeCTCTokenizer, Wav2Vec2FeatureExtractor
    name = "facebook/wav2vec2-xlsr-53-espeak-cv-ft"
    tok = Wav2Vec2PhonemeCTCTokenizer.from_pretrained(name, do_phonemize=False)
    fe = Wav2Vec2FeatureExtractor.from_pretrained(name)
    m = Wav2Vec2ForCTC.from_pretrained(name).eval()

    def hear(a):
        idx = np.linspace(0, len(a) - 1, int(len(a) * 16000 / SR))
        x = np.interp(idx, np.arange(len(a)), a).astype(np.float32)
        x = np.concatenate([np.zeros(3200, np.float32), x, np.zeros(3200, np.float32)])
        with torch.no_grad():
            ids = m(fe(x, sampling_rate=16000, return_tensors="pt").input_values).logits.argmax(-1)[0]
        return tok.decode(ids).replace(" ", "")
    return hear


VOWELS = set("aeiouɐɑɒɔəɛɜɪʊʌæøœɨʉyɵɯɤ")

if __name__ == "__main__":
    asyncio.run(synth_all())
    hear = recogniser()
    report = {}
    for g, (text, method) in PLAN.items():
        a = read(SRC / f"{text}.mp3")
        seg, how = cut(a, method)
        if how == "hold":
            voiced = method in ("vfric", "nasal", "ng")
            seg = sustain(seg, 0.8, voiced, hiss=method == "vfric")
        # Short vowels keep their natural length (a quick, clean "a" as in ant).
        out = finish(seg, 0.025 if how == "short" else 0.06)
        sf.write(WAV / f"p_{g}.wav", out, SR)
        encode(WAV / f"p_{g}.wav", OUT / f"p_{g}.mp3")
        heard = hear(out)
        extra_vowel = how in ("hold", "short") and g not in ("w", "y", "qu") and any(ch in VOWELS for ch in heard)
        report[g] = {"from": text, "len": round(len(out) / SR, 2), "heard": heard, "vowel_added": extra_vowel}
        print(f"{g:4s} from {text:6s} {how:6s} {len(out)/SR:.2f}s  heard {heard:8s} {'<-- VOWEL?' if extra_vowel else ''}", flush=True)
    (ROOT / "work" / "pure_sounds.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
