"""Make a listening page for the clips the automatic listening check flagged.

The checker (Whisper) often "mishears" short words (it hears "sat" as "Saturday"), so a person has to listen.
This writes work/audio_review.html: ONE self-contained page (the sound is inside the file) that opens by
double-clicking it. Each flagged clip that still exists gets a big play button, the word it should say, what the
checker heard, and "Sounds right" / "Sounds wrong" buttons. "Copy the wrong ones" gives plain text to paste back.
It only reads: it never renders, changes or deletes a clip.

Usage: .venv/Scripts/python.exe -I tools/make_audio_review.py [--flags work/audio_flags.json] [--out work/audio_review.html]
"""
import sys, json, base64, html
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
arg = lambda k, d: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
FLAGS = Path(arg("--flags", str(ROOT / "work" / "audio_flags.json")))
OUT = Path(arg("--out", str(ROOT / "work" / "audio_review.html")))
AUDIO = ROOT / "app" / "audio"
ORIGINAL = ROOT / "work" / "audio_flags_original_55.json"   # the first batch of 55, if kept

flags = json.loads(FLAGS.read_text(encoding="utf-8"))
first_batch = set(json.loads(ORIGINAL.read_text(encoding="utf-8"))) if ORIGINAL.exists() else set()

GROUPS = [
    ("w_", "Word clips (w_) - the narrator reading one word", "w"),
    ("pw_", "Pip's word clips (pw_) - Pip reading one word, in Pip's voice", "pw"),
    ("s_", "Story pages (s_)", "other"),
    ("", "Other clips (questions, sentences, lines)", "other"),
]
# Clips that the second listening check (tools/qa_audio.py words) did not like, if it has been run.
QA = ROOT / "work" / "qa_words.json"
qa_only = set()
if QA.exists():
    for cid, r in json.loads(QA.read_text(encoding="utf-8")).items():
        if not r.get("ok") and cid not in flags:
            flags[cid] = {"text": r.get("want"), "heard": r.get("heard"), "voice": []}
            qa_only.add(cid)
items, gone = [], []
for cid, f in flags.items():
    mp3 = AUDIO / f"{cid}.mp3"
    if not mp3.exists():
        gone.append(cid)
        continue
    items.append({
        "id": cid,
        "text": f.get("text") or cid,
        "heard": f.get("heard") or "",
        "src": "data:audio/mpeg;base64," + base64.b64encode(mp3.read_bytes()).decode("ascii"),
        "new": bool(first_batch) and cid not in first_batch,
        "qa": cid in qa_only,
    })


def group_of(cid):
    for prefix, title, _ in GROUPS:
        if prefix and cid.startswith(prefix):
            return title
    return GROUPS[-1][1]


by_group = {}
for it in items:
    by_group.setdefault(group_of(it["id"]), []).append(it)
for lst in by_group.values():
    lst.sort(key=lambda x: x["id"])

sections = []
for _, title, _ in GROUPS:
    lst = by_group.get(title)
    if not lst:
        continue
    cards = []
    for it in lst:
        long = len(it["text"]) > 20
        cards.append(f"""<article class="card" data-id="{html.escape(it['id'])}" data-text="{html.escape(it['text'])}">
  <button class="play" aria-label="Play {html.escape(it['text'])}">&#9654;</button>
  <audio preload="auto" src="{it['src']}"></audio>
  <div class="say{' long' if long else ''}">{html.escape(it['text'])}</div>
  <div class="meta"><code>{html.escape(it['id'])}</code>{' <span class="new">' + ('only the second check (qa_audio) doubted this one' if it['qa'] else 'added in the latest batch') + '</span>' if it['new'] else ''}</div>
  <div class="heard">The checker heard: <q>{html.escape(it['heard'])}</q></div>
  <div class="votes">
    <button class="vote right" data-v="right">Sounds right</button>
    <button class="vote wrong" data-v="wrong">Sounds wrong</button>
  </div>
</article>""")
    sections.append(f'<section><h2>{html.escape(title)} <small>({len(lst)})</small></h2><div class="grid">{"".join(cards)}</div></section>')

page = f"""<!DOCTYPE html>
<html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wordwild - listen to the flagged clips</title>
<style>
  :root {{ --ink: #2b2250; --purple: #6b4be0; --green: #1fa45b; --red: #d9344f; --bg: #f5f6fb; }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; font: 18px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--ink); background: var(--bg); }}
  header {{ position: sticky; top: 0; z-index: 5; background: #fff; box-shadow: 0 2px 10px rgba(30,30,80,.12); padding: 12px 16px; }}
  h1 {{ margin: 0 0 4px; font-size: 22px; }}
  header p {{ margin: 2px 0 8px; color: #555; font-size: 16px; }}
  .bar {{ display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }}
  .count {{ font-weight: 700; }}
  button {{ font: inherit; cursor: pointer; border: 0; border-radius: 14px; }}
  .copy {{ background: var(--purple); color: #fff; font-weight: 700; padding: 12px 20px; }}
  .clear {{ background: #eae6ff; color: var(--purple); padding: 12px 16px; }}
  main {{ max-width: 1000px; margin: 0 auto; padding: 8px 16px 60px; }}
  h2 {{ margin: 28px 0 10px; font-size: 20px; }} h2 small {{ color: #777; font-weight: 400; }}
  .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; }}
  .card {{ background: #fff; border-radius: 20px; padding: 14px; box-shadow: 0 2px 10px rgba(30,30,80,.1); display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; border: 4px solid transparent; }}
  .card.right {{ border-color: var(--green); }} .card.wrong {{ border-color: var(--red); background: #fff4f6; }}
  .play {{ width: 96px; height: 96px; border-radius: 50%; background: linear-gradient(#8f7bff, var(--purple)); color: #fff; font-size: 42px; box-shadow: 0 6px 0 #4a30b8; padding-left: 8px; }}
  .play:active {{ transform: translateY(4px); box-shadow: 0 2px 0 #4a30b8; }}
  .play.on {{ background: linear-gradient(#ffd23f, #ff9f1c); box-shadow: 0 6px 0 #c47d00; color: #5a3a00; }}
  .say {{ font-size: 40px; font-weight: 800; line-height: 1.1; margin-top: 4px; }} .say.long {{ font-size: 21px; line-height: 1.3; }}
  .meta {{ font-size: 13px; color: #777; }} .meta code {{ background: #f0eeff; border-radius: 6px; padding: 1px 6px; }}
  .new {{ background: #fff1a0; border-radius: 6px; padding: 1px 6px; color: #6a5200; }}
  .heard {{ font-size: 15px; color: #555; }} .heard q {{ color: var(--red); font-weight: 600; }}
  .votes {{ display: flex; gap: 8px; width: 100%; margin-top: 6px; }}
  .vote {{ flex: 1; padding: 12px 6px; font-weight: 700; background: #eee; color: #444; }}
  .card.right .vote.right {{ background: var(--green); color: #fff; }}
  .card.wrong .vote.wrong {{ background: var(--red); color: #fff; }}
  #out {{ display: none; margin: 12px 0 0; width: 100%; min-height: 120px; font: 15px/1.4 ui-monospace, Consolas, monospace; padding: 10px; border-radius: 12px; border: 2px solid var(--purple); }}
  #msg {{ color: var(--green); font-weight: 700; }}
</style></head>
<body>
<header>
  <h1>Listen to the flagged clips</h1>
  <p>Press the big button, listen, then tap <b>Sounds right</b> or <b>Sounds wrong</b>. The checker often mishears short words, so most will sound fine. Your answers are remembered on this computer.</p>
  <div class="bar">
    <span class="count" id="count"></span>
    <button class="copy" id="copy">Copy the list of wrong ones</button>
    <button class="clear" id="clear">Start again</button>
    <span id="msg"></span>
  </div>
  <textarea id="out" readonly aria-label="List of wrong clips"></textarea>
</header>
<main>
{''.join(sections) if sections else '<p>No flagged clips with a sound file were found.</p>'}
</main>
<script>
(() => {{
  const KEY = 'wordwild.audio_review.v1';
  const cards = [...document.querySelectorAll('.card')];
  let votes = {{}};
  try {{ votes = JSON.parse(localStorage.getItem(KEY) || '{{}}'); }} catch (e) {{}}
  const save = () => {{ try {{ localStorage.setItem(KEY, JSON.stringify(votes)); }} catch (e) {{}} }};
  const count = document.getElementById('count'), msg = document.getElementById('msg'), out = document.getElementById('out');
  let playing = null;
  function paint() {{
    let r = 0, w = 0;
    cards.forEach(c => {{
      const v = votes[c.dataset.id];
      c.classList.toggle('right', v === 'right'); c.classList.toggle('wrong', v === 'wrong');
      if (v === 'right') r++; if (v === 'wrong') w++;
    }});
    count.textContent = `${{cards.length}} clips: ${{r}} right, ${{w}} wrong, ${{cards.length - r - w}} still to listen to`;
  }}
  function stopAll() {{ document.querySelectorAll('audio').forEach(a => {{ a.pause(); a.currentTime = 0; }}); document.querySelectorAll('.play.on').forEach(b => b.classList.remove('on')); }}
  cards.forEach(c => {{
    const a = c.querySelector('audio'), b = c.querySelector('.play');
    b.addEventListener('click', () => {{ stopAll(); b.classList.add('on'); a.currentTime = 0; a.play().catch(() => {{}}); }});
    a.addEventListener('ended', () => b.classList.remove('on'));
    c.querySelectorAll('.vote').forEach(v => v.addEventListener('click', () => {{ votes[c.dataset.id] = v.dataset.v; save(); paint(); }}));
  }});
  function wrongList() {{
    const lines = cards.filter(c => votes[c.dataset.id] === 'wrong').map(c => `${{c.dataset.id}} (${{c.dataset.text}})`);
    return lines.length ? 'Clips that sound wrong:\\n' + lines.join('\\n') : 'No clips sound wrong.';
  }}
  document.getElementById('copy').addEventListener('click', async () => {{
    const text = wrongList();
    out.value = text; out.style.display = 'block'; out.focus(); out.select();
    let ok = false;
    try {{ await navigator.clipboard.writeText(text); ok = true; }} catch (e) {{}}
    if (!ok) {{ try {{ ok = document.execCommand('copy'); }} catch (e) {{}} }}
    msg.textContent = ok ? 'Copied. Paste it into your message.' : 'Select the text below and copy it (Ctrl+C).';
  }});
  document.getElementById('clear').addEventListener('click', () => {{ votes = {{}}; save(); paint(); out.style.display = 'none'; msg.textContent = ''; }});
  paint();
}})();
</script>
</body></html>
"""
OUT.write_text(page, encoding="utf-8")
print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB): {len(items)} clips to listen to"
      + (f"; {len(gone)} flagged clips no longer exist and were left out: {', '.join(gone)}" if gone else ""))
print("  groups: " + "; ".join(f"{k.split(' - ')[0]} {len(v)}" for k, v in by_group.items()))
