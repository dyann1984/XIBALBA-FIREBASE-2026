// Pruebas de la fase de finalización:
//   · catálogo de instituciones por código CLABE y discrepancia de banco,
//   · historial de análisis (saneado, límites y almacenamiento no confiable),
//   · casos de demostración.
//
// Todos los datos son ficticios. Las CLABE se construyen con `buildClabe` a
// partir de dígitos de relleno y la tarjeta es el número de prueba público
// 4111 1111 1111 1111. Ningún número corresponde a una cuenta real.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { auditFinancial } from '../lib/analysis/audit.ts';
import { auditCoordinated } from '../lib/analysis/coordinator.ts';
import { combineRisk } from '../lib/analysis/risk.ts';
import { buildClabe, findFinancialIdentifiers } from '../lib/analysis/finance.ts';
import {
  CLABE_INSTITUTIONS,
  describeInstitution,
  institutionMismatch,
  institutionName,
  mentionedInstitutions,
} from '../lib/analysis/clabe-institutions.ts';
import {
  append,
  clear,
  describeKind,
  describeWhen,
  HISTORY_KEY,
  HISTORY_LIMIT,
  isEntry,
  load,
  maskSensitive,
  previewOf,
  PREVIEW_LIMIT,
  save,
  summarize,
} from '../lib/history.ts';

const CLABE_AZTECA = buildClabe('12700000000000000'); // 127 · Banco Azteca
const CLABE_BANAMEX = buildClabe('00212345678901234'); // 002 · Citibanamex
const CLABE_DESCONOCIDA = buildClabe('99900000000000000'); // 999 · fuera del catálogo
const find = (audit, id) => audit.indicators.find((item) => item.id === id);

// ---------------------------------------------------------------------------
// 1. Catálogo de instituciones
// ---------------------------------------------------------------------------

test('el catálogo nombra a una institución conocida y declara la que no lo está', () => {
  assert.equal(institutionName('012'), 'BBVA México');
  assert.equal(institutionName('999'), null);
  assert.match(describeInstitution('012'), /BBVA México/);
  assert.match(describeInstitution('999'), /no identificada/);
  // Un código ausente nunca se adivina con el nombre de otra institución.
  assert.doesNotMatch(describeInstitution('999'), /BBVA|Banamex|Santander/);
});

test('cada entrada del catálogo está bien formada y ningún alias se repite', () => {
  const alias = new Map();
  for (const [code, institution] of Object.entries(CLABE_INSTITUTIONS)) {
    assert.match(code, /^\d{3}$/, `el código ${code} no tiene 3 dígitos`);
    assert.ok(institution.name.trim().length > 0, `${code} no tiene nombre`);
    for (const value of institution.aliases ?? []) {
      assert.equal(value, value.toLowerCase(), `el alias «${value}» debe ir en minúsculas`);
      assert.doesNotMatch(value, /[áéíóúñ]/, `el alias «${value}» debe ir sin acentos`);
      assert.ok(!alias.has(value), `el alias «${value}» está en ${alias.get(value)} y en ${code}`);
      alias.set(value, code);
    }
  }
});

test('los nombres comunes no se confunden con una institución', () => {
  // «oxxo» y «cuenca» aparecen en frases que no hablan de esas instituciones:
  // por eso no son alias de nadie.
  assert.deepEqual(mentionedInstitutions('Deposita en efectivo en el OXXO de la esquina'), []);
  assert.deepEqual(mentionedInstitutions('Vivo cerca de la cuenca del río'), []);
  assert.deepEqual(mentionedInstitutions('Mañana te pago, no te preocupes'), []);
  assert.deepEqual(mentionedInstitutions(''), []);
  // Una mención real sí se reconoce, con acentos o sin ellos.
  assert.deepEqual(mentionedInstitutions('Soy de Banco Azteca'), ['127']);
  assert.deepEqual(mentionedInstitutions('tu cuenta BBVA'), ['012']);
});

test('no hay discrepancia cuando el banco nombrado es el de la cuenta', () => {
  assert.equal(institutionMismatch(`Deposita a mi cuenta BBVA ${buildClabe('01200000000000777')}`, ['012']), null);
  // Sin institución reconocida en el texto no hay nada que comparar.
  assert.equal(institutionMismatch('Deposita aquí por favor', ['012']), null);
  // Un código fuera del catálogo no genera discrepancia: no se sabe de quién es.
  assert.equal(institutionMismatch('Soy de BBVA', ['999']), null);
});

test('VUCUB CAMÉ avisa cuando la cuenta no es del banco que nombra el mensaje', () => {
  const audit = auditFinancial(
    `Le hablamos de Santander, deposite a la CLABE ${CLABE_AZTECA} para proteger su dinero.`,
  );
  const señal = find(audit, 'clabe-institucion-discrepante');
  assert.ok(señal, 'debe emitirse la discrepancia de institución');
  assert.equal(señal.status, 'sospechoso');
  assert.equal(señal.severity, 'medio');
  assert.equal(señal.classification, 'determinista');
  assert.match(señal.evidence, /Santander/);
  assert.match(señal.evidence, /Banco Azteca/);
  // No se presenta como prueba de fraude.
  assert.match(señal.limitation, /No es prueba de fraude/);
});

test('el nombre de la institución nunca baja el riesgo ni expone la cuenta', () => {
  const audit = auditFinancial(`Mi cuenta es ${CLABE_BANAMEX}, deposita cuando puedas.`);
  const valida = find(audit, 'clabe-valida');
  assert.ok(valida);
  // Informativa y verificada: una cuenta bien formada no reduce el riesgo.
  assert.equal(valida.severity, 'informativo');
  assert.equal(valida.status, 'verificado');
  assert.match(valida.evidence, /Citibanamex/);
  // Regresión de privacidad: la CLABE completa no aparece en ninguna parte.
  const texto = JSON.stringify(audit);
  assert.ok(!texto.includes(CLABE_BANAMEX), 'la CLABE completa no debe aparecer en la auditoría');
  assert.ok(!texto.includes(CLABE_BANAMEX.slice(3, 14)), 'el cuerpo de la CLABE no debe aparecer');
});

test('una cuenta de un código no catalogado no se vuelve sospechosa por serlo', () => {
  const audit = auditFinancial(`Mi cuenta es ${CLABE_DESCONOCIDA}.`);
  const valida = find(audit, 'clabe-valida');
  assert.ok(valida);
  assert.match(valida.evidence, /no identificada/);
  assert.equal(valida.status, 'verificado');
  assert.equal(find(audit, 'clabe-institucion-discrepante'), undefined);
});

test('la discrepancia sube el riesgo pero no por sí sola a crítico', () => {
  const sin = combineRisk(auditFinancial(`Deposita a ${CLABE_AZTECA}.`), null);
  const con = combineRisk(
    auditFinancial(`Soy de Santander, deposita a ${CLABE_AZTECA}.`),
    null,
  );
  assert.ok(con.deterministic.score > sin.deterministic.score, 'la discrepancia debe pesar');
  assert.notEqual(con.light, 'verde');
});

// ---------------------------------------------------------------------------
// 2. Historial
// ---------------------------------------------------------------------------

test('el saneado del historial enmascara cuentas, tarjetas, importes y correos', () => {
  assert.ok(!maskSensitive(`Deposita a ${CLABE_BANAMEX}`).includes(CLABE_BANAMEX));
  assert.ok(!maskSensitive('Tarjeta 4111 1111 1111 1111').includes('4111'));
  assert.ok(!maskSensitive('Cuenta 0021-2345-6789-0123-43').includes('2345'));
  assert.ok(!maskSensitive('Un cargo de $8,450.00').includes('450'));
  assert.equal(maskSensitive('Escríbeme a persona@ejemplo.test'), 'Escríbeme a …@ejemplo.test');
  // Un número corto no identifica nada y borrarlo haría ilegible el fragmento.
  assert.equal(maskSensitive('Nos vemos a las 10'), 'Nos vemos a las 10');
  assert.equal(maskSensitive('  dos   espacios  '), 'dos espacios');
});

test('el fragmento guardado está acotado', () => {
  assert.ok(previewOf('a'.repeat(400)).length <= PREVIEW_LIMIT);
  assert.ok(previewOf('a'.repeat(400)).endsWith('…'));
  assert.equal(previewOf('corto'), 'corto');
});

const RESULTADO = {
  kind: 'financiero',
  text: `Deposita ya a la CLABE ${CLABE_AZTECA} o perderás el lugar`,
  hadAttachments: false,
  risk: {
    light: 'rojo',
    riskLevel: 'alto',
    confidence: 'alta',
    coverage: { checksRun: 30, checksTotal: 34 },
    deterministic: { suspicious: 3, topSignals: ['Una', 'Dos', 'Tres', 'Cuatro'] },
  },
  contributing: ['vucub'],
  source: null,
};

test('el historial guarda el resultado, no el contenido', () => {
  const entry = summarize(RESULTADO, 'id-1', new Date('2026-11-14T19:00:00Z'));
  assert.equal(entry.light, 'rojo');
  assert.equal(entry.signals, 3);
  assert.equal(entry.topSignals.length, 3, 'solo se guardan las tres señales principales');
  assert.ok(!entry.preview.includes(CLABE_AZTECA), 'la CLABE no puede llegar al historial');
  assert.ok(entry.preview.length <= PREVIEW_LIMIT);
  assert.ok(entry.preview.length < RESULTADO.text.length || !entry.preview.includes('CLABE 1'));
  assert.equal(entry.at, '2026-11-14T19:00:00.000Z');
});

test('el historial no crece sin límite y conserva lo más reciente primero', () => {
  let entries = [];
  for (let index = 0; index < HISTORY_LIMIT + 7; index += 1) {
    entries = append(entries, summarize(RESULTADO, `id-${index}`));
  }
  assert.equal(entries.length, HISTORY_LIMIT);
  assert.equal(entries[0].id, `id-${HISTORY_LIMIT + 6}`);
});

/** `localStorage` de mentira, para probar sin navegador. */
function fakeStorage(initial) {
  const map = new Map(Object.entries(initial ?? {}));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    size: () => map.size,
    raw: () => map.get(HISTORY_KEY),
  };
}

test('lo leído del almacenamiento es dato no confiable', () => {
  assert.deepEqual(load(null), []);
  assert.deepEqual(load(fakeStorage()), []);
  assert.deepEqual(load(fakeStorage({ [HISTORY_KEY]: 'no es json' })), []);
  assert.deepEqual(load(fakeStorage({ [HISTORY_KEY]: '{"no":"es un arreglo"}' })), []);
  // Una entrada inválida se descarta sin arrastrar a las válidas.
  const buena = summarize(RESULTADO, 'buena');
  const mezcla = JSON.stringify([{ id: 'rota' }, buena, 42, null]);
  const leido = load(fakeStorage({ [HISTORY_KEY]: mezcla }));
  assert.equal(leido.length, 1);
  assert.equal(leido[0].id, 'buena');
  // Un almacenamiento que lanza no rompe la aplicación.
  const roto = {
    getItem: () => {
      throw new Error('bloqueado');
    },
    setItem: () => {
      throw new Error('bloqueado');
    },
    removeItem: () => {
      throw new Error('bloqueado');
    },
  };
  assert.deepEqual(load(roto), []);
  assert.equal(save(roto, [buena]), false);
  assert.doesNotThrow(() => clear(roto));
});

test('isEntry rechaza lo que no es una entrada de historial', () => {
  assert.equal(isEntry(null), false);
  assert.equal(isEntry({}), false);
  assert.equal(isEntry({ ...summarize(RESULTADO, 'x'), light: 'azul' }), false);
  assert.equal(isEntry({ ...summarize(RESULTADO, 'x'), at: 'ayer' }), false);
  assert.equal(isEntry({ ...summarize(RESULTADO, 'x'), riskLevel: 'altísimo' }), false);
  assert.equal(isEntry(summarize(RESULTADO, 'x')), true);
});

test('guardar vuelve a sanear y borrar deja el almacenamiento limpio', () => {
  const store = fakeStorage();
  const sucia = { ...summarize(RESULTADO, 'id'), preview: `cuenta ${CLABE_AZTECA} completa` };
  assert.equal(save(store, [sucia]), true);
  assert.ok(!store.raw().includes(CLABE_AZTECA), 'el guardado es la última puerta: debe enmascarar');
  // Tampoco se guardan más entradas de las permitidas.
  save(store, Array.from({ length: HISTORY_LIMIT + 5 }, (_, i) => summarize(RESULTADO, `id-${i}`)));
  assert.equal(JSON.parse(store.raw()).length, HISTORY_LIMIT);
  clear(store);
  assert.equal(store.raw(), undefined);
});

test('las etiquetas del historial tienen respaldo para un valor desconocido', () => {
  assert.equal(describeKind('url'), 'Enlace');
  assert.equal(describeKind('loquesea'), 'Análisis');
  assert.equal(describeWhen('no es fecha'), 'fecha no legible');
  assert.ok(describeWhen('2026-11-14T19:00:00.000Z').length > 0);
});

// ---------------------------------------------------------------------------
// 3. Casos de demostración
// ---------------------------------------------------------------------------

const demo = JSON.parse(
  await readFile(new URL('../data/demo-cases.json', import.meta.url), 'utf8'),
);

test('los casos de demostración no contienen datos reales', () => {
  for (const caso of demo.cases) {
    assert.ok(['message', 'url', 'transcripcion', 'financiero'].includes(caso.kind));
    assert.ok(caso.title && caso.text && caso.expect, `${caso.id} está incompleto`);
    // Todo enlace usa example.com, reservado por la IANA para documentación.
    for (const url of caso.text.match(/https?:\/\/[^\s]+/g) ?? []) {
      assert.match(new URL(url).hostname, /(^|\.)example\.com$/, `${caso.id} usa un dominio real`);
    }
    // Las CLABE del guion tienen verificador correcto, construidas a propósito.
    const found = findFinancialIdentifiers(caso.text);
    assert.equal(found.invalidClabes.length, 0, `${caso.id} trae una CLABE mal formada`);
    assert.equal(found.validCards.length, 0, `${caso.id} no debe traer tarjetas`);
  }
});

test('cada caso de demostración produce el semáforo que anuncia', () => {
  const esperado = {
    'sms-banco': 'rojo',
    'enlace-tienda': 'rojo',
    'llamada-secuestro': 'rojo',
    'inversion-garantizada': 'rojo',
    'empleo-falso': 'rojo',
    'mensaje-legitimo': 'gris',
  };
  for (const caso of demo.cases) {
    const { audit } = auditCoordinated({ kind: caso.kind, text: caso.text });
    const risk = combineRisk(audit, null);
    assert.equal(risk.light, esperado[caso.id], `${caso.id} dio ${risk.light}`);
  }
});

test('el caso de control demuestra que el verde sigue siendo posible', () => {
  const caso = demo.cases.find((item) => item.id === 'mensaje-legitimo');
  const { audit } = auditCoordinated({ kind: caso.kind, text: caso.text });
  assert.equal(combineRisk(audit, null).light, 'gris', 'sin IA no se puede declarar seguro');
  assert.equal(combineRisk(audit, { risk: 'bajo' }).light, 'verde');
});

test('la llamada de demostración convoca a CAMAZOTZ y a VUCUB CAMÉ', () => {
  const caso = demo.cases.find((item) => item.id === 'llamada-secuestro');
  const { contributing, audit } = auditCoordinated({ kind: caso.kind, text: caso.text });
  assert.ok(contributing.includes('camazotz'));
  assert.ok(contributing.includes('vucub'));
  assert.ok(find(audit, 'clabe-institucion-discrepante'), 'la discrepancia de banco es el remate');
});
