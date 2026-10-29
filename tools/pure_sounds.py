"""Pure phonics sounds cut from real spoken syllables.

TTS voices say isolated sounds badly (vowels blur together, stops get odd
vowels added). Instead we synthesise a short syllable the voice says well and
cut the target sound out using voicing/energy analysis:
  vowels      from  V + t   (at, it, out ...)  -> the voiced part before the t
  stops etc.  from  C + a   (pa, ta, cha ...)  -> burst up to just after voicing starts
  x           from  a + ks                     -> the voiceless tail
  continuants  held sounds (sss, mmm) generated directly, as before.
Writes app/audio/p_<grapheme>.mp3 (+ work/wav copies).

Usage: .venv/Scripts/python.exe -I tools/pure_sounds.py
"""
import sys, subprocess, json
from pathlib import Path
import numpy as np
import soundfile as sf
import kokoro_onnx

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
k = kokoro_onnx.Kokoro("C:/Users/WH/.cache/hyperframes/tts/models/kokoro-v1.0.onnx",
                       "C:/Users/WH/.cache/hyperframes/tts/voices/voices-v1.0.bin")
VOICE = "af_heart"
SR = 24000
OUT = ROOT / "app" / "audio"
WAV = ROOT / "work" / "wav"
DBG = ROOT / "work" / "pure"
DBG.mkdir(parents=True, exist_ok=True)

# grapheme -> (method, kokoro phonemes, extra)
VOWEL = lambda ipa: ("vowel", f"ˈ{ipa}t", None)
STOP = lambda ipa, after_ms=25: ("onset", f"{ipa}ˈa", after_ms)
HOLD = lambda ipa: ("hold", ipa + "ːːː", None)
PLAN = {
    "a": VOWEL("a"), "i": VOWEL("ɪ"), "o": VOWEL("ɒ"), "e": VOWEL("ɛ"), "u": VOWEL("ʌ"),
    "ai": VOWEL("eɪ"), "ee": VOWEL("iː"), "igh": VOWEL("aɪ"), "oa": VOWEL("əʊ"), "oo": VOWEL("uː"),
    "ar": VOWEL("ɑː"), "or": VOWEL("ɔː"), "ur": VOWEL("ɜː"), "ow": VOWEL("aʊ"), "oi": VOWEL("ɔɪ"),
    "t": STOP("t", 40), "p": STOP("p", 40), "k": STOP("k", 40), "c": STOP("k", 40), "ck": STOP("k", 40),
    "b": STOP("b", 60), "d": STOP("d", 60), "g": STOP("ɡ", 60),
    "ch": STOP("tʃ", 35), "j": STOP("dʒ", 60), "h": STOP("h", 45),
    "w": STOP("w", 110), "y": STOP("j", 90), "qu": STOP("kw", 100),
    "x": ("tail", "ˈaks", None),
    "s": HOLD("s"), "ss": HOLD("s"), "f": HOLD("f"), "ff": HOLD("f"), "sh": HOLD("ʃ"), "th": HOLD("θ"),
    "m": HOLD("m"), "n": HOLD("n"), "l": HOLD("l"), "ll": HOLD("l"), "r": HOLD("ɹ"),
    "v": HOLD("v"), "z": HOLD("z"), "zz": HOLD("z"), "ng": ("vowel_tail", "ˈaŋ", None),
}


def synth(ps, speed=0.8):
    a, sr = k.create(ps, voice=VOICE, speed=speed, lang="en-gb", is_phonemes=True, trim=False)
    return np.asarray(a, dtype=np.float32)


def frames(a, win=0.02, hop=0.005):
    w, hp = int(win * SR), int(hop * SR)
    out = []
    for s in range(0, len(a) - w, hp):
        f = a[s:s + w]
        e = float(np.sqrt(np.mean(f ** 2)))
        f0 = f - f.mean()
        ac = np.correlate(f0, f0, "full")[w - 1:]
        lo, hi = int(SR / 400), int(SR / 70)
        per = float(ac[lo:hi].max() / (ac[0] + 1e-9)) if ac[0] > 0 else 0.0
        zcr = float(np.mean(np.abs(np.diff(np.sign(f)))) / 2)
        out.append((s, e, per, zcr))
    return out, hp


def voiced(fr, emax):
    return [(e > 0.08 * emax and per > 0.5 and zcr < 0.25) for _, e, per, zcr in fr]


def first(seq, start=0):
    for i in range(start, len(seq)):
        if seq[i]:
            return i
    return None


def cut(method, a, extra):
    fr, hop = frames(a)
    emax = max(e for _, e, _, _ in fr)
    loud = [e > 0.04 * emax for _, e, _, _ in fr]
    v = voiced(fr, emax)
    on = first(loud)
    if method == "vowel":
        # Voiced stretch from onset until voicing stops (the t closure).
        s = first(v, on)
        e = s
        # Continue through short dips in voicing (up to 4 frames).
        while e < len(v) and any(v[e:e + 5]):
            e += 1
        return a[fr[s][0]: fr[e][0] + int(0.01 * SR)], "stretch"
    if method == "onset":
        s = on
        vs = first(v, s + 2) or s + 10
        end = fr[vs][0] + int(extra / 1000 * SR)
        return a[max(0, fr[s][0] - int(0.01 * SR)): end], None
    if method == "tail":
        # Last voiced frame of the vowel, then the voiceless tail to the end of sound.
        last_v = max(i for i, x in enumerate(v) if x)
        last_loud = max(i for i, x in enumerate(loud) if x)
        return a[fr[last_v][0] + int(0.02 * SR): fr[last_loud][0] + int(0.03 * SR)], None
    if method == "vowel_tail":
        # Nasal after the vowel: take the final third of the voiced stretch.
        idx = [i for i, x in enumerate(v) if x]
        s, e = idx[0], idx[-1]
        m = s + int((e - s) * 0.62)
        return a[fr[m][0]: fr[e][0] + int(0.02 * SR)], "stretch"
    raise ValueError(method)


def finish(a):
    rms = np.sqrt(np.mean(a ** 2)) + 1e-9
    a = a * (0.11 / rms)
    peak = np.max(np.abs(a))
    if peak > 0.95:
        a = a * 0.95 / peak
    f_in, f_out = int(0.006 * SR), int(0.03 * SR)
    if len(a) > f_in + f_out:
        a[:f_in] *= np.linspace(0, 1, f_in)
        a[-f_out:] *= np.linspace(1, 0, f_out)
    return a


def encode(src, dst, tempo=None):
    af = ["-af", f"atempo={tempo}"] if tempo else []
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), *af, "-ac", "1", "-ar", str(SR),
                    "-c:a", "libmp3lame", "-b:a", "64k", str(dst)], check=True,
                   creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))


summary = {}
for g, (method, ps, extra) in PLAN.items():
    if method == "hold":
        a = synth(ps, 0.9)
        idx = np.where(np.abs(a) > 0.012)[0]
        a = a[idx[0]: idx[-1]]
        tempo = None
    else:
        src = synth(ps)
        sf.write(DBG / f"src_{g}.wav", src, SR)
        a, how = cut(method, src, extra)
        tempo = None
        dur = len(a) / SR
        if how == "stretch" and dur < 0.32:
            tempo = max(0.6, dur / 0.36)
    a = finish(np.array(a, dtype=np.float32))
    wav = WAV / f"p_{g}.wav"
    sf.write(wav, a, SR)
    encode(wav, OUT / f"p_{g}.mp3", tempo)
    out_len = len(a) / SR / (tempo or 1)
    summary[g] = round(out_len, 2)
    print(f"{g:4s} {method:10s} {ps:8s} -> {out_len:.2f}s")
(ROOT / "work" / "pure_sounds.json").write_text(json.dumps(summary, indent=1))
