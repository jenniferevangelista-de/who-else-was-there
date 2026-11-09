// Planted ghosts: synthetic scans with a known answer, run through the same evidence logic the app uses.
// Writes demo/measured.json (section "planted"). These are not people and not video: they test the logic,
// not the accuracy of Presage SmartSpectra itself.
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { readFace, heldBreaths, pulseJumps, RULES } from "../src/evidence.js";
import { rng } from "../src/sample.js";

const N = 200;

function scan(kind, r) {
  const t0 = 0, t1 = 15 + Math.floor(r() * 25);        // 15 to 40 s watched
  const pulse = [], validation = [];
  for (let t = t0; t <= t1; t += 0.5) {
    let code = 0;
    if (kind === "shadow") code = r() < 0.9 ? 1 : 0;
    if (kind === "dim_living" || kind === "dim_still") code = r() < 0.6 ? 5 : 0;
    validation.push({ t, code });
  }
  const conf = { living: () => 55 + r() * 40, dim_living: () => 10 + r() * 35 }[kind];
  if (conf) for (let t = 12; t <= t1; t++) pulse.push({ t, v: 55 + r() * 40, conf: conf() });
  if (kind === "still" || kind === "dim_still") pulse.push({ t: 13, v: 0, conf: r() * 20 });
  return { t0, t1, pulse, validation };
}

const EXPECT = { living: "alive", still: "no_pulse", shadow: "no_face", dim_living: "unreadable", dim_still: "unreadable" };
const faces = {};
for (const kind of Object.keys(EXPECT)) {
  const r = rng(kind.length * 97 + 11);
  const tally = {};
  for (let i = 0; i < N; i++) { const v = readFace(scan(kind, r)).verdict; tally[v] = (tally[v] ?? 0) + 1; }
  faces[kind] = { expected: EXPECT[kind], runs: N, correct: tally[EXPECT[kind]] ?? 0, verdicts: tally, called_a_ghost: tally.no_pulse ?? 0 };
}

// held breath: plant a flat stretch of known length into a noisy breathing trace
const breath = {};
for (const hold of [1, 2, 3, 4, 6]) {
  const r = rng(hold * 31);
  let found = 0;
  for (let i = 0; i < N; i++) {
    const at = 8 + r() * 10, trace = [];
    for (let t = 0; t <= 30; t += 0.1) {
      const flat = t >= at && t < at + hold;
      trace.push({ t: Math.round(t * 10) / 10, v: flat ? 0.02 + (r() - 0.5) * 0.04 : Math.sin(2 * Math.PI * t / (3.5 + r() * 0.1)) + (r() - 0.5) * 0.1 });
    }
    if (heldBreaths(trace).length) found++;
  }
  breath[`${hold}s`] = { runs: N, detected: found, should_detect: hold >= RULES.heldBreathSec };
}

// pulse jump: a rise of known size inside 6 seconds, 1 reading per second with noise
const jumps = {};
for (const size of [0, 4, 8, 12, 16]) {
  const r = rng(size * 7 + 3);
  let found = 0;
  for (let i = 0; i < N; i++) {
    const p = [];
    for (let t = 0; t <= 40; t++) p.push({ t, v: 70 + (t >= 20 ? Math.min(size, (t - 20) * size / 6) : 0) + (r() - 0.5) * 3, conf: 80 });
    if (pulseJumps(p).length) found++;
  }
  jumps[`+${size} bpm`] = { runs: N, detected: found, should_detect: size >= RULES.pulseJumpBpm };
}

// Stress test: the same rules on worse and worse readings, to see where they stop being right.
const stress = { pulse_noise: [], breath_noise: [], bad_picture: [] };
for (const noise of [0, 3, 6, 9, 12, 18]) for (const size of [0, 4, 8, 12, 16, 24]) {
  const r = rng(noise * 101 + size * 7 + 5);
  let found = 0;
  for (let i = 0; i < N; i++) {
    const p = [];
    for (let t = 0; t <= 40; t++) p.push({ t, v: 70 + (t >= 20 ? Math.min(size, (t - 20) * size / 6) : 0) + (r() - 0.5) * noise, conf: 80 });
    if (pulseJumps(p).length) found++;
  }
  stress.pulse_noise.push({ noise_bpm: noise, jump_bpm: size, runs: N, detected: found });
}
for (const noise of [0.04, 0.1, 0.2, 0.3, 0.45, 0.7]) for (const hold of [1, 2, 3, 4, 6, 8]) {
  const r = rng(Math.round(noise * 1000) + hold * 13);
  let found = 0;
  for (let i = 0; i < N; i++) {
    const at = 8 + r() * 10, trace = [];
    for (let t = 0; t <= 30; t += 0.1) {
      const flat = t >= at && t < at + hold;
      trace.push({ t: Math.round(t * 10) / 10, v: flat ? (r() - 0.5) * noise : Math.sin(2 * Math.PI * t / (3.5 + r() * 0.1)) + (r() - 0.5) * 0.1 });
    }
    if (heldBreaths(trace).length) found++;
  }
  stress.breath_noise.push({ flat_noise: noise, hold_sec: hold, runs: N, detected: found });
}
// A living person the SDK could not read (confidence under the gate), with a growing share of poor-picture updates.
for (const poor of [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8]) {
  const r = rng(Math.round(poor * 100) + 77);
  const tally = {};
  for (let i = 0; i < N; i++) {
    const t1 = 15 + Math.floor(r() * 25), pulse = [], validation = [];
    const steps = t1 * 2 + 1;
    for (let k = 0; k < steps; k++) validation.push({ t: k / 2, code: k / steps < poor ? 5 : 0 });
    for (let t = 12; t <= t1; t++) pulse.push({ t, v: 55 + r() * 40, conf: 10 + r() * 35 });
    const v = readFace({ t0: 0, t1, pulse, validation }).verdict;
    tally[v] = (tally[v] ?? 0) + 1;
  }
  stress.bad_picture.push({ poor_share: poor, runs: N, verdicts: tally });
}

const tests = readdirSync(new URL("../tests/", import.meta.url)).filter((f) => f.endsWith(".test.js"))
  .reduce((a, f) => a + (readFileSync(new URL(`../tests/${f}`, import.meta.url), "utf8").match(/^test\(/gm) ?? []).length, 0);

const out = new URL("../demo/measured.json", import.meta.url);
mkdirSync(new URL("../demo/", import.meta.url), { recursive: true });
const doc = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : {};
doc.planted = {
  what: "Synthetic scans with a known answer, run through src/evidence.js. They test the app's logic, not Presage SmartSpectra's accuracy, and no person is in them.",
  generated_by: "npm run benchmark", runs_per_case: N, rules: RULES, faces, held_breath: breath, pulse_jump: jumps, stress,
};
doc.receipts = { unit_tests: tests, frames_saved: 0, video_recorded: false, sdk_telemetry: "off", language_model_calls: 0 };
writeFileSync(out, JSON.stringify(doc, null, 2) + "\n");
console.log(JSON.stringify({ faces, breath, jumps, tests }, null, 1));
