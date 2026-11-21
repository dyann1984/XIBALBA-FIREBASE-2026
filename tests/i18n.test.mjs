// Pruebas de la capa de idioma (ES/EN).
//
// La prueba que importa es la última: ejecuta el motor determinista sobre
// contenido representativo y exige que TODA evidencia producida tenga
// traducción al inglés. Si alguien añade un indicador nuevo al motor y olvida
// el diccionario, esta prueba falla y nombra la frase que falta, en lugar de
// que la interfaz en inglés aparezca medio en español sin que nadie lo note.
//
// Todos los datos son ficticios: dominios de ejemplo, CLABE construidas con
// `buildClabe` y el número de tarjeta de prueba público 4111 1111 1111 1111.

import test from 'node:test';
import assert from 'node:assert/strict';

import { en, es } from '../lib/i18n/dictionary.ts';
import {
  isLang,
  LANG_LABEL,
  LANG_STORAGE_KEY,
  LANG_TAG,
  resolveInitialLang,
  translate,
  translatorFor,
} from '../lib/i18n/index.ts';
import {
  localizeAuditLimitation,
  localizeCoverageLabel,
  localizeIndicator,
  localizeJoinedList,
  localizePending,
} from '../lib/i18n/evidence.ts';
import {
  auditAudio,
  auditFinancial,
  auditImages,
  auditMessage,
  auditTranscript,
  auditUrl,
} from '../lib/analysis/audit.ts';
import { auditCoordinated } from '../lib/analysis/coordinator.ts';
import { combineRisk } from '../lib/analysis/risk.ts';
import { buildClabe } from '../lib/analysis/finance.ts';
import { TRANSCRIPTION_PENDING } from '../lib/analysis/audio.ts';

// ---------------------------------------------------------------- diccionario

test('el diccionario inglés cubre exactamente las mismas claves que el español', () => {
  const faltan = [];
  const sobran = [];
  for (const section of Object.keys(es)) {
    assert.ok(section in en, `falta la sección «${section}» en inglés`);
    for (const key of Object.keys(es[section])) {
      if (!(key in en[section])) faltan.push(`${section}.${key}`);
    }
    for (const key of Object.keys(en[section])) {
      if (!(key in es[section])) sobran.push(`${section}.${key}`);
    }
  }
  assert.deepEqual(faltan, [], `claves sin traducir: ${faltan.join(', ')}`);
  assert.deepEqual(sobran, [], `claves que solo existen en inglés: ${sobran.join(', ')}`);
});

test('ningún texto queda vacío salvo las notas que solo aplican a un idioma', () => {
  // `demoLanguageNote` está vacía en español porque los casos de demostración
  // ya están en español; `untranslated` está vacía en español porque el motor
  // escribe en ese idioma y nunca hay nada que advertir.
  const vacíasPermitidas = new Set(['analyze.demoLanguageNote', 'evidence.untranslated']);
  for (const [lang, dict] of [
    ['es', es],
    ['en', en],
  ]) {
    for (const section of Object.keys(dict)) {
      for (const [key, value] of Object.entries(dict[section])) {
        if (typeof value !== 'string') continue;
        if (value !== '') continue;
        assert.ok(
          vacíasPermitidas.has(`${section}.${key}`),
          `${lang}: ${section}.${key} está vacío y no debería`,
        );
      }
    }
  }
});

test('las dos notas de idioma están presentes donde deben estarlo', () => {
  assert.equal(es.analyze.demoLanguageNote, '');
  assert.ok(en.analyze.demoLanguageNote.length > 20);
  assert.equal(es.evidence.untranslated, '');
  assert.ok(en.evidence.untranslated.length > 20);
});

// ------------------------------------------------------------------ translate

test('translate sustituye las variables y nunca muestra la clave en crudo', () => {
  const conVariable = translate('es', 'verdict', 'checks', { run: 3, total: 7, percent: 43 });
  assert.ok(conVariable.includes('3'));
  assert.ok(!conVariable.includes('{run}'));

  // Una clave inexistente cae al español; si tampoco está, devuelve algo
  // legible en lugar de «verdict.inventada».
  const inventada = translate('en', 'verdict', 'inventada');
  assert.ok(!inventada.includes('{'));
  assert.notEqual(inventada, 'verdict.inventada');
});

test('translate cae al español cuando falta la traducción, no a la clave', () => {
  // Se comprueba con una clave real: el valor devuelto en inglés debe ser el
  // del diccionario inglés y, si no existiera, el español.
  assert.equal(translate('en', 'verdict', 'metricRisk'), en.verdict.metricRisk);
  assert.equal(translate('es', 'verdict', 'metricRisk'), es.verdict.metricRisk);
});

test('translatorFor fija el idioma', () => {
  const t = translatorFor('en');
  assert.equal(t('verdict', 'metricRisk'), en.verdict.metricRisk);
});

test('isLang, etiquetas y etiquetas BCP-47', () => {
  assert.ok(isLang('es'));
  assert.ok(isLang('en'));
  assert.ok(!isLang('fr'));
  assert.ok(!isLang(''));
  assert.equal(LANG_TAG.es, 'es-MX');
  assert.equal(LANG_TAG.en, 'en-US');
  assert.ok(LANG_LABEL.es.length > 0);
  assert.ok(LANG_STORAGE_KEY.startsWith('xibalba.'));
});

test('resolveInitialLang respeta lo guardado por encima del navegador', () => {
  assert.equal(resolveInitialLang('en', ['es-MX']), 'en');
  assert.equal(resolveInitialLang('es', ['en-US']), 'es');
  // Sin preferencia guardada, manda el navegador.
  assert.equal(resolveInitialLang(null, ['en-GB', 'es']), 'en');
  assert.equal(resolveInitialLang(null, ['es-419']), 'es');
  // Un idioma que no se ofrece no cambia el valor por defecto.
  assert.equal(resolveInitialLang(null, ['fr-FR']), 'es');
  assert.equal(resolveInitialLang('pt', []), 'es');
});

// -------------------------------------------------------- motivos del veredicto

test('todos los motivos del veredicto se traducen sin dejar la clave a la vista', () => {
  const clabe = buildClabe('00212345678901234');
  const casos = [
    auditUrl('http://bancomer-seguridad.verificar-cuenta.top/acceso?next=1'),
    auditUrl('https://ejemplo.mx/pagina'),
    auditMessage('Confirma tu contrasena y tu NIP para desbloquear la cuenta ahora mismo.'),
    auditMessage('Nos vemos el jueves para comer.'),
    auditFinancial(`Deposita a la CLABE ${clabe} de Bancomer y envia el comprobante.`),
    auditTranscript('Soy del area de seguridad de su banco, no cuelgue y no avise a nadie.'),
  ];
  for (const audit of casos) {
    for (const ai of [null, { risk: 'bajo' }, { risk: 'medio' }, { risk: 'alto' }]) {
      const risk = combineRisk(audit, ai);
      assert.equal(
        risk.rationaleKeys.length,
        risk.rationale.length,
        'los motivos como clave y como texto deben ir sincronizados',
      );
      for (const lang of ['es', 'en']) {
        for (const item of risk.rationaleKeys) {
          const texto = translate(lang, 'reason', item.key, item.vars);
          assert.ok(texto.length > 0, `motivo vacío: ${item.key}`);
          assert.ok(!texto.includes('{'), `variable sin sustituir en ${item.key}: ${texto}`);
          assert.notEqual(texto, `reason.${item.key}`, `motivo sin diccionario: ${item.key}`);
        }
        const confianza = translate(lang, 'reason', risk.confidenceKey);
        assert.notEqual(
          confianza,
          `reason.${risk.confidenceKey}`,
          `confianza sin diccionario: ${risk.confidenceKey}`,
        );
      }
    }
  }
});

test('las listas de señales y comprobaciones pendientes del veredicto se traducen, no solo la plantilla', () => {
  // Defecto real visto en una vista previa desplegada: `translate(lang,
  // 'reason', item.key, item.vars)` ya traducía la plantilla
  // («Deterministic evidence of high severity: {signals}.»), pero el valor
  // de `{signals}`/`{pending}` —una lista de nombres de indicador que arma
  // risk.ts uniendo `item.indicator` crudo— se quedaba en español porque el
  // motor determinista nunca se traduce a sí mismo. La interfaz debe
  // traducir cada nombre de la lista antes de sustituirlo en la plantilla.
  const caso = auditMessage(
    'BBVA le informa: detectamos un cargo no reconocido por $8,450.00 en su cuenta. ' +
      'Si usted no reconoce esta operación debe validar su identidad en las próximas 2 horas ' +
      'o su cuenta será bloqueada de forma permanente.',
  );
  const risk = combineRisk(caso, null);
  const conSenales = risk.rationaleKeys.find((item) => item.key === 'detHigh' && item.vars?.signals);
  assert.ok(conSenales, 'el caso debe producir un motivo detHigh con señales');
  const traducidas = localizeJoinedList(conSenales.vars.signals, 'en', '; ');
  assert.doesNotMatch(traducidas, /[áéíóúñ]/i, `una señal quedó sin traducir: ${traducidas}`);
  assert.match(traducidas, /Time pressure|Threat of account block/);

  const conPendientes = risk.rationaleKeys.find((item) => item.key === 'pending' && item.vars?.pending);
  if (conPendientes) {
    const traducidas2 = localizeJoinedList(conPendientes.vars.pending, 'en', ', ');
    assert.doesNotMatch(traducidas2, /[áéíóúñ]/i, `una comprobación pendiente quedó sin traducir: ${traducidas2}`);
  }

  // En español, traducir es una operación neutra (encuentra la misma frase).
  assert.equal(localizeJoinedList(conSenales.vars.signals, 'es', '; '), conSenales.vars.signals);
});

// ---------------------------------------------------- evidencias: sin huecos

/**
 * Auditorías que recorren, entre todas, los cinco catálogos y las ramas de
 * evidencia dinámica: URL sospechosa, URL limpia, mensaje con patrones,
 * mensaje con enlaces, transcripción de llamada, contenido financiero con
 * CLABE válida e inválida, discrepancia de institución, tarjeta, monedero,
 * imagen y audio.
 */
function auditoríasRepresentativas() {
  // 002 · Citibanamex y 012 · BBVA, construidas con relleno. No son cuentas reales.
  const clabeValida = buildClabe('00212345678901234');
  const clabeInvalida = `${clabeValida.slice(0, 17)}${(Number(clabeValida[17]) + 1) % 10}`;
  const otraClabe = buildClabe('01200000000000777');

  return [
    ['url sospechosa', auditUrl('http://bancomer-seguridad.verificar-cuenta.top:8443/login/verify.exe?url=http://otro.mx')],
    ['url con punycode y subdominios', auditUrl('https://a.b.c.d.xn--bcher-kva.example.mx/acceso.zip')],
    ['url acortada', auditUrl('https://bit.ly/3abcdef')],
    ['url con ip', auditUrl('http://192.0.2.10/acceso')],
    ['url limpia', auditUrl('https://ejemplo.mx/ayuda')],
    // Enlace que no se puede analizar: la rama de error vive en el análisis de
    // enlaces escritos dentro de un texto, no en `auditUrl`.
    ['mensaje con enlace ilegible', auditMessage('Entra aqui http://[::bad]:99999/ para validar tu cuenta.')],
    [
      'mensaje con patrones',
      auditMessage(
        'URGENTE: tu cuenta sera suspendida. Confirma tu contrasena, tu NIP y el codigo de verificacion en https://banco-seguro.top/acceso antes de 24 horas. No avises a nadie.',
      ),
    ],
    ['mensaje limpio', auditMessage('Te dejo las fotos de la comida del domingo.')],
    ['mensaje vacio', auditMessage('')],
    [
      'transcripcion de llamada',
      auditTranscript(
        'Le hablo del area de seguridad de su banco. Detectamos un cargo no reconocido. No cuelgue, no avise a nadie e instale esta aplicacion para compartir su pantalla. Deposite a la cuenta que le voy a dictar.',
      ),
    ],
    ['transcripcion limpia', auditTranscript('Era mi hermana, confirmando la cita del martes.')],
    [
      'financiero con clabe valida',
      auditFinancial(`Para apartarlo deposita a la CLABE ${clabeValida} a nombre de Juan Perez y manda el comprobante.`),
    ],
    [
      'financiero con clabe invalida',
      auditFinancial(`Deposita a la CLABE ${clabeInvalida} ahora mismo.`),
    ],
    [
      'financiero con discrepancia de institucion',
      auditFinancial(`Es tu banco Banorte: deposita a la CLABE ${clabeValida}.`),
    ],
    [
      'financiero con varias cuentas',
      auditFinancial(`Usa la CLABE ${clabeValida} o si no la ${otraClabe}.`),
    ],
    [
      'financiero con tarjeta y monedero',
      auditFinancial(
        'Paga con la tarjeta 4111 1111 1111 1111 o manda USDT a 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa. Rendimiento garantizado del 30% mensual, cupo limitado. Ve el enlace https://inversion-segura.top',
      ),
    ],
    [
      'financiero con tarjeta invalida',
      auditFinancial('Mi tarjeta es la 4111 1111 1111 1112, cargalo ahi.'),
    ],
    [
      'imagenes',
      auditImages([
        { name: 'captura.png', mimeType: 'image/png', size: 204800, width: 1170, height: 2532 },
        { name: 'foto-sin-medidas.jpg', mimeType: 'image/jpeg', size: 51200 },
      ]),
    ],
    [
      'audio con duracion',
      auditAudio(
        { name: 'llamada.m4a', mimeType: 'audio/mp4', size: 348160, durationSeconds: 95 },
        TRANSCRIPTION_PENDING,
      ),
    ],
    [
      'audio sin duracion',
      auditAudio(
        { name: 'nota-de-voz.ogg', mimeType: 'audio/ogg', size: 10240 },
        TRANSCRIPTION_PENDING,
      ),
    ],
    [
      'coordinado mixto',
      auditCoordinated({
        kind: 'mensaje',
        text: `Soy de tu banco. Deposita a la CLABE ${clabeValida} y confirma tu NIP en https://banco-seguro.top/acceso`,
        images: [{ name: 'comprobante.png', mimeType: 'image/png', size: 92160 }],
        audio: { name: 'llamada.m4a', mimeType: 'audio/mp4', size: 204800, durationSeconds: 42 },
        transcription: TRANSCRIPTION_PENDING,
      }).audit,
    ],
  ];
}

test('el motor produce evidencias y las auditorías de prueba no están vacías', () => {
  const casos = auditoríasRepresentativas();
  const total = casos.reduce((suma, [, audit]) => suma + audit.indicators.length, 0);
  // Una cifra baja significaría que las auditorías de prueba dejaron de
  // ejercitar el motor y que la prueba siguiente no demuestra nada.
  assert.ok(total > 60, `solo se produjeron ${total} evidencias; la muestra es insuficiente`);
});

test('toda evidencia del motor tiene traducción al inglés', () => {
  const sinTraducir = new Set();
  for (const [nombre, audit] of auditoríasRepresentativas()) {
    for (const item of audit.indicators) {
      const texto = localizeIndicator(item, 'en');
      if (texto.fallback) {
        // Se señala cuál de los cinco campos se quedó sin traducir, para que el
        // fallo diga qué frase hay que añadir al diccionario.
        for (const campo of ['indicator', 'evidence', 'recommendation', 'limitation', 'source']) {
          if (texto[campo] === item[campo] && item[campo] !== '') {
            sinTraducir.add(`[${nombre}] ${item.id} · ${campo}: ${item[campo]}`);
          }
        }
      }
    }
  }
  assert.deepEqual(
    [...sinTraducir],
    [],
    `evidencias sin traducción:\n${[...sinTraducir].join('\n')}`,
  );
});

test('las etiquetas de cobertura, las limitaciones y los pendientes se traducen', () => {
  const sinTraducir = [];
  for (const [nombre, audit] of auditoríasRepresentativas()) {
    const cobertura = localizeCoverageLabel(audit.coverage.label, 'en');
    if (cobertura === audit.coverage.label && audit.coverage.label !== '') {
      sinTraducir.push(`[${nombre}] cobertura: ${audit.coverage.label}`);
    }
    const limitación = localizeAuditLimitation(audit.limitation, 'en');
    if (limitación === audit.limitation && audit.limitation !== '') {
      sinTraducir.push(`[${nombre}] limitación: ${audit.limitation}`);
    }
    for (const pendiente of audit.coverage.pendingExternal) {
      if (localizePending(pendiente, 'en') === pendiente) {
        sinTraducir.push(`[${nombre}] pendiente: ${pendiente}`);
      }
    }
  }
  assert.deepEqual(sinTraducir, [], `textos sin traducción:\n${sinTraducir.join('\n')}`);
});

test('en español la capa de evidencias devuelve el texto del motor sin tocarlo', () => {
  for (const [, audit] of auditoríasRepresentativas()) {
    for (const item of audit.indicators) {
      const texto = localizeIndicator(item, 'es');
      assert.equal(texto.indicator, item.indicator);
      assert.equal(texto.evidence, item.evidence);
      assert.equal(texto.recommendation, item.recommendation);
      assert.equal(texto.limitation, item.limitation);
      assert.equal(texto.source, item.source);
      assert.equal(texto.fallback, false);
    }
    assert.equal(localizeCoverageLabel(audit.coverage.label, 'es'), audit.coverage.label);
    assert.equal(localizeAuditLimitation(audit.limitation, 'es'), audit.limitation);
  }
});

test('la traducción conserva intactos los datos citados del mensaje', () => {
  // El fragmento citado es lo que escribió la persona: traducirlo sería
  // inventar. Debe aparecer tal cual dentro de la frase en inglés.
  const audit = auditMessage('Confirma tu contrasena y tu NIP ahora mismo, es urgente.');
  const conCita = audit.indicators.filter((item) => item.evidence.includes('Fragmento citado'));
  assert.ok(conCita.length > 0, 'se esperaba al menos una coincidencia con fragmento citado');
  for (const item of conCita) {
    const cita = /Fragmento citado: «([\s\S]*)»\./.exec(item.evidence)[1];
    const texto = localizeIndicator(item, 'en');
    assert.ok(texto.evidence.includes('Quoted fragment:'), texto.evidence);
    assert.ok(texto.evidence.includes(cita), `se perdió la cita: ${texto.evidence}`);
  }
});

test('la traducción conserva el host y la CLABE sin alterarlos', () => {
  const urlAudit = auditUrl('http://bancomer-seguridad.verificar-cuenta.top/acceso');
  for (const item of urlAudit.indicators) {
    const texto = localizeIndicator(item, 'en');
    if (item.evidence.includes('bancomer-seguridad.verificar-cuenta.top')) {
      assert.ok(
        texto.evidence.includes('bancomer-seguridad.verificar-cuenta.top'),
        `se alteró el host: ${texto.evidence}`,
      );
    }
  }

  // El motor enmascara los dígitos centrales de la CLABE a propósito. La
  // traducción debe conservar ese número enmascarado tal cual, sin revelarlo
  // ni alterarlo.
  const clabe = buildClabe('00212345678901234');
  const finAudit = auditFinancial(`Deposita a la CLABE ${clabe}.`);
  const valida = finAudit.indicators.find((item) => item.id === 'clabe-valida');
  assert.ok(valida, 'se esperaba la evidencia de CLABE válida');
  const enmascarada = /(\d{3}\*+\d+)/.exec(valida.evidence);
  assert.ok(enmascarada, `se esperaba una CLABE enmascarada: ${valida.evidence}`);
  assert.ok(
    !valida.evidence.includes(clabe),
    'la evidencia no debe contener la CLABE completa en claro',
  );

  const traducida = localizeIndicator(valida, 'en');
  assert.ok(traducida.evidence.includes(enmascarada[1]), traducida.evidence);
  assert.ok(traducida.evidence.includes('CLABE(s) detected'), traducida.evidence);
  // El nombre de la institución es un nombre propio y no se traduce; la
  // etiqueta de tipo, que no lo es, sí.
  assert.ok(traducida.evidence.includes('Citibanamex'), traducida.evidence);
  assert.ok(traducida.evidence.includes('(bank)'), traducida.evidence);
});
