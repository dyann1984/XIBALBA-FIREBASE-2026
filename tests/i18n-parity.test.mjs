// Comprobación automatizada de paridad ES/EN del diccionario de la interfaz.
//
// `tsc --noEmit` ya rechaza la compilación si falta o sobra una clave (ver el
// comentario al inicio de `lib/i18n/dictionary.ts`: `en: Dictionary` se tipa
// como `typeof es`). Esta prueba cubre lo que TypeScript no puede ver en
// tiempo de compilación: valores vacíos y textos que quedaron idénticos en
// los dos idiomas (candidatos a no haberse traducido de verdad).

import test from 'node:test';
import assert from 'node:assert/strict';
import { es, en } from '../lib/i18n/dictionary.ts';

// Idénticos a propósito: nombres propios de los agentes, la marca, URLs y
// palabras técnicas que son iguales en inglés y en español.
const ALLOWED_IDENTICAL = new Set([
  'analyze.kindUrl', // "URL · HUN CAMÉ" — ni la sigla ni el agente se traducen
  'evidence.statusError', // "error" es igual en ambos idiomas
  'globalShield.incidentPhishing', // "Phishing" es igual en ambos idiomas
]);

// Vacíos a propósito en es: el motor determinista y los casos de demo ya
// están en español, así que la UI en español no necesita una aclaración que
// sí hace falta en inglés (ver el comentario al inicio del archivo).
const ALLOWED_EMPTY_ES = new Set(['analyze.demoLanguageNote', 'evidence.untranslated']);

function collectLeaves(node, prefix, out) {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') {
      collectLeaves(value, path, out);
    } else {
      out.set(path, value);
    }
  }
}

test('es y en tienen exactamente las mismas claves (sin huecos ni sobrantes)', () => {
  const esLeaves = new Map();
  const enLeaves = new Map();
  collectLeaves(es, '', esLeaves);
  collectLeaves(en, '', enLeaves);

  const esKeys = new Set(esLeaves.keys());
  const enKeys = new Set(enLeaves.keys());
  const missingInEn = [...esKeys].filter((k) => !enKeys.has(k));
  const missingInEs = [...enKeys].filter((k) => !esKeys.has(k));

  assert.deepEqual(missingInEn, [], `Claves presentes en es pero no en en: ${missingInEn.join(', ')}`);
  assert.deepEqual(missingInEs, [], `Claves presentes en en pero no en es: ${missingInEs.join(', ')}`);
});

test('ningún texto de la interfaz queda vacío en es o en', () => {
  const esLeaves = new Map();
  const enLeaves = new Map();
  collectLeaves(es, '', esLeaves);
  collectLeaves(en, '', enLeaves);

  const emptyEs = [...esLeaves.entries()]
    .filter(([k, v]) => typeof v === 'string' && !v.trim() && !ALLOWED_EMPTY_ES.has(k))
    .map(([k]) => k);
  const emptyEn = [...enLeaves.entries()].filter(([, v]) => typeof v === 'string' && !v.trim()).map(([k]) => k);

  assert.deepEqual(emptyEs, [], `Claves vacías en es: ${emptyEs.join(', ')}`);
  assert.deepEqual(emptyEn, [], `Claves vacías en en: ${emptyEn.join(', ')}`);
});

test('ningún texto queda sin traducir (idéntico en es y en) fuera de la lista permitida', () => {
  const esLeaves = new Map();
  const enLeaves = new Map();
  collectLeaves(es, '', esLeaves);
  collectLeaves(en, '', enLeaves);

  const unexpectedIdentical = [...esLeaves.entries()]
    .filter(([key, value]) => typeof value === 'string' && value.trim() && value === enLeaves.get(key))
    .map(([key]) => key)
    .filter((key) => !ALLOWED_IDENTICAL.has(key));

  assert.deepEqual(
    unexpectedIdentical,
    [],
    `Textos idénticos en es/en, posible traducción faltante: ${unexpectedIdentical.join(', ')}`,
  );
});
