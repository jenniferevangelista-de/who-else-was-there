"""Builds the Ghost Hunt film: the real app in a frame, Wisp narrating beside it with its mouth on the voice,
titles, subtitles, an original score made in code and tonal effects only (no noise, no hiss).
1920x1080, 24 fps, H.264 + AAC 48 kHz, -14 LUFS.

  python video/build.py frames 5 40 90   -> video/out/preview_*.jpg
  python video/build.py audio            -> video/music/mix.wav
  python video/build.py render           -> video/out/ghost_hunt_film.mp4 + .srt

Needs video/timeline.json + voice/ (script.py), recordings/tour.webm + scenes.json (record_tour.py).
The "live" segment uses recordings/live.webm; until it exists the frame is stamped NOT LIVE so it cannot ship by accident.
Binaries: FFMPEG and FFPROBE environment variables, default from PATH. Fonts: downloaded once to assets/fonts (SIL OFL).
"""
import json
import math
import os
import subprocess
import sys
import textwrap
import urllib.request
from functools import lru_cache
from multiprocessing import Pool
from pathlib import Path

import numpy as np
import soundfile as sf
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
OUT, REC, FONTS, MUSIC, SFXD = HERE / "out", HERE / "recordings", HERE / "assets" / "fonts", HERE / "music", HERE / "sfx"
FRAMES = Path(os.environ.get("GH_FRAMES", HERE / "out" / "_frames"))
FF, FP = os.environ.get("FFMPEG", "ffmpeg"), os.environ.get("FFPROBE", "ffprobe")
W, H, FPS, SR = 1920, 1080, 24, 48000
FX, FY, FW, FH = 36, 100, 1536, 864
CREAM, INK, PINK, MINT, DANGER, GOLD = (255, 248, 236), (42, 24, 64), (255, 134, 184), (154, 245, 200), (255, 102, 128), (232, 194, 122)
FONT_URLS = {"Kalam-Bold.ttf": "https://github.com/google/fonts/raw/main/ofl/kalam/Kalam-Bold.ttf",
             "Creepster-Regular.ttf": "https://github.com/google/fonts/raw/main/ofl/creepster/Creepster-Regular.ttf"}


def get_fonts():
    FONTS.mkdir(parents=True, exist_ok=True)
    for name, url in FONT_URLS.items():
        if not (FONTS / name).exists():
            urllib.request.urlretrieve(url, FONTS / name)


@lru_cache(maxsize=32)
def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


def _dur(p):
    return float(subprocess.run([FP, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)], capture_output=True, text=True, check=True).stdout)


def decode(p):
    raw = subprocess.run([FF, "-v", "error", "-i", str(p), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


# ---------------------------------------------------------------- timeline
narr = json.loads((HERE / "timeline.json").read_text(encoding="utf-8"))
scenes = {s["key"]: s for s in json.loads((REC / "scenes.json").read_text(encoding="utf-8"))}
LIVE = REC / "live.mp4"
HAS_LIVE = LIVE.exists()
TL, _t = [], 0.4
for n in narr:
    d, it = n["dur"], {**n, "t0": _t}
    if n["kind"] == "card":
        seg_len = d + 1.4
    else:
        if n["kind"] == "live" and HAS_LIVE:
            v0, v1 = 0.0, _dur(LIVE)
        else:
            s = scenes["room" if n["kind"] == "live" else n["id"]]
            v0, v1 = s["start"], s["end"]
        tail = 2.2 if n["id"] == "point" else 1.8 if n["id"] == "end" else 0.9
        speed = min(3.0, max(1.0, (v1 - v0) / (d + tail)))
        it.update(v0=v0, v1=v1, speed=speed)
        seg_len = max(d + tail, (v1 - v0) / speed)
    it["t1"] = _t + seg_len
    TL.append(it); _t += seg_len
DUR = round(_t + 1.2, 2)


def at(t):
    for it in TL:
        if it["t0"] <= t < it["t1"]:
            return it
    return TL[-1]


@lru_cache(maxsize=1)
def envelopes():
    p = OUT / "_env.json"
    if p.exists():
        return json.loads(p.read_text())
    out = {}
    for it in TL:
        a = decode(HERE / it["voice"]); hop = SR // FPS
        r = np.array([np.sqrt(np.mean(a[j:j + hop] ** 2)) for j in range(0, len(a), hop)])
        out[it["id"]] = (r / (r.max() or 1)).round(3).tolist()
    OUT.mkdir(exist_ok=True); p.write_text(json.dumps(out))
    return out


def mouth(t):
    """How open the speaker's mouth is: follows the loudness of the line, closed in the pauses."""
    it = at(t); e = envelopes()[it["id"]]; k = int((t - it["t0"] - 0.2) * FPS)
    m = e[k] if 0 <= k < len(e) else 0.0
    return 0.0 if m < 0.12 else min(1.0, m * 1.25)


@lru_cache(maxsize=1)
def subs():
    out = []
    for it in TL:
        parts, cur = [], ""
        for sent in it["line"].replace(". ", ".|").replace("? ", "?|").replace(": ", ":|").split("|"):
            for chunk in textwrap.wrap(sent, 72):
                parts.append(chunk)
        total = sum(len(p) for p in parts); t = it["t0"] + 0.2
        for p in parts:
            d = it["dur"] * len(p) / total; out.append((t, t + d + 0.1, p)); t += d
    return out


# ---------------------------------------------------------------- drawing
@lru_cache(maxsize=1)
def backdrop():
    y = np.linspace(0, 1, H)[:, None, None]
    a = np.array([30, 16, 52]) * (1 - y) + np.array([11, 6, 22]) * y
    img = Image.fromarray(np.broadcast_to(a, (H, W, 3)).astype(np.uint8)).convert("RGBA")
    d = ImageDraw.Draw(img); rng = np.random.default_rng(7)
    for _ in range(170):
        x, yy, r = int(rng.integers(0, W)), int(rng.integers(0, H)), int(rng.integers(1, 3))
        d.ellipse((x, yy, x + r, yy + r), fill=(225, 214, 255, int(rng.integers(50, 190))))
    return img


def wisp(size, m, t, gaze=0.0):
    """The app's Wisp (same shape as app/renderer/img/wisp.svg), with a mouth that opens with the voice."""
    S, s = 3, size * 3 / 120
    im = Image.new("RGBA", (int(120 * s), int(142 * s)), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    P = lambda x, y: (x * s, y * s)
    pts = [P(60 + 48 * math.cos(a), 62 + 56 * math.sin(a)) for a in np.linspace(math.pi, 2 * math.pi, 40)]
    pts += [P(108, 120), P(100, 128), P(90, 118), P(80, 128), P(70, 118), P(60, 128), P(50, 118), P(40, 128), P(30, 118), P(20, 128), P(12, 120)]
    d.polygon(pts, fill=(246, 240, 255, 255)); d.line(pts + [pts[0]], fill=INK + (255,), width=int(6 * s), joint="curve")
    blink = (t * 0.37) % 1 > 0.96
    for ex in (44, 76):
        if blink:
            d.line([P(ex - 9, 58), P(ex + 9, 58)], fill=INK + (255,), width=int(4 * s))
        else:
            d.ellipse([*P(ex - 9, 46), *P(ex + 9, 70)], fill=INK + (255,)); d.ellipse([*P(ex - 6.5 + gaze, 49), *P(ex + 0.5 + gaze, 56)], fill=(255, 255, 255, 255))
    for cx in (33, 87):
        d.ellipse([*P(cx - 7, 70), *P(cx + 7, 78)], fill=(255, 158, 199, 190))
    if m < 0.05:
        d.arc([*P(52, 72), *P(68, 84)], 20, 160, fill=INK + (255,), width=int(4 * s))
    else:
        d.ellipse([*P(60 - 6 - 3 * m, 76), *P(60 + 6 + 3 * m, 77 + 16 * m)], fill=(120, 40, 80, 255), outline=INK + (255,), width=int(3 * s))
    hx, hy = 60, 98                     # the still grey heart
    heart = [P(hx + 0.95 * 16 * math.sin(a) ** 3, hy - 1 - 0.95 * (13 * math.cos(a) - 5 * math.cos(2 * a) - 2 * math.cos(3 * a) - math.cos(4 * a))) for a in np.linspace(0, 2 * math.pi, 48)]
    d.polygon(heart, fill=(143, 138, 160, 255)); d.line(heart + [heart[0]], fill=INK + (255,), width=int(3.5 * s), joint="curve")
    return im.resize((size, int(142 * size / 120)), Image.LANCZOS)


@lru_cache(maxsize=2)
def _extract_check():
    return (FRAMES / "tour").exists()


def rec_frame(it, t):
    src = "live" if it["kind"] == "live" and HAS_LIVE else "tour"
    sec = min(it["v1"], it["v0"] + (t - it["t0"]) * it["speed"])
    jpg = FRAMES / src / f"{int(sec * FPS) + 1:06d}.jpg"
    if jpg.exists():
        return Image.open(jpg).convert("RGB").resize((FW, FH), Image.LANCZOS)
    tmp = OUT / f"_one_{os.getpid()}.jpg"; video = LIVE if src == "live" else REC / "tour.webm"
    subprocess.run([FF, "-v", "error", "-y", "-ss", f"{sec:.3f}", "-i", str(video), "-frames:v", "1", "-q:v", "2", str(tmp)], check=True)
    im = Image.open(tmp).convert("RGB").resize((FW, FH), Image.LANCZOS); im.load(); tmp.unlink()
    return im


def subtitle(d, t):
    for a, b, s in subs():
        if a <= t < b:
            f = font("Kalam-Bold.ttf", 40); w = d.textlength(s, font=f)
            d.rounded_rectangle((W / 2 - w / 2 - 24, 984, W / 2 + w / 2 + 24, 1056), 18, fill=(255, 248, 236, 240))
            d.text((W / 2, 1019), s, font=f, fill=INK, anchor="mm")
            return


def render(t):
    it = at(t); m = mouth(t); bob = math.sin(t * 2.2) * 7
    img = backdrop().copy()
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    k = min(1.0, (t - it["t0"]) / 0.35)                 # the scene settles in
    if it["kind"] == "card":
        wi = wisp(420, m, t)
        img.alpha_composite(wi, (W // 2 - 210, int(420 + bob)))
        d = ImageDraw.Draw(img)
        if it["id"] == "hello":
            d.text((W / 2, 150), "GHOST HUNT", font=font("Creepster-Regular.ttf", 150), fill=PINK, anchor="mm")
            d.text((W / 2, 280), "Who Else Was There?", font=font("Kalam-Bold.ttf", 76), fill=CREAM, anchor="mm")
            d.text((W / 2, 362), "a heartbeat is the evidence  ·  built on Presage SmartSpectra", font=font("Kalam-Bold.ttf", 38), fill=MINT, anchor="mm")
        else:
            d.text((W / 2, 170), "WHO ELSE WAS THERE?", font=font("Creepster-Regular.ttf", 130), fill=DANGER, anchor="mm")
            d.text((W / 2, 320), "Case 02 is already on the tape.", font=font("Kalam-Bold.ttf", 54), fill=CREAM, anchor="mm")
    else:
        frame = rec_frame(it, t)
        ImageDraw.Draw(glow).rounded_rectangle((FX - 8, FY - 8, FX + FW + 8, FY + FH + 8), 26, fill=PINK + (70,))
        img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(16)))
        mask = Image.new("L", (FW, FH), 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, FW - 1, FH - 1), 20, fill=255)
        img.paste(frame, (FX, FY), mask)
        d = ImageDraw.Draw(img)
        y0 = int(52 - (1 - k) * 12)
        d.text((FX + 8, y0), it["title"], font=font("Kalam-Bold.ttf", 54), fill=CREAM, anchor="lm")
        is_live = it["kind"] == "live"
        if is_live and HAS_LIVE:
            d.rounded_rectangle((FX + FW - 250, 26, FX + FW, 78), 26, fill=DANGER)
            d.text((FX + FW - 125, 52), "LIVE SIGNAL", font=font("Kalam-Bold.ttf", 32), fill=(255, 255, 255), anchor="mm")
        elif is_live:
            d.rounded_rectangle((FX + 280, FY + 330, FX + FW - 280, FY + 530), 22, fill=(180, 20, 40, 235))
            d.text((FX + FW / 2, FY + 430), "NOT LIVE · placeholder", font=font("Creepster-Regular.ttf", 90), fill=(255, 255, 255), anchor="mm")
        elif "SAMPLE" not in it["title"] and it["id"] in ("tape", "door", "point", "map", "case"):
            d.rounded_rectangle((FX + FW - 250, 30, FX + FW, 76), 23, fill=GOLD)
            d.text((FX + FW - 125, 53), "SAMPLE DATA", font=font("Kalam-Bold.ttf", 28), fill=INK, anchor="mm")
        wi = wisp(300, m, t, gaze=-2.0)
        img.alpha_composite(wi, (1592, int(480 + bob)))
        ImageDraw.Draw(img).text((1742, 860), "Wisp", font=font("Kalam-Bold.ttf", 40), fill=CREAM, anchor="mm")
    d = ImageDraw.Draw(img)
    subtitle(d, t)
    return img.convert("RGB")


# ---------------------------------------------------------------- audio: tonal only, no noise anywhere
def t_(d): return np.arange(int(d * SR)) / SR
def tone(f, d, a, dec): tt = t_(d); return np.sin(2 * np.pi * f * tt) * np.exp(-tt * dec) * a
def sweep(f0, f1, d, a):
    tt = t_(d); ph = 2 * np.pi * (f0 * tt + (f1 - f0) * tt ** 2 / (2 * d)); return np.sin(ph) * np.sin(np.pi * tt / d) ** 2 * a


SFX = {"tick": lambda: tone(1250, .07, .22, 60), "pop": lambda: sweep(500, 1100, .16, .28),
       "swap": lambda: sweep(320, 880, .24, .16), "chime": lambda: tone(990, .8, .2, 5) + tone(1485, .8, .08, 6),
       "low": lambda: tone(62, .6, .55, 5), "flat": lambda: sweep(880, 880, 2.2, .1)}


def score(n):
    """An original score: a low drone a semitone apart, a minor music box with one wrong note, a slow heartbeat."""
    t = np.arange(n) / SR; dur = n / SR
    drone = np.sin(2 * np.pi * 55 * t) + .8 * np.sin(2 * np.pi * 58.27 * t) + .4 * np.sin(2 * np.pi * 110 * t + np.sin(2 * np.pi * .09 * t))
    drone *= .55 + .45 * np.sin(2 * np.pi * .04 * t) ** 2
    box, beat = np.zeros(n), np.zeros(n); notes = [440.0, 523.25, 659.25, 622.25, 523.25, 493.88, 440.0, 329.63]
    for k, st in enumerate(np.arange(1.0, dur, .62)):
        m = min(int(1.4 * SR), n - int(st * SR))
        if m <= 0: break
        f = notes[k % 8] * (.5 if (k // 16) % 2 else 1.0); tt = np.arange(m) / SR
        box[int(st * SR):int(st * SR) + m] += (np.sin(2 * np.pi * f * tt) + .3 * np.sin(2 * np.pi * f * 2.76 * tt)) * np.exp(-tt * 3.2) * .35
    for st in np.arange(2.0, dur, 2.4):
        for off, g in ((0, 1.0), (.22, .7)):
            m = min(int(.25 * SR), n - int((st + off) * SR))
            if m <= 0: continue
            tt = np.arange(m) / SR; beat[int((st + off) * SR):int((st + off) * SR) + m] += np.sin(2 * np.pi * (60 - 20 * tt) * tt) * np.exp(-tt * 18) * g
    x = drone * .3 + box + beat * .7
    x *= np.minimum(1, t / 2.5) * np.minimum(1, (dur - t) / 2.5)
    return (x / (np.abs(x).max() or 1)).astype(np.float32)


def mix():
    n = int(DUR * SR); voice, fx = np.zeros(n, np.float32), np.zeros(n, np.float32)
    def put(buf, clip, at_):
        i = int(at_ * SR); seg_ = clip[:max(0, n - i)]; buf[i:i + len(seg_)] += seg_
    for k, it in enumerate(TL):
        put(voice, decode(HERE / it["voice"]), it["t0"] + .2)
        if k: put(fx, SFX["swap"]().astype(np.float32), it["t0"] - .12)
        if it["id"] == "point": put(fx, SFX["flat"]().astype(np.float32), it["t0"] + it["dur"] * .5)
        if it["id"] == "map":
            for j in range(1, 5): put(fx, SFX["low"]().astype(np.float32), it["t0"] + j * 1.6)
        if it["id"] in ("end", "cold"): put(fx, SFX["chime"]().astype(np.float32), it["t1"] - 1.2)
    for name, fn in SFX.items():
        SFXD.mkdir(exist_ok=True); sf.write(SFXD / f"{name}.wav", fn(), SR)
    a = np.abs(voice).astype(np.float64); k = int(SR * .25); c = np.concatenate([[0.0], np.cumsum(a)])
    env = (c[np.minimum(np.arange(n) + k, n)] - c[np.maximum(np.arange(n) - k, 0)]) / (2 * k) * 6
    music = score(n) * .22 * (1 - .6 * np.clip(env, 0, 1))
    MUSIC.mkdir(exist_ok=True)
    x = np.clip(voice + music + fx, -1, 1)
    sf.write(MUSIC / "mix.wav", x, SR, subtype="PCM_16")
    print("mix", round(DUR, 1), "s")


def write_srt():
    def ts(s):
        ms = int(round(s * 1000)); return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"
    (OUT / "ghost_hunt_film.srt").write_text("\n".join(f"{i}\n{ts(a)} --> {ts(b)}\n{t}\n" for i, (a, b, t) in enumerate(subs(), 1)), encoding="utf-8")


def _frame(i):
    return render(i / FPS).tobytes()


def full_render():
    OUT.mkdir(exist_ok=True); mix(); write_srt(); envelopes()
    for src, v in (("tour", REC / "tour.webm"), ("live", LIVE)):
        if v.exists():
            (FRAMES / src).mkdir(parents=True, exist_ok=True)
            subprocess.run([FF, "-v", "error", "-y", "-i", str(v), "-vf", f"fps={FPS},scale={FW}:{FH}:flags=lanczos", "-q:v", "3", str(FRAMES / src / "%06d.jpg")], check=True)
    n = int(DUR * FPS); dest = OUT / "ghost_hunt_film.mp4"
    ff = subprocess.Popen([FF, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", str(MUSIC / "mix.wav"),
                           "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", str(SR), "-shortest", str(dest)], stdin=subprocess.PIPE)
    with Pool(int(os.environ.get("GH_PROCS", "4"))) as pool:
        for i, b in enumerate(pool.imap(_frame, range(n), chunksize=12)):
            ff.stdin.write(b)
            if i % 480 == 0: print(f"{i}/{n}", flush=True)
    ff.stdin.close(); ff.wait()
    print("wrote", dest, round(_dur(dest), 1), "s")


if __name__ == "__main__":
    get_fonts(); OUT.mkdir(exist_ok=True)
    cmd = sys.argv[1] if len(sys.argv) > 1 else "render"
    print("film length", DUR, "s | live recording:", HAS_LIVE)
    if cmd == "frames":
        for s in sys.argv[2:]:
            render(float(s)).save(OUT / f"preview_{s}.jpg", quality=90)
    elif cmd == "audio":
        mix()
    else:
        full_render()
