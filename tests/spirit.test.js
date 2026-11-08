import test from "node:test";
import assert from "node:assert/strict";
import { buildEvidence } from "../src/evidence.js";
import { answer, reading, QUESTIONS } from "../src/spirit.js";
import { sampleScans, livingScan, shadowScan } from "../src/sample.js";

const ev = buildEvidence(sampleScans());

test("every question gets an answer that cites existing evidence", () => {
  for (const q of QUESTIONS) {
    const a = answer(q.id, ev);
    assert.ok(!a.vanished, `${q.id} vanished: ${a.bigotes}`);
    assert.ok(a.cites.length > 0);
    assert.ok(/^[A-Z0-9 ]+$/.test(a.board) && a.board.split(" ").length <= 3, a.board);
  }
});
test("are you alive: NO when a face had no pulse", () => {
  assert.equal(answer("alive", ev).board, "NO");
});
test("only a shadow: the spirit says it has no face", () => {
  const e2 = buildEvidence({ full: livingScan({ ghostFrom: 999 }), regions: [shadowScan()] });
  assert.equal(answer("alive", e2).board, "NO FACE");
});
test("no evidence: the glass does not move", () => {
  assert.equal(answer("who", []).vanished, true);
});
test("the reading keeps only lines that pass cite or vanish", () => {
  const r = reading(ev);
  assert.ok(r.length >= 4);
  for (const l of r) assert.ok(l.cites.length);
});
