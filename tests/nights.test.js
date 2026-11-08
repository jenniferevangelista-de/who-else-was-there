import test from "node:test";
import assert from "node:assert/strict";
import { sampleMonth, nightKind, monthTotals } from "../src/nights.js";

test("night kinds come from face counts", () => {
  assert.equal(nightKind({ faces: 0 }), "empty");
  assert.equal(nightKind({ faces: 1, stillFaces: 0 }), "alone");
  assert.equal(nightKind({ faces: 2, stillFaces: 0 }), "visitor");
  assert.equal(nightKind({ faces: 2, stillFaces: 1 }), "no_pulse");
  assert.equal(nightKind({ locked: true }), "locked");
});
test("the sample month has exactly one night with a still face, and it is the case", () => {
  const m = sampleMonth();
  assert.equal(m.length, 30);
  const still = m.filter((n) => n.kind === "no_pulse");
  assert.equal(still.length, 1);
  assert.equal(still[0].date, "2026-11-02");
  assert.equal(still[0].caseId, "the-door");
});
test("totals count only opened nights", () => {
  const t = monthTotals(sampleMonth());
  assert.equal(t.opened, 28);
  assert.equal(t.stillFaces, 1);
});
