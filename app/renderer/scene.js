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

// ------------------------------------------------------------------ the cast is drawn like the crew: soft shapes, one dark ink line
const INK = "#2a1840";
const inked = (ctx, h, k = 0.0055) => { ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, h * k); ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke(); };
function limb(ctx, h, pts, color, k = 0.03) {
  const path = () => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); };
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  path(); ctx.strokeStyle = INK; ctx.lineWidth = h * (k + 0.011); ctx.stroke();
  path(); ctx.strokeStyle = color; ctx.lineWidth = h * k; ctx.stroke();
}

// ------------------------------------------------------------------ the shadow
function faceOf(ctx, w, h, x, sway, alpha, eyes) {
  const fy = (C.region.y + C.region.h * 0.45) * h + sway * 0.5, fx = x * w;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = "#ddd6e8"; ctx.beginPath(); ctx.moveTo(fx, fy + h * 0.06);
  ctx.bezierCurveTo(fx - h * 0.05, fy + h * 0.03, fx - h * 0.046, fy - h * 0.058, fx, fy - h * 0.06);
  ctx.bezierCurveTo(fx + h * 0.046, fy - h * 0.058, fx + h * 0.05, fy + h * 0.03, fx, fy + h * 0.06); ctx.closePath(); ctx.fill();
  ctx.fillStyle = eyes ? "#ff6680" : "#16101f";
  if (eyes) { ctx.shadowColor = "#ff6680"; ctx.shadowBlur = h * 0.03; }
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(fx + s * h * 0.018, fy - h * 0.006, h * 0.012, h * 0.0065, s * 0.28, 0, 7); ctx.fill(); }
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#16101f"; ctx.lineWidth = Math.max(1, h * 0.003); ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(fx - h * 0.011, fy + h * 0.032); ctx.quadraticCurveTo(fx, fy + h * 0.027, fx + h * 0.011, fy + h * 0.032); ctx.stroke();
  ctx.restore();
}

function drawShadow(ctx, w, h, t, s) {
  if (s.alpha <= 0.01) return;
  const x = s.x * w, sway = Math.sin(t * 0.9) * h * 0.006, top = (C.region.y - 0.05) * h + sway, foot = h * 0.8;
  const shape = new Path2D();
  shape.moveTo(x, top);
  shape.bezierCurveTo(x + h * 0.085, top, x + h * 0.09, top + h * 0.11, x + h * 0.082, top + h * 0.17);
  shape.bezierCurveTo(x + h * 0.15, top + h * 0.24, x + h * 0.15, foot - h * 0.2, x + h * 0.125, foot);
  for (let i = 0; i < 6; i++) shape.quadraticCurveTo(x + h * (0.125 - (i + 0.5) * 0.0417), foot + (i % 2 ? -h * 0.045 : h * 0.03) + Math.sin(t * 2 + i) * h * 0.008, x + h * (0.125 - (i + 1) * 0.0417), foot - h * 0.008);
  shape.bezierCurveTo(x - h * 0.15, foot - h * 0.2, x - h * 0.15, top + h * 0.24, x - h * 0.082, top + h * 0.17);
  shape.bezierCurveTo(x - h * 0.09, top + h * 0.11, x - h * 0.085, top, x, top);
  shape.closePath();
  ctx.save();
  ctx.globalAlpha = s.alpha * 0.96; ctx.filter = `blur(${Math.max(1, h * 0.004)}px)`;
  const g = ctx.createLinearGradient(0, top, 0, foot); g.addColorStop(0, "#07040d"); g.addColorStop(0.65, "#0d0817"); g.addColorStop(1, "#1a1230");
  ctx.fillStyle = g; ctx.fill(shape);
  ctx.filter = "none"; ctx.globalAlpha = s.alpha * 0.34; ctx.strokeStyle = "#b39aea"; ctx.lineWidth = Math.max(1, h * 0.004); ctx.stroke(shape);
  // when it stands behind her, one long arm comes up towards her shoulder and stops short
  const reach = smooth((t - 22.3) / 1.8) * (1 - smooth((t - 25.6) / 1));
  if (reach > 0.01) {
    const sx = x + h * 0.075, sy = top + h * 0.24, tx = lerp(sx, marinaFace(t).x * w - h * 0.065, reach), ty = lerp(sy + h * 0.1, (marinaFace(t).y + 0.1) * h, reach);
    ctx.globalAlpha = s.alpha * 0.92; ctx.strokeStyle = "#0a0612"; ctx.lineCap = "round"; ctx.lineWidth = h * 0.024;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo((sx + tx) / 2, sy + h * 0.1, tx, ty); ctx.stroke();
    ctx.lineWidth = h * 0.006; for (const a of [-0.55, -0.15, 0.25, 0.65]) { ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + Math.cos(a) * h * 0.034, ty + Math.sin(a) * h * 0.034); ctx.stroke(); }
  }
  ctx.restore();
  faceOf(ctx, w, h, s.x, sway, s.alpha * 0.86, false);
}

// ------------------------------------------------------------------ Marina (face always blurred)
function drawMarina(ctx, w, h, t) {
  const m = marinaFace(t), mx = m.x * w, dx = path(t + 0.05) - path(t), moving = Math.abs(dx) > 1e-4;
  const stride = moving ? Math.sin(t * 9) : 0, bob = moving ? Math.abs(stride) * h * 0.006 : 0;
  const my = m.y * h - bob, coatOn = t < HUNG_AT, atDoor = t >= 19 && t < 26.5, U = h, feet = 0.812 * h;
  const sway = Math.sin(t * 2) * U * 0.005 + stride * U * 0.008;
  const body = coatOn ? "#d0475a" : "#a98be0", trim = coatOn ? "#9c2f42" : "#7d60bd", skin = "#f2cfb6", hairC = "#8a4230";

  ctx.save(); ctx.globalAlpha = 0.32; ctx.fillStyle = "#000"; ctx.beginPath(); ctx.ellipse(mx, feet + U * 0.006, U * 0.09, U * 0.018, 0, 0, 7); ctx.fill(); ctx.restore();

  // long hair, behind everything
  ctx.beginPath(); ctx.moveTo(mx - U * 0.078, my - U * 0.02);
  ctx.bezierCurveTo(mx - U * 0.108, my + U * 0.09, mx - U * 0.07 + sway, my + U * 0.15, mx - U * 0.098 + sway, my + U * 0.235);
  ctx.quadraticCurveTo(mx - U * 0.05 + sway, my + U * 0.25, mx - U * 0.018, my + U * 0.215);
  ctx.lineTo(mx + U * 0.018, my + U * 0.215);
  ctx.quadraticCurveTo(mx + U * 0.05 + sway, my + U * 0.25, mx + U * 0.098 + sway, my + U * 0.235);
  ctx.bezierCurveTo(mx + U * 0.07 + sway, my + U * 0.15, mx + U * 0.108, my + U * 0.09, mx + U * 0.078, my - U * 0.02);
  ctx.bezierCurveTo(mx + U * 0.08, my - U * 0.11, mx - U * 0.08, my - U * 0.11, mx - U * 0.078, my - U * 0.02);
  ctx.closePath(); ctx.fillStyle = hairC; ctx.fill(); inked(ctx, h);

  // slim legs and little heeled boots
  for (const side of [-1, 1]) {
    const lx = mx + side * U * 0.026 + side * stride * U * 0.018, kick = side * stride * U * 0.006;
    limb(ctx, h, [[lx, my + U * 0.29], [lx + kick, feet - U * 0.05]], "#4a3560", 0.021);
    ctx.beginPath(); ctx.moveTo(lx - U * 0.016 + kick, feet - U * 0.07); ctx.lineTo(lx + U * 0.016 + kick, feet - U * 0.07); ctx.lineTo(lx + U * 0.018 + kick, feet - U * 0.02);
    ctx.lineTo(lx + U * 0.036 + kick, feet - U * 0.008); ctx.lineTo(lx + U * 0.036 + kick, feet); ctx.lineTo(lx - U * 0.018 + kick, feet); ctx.closePath(); ctx.fillStyle = "#7c4a3a"; ctx.fill(); inked(ctx, h, 0.004);
  }

  // the far arm, with the bag
  limb(ctx, h, [[mx - U * 0.052, my + U * 0.105], [mx - U * 0.07, my + U * 0.19], [mx - U * 0.078, my + U * 0.26]], body, 0.026);
  ctx.beginPath(); ctx.arc(mx - U * 0.078, my + U * 0.272, U * 0.013, 0, 7); ctx.fillStyle = skin; ctx.fill(); inked(ctx, h, 0.004);
  if (coatOn) {
    ctx.beginPath(); ctx.arc(mx - U * 0.082, my + U * 0.3, U * 0.026, Math.PI, 0); ctx.strokeStyle = INK; ctx.lineWidth = U * 0.005; ctx.stroke();
    rr(ctx, mx - U * 0.122, my + U * 0.3, U * 0.08, U * 0.075, U * 0.016); ctx.fillStyle = "#c79a4e"; ctx.fill(); inked(ctx, h, 0.005);
    ctx.beginPath(); ctx.arc(mx - U * 0.082, my + U * 0.325, U * 0.007, 0, 7); ctx.fillStyle = "#fff2cc"; ctx.fill();
  }

  // a fitted coat that flares, or a soft dress once the coat is hung
  const hem = coatOn ? 0.335 : 0.3;
  ctx.beginPath(); ctx.moveTo(mx - U * 0.022, my + U * 0.075);
  ctx.quadraticCurveTo(mx - U * 0.056, my + U * 0.08, mx - U * 0.056, my + U * 0.115);
  ctx.quadraticCurveTo(mx - U * 0.052, my + U * 0.16, mx - U * 0.036, my + U * 0.195);
  ctx.quadraticCurveTo(mx - U * 0.066, my + U * 0.26, mx - U * 0.09 - stride * U * 0.008, my + U * hem);
  ctx.quadraticCurveTo(mx, my + U * (hem + 0.03), mx + U * 0.09 + stride * U * 0.008, my + U * hem);
  ctx.quadraticCurveTo(mx + U * 0.066, my + U * 0.26, mx + U * 0.036, my + U * 0.195);
  ctx.quadraticCurveTo(mx + U * 0.052, my + U * 0.16, mx + U * 0.056, my + U * 0.115);
  ctx.quadraticCurveTo(mx + U * 0.056, my + U * 0.08, mx + U * 0.022, my + U * 0.075);
  ctx.closePath(); ctx.fillStyle = body; ctx.fill(); inked(ctx, h);
  rr(ctx, mx - U * 0.039, my + U * 0.187, U * 0.078, U * 0.018, U * 0.008); ctx.fillStyle = trim; ctx.fill(); inked(ctx, h, 0.004);
  if (coatOn) {
    ctx.strokeStyle = trim; ctx.lineWidth = U * 0.004; ctx.beginPath(); ctx.moveTo(mx, my + U * 0.09); ctx.lineTo(mx, my + U * (hem + 0.012)); ctx.stroke();
    ctx.fillStyle = "#f5d98a"; for (const y of [0.125, 0.16, 0.24, 0.28]) { ctx.beginPath(); ctx.arc(mx + U * 0.014, my + U * y, U * 0.0055, 0, 7); ctx.fill(); }
  }

  // the near arm: at the door it reaches for the handle and does not get there
  const hand = atDoor ? [mx + U * 0.112, my + U * 0.155] : [mx + U * 0.078, my + U * 0.262];
  const elbow = atDoor ? [mx + U * 0.082, my + U * 0.14] : [mx + U * 0.072, my + U * 0.19];
  limb(ctx, h, [[mx + U * 0.052, my + U * 0.105], elbow, hand], body, 0.026);
  ctx.beginPath(); ctx.arc(hand[0], hand[1], U * 0.013, 0, 7); ctx.fillStyle = skin; ctx.fill(); inked(ctx, h, 0.004);
  if (coatOn && t < 26.5) { ctx.strokeStyle = "#e6b84e"; ctx.lineWidth = U * 0.005; ctx.beginPath(); ctx.moveTo(hand[0], hand[1] + U * 0.01); ctx.lineTo(hand[0] + U * 0.004, hand[1] + U * 0.04); ctx.stroke(); }

  // neck, scarf, the face (always blurred), then her fringe over it
  ctx.fillStyle = skin; ctx.fillRect(mx - U * 0.016, my + U * 0.05, U * 0.032, U * 0.03);
  if (coatOn) { rr(ctx, mx - U * 0.04, my + U * 0.062, U * 0.08, U * 0.032, U * 0.014); ctx.fillStyle = "#f0c878"; ctx.fill(); inked(ctx, h, 0.004); }
  ctx.save(); ctx.filter = `blur(${Math.max(2, h * 0.011)}px)`;
  ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(mx, my, U * 0.06, U * 0.068, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#f19bb0aa"; ctx.beginPath(); ctx.ellipse(mx, my + U * 0.018, U * 0.04, U * 0.016, 0, 0, 7); ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(mx - U * 0.069, my + U * 0.02);
  ctx.bezierCurveTo(mx - U * 0.08, my - U * 0.09, mx + U * 0.08, my - U * 0.1, mx + U * 0.069, my + U * 0.02);
  ctx.quadraticCurveTo(mx + U * 0.05, my - U * 0.045, mx + U * 0.008, my - U * 0.052);
  ctx.quadraticCurveTo(mx - U * 0.04, my - U * 0.03, mx - U * 0.069, my + U * 0.02);
  ctx.closePath(); ctx.fillStyle = hairC; ctx.fill(); inked(ctx, h);
  ctx.fillStyle = "#f5d98a"; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(mx + s * U * 0.068, my + U * 0.04, U * 0.0065, 0, 7); ctx.fill(); }
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
