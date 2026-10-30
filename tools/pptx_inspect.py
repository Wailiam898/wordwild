"""Inspect an unpacked PPTX: slides in presentation order with their text,
speaker notes and audio/video relationships (from the .rels files, never filenames).
Usage: python -I tools/pptx_inspect.py <unpacked_dir> [out.json]"""
import sys, json, re, posixpath
from pathlib import Path
import xml.etree.ElementTree as ET

sys.stdout.reconfigure(encoding="utf-8")
src = Path(sys.argv[1])
NS = {"p": "http://schemas.openxmlformats.org/presentationml/2006/main",
      "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "rel": "http://schemas.openxmlformats.org/package/2006/relationships"}
R_ID = "{%s}id" % NS["r"]


def rels(part):
    p = src / posixpath.dirname(part) / "_rels" / (posixpath.basename(part) + ".rels")
    out = {}
    if p.exists():
        for r in ET.parse(p).getroot():
            tgt = r.get("Target")
            if r.get("TargetMode") != "External":
                tgt = posixpath.normpath(posixpath.join(posixpath.dirname(part), tgt))
            out[r.get("Id")] = (r.get("Type").rsplit("/", 1)[-1], tgt)
    return out


def paras(part):
    root = ET.parse(src / part).getroot()
    out = []
    for sp in root.iter("{%s}sp" % NS["p"]):
        ph = sp.find(".//p:nvPr/p:ph", NS)
        kind = ph.get("type") if ph is not None else None
        for para in sp.iter("{%s}p" % NS["a"]):
            t = "".join(x.text or "" for x in para.iter("{%s}t" % NS["a"])).strip()
            if t:
                out.append((kind, t))
    return root, out


pres_rels = rels("ppt/presentation.xml")
pres = ET.parse(src / "ppt/presentation.xml").getroot()
slides = []
for n, sid in enumerate(pres.find("p:sldIdLst", NS), 1):
    part = pres_rels[sid.get(R_ID)][1]
    rr = rels(part)
    root, text = paras(part)
    # Media referenced by shapes on the slide (audio/video frames), with the shape's name.
    media = []
    for pic in root.iter("{%s}pic" % NS["p"]):
        cnv = pic.find("p:nvPicPr/p:cNvPr", NS)
        for el in pic.iter():
            for attr in ("{%s}link" % NS["r"], "{%s}embed" % NS["r"]):
                rid = el.get(attr)
                if rid and rid in rr and rr[rid][0] in ("audio", "media", "video"):
                    media.append({"rel": rr[rid][0], "target": rr[rid][1], "shape": cnv.get("name"),
                                  "descr": cnv.get("descr")})
    notes = ""
    for typ, tgt in rr.values():
        if typ == "notesSlide":
            _, nt = paras(tgt)
            notes = "\n".join(t for k, t in nt if k not in ("sldNum", "sldImg"))
    other = sorted({f"{t}:{g}" for t, g in rr.values() if t not in ("slideLayout", "notesSlide", "audio", "media", "video")})
    slides.append({"n": n, "part": part, "text": [t for _, t in text], "notes": notes,
                   "media": media, "other_rels": other})

for s in slides:
    m = ", ".join(sorted({posixpath.basename(x["target"]) for x in s["media"]})) or "-"
    print(f"#{s['n']:>2} {s['part'].split('/')[-1]:13s} text={s['text'][:6]} media=[{m}]")
    if s["notes"]:
        print("     notes:", s["notes"].replace("\n", " | ")[:300])
    if s["other_rels"]:
        print("     rels:", s["other_rels"])
if len(sys.argv) > 2:
    Path(sys.argv[2]).write_text(json.dumps(slides, indent=1, ensure_ascii=False), encoding="utf-8")
