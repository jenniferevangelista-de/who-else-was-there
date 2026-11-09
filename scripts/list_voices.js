// Lists every line the crew can say in the sample case, so scripts/make_voices.py can record them.
// Static lines come from the source; lines built from evidence are computed from the sample scans.
import { readFileSync, writeFileSync } from "node:fs";
import { buildEvidence } from "../src/evidence.js";
import { answer, reading, QUESTIONS } from "../src/spirit.js";
import { sampleScans, SAMPLE_CASE } from "../src/sample.js";
import { sampleMonth } from "../src/nights.js";
import { Lx, setLang } from "../src/i18n.js";

const src = readFileSync("app/renderer/app.js", "utf8");
const plain = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const lines = new Map();
const add = (who, text) => {
  if (text.includes("${")) return;
  setLang("en"); const en = plain(text); if (en) lines.set(en, { who, lang: "en" });
  setLang("pt"); const pt = plain(Lx(text)) === en ? plain(Lx(en)) : plain(Lx(text)); setLang("en"); if (pt && pt !== en) lines.set(pt, { who, lang: "pt" });
};

for (const m of src.matchAll(/say\("(luna|bigotes|xochi)",\s*"((?:[^"\\]|\\.)*)"/g)) add(m[1], m[2]);
for (const m of src.matchAll(/data-intro="(luna|bigotes|xochi)" data-line="([^"]*)"/g)) add(m[1], m[2]);
for (const m of src.matchAll(/\w+:\s*\["(luna|bigotes|xochi)",\s*"((?:[^"\\]|\\.)*)"\]/g)) add(m[1], m[2]);

const ev = buildEvidence(sampleScans());
for (const q of [...QUESTIONS.map((x) => x.id), "return"]) { const a = answer(q, ev); add("luna", a.luna); add("bigotes", a.bigotes); }
for (const l of reading(ev)) add(l.who, l.text);

for (const n of sampleMonth()) {
  const who = n.kind === "no_pulse" ? "luna" : n.kind === "visitor" ? "bigotes" : "xochi";
  add(who, n.kind === "no_pulse" ? `${n.note} Two faces. One heartbeat. Who else was there?`
    : n.note ?? (n.kind === "empty" ? "She was out. The hallway stayed dark." : n.kind === "locked" ? "Not opened yet." : "Just Marina, coming home. One face, one pulse."));
}

const fmt = (t) => `0:${String(Math.floor(t)).padStart(2, "0")}`;
add("bigotes", `Wait. Presage just reported <b>two faces</b> in the frame. At ${fmt(SAMPLE_CASE.shadowInAt)}.`);
add("xochi", "These numbers are samples. The spirit is fiction. Marina stayed home, and that is the part that matters.");
add("xochi", "The measurements are real. The spirit is fiction. Marina stayed home, and that is the part that matters.");
add("xochi", "These numbers are samples. The spirit is fiction. What you felt is yours.");
add("xochi", "The measurements are real. The spirit is fiction. What you felt is yours.");
add("luna", "Every face in this video has a heartbeat.");
add("luna", "Except one.");
add("marina", "It was the night of November 2nd. Bag ready, keys in my hand, coat on. Everything was fine. Then I got to the door and this feeling hit me, so strong I couldn't breathe. Stay home. I took my coat off and I stayed. I live alone, and I saw nothing. But the hallway camera was on. Can you look?");
add("luna", "Do you dare?");

writeFileSync("demo/voice_lines.json", JSON.stringify([...lines].map(([text, v]) => ({ ...v, text })), null, 1));
console.log("lines:", lines.size);
