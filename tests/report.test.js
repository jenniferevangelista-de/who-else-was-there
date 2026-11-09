import test from "node:test";
import assert from "node:assert/strict";
import { buildReport } from "../src/report.js";

const steady = (n, v = 80, conf = 90) => Array.from({ length: n }, (_, i) => ({ t: i + 10, v, conf }));

test("a confident pulse gives a real median and the time it was first found", () => {
  const r = buildReport({ t0: 0, t1: 60, pulse: [{ t: 5, v: 200, conf: 10 }, ...steady(20)], trace: [], blinks: 12 });
  assert.equal(r.alive, true);
  assert.equal(r.pulse.median, 80);
  assert.equal(r.pulse.max, 80);
  assert.equal(r.pulse.readings, 21);
  assert.equal(r.pulse.confident, 20);
  assert.equal(r.pulse.firstAt, 10);
  assert.equal(r.blinksPerMin, 12);
  assert.equal(r.timeline[0].kind, "first_pulse");
});

test("weak readings alone never claim a heartbeat", () => {
  const r = buildReport({ t0: 0, t1: 30, pulse: steady(8, 95, 20), trace: [] });
  assert.equal(r.alive, false);
  assert.equal(r.pulse.median, null);
  assert.deepEqual(r.pulse.series, []);
  assert.equal(r.timeline.length, 0);
});

test("a jump right after the glass stops is the player's reaction", () => {
  const pulse = [...steady(6, 70), { t: 17, v: 90, conf: 90 }];
  assert.equal(buildReport({ t0: 0, t1: 30, pulse, trace: [] }, { glassAt: 14 }).jumpedAfterGlass, true);
  assert.equal(buildReport({ t0: 0, t1: 30, pulse, trace: [] }, { glassAt: 2 }).jumpedAfterGlass, false);
});

test("the simulated session has no SDK data and still builds", () => {
  const r = buildReport({ t0: 0, t1: 20, pulse: steady(5, 70, 85), trace: [] }, { simulated: true });
  assert.equal(r.simulated, true);
  assert.equal(r.breathing.readings, 0);
  assert.equal(r.sdkResponses, null);
  assert.equal(r.readyPct, null);
});

test("face checks are counted with their share of the session", () => {
  const r = buildReport({ t0: 0, t1: 20, pulse: [], trace: [], validation: [{ t: 1, code: 0 }, { t: 2, code: 0 }, { t: 3, code: 0 }, { t: 4, code: 7 }] });
  assert.deepEqual(r.checks, [{ code: 0, count: 3, pct: 75 }, { code: 7, count: 1, pct: 25 }]);
  assert.equal(r.readyPct, 75);
});

const checks = (ok, second) => [...Array(ok).fill({ t: 1, code: 0 }), ...Array(second).fill({ t: 2, code: 2 })];

test("one face with a pulse means no spirit, even if a second face flickers for a moment", () => {
  const r = buildReport({ t0: 0, t1: 60, pulse: steady(10), trace: [], validation: checks(99, 1) });
  assert.deepEqual(r.spirit, { result: "none", secondFacePct: 1 });
});

test("a second face that stays in the frame is called out", () => {
  const r = buildReport({ t0: 0, t1: 60, pulse: steady(10), trace: [], validation: checks(70, 30) });
  assert.deepEqual(r.spirit, { result: "second_face", secondFacePct: 30 });
});

test("without a pulse to trust, the result is inconclusive and never a clean bill", () => {
  assert.equal(buildReport({ t0: 0, t1: 60, pulse: steady(10, 80, 20), trace: [] }).spirit.result, "inconclusive");
});

test("long sessions are thinned for the chart, not for the numbers", () => {
  const r = buildReport({ t0: 0, t1: 900, pulse: steady(1000), trace: [] });
  assert.equal(r.pulse.confident, 1000);
  assert.equal(r.pulse.series.length, 240);
});

test("the report only ever holds numbers and words", () => {
  const r = buildReport({ t0: 0, t1: 20, pulse: steady(5), trace: [], frames: ["image"], apiKey: "x" }, { stats: { metrics: 4, errors: [] } });
  const text = JSON.stringify(r);
  assert.equal(text.includes("image"), false);
  assert.equal(text.includes("apiKey"), false);
  assert.equal(r.sdkResponses, 4);
});
