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
      board: "BEHIND THE COAT", cites: [face2.id],
      luna: `It says it was behind the coat. Presage counted a second face from second ${sec(face2.t0)}.`,
      bigotes: `Two faces in the frame is what the SDK reported. It does not say whose.`,
    },
    alive: still ? {
      board: "NO", cites: [still.id],
      luna: `No. The face on the wall gave 0 beats while the scope watched it.`,
      bigotes: `A face with no pulse is a photo, a mask or a screen. Ordinary, but it is a face.`,
    } : shadow && {
      board: "NO FACE", cites: [shadow.id],
      luna: `It has no face to show us. Only a shape.`,
      bigotes: `The SDK found no face in that spot. A coat, a curtain, a shadow.`,
    },
    why: (held || jump) && {
      board: "DONT GO", cites: [held?.id, jump?.id].filter(Boolean),
      luna: held ? `She held her breath at second ${sec(held.t0)}. That is when it whispered: don't go.` : `Her pulse jumped. That is when it reached her.`,
      bigotes: jump ? `Her pulse rose ${Math.round(jump.value)} bpm in a few seconds. A startle does that. So does a flickering lamp.` : `Holding your breath is what people do when they listen.`,
    },
    where: face2 && {
      board: "UNDER THE COAT", cites: [face2.id],
      luna: `She hung the coat back at second ${sec(face2.t1)}. It is still there. Under the coat.`,
      bigotes: `The second face disappeared at second ${sec(face2.t1)}, when the coat went back on the stand. Covered, not gone.`,
    },
    bye: { board: "GOODBYE", cites: ev.slice(0, 1).map((e) => e.id), luna: `It said goodbye.`, bigotes: `Session closed.` },
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
  return lines.filter((l) => !citeOrVanish(l, ev));
}
