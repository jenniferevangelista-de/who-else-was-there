"""Narration of the Ghost Hunt film and its voices (edge-tts, Ava).

Wisp (the app's own small ghost) opens over the live Presage reading and tells one case; Jennifer names the game and closes. Every number comes from
demo/measured.json or from the app's labelled sample case.
  python video/script.py   -> video/voice/*.mp3, video/timeline.json, video/SCRIPT.md
"""
import asyncio
import json
import subprocess
from pathlib import Path

import edge_tts

HERE = Path(__file__).resolve().parent
M = json.loads((HERE.parent / "demo" / "measured.json").read_text(encoding="utf-8"))
P, R = M["planted"], M["receipts"]
LIVING = P["faces"]["living"]["runs"] + P["faces"]["dim_living"]["runs"]
GHOSTED = P["faces"]["living"]["called_a_ghost"] + P["faces"]["dim_living"]["called_a_ghost"]

VOICE = "en-US-AvaNeural"
STYLE = {"jennifer": dict(rate="-4%", pitch="+0Hz"), "wisp": dict(rate="+4%", pitch="+16Hz")}

# key, kind (rec = the real app, live = the real app with a live camera, card = drawn), who, title, line, extras
# extras: "clip" = the window of recordings/live.mp4 a live scene plays, "scene" = the tour scene a rec line plays over
URL = "jenniferevangelista-de.github.io/who-else-was-there"
LINES = [
    ("cold", "live", "wisp", "Read live, right now", "This is a heartbeat, read live from a plain webcam by Presage SmartSpectra. Every face has one. Except one.", {"clip": [0.0, 9.0]}),
    ("hello", "card", "jennifer", "Ghost Hunt", "I'm Jennifer Evangelista. This is Ghost Hunt."),
    ("crew", "rec", "wisp", "The crew", "I'm Wisp. I work with three tiny ghost hunters. Luna believes. Doctor Bigotes doubts. Xochi writes it all down."),
    ("case", "rec", "wisp", "Something told her to stay", "Marina was about to go out, keys in her hand. At the door, a feeling hit her so hard she couldn't breathe. Stay home. She lives alone, and she saw nothing. But the hallway camera was on."),
    ("tape", "rec", "wisp", "The second face", "Watch the dark stairs behind her. Second eight. The detector reports two faces in the frame. Marina never turns around."),
    ("door", "rec", "wisp", "She stopped at the door", "At the door the lamp flickers. She holds her breath for almost four seconds, and her pulse climbs."),
    ("point", "rec", "wisp", "Zero beats per minute", "The detector finds the second face by itself and locks on, right behind her. A face. Zero beats per minute. It never breathed. This tape is drawn, so its numbers are samples. On a real tape, the SDK reads every face."),
    ("board", "rec", "wisp", "The board", "Then the spirit answers on the board. The glass only moves when you breathe out. Start talking, and it waits. Her name is Odette."),
    ("reading", "rec", "wisp", "The Guardian", "She left by that door long ago and never came home. Now she warns whoever leaves, and Marina is the first who stopped. Luna calls her a guardian. Doctor Bigotes refuses to sign it."),
    ("end", "rec", "wisp", "Case closed", "The crew says goodbye. Then the glass moves on its own. I am here. Case closed."),
    ("room", "live", "wisp", "The Room, live", "Now it's your turn. In the Room, Presage SmartSpectra reads your pulse and your breathing live from the webcam, and the numbers on screen are yours.", {"clip": [4.0, 14.5]}),
    ("upload", "rec", "wisp", "Bring your own video", "Or bring a video of your own. The button stays locked until you confirm that everyone in it agreed."),
    ("report", "rec", "wisp", "The report", "Camera or video, it ends the same way: the report. The numbers, the technology that read them, and the result: no spirit detected. This time."),
    ("tested", "rec", "wisp", "Cite or vanish", f"One rule keeps it honest: cite or vanish. Every line the spirit says must cite a measured number, and an unreadable face is never a ghost. Doctor Bigotes tested it: a living face was called a ghost {GHOSTED} times in {LIVING}."),
    ("consent", "rec", "wisp", "The rules of the house", "The camera turns on only when you press a button. No video is recorded, and this is a game, never a medical device."),
    ("bye", "card", "jennifer", "Play it now", "Ghost Hunt: Who Else Was There? A heartbeat is the evidence. Play it now in your browser, at the link on screen."),
]


def dur(p):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                                capture_output=True, text=True, check=True).stdout)


async def main():
    vd = HERE / "voice"; vd.mkdir(exist_ok=True)
    out = []
    for key, kind, who, title, line, *extra in LINES:
        p = vd / f"{key}.mp3"
        for i in range(5):        # the TTS service drops a request now and then
            try:
                await edge_tts.Communicate(line, VOICE, **STYLE[who]).save(str(p)); break
            except Exception:     # noqa: BLE001
                if i == 4: raise
                await asyncio.sleep(3 * (i + 1))
        out.append({"id": key, "kind": kind, "who": who, "title": title, "line": line, "voice": f"voice/{key}.mp3", "dur": round(dur(p), 2), **(extra[0] if extra else {})})
        print(key, who, out[-1]["dur"], "s")
    (HERE / "timeline.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    md = ["# Ghost Hunt film: script", ""] + [f"**{o['title']}** ({o['kind']}, {o['who']}, {o['dur']} s)\n\n{o['line']}\n" for o in out]
    (HERE / "SCRIPT.md").write_text("\n".join(md), encoding="utf-8")
    print("narration total", round(sum(o["dur"] for o in out), 1), "s")


if __name__ == "__main__":
    asyncio.run(main())
