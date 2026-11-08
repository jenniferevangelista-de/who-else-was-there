import test from "node:test";
import assert from "node:assert/strict";
import { sampleFromMetrics, tsToNumber, firstTimestampUs } from "../src/signals.js";

const T0 = 1_700_000_000_000_000;
const payload = {
  cardio: { pulseRate: [{ value: 71, confidence: 88, timestamp: T0 + 9_000_000 }, { value: 73, confidence: 90, timestamp: T0 + 10_000_000 }] },
  breathing: {
    rate: [{ value: 14.5, confidence: 70, timestamp: T0 + 10_000_000 }],
    upperTrace: [{ value: 0.1, timestamp: T0 + 9_900_000 }, { value: 0.3, timestamp: T0 + 10_200_000 }],
  },
  face: { talking: [{ detected: true, timestamp: T0 + 10_100_000 }] },
};

test("reads the newest pulse, breathing, talking and trace", () => {
  const s = sampleFromMetrics(payload, T0);
  assert.equal(s.pulse, 73); assert.equal(s.pulseConf, 90);
  assert.equal(s.breathing, 14.5); assert.equal(s.talking, true);
  assert.equal(s.trace.length, 2);
  assert.ok(Math.abs(s.t - 10.2) < 1e-9);
});
test("empty or partial payloads are safe", () => {
  assert.deepEqual(sampleFromMetrics(null), { t: null, trace: [] });
  const s = sampleFromMetrics({ breathing: { rate: [] } });
  assert.equal(s.pulse, undefined); assert.equal(s.t, null);
});
test("protobuf Long timestamps", () => {
  assert.equal(tsToNumber({ low: 5, high: 1 }), 4294967301);
  assert.equal(tsToNumber({ toNumber: () => 42 }), 42);
  assert.equal(tsToNumber(10n), 10);
  assert.equal(firstTimestampUs(payload), T0 + 9_000_000);
});
