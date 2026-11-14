"""Takes the documentation screenshots from the real app in replay mode (no key, no camera, sample numbers).
  python scripts/make_screens.py     (RECORD_CHANNEL=chrome to use an installed Chrome)
"""
import os
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "screens"
PAGE = (ROOT / "app" / "renderer" / "index.html").as_uri()
SHOTS = ["title", "consent", "menu", "calendar", "case", "tape", "point", "locker", "board", "dossier", "dare", "room", "report", "tested"]
W, H = 1600, 900


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        kw = {"channel": os.environ["RECORD_CHANNEL"]} if os.environ.get("RECORD_CHANNEL") else {}
        b = p.chromium.launch(headless=True, **kw)
        for name in SHOTS:
            g = b.new_page(viewport={"width": W, "height": H})
            g.goto(f"{PAGE}?screen={name}")
            g.wait_for_timeout(4500)
            g.screenshot(path=str(OUT / f"{name}.jpg"), type="jpeg", quality=82)
            g.close()
            print(name)
        g = b.new_page(viewport={"width": W, "height": H})     # the ending: the whole screen says I AM HERE (drawn here the way fx.scream draws it)
        g.goto(f"{PAGE}?screen=board"); g.wait_for_timeout(2500)
        g.evaluate("""() => { const d = document.createElement('div'); d.className = 'fx fx-scream all';
          d.innerHTML = '<img src="img/stalker.svg" alt=""><div style="font-size:min(52vw,35vh);animation:none"><b style="animation:none">I</b><b style="animation:none">AM</b><b style="animation:none">HERE</b></div>'; document.body.append(d); }""")
        g.wait_for_timeout(2600)
        g.screenshot(path=str(OUT / "scare.jpg"), type="jpeg", quality=82); g.close(); print("scare")
        b.close()
    keep = ["title", "calendar", "tape", "point", "board", "room", "menu", "tested", "consent"]
    t = (640, 360)
    sheet = Image.new("RGB", (t[0] * 3 + 16, t[1] * 3 + 16), (18, 10, 31))
    for i, n in enumerate(keep):
        sheet.paste(Image.open(OUT / f"{n}.jpg").resize(t, Image.LANCZOS), ((t[0] + 8) * (i % 3), (t[1] + 8) * (i // 3)))
    sheet.save(ROOT / "docs" / "preview_sheet.jpg", quality=84)


if __name__ == "__main__":
    main()
