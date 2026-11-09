import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The SDK keeps a single callback per event, so registering one twice silently drops the first (the live pulse went missing this way).
test("presage.js registers each SDK event once", () => {
  const src = readFileSync("app/renderer/presage.js", "utf8");
  for (const event of ["metrics", "validationStatus", "processingStatus"]) {
    assert.equal(src.split(`sdk.on("${event}"`).length - 1, 1, event);
  }
});
