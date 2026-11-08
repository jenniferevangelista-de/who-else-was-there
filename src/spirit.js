// The spirit's answers and the crew's readings. Templates, no language model: every line is built
// from evidence that exists, and must pass cite-or-vanish before anyone reads it.
// The spirit is fiction. The measurements it points at are not.

import { citeOrVanish } from "./evidence.js";

const find = (ev, kind) => ev.find((e) => e.kind === kind);
const sec = (x) => Math.round(x);

export const QUESTIONS = [
  { id: "who", text: "Who are you?" },
  { id: "alive", text: "Are you alive?" },
  { id: "why", text: "Why did she stop at the door?" },
  { id: "where", text: "Where are you now?" },
  { id: "bye", text: "Goodbye." },
];

/** One answer: what the glass spells, what Luna says, what Bigotes checks, and what it cites. */
export function answer(qid, ev) {
  const face2 = find(ev, "second_face"), still = find(ev, "no_pulse"), held = find(ev, "held_breath");
  const jump = find(ev, "pulse_jump"), shadow = find(ev, "only_shadow");
  const pick = {
    who: face2 && {
      board: "BEHIND HER", cites: [face2.id],
      luna: `It says it stood behind her. Presage counted a second face from second ${sec(face2.t0)}, and she never turned around.`,
      bigotes: `Two faces in the frame is what the SDK reported. It does not say whose. A reflection counts too.`,
    },
    alive: still ? {
      board: "NO", cites: [still.id],
      luna: `No. That face gave 0 beats while the scope watched it. Nothing alive holds that still.`,
      bigotes: `A face with no pulse is a photo, a mask or a screen. Ordinary. I just cannot tell you who put it there.`,
    } : shadow && {
      board: "NO FACE", cites: [shadow.id],
      luna: `It has no face to show us. Only a shape.`,
      bigotes: `The SDK found no face in that spot. A coat, a curtain, a shadow.`,
    },
    why: (held || jump) && {
      board: "DONT GO", cites: [held?.id, jump?.id].filter(Boolean),
      luna: held ? `She held her breath at second ${sec(held.t0)}. She felt it, she never saw it. It was telling her: don't go.` : `Her pulse jumped. That is when it reached her.`,
      bigotes: jump ? `Her pulse rose ${Math.round(jump.value)} bpm in a few seconds. A startle does that. So does a flickering lamp. A bad feeling is not a ghost.` : `Holding your breath is what people do when they listen.`,
    },
    where: face2 && {
      board: "STILL INSIDE", cites: [face2.id],
      luna: `The second face left the frame at second ${sec(face2.t1)}. The glass says it did not leave the house.`,
      bigotes: `The SDK stopped counting a second face at second ${sec(face2.t1)}. People walk out of frame. That is all I can sign.`,
    },
    bye: { board: "GOODBYE", cites: ev.slice(0, 1).map((e) => e.id), luna: `It said goodbye.`, bigotes: `Session closed.` },
    // Luna's last question, asked on her own after GOODBYE. The glass moves without waiting for a breath.
    return: (still || face2) && {
      board: "I AM HERE", cites: [(still || face2).id],
      luna: `It never left. It is still in the hallway, right where she cannot see it.`,
      bigotes: `Okay. I have no explanation for that. Yet.`,
    },
  }[qid];
  if (!pick) return { board: "NO", cites: [], luna: "The glass will not move.", bigotes: "Nothing measured to answer with.", vanished: true };
  for (const text of [pick.luna, pick.bigotes]) {
    const why = citeOrVanish({ text, cites: pick.cites }, ev);
    if (why) return { board: "NO", cites: [], luna: "The glass will not move.", bigotes: `Line dropped: ${why}.`, vanished: true };
  }
  return pick;
}

/** The crew's reading of the whole case, every sentence citing evidence. */
export function reading(ev) {
  const face2 = find(ev, "second_face"), still = find(ev, "no_pulse"), held = find(ev, "held_breath"), jump = find(ev, "pulse_jump"), live = find(ev, "living");
  const lines = [];
  if (live) lines.push({ who: "xochi", text: `One living face from start to end, with a pulse around ${Math.round(live.value)} bpm.`, cites: [live.id] });
  if (face2) lines.push({ who: "luna", text: `At second ${sec(face2.t0)} something else had a face in that hallway, for ${Math.round(face2.value)} seconds.`, cites: [face2.id] });
  if (still) lines.push({ who: "bigotes", text: `I pointed the scope at it for ${Math.round(still.t1 - still.t0)} seconds. 0 beats per minute. A living face in good light shows a pulse; this one showed none.`, cites: [still.id] });
  if (held) lines.push({ who: "luna", text: `She stopped at the door and held her breath for ${held.value} seconds.`, cites: [held.id] });
  if (jump) lines.push({ who: "bigotes", text: `Then her pulse rose ${jump.value} bpm. A startle, most likely.`, cites: [jump.id] });
  // Luna reads what the spirit meant, Bigotes refuses to. The case never settles it.
  if (still && held) {
    lines.push({ who: "luna", text: `Here is what I think it meant. It stood behind her and she stayed home. It was not hunting her. It was keeping her in.`, cites: [still.id, held.id] });
    lines.push({ who: "bigotes", text: `Or a dark hallway and a bad feeling. I measured a face with no pulse. I did not measure a ghost.`, cites: [still.id] });
  }
  return lines.filter((l) => !citeOrVanish(l, ev));
}

export const SPIRIT_KINDS = ["The Guardian", "The Haunter", "The Watcher", "The Intruder", "The Shade", "The Veiled", "The Visitor"];

/** Who answers: a fictional spirit chosen from the evidence, like a case file card. */
export function spiritFor(ev) {
  const still = find(ev, "no_pulse"), held = find(ev, "held_breath"), face2 = find(ev, "second_face");
  const jump = find(ev, "pulse_jump"), shade = find(ev, "only_shadow"), veiled = find(ev, "unreadable"), alive = find(ev, "region_alive");
  if (still && held) return { archetype: "The Guardian", name: "Odette", story: "The shape at the foot of the stairs. She has stood in this hallway for a long time.", goal: "to keep whoever lives here inside tonight", cites: [still.id, held.id] };
  if (still && jump) return { archetype: "The Haunter", name: "Silas", story: "A still face, and a living pulse that jumped beside it.", goal: "to be felt", cites: [still.id, jump.id] };
  if (still) return { archetype: "The Watcher", name: "Odette", story: "A face on the wall that never blinks.", goal: "to be noticed", cites: [still.id] };
  if (alive) return { archetype: "The Intruder", name: "Someone", story: "Not a spirit at all. Someone alive, in the corner of the frame.", goal: "unknown", cites: [alive.id] };
  if (shade) return { archetype: "The Shade", name: "Ash", story: "A shape in the frame, with no face to read.", goal: "to stay unseen", cites: [shade.id] };
  if (veiled) return { archetype: "The Veiled", name: "Vesper", story: "Something too dark for the scope to read.", goal: "to stay unread", cites: [veiled.id] };
  if (face2) return { archetype: "The Visitor", name: "Nobody", story: "A second face the scope could not place.", goal: "unknown", cites: [face2.id] };
  return null;
}

/** Free text from the investigator, matched to a question the spirit can answer. */
export function matchQuestion(text) {
  const t = String(text).toLowerCase();
  const rules = [
    ["bye", /\b(bye|goodbye|leave|adeus|tchau)\b/],
    ["alive", /\b(alive|dead|breath|breathe|heart|pulse|vivo|viva|morto|morta|coração|respira)/],
    ["where", /\b(where|now|still|shadow|onde|agora|vulto|sombra)\b/],
    ["why", /\b(why|stop|stopped|door|stay|warn|por ?que|porta|ficar|parou)\b/],
    ["who", /\b(who|name|you|quem|nome)\b/],
  ];
  for (const [id, re] of rules) if (re.test(t)) return id;
  return null;
}

/** The Room: the investigator's own live readings become evidence too. */
export function roomEvidence({ pulse = [], trace = [], blinks = 0, expression = null, t1 = 0 }, heldBreaths, pulseJumps) {
  const ev = [];
  const good = pulse.filter((p) => p.conf >= 50);
  if (good.length) {
    const s = [...good.map((p) => p.v)].sort((a, b) => a - b);
    ev.push({ kind: "you_alive", t0: good[0].t, t1: good.at(-1).t, value: Math.round(s[s.length >> 1] * 10) / 10, unit: "bpm" });
  }
  for (const h of heldBreaths(trace)) ev.push({ kind: "you_held_breath", t0: h.t0, t1: h.t1, value: Math.round((h.t1 - h.t0) * 10) / 10, unit: "s" });
  for (const j of pulseJumps(pulse)) ev.push({ kind: "you_jumped", t0: j.t, t1: j.t, value: Math.round((j.to - j.from) * 10) / 10, unit: "bpm" });
  if (blinks) ev.push({ kind: "you_blinked", t0: 0, t1, value: blinks, unit: "blinks" });
  if (expression) ev.push({ kind: "you_showed", t0: t1, t1, value: expression, unit: "" });
  return ev.sort((a, b) => a.t0 - b.t0).map((e, i) => ({ id: `R${i + 1}`, measuredBy: "Presage SmartSpectra", ...e }));
}
