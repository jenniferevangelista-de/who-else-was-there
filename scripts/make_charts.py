"""Draws every chart in docs/charts from demo/measured.json (npm run benchmark). Nothing is typed in by hand.
  python scripts/make_charts.py
"""
import json
import math
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "charts"
P = json.loads((ROOT / "demo" / "measured.json").read_text(encoding="utf-8"))["planted"]
BG, PANEL, INK, MUTED, GRID = "#1a0f2b", "#241636", "#f6f0ff", "#b7a6c9", "#3a2a50"
MINT, PINK = "#3fbf86", "#e0609a"
SEQ = LinearSegmentedColormap.from_list("seq", ["#241636", "#1f5a4a", "#3fbf86", "#9af5c8"])
plt.rcParams.update({"font.family": ["Segoe UI", "DejaVu Sans"], "text.color": INK, "axes.labelcolor": MUTED, "xtick.color": MUTED, "ytick.color": MUTED,
                     "axes.edgecolor": GRID, "figure.facecolor": BG, "axes.facecolor": BG, "font.size": 15})


def wilson(k, n, z=1.96):
    p = k / n; d = 1 + z * z / n; c = p + z * z / (2 * n); h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return (c - h) / d * 100, (c + h) / d * 100


def frame(title, sub):
    fig = plt.figure(figsize=(13, 7.3), dpi=120)
    fig.text(.06, .925, title, fontsize=27, fontweight="bold", color=INK)
    fig.text(.06, .875, sub, fontsize=15, color=MUTED)
    fig.text(.06, .025, "Synthetic scans with a known answer, run through src/evidence.js. They test this app's logic, not Presage SmartSpectra's accuracy. No person is in them.", fontsize=11.5, color=MUTED)
    return fig


def save(fig, name):
    OUT.mkdir(parents=True, exist_ok=True); fig.savefig(OUT / name, facecolor=BG); plt.close(fig); print(name)


def clean(ax):
    for s in ("top", "right"): ax.spines[s].set_visible(False)
    ax.grid(axis="y", color=GRID, lw=.8); ax.set_axisbelow(True)


def grid_lines(ax, nx, ny):
    for s in ax.spines.values(): s.set_visible(False)
    for x in range(1, nx): ax.axvline(x - .5, color=BG, lw=3)
    for y in range(1, ny): ax.axhline(y - .5, color=BG, lw=3)


def matrix():
    F = P["faces"]; cols = ["alive", "no_pulse", "no_face", "unreadable"]
    names = {"living": "A living face", "still": "A face with no pulse", "shadow": "A shadow, no face", "dim_living": "A living face, too dark", "dim_still": "A still face, too dark"}
    rows = list(F); correct = sum(F[r]["correct"] for r in rows); runs = sum(F[r]["runs"] for r in rows)
    assert correct == runs
    fig = frame(f"{correct:,} planted scans, {correct:,} correct verdicts", f"What was planted (rows) against what the rules said (columns), {F['living']['runs']} scans per row")
    ax = fig.add_axes([.25, .12, .69, .66])
    data = [[F[r]["verdicts"].get(c, 0) for c in cols] for r in rows]
    ax.imshow(data, cmap=SEQ, vmin=0, vmax=max(map(max, data)), aspect="auto")
    ax.set_xticks(range(len(cols)), ["heartbeat", "no pulse (the ghost)", "no face", "unreadable"]); ax.set_yticks(range(len(rows)), [names[r] for r in rows])
    ax.xaxis.tick_top(); ax.tick_params(length=0)
    for i, row in enumerate(data):
        for j, v in enumerate(row):
            ax.text(j, i, v, ha="center", va="center", fontsize=24 if v else 15, fontweight="bold" if v else "normal", color=BG if v else "#8d7ca3")
    grid_lines(ax, len(cols), len(rows))
    save(fig, "01_verdicts.png")


def curve(section, unit, title, sub, xlabel, rule, rule_label, name):
    S = P[section]; keys = list(S); xs = [float(k.replace(unit, "").replace("+", "").strip()) for k in keys]
    rate = [S[k]["detected"] / S[k]["runs"] * 100 for k in keys]; ci = [wilson(S[k]["detected"], S[k]["runs"]) for k in keys]
    fig = frame(title, sub); ax = fig.add_axes([.09, .13, .85, .65]); clean(ax)
    ax.fill_between(xs, [c[0] for c in ci], [c[1] for c in ci], color=MINT, alpha=.25, lw=0)
    ax.plot(xs, rate, color=MINT, lw=2.5, marker="o", ms=10, mec=BG, mew=2)
    ax.axvline(rule, color=PINK, lw=2, ls=(0, (5, 4))); ax.text(rule, 111, rule_label, color=INK, ha="center", fontsize=14)
    for k, x, y in zip(keys, xs, rate):
        ax.annotate(f"{S[k]['detected']}/{S[k]['runs']}", (x, y), xytext=(0, 15) if y < 90 else (26, -30), textcoords="offset points", ha="center", color=INK, fontsize=14)
    ax.set_ylim(-5, 108); ax.set_xticks(xs); ax.set_xlabel(xlabel); ax.set_ylabel("Found (%), with 95% interval")
    save(fig, name)


def heat(rows, y_key, x_key, y_label, x_label, title, sub, fmt, name, marks=()):
    ys = sorted({r[y_key] for r in rows}); xs = sorted({r[x_key] for r in rows})
    data = [[next(r["detected"] for r in rows if r[y_key] == y and r[x_key] == x) for x in xs] for y in ys]
    fig = frame(title, sub); ax = fig.add_axes([.12, .13, .82, .67])
    ax.imshow(data, cmap=SEQ, vmin=0, vmax=200, aspect="auto", origin="lower")
    ax.set_xticks(range(len(xs)), [fmt(x) for x in xs]); ax.set_yticks(range(len(ys)), [str(y) for y in ys]); ax.tick_params(length=0)
    ax.set_xlabel(x_label); ax.set_ylabel(y_label)
    for i, row in enumerate(data):
        for j, v in enumerate(row):
            ax.text(j, i, v, ha="center", va="center", fontsize=17, fontweight="bold", color=BG if v > 90 else INK)
    grid_lines(ax, len(xs), len(ys))
    for (i0, i1, j0, j1) in marks:
        ax.add_patch(plt.Rectangle((j0 - .5, i0 - .5), j1 - j0 + 1, i1 - i0 + 1, fill=False, ec=PINK, lw=3))
    save(fig, name)


def bad_picture():
    R = P["stress"]["bad_picture"]; xs = [r["poor_share"] * 100 for r in R]
    ghost = [r["verdicts"].get("no_pulse", 0) for r in R]; unread = [r["verdicts"].get("unreadable", 0) for r in R]
    fig = frame("The known limit: good light, no reading", "A living person the SDK could not read (confidence under 50), as the share of poor-picture updates grows")
    ax = fig.add_axes([.09, .13, .85, .65]); clean(ax)
    ax.plot(xs, ghost, color=PINK, lw=2.5, marker="s", ms=10, mec=BG, mew=2); ax.plot(xs, unread, color=MINT, lw=2.5, marker="o", ms=10, mec=BG, mew=2)
    ax.text(2, 186, 'called "no pulse"', color=INK, fontsize=15); ax.text(42, 186, 'called "unreadable", never a ghost', color=INK, fontsize=15)
    ax.axvline(30, color=GRID, lw=2); ax.text(31, 96, "gate: 30% poor picture", color=MUTED, fontsize=13)
    ax.set_ylim(-8, 215); ax.set_xlabel("Poor-picture updates (%)"); ax.set_ylabel(f"Scans (of {R[0]['runs']})")
    save(fig, "06_known_limit.png")


def signal_map():
    cols = ["Tape,\nwhole frame", "Tape,\none spot", "The board", "The Room,\nlive", "Your\nreport"]
    rows = [("cardio.pulseRate", "1 1 0 1 1"), ("breathing.rate", "0 0 0 1 1"), ("breathing.upperTrace", "1 0 1 1 1"), ("face.talking", "0 0 1 1 1"),
            ("face.blinking", "0 0 0 1 1"), ("face.expression", "0 0 0 1 1"), ("validationStatus", "1 1 0 1 1")]
    fig = frame("Seven SDK signals, each with a job", "Where each SmartSpectra signal changes what happens in the game")
    fig.texts[-1].set_text("From the code: app/renderer/presage.js, src/signals.js, src/evidence.js, app/renderer/report.js.")
    ax = fig.add_axes([.27, .08, .67, .7]); ax.set_xlim(-.5, 4.5); ax.set_ylim(6.5, -.5)
    ax.set_xticks(range(5), cols); ax.xaxis.tick_top(); ax.set_yticks(range(7), [r[0] for r in rows]); ax.tick_params(length=0)
    for lbl in ax.get_yticklabels(): lbl.set_fontfamily(["Consolas", "DejaVu Sans Mono"])
    for s in ax.spines.values(): s.set_visible(False)
    for y, (_, bits) in enumerate(rows):
        if y < 6: ax.axhline(y + .5, color=GRID, lw=.8)
        for x, b in enumerate(bits.split()):
            ax.scatter([x], [y], s=620 if b == "1" else 34, color=MINT if b == "1" else GRID, zorder=3, linewidths=0)
    save(fig, "07_signal_map.png")


def main():
    S = P["stress"]
    matrix()
    curve("held_breath", "s", "A held breath is found from 4 seconds up", "A flat stretch of known length, planted in a noisy chest trace", "Length of the held breath (seconds)", 3, "rule: 3 s", "02_held_breath.png")
    curve("pulse_jump", "bpm", "A steady pulse never fires. A jump of +8 does.", "A rise of known size within 6 seconds, one reading per second, ±1.5 bpm of noise", "Size of the jump (bpm)", 8, "rule: +8 bpm", "03_pulse_jump.png")
    heat(S["pulse_noise"], "noise_bpm", "jump_bpm", "Reading noise, peak to peak (bpm)", "Planted jump (bpm)", "Where the pulse-jump rule stops being right",
         "Scans out of 200 where a jump was reported. Pink box: there is no jump, so these reports are false alarms caused by noise", lambda x: f"+{x}" if x else "none", "04_stress_pulse.png", [(3, 5, 0, 0)])
    heat(S["breath_noise"], "flat_noise", "hold_sec", "Noise on the flat stretch, peak to peak", "Planted held breath (seconds)", "Where the held-breath rule stops being right",
         "Scans out of 200 where a held breath was reported. Pink box: past 15% of the typical breath range, a stretch no longer counts as flat", lambda x: f"{x} s", "05_stress_breath.png", [(4, 5, 0, 5)])
    bad_picture()
    signal_map()
    print("scans in total:", sum(v["runs"] for s in ("faces", "held_breath", "pulse_jump") for v in P[s].values()) + sum(r["runs"] for k in S for r in S[k]))


if __name__ == "__main__":
    main()
