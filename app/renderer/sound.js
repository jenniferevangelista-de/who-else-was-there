// Tiny synthesized sounds (no audio files): a monitor beep per heartbeat, a flatline tone,
// a soft chime when the glass lands. Off until the person turns sound on.
let ctx = null, on = false, flat = null;

export const sound = {
  get on() { return on; },
  toggle() {
    on = !on;
    if (on && !ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (!on) this.stopFlat();
    return on;
  },
  beep(freq = 880, ms = 70, vol = 0.05) {
    if (!on || !ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + ms / 1000 + 0.02);
  },
  chime() { this.beep(660, 260, 0.04); setTimeout(() => this.beep(990, 380, 0.03), 120); },
  flat() {
    if (!on || !ctx || flat) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = 880; g.gain.value = 0.035;
    o.connect(g).connect(ctx.destination); o.start(); flat = { o, g };
    setTimeout(() => this.stopFlat(), 2600);
  },
  stopFlat() { if (flat) { try { flat.o.stop(); } catch {} flat = null; } },
};
