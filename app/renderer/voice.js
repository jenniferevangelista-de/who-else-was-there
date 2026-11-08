// The crew's voices: lines recorded ahead of time and looked up by their text. A line with no recording
// (a number from a tape only you have) stays silent and is still written on screen.
import VOICES from "./voices.json";
import { sound } from "./sound.js";
import { L } from "../../src/i18n.js";

const norm = (s) => String(s).replace(/\s+/g, " ").trim();
let queue = [], current = null;

function next() {
  if (current || !queue.length) return;
  const { id, who } = queue.shift();
  if (!sound.on) { queue = []; return; }
  const a = new Audio(`audio/${id}.mp3`);
  current = a; document.body.dataset.speaking = who;
  const done = () => { if (current !== a) return; current = null; delete document.body.dataset.speaking; next(); };
  a.addEventListener("ended", done); a.addEventListener("error", done);
  a.play().catch(done);
}

export const voice = {
  /** Queue one line by its exact text. */
  say(text) { const v = VOICES[norm(L(text))]; if (v) { queue.push(v); next(); } },
  /** Stop speaking and forget what was queued. */
  clear() { queue = []; if (current) { const a = current; current = null; a.pause(); } delete document.body.dataset.speaking; },
  /** Speak every speech bubble as it appears on screen, in order. */
  watch(root) {
    new MutationObserver((records) => {
      for (const r of records) for (const n of r.addedNodes) {
        if (n.nodeType !== 1) continue;
        for (const s of n.matches?.(".say") ? [n] : n.querySelectorAll(".say")) {
          const b = s.querySelector(".bubble")?.cloneNode(true); if (!b) continue;
          b.querySelectorAll(".who, .muted").forEach((x) => x.remove());
          this.say(b.textContent);
        }
      }
    }).observe(root, { childList: true, subtree: true });
  },
};
