import test from "node:test";
import assert from "node:assert/strict";
import { SOS_STEPS, sosQuickSummary } from "../lib/global-shield/sos.ts";

test("SOS XIBALBA expone los 4 pasos bilingues de contencion inmediata", () => {
  assert.equal(SOS_STEPS.length, 4);
  for (const step of SOS_STEPS) {
    assert.ok(step.titleEs && step.titleEn && step.detailEs && step.detailEn);
  }
});

test("sosQuickSummary devuelve un canal oficial real para MX y null para pais sin registros", () => {
  const mx = sosQuickSummary("MX");
  assert.ok(mx.primaryRecord);
  assert.equal(mx.primaryRecord.countryCode, "MX");

  const zz = sosQuickSummary("ZZ");
  assert.equal(zz.primaryRecord, null);
});
