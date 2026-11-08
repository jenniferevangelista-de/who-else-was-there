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

import { spiritFor, matchQuestion, roomEvidence } from "../src/spirit.js";
import { heldBreaths, pulseJumps } from "../src/evidence.js";

test("the spirit card comes from the evidence", () => {
  const s = spiritFor(ev);
  assert.equal(s.archetype, "The Guardian");
  assert.ok(s.cites.length === 2);
  assert.equal(spiritFor([]), null);
});
test("free text finds the right question, in English or Portuguese", () => {
  assert.equal(matchQuestion("Who are you?"), "who");
  assert.equal(matchQuestion("você está viva?"), "alive");
  assert.equal(matchQuestion("why did she stop at the door"), "why");
  assert.equal(matchQuestion("onde você está agora"), "where");
  assert.equal(matchQuestion("tchau"), "bye");
  assert.equal(matchQuestion("banana"), null);
});
test("room evidence: your pulse, your held breath, your jump", () => {
  const scan = sampleScans().full;
  const r = roomEvidence(scan, heldBreaths, pulseJumps);
  assert.deepEqual(r.map((e) => e.kind), ["you_alive", "you_held_breath", "you_jumped"]);
  assert.ok(r.every((e) => e.id.startsWith("R")));
});

test("the last answer: I AM HERE, citing the face that never left", () => {
  const a = answer("return", ev);
  assert.equal(a.board, "I AM HERE");
  assert.ok(!a.vanished);
  assert.equal(ev.find((e) => e.id === a.cites[0]).kind, "no_pulse");
  assert.equal(answer("return", []).vanished, true);
});
