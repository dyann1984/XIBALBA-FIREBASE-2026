import test from 'node:test';
import assert from 'node:assert/strict';
import {
  auditContent,
  auditImages,
  auditMessage,
  auditUrl,
  combineRisk,
  deterministicVerdict,
  extractUrls,
} from '../lib/analysis/audit.ts';

const ids = (audit) => audit.indicators.map((item) => item.id);
const suspicious = (audit) =>
  audit.indicators.filter((i) => i.classification === 'determinista' && i.status === 'sospechoso');

// ---------------------------------------------------------------------------
// Regla rectora del semáforo
// ---------------------------------------------------------------------------

test('una URL desconocida nunca se califica en verde, aunque la IA diga riesgo bajo', () => {
  for (const url of ['https://example.com/', 'https://tienda-nueva.com/', 'https://sitio.org/inicio']) {
    const audit = auditUrl(url);
    assert.equal(suspicious(audit).length, 0, `${url} no debería tener señales`);
    const risk = combineRisk(audit, { risk: 'bajo' });
    assert.notEqual(risk.light, 'verde', `${url} no puede ser verde sin comprobaciones externas`);
    assert.equal(risk.light, 'gris');
    assert.equal(risk.riskLevel, 'no concluyente');
    assert.ok(risk.coverage.pendingExternal.length > 0);
  }
});

test('la evidencia determinista alta no se rebaja por una IA más benigna', () => {
  const audit = auditUrl('https://paypal.example.com/login');
  const risk = combineRisk(audit, { risk: 'bajo' });
  assert.equal(risk.riskLevel, 'alto');
  assert.equal(risk.light, 'rojo');
  // Una sola heurística con falsos positivos documentados no da confianza alta.
  assert.equal(risk.confidence, 'media');
  assert.ok(risk.rationale.some((line) => /no se puede confirmar seguridad/i.test(line)));
});

test('la confianza alta exige evidencia crítica o varias señales altas', () => {
  // Señal crítica directa: el enlace apunta a un ejecutable.
  assert.equal(combineRisk(auditUrl('https://example.com/app.apk'), null).confidence, 'alta');
  // Dos señales altas: mezcla de alfabetos y marca reconstruida.
  assert.equal(combineRisk(auditUrl('https://раypal.com/'), null).confidence, 'alta');
  // Una sola señal de severidad baja no sostiene una conclusión.
  assert.equal(combineRisk(auditUrl('https://example.xyz/'), null).confidence, 'baja');
});

test('la IA puede elevar el nivel pero el resultado advierte que no hay respaldo determinista', () => {
  const audit = auditUrl('https://example.com/');
  const risk = combineRisk(audit, { risk: 'alto' });
  assert.equal(risk.riskLevel, 'alto');
  assert.equal(risk.confidence, 'baja');
  assert.ok(risk.rationale.some((line) => /solo del modelo/i.test(line)));
});

test('un mensaje sin enlaces ni señales sí puede alcanzar verde', () => {
  const audit = auditMessage('Hola, nos vemos el jueves en la cafetería de siempre.');
  assert.equal(suspicious(audit).length, 0);
  assert.deepEqual(audit.coverage.pendingExternal, []);
  assert.equal(combineRisk(audit, { risk: 'bajo' }).light, 'verde');
  // Sin interpretación de IA no se afirma seguridad.
  assert.equal(combineRisk(audit, null).light, 'gris');
});

test('nivel de riesgo, confianza y cobertura son magnitudes separadas', () => {
  const risk = combineRisk(auditUrl('https://example.com/login'), { risk: 'bajo' });
  assert.equal(risk.riskLevel, 'medio');
  assert.equal(risk.light, 'amarillo');
  assert.ok(['alta', 'media', 'baja'].includes(risk.confidence));
  assert.ok(risk.coverage.checksRun > 0 && risk.coverage.checksTotal > risk.coverage.checksRun);
  assert.ok(risk.rationale.length > 0, 'siempre se muestran las evidencias responsables');
});

// ---------------------------------------------------------------------------
// Motor determinista de URL
// ---------------------------------------------------------------------------

test('detecta typosquatting por distancia de edición', () => {
  assert.ok(ids(auditUrl('https://paypa1.com/')).includes('typosquatting'));
  assert.ok(ids(auditUrl('https://amazom.com/')).includes('typosquatting'));
  assert.ok(!ids(auditUrl('https://example.com/')).includes('typosquatting'));
});

test('detecta homógrafos: mezcla de alfabetos y marca reconstruida', () => {
  const audit = auditUrl('https://раypal.com/'); // «р» y «а» cirílicas
  const found = ids(audit);
  assert.ok(found.includes('homografos-mezcla'), 'debe señalar la mezcla de alfabetos');
  assert.ok(found.includes('homografos-marca'), 'debe señalar la marca reconstruida');
  assert.ok(found.includes('punycode'));
  assert.equal(combineRisk(audit, null).light, 'rojo');
});

test('detecta dominios engañosos que unen marca y palabra de seguridad', () => {
  assert.ok(ids(auditUrl('https://bbva-seguridad.com/')).includes('dominio-enganoso'));
});

test('detecta acortadores, puertos atípicos, rutas de credenciales y ejecutables', () => {
  assert.ok(ids(auditUrl('https://bit.ly/abc123')).includes('acortador'));
  assert.ok(ids(auditUrl('https://example.com:8443/')).includes('puerto-no-estandar'));
  assert.ok(ids(auditUrl('https://example.com/verificar-cuenta')).includes('ruta-credenciales'));
  const apk = auditUrl('https://example.com/actualizacion.apk');
  assert.ok(ids(apk).includes('descarga-ejecutable'));
  assert.equal(combineRisk(apk, null).light, 'rojo');
});

test('detecta direcciones incrustadas, subdominios profundos y hosts ofuscados', () => {
  assert.ok(ids(auditUrl('https://example.com/r?destino=https://otro-sitio.com')).includes('dominio-incrustado'));
  assert.ok(ids(auditUrl('https://a.b.c.d.example.com/')).includes('subdominios-profundos'));
  assert.ok(ids(auditUrl('https://mi-banco-seguro-acceso-verificado-2026.example.com/')).includes('host-ofuscado'));
});

test('HTTP sin cifrado es determinista; HTTPS queda pendiente de comprobación externa', () => {
  const plain = auditUrl('http://example.com/').indicators.find((i) => i.id === 'transporte');
  assert.equal(plain.classification, 'determinista');
  assert.equal(plain.status, 'sospechoso');
  const secure = auditUrl('https://example.com/').indicators.find((i) => i.id === 'transporte');
  assert.equal(secure.classification, 'pendiente-externo');
  assert.equal(secure.status, 'no verificado');
});

// ---------------------------------------------------------------------------
// Motor determinista de mensajes
// ---------------------------------------------------------------------------

test('detecta solicitud de códigos y amenaza de bloqueo de cuenta', () => {
  const audit = auditMessage(
    'BBVA: detectamos actividad sospechosa en tu cuenta. Envíanos el código de verificación que te llegó.',
  );
  const found = ids(audit);
  assert.ok(found.includes('solicitud-credenciales'));
  assert.ok(found.includes('amenaza-cuenta'));
  const risk = combineRisk(audit, null);
  assert.equal(risk.riskLevel, 'alto');
  assert.equal(risk.confidence, 'alta');
});

test('detecta cobro anticipado y premio no solicitado', () => {
  const found = ids(
    auditMessage('¡Felicidades, ganaste un premio! Solo debes pagar la comisión de envío para recibir tu paquete.'),
  );
  assert.ok(found.includes('pago-anticipado'));
  assert.ok(found.includes('premio-inesperado'));
});

test('detecta medios de pago irreversibles, empleo improbable e inversión garantizada', () => {
  assert.ok(
    ids(auditMessage('Compra una tarjeta de regalo de Google Play y envía el código.')).includes(
      'medio-pago-irreversible',
    ),
  );
  assert.ok(
    ids(auditMessage('Vacante home office, sin experiencia, pago diario. Solo necesitas un celular.')).includes(
      'empleo-sospechoso',
    ),
  );
  assert.ok(
    ids(auditMessage('Invierte en bitcoin con rendimiento garantizado del 30% mensual.')).includes(
      'inversion-garantizada',
    ),
  );
  assert.ok(
    ids(auditMessage('No le digas a nadie de esta operación, mantenlo en secreto.')).includes('presion-secreto'),
  );
});

test('la evidencia cita el fragmento original con sus acentos, sin inventarlo', () => {
  const original = 'Envíanos tu contraseña ahora mismo.';
  const indicator = auditMessage(original).indicators.find((i) => i.id === 'solicitud-credenciales');
  assert.ok(indicator, 'debe detectar la solicitud');
  const quoted = /Fragmento citado: «([^»]+)»/.exec(indicator.evidence)?.[1];
  assert.ok(quoted, 'la evidencia incluye una cita');
  assert.ok(original.includes(quoted), 'la cita procede literalmente del texto recibido');
  assert.match(quoted, /Envíanos/, 'conserva los acentos del original');
});

test('los enlaces del mensaje se auditan sin abrirse y arrastran la cobertura pendiente', () => {
  const audit = auditMessage('Entra a http://paypal-seguridad.example.com/login y verifica tu cuenta.');
  assert.deepEqual(extractUrls('Entra a http://a.example.com/x y a https://b.example.com.'), [
    'http://a.example.com/x',
    'https://b.example.com',
  ]);
  assert.ok(ids(audit).some((id) => id.startsWith('enlace:')));
  assert.ok(ids(audit).includes('mensaje-con-enlaces'));
  assert.ok(audit.coverage.pendingExternal.length > 0);
  assert.notEqual(combineRisk(audit, { risk: 'bajo' }).light, 'verde');
});

test('un enlace no analizable se clasifica como error, no como seguro', () => {
  const audit = auditMessage('Mira esto: http://usuario:clave@example.com/panel');
  const failure = audit.indicators.find((i) => i.classification === 'error');
  assert.ok(failure, 'debe registrarse un error de análisis');
  assert.equal(failure.status, 'error');
  assert.notEqual(combineRisk(audit, { risk: 'bajo' }).light, 'verde');
});

// ---------------------------------------------------------------------------
// Separación A / B / C / D y ausencia de datos inventados
// ---------------------------------------------------------------------------

test('cada evidencia se clasifica en una sola de las cuatro categorías', () => {
  const audit = auditContent({
    kind: 'message',
    text: 'Paga una comisión para liberar tu paquete: https://bit.ly/abc',
    images: [{ name: 'captura.png', mimeType: 'image/png', size: 120000, width: 800, height: 600 }],
  });
  const classes = new Set(audit.indicators.map((i) => i.classification));
  assert.ok(classes.has('determinista'));
  assert.ok(classes.has('pendiente-externo'));
  for (const indicator of audit.indicators) {
    assert.ok(
      ['determinista', 'ia', 'pendiente-externo', 'error'].includes(indicator.classification),
      `clasificación inesperada: ${indicator.classification}`,
    );
    assert.ok(indicator.limitation.trim().length > 0, `${indicator.id} debe declarar su limitación`);
    assert.ok(indicator.source.trim().length > 0, `${indicator.id} debe declarar su fuente`);
  }
});

test('no se afirma reputación, antigüedad ni certificados: quedan como pendientes', () => {
  const audit = auditUrl('https://example.com/');
  const external = audit.indicators.filter((i) => i.classification === 'pendiente-externo');
  assert.ok(external.length > 0);
  for (const indicator of external) assert.equal(indicator.status, 'no verificado');
  for (const indicator of audit.indicators) {
    assert.doesNotMatch(
      indicator.evidence,
      /(reputación (buena|limpia|verificada)|dominio (antiguo|confiable)|certificado válido|sitio seguro)/i,
      `${indicator.id} no debe afirmar un resultado externo`,
    );
  }
  assert.ok(
    audit.coverage.pendingExternal.some((item) => /reputación/i.test(item)),
    'la reputación figura explícitamente como pendiente',
  );
});

test('solo la evidencia determinista puntúa el veredicto local', () => {
  const audit = auditUrl('https://example.com/');
  const verdict = deterministicVerdict(audit);
  assert.equal(verdict.score, 0);
  assert.equal(verdict.level, 'no concluyente');
  assert.equal(verdict.locallyExhaustive, false);
});

// ---------------------------------------------------------------------------
// Imágenes y consentimiento
// ---------------------------------------------------------------------------

test('las imágenes aportan metadatos locales y dejan el OCR como pendiente', () => {
  const audit = auditImages([{ name: 'captura.png', mimeType: 'image/png', size: 204800, width: 1080, height: 1920 }]);
  assert.match(audit.indicators[0].evidence, /captura\.png/);
  assert.match(audit.indicators[0].evidence, /1080×1920/);
  assert.match(audit.indicators[0].evidence, /no se guarda/i);
  const ocr = audit.indicators.find((i) => i.id === 'imagen-ocr-pendiente');
  assert.equal(ocr.classification, 'pendiente-externo');
  assert.ok(audit.coverage.pendingExternal.length > 0);
});

test('un mensaje limpio con imagen adjunta deja de ser concluyente', () => {
  const clean = 'Hola, nos vemos el jueves en la cafetería de siempre.';
  assert.equal(combineRisk(auditContent({ kind: 'message', text: clean }), { risk: 'bajo' }).light, 'verde');
  const withImage = auditContent({
    kind: 'message',
    text: clean,
    images: [{ name: 'foto.jpg', mimeType: 'image/jpeg', size: 50000 }],
  });
  assert.equal(combineRisk(withImage, { risk: 'bajo' }).light, 'gris');
});

// ---------------------------------------------------------------------------
// Robustez
// ---------------------------------------------------------------------------

test('la auditoría no se rompe con entradas límite', () => {
  assert.throws(() => auditUrl('no-es-una-url'));
  assert.throws(() => auditUrl('ftp://example.com/'));
  assert.doesNotThrow(() => auditMessage(''));
  assert.doesNotThrow(() => auditMessage('🙂'.repeat(500)));
  assert.doesNotThrow(() => auditUrl(`https://example.com/${'a'.repeat(3000)}`));
  const many = auditMessage(Array.from({ length: 20 }, (_, i) => `https://sitio${i}.example.com/`).join(' '));
  assert.match(
    many.indicators.find((i) => i.id === 'mensaje-con-enlaces').evidence,
    /Analizados localmente: 5/,
    'se limita el número de enlaces auditados por mensaje',
  );
});
