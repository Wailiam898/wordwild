"""Render work/manifest.json to app/audio/*.mp3 with the local Kokoro model.

Narrator: Natasha (Microsoft en-AU neural voice, via edge-tts): an Australian accent.
Pip: the same voice pitched up so it sounds like a small creature.

Every word and sentence is checked with Whisper. If a take isn't understood,
other candidate voices/speeds are tried and the first one that passes is kept;
anything that never passes is listed in work/audio_flags.json.
Pure phonics sounds (p_*) come from tools/pure_sounds.py instead.

Usage: .venv/Scripts/python.exe -I tools/gen_audio.py [--force] [--only PREFIX]
"""
import sys, json, hashlib, subprocess, re
from pathlib import Path
import numpy as np
import soundfile as sf
import asyncio
import edge_tts
from faster_whisper import WhisperModel

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "app" / "audio"
WAV = ROOT / "work" / "wav"
CACHE = ROOT / "work" / "audio_cache.json"
FLAGS = ROOT / "work" / "audio_flags.json"
VERSION = "au1"
SR = 24000
PIP_PITCH = 1.32

# (voice, rate, pitch) candidates, best first. Australian neural voices via edge-tts.
NAT, WIL = "en-AU-NatashaNeural", "en-AU-WilliamMultilingualNeural"
NARR_WORD = [(NAT, "-10%", "+0Hz"), (NAT, "-20%", "+0Hz"), (NAT, "+0%", "+0Hz"), (WIL, "-10%", "+0Hz")]
NARR_SENT = [(NAT, "-12%", "+0Hz"), (NAT, "-5%", "+0Hz"), (NAT, "-20%", "+0Hz")]
NARR_LINE = [(NAT, "+0%", "+0Hz")]
# Pip: only a small pitch lift. Bigger lifts made words unclear ("pot" heard as "put"),
# and the child has to judge whether Pip read the word right.
PIP_WORD = [(NAT, "-10%", "+15Hz"), (NAT, "-18%", "+15Hz"), (NAT, "-5%", "+10Hz")]
PIP_LINE = [(NAT, "+0%", "+20Hz")]
# Wider search used on a second pass for clips that failed (--retry-flags).
EXTRA = [(v, r, p) for v in (NAT, WIL) for r in ("-25%", "-15%", "+0%", "+10%") for p in ("+0Hz", "+20Hz")]
# Words that sound identical; hearing either spelling is a pass.
HOMOPHONES = {"fin": "finn", "mail": "male", "bee": "be", "high": "hi", "sort": "sought", "sam": "sam"}
RUDE = {"fuck", "fucking", "shit", "suck", "sucks", "dick", "cock", "piss", "bitch", "ass", "arse", "crap", "damn", "hell"}

args = sys.argv[1:]
force = "--force" in args
only = args[args.index("--only") + 1] if "--only" in args else None
retry = "--retry-flags" in args
# --plain id1,id2: render with the first (non-rhotic) candidate, skipping the Whisper check.
# For r-words like "car" whose correct Australian/British form an American-trained checker mishears.
plain = set(args[args.index("--plain") + 1].split(",")) if "--plain" in args else set()

wm = WhisperModel("small.en", device="cpu", compute_type="int8")
OUT.mkdir(parents=True, exist_ok=True)
WAV.mkdir(parents=True, exist_ok=True)
cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
flags = json.loads(FLAGS.read_text(encoding="utf-8")) if FLAGS.exists() else {}
NUM = {"10": "ten", "6": "six"}


def tts(text, cand):
    """Synthesise with edge-tts and decode to float32 mono at SR."""
    voice, rate, pitch = cand
    tmp = WAV / "_tmp.mp3"
    for attempt in range(4):
        try:
            asyncio.run(edge_tts.Communicate(text, voice, rate=rate, pitch=pitch).save(str(tmp)))
            break
        except Exception:
            if attempt == 3:
                raise
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(tmp), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0)).stdout
    return np.frombuffer(raw, np.float32).copy()


def norm(s):
    s = s.lower().replace("’", "'").replace("-", " ")
    s = re.sub(r"\b(\d+)\b", lambda m: NUM.get(m.group(1), m.group(1)), s)
    return re.sub(r"[^a-z ]", "", s).split()


def lev(a, b):
    d = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        prev, d[0] = d[0], i
        for j, cb in enumerate(b, 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (ca != cb))
    return d[-1]


def hear(a):
    idx = np.linspace(0, len(a) - 1, int(len(a) * 16000 / SR))
    x = np.interp(idx, np.arange(len(a)), a).astype(np.float32)
    x = np.concatenate([np.zeros(4800, np.float32), x, np.zeros(4800, np.float32)])
    segs, _ = wm.transcribe(x, language="en", beam_size=5, without_timestamps=True)
    return " ".join(s.text for s in segs).strip()


def understood(text, heard):
    want, got = norm(text), norm(heard)
    if any(g in RUDE for g in got) and not any(w in RUDE for w in want):
        return False
    if len(want) == 1:
        w = want[0]
        if HOMOPHONES.get(w) in got:
            return True
        return any(g == w or (len(w) >= 4 and lev(w, g) <= 1) for g in got) or "".join(got) == w
    # Sentences: every content word must be heard; allow small slips elsewhere.
    joined = " ".join(got)
    return lev(" ".join(want), joined) <= max(2, len(" ".join(want)) // 10) and all(
        any(g == w or (len(w) >= 5 and lev(w, g) <= 1) for g in got) for w in want if len(w) >= 3)


def trim(a, thresh=0.012, pad=0.03):
    idx = np.where(np.abs(a) > thresh)[0]
    if len(idx) == 0:
        return a
    return a[max(0, idx[0] - int(pad * SR)): min(len(a), idx[-1] + int(pad * 1.5 * SR))]


def finish(a):
    a = trim(a)
    a = a * (0.11 / (np.sqrt(np.mean(a ** 2)) + 1e-9))
    peak = np.max(np.abs(a))
    if peak > 0.95:
        a = a * (0.95 / peak)
    f = int(0.008 * SR)
    if len(a) > 2 * f:
        a[:f] *= np.linspace(0, 1, f)
        a[-f:] *= np.linspace(1, 0, f)
    return a


def encode(wav_path, mp3_path, pip):
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav_path)]
    cmd += ["-ac", "1", "-ar", str(SR), "-c:a", "libmp3lame", "-b:a", "56k", str(mp3_path)]
    subprocess.run(cmd, check=True, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))


def render(it):
    """Returns (audio, candidate, heard, ok)."""
    iid, pip = it["id"], it["voice"] == "pip"
    if it.get("phoneme") is not None:  # Pip's made-up mistake words: say the spelling
        a = tts(it["word_text"] + ".", PIP_WORD[0])
        return finish(a), PIP_WORD[0], "", True
    text = it["text"]
    if iid.startswith("w_"):
        cands = NARR_WORD
    elif iid.startswith("pw_"):
        cands = PIP_WORD
    elif iid.startswith(("s_", "q_", "st_")):
        cands = NARR_SENT
    else:
        cands = PIP_LINE if pip else NARR_LINE
    check = iid.startswith(("w_", "pw_", "s_", "q_", "st_")) and iid not in plain
    if iid in plain:
        cands = cands[:1]
    say = text + "." if iid.startswith(("w_", "pw_")) and not text.endswith((".", "!", "?")) else text
    if retry:
        cands = cands + [c for c in EXTRA if c not in cands]
    first = None
    for c in cands:
        a = finish(tts(say, c))
        if not check:
            return a, c, "", True
        heard = hear(a)
        if first is None:
            first = (a, c, heard)
        if understood(text, heard):
            return a, c, heard, True
    return first[0], first[1], first[2], False


items = json.loads((ROOT / "work" / "manifest.json").read_text(encoding="utf-8"))
done = skipped = failed = 0
for it in items:
    if (only and not it["id"].startswith(only)) or it["id"].startswith("p_"):
        continue
    if retry and it["id"] not in flags:
        continue
    if plain and it["id"] not in plain:
        continue
    sig = hashlib.sha1((VERSION + json.dumps(it, sort_keys=True, ensure_ascii=False)).encode()).hexdigest()
    mp3 = OUT / f"{it['id']}.mp3"
    if not force and not retry and not plain and cache.get(it["id"]) == sig and mp3.exists():
        skipped += 1
        continue
    a, cand, heard, ok = render(it)
    wav = WAV / f"{it['id']}.wav"
    sf.write(wav, a, SR)
    encode(wav, mp3, it["voice"] == "pip")
    cache[it["id"]] = sig
    if ok:
        flags.pop(it["id"], None)
    else:
        failed += 1
        flags[it["id"]] = {"text": it.get("text"), "heard": heard, "voice": list(cand)}
        print(f"FLAG {it['id']}: '{it.get('text')}' heard '{heard}'", flush=True)
    done += 1
    if done % 50 == 0:
        print(f"{done} rendered...", flush=True)
        CACHE.write_text(json.dumps(cache))
        FLAGS.write_text(json.dumps(flags, ensure_ascii=False, indent=1), encoding="utf-8")

CACHE.write_text(json.dumps(cache))
FLAGS.write_text(json.dumps(flags, ensure_ascii=False, indent=1), encoding="utf-8")
total = sum(f.stat().st_size for f in OUT.glob("*.mp3"))
print(f"rendered {done}, unchanged {skipped}, flagged {failed}, total {total / 1e6:.1f} MB")
