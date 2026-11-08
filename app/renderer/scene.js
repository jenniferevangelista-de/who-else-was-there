// Replay mode only: a drawn stand-in for the client's hallway tape, so the story runs before the
// real recording is measured. Clearly labelled SAMPLE on screen. The real case plays a <video>.

import { SAMPLE_CASE as C } from "../../src/sample.js";

const lerp = (a, b, u) => a + (b - a) * Math.max(0, Math.min(1, u));
function path(t) {            // Marina's x (0..1)
  const k = [[0, 0.3], [8, 0.3], [19, 0.76], [26, 0.76], [36, 0.3], [40, 0.3], [45, 0.42]];
  for (let i = 0; i < k.length - 1; i++) {
    const [t0, x0] = k[i], [t1, x1] = k[i + 1];
    if (t >= t0 && t <= t1) return lerp(x0, x1, (t - t0) / (t1 - t0));
  }
  return 0.42;
}
export const coatOn = (t) => t < C.coatOffAt || t >= C.coatBackAt;   // coat hanging on the stand
export const marinaFace = (t) => ({ x: path(t), y: 0.36 });
export const portraitFace = () => ({ x: C.region.x + C.region.w / 2, y: C.region.y + C.region.h * 0.45 });

export function drawScene(ctx, w, h, t) {
  const flick = t > C.stopAt - 0.4 && t < C.stopAt + 0.5 && Math.floor(t * 12) % 2 === 0;
  // wall and floor
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, flick ? "#151022" : "#3a2f52"); g.addColorStop(1, flick ? "#0d0a16" : "#231b33");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#1a1326"; ctx.fillRect(0, h * 0.8, w, h * 0.2);
  // lamp glow
  if (!flick) { const r = ctx.createRadialGradient(w * 0.5, 0, 10, w * 0.5, 0, w * 0.55); r.addColorStop(0, "#ffd99a40"); r.addColorStop(1, "#ffd99a00"); ctx.fillStyle = r; ctx.fillRect(0, 0, w, h); }
  // door
  ctx.fillStyle = "#4a2f22"; roundRect(ctx, w * 0.82, h * 0.2, w * 0.12, h * 0.6, 8); ctx.fill();
  ctx.fillStyle = "#e0b04a"; ctx.beginPath(); ctx.arc(w * 0.84, h * 0.52, w * 0.007, 0, 7); ctx.fill();
  // the portrait (always on the wall; the coat hides it)
  const R = C.region, px = w * R.x, py = h * R.y, pw = w * R.w, ph = h * R.h;
  ctx.fillStyle = "#6b4e2e"; ctx.beginPath(); ctx.ellipse(px + pw / 2, py + ph / 2, pw / 2, ph / 2, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#cfc7d8"; ctx.beginPath(); ctx.ellipse(px + pw / 2, py + ph / 2, pw * 0.4, ph * 0.42, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#2a2133"; // still eyes, a closed mouth
  ctx.beginPath(); ctx.arc(px + pw * 0.4, py + ph * 0.45, pw * 0.04, 0, 7); ctx.arc(px + pw * 0.6, py + ph * 0.45, pw * 0.04, 0, 7); ctx.fill();
  ctx.fillRect(px + pw * 0.44, py + ph * 0.62, pw * 0.12, ph * 0.015);
  // coat stand and coat
  ctx.fillStyle = "#2a1f33"; ctx.fillRect(px + pw / 2 - 3, py - h * 0.04, 6, h * 0.68);
  if (coatOn(t)) { ctx.fillStyle = "#c2414f"; roundRect(ctx, px - pw * 0.1, py - h * 0.02, pw * 1.2, ph * 1.5, 18); ctx.fill(); }
  // Marina (face always blurred)
  const m = marinaFace(t), mx = m.x * w, my = m.y * h;
  ctx.fillStyle = coatOn(t) ? "#5a6fb0" : "#c2414f";
  roundRect(ctx, mx - w * 0.045, my + h * 0.06, w * 0.09, h * 0.36, 24); ctx.fill();
  ctx.save(); ctx.filter = "blur(10px)"; ctx.fillStyle = "#e7c3a8"; ctx.beginPath(); ctx.arc(mx, my, h * 0.075, 0, 7); ctx.fill(); ctx.restore();
  // film grain and stamp
  for (let i = 0; i < 120; i++) { ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
