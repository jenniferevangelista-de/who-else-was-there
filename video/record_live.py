"""Captures the live-signal segment from the real app (started with the key and --remote-debugging-port=9333).
It only watches: the person presses "Turn my camera on" themselves. Recording starts when the camera turns on
and ends 24 s after the scope first reads LIVE. The camera preview is covered in memory, before any frame is
written, so no face or room ever reaches the disk.
  python video/record_live.py   -> video/recordings/live.mp4
"""
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
WAIT_MAX, AFTER_LIVE, HARD_MAX, PRE_FRAMES = 1500, 24, 1500, 60     # only the last few seconds before LIVE are kept
STATE = "(() => { const c = document.querySelector('#camPill').classList.contains('cam-on');" \
        " const s = [...document.querySelectorAll('[data-state]')].map(e => e.textContent).join('|');" \
        " const r = document.querySelector('#me')?.getBoundingClientRect();" \
        " return {cam: c, state: s, w: window.innerWidth, box: r ? [r.x, r.y, r.right, r.bottom] : null}; })()"


def main():
    shutil.rmtree(TMP, ignore_errors=True); TMP.mkdir(parents=True)
    with sync_playwright() as p:
        b = p.chromium.connect_over_cdp("http://127.0.0.1:9333")
        page = next(pg for c in b.contexts for pg in c.pages if "index.html" in pg.url)
        t0 = time.monotonic()
        while time.monotonic() - t0 < WAIT_MAX:
            if page.evaluate(STATE)["cam"]:
                break
            time.sleep(0.5)
        else:
            print("camera never turned on"); return 1
        print("camera on, recording", flush=True)
        n, start, live_at, times = 0, time.monotonic(), None, []
        while True:
            info = page.evaluate(STATE)
            if live_at is None and ("LIVE" in info["state"] or "AO VIVO" in info["state"]):
                live_at = time.monotonic(); print("LIVE reached after", round(live_at - start, 1), "s", flush=True)
            shot = Image.open(io.BytesIO(page.screenshot(type="jpeg", quality=85))).convert("RGB")
            if info["box"]:                     # cover the camera preview before anything is saved
                k = shot.width / info["w"]      # the screenshot is in device pixels, the box in CSS pixels
                d = ImageDraw.Draw(shot); x0, y0, x1, y1 = (v * k for v in info["box"])
                d.rounded_rectangle((x0 - 6, y0 - 6, x1 + 6, y1 + 6), 20, fill=(18, 10, 31))
                d.text(((x0 + x1) / 2, (y0 + y1) / 2), "camera image hidden in this video", fill=(216, 198, 234), anchor="mm")
            n += 1; shot.save(TMP / f"{n:06d}.jpg", quality=88); times.append(time.monotonic())
            if live_at is None and n > PRE_FRAMES:
                (TMP / f"{n - PRE_FRAMES:06d}.jpg").unlink(missing_ok=True)
            now = time.monotonic()
            if (live_at and now - live_at >= AFTER_LIVE) or now - start >= HARD_MAX:
                break
            time.sleep(0.03 if live_at else 0.12)
        files = sorted(TMP.glob("*.jpg"))
        first = int(files[0].stem) if files else 1
        fps = (len(files) - 1) / max(0.1, times[-1] - times[first - 1]) if len(files) > 1 else 10.0
        b.close()
    if live_at is None:                         # never store a take that does not show the live signal
        shutil.rmtree(TMP, ignore_errors=True); print("LIVE never reached, nothing saved"); return 2
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", f"{fps:.3f}", "-start_number", str(first), "-i", str(TMP / "%06d.jpg"),
                    "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2,pad=ih*16/9:ih:(ow-iw)/2:0:color=0x120a1f,format=yuv420p",
                    "-c:v", "libx264", "-crf", "18", str(OUT)], check=True)
    shutil.rmtree(TMP, ignore_errors=True)
    print("saved", OUT, "frames", n, "fps", round(fps, 1), "live reached:", live_at is not None)
    return 0


if __name__ == "__main__":
    sys.exit(main())
