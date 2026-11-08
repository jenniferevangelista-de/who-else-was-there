// The spirit board. Letters sit on two arcs, like a classic board; the glass visits each character.
// The glass only moves on an exhale: the investigator's own breathing (Presage chest trace) drives it.

const TOP = "ABCDEFGHIJKLM", LOW = "NOPQRSTUVWXYZ", DIGITS = "1234567890";

export function layout() {
  const pos = {};
  const arc = (letters, cy, rx, ry, a0, a1) => [...letters].forEach((c, i) => {
    const a = (Math.PI / 180) * (a0 + ((a1 - a0) * i) / (letters.length - 1));
    pos[c] = { x: 50 + rx * Math.cos(a), y: cy - ry * Math.sin(a) };
  });
  arc(TOP, 74, 43, 56, 165, 15);   // A..M, the outer arc
  arc(LOW, 84, 35, 40, 150, 30);   // N..Z, the inner arc
  [...DIGITS].forEach((c, i) => { pos[c] = { x: 27 + (46 * i) / 9, y: 85 }; });
  pos.YES = { x: 11, y: 12 }; pos.NO = { x: 89, y: 12 }; pos.GOODBYE = { x: 50, y: 95 };
  pos[" "] = { x: 50, y: 62 };
  return pos;
}

export function boardHTML() {
  const pos = layout();
  const chars = Object.entries(pos).filter(([k]) => k !== " ")
    .map(([k, p]) => `<span class="ch ${k.length > 1 ? "big" : ""}" data-ch="${k}" style="left:${p.x}%;top:${p.y}%">${k}</span>`).join("");
  return `<div class="board-wrap"><div class="board"><div class="letters">${chars}</div>
    <img class="board-ghost" src="img/wisp.svg" alt="" style="position:absolute;left:8%;top:74%;width:44px;opacity:.85">
    <span style="position:absolute;left:11%;top:22%;transform:translateX(-50%);font-size:30px">☀</span><span style="position:absolute;left:89%;top:22%;transform:translateX(-50%);font-size:30px">☾</span>
    <img class="planchette" src="img/planchette.svg" alt="the glass" style="left:50%;top:62%"></div></div>`;
}

/** The characters the glass visits for a message: YES, NO, GOODBYE as one stop; spaces rest in the middle. */
export function sequence(message) {
  const m = message.trim().toUpperCase();
  if (["YES", "NO", "GOODBYE"].includes(m)) return [m];
  return [...m.replace(/[^A-Z0-9 ]/g, "")];
}

/**
 * Spell a message. `nextExhale()` resolves when the investigator breathes out (or a timer in replay).
 * `isSilent()` pauses the glass while they talk.
 */
export async function spell(root, message, { nextExhale, isSilent, onChar } = {}) {
  const pos = layout();
  const glass = root.querySelector(".planchette");
  let shown = "";
  let step = 0;
  for (const c of sequence(message)) {
    while (isSilent && !isSilent()) await sleep(200);
    if (nextExhale && step++ % 3 === 0) await nextExhale();     // one breath out carries the glass three letters
    const p = pos[c] ?? pos[" "];
    glass.style.left = p.x + "%"; glass.style.top = p.y + "%";
    root.querySelectorAll(".ch.lit").forEach((e) => e.classList.remove("lit"));
    root.querySelector(`[data-ch="${c}"]`)?.classList.add("lit");
    await sleep(650);
    shown += c.length > 1 ? c : c;
    onChar?.(shown);
  }
  await sleep(500);
  root.querySelectorAll(".ch.lit").forEach((e) => e.classList.remove("lit"));
  glass.style.left = pos[" "].x + "%"; glass.style.top = pos[" "].y + "%";
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
