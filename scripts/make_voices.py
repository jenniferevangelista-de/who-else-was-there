"""Records the crew's lines (edge-tts) into app/renderer/audio and writes app/renderer/voices.json.
Run `node scripts/list_voices.js` first. Lines already recorded are kept.
Voices: Luna = Ava, Dr. Bigotes = Ryan, Xochi = Emma (the same as the Witching Hour films); Marina = Aria.
"""
import asyncio
import hashlib
import json
import re
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / "app" / "renderer" / "audio"
VOICE = {"en": {"luna": ("en-US-AvaNeural", 0), "bigotes": ("en-GB-RyanNeural", 0), "xochi": ("en-US-EmmaNeural", 10), "marina": ("en-US-AriaNeural", -4)},
         "pt": {"luna": ("pt-BR-FranciscaNeural", -2), "bigotes": ("pt-BR-AntonioNeural", 0), "xochi": ("pt-BR-FranciscaNeural", 24), "marina": ("pt-BR-FranciscaNeural", -12)}}
SCARED = re.compile(r"RUN|CORRE|EVERYBODY OUT|TODO MUNDO|Wait|Espera|before you go|antes de ir|no explanation|Não tenho explicação|That was not|Except one|Menos um")
MOCKING = re.compile(r"Ghosts don|Fantasma não|ordinary|Comum|a bad feeling|mau pressentimento|A tired|boring|sign|assino|I believe in data|acredito em dados")


def delivery(who, text):
    """Rate and pitch offsets for how the line is meant: frightened, mocking, hushed, trembling or bright."""
    if SCARED.search(text): return 16, 26
    if who == "bigotes": return (-12, -8) if MOCKING.search(text) else (-6, -2)
    if who == "marina": return -12, 6
    if who == "luna": return -14, -2
    return 4, 0


async def main():
    AUDIO.mkdir(exist_ok=True)
    lines = json.loads((ROOT / "demo" / "voice_lines.json").read_text(encoding="utf-8"))
    table, made = {}, 0
    for ln in lines:
        lang = ln.get("lang", "en")
        vid = hashlib.sha1(f"{ln['who']}|{ln['text']}".encode()).hexdigest()[:10]
        voice, base = VOICE[lang][ln["who"]]
        rate, shift = delivery(ln["who"], ln["text"])
        p = AUDIO / f"{vid}.mp3"
        if not p.exists():
            for i in range(5):
                try:
                    await edge_tts.Communicate(ln["text"], voice, rate=f"{rate:+d}%", pitch=f"{base + shift:+d}Hz").save(str(p)); made += 1; break
                except Exception:      # noqa: BLE001
                    if i == 4: raise
                    await asyncio.sleep(3 * (i + 1))
        table[ln["text"]] = {"id": vid, "who": ln["who"]}
    (ROOT / "app" / "renderer" / "voices.json").write_text(json.dumps(table, ensure_ascii=False, indent=0), encoding="utf-8")
    print("lines", len(table), "new", made)


asyncio.run(main())
