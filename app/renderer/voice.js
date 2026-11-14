// The crew's voices: lines recorded ahead of time and looked up by their text. A line with no recording
// (a number from a tape only you have) stays silent and is still written on screen.
import VOICES from "./voices.json";
import { sound } from "./sound.js";
import { Lx } from "../../src/i18n.js";

const norm = (s) => String(s).replace(/\s+/g, " ").trim();
let queue = [], current = null;

let waiting = false;   // the browser refused to play before the first tap: the line waits for it
const reveal = (el) => { if (el) el.classList.remove("pending"); };
function next() {
  if (current || !queue.length) return;
  const item = queue.shift(), { id, who, el } = item;
  if (!sound.on) { queue.forEach((q) => reveal(q.el)); reveal(el); queue = []; return; }
  const a = new Audio(`audio/${id}.mp3`); a.volume = 0.6;
  current = a; document.body.dataset.speaking = who;
  reveal(el); el?.classList.add("speaking");
  const done = () => { if (current !== a) return; current = null; el?.classList.remove("speaking"); delete document.body.dataset.speaking; next(); };
  a.addEventListener("ended", done); a.addEventListener("error", done);
  a.play().catch((e) => {
    if (e?.name !== "NotAllowedError") return done();
    current = null; el?.classList.remove("speaking"); delete document.body.dataset.speaking; queue.unshift(item);
    if (waiting) return; waiting = true;
    const go = () => { waiting = false; removeEventListener("pointerdown", go, true); removeEventListener("keydown", go, true); next(); };
    addEventListener("pointerdown", go, true); addEventListener("keydown", go, true);
  });
}

export const voice = {
  /** Queue one line by its exact text. */
  say(text, el) {
    const v = VOICES[norm(Lx(norm(text)))];
    if (!v) { (window.__voiceMiss ??= []).push(norm(text)); return; }
    if (el && sound.on) { el.classList.add("pending"); setTimeout(() => reveal(el), 14000); }   // spoken lines arrive one at a time, never stuck hidden
    queue.push({ ...v, el }); next();
  },
  /** Stop speaking and forget what was queued. */
  clear() { queue.forEach((q) => reveal(q.el)); queue = []; document.querySelectorAll(".say.pending, .say.speaking").forEach((x) => x.classList.remove("pending", "speaking")); if (current) { const a = current; current = null; a.pause(); } delete document.body.dataset.speaking; },
  /** Resolves once the crew has finished talking, or after `max` ms. */
  async idle(max = 20000) { await new Promise((r) => setTimeout(r, 80)); const t0 = performance.now(); while ((current || queue.length) && performance.now() - t0 < max) await new Promise((r) => setTimeout(r, 120)); },
  /** Speak every speech bubble as it appears on screen, in order. */
  watch(root) {
    new MutationObserver((records) => {
      for (const r of records) for (const n of r.addedNodes) {
        if (n.nodeType !== 1) continue;
        for (const s of n.matches?.(".say") ? [n] : n.querySelectorAll(".say")) {
          const b = s.querySelector(".bubble")?.cloneNode(true); if (!b) continue;
          b.querySelectorAll(".who, .muted").forEach((x) => x.remove());
          this.say(b.textContent, s);
        }
      }
    }).observe(root, { childList: true, subtree: true });
  },
};
