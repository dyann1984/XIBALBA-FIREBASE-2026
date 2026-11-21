import test from "node:test";
import assert from "node:assert/strict";
import {
  SEED_RECORDS,
  assertValidRecord,
  recordsFor,
  statusFor,
} from "../lib/global-shield/directory.ts";

test("cada registro de la semilla pasa su propia validación", () => {
  for (const record of SEED_RECORDS) {
    assert.doesNotThrow(() => assertValidRecord(record), `${record.id} debería ser válido`);
  }
});

test("un registro sin fuentes no es válido", () => {
  assert.throws(() =>
    assertValidRecord({
      id: "XX-sin-fuente",
      countryCode: "XX",
      incidentCategories: ["otro"],
      agencyName: "Agencia inventada",
      channels: [{ kind: "telefono", value: "+1-000-000-0000", languages: ["en"] }],
      sourceUrls: [],
      lastVerifiedAt: "2026-11-19",
      status: "en-revision",
    }),
  );
});

test('"verificado" exige 2 fuentes de dominios distintos, nunca se acepta con una sola', () => {
  assert.throws(() =>
    assertValidRecord({
      id: "XX-una-fuente",
      countryCode: "XX",
      incidentCategories: ["otro"],
      agencyName: "Agencia con una sola fuente",
      channels: [{ kind: "telefono", value: "+1-000-000-0000", languages: ["en"] }],
      sourceUrls: ["https://solo-un-dominio.gob.xx"],
      lastVerifiedAt: "2026-11-19",
      status: "verificado",
    }),
  );
  assert.doesNotThrow(() =>
    assertValidRecord({
      id: "XX-dos-fuentes",
      countryCode: "XX",
      incidentCategories: ["otro"],
      agencyName: "Agencia con dos fuentes",
      channels: [{ kind: "telefono", value: "+1-000-000-0000", languages: ["en"] }],
      sourceUrls: ["https://a.gob.xx", "https://b.otra-fuente.xx"],
      lastVerifiedAt: "2026-11-19",
      status: "verificado",
    }),
  );
});

test("un registro sin ningún canal de ayuda no es válido", () => {
  assert.throws(() =>
    assertValidRecord({
      id: "XX-sin-canal",
      countryCode: "XX",
      incidentCategories: ["otro"],
      agencyName: "Agencia sin canal",
      channels: [],
      sourceUrls: ["https://a.gob.xx", "https://b.otra-fuente.xx"],
      lastVerifiedAt: "2026-11-19",
      status: "verificado",
    }),
  );
});

test("recordsFor devuelve solo los registros reales de ese país, nunca inventa", () => {
  assert.equal(recordsFor("MX").length > 0, true);
  assert.equal(recordsFor("ZZ").length, 0);
});

test("statusFor refleja el estado real: verificado, en revisión, o pendiente sin ningún dato", () => {
  assert.equal(statusFor("US"), "verificado");
  assert.equal(statusFor("ES"), "en-revision");
  assert.equal(statusFor("ZZ"), "pendiente");
});
