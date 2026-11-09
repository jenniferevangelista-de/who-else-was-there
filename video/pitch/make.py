"""Builds the pitch film's project: voices, mix, and every scene file, with all numbers read from demo/measured.json.
  python video/pitch/make.py          -> assets/voice, assets/mix.mp3, index.html, compositions/*.html, timeline.json
Needs edge-tts, numpy, soundfile and ffmpeg. The film itself is rendered in the cloud (.github/workflows/pitch.yml).
"""
import asyncio
import json
import math
import random
import shutil
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
A = HERE / "assets"
V = A / "voice"
C = HERE / "compositions"
M = json.loads((ROOT / "demo" / "measured.json").read_text(encoding="utf-8"))
P, R = M["planted"], M["receipts"]
VOICE, RATE, SR, FPS_ENV = "en-US-AvaNeural", "-4%", 48000, 15
GAP, PRE, POST = .28, .3, .55
EXTRA = {"cite": .9, "end": 1.6, "breaks": .5}

ROWS = [("Pulse", "cardio.pulseRate", "Drives the detector"), ("Breathing", "breathing.rate", "Your breaths per minute"),
        ("Chest movement", "breathing.upperTrace", "Your exhale moves the glass"), ("Talking", "face.talking", "The glass waits while you speak"),
        ("Blinks", "face.blinking", "The figure moves when you blink"), ("Expression", "face.expression", "Becomes an evidence card"),
        ("Face checks", "validationStatus", "Finds the second face")]
TOTAL = sum(v["runs"] for s in ("faces", "held_breath", "pulse_jump") for v in P[s].values()) + sum(r["runs"] for k in P["stress"] for r in P["stress"][k])
CORRECT = sum(v["correct"] for v in P["faces"].values())
RUNS = sum(v["runs"] for v in P["faces"].values())
LIVING = P["faces"]["living"]["runs"] + P["faces"]["dim_living"]["runs"]
GHOSTED = P["faces"]["living"]["called_a_ghost"] + P["faces"]["dim_living"]["called_a_ghost"]
assert (TOTAL, CORRECT, RUNS, LIVING, GHOSTED) == (19000, 1000, 1000, 400, 0)    # the voice says these numbers

LINES = [
    ("hook", ["Every face in this video has a heartbeat.", "Except one."]),
    ("idea", ["Hi, I'm Jennifer Evangelista.", "Camera vitals usually measure the pulse that is there.", "I built a game that hunts for the pulse that is missing."]),
    ("tape", ["Three tiny ghost hunters get a hallway tape.", "Two faces in the frame.", "One pulse. And one face at zero beats per minute."]),
    ("board", ["Then you ask the spirit.", "The glass moves only when you breathe out.", "Start talking, and it waits."]),
    ("seven", ["And that is the difference: we use everything.", *[r[0] + "." for r in ROWS], "Seven signals, and every one has a job."]),
    ("live", ["And it's real.", "On a plain webcam, Presage SmartSpectra reads the numbers on this screen, live."]),
    ("cite", ["There is no language model.", "Every word the spirit says must cite a measured number, or it vanishes."]),
    ("scans", ["The computer vision belongs to Presage, so I tested my own layer.", "Nineteen thousand synthetic scans, each with a known answer.",
               "One thousand verdicts out of one thousand, correct.", "Living faces called a ghost: zero of four hundred."]),
    ("rules", ["A held breath is found from four seconds up.", "A steady pulse never fires. A jump of eight does."]),
    ("breaks", ["Then I pushed the noise until my rules broke.", "Here is exactly where.", "Because a detector you can't trust is just a ghost story."]),
    ("consent", ["The camera is yours, and consent comes first.", "No frame saved. No video recorded. SDK telemetry off.", "It's a game, never a medical device."]),
    ("end", ["Ghost Hunt.", "Who else was there?"]),
]
WISP_AT = {"hook": (70, 690, 1.25), "idea": (820, 770, 1.0), "tape": (1680, 800, .9), "board": (1680, 800, .9), "seven": (130, 780, 1.0), "live": (1680, 800, .9),
           "cite": (1640, 720, 1.1), "scans": (90, 830, .8), "rules": (1740, 60, .55), "breaks": (1610, 790, .95), "consent": (40, 820, .8), "end": (810, 300, 1.25)}


# ------------------------------------------------------------------ audio
async def voices():
    import edge_tts
    V.mkdir(parents=True, exist_ok=True)
    for sid, lines in LINES:
        for k, text in enumerate(lines):
            p = V / f"{sid}_{k}.mp3"
            if not p.exists():
                await edge_tts.Communicate(text, VOICE, rate=RATE).save(str(p))


def decode(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def t_(d): return np.arange(int(d * SR)) / SR
def tone(f, d, a, dec): tt = t_(d); return np.sin(2 * np.pi * f * tt) * np.exp(-tt * dec) * a
def sweep(f0, f1, d, a):
    tt = t_(d); ph = 2 * np.pi * (f0 * tt + (f1 - f0) * tt ** 2 / (2 * d)); return np.sin(ph) * np.sin(np.pi * tt / d) ** 2 * a


def score(n):
    """Original: a low drone, a minor music box with one wrong note and a slow heartbeat. Only sine tones, no noise."""
    t = np.arange(n) / SR; dur = n / SR
    drone = np.sin(2 * np.pi * 55 * t) + .8 * np.sin(2 * np.pi * 58.27 * t) + .4 * np.sin(2 * np.pi * 110 * t + np.sin(2 * np.pi * .09 * t))
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


def timeline():
    out, t = [], 0.0
    for sid, lines in LINES:
        st, c = [], PRE
        for k in range(len(lines)):
            x = decode(V / f"{sid}_{k}.mp3"); loud = np.nonzero(np.abs(x) > .012)[0]; d = (loud[-1] if len(loud) else len(x)) / SR     # the mp3 ends in silence
            gap = .14 if sid == "seven" and 1 <= k <= 7 else GAP
            st.append(round(c, 2)); c += d + gap
        dur = round(c - gap + POST + EXTRA.get(sid, 0), 2)
        out.append({"id": sid, "t0": round(t, 2), "dur": dur, "st": st}); t += dur
    return out, round(t, 2)


def mix(TL, D):
    n = int(D * SR) + SR; voice, fx = np.zeros(n, np.float32), np.zeros(n, np.float32)
    def put(buf, clip, at):
        i = int(at * SR); s = np.asarray(clip, np.float32)[:max(0, n - i)]; buf[i:i + len(s)] += s
    for sc, (sid, lines) in zip(TL, LINES):
        for k, at in enumerate(sc["st"]):
            put(voice, decode(V / f"{sid}_{k}.mp3"), sc["t0"] + at)
        if sc["t0"] > 0: put(fx, sweep(320, 880, .24, .14), sc["t0"] - .1)
        if sid == "hook": put(fx, sweep(880, 880, 2.2, .1), sc["st"][1] - .1)
        if sid == "seven":
            for at in sc["st"][1:8]: put(fx, tone(1250, .07, .2, 60), sc["t0"] + at)
        if sid == "scans": put(fx, tone(990, .8, .16, 5), sc["t0"] + sc["st"][2])
        if sid == "end": put(fx, tone(990, .8, .2, 5) + tone(1485, .8, .08, 6), sc["t0"] + sc["st"][1])
    a = np.abs(voice).astype(np.float64); k = int(SR * .25); c = np.concatenate([[0.0], np.cumsum(a)])
    env = (c[np.minimum(np.arange(n) + k, n)] - c[np.maximum(np.arange(n) - k, 0)]) / (2 * k) * 6
    x = np.clip(voice + score(n) * .2 * (1 - .6 * np.clip(env, 0, 1)) + fx, -1, 1)[:int(D * SR)]
    tmp = HERE / "_mix.wav"; sf.write(tmp, x, SR, subtype="PCM_16")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", str(SR), "-c:a", "libmp3lame", "-b:a", "192k", str(A / "mix.mp3")], check=True)
    tmp.unlink()
    hop = SR // FPS_ENV; e = [float(np.mean(np.abs(voice[i:i + hop]))) for i in range(0, int(D * SR), hop)]
    top = max(e) or 1
    return [round(min(1, (v / top) ** .7 * 1.15), 2) for v in e]


# ------------------------------------------------------------------ scenes
FONTS = "".join(f'@font-face{{font-family:"{fam}";src:url("assets/fonts/{f}") format("woff2");font-weight:{w};font-style:{s};}}' for fam, f, w, s in [
    ("Fredoka", "fredoka-400.woff2", 400, "normal"), ("Fredoka", "fredoka-600.woff2", 600, "normal"), ("Fredoka", "fredoka-700.woff2", 700, "normal"),
    ("Cormorant", "cormorant-600i.woff2", 600, "italic"), ("Cormorant", "cormorant-700i.woff2", 700, "italic"), ("VT323", "vt323.woff2", 400, "normal")])
BASE = "*{box-sizing:border-box}#root{position:absolute;inset:0;overflow:hidden;background:#1a0f2b;color:#f6f0ff;font-family:Fredoka,sans-serif}.a{position:absolute}.d{font-family:Cormorant,serif;font-style:italic;font-weight:600;line-height:1.02}.s{font-family:VT323,monospace}.pill{background:#f6f0ff;color:#2a1838;padding:12px 26px;border-radius:14px;font-weight:600}.src{font-size:28px;color:#b7a6c9}.full{position:absolute;left:0;top:0;width:1920px;height:1080px;object-fit:cover}"


def ft(sel, t, frm="opacity:0,y:34", to="opacity:1,y:0", d=.42, ease="power3.out", more=""):
    return f'tl.fromTo("{sel}",{{{frm}}},{{{to},duration:{d},ease:"{ease}"{more}}},{t:.2f});\n'


def out_(sel, t, d=.25): return f'tl.to("{sel}",{{opacity:0,duration:{d},ease:"power2.in"}},{t:.2f});\n'


def count(sel, t, to, d=1.4, fmt="v.toLocaleString('en-US')"):
    return f'(()=>{{const o={{v:0}},e=document.querySelector("{sel}");tl.to(o,{{v:{to},duration:{d},ease:"power2.out",onUpdate(){{const v=Math.round(o.v);e.textContent={fmt};}}}},{t:.2f});}})();\n'


def write(sc, css, body, js):
    sid, dur = sc["id"], sc["dur"]
    (C / f"{sid}.html").write_text(f'''<template>
<style>{FONTS}{BASE}{css}</style>
<div id="root" data-composition-id="{sid}" data-start="0" data-duration="{dur}" data-width="1920" data-height="1080">
{body}
</div>
<script>
const tl = gsap.timeline({{ paused: true }});
{js}tl.to({{}}, {{ duration: {dur - .05:.2f} }}, 0);
window.__timelines["{sid}"] = tl;
</script>
</template>
''', encoding="utf-8")


def ecg():
    y, x, d = 540, 60, "M0 540 L60 540"
    shape = [(18, -14), (30, 0), (44, 16), (60, -215), (76, 62), (92, 0), (122, -32), (152, 0), (190, 0)]
    for _ in range(6):
        for dx, dy in shape: d += f" L{x + dx} {y + dy}"
        x += 190
    return d, x


def seq(v):
    stops = [(0, (36, 22, 54)), (.33, (31, 90, 74)), (.66, (63, 191, 134)), (1, (154, 245, 200))]
    for (a, c0), (b, c1) in zip(stops, stops[1:]):
        if v <= b:
            k = (v - a) / (b - a); return "#%02x%02x%02x" % tuple(round(p + (q - p) * k) for p, q in zip(c0, c1))
    return "#9af5c8"


def hook(s):
    st = s["st"]; d, xe = ecg(); y = 540
    body = f'''<svg class="a" style="left:0;top:0" width="1920" height="1080" viewBox="0 0 1920 1080"><path id="hk-live" d="{d}" pathLength="1" stroke-dasharray="1" fill="none" stroke="#9af5c8" stroke-width="7" stroke-linejoin="round"/><path id="hk-flat" d="M{xe} {y} L1920 {y}" pathLength="1" stroke-dasharray="1" fill="none" stroke="#ff86b8" stroke-width="7"/></svg>
<div id="hk-a" class="a d" style="left:120px;top:90px;width:1680px;font-size:112px">Every face in this video has a heartbeat.</div>
<div id="hk-b" class="a d" style="left:1120px;top:640px;font-size:150px;color:#ff86b8">Except one.</div>
<div id="hk-z" class="a s" style="left:1200px;top:800px;font-size:210px;line-height:1;color:#ff86b8">0 BPM</div>'''
    js = ft("#hk-a", st[0]) + f'tl.fromTo("#hk-live",{{strokeDashoffset:1}},{{strokeDashoffset:0,duration:{st[1]-st[0]:.2f},ease:"none"}},{st[0]:.2f});\n'
    js += f'tl.fromTo("#hk-flat",{{strokeDashoffset:1}},{{strokeDashoffset:0,duration:.9,ease:"none"}},{st[1]:.2f});\n' + ft("#hk-b", st[1]) + ft("#hk-z", st[1] + .5, "opacity:0,scale:.8", "opacity:1,scale:1", more=',transformOrigin:"left center"')
    write(s, "", body, js)


def idea(s):
    st = s["st"]
    body = '''<div id="id-name" class="a d" style="left:120px;top:90px;font-size:92px">Jennifer Evangelista</div>
<div id="id-l" class="a" style="left:140px;top:290px;width:760px;text-align:center"><img id="id-h1" src="assets/img/heart.svg" style="width:360px;height:360px"><div style="font-size:60px;margin-top:20px">the pulse that is there</div></div>
<div id="id-r" class="a" style="left:1020px;top:290px;width:800px;text-align:center"><img id="id-h2" src="assets/img/heart-still.svg" style="width:360px;height:360px"><div class="d" style="font-size:96px;margin-top:6px;color:#ff86b8">the pulse that is missing</div></div>'''
    js = ft("#id-name", st[0]) + ft("#id-l", st[1]) + "".join(f'tl.to("#id-h1",{{scale:1.12,duration:.16,ease:"power2.out",yoyo:true,repeat:1}},{st[1] + .5 + i * .85:.2f});\n' for i in range(int((st[2] - st[1]) / .85)))
    js += f'tl.to("#id-l",{{opacity:.28,duration:.35}},{st[2]:.2f});\n' + ft("#id-r", st[2], "opacity:0,scale:.82", "opacity:1,scale:1", .5)
    write(s, "", body, js)


def vid(i, src, start, dur, media=0):
    return f'<video id="{i}" class="clip full" src="assets/clips/{src}" data-start="{start:.2f}" data-duration="{dur:.2f}" data-media-start="{media}" muted playsinline></video>'


def tape(s):
    st = s["st"]; b = st[2] - .1
    body = vid("tp-a", "tape.mp4", 0, b) + vid("tp-b", "point.mp4", b, s["dur"] - b, 4) + f'''
<div id="tp-1" class="a pill" style="left:70px;top:900px;font-size:60px">2 faces in the frame</div>
<div id="tp-2" class="a s" style="left:90px;top:760px;font-size:230px;line-height:1;color:#ff86b8;background:#1a0f2be6;padding:6px 30px;border-radius:16px">0 BPM</div>
<div id="tp-3" class="a pill" style="left:70px;top:40px;font-size:30px;background:#e8c27a">A drawn story tape, so its numbers are samples</div>'''
    js = ft("#tp-3", st[0]) + ft("#tp-1", st[1], "opacity:0,scale:.8", "opacity:1,scale:1") + out_("#tp-1", b - .05) + ft("#tp-2", st[2] + 1.2, "opacity:0,scale:.75", "opacity:1,scale:1", more=',transformOrigin:"left bottom"')
    write(s, "", body, js)


def board(s):
    st = s["st"]
    body = vid("bd-a", "board.mp4", 0, s["dur"]) + '''
<div id="bd-1" class="a pill" style="left:70px;top:900px;font-size:60px">Your exhale moves the glass</div>
<div id="bd-2" class="a pill" style="left:70px;top:900px;font-size:60px">Talk, and it waits</div>'''
    write(s, "", body, ft("#bd-1", st[1]) + out_("#bd-1", st[2] - .1) + ft("#bd-2", st[2]))


def seven(s):
    st = s["st"]; on = st[1:8]
    rows = "".join(f'<div id="sv-r{i}" class="a" style="left:640px;top:{62 + i * 136}px;width:1200px;height:120px;border-bottom:2px solid #3a2a50"><div style="font-size:52px;font-weight:600;line-height:1.1">{n}</div><div class="s" style="font-size:38px;color:#9af5c8">{f}</div><div class="a" style="right:0;top:26px;font-size:40px;color:#d8c6ea;width:640px;text-align:right">{j}</div></div>' for i, (n, f, j) in enumerate(ROWS))
    body = f'''<div id="sv-n" class="a d" style="left:120px;top:60px;font-size:640px;line-height:1;color:#9af5c8;font-variant-numeric:tabular-nums">0</div>
<div id="sv-l" class="a d" style="left:365px;top:880px;font-size:82px">signals</div>
<div id="sv-q" class="a d" style="left:690px;top:400px;font-size:150px">We use everything.</div>{rows}'''
    js = ft("#sv-n", st[0], "opacity:0", "opacity:1") + ft("#sv-q", st[0]) + out_("#sv-q", on[0] - .15) + ft("#sv-l", st[8])
    for i, at in enumerate(on):
        js += ft(f"#sv-r{i}", at, "opacity:0,x:50", "opacity:1,x:0", .3) + f'tl.call(()=>{{}},null,{at:.2f});tl.set("#sv-n",{{textContent:"{i + 1}"}},{at:.2f});\n'
    js += f'tl.fromTo("#sv-n",{{scale:1}},{{scale:1.08,duration:.22,yoyo:true,repeat:1,ease:"power2.out",color:"#ff86b8"}},{st[8]:.2f});\n'
    write(s, "", body, js)


def live(s):
    st = s["st"]
    body = vid("lv-a", "live_scope.mp4", 0, s["dur"], 2) + '<div id="lv-1" class="a pill" style="left:70px;top:900px;font-size:58px;background:#9af5c8">Live, read by the SDK from a webcam</div>'
    write(s, "", body, ft("#lv-1", st[1]))


def cite(s):
    st = s["st"]; a, b = st[1], st[1] + 1.2
    card = "position:absolute;left:150px;width:1380px;background:#fff8f0;color:#2a1838;border-radius:18px;padding:28px 42px"
    body = f'''<div id="ct-h" class="a d" style="left:150px;top:70px;font-size:120px">No language model.</div>
<div id="ct-a" style="{card};top:270px"><div class="d" style="font-size:80px">&ldquo;I stood at her door for 3.8 seconds.&rdquo;</div><div class="s" style="font-size:44px;color:#1f7a54;margin-top:8px">cites E3 &middot; held breath &middot; 3.8 s</div></div>
<div id="ct-b" style="{card};top:560px"><div class="d" style="font-size:80px">&ldquo;I have been here since 1923.&rdquo;</div><div id="ct-e" class="s" style="font-size:44px;color:#c23a6d;margin-top:8px">number 1923 is not in the cited evidence</div></div>
<div id="ct-say" class="a" style="left:1270px;top:296px;font-size:50px;font-weight:700;color:#fff;background:#1f7a54;border-radius:12px;padding:6px 24px">SAID</div>
<div id="ct-van" class="a d" style="left:620px;top:600px;font-size:150px;color:#ff86b8">vanished</div>
<div id="ct-src" class="a src" style="left:150px;top:960px">The rule is citeOrVanish() in src/evidence.js. Example lines.</div>'''
    js = ft("#ct-h", st[0]) + ft("#ct-a", a) + ft("#ct-say", a + .8, "opacity:0,scale:1.5", "opacity:1,scale:1", .25) + ft("#ct-b", b) + ft("#ct-e", b + .35, "opacity:0", "opacity:1") + ft("#ct-src", a + .4, "opacity:0", "opacity:1")
    js += f'tl.to("#ct-b",{{opacity:0,scale:.92,y:40,duration:.6,ease:"power2.in"}},{b + 2.75:.2f});\n' + ft("#ct-van", b + 3.15, "opacity:0,scale:.85", "opacity:1,scale:1")
    write(s, "", body, js)


def scans(s):
    st = s["st"]; F = P["faces"]; cols = ["alive", "no_pulse", "no_face", "unreadable"]; hd = ["heartbeat", "no pulse", "no face", "unreadable"]
    names = ["Living face", "No pulse", "Shadow", "Living, too dark", "Still, too dark"]; X, Y, W, H = 980, 190, 205, 130
    cells, heads, on = "", "", []
    for j, h in enumerate(hd): heads += f'<div class="a" style="left:{X + j * W}px;top:{Y - 56}px;width:{W}px;text-align:center;font-size:30px;color:#d8c6ea">{h}</div>'
    for i, r in enumerate(F):
        heads += f'<div class="a" style="left:{X - 300}px;top:{Y + i * H + 44}px;width:285px;text-align:right;font-size:32px;color:#d8c6ea">{names[i]}</div>'
        for j, c in enumerate(cols):
            v = F[r]["verdicts"].get(c, 0); bg = seq(v / 200); on.append(f"#sc-c{i}{j}") if v else None
            cells += f'<div id="sc-c{i}{j}" class="a" style="left:{X + j * W}px;top:{Y + i * H}px;width:{W - 6}px;height:{H - 6}px;background:{bg if v else "#241636"};border-radius:6px;text-align:center;line-height:{H - 6}px;font-size:{58 if v else 32}px;font-weight:{700 if v else 400};color:{"#1a0f2b" if v else "#8d7ca3"}">{v}</div>'
    body = f'''<div id="sc-a" class="a" style="left:170px;top:380px;width:1600px"><div style="font-size:74px;line-height:1.5"><span style="color:#9af5c8;font-weight:600">Presage:</span> the computer vision</div><div style="font-size:74px;line-height:1.5"><span style="color:#ff86b8;font-weight:600">Mine:</span> the rules, and the proof</div></div>
<div id="sc-big" class="a" style="left:0;top:270px;width:1920px;text-align:center"><div id="sc-n" style="font-size:330px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums">0</div><div style="font-size:68px;color:#d8c6ea;margin-top:22px">synthetic scans, each with a known answer</div></div>
<div id="sc-m" class="a" style="left:0;top:0;width:1920px;height:1080px">{heads}{cells}</div>
<div id="sc-l1" class="a" style="left:70px;top:230px;width:600px"><div id="sc-k" style="font-size:150px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums">0</div><div style="font-size:50px;color:#d8c6ea;margin-top:10px">out of {RUNS:,} verdicts correct</div></div>
<div id="sc-l2" class="a" style="left:70px;top:560px;width:600px"><div style="font-size:150px;font-weight:700;line-height:1;color:#9af5c8">{GHOSTED} of {LIVING}</div><div style="font-size:50px;color:#d8c6ea;margin-top:10px">living faces called a ghost</div></div>
<div id="sc-src" class="a src" style="left:300px;top:1000px;width:1500px">Synthetic scans. They test this app's logic, not Presage's accuracy. npm run benchmark</div>'''
    js = ft("#sc-a", st[0]) + out_("#sc-a", st[1] - .15) + ft("#sc-big", st[1], "opacity:0", "opacity:1", .2) + count("#sc-n", st[1] + .1, TOTAL) + out_("#sc-big", st[2] - .15)
    js += ft("#sc-m", st[2], "opacity:0", "opacity:1", .25) + ft("#sc-l1", st[2]) + count("#sc-k", st[2] + .1, CORRECT, 1.2) + ft("#sc-l2", st[3]) + ft("#sc-src", st[2], "opacity:0", "opacity:1")
    for k, sel in enumerate(on): js += ft(sel, st[2] + .35 + k * .17, "opacity:.2,scale:.7", "opacity:1,scale:1", .25, "back.out(1.6)")
    write(s, "", body, js)


def chart(prefix, x0, section, unit, rule, title, note):
    S = P[section]; keys = list(S); xs = [float(k.replace(unit, "").replace("+", "").strip()) for k in keys]; ys = [S[k]["detected"] / S[k]["runs"] * 100 for k in keys]
    L, T, W, H = x0 + 110, 300, 700, 520; lo, hi = min(xs), max(xs)
    px = lambda v: L + (v - lo) / (hi - lo) * W; py = lambda v: T + H - v / 100 * H
    grid = "".join(f'<line x1="{L}" x2="{L + W}" y1="{py(v)}" y2="{py(v)}" stroke="#3a2a50" stroke-width="2"/><text x="{L - 18}" y="{py(v) + 11}" text-anchor="end" fill="#b7a6c9" font-size="32" font-family="Fredoka">{v}%</text>' for v in (0, 50, 100))
    ticks = "".join(f'<text x="{px(x)}" y="{T + H + 50}" text-anchor="middle" fill="#b7a6c9" font-size="32" font-family="Fredoka">{int(x)}</text>' for x in xs)
    pts = " ".join(f"{px(x):.1f},{py(y):.1f}" for x, y in zip(xs, ys))
    dots = "".join(f'<circle id="{prefix}-d{i}" cx="{px(x):.1f}" cy="{py(y):.1f}" r="13" fill="#3fbf86" stroke="#1a0f2b" stroke-width="4"/>' for i, (x, y) in enumerate(zip(xs, ys)))
    html = f'''<div id="{prefix}-t" class="a d" style="left:{x0 + 40}px;top:90px;width:840px;font-size:80px">{title}</div>
<svg id="{prefix}-s" class="a" style="left:0;top:0" width="1920" height="1080">{grid}{ticks}<line id="{prefix}-rl" x1="{px(rule)}" x2="{px(rule)}" y1="{T - 18}" y2="{T + H}" stroke="#ff86b8" stroke-width="4" stroke-dasharray="14 10"/><polyline id="{prefix}-p" points="{pts}" pathLength="1" stroke-dasharray="1" fill="none" stroke="#3fbf86" stroke-width="7" stroke-linejoin="round"/>{dots}</svg>
<div id="{prefix}-n" class="a" style="left:{x0 + 110}px;top:{T + H + 70}px;width:840px;font-size:32px;color:#d8c6ea">{note}</div>'''
    return html, len(xs)


def rules(s):
    st = s["st"]; hb, n1 = chart("c1", 40, "held_breath", "s", 3, "Held breath", "Seconds held. Rule at 3 s (dashed). 4 s found 200 of 200")
    pj, n2 = chart("c2", 990, "pulse_jump", "bpm", 8, "Pulse jump", "Bpm added. Rule at +8 (dashed). None: 0 of 200 false alarms")
    def anim(p, n, t):
        j = ft(f"#{p}-t", t) + ft(f"#{p}-s", t + .1, "opacity:0", "opacity:1", .25) + ft(f"#{p}-n", t + .9, "opacity:0", "opacity:1")
        j += f'tl.fromTo("#{p}-p",{{strokeDashoffset:1}},{{strokeDashoffset:0,duration:1.4,ease:"power1.inOut"}},{t + .3:.2f});\n'
        for i in range(n): j += ft(f"#{p}-d{i}", t + .3 + i * .28, "opacity:0", "opacity:1", .12)
        return j
    write(s, "", hb + pj + f'<div id="ru-src" class="a src" style="left:150px;top:1020px">Synthetic scans with known answers, 200 per point.</div>', anim("c1", n1, st[0]) + anim("c2", n2, st[1]) + ft("#ru-src", st[0], "opacity:0", "opacity:1"))


def breaks(s):
    st = s["st"]; rows = P["stress"]["pulse_noise"]; ys = sorted({r["noise_bpm"] for r in rows}, reverse=True); xs = sorted({r["jump_bpm"] for r in rows})
    X, Y, W, H = 270, 150, 175, 118; cells = ""; order = []
    data = {(r["noise_bpm"], r["jump_bpm"]): r["detected"] for r in rows}
    for i, y in enumerate(ys):
        cells += f'<div class="a s" style="left:{X - 90}px;top:{Y + i * H + 34}px;width:70px;text-align:right;font-size:46px;color:#d8c6ea">{y}</div>'
        for j, x in enumerate(xs):
            v = data[y, x]; order.append(f"#br-{i}{j}")
            cells += f'<div id="br-{i}{j}" class="a" style="left:{X + j * W}px;top:{Y + i * H}px;width:{W - 6}px;height:{H - 6}px;background:{seq(v / 200)};border-radius:6px;text-align:center;line-height:{H - 6}px;font-size:44px;font-weight:700;color:{"#1a0f2b" if v > 90 else "#f6f0ff"}">{v}</div>'
    for j, x in enumerate(xs): cells += f'<div class="a s" style="left:{X + j * W}px;top:{Y + 6 * H + 4}px;width:{W}px;text-align:center;font-size:46px;color:#d8c6ea">{"none" if not x else "+" + str(x)}</div>'
    false9 = data[9, 0]
    body = f'''<div id="br-t" class="a d" style="left:120px;top:30px;font-size:96px">Where my pulse-jump rule breaks</div>
<div id="br-g" class="a" style="left:0;top:0;width:1920px;height:1080px">{cells}</div>
<div class="a" id="br-y" style="left:30px;top:150px;width:140px;font-size:32px;color:#b7a6c9">noise (bpm)</div>
<div class="a" id="br-x" style="left:{X}px;top:{Y + 6 * H + 64}px;font-size:32px;color:#b7a6c9">planted jump (bpm)</div>
<div id="br-box" class="a" style="left:{X - 7}px;top:{Y - 7}px;width:{W + 8}px;height:{3 * H + 8}px;border:7px solid #ff86b8;border-radius:10px"></div>
<div id="br-1" class="a" style="left:1370px;top:180px;width:480px"><div class="s" style="font-size:150px;line-height:.9;color:#ff86b8">{false9}/200</div><div style="font-size:44px;line-height:1.2;margin-top:12px">false alarms at 9 bpm of noise, with no jump at all</div></div>
<div id="br-2" class="a d" style="left:1370px;top:555px;width:500px;font-size:62px">A detector you can't trust is just a ghost story.</div>'''
    js = ft("#br-t", st[0]) + ft("#br-y", st[0], "opacity:0", "opacity:1") + ft("#br-x", st[0], "opacity:0", "opacity:1")
    for k, sel in enumerate(order): js += ft(sel, st[0] + .2 + k * .06, "opacity:0,scale:.8", "opacity:1,scale:1", .2)
    js += ft("#br-box", st[1], "opacity:0,scale:1.15", "opacity:1,scale:1", .3) + ft("#br-1", st[1] + .3) + ft("#br-2", st[2])
    write(s, "", body, js)


def consent(s):
    st = s["st"]
    rows = [("0", "frames saved"), ("0", "videos recorded"), ("OFF", "SDK telemetry"), ("0", "language model calls"), (str(R["unit_tests"]), "unit tests")]
    assert R["frames_saved"] == 0 and R["video_recorded"] is False and R["sdk_telemetry"] == "off" and R["language_model_calls"] == 0
    list_ = "".join(f'<div id="cn-r{i}" class="a" style="left:1090px;top:{130 + i * 132}px;width:760px;height:118px;border-bottom:2px solid #3a2a50"><span class="s" style="display:inline-block;width:230px;font-size:120px;line-height:1;color:#9af5c8">{n}</span><span style="font-size:52px">{t}</span></div>' for i, (n, t) in enumerate(rows))
    body = f'''<img id="cn-i" class="a" src="assets/img/consent.jpg" style="left:70px;top:150px;width:980px;height:551px;object-fit:cover;object-position:left center;border-radius:16px">
<div id="cn-t" class="a d" style="left:70px;top:44px;font-size:90px">The camera is yours</div>{list_}
<div id="cn-g" class="a d" style="left:330px;top:860px;font-size:110px;color:#ff86b8">A game, never a medical device.</div>'''
    js = ft("#cn-t", st[0]) + ft("#cn-i", st[0] + .15)
    for i in range(5): js += ft(f"#cn-r{i}", st[1] + i * .6, "opacity:0,x:40", "opacity:1,x:0", .3)
    js += ft("#cn-g", st[2])
    write(s, "", body, js)


def end(s):
    st = s["st"]
    body = '''<div id="en-a" class="a" style="left:0;top:40px;width:1920px;text-align:center;font-size:210px;line-height:1;color:#ff86b8;font-weight:700">Ghost Hunt</div>
<div id="en-b" class="a d" style="left:0;top:760px;width:1920px;text-align:center;font-size:150px">Who Else Was There?</div>
<div id="en-c" class="a" style="left:0;top:950px;width:1920px;text-align:center;font-size:44px;color:#d8c6ea">Jennifer Evangelista &middot; built on Presage SmartSpectra</div>'''
    write(s, "", body, ft("#en-a", st[0], "opacity:0,scale:.9", "opacity:1,scale:1", .5) + ft("#en-b", st[1]) + ft("#en-c", st[1] + .5, "opacity:0", "opacity:1"))


WISP = '''<svg id="wisp" viewBox="0 0 120 140" width="240" height="280" style="position:absolute;left:0;top:0;z-index:50;overflow:visible" data-layout-ignore>
<path d="M60 6C30 6 12 30 12 62v58c0 6 6 9 11 5l9-8 9 9c3 3 7 3 10 0l9-9 9 9c3 3 7 3 10 0l9-9 9 8c5 4 11 1 11-5V62C108 30 90 6 60 6z" fill="#f6f0ff" stroke="#2a1840" stroke-width="6" stroke-linejoin="round"/>
<ellipse id="eye1" cx="44" cy="58" rx="9" ry="12" fill="#2a1840"/><ellipse id="eye2" cx="76" cy="58" rx="9" ry="12" fill="#2a1840"/>
<circle id="sh1" cx="41" cy="53" r="3.5" fill="#fff"/><circle id="sh2" cx="73" cy="53" r="3.5" fill="#fff"/>
<ellipse cx="33" cy="74" rx="7" ry="4" fill="#ff9ec7" opacity=".7"/><ellipse cx="87" cy="74" rx="7" ry="4" fill="#ff9ec7" opacity=".7"/>
<path id="smile" d="M52 76q8 7 16 0" fill="none" stroke="#2a1840" stroke-width="4" stroke-linecap="round"/>
<ellipse id="mouth" cx="60" cy="77" rx="6" ry="1" fill="#782850" stroke="#2a1840" stroke-width="3" opacity="0"/>
<path d="M60 112l-14-13c-6-6-2-15 6-15 4 0 7 3 8 5 1-2 4-5 8-5 8 0 12 9 6 15z" fill="#8f8aa0" stroke="#2a1840" stroke-width="4" stroke-linejoin="round"/>
<path d="M52 92l5 5-4 4 6 5" fill="none" stroke="#2a1840" stroke-width="2.5" stroke-linecap="round"/></svg>'''


def index(TL, D, env):
    hosts = "\n".join(f'<div id="{s["id"]}" data-composition-id="{s["id"]}" data-composition-src="compositions/{s["id"]}.html" data-start="{s["t0"]}" data-duration="{s["dur"]}" data-track-index="1" data-track-kind="graphics" data-width="1920" data-height="1080" style="position:absolute;inset:0;z-index:1"></div>' for s in TL)
    moves = "".join(f'tl.set("#wisp",{{x:{WISP_AT[s["id"]][0]},y:{WISP_AT[s["id"]][1]},scale:{WISP_AT[s["id"]][2]},transformOrigin:"0 0"}},{s["t0"]});\n' for s in TL)
    html = f'''<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=1920, height=1080"/>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<style>*{{margin:0;padding:0;box-sizing:border-box}}html,body{{width:1920px;height:1080px;overflow:hidden;background:#1a0f2b}}#root{{position:relative;width:100%;height:100%}}</style></head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{D}" data-width="1920" data-height="1080">
{hosts}
{WISP}
<audio id="mix" src="assets/mix.mp3" data-start="0" data-duration="{D}" data-track-index="9" data-volume="1"></audio>
</div>
<script>
window.__timelines = window.__timelines || {{}};
const ENV = {json.dumps(env, separators=(",", ":"))};
const tl = gsap.timeline({{ paused: true }});
{moves}const P = {{ t: 0 }};
const set = (id, k, v) => document.getElementById(id).setAttribute(k, v);
tl.to(P, {{ t: {D}, duration: {D}, ease: "none", onUpdate() {{
  const m = ENV[Math.min(ENV.length - 1, Math.floor(P.t * {FPS_ENV}))] || 0, open = m > .08;
  set("mouth", "opacity", open ? 1 : 0); set("smile", "opacity", open ? 0 : 1);
  set("mouth", "rx", 5 + 3 * m); set("mouth", "ry", 1.2 + 6 * m);
  const blink = (P.t * .37) % 1 > .96;
  for (const e of ["eye1", "eye2"]) set(e, "ry", blink ? 1.5 : 12);
  for (const e of ["sh1", "sh2"]) set(e, "opacity", blink ? 0 : 1);
}} }}, 0);
window.__timelines["main"] = tl;
</script>
</body>
</html>
'''
    (HERE / "index.html").write_text(html, encoding="utf-8")


def assets():
    for d in ("fonts", "img", "clips"): (A / d).mkdir(parents=True, exist_ok=True)
    fs = ROOT / "node_modules" / "@fontsource"
    for src, dst in [("fredoka/files/fredoka-latin-400-normal.woff2", "fredoka-400.woff2"), ("fredoka/files/fredoka-latin-600-normal.woff2", "fredoka-600.woff2"), ("fredoka/files/fredoka-latin-700-normal.woff2", "fredoka-700.woff2"),
                     ("cormorant-garamond/files/cormorant-garamond-latin-600-italic.woff2", "cormorant-600i.woff2"), ("cormorant-garamond/files/cormorant-garamond-latin-700-italic.woff2", "cormorant-700i.woff2"), ("vt323/files/vt323-latin-400-normal.woff2", "vt323.woff2")]:
        shutil.copy(fs / src, A / "fonts" / dst)
    for f in ("heart.svg", "heart-still.svg"): shutil.copy(ROOT / "app" / "renderer" / "img" / f, A / "img" / f)
    shutil.copy(ROOT / "docs" / "screens" / "consent.jpg", A / "img" / "consent.jpg")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(ROOT / "video" / "recordings" / "live.mp4"), "-vf", "crop=704:396:608:16,scale=1920:1080:flags=lanczos,fps=30",   # only the detector panel
                    "-an", "-c:v", "libx264", "-crf", "20", "-preset", "veryfast", "-pix_fmt", "yuv420p", str(A / "clips" / "live_scope.mp4")], check=True)


def main():
    C.mkdir(exist_ok=True); assets(); asyncio.run(voices())
    TL, D = timeline(); env = mix(TL, D)
    (HERE / "timeline.json").write_text(json.dumps(TL, indent=1), encoding="utf-8")
    for s in TL: globals()[s["id"]](s)
    index(TL, D, env)
    print("film", D, "s", [(s["id"], s["dur"]) for s in TL])


if __name__ == "__main__":
    main()
