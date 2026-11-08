// Turns Presage SmartSpectra readings into numbered evidence for the crew.
// Pure functions: no SDK, no DOM, no clock. Every card says what was measured and by whom.
//
// A "scan" is one pass of the SDK over a recording (the whole frame) or over a region of it
// (where the Pulse-o-Scope was pointed). Each scan carries plain samples:
//   pulse:       [{ t, v, conf }]      beats per minute, SmartSpectra confidence 0..100
//   breathing:   [{ t, v, conf }]      breaths per minute
//   trace:       [{ t, v }]            live chest movement (breathing.upperTrace)
//   talking:     [{ t, on }]
//   validation:  [{ t, code }]         SmartSpectra ValidationCode over time (0 ok, 1 no face, 2 multiple faces, ...)

export const VALIDATION = Object.freeze({ OK: 0, NO_FACE: 1, MULTIPLE_FACES: 2 });

export const RULES = Object.freeze({
  minPulseConf: 50,      // a pulse reading counts from this confidence up
  minFaceShare: 0.6,     // share of validation updates that saw exactly one face, to say "a face was there"
  minWindowSec: 15,      // a region must be watched this long before "no pulse" can be said
  heldBreathSec: 3,      // flat chest trace for this long = held breath
  heldBreathFlat: 0.15,  // flat = range under 15 % of the typical breathing range
  pulseJumpBpm: 8,       // pulse gained ...
  pulseJumpSec: 10,      // ... inside this many seconds
  multiFaceMinSec: 1.0,  // "a second face" needs at least this long
});

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round1 = (x) => Math.round(x * 10) / 10;

/** Runs of consecutive validation updates with `code`, as [{t0, t1}]. */
export function validationRuns(validation, code, minSec = 0) {
  const out = [];
  let start = null, last = null;
  for (const v of validation ?? []) {
    if (v.code === code) { if (start === null) start = v.t; last = v.t; }
    else if (start !== null) { out.push({ t0: start, t1: v.t }); start = null; }
  }
  if (start !== null) out.push({ t0: start, t1: last });
  return out.filter((r) => r.t1 - r.t0 >= minSec);
}

/** What one scan says about the face it watched. */
export function readFace(scan, rules = RULES) {
  const val = scan.validation ?? [];
  const oneFace = val.filter((v) => v.code !== VALIDATION.NO_FACE).length; // every code except "no face" saw a face
  const faceShare = val.length ? oneFace / val.length : 0;
  const good = (scan.pulse ?? []).filter((p) => p.conf >= rules.minPulseConf && p.v >= 40 && p.v <= 110);
  const goodBreath = (scan.breathing ?? []).filter((b) => b.conf >= rules.minPulseConf);
  const span = scan.t1 - scan.t0;
  const maxConf = Math.max(0, ...(scan.pulse ?? []).map((p) => p.conf ?? 0));
  let verdict;
  if (faceShare < rules.minFaceShare) verdict = "no_face";
  else if (good.length) verdict = "alive";
  else if (span >= rules.minWindowSec) verdict = "no_pulse";
  else verdict = "too_short";
  return {
    verdict,
    faceShare: round1(faceShare * 100),
    pulseBpm: good.length ? round1(median(good.map((p) => p.v))) : null,
    pulseReadings: good.length,
    breathingRpm: goodBreath.length ? round1(median(goodBreath.map((b) => b.v))) : null,
    maxPulseConf: round1(maxConf),
    watchedSec: round1(span),
  };
}

/** Flat stretches of the chest trace: the person held their breath. */
export function heldBreaths(trace, rules = RULES) {
  if (!trace || trace.length < 10) return [];
  const all = trace.map((s) => s.v);
  const typical = Math.max(...all) - Math.min(...all);
  if (!(typical > 0)) return [];
  const out = [];
  let i = 0;
  while (i < trace.length) {
    let j = i, lo = trace[i].v, hi = trace[i].v;
    while (j + 1 < trace.length) {
      const v = trace[j + 1].v;
      const nlo = Math.min(lo, v), nhi = Math.max(hi, v);
      if (nhi - nlo > typical * rules.heldBreathFlat) break;
      lo = nlo; hi = nhi; j++;
    }
    const dur = trace[j].t - trace[i].t;
    if (dur >= rules.heldBreathSec) { out.push({ t0: trace[i].t, t1: trace[j].t }); i = j + 1; } else i++;
  }
  return out;
}

/** Moments the pulse climbed fast. */
export function pulseJumps(pulse, rules = RULES) {
  const good = (pulse ?? []).filter((p) => p.conf >= rules.minPulseConf);
  const out = [];
  let lastAt = -Infinity;
  for (const p of good) {
    const before = good.filter((q) => q.t >= p.t - rules.pulseJumpSec && q.t < p.t);
    if (!before.length) continue;
    const low = Math.min(...before.map((q) => q.v));
    if (p.v - low >= rules.pulseJumpBpm && p.t - lastAt > rules.pulseJumpSec) {
      out.push({ t: p.t, from: round1(low), to: round1(p.v) });
      lastAt = p.t;
    }
  }
  return out;
}

/**
 * Build the evidence locker.
 * @param {{full: object, regions: object[]}} scans  full-frame scan plus zero or more region scans
 * @returns {object[]} numbered evidence cards, in time order
 */
export function buildEvidence({ full, regions = [] }, rules = RULES) {
  const cards = [];
  if (full) {
    const f = readFace(full, rules);
    if (f.verdict === "alive") {
      cards.push({ kind: "living", t0: full.t0, t1: full.t1, value: f.pulseBpm, unit: "bpm", detail: f });
    }
    for (const r of validationRuns(full.validation, VALIDATION.MULTIPLE_FACES, rules.multiFaceMinSec)) {
      cards.push({ kind: "second_face", t0: r.t0, t1: r.t1, value: round1(r.t1 - r.t0), unit: "s" });
    }
    for (const h of heldBreaths(full.trace, rules)) {
      cards.push({ kind: "held_breath", t0: h.t0, t1: h.t1, value: round1(h.t1 - h.t0), unit: "s" });
    }
    for (const j of pulseJumps(full.pulse, rules)) {
      cards.push({ kind: "pulse_jump", t0: j.t, t1: j.t, value: round1(j.to - j.from), unit: "bpm", detail: j });
    }
  }
  for (const reg of regions) {
    const f = readFace(reg, rules);
    if (f.verdict === "too_short") continue;
    const kind = { alive: "region_alive", no_pulse: "no_pulse", no_face: "only_shadow" }[f.verdict];
    cards.push({ kind, t0: reg.t0, t1: reg.t1, value: f.verdict === "alive" ? f.pulseBpm : 0, unit: "bpm", region: reg.region, detail: f });
  }
  const ORDER = ["living", "second_face", "no_pulse", "only_shadow", "region_alive", "held_breath", "pulse_jump"];
  cards.sort((a, b) => a.t0 - b.t0 || ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
  return cards.map((c, i) => ({ id: `E${i + 1}`, measuredBy: "Presage SmartSpectra", ...c }));
}

/** A spirit line may only cite evidence that exists, and numbers in it must come from what it cites. */
export function citeOrVanish(line, evidence) {
  const ids = new Set(evidence.map((e) => e.id));
  if (!line.cites?.length) return "cites nothing";
  const cited = line.cites.filter((c) => ids.has(c));
  if (cited.length !== line.cites.length) return "cites evidence that does not exist";
  const allowed = new Set();
  for (const e of evidence.filter((x) => cited.includes(x.id))) {
    for (const n of [e.value, e.t0, e.t1]) {
      if (Number.isFinite(n)) { allowed.add(String(Math.round(n))); allowed.add(String(n)); }
    }
  }
  for (const num of String(line.text).match(/\d+(\.\d+)?/g) ?? []) {
    if (!allowed.has(num)) return `number ${num} is not in the cited evidence`;
  }
  return null;
}
