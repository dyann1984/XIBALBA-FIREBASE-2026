import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateInput, parseAssessment, promptFor } from "../lib/analysis/guardian.ts";
test("URL validation rejects credentials and non-web schemes", () => {
 assert.throws(() => validateInput("url", "https://user:pass@example.test"));
 assert.throws(() => validateInput("url", "javascript:alert(1)"));
 assert.equal(validateInput("url", "https://example.test/path"), "https://example.test/path");
});
test("response validation fails closed on invalid output", () => {
 assert.throws(() => parseAssessment('{"risk":"confirmed"}'));
 assert.equal(parseAssessment('{"risk":"medio","summary":"Señal","evidence":["urgencia"],"recommendations":["verificar"]}').risk, "medio");
});
test("URL analysis does not claim to visit the site", () => { assert.match(promptFor("url", "https://example.test"), /No tienes acceso al sitio/); });
test("original logo remains available", async () => { assert.ok((await readFile(new URL("../public/xibalba-logo.jpg", import.meta.url))).length > 0); });
