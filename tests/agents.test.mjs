// Pruebas de la fase 5: CAMAZOTZ, VUCUB CAMÉ y la coordinación multiagente.
//
// Todos los datos son ficticios. No hay ninguna CLABE, tarjeta, dirección de
// monedero ni transcripción que corresponda a una persona o cuenta real: las
// CLABE se construyen con `buildClabe` a partir de dígitos inventados y la
// tarjeta es el número de prueba público 4111 1111 1111 1111, que no pertenece
// a nadie. Las transcripciones son guiones escritos para estas pruebas.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  auditAudio,
  auditFinancial,
  auditMessage,
  auditTextLinks,
  auditTranscript,
  auditUrl,
} from '../lib/analysis/audit.ts';
import {
  AGENT_NAMES,
  auditCoordinated,
  dedupeIndicators,
  selectAgents,
} from '../lib/analysis/coordinator.ts';
import {
  buildClabe,
  clabeCheckDigit,
  findFinancialIdentifiers,
  luhnValid,
  maskCard,
  maskClabe,
  validateClabe,
} from '../lib/analysis/finance.ts';
import {
  describeAudioRejection,
  describeTranscription,
  transcribeAudio,
  MAX_AUDIO_BYTES,
  TRANSCRIPTION_PENDING,
} from '../lib/analysis/audio.ts';
import { combineRisk, deterministicVerdict } from '../lib/analysis/risk.ts';
import { voicePatterns } from '../lib/analysis/voice.ts';
import { financePatterns } from '../lib/analysis/finance-patterns.ts';

const ids = (audit) => audit.indicators.map((item) => item.id);
const suspicious = (audit) => audit.indicators.filter((item) => item.status === 'sospechoso');
const find = (audit, id) => audit.indicators.find((item) => item.id === id);

// CLABE ficticias, construidas con el verificador correcto.
const CLABE_A = buildClabe('00200000000000000');
const CLABE_B = buildClabe('01400000000000001');
const CARD_TEST = '4111111111111111';

// ---------------------------------------------------------------------------
// 1. Transcripciones ficticias (CAMAZOTZ)
// ---------------------------------------------------------------------------

test('CAMAZOTZ detecta el guion del secuestro virtual y no lo deja en verde', () => {
  const audit = auditTranscript(
    'Tenemos a tu hijo aquí con nosotros. No cuelgues y no le avises a nadie. Deposita ahora mismo a esta cuenta.',
  );
  assert.equal(audit.subject, 'transcripcion');
  const found = ids(audit);
  assert.ok(found.includes('voz-familiar-retenido'), 'debe reconocer la retención del familiar');
  assert.ok(found.includes('voz-no-cuelgues'), 'debe reconocer el aislamiento de la víctima');
  assert.equal(find(audit, 'voz-familiar-retenido').severity, 'critico');
  const risk = combineRisk(audit, null);
  assert.equal(risk.riskLevel, 'alto');
  assert.equal(risk.light, 'rojo');
});

test('CAMAZOTZ detecta la suplantación bancaria con petición de código de un solo uso', () => {
  const audit = auditTranscript(
    'Buenas tardes, le llamo del departamento de seguridad de su banco. Detectamos un cargo no reconocido en su tarjeta. Para verificar su identidad necesito que me dicte el código de seguridad que le acaba de llegar por mensaje de texto.',
  );
  const found = ids(audit);
  assert.ok(found.includes('voz-suplantacion-institucion'));
  assert.ok(found.includes('voz-verificacion-identidad'));
  assert.ok(found.includes('solicitud-credenciales'), 'el catálogo general debe aportar el NIP/OTP');
  assert.equal(deterministicVerdict(audit).level, 'alto');
});

test('CAMAZOTZ no puede afirmar quién llamó y lo declara pendiente', () => {
  const audit = auditTranscript('Hola, le llamo del banco para confirmar un movimiento.');
  assert.deepEqual(audit.coverage.pendingExternal, [
    'identidad real de quien llamó',
    'número de origen de la llamada',
  ]);
  const pendientes = audit.indicators.filter((item) => item.classification === 'pendiente-externo');
  assert.equal(pendientes.length, 2);
  for (const item of pendientes) {
    assert.equal(item.status, 'no verificado');
    assert.match(item.recommendation, /puede falsificarse/i);
  }
});

test('una transcripción sin señales no se declara segura', () => {
  const audit = auditTranscript(
    'Hola, te llamo para confirmar la cita del dentista del jueves a las cuatro. Gracias.',
  );
  assert.equal(suspicious(audit).length, 0);
  const risk = combineRisk(audit, { risk: 'bajo' });
  assert.notEqual(risk.light, 'verde');
  assert.equal(risk.riskLevel, 'no concluyente');
  assert.match(risk.rationale.join(' '), /ausencia de señales no demuestra seguridad/i);
});

test('el catálogo de voz tiene identificadores únicos y evidencia con limitación', () => {
  assert.equal(new Set(voicePatterns.map((p) => p.id)).size, voicePatterns.length);
  for (const pattern of voicePatterns) {
    assert.match(pattern.id, /^voz-[a-z-]+$/);
    assert.ok(pattern.evidence?.trim(), `${pattern.id} necesita evidencia`);
    assert.ok(pattern.limitation?.trim(), `${pattern.id} necesita limitación`);
    assert.ok(pattern.recommendation?.trim(), `${pattern.id} necesita recomendación`);
  }
});

// ---------------------------------------------------------------------------
// 2. CLABE y Luhn
// ---------------------------------------------------------------------------

test('el dígito verificador de la CLABE coincide con un caso conocido', () => {
  // 002010077777777771 es la CLABE de ejemplo publicada para validar el cálculo.
  assert.equal(clabeCheckDigit('00201007777777777'), 1);
  assert.equal(validateClabe('002010077777777771').ok, true);
  // Alterar solo el verificador debe invalidarla.
  assert.equal(validateClabe('002010077777777772').ok, false);
  assert.equal(validateClabe('002010077777777772').reason, 'verificador');
});

test('la CLABE se rechaza por longitud y por caracteres no numéricos', () => {
  assert.equal(validateClabe('0020100777777777').reason, 'longitud');
  assert.equal(validateClabe('00201007777777777712').reason, 'longitud');
  assert.equal(validateClabe('0020100777777777A1').reason, 'no-numerico');
  assert.equal(clabeCheckDigit('123'), null);
  assert.equal(clabeCheckDigit('0020100777777777A'), null);
  // Los separadores habituales no deben invalidarla.
  assert.equal(validateClabe('002 0100 7777 7777 771').ok, true);
  assert.equal(validateClabe('002-0100-7777-7777-771').ok, true);
});

test('ninguna comprobación devuelve el número completo', () => {
  const check = validateClabe(CLABE_A);
  assert.equal(check.ok, true);
  assert.match(check.masked, /^002\*{11}\d{4}$/);
  assert.equal(JSON.stringify(check).includes(CLABE_A), false, 'la CLABE completa no debe salir');
  assert.equal(Object.keys(check).sort().join(','), 'institution,masked,ok');
  assert.equal(maskCard(CARD_TEST), '************1111');
  assert.equal(maskClabe(CLABE_A).includes(CLABE_A.slice(3, 14)), false);
  // Un fragmento corto no se expone tampoco.
  assert.equal(maskClabe('1234567'), '*******');
});

test('Luhn acepta el número de prueba y rechaza el alterado', () => {
  assert.equal(luhnValid(CARD_TEST), true);
  assert.equal(luhnValid('4111111111111112'), false);
  assert.equal(luhnValid('4111 1111 1111 1111'), true);
  assert.equal(luhnValid('5500005555555559'), true);
  // Longitudes fuera del rango de tarjeta y entradas no numéricas.
  assert.equal(luhnValid('411111111111'), false);
  assert.equal(luhnValid('41111111111111111111'), false);
  assert.equal(luhnValid('no-es-un-numero'), false);
  assert.equal(luhnValid(''), false);
});

test('una CLABE válida es contexto informativo y nunca reduce el riesgo', () => {
  const audit = auditFinancial(`Esta es la cuenta para el pago: ${CLABE_A}`);
  const valida = find(audit, 'clabe-valida');
  assert.ok(valida, 'debe emitir la evidencia de CLABE válida');
  assert.equal(valida.status, 'verificado');
  assert.equal(valida.severity, 'informativo');
  assert.match(valida.limitation, /La cuenta de un estafador también lo cumple/i);
  assert.match(valida.recommendation, /no lo tomes como prueba/i);
  // La titularidad queda pendiente, así que el verde es imposible.
  assert.ok(audit.coverage.pendingExternal.includes('titularidad de la cuenta o del medio de pago'));
  assert.notEqual(combineRisk(audit, { risk: 'bajo' }).light, 'verde');
  // Y la evidencia no contiene el número completo.
  assert.equal(JSON.stringify(audit).includes(CLABE_A), false);
});

test('una CLABE con verificador incorrecto es señal de severidad alta', () => {
  const roto = `${CLABE_A.slice(0, 17)}${(Number(CLABE_A[17]) + 1) % 10}`;
  const audit = auditFinancial(`Deposita a la cuenta ${roto} por favor.`);
  const invalida = audit.indicators.find((item) => item.id.startsWith('clabe-invalida-'));
  assert.ok(invalida, 'debe detectar el verificador incorrecto');
  assert.equal(invalida.severity, 'alto');
  assert.equal(invalida.classification, 'determinista');
  assert.equal(find(audit, 'clabe-valida'), undefined);
});

test('varias cuentas distintas en un mismo texto se señalan', () => {
  const audit = auditFinancial(`Si no pasa a la ${CLABE_A}, usa esta otra: ${CLABE_B}`);
  const multiple = find(audit, 'clabe-multiple');
  assert.ok(multiple);
  assert.equal(multiple.status, 'sospechoso');
  assert.match(multiple.evidence, /2 números de cuenta distintos/);
  const found = findFinancialIdentifiers(`${CLABE_A} y ${CLABE_B}`);
  assert.equal(found.validClabes.length, 2);
  assert.deepEqual(found.institutions, ['002', '014']);
});

// ---------------------------------------------------------------------------
// 3. Mensajes financieros
// ---------------------------------------------------------------------------

test('VUCUB CAMÉ reconoce la presión para mover dinero a una «cuenta segura»', () => {
  const audit = auditFinancial(
    'Su cuenta fue comprometida. Transfiera ahora mismo su dinero a esta cuenta segura para resguardar sus fondos.',
  );
  const presion = find(audit, 'fin-presion-transferir');
  assert.ok(presion);
  assert.equal(presion.status, 'sospechoso');
  assert.match(presion.recommendation, /No existen las «cuentas seguras»/i);
});

test('VUCUB CAMÉ reconoce el rendimiento garantizado y el cupo limitado', () => {
  const audit = auditFinancial(
    'Invierte con nosotros: te garantizo un 15% mensual sin riesgo. Cupo limitado, la oportunidad cierra hoy.',
  );
  const found = ids(audit);
  assert.ok(found.includes('fin-rendimiento-cifra') || found.includes('inversion-garantizada'));
  assert.equal(deterministicVerdict(audit).level, 'alto');
  const rendimiento = find(audit, 'fin-rendimiento-cifra');
  if (rendimiento) assert.match(rendimiento.recommendation, /Ninguna inversión legítima garantiza/i);
});

test('pedir los datos completos de la tarjeta es crítico y la tarjeta no se reproduce', () => {
  const audit = auditFinancial(
    `Para activar tu premio mándame los datos completos de tu tarjeta ${CARD_TEST} con el CVV y la fecha de vencimiento.`,
  );
  const critica = find(audit, 'fin-solicita-datos-bancarios-completos');
  assert.ok(critica);
  assert.equal(critica.severity, 'critico');
  const tarjeta = find(audit, 'tarjeta-presente');
  assert.ok(tarjeta);
  assert.match(tarjeta.evidence, /\*{12}1111/);
  assert.equal(JSON.stringify(audit).includes(CARD_TEST), false, 'la tarjeta completa no debe salir');
  assert.equal(combineRisk(audit, null).light, 'rojo');
});

test('el fragmento citado de una evidencia no reproduce un número largo', () => {
  // Regresión: la cita del fragmento coincidente llegaba a incluir la CLABE o
  // la tarjeta completas, y la evidencia se muestra y se envía al modelo.
  for (const texto of [
    `Mándame los datos completos de tu tarjeta ${CARD_TEST} con el CVV.`,
    `Transfiere ahora mismo a la cuenta ${CLABE_A} para resguardar tu dinero.`,
    `Deposita a ${CLABE_A.slice(0, 4)} ${CLABE_A.slice(4, 8)} ${CLABE_A.slice(8, 12)} ${CLABE_A.slice(12)} hoy mismo.`,
  ]) {
    const serialized = JSON.stringify(auditFinancial(texto));
    assert.equal(serialized.includes(CARD_TEST), false, 'no debe aparecer la tarjeta completa');
    assert.equal(serialized.includes(CLABE_A), false, 'no debe aparecer la CLABE completa');
    // Tampoco con los separadores que la persona haya escrito.
    assert.doesNotMatch(serialized, /\d[\d\s-]{11,}\d(?![\d*])/);
  }
  // El mensaje general tiene la misma protección.
  assert.equal(
    JSON.stringify(auditMessage(`Mi tarjeta es ${CARD_TEST}, cóbrala.`)).includes(CARD_TEST),
    false,
  );
});

test('una dirección de monedero se detecta por su forma, sin consultar nada', () => {
  const audit = auditFinancial(
    'Paga únicamente con bitcoin a la dirección bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4 antes de las seis.',
  );
  const cripto = find(audit, 'cripto-direccion');
  assert.ok(cripto);
  assert.equal(cripto.severity, 'alto');
  assert.match(cripto.limitation, /No se consultó ninguna cadena de bloques/i);
  assert.match(cripto.evidence, /bc1qw5…f3t4/);
});

test('un texto financiero cotidiano no produce señales', () => {
  const audit = auditFinancial('Me llegó el recibo de la luz de este mes y lo pagué en el banco.');
  assert.equal(suspicious(audit).length, 0);
  assert.deepEqual(audit.coverage.pendingExternal, []);
  assert.match(audit.limitation, /No se consultó ninguna institución financiera/i);
});

test('el catálogo financiero no afirma que una empresa no esté registrada', () => {
  assert.equal(new Set(financePatterns.map((p) => p.id)).size, financePatterns.length);
  const registro = financePatterns.find((p) => p.id === 'fin-regulado-sin-registro');
  assert.ok(registro);
  assert.match(registro.recommendation + registro.limitation, /CNBV|CONDUSEF|SIPRES/);
  assert.doesNotMatch(registro.evidence, /no está registrad[ao]\b/i);
});

// ---------------------------------------------------------------------------
// 4. Archivos de audio inválidos
// ---------------------------------------------------------------------------

test('se distingue el motivo por el que un archivo de audio no sirve', () => {
  assert.match(
    describeAudioRejection({ name: 'llamada.mp4', type: 'video/mp4', size: 1000 }),
    /es un video, no un audio/i,
  );
  assert.match(
    describeAudioRejection({ name: 'contrato.pdf', type: 'application/pdf', size: 1000 }),
    /no es un archivo de audio/i,
  );
  assert.match(
    describeAudioRejection({ name: 'nota.flac', type: 'audio/flac', size: 1000 }),
    /no está admitido/i,
  );
  assert.match(
    describeAudioRejection({ name: 'vacio.mp3', type: 'audio/mpeg', size: 0 }),
    /está vacío/i,
  );
  assert.match(
    describeAudioRejection({ name: 'sin-tipo', type: '', size: 1000 }),
    /No se reconoció el formato/i,
  );
});

test('el límite de tamaño del audio se informa con la cifra real', () => {
  const rejection = describeAudioRejection({
    name: 'larga.mp3',
    type: 'audio/mpeg',
    size: MAX_AUDIO_BYTES + 1,
  });
  assert.match(rejection, /pesa 10\.0 MB y el límite es 10 MB/);
  assert.equal(describeAudioRejection({ name: 'ok.mp3', type: 'audio/mpeg', size: 1024 }), null);
  assert.equal(describeAudioRejection({ name: 'ok.m4a', type: 'audio/mp4', size: 1024 }), null);
  assert.equal(describeAudioRejection({ name: 'ok.wav', type: 'audio/wav', size: 1024 }), null);
});

test('la auditoría de un audio sin transcribir no afirma haberlo escuchado', () => {
  const audit = auditAudio(
    { name: 'llamada.mp3', mimeType: 'audio/mpeg', size: 204800, durationSeconds: 95 },
    TRANSCRIPTION_PENDING,
  );
  assert.equal(audit.subject, 'audio');
  const estado = find(audit, 'audio-transcripcion');
  assert.equal(estado.indicator, 'Transcripción del audio pendiente');
  assert.equal(estado.classification, 'pendiente-externo');
  assert.equal(estado.status, 'no verificado');
  assert.match(estado.limitation, /Sin transcripción no se analizó ni una palabra/i);
  assert.doesNotMatch(JSON.stringify(audit), /transcripción automática disponible/i);
  const metadatos = find(audit, 'audio-llamada.mp3');
  assert.match(metadatos.evidence, /audio\/mpeg · 200 KB · 1 min 35 s/);
  assert.match(metadatos.limitation, /No dicen nada sobre lo que se dijo/i);
  // Un audio sin transcripción jamás puede dar verde.
  assert.equal(combineRisk(audit, { risk: 'bajo' }).light, 'gris');
});

test('con transcripción disponible la evidencia se marca como interpretación de máquina', () => {
  const audit = auditAudio(
    { name: 'llamada.mp3', mimeType: 'audio/mpeg', size: 1024 },
    { status: 'disponible', text: 'Le llamo del banco.', engine: 'Motor de prueba', reason: null },
  );
  const estado = find(audit, 'audio-transcripcion');
  assert.equal(estado.classification, 'ia');
  assert.equal(estado.status, 'no concluyente');
  assert.equal(estado.source, 'Motor de prueba');
  assert.match(estado.limitation, /no una cita textual/i);
  assert.deepEqual(audit.coverage.pendingExternal, ['exactitud de la transcripción automática']);
});

// ---------------------------------------------------------------------------
// 5. Consentimiento
// ---------------------------------------------------------------------------

test('sin consentimiento el audio no se envía y la transcripción queda pendiente', async () => {
  let llamado = false;
  const result = await transcribeAudio(
    { mimeType: 'audio/mpeg', base64: 'AAAA' },
    {
      consent: false,
      generate: async () => {
        llamado = true;
        return 'texto que nunca debería producirse';
      },
    },
  );
  assert.equal(llamado, false, 'no debe invocarse el motor sin consentimiento');
  assert.equal(result.status, 'sin-consentimiento');
  assert.equal(result.text, null);
  assert.match(describeTranscription(result), /hace falta tu consentimiento/i);
});

test('con consentimiento pero sin motor se informa «no disponible», no un texto vacío', async () => {
  const result = await transcribeAudio({ mimeType: 'audio/mpeg', base64: 'AAAA' }, { consent: true });
  assert.equal(result.status, 'no-disponible');
  assert.equal(result.text, null);
  assert.match(describeTranscription(result), /no disponible en este entorno/i);
});

test('la transcripción nunca se inventa: respuesta vacía, negativa o error', async () => {
  const vacia = await transcribeAudio(
    { mimeType: 'audio/mpeg', base64: 'AAAA' },
    { consent: true, generate: async () => '   ' },
  );
  assert.equal(vacia.status, 'error');
  assert.equal(vacia.text, null);

  const negativa = await transcribeAudio(
    { mimeType: 'audio/mpeg', base64: 'AAAA' },
    { consent: true, generate: async () => 'No puedo procesar este archivo de audio.' },
  );
  assert.equal(negativa.status, 'no-disponible');
  assert.equal(negativa.text, null, 'una negativa del modelo no es una transcripción');

  const fallo = await transcribeAudio(
    { mimeType: 'audio/mpeg', base64: 'AAAA' },
    {
      consent: true,
      generate: async () => {
        throw new Error('la red falló');
      },
    },
  );
  assert.equal(fallo.status, 'error');
  assert.equal(fallo.text, null);
  assert.match(fallo.reason, /la red falló/);
});

test('una transcripción disponible se etiqueta como automática y se recorta', async () => {
  const result = await transcribeAudio(
    { mimeType: 'audio/mpeg', base64: 'AAAA' },
    { consent: true, generate: async () => 'x'.repeat(7000), engineName: 'Motor de prueba' },
  );
  assert.equal(result.status, 'disponible');
  assert.equal(result.text.length, 6000, 'el texto se limita a 6000 caracteres');
  assert.equal(result.engine, 'Motor de prueba');
  assert.match(describeTranscription(result), /Transcripción automática disponible \(Motor de prueba\)/);
  assert.match(describeTranscription(result), /no una cita textual/i);
});

// ---------------------------------------------------------------------------
// 6. Evidencias contradictorias
// ---------------------------------------------------------------------------

test('la IA no puede rebajar una evidencia determinista', () => {
  const audit = auditTranscript(
    'Tenemos a tu hermana. No cuelgues ni le avises a nadie o no vuelves a verla.',
  );
  const risk = combineRisk(audit, { risk: 'bajo' });
  assert.equal(risk.riskLevel, 'alto');
  assert.equal(risk.light, 'rojo');
  assert.match(risk.rationale.join(' '), /Evidencia determinista de severidad alta/);
  assert.match(risk.rationale.join(' '), /no se puede confirmar seguridad/i);
});

test('un nivel alto sostenido solo por la IA se marca como no respaldado', () => {
  const audit = auditMessage('Buenas tardes, le confirmo la reunión del martes.');
  const risk = combineRisk(audit, { risk: 'alto' });
  assert.equal(risk.riskLevel, 'alto');
  assert.equal(risk.deterministic.suspicious, 0);
  assert.match(risk.rationale.join(' '), /proviene solo del modelo, sin respaldo determinista/i);
  assert.equal(risk.confidence, 'baja');
  assert.match(risk.confidenceReason, /interpretación no verificada/i);
});

test('una CLABE válida junto a otra inválida conserva las dos evidencias', () => {
  const roto = `${CLABE_B.slice(0, 17)}${(Number(CLABE_B[17]) + 1) % 10}`;
  const audit = auditFinancial(`Usa la ${CLABE_A}; si no funciona, la ${roto}.`);
  assert.ok(find(audit, 'clabe-valida'), 'la válida se conserva como contexto');
  assert.ok(
    audit.indicators.some((item) => item.id.startsWith('clabe-invalida-')),
    'la inválida se conserva como señal',
  );
  // La contradicción no se resuelve promediando: la señal grave manda.
  assert.equal(deterministicVerdict(audit).level, 'alto');
});

test('al fusionar, una evidencia repetida conserva la severidad más grave', () => {
  const base = {
    indicator: 'Patrón repetido',
    category: 'contenido',
    classification: 'determinista',
    status: 'sospechoso',
    evidence: 'coincidencia',
    source: 'local',
    checkedAt: new Date().toISOString(),
    recommendation: 'r',
    limitation: 'l',
  };
  const merged = dedupeIndicators([
    { agent: 'ixbalanque', indicators: [{ ...base, id: 'repetido', severity: 'medio' }] },
    { agent: 'vucub', indicators: [{ ...base, id: 'repetido', severity: 'critico' }] },
  ]);
  assert.equal(merged.length, 1, 'la evidencia no se duplica');
  assert.equal(merged[0].severity, 'critico', 'nunca se rebaja al fusionar');
  assert.deepEqual(merged[0].agents, ['ixbalanque', 'vucub'], 'se atribuye a los dos agentes');
});

test('una comprobación fallida es clase error y no se confunde con ausencia de riesgo', () => {
  const audit = auditMessage('Mira esta oferta: http://[::bad::]/promo');
  const fallidas = audit.indicators.filter((item) => item.classification === 'error');
  for (const item of fallidas) {
    assert.equal(item.status, 'error');
    assert.match(item.limitation, /no implica que sea seguro ni peligroso/i);
  }
  assert.notEqual(combineRisk(audit, { risk: 'bajo' }).light, 'verde');
});

// ---------------------------------------------------------------------------
// 7. Coordinación entre agentes
// ---------------------------------------------------------------------------

test('EL GUARDIÁN siempre coordina y el agente declarado siempre participa', () => {
  for (const kind of ['message', 'url', 'transcripcion', 'financiero']) {
    const selection = selectAgents({ kind, text: 'hola' });
    assert.ok(selection.agents.includes('guardian'), `falta EL GUARDIÁN en ${kind}`);
    assert.equal(
      selection.reasons[selection.agents[0]],
      'Lo elegiste como tipo de contenido.',
      `el agente declarado debe ir primero en ${kind}`,
    );
    for (const agent of selection.agents) {
      assert.ok(selection.reasons[agent]?.trim(), `${agent} debe explicar por qué participa`);
      assert.ok(AGENT_NAMES[agent], `${agent} debe tener nombre legible`);
    }
  }
});

test('una llamada que dicta una cuenta convoca a CAMAZOTZ y a VUCUB CAMÉ', () => {
  const result = auditCoordinated({
    kind: 'transcripcion',
    text: `Me llamaron del banco y me dictaron esta cuenta: ${CLABE_A}. Dijeron que transfiera ahora mismo.`,
  });
  assert.ok(result.selection.agents.includes('camazotz'));
  assert.ok(result.selection.agents.includes('vucub'));
  assert.match(result.selection.reasons.vucub, /número de cuenta|habla de dinero/i);
  // Un solo semáforo, calculado sobre la auditoría ya fusionada.
  assert.equal(result.audit.subject, 'mixto');
  assert.ok(result.contributing.length >= 2);
});

test('la fusión no duplica evidencias ni infla la cobertura', () => {
  const result = auditCoordinated({
    kind: 'financiero',
    text: 'Me llamaron por teléfono para exigir que transfiera el dinero ahora mismo.',
  });
  const found = ids(result.audit);
  assert.equal(new Set(found).size, found.length, 'no puede haber dos evidencias con el mismo id');
  // CAMAZOTZ y VUCUB CAMÉ recorren los dos el catálogo general; si la cobertura
  // se sumara por partes, el total crecería al doble.
  const porPartes =
    auditTranscript(
      'Me llamaron por teléfono para exigir que transfiera el dinero ahora mismo.',
    ).coverage.checksRun +
    auditFinancial('Me llamaron por teléfono para exigir que transfiera el dinero ahora mismo.')
      .coverage.checksRun;
  assert.ok(
    result.audit.coverage.checksRun < porPartes,
    `la cobertura (${result.audit.coverage.checksRun}) no debe sumar las partes (${porPartes})`,
  );
  assert.ok(result.audit.coverage.checksTotal >= result.audit.coverage.checksRun);
});

test('cada evidencia fusionada queda atribuida a un agente seleccionado', () => {
  const result = auditCoordinated({
    kind: 'message',
    text: `Gana dinero fácil: transfiere a la cuenta ${CLABE_A} y entra a https://premio-seguro.example.com`,
  });
  assert.ok(result.selection.agents.includes('vucub'), 'el dinero convoca a VUCUB CAMÉ');
  assert.ok(result.selection.agents.includes('hun'), 'el enlace convoca a HUN CAMÉ');
  for (const item of result.attributed) {
    assert.ok(item.agents.length > 0, `${item.id} debe tener agente`);
    for (const agent of item.agents) {
      assert.ok(
        result.selection.agents.includes(agent),
        `${item.id} se atribuye a ${agent}, que no fue seleccionado`,
      );
    }
  }
  // Todo agente que aportó algo estaba seleccionado, y ninguno se presenta sin aportar.
  for (const agent of result.contributing) assert.ok(result.selection.agents.includes(agent));
});

test('no se presenta como participante un agente que no ejecuta nada', () => {
  // Para una transcripción, CAMAZOTZ ya recorre el catálogo general: anunciar
  // además a IXBALANQUÉ sería presentar un agente que no analiza nada propio.
  const result = auditCoordinated({ kind: 'transcripcion', text: 'Le llamo de su banco.' });
  assert.equal(result.selection.agents.includes('ixbalanque'), false);
  assert.deepEqual(result.selection.agents, ['camazotz', 'guardian']);
});

test('una URL suelta solo convoca a HUN CAMÉ', () => {
  const result = auditCoordinated({ kind: 'url', text: 'https://banco-seguro.example.com/acceso' });
  assert.deepEqual(result.selection.agents, ['hun', 'guardian']);
  assert.equal(result.audit.subject, 'url');
});

test('HUN CAMÉ analiza los enlaces escritos dentro de un texto, sin abrirlos', () => {
  const audit = auditTextLinks('Entra a https://paypal.example.com/verifica para liberar tu pago.');
  assert.equal(audit.subject, 'url');
  assert.ok(audit.indicators.length > 0);
  for (const item of audit.indicators) assert.match(item.id, /^enlace:/);
  assert.ok(audit.coverage.pendingExternal.length > 0);
  assert.match(audit.limitation, /no puede calificarse como segura/i);
  // Sin enlaces no inventa nada.
  const vacio = auditTextLinks('Nos vemos el jueves.');
  assert.deepEqual(vacio.indicators, []);
  assert.deepEqual(vacio.coverage.pendingExternal, []);
});

test('sin contenido la auditoría coordinada lo dice en lugar de concluir', () => {
  const result = auditCoordinated({ kind: 'message', text: '   ' });
  assert.deepEqual(result.attributed, []);
  assert.deepEqual(result.contributing, []);
  assert.deepEqual(result.audit.coverage.pendingExternal, ['contenido no proporcionado']);
  assert.equal(combineRisk(result.audit, { risk: 'bajo' }).light, 'gris');
});

// ---------------------------------------------------------------------------
// 8. Integridad del semáforo
// ---------------------------------------------------------------------------

test('ningún contenido con identificador financiero puede quedar en verde', () => {
  const casos = [
    `La cuenta para el depósito es ${CLABE_A}`,
    `Mi tarjeta es ${CARD_TEST}`,
    'Envía a bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
  ];
  for (const texto of casos) {
    const audit = auditFinancial(texto);
    const risk = combineRisk(audit, { risk: 'bajo' });
    assert.notEqual(risk.light, 'verde', `«${texto.slice(0, 30)}…» no debe dar verde`);
    assert.equal(risk.deterministic.locallyExhaustive, false);
  }
});

test('una URL desconocida nunca es verde, aunque la IA la vea inofensiva', () => {
  const audit = auditUrl('https://tienda-nueva.example.com/oferta');
  const risk = combineRisk(audit, { risk: 'bajo' });
  assert.notEqual(risk.light, 'verde');
  assert.equal(risk.deterministic.locallyExhaustive, false);
});

test('una transcripción nunca es verde porque no acredita quién llamó', () => {
  const risk = combineRisk(auditTranscript('Buenos días, le llamo para una encuesta.'), {
    risk: 'bajo',
  });
  assert.notEqual(risk.light, 'verde');
  assert.equal(risk.riskLevel, 'no concluyente');
});

test('el verde sigue siendo posible para un texto que se agota localmente', () => {
  // Control negativo: si nada puede dar verde, el semáforo no informa.
  const audit = auditMessage('Nos vemos mañana a las nueve en la oficina.');
  assert.deepEqual(audit.coverage.pendingExternal, []);
  const risk = combineRisk(audit, { risk: 'bajo' });
  assert.equal(risk.light, 'verde');
  assert.equal(risk.riskLevel, 'bajo');
  // Pero el verde exige la interpretación: sin IA el resultado es gris.
  assert.equal(combineRisk(audit, null).light, 'gris');
});

test('riesgo, confianza y cobertura se informan por separado', () => {
  const audit = auditFinancial(
    `Transfiere ahora mismo a la cuenta ${CLABE_A} o pierdes la oportunidad.`,
  );
  const risk = combineRisk(audit, { risk: 'medio' });
  assert.ok(['alto', 'medio', 'no concluyente'].includes(risk.riskLevel));
  assert.ok(['alta', 'media', 'baja'].includes(risk.confidence));
  assert.ok(risk.confidenceReason.trim().length > 0);
  assert.notEqual(risk.riskLevel, risk.confidence, 'son dimensiones distintas');
  assert.equal(risk.coverage, audit.coverage);
  assert.ok(risk.coverage.checksRun > 0 && risk.coverage.checksTotal >= risk.coverage.checksRun);
  assert.equal(risk.aiRisk, 'medio');
});

test('el semáforo coordinado es único y coherente con la evidencia fusionada', () => {
  const result = auditCoordinated({
    kind: 'transcripcion',
    text: `No cuelgues. Tenemos a tu hermano. Deposita ahora a la cuenta ${CLABE_A}.`,
  });
  const risk = combineRisk(result.audit, { risk: 'bajo' });
  assert.equal(risk.light, 'rojo');
  assert.equal(risk.riskLevel, 'alto');
  assert.equal(risk.confidence, 'alta');
  // Un solo veredicto, y la puntuación sale de la lista ya deduplicada.
  const manual = result.audit.indicators.filter(
    (item) => item.status === 'sospechoso' && item.classification === 'determinista',
  );
  assert.equal(risk.deterministic.suspicious, manual.length);
  assert.ok(risk.coverage.pendingExternal.length >= 3, 'acumula lo pendiente de ambos agentes');
});
