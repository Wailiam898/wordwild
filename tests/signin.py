"""Sign-in flows against a mocked Supabase (nothing touches the real cloud).
New player: name -> make code twice -> saved. Returning player: wrong code, then right code -> progress adopted.
Usage: .venv/Scripts/python.exe -I tests/signin.py [URL]"""
import sys, json
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = next((a for a in sys.argv[1:] if a.startswith("http")), "http://localhost:5180/")
OUT = Path(__file__).resolve().parent.parent / "work" / "shots" / "signin"
OUT.mkdir(parents=True, exist_ok=True)
db = {}  # name_key -> {pin, data, saved_at}
calls = []

def handle(route):
    req = route.request
    fn = req.url.rsplit("/", 1)[-1]
    body = json.loads(req.post_data or "{}")
    k = (body.get("p_name") or "").strip().lower()
    calls.append(fn)
    if fn == "ww_hit":
        return route.fulfill(status=204, body="")
    if fn == "ww_exists":
        return route.fulfill(json=k in db)
    if fn == "ww_load":
        r = db.get(k)
        res = {"status": "none"} if not r else {"status": "ok", "data": r["data"], "saved_at": r["saved_at"]} if r["pin"] == body["p_pin"] else {"status": "bad"}
        return route.fulfill(json=res)
    if fn == "ww_save":
        r = db.get(k)
        if r and r["pin"] != body["p_pin"]:
            return route.fulfill(json={"ok": False, "status": "bad"})
        if r and r["saved_at"] > (body.get("p_base") or 0):
            return route.fulfill(json={"ok": False, "status": "conflict", "saved_at": r["saved_at"]})
        db[k] = {"pin": body["p_pin"], "data": body["p_data"], "saved_at": body["p_saved_at"]}
        return route.fulfill(json={"ok": True, "saved_at": body["p_saved_at"]})
    route.fulfill(status=404, body="")

def pin(page, code):
    for ch in code:
        page.locator(".pin-key", has_text=ch).first.click()
    page.wait_for_timeout(700)

fails = []
with sync_playwright() as p:
    b = p.webkit.launch()
    # Device 1: new player.
    ctx = b.new_context(**p.devices["iPhone 13"]); page = ctx.new_page()
    errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
    page.route("**/*.supabase.co/**", handle)
    page.goto(URL); page.locator(".play").tap(force=True)
    page.wait_for_selector(".name-input"); page.fill(".name-input", "Everly"); page.locator(".name-row .go").tap(force=True)
    page.wait_for_selector(".pin-pad"); page.screenshot(path=str(OUT / "1-make-code.png"))
    pin(page, "1234"); page.wait_for_selector("text=Type it one more time")
    pin(page, "9999"); page.wait_for_selector("text=didn't match"); page.screenshot(path=str(OUT / "2-mismatch.png"))
    pin(page, "1234"); pin(page, "1234")
    page.wait_for_selector(".node.current", timeout=15000); page.wait_for_timeout(2500)
    page.screenshot(path=str(OUT / "3-map-signed-in.png"))
    if "everly" not in db: fails.append("new player not saved to cloud")
    pill = page.locator(".cloud-pill b").inner_text()
    if pill != "✓": fails.append(f"cloud pill shows {pill!r}")
    # Earn some progress so device 2 has something to adopt.
    page.evaluate("const s=window.__ww.store.state(); s.gems=77; s.done.L1={stars:3,acc:1,plays:1}; s.wordlings=['L1']; window.__ww.store.save()")
    page.wait_for_timeout(2500)
    if (db.get("everly", {}).get("data", {}).get("gems")) != 77: fails.append("progress did not sync up")
    if errs: fails.append(f"device1 errors {errs[:3]}")
    ctx.close()

    # Device 2: returning player, wrong code first.
    ctx = b.new_context(**p.devices["iPad (gen 7)"]); page = ctx.new_page()
    errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
    page.route("**/*.supabase.co/**", handle)
    page.goto(URL); page.locator(".play").tap(force=True)
    page.wait_for_selector(".name-input"); page.fill(".name-input", "  everly "); page.locator(".name-row .go").tap(force=True)
    page.wait_for_selector("text=Type your secret code")
    pin(page, "0000"); page.wait_for_selector("text=not the right code"); page.screenshot(path=str(OUT / "4-wrong-code.png"))
    pin(page, "1234")
    page.wait_for_selector(".node.current", timeout=15000); page.wait_for_timeout(1500)
    page.screenshot(path=str(OUT / "5-ipad-adopted.png"))
    st = page.evaluate("window.__ww.store.state()")
    if st["gems"] != 77 or "L1" not in st["done"]: fails.append(f"device2 did not adopt progress: gems={st['gems']} done={list(st['done'])}")
    if st.get("name") != "Everly": fails.append(f"name {st.get('name')}")
    if errs: fails.append(f"device2 errors {errs[:3]}")
    b.close()

print("calls:", sorted(set(calls)))
print("FAILURES:\n" + "\n".join(fails) if fails else "ALL OK")
