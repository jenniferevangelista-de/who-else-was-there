import test from "node:test";
import assert from "node:assert/strict";
import { buildEvidence, readFace, heldBreaths, pulseJumps, validationRuns, citeOrVanish } from "../src/evidence.js";
import { livingScan, stillFaceScan, shadowScan } from "./fixtures.js";

test("a living face reads alive with its pulse", () => {
  const f = readFace(livingScan({ ghostFrom: 999 }));
  assert.equal(f.verdict, "alive");
  assert.ok(f.pulseBpm > 70 && f.pulseBpm < 85, `pulse ${f.pulseBpm}`);
});
test("a still face watched long enough reads no_pulse", () => {
  assert.equal(readFace(stillFaceScan()).verdict, "no_pulse");
});
test("a region with no face reads no_face", () => {
  assert.equal(readFace(shadowScan()).verdict, "no_face");
});
test("a still face watched too briefly says nothing", () => {
  assert.equal(readFace(stillFaceScan({ t0: 18, t1: 25 })).verdict, "too_short");
});
test("second face windows come from the SDK's multiple-faces validation", () => {
  const runs = validationRuns(livingScan().validation, 2, 1);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].t0, 18);
});
test("held breath is a flat stretch of the chest trace", () => {
  const h = heldBreaths(livingScan().trace);
  assert.equal(h.length, 1);
  assert.ok(Math.abs(h[0].t0 - 20) <= 0.5 && h[0].t1 - h[0].t0 >= 3);
});
test("pulse jump found once, near its start", () => {
  const j = pulseJumps(livingScan().pulse);
  assert.equal(j.length, 1);
  assert.ok(j[0].t >= 22 && j[0].t <= 28, `at ${j[0].t}`);
});
test("the full case: living witness, second face, held breath, jump, no-pulse face", () => {
  const ev = buildEvidence({ full: livingScan(), regions: [stillFaceScan()] });
  const kinds = ev.map((e) => e.kind);
  for (const k of ["living", "second_face", "held_breath", "pulse_jump", "no_pulse"]) assert.ok(kinds.includes(k), k);
  assert.deepEqual(ev.map((e) => e.id), ev.map((_, i) => `E${i + 1}`));
  assert.ok(ev.every((e) => e.measuredBy === "Presage SmartSpectra"));
});
test("cite or vanish", () => {
  const ev = buildEvidence({ full: livingScan(), regions: [stillFaceScan()] });
  const np = ev.find((e) => e.kind === "no_pulse");
  assert.equal(citeOrVanish({ text: "0 beats", cites: [np.id] }, ev), null);
  assert.match(citeOrVanish({ text: "I AM HERE", cites: [] }, ev), /cites nothing/);
  assert.match(citeOrVanish({ text: "x", cites: ["E99"] }, ev), /does not exist/);
  assert.match(citeOrVanish({ text: "77 beats", cites: [np.id] }, ev), /number 77/);
});

test("a dim face with no pulse is unreadable, never a ghost", () => {
  const dim = stillFaceScan();
  dim.validation = dim.validation.map((v, i) => ({ ...v, code: i % 2 ? 5 : 0 }));   // half the updates say "too dark"
  assert.equal(readFace(dim).verdict, "unreadable");
  const ev = buildEvidence({ full: null, regions: [dim] });
  assert.equal(ev[0].kind, "unreadable");
});
