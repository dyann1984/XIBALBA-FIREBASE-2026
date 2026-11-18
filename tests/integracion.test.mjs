// Pruebas de la integración de `finalizacion-mvp` y `codex/finalizacion-xibalba`.
//
// No repiten lo que ya cubren las pruebas de cada rama: cubren el riesgo que
// nace **de juntarlas**, que es el que nadie había probado.
//
// El riesgo concreto: la rama de Codex dejó de devolver el texto del error al
// cliente —correcto para los errores del proveedor— pero con eso se llevó por
// delante los mensajes de validación que escribimos nosotros para la persona
// («Introduce una URL completa…»). La integración separa las dos cosas y estas
// pruebas lo fijan, para que no se vuelva a perder en una fusión futura.

import test from 'node:test';
import assert from 'node:assert/strict';

import { InputError, parseAssessment, validateInput } from '../lib/analysis/guardian.ts';
import { explainError } from '../lib/analysis/errors.ts';
import { readLimitedBody } from '../lib/security/limited-body.ts';

// ---------------------------------------------------------------------------
// 1. Mensajes de error: lo nuestro se muestra, lo ajeno no
// ---------------------------------------------------------------------------

test('la validación de entrada emite InputError, no un Error cualquiera', () => {
  const casos = [
    ['message', ''],
    ['message', 'x'.repeat(6001)],
    ['url', 'no es una url'],
    ['url', 'javascript:alert(1)'],
    ['url', 'https://usuario:clave@example.test'],
  ];
  for (const [kind, value] of casos) {
    assert.throws(
      () => validateInput(kind, value),
      InputError,
      `«${value.slice(0, 20)}» debería emitir InputError`,
    );
  }
  // El caso válido sigue pasando: la validación no se volvió más estricta.
  assert.equal(validateInput('url', 'https://example.test/x'), 'https://example.test/x');
});

test('el mensaje de validación llega íntegro a la persona', () => {
  // Es la regresión que introdujo la fusión: con el cambio de la rama de
  // Codex, esto devolvía «No se pudo completar el análisis».
  const error = (() => {
    try {
      validateInput('url', 'no es una url');
    } catch (e) {
      return e;
    }
  })();
  assert.equal(explainError(error), 'Introduce una URL completa con https:// o http://.');
  assert.match(explainError(new InputError('El contenido no puede superar 6000 caracteres.')), /6000/);
});

test('el texto de un error ajeno nunca se muestra literalmente', () => {
  const ajenos = [
    new Error('FirebaseError: projects/xibalba/apps/1:2:web:abc rechazó el token interno xyz'),
    new Error('ECONNRESET en 10.0.0.5:443 mientras se contactaba al proveedor'),
    new Error(''),
    'ni siquiera es un Error',
    null,
  ];
  for (const error of ajenos) {
    const mensaje = explainError(error);
    assert.equal(mensaje, 'No se pudo completar el análisis. Inténtalo de nuevo.');
    if (error instanceof Error && error.message) {
      assert.ok(!mensaje.includes(error.message), 'no debe reenviarse el texto original');
    }
  }
});

test('un fallo de configuración no se confunde con un rechazo de Firebase', () => {
  // «Falta configurar Firebase y App Check» contiene «App Check» y caía en la
  // rama del 403, que acusaba a Firebase de rechazar una solicitud que nunca
  // llegó a salir del dispositivo.
  const mensaje = explainError(new Error('Falta configurar Firebase y App Check.'));
  assert.match(mensaje, /Falta completar la configuración/);
  assert.doesNotMatch(mensaje, /rechazó la solicitud/);
  assert.match(mensaje, /auditoría local sigue funcionando/);
});

test('las demás ramas de explainError siguen vivas', () => {
  assert.match(explainError(new Error('HTTP 429 quota exceeded')), /límite de uso/);
  assert.match(explainError(new Error('403 permission denied')), /rechazó la solicitud/);
  assert.match(explainError(new Error('network request failed')), /No se pudo conectar/);
  const malaRespuesta = (() => {
    try {
      parseAssessment('{"risk":"confirmado"}');
    } catch (e) {
      return e;
    }
  })();
  assert.match(explainError(malaRespuesta), /formato exigido/);
});

// ---------------------------------------------------------------------------
// 2. Límite del cuerpo HTTP (rama de Codex), en sus bordes
// ---------------------------------------------------------------------------

test('un cuerpo exactamente en el límite se admite', async () => {
  const request = new Request('http://localhost', { method: 'POST', body: 'x'.repeat(16) });
  assert.equal(await readLimitedBody(request, 16), 'x'.repeat(16));
});

test('un byte de más se rechaza', async () => {
  const request = new Request('http://localhost', { method: 'POST', body: 'x'.repeat(17) });
  assert.equal(await readLimitedBody(request, 16), null);
});

test('una petición sin cuerpo devuelve cadena vacía, no null', async () => {
  // Importa para el endpoint: `null` significa «demasiado grande» (413) y una
  // cadena vacía acaba en «cuerpo no válido» (400). No son lo mismo.
  const request = new Request('http://localhost', { method: 'GET' });
  assert.equal(await readLimitedBody(request, 16), '');
});

// ---------------------------------------------------------------------------
// 3. La fusión no perdió ninguna pieza
// ---------------------------------------------------------------------------

test('las dos ramas conservan su superficie pública tras la fusión', async () => {
  const institutions = await import('../lib/analysis/clabe-institutions.ts');
  const history = await import('../lib/history.ts');
  const coordinator = await import('../lib/analysis/coordinator.ts');
  const audit = await import('../lib/analysis/audit.ts');
  const limited = await import('../lib/security/limited-body.ts');

  // De `finalizacion-mvp`
  for (const name of ['CLABE_INSTITUTIONS', 'describeInstitution', 'institutionMismatch']) {
    assert.ok(name in institutions, `falta ${name} del catálogo de instituciones`);
  }
  for (const name of ['summarize', 'maskSensitive', 'load', 'save', 'clear', 'HISTORY_LIMIT']) {
    assert.ok(name in history, `falta ${name} del historial`);
  }
  assert.ok('FINANCE_ARITHMETIC_CHECKS' in audit);
  assert.ok('auditCoordinated' in coordinator);
  // De `codex/finalizacion-xibalba`
  assert.ok('readLimitedBody' in limited);
});
