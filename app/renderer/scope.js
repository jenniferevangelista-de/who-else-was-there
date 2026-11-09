// The Ghost Detector: a phosphor line that beats with a live pulse, or lies flat.
// It draws what it is given (a bpm, a breathing trace, or nothing); it never invents a reading.

import { sound } from "./sound.js";

export function createScope(canvas, { beeps = true } = {}) {
  const ctx = canvas.getContext("2d");
  let bpm = null, flat = false, held = false, phase = 0, last = performance.now(), raf = 0;
  const pts = [];

  function beatShape(x) {            // one heartbeat-like blip, x in 0..1
    if (x < 0.08) return Math.sin((x / 0.08) * Math.PI) * 0.12;
    if (x < 0.14) return 0;
    if (x < 0.17) return -0.18 * ((x - 0.14) / 0.03);
    if (x < 0.21) return -0.18 + 1.18 * ((x - 0.17) / 0.04);
    if (x < 0.25) return 1 - 1.3 * ((x - 0.21) / 0.04);
    if (x < 0.29) return -0.3 + 0.3 * ((x - 0.25) / 0.04);
    if (x < 0.42) return 0;
    if (x < 0.56) return Math.sin(((x - 0.42) / 0.14) * Math.PI) * 0.22;
    return 0;
  }

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const w = canvas.width = canvas.clientWidth * devicePixelRatio;
    const h = canvas.height = canvas.clientHeight * devicePixelRatio;
    const speed = w / 4;              // 4 s across the glass
    const n = held ? 0 : Math.max(1, Math.round(speed * dt));
    for (let i = 0; i < n; i++) {
      let y = 0;
      if (!flat && bpm) {
        const before = Math.floor(phase + 0.79); phase += (bpm / 60) / speed; y = beatShape(phase % 1);
        if (beeps && Math.floor(phase + 0.79) !== before && canvas.isConnected) sound.beep();
      }
      pts.push(y);
    }
    while (pts.length > w) pts.shift();
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 3 * devicePixelRatio;
    ctx.strokeStyle = flat ? "#ff5d73" : "#7dffb2";
    ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 14 * devicePixelRatio;
    ctx.beginPath();
    const mid = h * 0.62, amp = h * 0.36;
    const off = w - pts.length;
    pts.forEach((y, i) => (i ? ctx.lineTo(off + i, mid - y * amp) : ctx.moveTo(off + i, mid - y * amp)));
    ctx.stroke();
    if (pts.length) {                 // the bright writing dot
      ctx.fillStyle = "#fff"; ctx.beginPath();
      ctx.arc(w - 1, mid - pts[pts.length - 1] * amp, 4 * devicePixelRatio, 0, 7); ctx.fill();
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    set(v) { bpm = Number.isFinite(v) && v > 0 ? v : null; flat = false; },
    flatline() { if (!flat && beeps && canvas.isConnected) sound.flat(); flat = true; bpm = null; },
    idle() { flat = false; bpm = null; },
    hold(on) { held = !!on; },          // freeze the line: nothing is playing, so nothing beats
    stop() { cancelAnimationFrame(raf); },
  };
}

/** The detector card markup. */
export function scopeHTML(id, label = "GHOST DETECTOR") {
  return `
  <div class="scope" id="${id}">
    <img class="sticker" src="img/heart.svg" alt="">
    <div class="screen-glass">
      <div class="readout"><span><span class="big" data-bpm>--</span> BPM</span><span data-state>STANDBY</span></div>
      <canvas></canvas>
    </div>
    <div class="label"><span>${label} <span class="muted">· powered by Presage SmartSpectra</span></span><span class="knobs"><i class="knob"></i><i class="knob"></i></span></div>
  </div>`;
}
