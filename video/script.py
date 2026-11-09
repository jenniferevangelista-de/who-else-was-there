"""Narration of the Ghost Hunt film and its voices (edge-tts, Ava).

Jennifer opens as herself, Wisp (the app's own small ghost) tells the case. Every number comes from
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

# key, kind (rec = the real app, live = the real app with a live camera, card = drawn), who, title, line
LINES = [
    ("cold", "rec", "wisp", "Except one", "Every face in this video has a heartbeat. Except one."),
    ("hello", "card", "jennifer", "Ghost Hunt", "Hi, I'm Jennifer Evangelista. This is Ghost Hunt: Who Else Was There? A spooky little game where the evidence is a heartbeat, read from a plain camera by Presage SmartSpectra."),
    ("crew", "rec", "wisp", "The crew", "I'm Wisp. I work with three tiny ghost hunters. Luna believes. Doctor Bigotes doubts. Xochi writes it all down."),
    ("case", "rec", "wisp", "Something told me to stay", "Marina was about to go out. Bag ready, keys in her hand, everything fine. Then, at the door, a feeling hit her so hard she couldn't breathe. Stay home. She lives alone, and she saw nothing. But the hallway camera was on."),
    ("map", "rec", "wisp", "Thirty nights", "Thirty nights of hallway tape. One face, one pulse, night after night. And something, getting closer."),
    ("tape", "rec", "wisp", "The second face", "Watch the dark stairs behind her. Second eight. The detector reports two faces in the frame. Marina never turns around."),
    ("door", "rec", "wisp", "She stopped at the door", "At the door the lamp flickers. She holds her breath for almost four seconds, and her pulse climbs. Something told her to stay."),
    ("point", "rec", "wisp", "Zero beats per minute", "The detector finds the second face by itself and locks on, right behind her. A face. Zero beats per minute. It never breathed. On this drawn tape the numbers are samples. On a real tape, the SDK reads every face."),
    ("live", "live", "wisp", "Now it reads you, live", "Now the detector reads you, live. Just a webcam. Presage SmartSpectra finds your pulse and your breathing, and the numbers on this screen are yours."),
    ("board", "rec", "wisp", "The board", "Then the spirit answers on the board. The glass only moves when you breathe out. Start talking, and it waits. Her name is Odette."),
    ("reading", "rec", "wisp", "The Guardian", "She lived in this house long ago. One night she left by that door and never came home. Now she stands there to warn whoever leaves, and Marina is the first who stopped. Luna calls her a guardian. Doctor Bigotes refuses to sign it."),
    ("end", "rec", "wisp", "Case closed", "The crew says goodbye and relaxes. Then the glass moves on its own. I am here. They are across town from Marina's house. She came with the video. Case closed."),
    ("dare", "rec", "wisp", "Do you dare?", "Do you dare? Bring a tape of your own, if everyone in it agreed. Or let the detector read you."),
    ("room", "rec", "wisp", "The Room", "In the Room, it's your heart on the table. Ask the spirit a question and stay still. If your pulse jumps right after the answer, the lights go out."),
    ("report", "rec", "wisp", "The report", "When you are done, it writes the report. Your numbers, the technology that read them, and the result: no spirit detected. This time."),
    ("tested", "rec", "wisp", "Planted ghosts", f"Doctor Bigotes insisted on testing it. {LIVING} planted living faces, and {GHOSTED} called a ghost. {R['unit_tests']} unit tests, {R['frames_saved']} frames saved, and {R['language_model_calls']} language model calls."),
    ("consent", "rec", "wisp", "The rules of the house", "The camera turns on only when you press a button. No video is recorded, and this is a game, never a medical device."),
    ("bye", "card", "jennifer", "Who else was there?", "Thank you for watching. And tell me: who else was there?"),
]


def dur(p):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                                capture_output=True, text=True, check=True).stdout)


async def main():
    vd = HERE / "voice"; vd.mkdir(exist_ok=True)
    out = []
    for key, kind, who, title, line in LINES:
        p = vd / f"{key}.mp3"
        for i in range(5):        # the TTS service drops a request now and then
            try:
                await edge_tts.Communicate(line, VOICE, **STYLE[who]).save(str(p)); break
            except Exception:     # noqa: BLE001
                if i == 4: raise
                await asyncio.sleep(3 * (i + 1))
        out.append({"id": key, "kind": kind, "who": who, "title": title, "line": line, "voice": f"voice/{key}.mp3", "dur": round(dur(p), 2)})
        print(key, who, out[-1]["dur"], "s")
    (HERE / "timeline.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    md = ["# Ghost Hunt film: script", ""] + [f"**{o['title']}** ({o['kind']}, {o['who']}, {o['dur']} s)\n\n{o['line']}\n" for o in out]
    (HERE / "SCRIPT.md").write_text("\n".join(md), encoding="utf-8")
    print("narration total", round(sum(o["dur"] for o in out), 1), "s")


if __name__ == "__main__":
    asyncio.run(main())
