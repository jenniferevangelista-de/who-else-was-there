"""Records the crew's lines (edge-tts) into app/renderer/audio and writes app/renderer/voices.json.
Run `node scripts/list_voices.js` first. Lines already recorded are kept.
Voices: Luna = Ava, Dr. Bigotes = Ryan, Xochi = Emma (the same as the Witching Hour films); Marina = Aria.
"""
import asyncio
import hashlib
import json
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / "app" / "renderer" / "audio"
VOICE = {"luna": "en-US-AvaMultilingualNeural", "bigotes": "en-GB-RyanNeural", "xochi": "en-US-EmmaMultilingualNeural", "marina": "en-US-AriaNeural"}


async def main():
    AUDIO.mkdir(exist_ok=True)
    lines = json.loads((ROOT / "demo" / "voice_lines.json").read_text(encoding="utf-8"))
    table, made = {}, 0
    for ln in lines:
        vid = hashlib.sha1(f"{ln['who']}|{ln['text']}".encode()).hexdigest()[:10]
        p = AUDIO / f"{vid}.mp3"
        if not p.exists():
            for i in range(5):
                try:
                    await edge_tts.Communicate(ln["text"], VOICE[ln["who"]], rate="-4%").save(str(p)); made += 1; break
                except Exception:      # noqa: BLE001
                    if i == 4: raise
                    await asyncio.sleep(3 * (i + 1))
        table[ln["text"]] = {"id": vid, "who": ln["who"]}
    (ROOT / "app" / "renderer" / "voices.json").write_text(json.dumps(table, ensure_ascii=False, indent=0), encoding="utf-8")
    print("lines", len(table), "new", made)


asyncio.run(main())
