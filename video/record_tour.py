"""Records the real app screens in replay mode (no key, no camera, sample numbers) in a headless browser.
  python video/record_tour.py   -> video/recordings/tour.webm + video/recordings/scenes.json
Set RECORD_CHANNEL=chrome to use an installed Chrome instead of Playwright's Chromium.
"""
import json
import os
import shutil
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
PAGE = (HERE.parent / "app" / "renderer" / "index.html").as_uri()
REC = HERE / "recordings"
TMP = REC / "_tmp"
W, H = 1600, 900


def main():
    REC.mkdir(exist_ok=True); shutil.rmtree(TMP, ignore_errors=True)
    scenes = []
    with sync_playwright() as p:
        kw = {"channel": os.environ["RECORD_CHANNEL"]} if os.environ.get("RECORD_CHANNEL") else {}
        b = p.chromium.launch(headless=True, **kw)
        ctx = b.new_context(viewport={"width": W, "height": H}, record_video_dir=str(TMP), record_video_size={"width": W, "height": H})
        page = ctx.new_page()
        t0 = time.monotonic()
        now = lambda: round(time.monotonic() - t0, 2)
        page.goto(PAGE); page.wait_for_selector("#next")

        def scene(key, fn):
            s = now(); fn(); scenes.append({"key": key, "start": s, "end": now()}); print(key, scenes[-1]["end"] - s, "s")

        nxt = lambda: page.click("#next")
        wait = lambda s: time.sleep(s)
        ready = lambda: page.wait_for_selector("#next:not([disabled])", timeout=60000)

        scene("cold", lambda: wait(6.5))
        nxt(); scene("crew", lambda: (wait(1.2), page.click('[data-intro="luna"]'), wait(1.6), page.click('[data-intro="bigotes"]'), wait(1.6), page.click('[data-intro="xochi"]'), wait(1.6)))
        nxt(); wait(1.5)                      # main menu
        page.click('[data-go="calendar"]'); scene("map", lambda: (page.wait_for_selector(".night.arrived", timeout=60000), wait(0.8), page.click('[data-date="2026-11-02"]'), page.wait_for_selector(".night-res", timeout=9000), wait(2)))
        page.click("#whatNow .wn.main"); scene("case", lambda: wait(9))
        nxt(); scene("tape", lambda: (ready(), wait(1.5)))

        def door():
            box = page.locator("#timeline").bounding_box()
            for i in range(0, 120):
                sec = 13 + i * 0.125
                page.mouse.click(box["x"] + box["width"] * sec / 45, box["y"] + box["height"] / 2); wait(0.05)
        scene("door", door)
        nxt(); wait(0.4)
        scene("point", lambda: (ready(), wait(3)))
        nxt(); scene("locker", lambda: (wait(1), page.click('[data-ev="E3"]'), wait(3)))
        nxt(); wait(0.6)
        def ask(q):
            page.click(f'.q[data-q="{q}"]'); wait(0.5); page.wait_for_selector(".q:not([disabled])", timeout=90000); wait(6)
        scene("board", lambda: (ask("who"), ask("from")))
        scene("reading", lambda: ask("protect"))
        scene("kinds", lambda: wait(9))       # the spirit's file: the seven kinds, and what this one wants
        scene("end", lambda: (page.click('.q[data-q="bye"]'), page.wait_for_selector(".stamp-closed", timeout=120000), wait(6)))
        page.click("#whatNow .wn.main"); scene("dare", lambda: wait(6))
        scene("upload", lambda: (wait(2.5), page.click("#tapeAgree"), wait(4.5)))     # the file picker unlocks only after consent
        page.click("#goRoom"); scene("consent", lambda: wait(7))
        nxt(); scene("room", lambda: (page.click("#roomOn"), wait(15)))
        page.click("#roomReport"); page.wait_for_selector("#reportBody"); scene("report", lambda: wait(9))
        page.click("#whatNow .wn.main"); scene("tested", lambda: wait(7))

        video = page.video.path()
        ctx.close(); b.close()
    shutil.move(str(video), REC / "tour.webm"); shutil.rmtree(TMP, ignore_errors=True)
    (REC / "scenes.json").write_text(json.dumps(scenes, indent=1), encoding="utf-8")
    print("recorded", scenes[-1]["end"], "s")


if __name__ == "__main__":
    main()
