"""Captures the real "bring your own video" flow from the real app (started with the key and --remote-debugging-port=9333).
The video file is handed to the app's own picker. Nothing is captured while the SDK warms up, because grabbing the screen then
starves it of frames. Once a real pulse is on the detector, 16 s of the reading are recorded, then 7 s of the finished report.
The picture of the video is covered in memory, before any frame is written, so no face ever reaches the disk.
  python video/record_tape.py "<a video where everyone agreed>"            -> video/recordings/tape.mp4
  python video/record_tape.py "<a fully AI-generated person>" --show       keeps the picture, since nobody real is in it
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
TMP = HERE / "recordings" / "_tape"
OUT = HERE / "recordings" / "tape.mp4"
READING, REPORT, WARMUP_MAX, FINISH_MAX = 16, 7, 120, 180
SHOW = "--show" in sys.argv
BOX = "(() => { const r = document.querySelector('#tape')?.getBoundingClientRect(); return {w: window.innerWidth, box: r ? [r.x, r.y, r.right, r.bottom] : null}; })()"
BPM = "(() => { const b = document.querySelector('#scopeTape [data-bpm]')?.textContent; return /^[1-9][0-9]+$/.test(b || '') ? b : null; })()"
REPORT_ON = "!!document.querySelector('#reportBody')"


def grab(page, cdp, queue, seconds, stop=None):
    """Keeps screencast frames for a while, covering the video first. Returns (image, timestamp) pairs."""
    kept, start = [], time.monotonic()
    while time.monotonic() - start < seconds and not (stop and page.evaluate(stop)):
        page.wait_for_timeout(15)
        while queue:
            f = queue.pop(0)
            cdp.send("Page.screencastFrameAck", {"sessionId": f["sessionId"]})
            info = page.evaluate(BOX)
            shot = Image.open(io.BytesIO(base64.b64decode(f["data"]))).convert("RGB")
            if info["box"] and not SHOW:
                k = shot.width / info["w"]
                d = ImageDraw.Draw(shot); x0, y0, x1, y1 = (v * k for v in info["box"])
                d.rounded_rectangle((x0 - 4, y0 - 4, x1 + 4, y1 + 4), 18, fill=(18, 10, 31))
                d.text(((x0 + x1) / 2, (y0 + y1) / 2), "the person's picture is hidden in this video", fill=(216, 198, 234), anchor="mm")
            kept.append((shot, f["metadata"]["timestamp"]))
    return kept


def wait_js(page, seconds, js):
    t0 = time.monotonic()
    while time.monotonic() - t0 < seconds:
        if page.evaluate(js):
            return True
        time.sleep(.5)
    return False


def main():
    video = Path(sys.argv[1]).resolve()
    shutil.rmtree(TMP, ignore_errors=True); TMP.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.connect_over_cdp("http://127.0.0.1:9333")
        page = next(pg for c in b.contexts for pg in c.pages if "index.html" in pg.url)
        page.evaluate("localStorage.setItem('gh-lang', 'en')"); page.reload(); page.wait_for_selector("#next")
        page.evaluate("document.querySelector('.chip[data-id=\"dare\"]')?.click()")
        page.wait_for_selector("#tapeAgree", timeout=20000); page.wait_for_timeout(4000)     # the SDK check finishes after the page loads
        page.click("#tapeAgree")
        page.set_input_files("#ownTape", str(video))
        if not wait_js(page, WARMUP_MAX, f"({BPM}) || {REPORT_ON}"):
            print("neither a pulse nor a report came back, nothing saved"); return 2
        print("pulse on screen:", page.evaluate(BPM), "| status:", page.inner_text("#anStatus") if page.query_selector("#anStatus") else "report", flush=True)
        cdp = page.context.new_cdp_session(page); queue = []
        cdp.on("Page.screencastFrame", lambda frame: queue.append(frame))
        cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 85, "everyNthFrame": 2})
        frames = grab(page, cdp, queue, READING, stop=REPORT_ON)
        cdp.send("Page.stopScreencast"); queue.clear()
        if not wait_js(page, FINISH_MAX, REPORT_ON):
            print("the report never appeared, nothing saved"); return 3
        page.wait_for_timeout(1200)
        cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 85, "everyNthFrame": 2})
        tail = grab(page, cdp, queue, REPORT)
        cdp.send("Page.stopScreencast")
        b.close()
    if not tail:
        shutil.rmtree(TMP, ignore_errors=True); print("no report frames, nothing saved"); return 4
    fps = (len(frames) - 1) / max(.1, frames[-1][1] - frames[0][1]) if len(frames) >= 30 else 15.0
    seq = [im for im, _ in frames + tail]; seq += [seq[-1]] * max(0, int(REPORT * fps) - len(tail))     # the report is still, so the screencast sends few frames
    for n, im in enumerate(seq, 1):
        im.save(TMP / f"{n:06d}.jpg", quality=88)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", f"{fps:.3f}", "-i", str(TMP / "%06d.jpg"),
                    "-vf", r"pad=ceil(max(iw\,ih*16/9)/2)*2:ceil(max(ih\,iw*9/16)/2)*2:(ow-iw)/2:(oh-ih)/2:color=0x120a1f,format=yuv420p",
                    "-c:v", "libx264", "-crf", "18", "-r", "30", str(OUT)], check=True)
    shutil.rmtree(TMP, ignore_errors=True)
    print("saved", OUT, "frames", len(frames), "+", len(tail), "fps", round(fps, 1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
