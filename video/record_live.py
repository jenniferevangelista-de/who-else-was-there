"""Captures the live-signal segment from the real app (started with the key and --remote-debugging-port=9333).
It only watches: the person presses "Turn my camera on" themselves. While the detector warms up nothing is captured,
because grabbing the screen during warm-up starves the SDK of frames (it then asks for 25 fps). Once the detector
reads LIVE, a compositor screencast records 24 s. The camera preview is covered in memory, before any frame is
written, so no face or room ever reaches the disk.
  python video/record_live.py   -> video/recordings/live.mp4
"""
import base64
import io
import shutil
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
TMP = HERE / "recordings" / "_live"
OUT = HERE / "recordings" / "live.mp4"
WAIT_MAX, AFTER_LIVE, LIVE_MAX = 43200, 24, 3600
STATE = "(() => { const c = document.querySelector('#camPill').classList.contains('cam-on');" \
        " const s = [...document.querySelectorAll('[data-state]')].map(e => e.textContent).join('|');" \
        " const r = document.querySelector('#me')?.getBoundingClientRect();" \
        " return {cam: c, state: s, w: window.innerWidth, box: r ? [r.x, r.y, r.right, r.bottom] : null}; })()"


def is_live(info):
    return any(x in ("LIVE", "AO VIVO") for x in info["state"].split("|"))


def wait_for(page, seconds, test):
    t0 = time.monotonic()
    while time.monotonic() - t0 < seconds:
        if test(page.evaluate(STATE)):
            return True
        time.sleep(1)
    return False


def main():
    shutil.rmtree(TMP, ignore_errors=True)
    with sync_playwright() as p:
        b = p.chromium.connect_over_cdp("http://127.0.0.1:9333")
        page = next(pg for c in b.contexts for pg in c.pages if "index.html" in pg.url)
        if not wait_for(page, WAIT_MAX, lambda i: i["cam"]):
            print("camera never turned on"); return 1
        print("camera on, waiting for the live reading", flush=True)
        if not wait_for(page, LIVE_MAX, is_live):
            print("LIVE never reached, nothing saved"); return 2
        print("LIVE reached, recording", flush=True)
        TMP.mkdir(parents=True)
        cdp = page.context.new_cdp_session(page)
        queue = []
        cdp.on("Page.screencastFrame", lambda frame: queue.append(frame))
        cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 85, "everyNthFrame": 2})
        n, start, stamps = 0, time.monotonic(), []
        while time.monotonic() - start < AFTER_LIVE:
            page.wait_for_timeout(15)
            while queue:
                f = queue.pop(0)
                cdp.send("Page.screencastFrameAck", {"sessionId": f["sessionId"]})
                info = page.evaluate(STATE)
                shot = Image.open(io.BytesIO(base64.b64decode(f["data"]))).convert("RGB")
                if info["box"]:                     # cover the camera preview before anything is saved
                    k = shot.width / info["w"]      # the frame is in device pixels, the box in CSS pixels
                    d = ImageDraw.Draw(shot); x0, y0, x1, y1 = (v * k for v in info["box"])
                    d.rounded_rectangle((x0 - 6, y0 - 6, x1 + 6, y1 + 6), 20, fill=(18, 10, 31))
                    d.text(((x0 + x1) / 2, (y0 + y1) / 2), "camera image hidden in this video", fill=(216, 198, 234), anchor="mm")
                n += 1; shot.save(TMP / f"{n:06d}.jpg", quality=88); stamps.append(f["metadata"]["timestamp"])
        cdp.send("Page.stopScreencast")
        b.close()
    if n < 30:
        shutil.rmtree(TMP, ignore_errors=True); print("too few frames, nothing saved:", n); return 3
    fps = (n - 1) / max(0.1, stamps[-1] - stamps[0])
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", f"{fps:.3f}", "-i", str(TMP / "%06d.jpg"),
                    "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2,pad=ih*16/9:ih:(ow-iw)/2:0:color=0x120a1f,format=yuv420p",
                    "-c:v", "libx264", "-crf", "18", "-r", "30", str(OUT)], check=True)
    shutil.rmtree(TMP, ignore_errors=True)
    print("saved", OUT, "frames", n, "fps", round(fps, 1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
