// Sample SmartSpectra-like scans. Used by the tests and by replay mode until the real recording is measured.
// Every screen that shows these numbers is labelled SAMPLE.
export function rng(seed = 3) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/** A living person: pulse ~72, a jump at `jumpAt`, held breath at `holdAt`, a second face from `ghostFrom`. */
export function livingScan({ dur = 45, jumpAt = 22, holdAt = 20, ghostFrom = 18, ghostTo = 40, seed = 3 } = {}) {
  const r = rng(seed);
  const pulse = [], breathing = [], trace = [], validation = [], talking = [];
  for (let t = 12; t <= dur; t++) pulse.push({ t, v: 72 + (t >= jumpAt ? Math.min(12, (t - jumpAt) * 2) : 0) + (r() - 0.5) * 2, conf: 85 });
  for (let t = 30; t <= dur; t++) breathing.push({ t, v: 14 + (r() - 0.5), conf: 80 });
  for (let t = 0; t <= dur; t += 0.1) {
    const held = t >= holdAt && t < holdAt + 4;
    trace.push({ t: Math.round(t * 10) / 10, v: held ? 0.02 : Math.sin(2 * Math.PI * t / 4.3) });
  }
  for (let t = 0; t <= dur; t += 0.5) validation.push({ t, code: t >= ghostFrom && t < ghostTo ? 2 : 0 });
  return { t0: 0, t1: dur, pulse, breathing, trace, validation, talking };
}

/** A region with a face and no pulse (a portrait, a mask, a synthetic face). */
export function stillFaceScan({ t0 = 18, t1 = 40 } = {}) {
  const validation = [];
  for (let t = t0; t <= t1; t += 0.5) validation.push({ t, code: 0 });
  return { t0, t1, region: { x: 0.72, y: 0.18, w: 0.16, h: 0.3 }, pulse: [{ t: t0 + 13, v: 0, conf: 0 }], breathing: [], trace: [], validation };
}

/** A region with no face at all (a coat, a curtain, a shadow). */
export function shadowScan({ t0 = 18, t1 = 40 } = {}) {
  const validation = [];
  for (let t = t0; t <= t1; t += 0.5) validation.push({ t, code: 1 });
  return { t0, t1, region: { x: 0.1, y: 0.2, w: 0.2, h: 0.5 }, pulse: [], breathing: [], trace: [], validation };
}

/** The sample case "The Door": Marina is about to go out, stops at the door, and a shape with a face stands behind her from 8 s to 38 s. */
export const SAMPLE_CASE = {
  sample: true,
  durationSec: 45,
  shadowInAt: 8, stopAt: 21, shadowOutAt: 38,
  region: { x: 0.08, y: 0.2, w: 0.14, h: 0.24 },
};
export function sampleScans() {
  const c = SAMPLE_CASE;
  return {
    full: livingScan({ dur: c.durationSec, jumpAt: 22, holdAt: c.stopAt, ghostFrom: c.shadowInAt, ghostTo: c.shadowOutAt }),
    regions: [{ ...stillFaceScan({ t0: c.shadowInAt, t1: c.shadowOutAt }), region: c.region }],
  };
}
