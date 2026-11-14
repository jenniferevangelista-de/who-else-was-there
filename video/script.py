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
STYLE = {"jennifer": dict(rate="+4%", pitch="+0Hz"), "wisp": dict(rate="+12%", pitch="+16Hz")}   # a brisk pace: the whole film stays under three minutes

# key, kind (rec = the real app, live = the real app with a live camera, card = drawn), who, title, line, extras
# extras: "clip" = the window of recordings/live.mp4 a live scene plays, "scene" = the tour scene a rec line plays over
URL = "jenniferevangelista-de.github.io/who-else-was-there"
LINES = [
    ("cold", "live", "wisp", "Read live, right now", "This is a heartbeat, read live from a plain webcam by Presage SmartSpectra. Every face has one. Except one.", {"clip": [0.0, 9.0]}),
    ("hello", "card", "jennifer", "Ghost Hunt", "I'm Jennifer Evangelista. This is Ghost Hunt."),
    ("crew", "rec", "wisp", "The crew", "I'm Wisp. Three tiny ghost hunters work this case. Luna believes. Doctor Bigotes doubts. Xochi writes it all down."),
    ("case", "rec", "wisp", "Something told her to stay", "Marina had her keys in her hand and a car waiting. At the door it felt like a hand on her shoulder. Stay home. When she was nine, her mother went out by that same door and never came back. So she stayed. Twenty minutes later, that car crashed."),
    ("tape", "rec", "wisp", "The second face", "Her hallway camera was on. Second eight, on the dark stairs behind her: the detector reports two faces. Marina never turns around."),
    ("door", "rec", "wisp", "She stopped at the door", "At the door she holds her breath for almost four seconds, and her pulse climbs."),
    ("point", "rec", "wisp", "Zero beats per minute", "The detector locks on the second face. Zero beats per minute. This tape is drawn, so its numbers are samples. On a real video, the SDK reads every face."),
    ("board", "rec", "wisp", "The board", "Then you ask the spirit. The glass only moves when you breathe out. Start talking, and it waits. Her name is Odette."),
    ("reading", "rec", "wisp", "A mother at the door", "Odette is Marina's mother. She could not save herself on that road. So she stood at that door, and saved her little girl. Luna calls her a guardian. Doctor Bigotes refuses to sign it."),
    ("end", "rec", "wisp", "Goodbye", "The crew says goodbye, and Odette goes back to her daughter's door. Then the glass moves on its own."),
    ("scare", "rec", "wisp", "I am here", "I am here. That is not Odette. It is what she was holding back."),
    ("room", "live", "wisp", "The Room, live", "Now it's your turn. In the Room, Presage SmartSpectra reads your pulse and your breathing live from the webcam. The numbers on screen are yours.", {"clip": [4.0, 14.5]}),
    ("upload", "rec", "wisp", "Bring your own video", "Or bring a video of your own. The button stays locked until you confirm that everyone in it agreed."),
    ("report", "rec", "wisp", "The report", "Camera or video, it ends with a report: the numbers, the technology that read them, and a verdict. No spirit detected. This time."),
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
