// Replay mode only: a drawn stand-in for the client's hallway tape, so the story runs before the
// real recording is measured. Clearly labelled SAMPLE on screen. The real case plays a <video>.
//
// Case 01, The Door: Marina is dressed to go out. At the door a feeling stops her. She never sees the
// shadow that came out of the dark stairs behind her, and she stays home.

import { SAMPLE_CASE as C } from "../../src/sample.js";

const lerp = (a, b, u) => a + (b - a) * Math.max(0, Math.min(1, u));
const smooth = (u) => { const k = Math.max(0, Math.min(1, u)); return k * k * (3 - 2 * k); };
const HUNG_AT = 37.5;   // she hangs the coat on the hook

function path(t) {            // Marina's x (0..1)
  const k = [[0, 0.3], [8, 0.3], [19, 0.76], [26, 0.76], [36, 0.3], [40, 0.3], [45, 0.42]];
  for (let i = 0; i < k.length - 1; i++) {
    const [t0, x0] = k[i], [t1, x1] = k[i + 1];
    if (t >= t0 && t <= t1) return lerp(x0, x1, (t - t0) / (t1 - t0));
  }
  return 0.42;
}
export const marinaFace = (t) => ({ x: path(t), y: 0.36 });

/** Where the shadow is at second t: out of the stairs, across the hall to stand right behind her at the door,
 *  through her when she turns back, and then at her heels all the way down the hall. */
function shadowAt(t) {
  const inK = smooth((t - C.shadowInAt) / 2.5), outK = smooth((t - (C.shadowOutAt - 2)) / 2);
  const home = C.region.x + C.region.w / 2, behind = 0.63, heels = (u) => path(u) + 0.13;
  let x = lerp(-0.05, home, inK);
  if (t >= 19) x = lerp(home, behind, smooth((t - 19) / 3.5));
  if (t >= 26.5) x = t < 29 ? lerp(behind, heels(t), smooth((t - 26.5) / 2.5)) : heels(t);
  return { alpha: inK * (1 - outK), x };
}
export const shadowFace = (t) => ({ x: shadowAt(t).x, y: C.region.y + C.region.h * 0.45 });

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ------------------------------------------------------------------ the hallway, painted once per size
const cache = new Map();
function backdrop(w, h) {
  const key = `${w}x${h}`;
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const c = cv.getContext("2d");

  // wallpaper
  const wall = c.createLinearGradient(0, 0, 0, h * 0.8); wall.addColorStop(0, "#40355a"); wall.addColorStop(1, "#2c2340");
  c.fillStyle = wall; c.fillRect(0, 0, w, h * 0.8);
  c.fillStyle = "#ffffff0a";
  for (let x = 0; x < w; x += w * 0.05) c.fillRect(x, 0, w * 0.018, h * 0.6);
  c.fillStyle = "#ffffff10";
  for (let y = h * 0.05, r = 0; y < h * 0.56; y += h * 0.08, r++) for (let x = (r % 2) * w * 0.025; x < w; x += w * 0.05) { c.beginPath(); c.arc(x + w * 0.009, y, h * 0.005, 0, 7); c.fill(); }

  // wainscot and baseboard
  c.fillStyle = "#2a2036"; c.fillRect(0, h * 0.58, w, h * 0.22);
  c.fillStyle = "#4c3b52"; c.fillRect(0, h * 0.575, w, h * 0.012);
  c.strokeStyle = "#ffffff12"; c.lineWidth = Math.max(1, h * 0.003);
  for (let x = w * 0.02; x < w; x += w * 0.1) c.strokeRect(x, h * 0.61, w * 0.08, h * 0.15);
  c.fillStyle = "#3a2c3e"; c.fillRect(0, h * 0.775, w, h * 0.028);

  // floor boards running towards the camera
  const floor = c.createLinearGradient(0, h * 0.8, 0, h); floor.addColorStop(0, "#2a1e2a"); floor.addColorStop(1, "#120c16");
  c.fillStyle = floor; c.fillRect(0, h * 0.8, w, h * 0.2);
  c.strokeStyle = "#00000055"; c.lineWidth = Math.max(1, h * 0.002);
  for (let i = -8; i <= 8; i++) { c.beginPath(); c.moveTo(w * 0.5 + i * w * 0.06, h * 0.8); c.lineTo(w * 0.5 + i * w * 0.16, h); c.stroke(); }

  // the dark stairs on the left: an archway with steps climbing into nothing
  const arch = () => { c.beginPath(); c.moveTo(w * 0.03, h * 0.8); c.lineTo(w * 0.03, h * 0.22); c.quadraticCurveTo(w * 0.15, h * -0.02, w * 0.27, h * 0.22); c.lineTo(w * 0.27, h * 0.8); c.closePath(); };
  const dark = c.createRadialGradient(w * 0.15, h * 0.4, h * 0.04, w * 0.15, h * 0.4, h * 0.48); dark.addColorStop(0, "#1a1426"); dark.addColorStop(1, "#050308");
  arch(); c.fillStyle = dark; c.fill();
  c.save(); arch(); c.clip();
  c.strokeStyle = "#ffffff0d"; c.lineWidth = Math.max(1, h * 0.004);
  for (let i = 0; i < 7; i++) { const y = h * (0.78 - i * 0.075), x = w * (0.26 - i * 0.022); c.beginPath(); c.moveTo(x, y); c.lineTo(w * 0.03, y); c.stroke(); }
  c.restore();
  arch(); c.strokeStyle = "#5a4538"; c.lineWidth = h * 0.016; c.stroke();

  // two frames, the faces in them too faded to read
  for (const [fx, fy, fw, fh] of [[0.385, 0.2, 0.06, 0.14], [0.6, 0.17, 0.075, 0.12]]) {
    c.fillStyle = "#6b4e2e"; c.fillRect(w * fx, h * fy, w * fw, h * fh);
    c.fillStyle = "#1f1a2b"; c.fillRect(w * (fx + 0.006), h * (fy + 0.012), w * (fw - 0.012), h * (fh - 0.024));
    c.fillStyle = "#ffffff14"; c.beginPath(); c.ellipse(w * (fx + fw / 2), h * (fy + fh * 0.48), w * fw * 0.22, h * fh * 0.28, 0, 0, 7); c.fill();
  }

  // the coat hooks
  c.fillStyle = "#5a4538"; c.fillRect(w * 0.3, h * 0.385, w * 0.09, h * 0.018);
  c.fillStyle = "#c9a35e"; for (const x of [0.315, 0.345, 0.375]) { c.beginPath(); c.arc(w * x, h * 0.41, h * 0.007, 0, 7); c.fill(); }

  // the console table with a bowl for the keys
  c.fillStyle = "#4a3428"; c.fillRect(w * 0.545, h * 0.59, w * 0.13, h * 0.016);
  c.fillRect(w * 0.555, h * 0.6, w * 0.008, h * 0.19); c.fillRect(w * 0.655, h * 0.6, w * 0.008, h * 0.19);
  c.fillStyle = "#8f7fa8"; c.beginPath(); c.ellipse(w * 0.61, h * 0.583, w * 0.02, h * 0.01, 0, 0, 7); c.fill();

  // the front door
  c.fillStyle = "#4e3225"; rr(c, w * 0.82, h * 0.18, w * 0.125, h * 0.62, 6); c.fill();
  c.strokeStyle = "#2c1a12"; c.lineWidth = h * 0.012; rr(c, w * 0.82, h * 0.18, w * 0.125, h * 0.62, 6); c.stroke();
  c.fillStyle = "#7f9cc9"; rr(c, w * 0.848, h * 0.23, w * 0.07, h * 0.1, 4); c.fill();
  c.fillStyle = "#2c1a12"; c.fillRect(w * 0.881, h * 0.23, w * 0.004, h * 0.1);
  c.strokeStyle = "#ffffff14"; c.lineWidth = Math.max(1, h * 0.003); c.strokeRect(w * 0.84, h * 0.4, w * 0.085, h * 0.16); c.strokeRect(w * 0.84, h * 0.59, w * 0.085, h * 0.16);
  c.fillStyle = "#e0b04a"; c.beginPath(); c.arc(w * 0.831, h * 0.52, h * 0.011, 0, 7); c.fill();
  c.fillStyle = "#3c2d2a"; c.beginPath(); c.ellipse(w * 0.875, h * 0.84, w * 0.08, h * 0.022, 0, 0, 7); c.fill();

  // the lamp
  c.fillStyle = "#c9a35e"; c.fillRect(w * 0.497, 0, w * 0.006, h * 0.075);
  c.fillStyle = "#f3cf88"; c.beginPath(); c.moveTo(w * 0.47, h * 0.13); c.lineTo(w * 0.53, h * 0.13); c.lineTo(w * 0.515, h * 0.07); c.lineTo(w * 0.485, h * 0.07); c.closePath(); c.fill();

  const overlay = document.createElement("canvas"); overlay.width = w; overlay.height = h;
  const o = overlay.getContext("2d");
  o.fillStyle = "#14283c2e"; o.fillRect(0, 0, w, h);          // the cold cast of a cheap night camera
  o.fillStyle = "#0000001c"; for (let y = 0; y < h; y += 4) o.fillRect(0, y, w, 1);
  const v = o.createRadialGradient(w * 0.5, h * 0.48, h * 0.38, w * 0.5, h * 0.5, w * 0.68); v.addColorStop(0, "#00000000"); v.addColorStop(1, "#000000b8");
  o.fillStyle = v; o.fillRect(0, 0, w, h);

  const out = { wall: cv, overlay };
  cache.set(key, out);
  return out;
}

// ------------------------------------------------------------------ the shadow
function faceOf(ctx, w, h, x, sway, alpha, eyes) {
  const fy = (C.region.y + C.region.h * 0.45) * h + sway * 0.5, fx = x * w;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = "#cfc7d8"; ctx.beginPath(); ctx.ellipse(fx, fy, h * 0.04, h * 0.058, 0, 0, 7); ctx.fill();
  ctx.fillStyle = eyes ? "#ff6680" : "#16101f";
  if (eyes) { ctx.shadowColor = "#ff6680"; ctx.shadowBlur = h * 0.03; }
  ctx.beginPath(); ctx.ellipse(fx - h * 0.016, fy - h * 0.008, h * 0.0075, h * 0.011, 0, 0, 7); ctx.ellipse(fx + h * 0.016, fy - h * 0.008, h * 0.0075, h * 0.011, 0, 0, 7); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#16101f"; ctx.fillRect(fx - h * 0.012, fy + h * 0.026, h * 0.024, Math.max(1, h * 0.003));
  ctx.restore();
}

function drawShadow(ctx, w, h, t, s) {
  if (s.alpha <= 0.01) return;
  const x = s.x * w, sway = Math.sin(t * 0.9) * h * 0.006, top = (C.region.y - 0.05) * h + sway, foot = h * 0.8;
  ctx.save();
  ctx.globalAlpha = s.alpha * 0.95; ctx.filter = `blur(${Math.max(1, h * 0.005)}px)`;
  ctx.fillStyle = "#08050e";
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.bezierCurveTo(x + h * 0.075, top, x + h * 0.08, top + h * 0.12, x + h * 0.075, top + h * 0.16);
  ctx.bezierCurveTo(x + h * 0.14, top + h * 0.2, x + h * 0.13, foot - h * 0.2, x + h * 0.11, foot);
  for (let i = 0; i < 5; i++) ctx.lineTo(x + h * (0.11 - (i + 0.5) * 0.044), foot - (i % 2 ? h * 0.05 : h * 0.015) + Math.sin(t * 2 + i) * h * 0.006);
  ctx.lineTo(x - h * 0.11, foot);
  ctx.bezierCurveTo(x - h * 0.13, foot - h * 0.2, x - h * 0.14, top + h * 0.2, x - h * 0.075, top + h * 0.16);
  ctx.bezierCurveTo(x - h * 0.08, top + h * 0.12, x - h * 0.075, top, x, top);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  faceOf(ctx, w, h, s.x, sway, s.alpha * 0.82, false);
}

// ------------------------------------------------------------------ Marina (face always blurred)
function drawMarina(ctx, w, h, t) {
  const m = marinaFace(t), mx = m.x * w, moving = Math.abs(path(t + 0.05) - path(t)) > 1e-4;
  const stride = moving ? Math.sin(t * 9) : 0, bob = moving ? Math.abs(stride) * h * 0.006 : 0;
  const my = m.y * h - bob, coatOn = t < HUNG_AT, atDoor = t >= 19 && t < 26.5;
  const body = coatOn ? "#c2414f" : "#5a6fb0";

  ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = "#000"; ctx.beginPath(); ctx.ellipse(mx, h * 0.815, w * 0.05, h * 0.018, 0, 0, 7); ctx.fill(); ctx.restore();

  // legs
  ctx.fillStyle = "#1f2438";
  rr(ctx, mx - w * 0.024 + stride * w * 0.012, h * 0.62, w * 0.02, h * 0.19, 8); ctx.fill();
  rr(ctx, mx + w * 0.004 - stride * w * 0.012, h * 0.62, w * 0.02, h * 0.19, 8); ctx.fill();

  // hair behind the head
  ctx.save(); ctx.filter = `blur(${Math.max(2, h * 0.008)}px)`; ctx.fillStyle = "#3a2433"; ctx.beginPath(); ctx.arc(mx, my - h * 0.012, h * 0.083, 0, 7); ctx.fill(); ctx.restore();

  // body
  ctx.fillStyle = body; rr(ctx, mx - w * 0.042, my + h * 0.07, w * 0.084, h * (coatOn ? 0.29 : 0.22), 22); ctx.fill();
  if (coatOn) {
    ctx.strokeStyle = "#8c2c38"; ctx.lineWidth = Math.max(1, h * 0.004); ctx.beginPath(); ctx.moveTo(mx, my + h * 0.08); ctx.lineTo(mx, my + h * 0.36); ctx.stroke();
    ctx.fillStyle = "#e8c27a"; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(mx + w * 0.009, my + h * (0.13 + i * 0.07), h * 0.006, 0, 7); ctx.fill(); }
    ctx.fillStyle = "#e8c27a"; rr(ctx, mx - w * 0.034, my + h * 0.062, w * 0.068, h * 0.032, 10); ctx.fill();   // scarf
  }

  // arms: one carries the bag, the other reaches for the door and does not get there
  ctx.strokeStyle = body; ctx.lineCap = "round"; ctx.lineWidth = w * 0.017;
  ctx.beginPath(); ctx.moveTo(mx - w * 0.04, my + h * 0.1); ctx.lineTo(mx - w * 0.052, my + h * 0.28); ctx.stroke();
  if (t < HUNG_AT) { ctx.fillStyle = "#6b4e2e"; rr(ctx, mx - w * 0.078, my + h * 0.28, w * 0.05, h * 0.09, 6); ctx.fill(); ctx.strokeStyle = "#6b4e2e"; ctx.lineWidth = Math.max(1, h * 0.005); ctx.beginPath(); ctx.arc(mx - w * 0.053, my + h * 0.28, w * 0.012, Math.PI, 0); ctx.stroke(); }
  ctx.strokeStyle = body; ctx.lineWidth = w * 0.017;
  const hand = atDoor ? [mx + w * 0.058, my + h * 0.155] : [mx + w * 0.05, my + h * 0.28];
  ctx.beginPath(); ctx.moveTo(mx + w * 0.04, my + h * 0.1); ctx.lineTo(hand[0], hand[1]); ctx.stroke();
  ctx.fillStyle = "#e7c3a8"; ctx.beginPath(); ctx.arc(hand[0], hand[1], h * 0.014, 0, 7); ctx.fill();
  if (atDoor || t < 19) { ctx.fillStyle = "#e0b04a"; ctx.fillRect(hand[0] - h * 0.004, hand[1] + h * 0.01, h * 0.008, h * 0.024); }   // the keys

  // the face, always blurred
  ctx.save(); ctx.filter = `blur(${Math.max(3, h * 0.014)}px)`; ctx.fillStyle = "#e7c3a8"; ctx.beginPath(); ctx.arc(mx, my, h * 0.066, 0, 7); ctx.fill(); ctx.restore();
}

// ------------------------------------------------------------------ one frame of the tape
export function drawScene(ctx, w, h, t) {
  const { wall, overlay } = backdrop(w, h);
  const flick = t > C.stopAt - 0.4 && t < C.stopAt + 0.5 && Math.floor(t * 12) % 2 === 0;
  const shadow = shadowAt(t);
  ctx.drawImage(wall, 0, 0);

  if (!flick) { const r = ctx.createRadialGradient(w * 0.5, h * 0.12, 10, w * 0.5, h * 0.12, w * 0.5); r.addColorStop(0, "#ffd99a66"); r.addColorStop(0.5, "#ffd99a1c"); r.addColorStop(1, "#ffd99a00"); ctx.fillStyle = r; ctx.fillRect(0, 0, w, h); }
  else { ctx.fillStyle = "#000000a6"; ctx.fillRect(0, 0, w, h); }

  drawShadow(ctx, w, h, t, shadow);

  if (t >= HUNG_AT) {       // the coat, back on its hook
    ctx.fillStyle = "#c2414f"; rr(ctx, w * 0.323, h * 0.405, w * 0.046, h * 0.27, 14); ctx.fill();
    ctx.fillStyle = "#e8c27a"; rr(ctx, w * 0.326, h * 0.405, w * 0.04, h * 0.024, 8); ctx.fill();
  }
  drawMarina(ctx, w, h, t);

  ctx.drawImage(overlay, 0, 0);
  if (flick && shadow.alpha > 0.2) faceOf(ctx, w, h, shadow.x, 0, 1, true);   // for a blink of the lamp, it looks at the camera
  for (let i = 0; i < 70; i++) { ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
}
