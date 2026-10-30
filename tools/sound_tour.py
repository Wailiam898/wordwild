"""One MP3 to check pure sounds by ear: each sound twice, then its key word.
Writes work/sound_tour.mp3 and prints the order with timestamps.
--from G starts at grapheme G (e.g. --from y2 for the sounds added with worlds 5-7);
--extra id1,id2 appends other clips (e.g. words the speech check flagged)."""
import sys, json, subprocess
from pathlib import Path
import numpy as np
import soundfile as sf

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
SR = 24000
NOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)
order = json.loads(subprocess.run(["node", "-e", "import('./app/js/data.js').then(m=>console.log(JSON.stringify(Object.entries(m.GRAPHEMES).map(([g,x])=>[g,x.key]))))"],
                                  cwd=ROOT, capture_output=True, text=True, check=True).stdout)


def clip(path):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True, creationflags=NOW).stdout
    return np.frombuffer(raw, np.float32)


if "--from" in sys.argv:
    start = sys.argv[sys.argv.index("--from") + 1]
    order = order[[g for g, _ in order].index(start):]
extra = sys.argv[sys.argv.index("--extra") + 1].split(",") if "--extra" in sys.argv else []
gap = lambda s: np.zeros(int(s * SR), np.float32)
parts, t, lines = [gap(0.5)], 0.5, []
for g, key in order:
    s = clip(ROOT / "app" / "audio" / f"p_{g}.mp3")
    w = clip(ROOT / "app" / "audio" / f"w_{key}.mp3")
    lines.append(f"{int(t // 60)}:{int(t % 60):02d}  {g:4s} ({key})")
    for x in (s, gap(0.45), s, gap(0.45), w, gap(1.0)):
        parts.append(x)
        t += len(x) / SR
for iid in extra:
    lines.append(f"{int(t // 60)}:{int(t % 60):02d}  {iid}")
    for x in (clip(ROOT / "app" / "audio" / f"{iid}.mp3"), gap(1.0)):
        parts.append(x)
        t += len(x) / SR
out = np.concatenate(parts)
wav = ROOT / "work" / "sound_tour.wav"
sf.write(wav, out, SR)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-c:a", "libmp3lame", "-b:a", "96k",
                str(ROOT / "work" / "sound_tour.mp3")], check=True, creationflags=NOW)
print("\n".join(lines))
print(f"total {t:.0f}s -> work/sound_tour.mp3")
