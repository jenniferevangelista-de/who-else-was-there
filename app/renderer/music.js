// The seance score, the same one as the Witching Hour seance: a minor pad that changes chord and a music box
// with an echo and now and then a wrong note. Tonal only. It plays on the board and nowhere else.
import { sound, audioCtx } from "./sound.js";

let mus = null;
export const music = {
  start() {
    const c = sound.on && audioCtx();
    if (!c || mus) return;
    const g = c.createGain(); g.gain.value = 0.0001; g.gain.setTargetAtTime(0.32, c.currentTime, 2.2); g.connect(c.destination);
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520; lp.Q.value = 2;
    const padG = c.createGain(); padG.gain.value = 0.34; lp.connect(padG); padG.connect(g);
    const lfo = c.createOscillator(), lfoG = c.createGain(); lfo.frequency.value = 0.07; lfoG.gain.value = 260; lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
    const CH = [[110, 130.8, 164.8], [87.3, 110, 130.8], [98, 123.5, 146.8], [82.4, 103.8, 123.5]];
    const os = [lfo];
    const pads = [0, 1, 2].map((i) => { const o = c.createOscillator(); o.type = i === 2 ? "sine" : "triangle"; o.frequency.value = CH[0][i]; o.detune.value = (i - 1) * 7; o.connect(lp); o.start(); os.push(o); return o; });
    const echo = c.createDelay(1.5); echo.delayTime.value = 0.46;
    const fb = c.createGain(); fb.gain.value = 0.46;
    const elp = c.createBiquadFilter(); elp.type = "lowpass"; elp.frequency.value = 2400;
    echo.connect(elp); elp.connect(fb); fb.connect(echo); elp.connect(g);
    const NOTES = [392, 440, 493.9, 523.3, 587.3, 659.3, 698.5], WRONG = [466.2, 622.3];
    let n = 0, last = 3;
    const bell = (f) => {
      const t = c.currentTime + 0.05, b = c.createGain();
      b.gain.setValueAtTime(0.0001, t); b.gain.exponentialRampToValueAtTime(0.2, t + 0.012); b.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
      [[f, 1], [f * 2, 0.25], [f * 3.01, 0.08]].forEach(([hz, a]) => { const o = c.createOscillator(), og = c.createGain(); o.type = "sine"; o.frequency.value = hz; og.gain.value = a; o.connect(og); og.connect(b); o.start(t); o.stop(t + 2.6); });
      b.connect(g); b.connect(echo);
    };
    const tick = () => {
      n += 1;
      if (n % 9 === 1) { const ch = CH[((n / 9) | 0) % CH.length]; pads.forEach((o, i) => o.frequency.setTargetAtTime(ch[i], c.currentTime, 1.6)); }
      if (Math.random() < 0.5) {
        last = Math.max(0, Math.min(NOTES.length - 1, last + [-2, -1, -1, 1, 1, 2][(Math.random() * 6) | 0]));
        bell(Math.random() < 0.07 ? WRONG[(Math.random() * 2) | 0] : NOTES[last]);
      }
    };
    tick();
    mus = { c, g, os, timer: setInterval(tick, 950) };
  },
  /** The ending: the score swells and the heartbeat of the music speeds up. */
  tense() {
    if (!mus) return;
    const { c, g } = mus;
    g.gain.setTargetAtTime(0.62, c.currentTime, 1.6);
  },
  stop(really = true) {
    if (!mus || !really) return;
    const { g, c, timer, os } = mus;
    clearInterval(timer);
    g.gain.cancelScheduledValues(c.currentTime); g.gain.setTargetAtTime(0.0001, c.currentTime, 0.5);
    os.forEach((o) => { try { o.stop(c.currentTime + 2.5); } catch { /* already stopped */ } });
    mus = null;
  },
};
