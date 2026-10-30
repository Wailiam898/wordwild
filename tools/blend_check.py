"""Functional check of the pure sounds: blend them like a child would (n+a+p)
and see whether Whisper hears the word. Extra vowels on a sound break the blend."""
import sys; sys.stdout.reconfigure(encoding="utf-8")
import numpy as np, soundfile as sf
from pathlib import Path
from faster_whisper import WhisperModel
ROOT = Path(__file__).resolve().parent.parent
SR = 24000
HOLD = set("s ss f ff sh th z zz v m n l ll r ng".split())
VOW = set("a e i o u".split())
wm = WhisperModel("small.en", device="cpu", compute_type="int8")
def snd(g):
    a, _ = sf.read(ROOT / "work" / "wav" / f"p_{g}.wav", dtype="float32")
    if g in HOLD: a = a[: int(0.16 * SR)]
    elif g in VOW: a = a[: int(0.16 * SR)]
    f = int(0.012 * SR); a = a.copy(); a[:f] *= np.linspace(0, 1, f); a[-f:] *= np.linspace(1, 0, f)
    return a
def blend(seg):
    parts = []
    for g in seg:
        parts.append(snd(g))
    x = np.concatenate(parts)
    idx = np.linspace(0, len(x) - 1, int(len(x) * 16000 / SR))
    x = np.interp(idx, np.arange(len(x)), x).astype(np.float32)
    x = np.concatenate([np.zeros(6400, np.float32), x, np.zeros(6400, np.float32)])
    s, _ = wm.transcribe(x, language="en", beam_size=5, without_timestamps=True, initial_prompt="Words:")
    return " ".join(t.text for t in s).strip().lower().strip(".!? ")
WORDS = [["s","a","t"],["p","i","n"],["n","a","p"],["m","a","p"],["t","a","p"],["d","o","g"],["c","a","t"],["s","u","n"],
         ["b","e","d"],["h","a","t"],["f","a","n"],["l","e","g"],["r","a","t"],["sh","i","p"],["ch","i","p"],["j","a","m"],
         ["v","a","n"],["w","e","t"],["y","e","s"],["z","i","p"],["b","u","s"],["g","o","t"],["th","i","n"],["k","i","d"],
         ["f","i","sh"],["r","i","ng"],["b","o","x"],["qu","i","ck"]]
ok = 0
for w in WORDS:
    heard = blend(w); want = "".join(w).replace("ck","ck")
    want = {"quick":"quick"}.get(want, want)
    hit = want in heard.replace(" ", "")
    ok += hit
    print(f"{'+'.join(w):10s} -> {heard:14s} {'OK' if hit else ''}")
print(f"{ok}/{len(WORDS)} blends heard as the word")
