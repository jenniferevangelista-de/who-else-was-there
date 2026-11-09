// The session report: what the detector read while the camera was on, as plain numbers.
// Pure on purpose (no DOM, no SDK), so it can be tested and so nothing but numbers can end up in it.
import { heldBreaths, pulseJumps } from "./evidence.js";

export const MIN_CONF = 50;
const MAX_POINTS = 240;
const SECOND_FACE = 2;            // the SDK's kMultipleFacesFound
const SECOND_FACE_MIN_PCT = 10;   // a passing flicker is not a visitor: it has to stay for a tenth of the session
const round1 = (v) => Math.round(v * 10) / 10;
const average = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function thin(points) {
  if (points.length <= MAX_POINTS) return points;
  const step = (points.length - 1) / (MAX_POINTS - 1);
  return Array.from({ length: MAX_POINTS }, (_, i) => points[Math.round(i * step)]);
}

/** One vital sign: only readings the SDK was confident about count towards the numbers. */
function vital(list = []) {
  const good = list.filter((p) => p.conf >= MIN_CONF), vs = good.map((p) => p.v), confs = list.map((p) => p.conf ?? 0);
  return {
    readings: list.length, confident: good.length,
    median: vs.length ? round1(median(vs)) : null,
    min: vs.length ? round1(Math.min(...vs)) : null,
    max: vs.length ? round1(Math.max(...vs)) : null,
    meanConf: confs.length ? Math.round(average(confs)) : null,
    maxConf: confs.length ? Math.round(Math.max(...confs)) : null,
    firstAt: good.length ? round1(good[0].t) : null,
    series: thin(good.map((p) => ({ t: round1(p.t), v: round1(p.v) }))),
  };
}

function validation(list = []) {
  const counts = new Map();
  for (const { code } of list) counts.set(code, (counts.get(code) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).map(([code, count]) => ({ code, count, pct: Math.round((100 * count) / list.length) }));
}

/**
 * @param scan what the collector gathered: pulse, breathing, trace, talking, validation, blinks, expressions
 * @param opts source: camera or video; stats: the SDK session counters; simulated: true when no SDK ran; glassAt: when the glass stopped; when: ISO date
 */
export function buildReport(scan, { stats = null, simulated = false, glassAt = null, when = null, source = "camera" } = {}) {
  const seconds = Math.max(0, (scan.t1 ?? 0) - (scan.t0 ?? 0));
  const pulse = vital(scan.pulse), breathing = vital(scan.breathing);
  const held = heldBreaths(scan.trace ?? []).map((h) => ({ t0: round1(h.t0), t1: round1(h.t1), seconds: round1(h.t1 - h.t0) }));
  const jumps = pulseJumps(scan.pulse ?? []).map((j) => ({ t: round1(j.t), from: j.from, to: j.to, rise: round1(j.to - j.from) }));
  const talking = scan.talking ?? [];
  const checks = validation(scan.validation);
  const expressions = Object.entries(scan.expressions ?? (scan.expression ? { [scan.expression]: 1 } : {})).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));

  const timeline = [
    ...(pulse.firstAt === null ? [] : [{ t: pulse.firstAt, kind: "first_pulse", value: pulse.series[0].v, unit: "bpm" }]),
    ...held.map((h) => ({ t: h.t0, kind: "held_breath", value: h.seconds, unit: "s" })),
    ...jumps.map((j) => ({ t: j.t, kind: "pulse_jump", value: j.rise, unit: "bpm" })),
    ...(glassAt === null ? [] : [{ t: round1(glassAt), kind: "glass_stopped", value: null, unit: "" }]),
  ].sort((a, b) => a.t - b.t);

  return {
    source, when, simulated, seconds: round1(seconds), alive: pulse.confident > 0,
    pulse, breathing, chestPoints: scan.trace?.length ?? 0,
    blinks: scan.blinks ?? 0, blinksPerMin: seconds >= 10 ? Math.round(((scan.blinks ?? 0) * 60) / seconds) : null,
    held, longestHold: held.length ? Math.max(...held.map((h) => h.seconds)) : null,
    jumps, glassAt: glassAt === null ? null : round1(glassAt),
    jumpedAfterGlass: glassAt !== null && jumps.some((j) => j.t >= glassAt && j.t - glassAt < 8),
    talkingSamples: talking.length, talkingPct: talking.length ? Math.round((100 * talking.filter((k) => k.on).length) / talking.length) : null,
    expressions, checks, checksTotal: scan.validation?.length ?? 0,
    readyPct: checks.find((c) => c.code === 0)?.pct ?? null,
    sdkResponses: stats?.metrics ?? scan.responses ?? null, sdkErrors: stats?.errors?.length ?? null,
    spirit: spiritResult(pulse, checks),
    timeline,
  };
}

/** The final call rests on what was measured: a face that stays in the frame beside yours, or no pulse to trust at all. */
function spiritResult(pulse, checks) {
  const second = checks.find((c) => c.code === SECOND_FACE);
  const secondFacePct = second?.pct ?? 0;
  const result = secondFacePct >= SECOND_FACE_MIN_PCT ? "second_face" : pulse.confident ? "none" : "inconclusive";
  return { result, secondFacePct };
}
