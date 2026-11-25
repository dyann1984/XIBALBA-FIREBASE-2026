import test from "node:test";
import assert from "node:assert/strict";
import { SOS_SCENARIOS } from "../lib/global-shield/sos.ts";

test("SOS covers eight unique bilingual situations with immediate and account actions", () => {
  assert.equal(SOS_SCENARIOS.length, 8);
  assert.equal(new Set(SOS_SCENARIOS.map((item) => item.id)).size, 8);
  for (const item of SOS_SCENARIOS) {
    assert.ok(item.titleEs && item.titleEn && item.actionEs && item.actionEn && item.accountEs && item.accountEn);
  }
});
