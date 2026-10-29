"""Automated listening check.
- Words, sentences, lines: transcribe with Whisper and compare with the intended text.
- Isolated sounds (p_*): recognise phonemes with wav2vec2 and compare with the intended IPA.
Writes work/qa_report.json and prints failures.

Usage: .venv/Scripts/python.exe -I tools/qa_audio.py [words|sounds|all] [--only PREFIX]
"""
import sys, json, re
from pathlib import Path
import numpy as np
import soundfile as sf

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
WAV = ROOT / "work" / "wav"
mode = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "all"
only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
items = json.loads((ROOT / "work" / "manifest.json").read_text(encoding="utf-8"))
if only:
    items = [i for i in items if i["id"].startswith(only)]
report_path = ROOT / "work" / f"qa_{mode}.json"
report = json.loads(report_path.read_text(encoding="utf-8")) if report_path.exists() else {}

NUM = {"0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine", "10": "ten"}


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


if mode in ("words", "all"):
    from faster_whisper import WhisperModel
    model = WhisperModel("small.en", device="cpu", compute_type="int8")
    fails = 0
    for it in items:
        if it.get("phoneme") is not None:
            continue
        a, sr = sf.read(WAV / f"{it['id']}.wav", dtype="float32")
        a = np.concatenate([np.zeros(int(0.3 * sr), np.float32), a, np.zeros(int(0.3 * sr), np.float32)])
        if sr != 16000:
            idx = np.linspace(0, len(a) - 1, int(len(a) * 16000 / sr))
            a = np.interp(idx, np.arange(len(a)), a).astype(np.float32)
        segs, _ = model.transcribe(a, language="en", beam_size=5, vad_filter=False, without_timestamps=True)
        heard = " ".join(s.text for s in segs).strip()
        want, got = norm(it["text"]), norm(heard)
        if len(want) == 1:
            ok = any(lev(want[0], g) <= (0 if len(want[0]) <= 3 else 1) for g in got) or "".join(got) == want[0]
        else:
            dist = lev(" ".join(want), " ".join(got))
            ok = dist <= max(2, len(" ".join(want)) // 8)
        report[it["id"]] = {"want": it["text"], "heard": heard, "ok": bool(ok)}
        if not ok:
            fails += 1
            print(f"MISMATCH {it['id']}: want '{it['text']}' heard '{heard}'", flush=True)
    print(f"words/sentences checked, {fails} mismatches", flush=True)

if mode in ("sounds", "all"):
    import torch
    from transformers import Wav2Vec2ForCTC, Wav2Vec2PhonemeCTCTokenizer, Wav2Vec2FeatureExtractor
    name = "facebook/wav2vec2-xlsr-53-espeak-cv-ft"
    tok = Wav2Vec2PhonemeCTCTokenizer.from_pretrained(name, do_phonemize=False)
    fe = Wav2Vec2FeatureExtractor.from_pretrained(name)
    m = Wav2Vec2ForCTC.from_pretrained(name).eval()
    for it in items:
        if it.get("phoneme") is None or it.get("word"):
            continue
        a, sr = sf.read(WAV / f"{it['id']}.wav", dtype="float32")
        idx = np.linspace(0, len(a) - 1, int(len(a) * 16000 / sr))
        a = np.interp(idx, np.arange(len(a)), a).astype(np.float32)
        a = np.concatenate([np.zeros(4000, np.float32), a, np.zeros(4000, np.float32)])
        x = fe(a, sampling_rate=16000, return_tensors="pt").input_values
        with torch.no_grad():
            ids = m(x).logits.argmax(-1)[0]
        heard = tok.decode(ids).replace(" ", "")
        dur = len(a) / 16000 - 0.5
        report[it["id"]] = {"want": it["phoneme"], "heard": heard, "dur": round(dur, 2)}
        print(f"{it['id']:8s} want {it['phoneme']:4s} heard {heard:10s} {dur:.2f}s", flush=True)

report_path.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
