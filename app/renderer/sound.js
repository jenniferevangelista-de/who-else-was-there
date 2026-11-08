// Tiny synthesized sounds (no audio files): a monitor beep per heartbeat, a flatline tone,
// a soft chime when the glass lands. Off until the person turns sound on.
let ctx = null, on = true, flat = null;
const ensure = () => { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === "suspended") ctx.resume(); return ctx; };

export const audioCtx = () => { if (on) ensure(); return ctx; };

export const sound = {
  get on() { return on; },
  toggle() {
    on = !on;
    if (on) ensure();
    if (!on) this.stopFlat();
    return on;
  },
  // the scare when the scope finds the second face: two voices sliding down a semitone apart, and a low hit
  sting() {
    if (!on) return; ensure();
    for (const [f0, f1, vol, type] of [[1480, 520, 0.05, "sine"], [1397, 491, 0.05, "sine"], [220, 82, 0.1, "triangle"]]) {
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + 0.95);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.25);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 1.3);
    }
    this.beep(58, 800, 0.16);
  },
  beep(freq = 880, ms = 70, vol = 0.05) {
    if (!on) return; ensure();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + ms / 1000 + 0.02);
  },
  chime() { this.beep(660, 260, 0.04); setTimeout(() => this.beep(990, 380, 0.03), 120); },
  flat() {
    if (!on || flat) return; ensure();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = 880; g.gain.value = 0.035;
    o.connect(g).connect(ctx.destination); o.start(); flat = { o, g };
    setTimeout(() => this.stopFlat(), 2600);
  },
  // glass breaking: tonal only, a run of high pings over a low hit (no noise, no hiss)
  crash() {
    if (!on) return; ensure();
    [2400, 3100, 3900, 2900, 3500, 2600, 4200].forEach((hz, i) => setTimeout(() => this.beep(hz, 150, 0.035), 20 + i * 55));
    this.beep(70, 500, 0.12);
  },
  stopFlat() { if (flat) { try { flat.o.stop(); } catch {} flat = null; } },
};
