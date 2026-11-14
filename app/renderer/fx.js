// The camera language of the game: a shake that dies down, a held breath before the hit,
// a flash, a blackout, the edges of the frame closing in, and a title card between acts.
// Everything is visual or tonal (no noise, no hiss) and it all steps aside for "reduce motion".
import { sound } from "./sound.js";

const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stage = () => document.getElementById("stage");
let shaking = 0;

function layer(cls, css = "") {
  const d = document.createElement("div"); d.className = `fx ${cls}`; d.style.cssText = css;
  document.body.append(d); return d;
}

export const fx = {
  /** Camera shake: strong at first, then it settles. `power` in pixels. */
  shake(power = 14, ms = 900) {
    const s = stage(); if (!s || calm()) return;
    const id = ++shaking, t0 = performance.now();
    const step = (now) => {
      const k = 1 - (now - t0) / ms;
      if (k <= 0 || id !== shaking || !document.body.contains(s)) { if (id === shaking) s.style.transform = ""; return; }
      const a = power * k * k;
      s.style.transform = `translate(${(Math.random() * 2 - 1) * a}px, ${(Math.random() * 2 - 1) * a}px) rotate(${(Math.random() * 2 - 1) * a * 0.03}deg)`;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },
  /** One frame of light: white for the glass, red for a flat line. */
  flash(color = "#fff", ms = 420, peak = 0.9) {
    const d = layer("fx-flash", `background:${color};opacity:${calm() ? peak * 0.4 : peak}`);
    requestAnimationFrame(() => { d.style.transition = `opacity ${ms}ms ease-out`; d.style.opacity = "0"; });
    setTimeout(() => d.remove(), ms + 80);
  },
  /** The lights go: black in, hold, and back. */
  async blackout(hold = 160, fade = 90) {
    const d = layer("fx-black", `opacity:0;transition:opacity ${fade}ms linear`);
    requestAnimationFrame(() => (d.style.opacity = "1"));
    await sleep(fade + hold);
    d.style.opacity = "0"; setTimeout(() => d.remove(), fade + 60);
  },
  /** The lights flicker a few times, like a bad bulb. */
  async flicker(times = 3) { for (let i = 0; i < times; i++) { await this.blackout(50 + Math.random() * 90, 40); await sleep(70 + Math.random() * 140); } },
  /** Colours split for a moment, as if the lens took the hit. */
  aberrate(ms = 700) {
    const s = stage(); if (!s || calm()) return;
    s.classList.add("fx-aberrate"); setTimeout(() => s.classList.remove("fx-aberrate"), ms);
  },
  /** The frame closes in and the colour drains: something is wrong. */
  dread(ms = 2600) { document.body.classList.add("fx-dread"); setTimeout(() => document.body.classList.remove("fx-dread"), ms); },
  /** The held breath before the hit: everything stops. */
  async hold(ms = 420) { document.body.classList.add("fx-hold"); await sleep(ms); document.body.classList.remove("fx-hold"); },
  /** A low tone that falls: the weight of the hit. Tonal only. */
  thud() { sound.beep(52, 900, 0.2); sound.beep(38, 1300, 0.16); },
  /** A low tone that rises under a scene, to tighten it. */
  riser(ms = 1800) { for (let i = 0; i < 6; i++) setTimeout(() => sound.beep(60 + i * 14, ms / 4, 0.05 + i * 0.012), (i * ms) / 6); },
  /** The scare: the screen goes black and the words land one at a time, as big as the screen. */
  async scream(words, hold = 1900) {
    const quiet = calm(), d = layer("fx-scream"), eyes = document.createElement("img"), box = document.createElement("div");
    eyes.src = "img/stalker.svg"; eyes.alt = ""; d.append(eyes, box);
    const longest = Math.max(...words.map((w) => w.length));
    box.style.fontSize = `min(${Math.floor(210 / longest)}vw, ${Math.floor(105 / words.length)}vh)`;   // every word fits the width, all of them fit the height
    for (const w of words) {
      const b = document.createElement("b"); b.textContent = w; box.append(b);
      this.thud(); sound.beep(96, 420, 0.22);
      if (!quiet) { d.classList.add("hit"); setTimeout(() => d.classList.remove("hit"), 90); }   // one white frame per word, never a strobe
      await sleep(quiet ? 800 : 620);
    }
    d.classList.add("all"); sound.sting(); this.thud();
    await sleep(hold);
    d.classList.add("out"); await sleep(320); d.remove();
  },
  /** A title card between acts. It fades over the screen and gets out of the way. */
  card(kicker, title, ms = 1900) {
    const d = layer("fx-card");
    const box = document.createElement("div"), k = document.createElement("span"), t = document.createElement("b");
    k.textContent = kicker; t.textContent = title; box.append(k, t); d.append(box);
    requestAnimationFrame(() => d.classList.add("in"));
    setTimeout(() => d.classList.remove("in"), ms);
    setTimeout(() => d.remove(), ms + 900);
  },
};
