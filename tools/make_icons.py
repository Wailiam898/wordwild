"""Render the app icon (Pip on a sky gradient) to PNGs with Playwright."""
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
art = (ROOT / "app" / "js" / "art.js").read_text(encoding="utf-8")
# Pull the pipSVG template and fill it for the icon.
tpl = re.search(r"return `(<svg class=\"pip-svg\".*?</svg>)`;", art, re.S).group(1)
mouth = '<path d="M82 124 Q100 150 118 124 Z" fill="#2a1d5c"/><path d="M90 136 Q100 146 110 136 Z" fill="#ff7a9c"/>'
eyes = re.search(r": `(<g class=\"pip-eyes\">.*?</g>)`;", art, re.S).group(1)
svg = (tpl.replace("${id}", "i").replace("${eyes}", eyes).replace("${mouths[mood] || mouths.happy}", mouth)
       .replace("${hatSvg}", ""))
html = f"""<html><body style="margin:0">
<div id="ic" style="width:512px;height:512px;display:grid;place-items:center;
 background:radial-gradient(circle at 50% 115%,#fff3a8 0 30%,transparent 31%),linear-gradient(#2ab0ff,#8fe3ff)">
<div style="width:420px;height:420px;margin-top:40px">{svg}</div></div></body></html>"""
out = ROOT / "app" / "img"
out.mkdir(exist_ok=True)
with sync_playwright() as p:
    b = p.webkit.launch()
    pg = b.new_page(viewport={"width": 512, "height": 512})
    pg.set_content(html)
    pg.locator("#ic").screenshot(path=str(out / "icon-512.png"))
    pg.set_viewport_size({"width": 512, "height": 512})
    b.close()

from PIL import Image  # noqa: E402
im = Image.open(out / "icon-512.png")
im.resize((180, 180), Image.LANCZOS).save(out / "icon-180.png")
im.resize((192, 192), Image.LANCZOS).save(out / "icon-192.png")
print("icons written")
