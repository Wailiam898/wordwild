"""Install the pure phonics sounds from Literacy Hub's "Phonemes and graphemes daily review"
slide pack (CC BY 4.0) as app/audio/p_<grapheme>.mp3, and write the provenance manifest.

Each sound is located by slide number and by the audio icon's position on the slide
(top to bottom), following that slide's speaker notes. The media file is then read
from the slide's .rels file, never guessed from the media filename. The expected media
name is only used as a cross-check: the script stops if a slide's layout ever changes.

Processing (identical for every clip, recorded in the manifest):
  - decoded from AAC/M4A; the two stereo channels are identical, so channel 1 is kept (mono)
  - leading/trailing silence trimmed (and faint stray breaths/clicks well apart from the sound),
    keeping 40 ms before the sound starts (so stop-consonant bursts keep their attack)
    and 120 ms after it ends
  - 5 ms fade-in over the leading pad and 30 ms fade-out over the trailing pad (pads only)
  - one fixed gain per clip (no compression or limiting) to match the game's speech level,
    capped so the peak stays at or below -1 dBFS
  - encoded as MP3 (mono, 44.1 kHz, 96 kbps CBR)

Usage: python -I tools/import_literacyhub.py <unpacked_pptx_dir>
"""
import sys, json, subprocess, hashlib, posixpath
from pathlib import Path
import xml.etree.ElementTree as ET
import numpy as np

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1])
SR = 44100
NOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)
TARGET_RMS_DB = -14.0   # loudest 50 ms of the game's own word clips (median of 40, measured)
PEAK_CAP_DB = -1.0
PRE_S, POST_S, FADE_IN_S, FADE_OUT_S, MERGE_S = 0.040, 0.120, 0.005, 0.030, 0.150

# grapheme: (slide, icon index top-to-bottom, expected media, sound per the slide notes, review note)
MAP = {
    "s":   (4, 0, "media1.m4a", "/s/ (as in snake)", ""),
    "a":   (5, 0, "media3.m4a", "/a/ (as in apple)", ""),
    "t":   (6, 0, "media5.m4a", "/t/ (as in tap)", ""),
    "p":   (7, 0, "media6.m4a", "/p/ (as in pan)", ""),
    "i":   (8, 0, "media8.m4a", "/i/ (as in ink)", ""),
    "n":   (9, 0, "media9.m4a", "/n/ (as in nap)", ""),
    "m":   (10, 0, "media10.m4a", "/m/ (as in mat)", ""),
    "e":   (11, 0, "media11.m4a", "/e/ (as in egg)", ""),
    "h":   (12, 0, "media13.m4a", "/h/ (as in hat)", ""),
    "r":   (13, 0, "media14.m4a", "/r/ (as in rat)", ""),
    "d":   (14, 0, "media15.m4a", "/d/ (as in dog)", ""),
    "o":   (15, 0, "media17.m4a", "/o/ (as in octopus)", ""),
    "f":   (16, 0, "media19.m4a", "/f/ (as in fun)", ""),
    "c":   (17, 0, "media20.m4a", "/k/ (as in cat)", ""),
    "b":   (18, 0, "media21.m4a", "/b/ (as in bag)", ""),
    "g":   (19, 0, "media22.m4a", "/g/ (as in goat)", ""),
    "l":   (20, 0, "media24.m4a", "/l/ (as in leg)", ""),
    "u":   (21, 0, "media25.m4a", "/u/ (as in up)", ""),
    "k":   (22, 0, "media20.m4a", "/k/ (as in king)", ""),
    "ck":  (23, 0, "media20.m4a", "/k/ (as in back)", ""),
    "v":   (24, 0, "media27.m4a", "/v/ (as in van)", ""),
    "y":   (25, 0, "media28.m4a", "/y/ (as in yap), consonant y", ""),
    "z":   (26, 0, "media2.m4a", "/z/ (as in zap)", ""),
    "w":   (27, 0, "media29.m4a", "/w/ (as in went)", ""),
    "j":   (28, 0, "media30.m4a", "/j/ (as in jet)", ""),
    "qu":  (29, 0, "media31.m4a", "/kw/ (as in queen)", ""),
    "x":   (30, 0, "media32.m4a", "/ks/ (as in box)", ""),
    "ff":  (31, 0, "media19.m4a", "/f/ (as in fluff)", ""),
    "ll":  (32, 0, "media24.m4a", "/l/ (as in well)", ""),
    "ss":  (33, 0, "media1.m4a", "/s/ (as in fuss)", ""),
    "zz":  (34, 0, "media2.m4a", "/z/ (as in buzz)", ""),
    "sh":  (35, 0, "media33.m4a", "/sh/ (as in shop)", ""),
    "th":  (36, 0, "media35.m4a", "unvoiced th (as in thin, thick, think)",
            "Slide 36 has two th icons, both labelled phase 8; the notes list unvoiced first. "
            "Top icon chosen; acoustics agree (no voicing, high zero-crossing rate). The game's "
            "th is /θ/ as in thumb. Please confirm by ear."),
    "ch":  (37, 0, "media36.m4a", "/ch/ (as in champ)", ""),
    "ng":  (39, 0, "media38.m4a", "/ng/ (as in sing)", ""),
    "ai":  (45, 0, "media43.m4a", "/ā/ (as in rain)", ""),
    "ee":  (47, 0, "media45.m4a", "/ē/ (as in sheep)", ""),
    "oa":  (48, 0, "media46.m4a", "/ō/ (as in boat)", ""),
    "ow":  (49, 1, "media48.m4a", "/ow/ (as in now)",
            "Slide 49 icon 1 (phase 11) is /ō/ as in show; icon 2 (phase 14) is /ow/ as in now. "
            "The game's ow is the cow sound, so icon 2 is used; its spectrum matches the separate "
            "ou /ow/ clip (slide 58)."),
    "igh": (50, 0, "media49.m4a", "/ī/ (as in high)", ""),
    "oo":  (55, 0, "media54.m4a", "/oo/ (as in food, mood, spoon, moon)",
            "Slide 55 has two oo icons, both phase 13; the notes list food/moon first and "
            "hood/book second. Top icon chosen: it is the longer, darker vowel. (The slide's "
            "macron labels /oo/ vs /ōō/ conflict with slide 44.) Please confirm it is the moon sound."),
    "oi":  (56, 0, "media56.m4a", "/oy/ (as in soil)", ""),
    "or":  (59, 0, "media59.m4a", "/or/ (as in for)", ""),
    "ar":  (60, 0, "media60.m4a", "/ar/ (as in farm)", ""),
    "ur":  (63, 0, "media63.m4a", "/er/ (as in turn)", ""),
    # World 5-7 sounds. y2/y3 are the game's names for final y saying /ē/ and /ī/.
    "y2":  (51, 1, "media50.m4a", "/ē/ (final y, as in a longer word)",
            "Slide 51 has two y icons; the notes list /ī/ first and /ē/ second. Bottom icon chosen; "
            "its spectrum matches the ee clip (slide 47), the top one matches igh (slide 50)."),
    "y3":  (51, 0, "media51.m4a", "/ī/ (final y, as in try, by, my, why)", ""),
    "ay":  (46, 0, "media44.m4a", "/ā/ (as in day)", ""),
    "ou":  (58, 0, "media58.m4a", "/ow/ (as in out)", ""),
    "ea":  (52, 0, "media53.m4a", "/ē/ (as in eat, meal, team)",
            "Slide 52 has two ea icons; the notes give /ē/ first and /e/ (head) second. Top icon chosen; "
            "its spectrum matches the ee clip, the bottom one matches e (slide 11)."),
    "ie":  (68, 1, "media67.m4a", "/ī/ (as in pie, tie, lie)",
            "Slide 68 has two ie icons; the notes give /ē/ (believe) first and /ī/ (pie) second. The game's "
            "ie is the pie sound, so the bottom icon is used; its spectrum matches igh, the top one matches ee."),
    "oy":  (57, 0, "media57.m4a", "/oy/ (as in toy)", ""),
    "ir":  (62, 0, "media62.m4a", "/er/ (as in first)", ""),
    "er":  (61, 0, "media61.m4a", "/er/ (as in term)", ""),
    "aw":  (73, 0, "media72.m4a", "/or/ (as in saw)", ""),
    "ew":  (53, 0, "media42.m4a", "/ū/ (as in few, new, stew)",
            "This recording (shared by slides 44, 53 and 54) says three sounds in a row. Only the first is kept: "
            "it starts with a y-glide and ends like the moon oo, i.e. /ū/ (yoo). The game uses it for ew words "
            "that say yoo in Australian English (new, few, stew). Please confirm by ear."),
    "a_e": (40, 0, "media39.m4a", "/ā/ (split digraph a-e, as in take)", ""),
    "i_e": (42, 0, "media40.m4a", "/ī/ (split digraph i-e, as in time)", ""),
    "o_e": (43, 0, "media41.m4a", "/ō/ (split digraph o-e, as in home)", ""),
    "u_e": (44, 0, "media42.m4a", "/ū/ (split digraph u-e, as in cute, tube, use)",
            "Same three-sound recording as ew; only the first sound, /ū/ (yoo), is kept. Please confirm by ear."),
    "wh":  (38, 0, "media37.m4a", "/w/ (as in whale)", ""),
    "ph":  (66, 0, "media64.m4a", "/f/ (as in phone)", ""),
}
# Recordings that hold several sounds in a row: keep only this one (0 = first). Others keep the loudest.
UTTERANCE = {"media42.m4a": 0}

NS = {"p": "http://schemas.openxmlformats.org/presentationml/2006/main",
      "a": "http://schemas.openxmlformats.org/drawingml/2006/main"}
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"


def slide_parts():
    pres = ET.parse(SRC / "ppt/presentation.xml").getroot()
    rels = {r.get("Id"): r.get("Target") for r in ET.parse(SRC / "ppt/_rels/presentation.xml.rels").getroot()}
    return [posixpath.join("ppt", rels[s.get(R + "id")]) for s in pres.find("p:sldIdLst", NS)]


def audio_icons(part):
    """Audio icons on a slide, top to bottom, as (y, media path, slide notes)."""
    rel_path = SRC / posixpath.dirname(part) / "_rels" / (posixpath.basename(part) + ".rels")
    rels = {r.get("Id"): (r.get("Type").rsplit("/", 1)[-1], posixpath.normpath(posixpath.join(posixpath.dirname(part), r.get("Target"))))
            for r in ET.parse(rel_path).getroot()}
    root = ET.parse(SRC / part).getroot()
    out = []

    def walk(node, tx):   # tx maps child coords to slide coords for grouped shapes
        for el in node:
            tag = el.tag.split("}")[1]
            if tag == "grpSp":
                x = el.find("p:grpSpPr/a:xfrm", NS)
                off, ext, coff, cext = (x.find("a:" + k, NS) for k in ("off", "ext", "chOff", "chExt"))
                sy = int(ext.get("cy")) / max(int(cext.get("cy")), 1)
                walk(el, lambda y, o=int(off.get("y")), c=int(coff.get("y")), s=sy, t=tx: t(o + (y - c) * s))
            elif tag == "pic":
                media = {rels[v][1] for e in el.iter() for k, v in e.attrib.items()
                         if k in (R + "link", R + "embed") and v in rels and rels[v][0] in ("audio", "media")}
                if media:
                    y = int(el.find(".//a:xfrm/a:off", NS).get("y"))
                    out.append((tx(y), media.pop()))
    walk(root.find(".//p:spTree", NS), lambda y: y)
    notes = ""
    for typ, tgt in rels.values():
        if typ == "notesSlide":
            notes = " | ".join("".join(t.text or "" for t in p.iter("{%s}t" % NS["a"])).strip()
                               for p in ET.parse(SRC / tgt).getroot().iter("{%s}p" % NS["a"]))
    return sorted(out), notes


def decode(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ar", str(SR), "-"],
                         capture_output=True, check=True, creationflags=NOW).stdout
    st = np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)
    return st[:, 0], float(np.abs(st[:, 0] - st[:, 1]).max())


def process(x, utterance=None):
    w = int(0.010 * SR)
    env = np.sqrt(np.convolve(x * x, np.ones(w) / w, "same"))
    thr = max(env.max() * 10 ** (-40 / 20), 1e-5)            # 40 dB below the clip's peak envelope
    on = np.flatnonzero(env > thr)
    # Group into regions, bridging gaps under 150 ms (keeps qu's k-closure-w together),
    # and keep the region holding the loudest point: drops stray breaths/clicks.
    breaks = np.flatnonzero(np.diff(on) > int(MERGE_S * SR))
    starts, ends = np.r_[on[0], on[breaks + 1]], np.r_[on[breaks], on[-1]]
    k = np.flatnonzero((starts <= env.argmax()) & (env.argmax() <= ends))[0] if utterance is None else utterance
    a, b = starts[k], ends[k]
    s0, s1 = max(0, a - int(PRE_S * SR)), min(len(x), b + int(POST_S * SR))
    y = x[s0:s1].copy()
    fi, fo = int(FADE_IN_S * SR), int(FADE_OUT_S * SR)
    y[:fi] *= np.linspace(0, 1, fi)
    y[-fo:] *= np.linspace(1, 0, fo)
    c = np.convolve(y * y, np.ones(2205) / 2205, "valid")
    rms_db = 10 * np.log10(c.max() + 1e-12)
    peak_db = 20 * np.log10(np.abs(y).max() + 1e-12)
    gain = min(TARGET_RMS_DB - rms_db, PEAK_CAP_DB - peak_db)
    return y * 10 ** (gain / 20), dict(trim_start_s=round(s0 / SR, 3), trim_end_s=round(s1 / SR, 3),
                                         source_s=round(len(x) / SR, 3),
                                         sounds_in_recording=int(len(starts)),
                                         kept=("sound %d of %d" % (k + 1, len(starts))) if utterance is not None else "the one sound (stray breaths/clicks dropped)", output_s=round(len(y) / SR, 3),
                                         gain_db=round(gain, 1), peak_capped=bool(gain < TARGET_RMS_DB - rms_db - 0.05))


def encode(y, out):
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "f64le", "-ar", str(SR), "-ac", "1", "-i", "-",
                    "-c:a", "libmp3lame", "-b:a", "96k", "-map_metadata", "-1", str(out)],
                   input=y.astype("<f8").tobytes(), check=True, creationflags=NOW)


parts = slide_parts()
done, entries = {}, []
for g, (slide, idx, expect, sound, review) in MAP.items():
    icons, notes = audio_icons(parts[slide - 1])
    media = icons[idx][1]
    if posixpath.basename(media) != expect:
        sys.exit(f"{g}: slide {slide} icon {idx} is {media}, expected {expect}. Slide layout changed: re-check the mapping.")
    if media not in done:
        x, chdiff = decode(SRC / media)
        if chdiff > 1e-4:
            sys.exit(f"{media}: stereo channels differ ({chdiff}); mono fold-down would change the audio")
        done[media] = process(x, UTTERANCE.get(posixpath.basename(media)))
    y, info = done[media]
    out = ROOT / "app" / "audio" / f"p_{g}.mp3"
    encode(y, out)
    entries.append({
        "grapheme": g, "intended_sound": sound, "output_file": f"app/audio/p_{g}.mp3",
        "output_sha256": hashlib.sha256(out.read_bytes()).hexdigest(),
        "source_media": media, "source_sha256": hashlib.sha256((SRC / media).read_bytes()).hexdigest(),
        "source_slide": slide, "source_slide_title": g if slide != 51 else "", "icon_on_slide": f"{idx + 1} of {len(icons)} (top to bottom)",
        "slide_notes": notes, **info, "needs_review": bool(review), "review_note": review,
    })
    print(f"p_{g:4s} <- slide {slide:2d} icon {idx + 1}/{len(icons)} {posixpath.basename(media):12s} "
          f"{info['source_s']:.2f}s -> {info['output_s']:.2f}s gain {info['gain_db']:+.1f} dB{' (peak cap)' if info['peak_capped'] else ''}"
          f"{'  REVIEW' if review else ''}")

for e in entries:
    e.pop("source_slide_title")
manifest = {
    "source": {"title": "Phonemes and graphemes daily review", "publisher": "Literacy Hub",
               "copyright": "© Commonwealth of Australia (resource page); the slide master footer reads "
                            "\"© 2021 Education Services Australia Limited\" (see THIRD_PARTY_NOTICES.md)",
               "url": "https://www.literacyhub.edu.au/search/phonemes-and-graphemes-daily-review",
               "licence": "CC BY 4.0", "licence_url": "https://creativecommons.org/licenses/by/4.0/",
               "file": "phonemes-and-graphemes-daily-review.pptx (Version 3, Oct 2026)"},
    "processing": {
        "decode": "AAC (M4A, 44.1 kHz stereo) decoded; channels are identical (verified per clip), channel 1 kept as mono",
        "trim": f"leading/trailing silence removed, including faint isolated breaths/clicks more than {int(MERGE_S * 1000)} ms "
                f"from the sound (detection at -40 dB from the clip's peak); {int(PRE_S * 1000)} ms kept before onset, "
                f"{int(POST_S * 1000)} ms after offset. One recording (media42.m4a) says three sounds in a row; "
                f"only its first sound is kept (see 'kept' on the u_e and ew clips)",
        "fades": f"{int(FADE_IN_S * 1000)} ms fade-in and {int(FADE_OUT_S * 1000)} ms fade-out, applied to the silent pads only",
        "volume": f"single fixed gain per clip towards {TARGET_RMS_DB:.0f} dBFS loudest-50 ms RMS, peak capped at {PEAK_CAP_DB:.0f} dBFS; no compression or limiting",
        "encode": "MP3, mono, 44.1 kHz, 96 kbps CBR, source metadata not copied",
        "tool": "tools/import_literacyhub.py"},
    "clips": entries,
}
dest = ROOT / "app" / "licences"
dest.mkdir(exist_ok=True)
(dest / "literacyhub-audio-manifest.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False), encoding="utf-8")
print(f"{len(entries)} sounds from {len(done)} recordings; manifest -> app/licences/literacyhub-audio-manifest.json")
