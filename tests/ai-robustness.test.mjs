import test from "node:test";
import assert from "node:assert/strict";

import { parseAssessment } from "../lib/analysis/guardian.ts";
import { errorKey, explainError, AiTimeoutError } from "../lib/analysis/errors.ts";
import { withTimeout, DEFAULT_AI_TIMEOUT_MS } from "../lib/analysis/analyze.ts";

// ---------------------------------------------------------------------------
// Error 1: Gemini con imágenes — "SyntaxError: Bad escaped character"
// ---------------------------------------------------------------------------
// Reproducido en producción el 22 de noviembre de 2026 analizando una captura
// de WhatsApp: el modelo citó un fragmento con una barra invertida que no
// forma un escape JSON válido. `parseAssessment` debe aceptar exactamente lo
// que el modelo quiso decir, no un texto distinto ni un resultado inventado.

test("parseAssessment repara una barra invertida suelta sin alterar el contenido citado", () => {
  // "\d" no es un escape JSON válido: JSON.parse lanzaría "Bad escaped character".
  const raw = '{"risk":"alto","summary":"Pide la CLABE con \\dígito verificador incorrecto","evidence":["CLABE"],"recommendations":["No respondas"]}';
  const result = parseAssessment(raw);
  assert.equal(result.risk, "alto");
  // El contenido citado se conserva literalmente: la barra invertida sigue
  // ahí, no se borró ni se interpretó como un escape distinto.
  assert.equal(result.summary, "Pide la CLABE con \\dígito verificador incorrecto");
});

test("parseAssessment repara un carácter de control sin escapar dentro de una cadena", () => {
  const withRawNewline = '{"risk":"medio","summary":"Primera línea\nSegunda línea","evidence":["urgencia"],"recommendations":["verificar"]}';
  const result = parseAssessment(withRawNewline);
  assert.equal(result.summary, "Primera línea\nSegunda línea");
});

test("parseAssessment sigue fallando cerrado ante JSON realmente irreparable", () => {
  assert.throws(() => parseAssessment('{"risk":"alto", esto no es JSON'), /formato esperado/);
});

test("parseAssessment sigue validando el esquema igual que antes (sin relación con la reparación de sintaxis)", () => {
  assert.throws(() => parseAssessment('{"risk":"confirmado"}'), /formato esperado/);
});

// ---------------------------------------------------------------------------
// Error 2: IA local que se queda cargando indefinidamente
// ---------------------------------------------------------------------------

test("withTimeout resuelve normalmente cuando la promesa gana a tiempo", async () => {
  const value = await withTimeout(Promise.resolve("ok"), 1000);
  assert.equal(value, "ok");
});

test("withTimeout rechaza con AiTimeoutError y pide abortar cuando se agota el tiempo", async () => {
  let aborted = false;
  const controller = { abort: () => { aborted = true; } };
  const neverResolves = new Promise(() => {});
  await assert.rejects(
    () => withTimeout(neverResolves, 20, /** @type {any} */ (controller)),
    (error) => error instanceof AiTimeoutError,
  );
  assert.equal(aborted, true);
});

test("DEFAULT_AI_TIMEOUT_MS es razonable: más que una respuesta real, menos que un cuelgue indefinido", () => {
  assert.ok(DEFAULT_AI_TIMEOUT_MS >= 10_000);
  assert.ok(DEFAULT_AI_TIMEOUT_MS <= 60_000);
});

test("errorKey clasifica AiTimeoutError como 'timeout', distinto de 'format' o 'generic'", () => {
  const error = new AiTimeoutError("La interpretación de IA no respondió en 20000 ms.");
  assert.equal(errorKey(error), "timeout");
  assert.match(explainError(error), /tardó demasiado/);
});
