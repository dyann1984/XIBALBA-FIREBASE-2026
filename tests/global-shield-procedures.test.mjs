import test from "node:test";
import assert from "node:assert/strict";
import { ALL_INCIDENT_CATEGORIES, procedureFor } from "../lib/global-shield/procedures.ts";
import { SEED_RECORDS } from "../lib/global-shield/directory.ts";

test("cada categoria de incidente tiene un procedimiento real en es y en, nunca vacio", () => {
  for (const category of ALL_INCIDENT_CATEGORIES) {
    for (const lang of ["es", "en"]) {
      const procedure = procedureFor(category, lang);
      assert.equal(procedure.category, category);
      assert.ok(procedure.title.length > 0);
      assert.ok(procedure.steps.length >= 3, `${category}/${lang} debe tener al menos 3 pasos`);
      for (const step of procedure.steps) assert.ok(step.length > 0);
      assert.ok(procedure.disclaimer.length > 0);
    }
  }
});

test("ningun procedimiento nombra una institucion que no este en el directorio real", () => {
  const knownAgencyNames = SEED_RECORDS.map((record) => record.agencyName);
  for (const category of ALL_INCIDENT_CATEGORIES) {
    for (const lang of ["es", "en"]) {
      const procedure = procedureFor(category, lang);
      const text = `${procedure.title} ${procedure.steps.join(" ")} ${procedure.disclaimer}`;
      for (const agency of knownAgencyNames) {
        assert.equal(text.includes(agency), false, `no debe citar "${agency}" directamente`);
      }
    }
  }
});

test("al menos un registro real de cada categoria de incidente existe en algun pais", () => {
  const covered = new Set(SEED_RECORDS.flatMap((record) => record.incidentCategories));
  assert.ok(covered.has("fraude-financiero"));
  assert.ok(covered.has("phishing"));
});
