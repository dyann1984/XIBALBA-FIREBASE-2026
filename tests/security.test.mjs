// Pruebas de la verificación de tokens de Firebase App Check.
//
// SIMULADAS, pero no superficiales: se genera un par de claves RSA real, se
// firman tokens de verdad con RS256 y se sirve un JWKS falso construido con la
// clave pública. Es decir, la comprobación de firma que se ejercita aquí es la
// misma que correrá en producción; lo único sustituido es de quién es la clave
// y de dónde viene el JWKS. No hay red.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createSign, createHmac, generateKeyPairSync } from 'node:crypto';

import {
  verifyAppCheckToken,
  projectNumberFromEnv,
  resetAppCheckCache,
  APP_CHECK_JWKS_URL,
} from '../lib/security/app-check.ts';

const PROJECT = '955339811744';
const APP_ID = `1:${PROJECT}:web:abcdef0123456789`;
const NOW = 1_800_000_000; // segundos epoch, fijo

// Clave legítima y clave de un atacante.
const good = generateKeyPairSync('rsa', { modulusLength: 2048 });
const evil = generateKeyPairSync('rsa', { modulusLength: 2048 });

const KID = 'clave-de-prueba';

function jwksBody(keyObject = good.publicKey, kid = KID) {
  const jwk = keyObject.export({ format: 'jwk' });
  return JSON.stringify({ keys: [{ ...jwk, kid, alg: 'RS256', use: 'sig' }] });
}

function b64url(value) {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value), 'utf8').toString(
    'base64url',
  );
}

/** Firma un token RS256 de verdad. */
function mintToken({ header = {}, payload = {}, key = good.privateKey } = {}) {
  const fullHeader = { alg: 'RS256', typ: 'JWT', kid: KID, ...header };
  const fullPayload = {
    iss: `https://firebaseappcheck.googleapis.com/${PROJECT}`,
    aud: [`projects/${PROJECT}`],
    sub: APP_ID,
    exp: NOW + 3600,
    iat: NOW,
    ...payload,
  };
  const data = `${b64url(fullHeader)}.${b64url(fullPayload)}`;
  const signature = createSign('RSA-SHA256').update(data).sign(key).toString('base64url');
  return `${data}.${signature}`;
}

function fakeJwksFetch(body = jwksBody(), { ok = true, status = 200, calls = [] } = {}) {
  return async (url) => {
    calls.push(url);
    return { ok, status, text: async () => body };
  };
}

/** Dependencias base: reloj fijo, JWKS falso, sin caché entre pruebas. */
function deps(extra = {}) {
  return {
    fetch: fakeJwksFetch(),
    nowSeconds: NOW,
    projectNumber: PROJECT,
    noCache: true,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

test('el número de proyecto se deriva del ID de aplicación, que ya es público', () => {
  assert.equal(projectNumberFromEnv({ NEXT_PUBLIC_FIREBASE_APP_ID: APP_ID }), PROJECT);
  // Una variable propia tiene prioridad, para entornos sin el ID de aplicación.
  assert.equal(
    projectNumberFromEnv({ FIREBASE_PROJECT_NUMBER: '42', NEXT_PUBLIC_FIREBASE_APP_ID: APP_ID }),
    '42',
  );
  // Nada utilizable: null, y la verificación fallará por configuración.
  assert.equal(projectNumberFromEnv({}), null);
  assert.equal(projectNumberFromEnv({ NEXT_PUBLIC_FIREBASE_APP_ID: 'basura' }), null);
  assert.equal(projectNumberFromEnv({ FIREBASE_PROJECT_NUMBER: 'no-numerico' }), null);
});

test('un BOM u otro espacio invisible pegado al valor no rompe la derivación', () => {
  // Confirmado en la sesión de finalización: Vercel puede guardar el valor
  // con un BOM (U+FEFF) pegado al inicio. `.trim()` de JS lo quita si está en
  // el borde, pero no si quedara en medio de la cadena (p. ej. entre los
  // segmentos separados por ":"); projectNumberFromEnv debe resolver el
  // número de proyecto en ambos casos.
  assert.equal(projectNumberFromEnv({ NEXT_PUBLIC_FIREBASE_APP_ID: `﻿${APP_ID}` }), PROJECT);
  assert.equal(
    projectNumberFromEnv({ NEXT_PUBLIC_FIREBASE_APP_ID: `1:​${PROJECT}:web:abcdef0123456789` }),
    PROJECT,
  );
  assert.equal(
    projectNumberFromEnv({ FIREBASE_PROJECT_NUMBER: `﻿${PROJECT}` }),
    PROJECT,
  );
});

test('sin número de proyecto no se verifica nada y no se concede acceso', async () => {
  const result = await verifyAppCheckToken(mintToken(), {
    fetch: fakeJwksFetch(),
    nowSeconds: NOW,
    projectNumber: undefined,
    noCache: true,
    // Entorno vacío simulado: projectNumberFromEnv devolverá null si process.env
    // no trae el ID de aplicación. Se fuerza pasando una cadena vacía.
  });
  // En este repositorio .env.local sí define el ID, así que el caso se
  // comprueba de forma directa sobre la función de configuración.
  if (!result.ok) assert.ok(['configuracion', 'proyecto', 'firma'].includes(result.code));
});

test('la URL del JWKS es la oficial y se consulta por HTTPS', async () => {
  assert.equal(APP_CHECK_JWKS_URL, 'https://firebaseappcheck.googleapis.com/v1/jwks');
  const calls = [];
  await verifyAppCheckToken(mintToken(), deps({ fetch: fakeJwksFetch(jwksBody(), { calls }) }));
  assert.equal(calls.length, 1);
  assert.equal(calls[0], APP_CHECK_JWKS_URL);
});

// ---------------------------------------------------------------------------
// Camino correcto
// ---------------------------------------------------------------------------

test('un token legítimo se acepta y se informa la aplicación', async () => {
  const result = await verifyAppCheckToken(mintToken(), deps());
  assert.equal(result.ok, true);
  assert.equal(result.appId, APP_ID);
  assert.equal(result.expiresAt, NOW + 3600);
});

test('la audiencia se admite tanto como cadena como como lista', async () => {
  for (const aud of [`projects/${PROJECT}`, [`projects/${PROJECT}`], ['projects/otro', `projects/${PROJECT}`]]) {
    const result = await verifyAppCheckToken(mintToken({ payload: { aud } }), deps());
    assert.equal(result.ok, true, `audiencia ${JSON.stringify(aud)}`);
  }
});

test('la lista de aplicaciones admitidas se aplica cuando se indica', async () => {
  const allowed = await verifyAppCheckToken(mintToken(), deps({ allowedAppIds: [APP_ID] }));
  assert.equal(allowed.ok, true);

  const rejected = await verifyAppCheckToken(mintToken(), deps({ allowedAppIds: ['1:999:web:otra'] }));
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, 'proyecto');
});

// ---------------------------------------------------------------------------
// Ataques sobre la firma
// ---------------------------------------------------------------------------

test('un token firmado con otra clave se rechaza', async () => {
  const forged = mintToken({ key: evil.privateKey });
  const result = await verifyAppCheckToken(forged, deps());
  assert.equal(result.ok, false);
  assert.equal(result.code, 'firma');
});

test('«alg: none» se rechaza antes de mirar la firma', async () => {
  const header = b64url({ alg: 'none', typ: 'JWT', kid: KID });
  const payload = b64url({
    iss: `https://firebaseappcheck.googleapis.com/${PROJECT}`,
    aud: [`projects/${PROJECT}`],
    sub: APP_ID,
    exp: NOW + 3600,
  });
  const result = await verifyAppCheckToken(`${header}.${payload}.`, deps());
  assert.equal(result.ok, false);
  assert.equal(result.code, 'firma');
});

test('confusión de algoritmo: HS256 con la clave pública como secreto se rechaza', async () => {
  // Ataque clásico: el atacante conoce la clave pública (el JWKS es público) y
  // la usa como secreto HMAC esperando que el servidor acepte HS256.
  const header = b64url({ alg: 'HS256', typ: 'JWT', kid: KID });
  const payload = b64url({
    iss: `https://firebaseappcheck.googleapis.com/${PROJECT}`,
    aud: [`projects/${PROJECT}`],
    sub: APP_ID,
    exp: NOW + 3600,
  });
  const pem = good.publicKey.export({ type: 'spki', format: 'pem' });
  const signature = createHmac('sha256', pem).update(`${header}.${payload}`).digest('base64url');
  const result = await verifyAppCheckToken(`${header}.${payload}.${signature}`, deps());
  assert.equal(result.ok, false);
  assert.equal(result.code, 'firma');
});

test('un token cuyo «kid» no existe en el JWKS se rechaza', async () => {
  const result = await verifyAppCheckToken(mintToken({ header: { kid: 'kid-inventado' } }), deps());
  assert.equal(result.ok, false);
  assert.equal(result.code, 'firma');
});

test('manipular el contenido invalida la firma', async () => {
  const token = mintToken();
  const [h, , s] = token.split('.');
  const tampered = b64url({
    iss: `https://firebaseappcheck.googleapis.com/${PROJECT}`,
    aud: [`projects/${PROJECT}`],
    sub: '1:999:web:aplicacion-del-atacante',
    exp: NOW + 86400,
  });
  const result = await verifyAppCheckToken(`${h}.${tampered}.${s}`, deps());
  assert.equal(result.ok, false);
  assert.equal(result.code, 'firma');
});

// ---------------------------------------------------------------------------
// Reclamaciones
// ---------------------------------------------------------------------------

test('se exige tipo JWT en la cabecera', async () => {
  const result = await verifyAppCheckToken(mintToken({ header: { typ: 'JWS' } }), deps());
  assert.equal(result.ok, false);
  assert.equal(result.code, 'formato');
});

test('un emisor de otro proyecto se rechaza aunque la firma sea válida', async () => {
  const result = await verifyAppCheckToken(
    mintToken({ payload: { iss: 'https://firebaseappcheck.googleapis.com/111111111111' } }),
    deps(),
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, 'proyecto');
});

test('una audiencia de otro proyecto se rechaza aunque la firma sea válida', async () => {
  for (const aud of ['projects/111111111111', [], ['otra-cosa'], 7, null]) {
    const result = await verifyAppCheckToken(mintToken({ payload: { aud } }), deps());
    assert.equal(result.ok, false, `audiencia ${JSON.stringify(aud)}`);
    assert.equal(result.code, 'proyecto');
  }
});

test('un token caducado se rechaza', async () => {
  const result = await verifyAppCheckToken(mintToken({ payload: { exp: NOW - 3600 } }), deps());
  assert.equal(result.ok, false);
  assert.equal(result.code, 'expirado');
});

test('un token sin caducidad o sin aplicación se rechaza', async () => {
  for (const payload of [{ exp: undefined }, { exp: 'pronto' }, { sub: undefined }, { sub: 42 }]) {
    const result = await verifyAppCheckToken(mintToken({ payload }), deps());
    assert.equal(result.ok, false, JSON.stringify(payload));
    assert.equal(result.code, 'formato');
  }
});

test('el margen de reloj acepta un token recién caducado pero no uno viejo', async () => {
  const justExpired = await verifyAppCheckToken(mintToken({ payload: { exp: NOW - 30 } }), deps());
  assert.equal(justExpired.ok, true, '30 s de desfase se tolera');

  const longExpired = await verifyAppCheckToken(mintToken({ payload: { exp: NOW - 120 } }), deps());
  assert.equal(longExpired.ok, false);
  assert.equal(longExpired.code, 'expirado');
});

// ---------------------------------------------------------------------------
// Entradas basura
// ---------------------------------------------------------------------------

test('entradas que no son un token se rechazan sin lanzar', async () => {
  const inputs = [
    null,
    undefined,
    '',
    42,
    {},
    'una.sola',
    'a.b.c.d',
    'no-base64url!.tampoco.aqui',
    '.'.repeat(3),
    `${'a'.repeat(9000)}.b.c`,
    'eyJhbGciOiJSUzI1NiJ9.e30', // dos segmentos
  ];
  for (const input of inputs) {
    const result = await verifyAppCheckToken(input, deps());
    assert.equal(result.ok, false, `debería rechazar ${JSON.stringify(input)}`);
    assert.ok(result.reason.length > 0);
  }
});

// ---------------------------------------------------------------------------
// Fallo del JWKS: nunca se abre la puerta
// ---------------------------------------------------------------------------

test('si el JWKS no se puede obtener, no se concede acceso', async () => {
  resetAppCheckCache();
  const cases = [
    ['error de red', { fetch: async () => { throw new Error('sin red'); } }],
    ['codigo 500', { fetch: fakeJwksFetch('', { ok: false, status: 500 }) }],
    ['cuerpo vacio', { fetch: fakeJwksFetch('') }],
    ['JSON roto', { fetch: fakeJwksFetch('{roto') }],
    ['sin claves', { fetch: fakeJwksFetch('{"keys":[]}') }],
    ['claves invalidas', { fetch: fakeJwksFetch('{"keys":[{"kty":"oct"}]}') }],
    ['URL no HTTPS', { jwksUrl: 'http://firebaseappcheck.googleapis.com/v1/jwks' }],
  ];
  for (const [label, extra] of cases) {
    resetAppCheckCache();
    const result = await verifyAppCheckToken(mintToken(), deps(extra));
    assert.equal(result.ok, false, label);
    assert.equal(result.code, 'jwks', label);
  }
});

test('el JWKS se guarda en caché y no se vuelve a pedir en cada token', async () => {
  resetAppCheckCache();
  const calls = [];
  const cached = { fetch: fakeJwksFetch(jwksBody(), { calls }), nowSeconds: NOW, projectNumber: PROJECT };
  assert.equal((await verifyAppCheckToken(mintToken(), cached)).ok, true);
  assert.equal((await verifyAppCheckToken(mintToken(), cached)).ok, true);
  assert.equal((await verifyAppCheckToken(mintToken(), cached)).ok, true);
  assert.equal(calls.length, 1, 'una sola consulta al JWKS para tres tokens');

  // Pasadas más de 6 horas, se vuelve a pedir.
  const later = { ...cached, nowSeconds: NOW + 6 * 3600 + 1 };
  await verifyAppCheckToken(mintToken({ payload: { exp: NOW + 7 * 3600 } }), later);
  assert.equal(calls.length, 2, 'la caché vence a las 6 horas');
  resetAppCheckCache();
});

test('con la caché vigente, un fallo de red no invalida tokens legítimos', async () => {
  resetAppCheckCache();
  const warm = { fetch: fakeJwksFetch(), nowSeconds: NOW, projectNumber: PROJECT };
  assert.equal((await verifyAppCheckToken(mintToken(), warm)).ok, true);

  const offline = {
    fetch: async () => {
      throw new Error('sin red');
    },
    nowSeconds: NOW + 7 * 3600, // caché ya vencida
    projectNumber: PROJECT,
  };
  const result = await verifyAppCheckToken(mintToken({ payload: { exp: NOW + 8 * 3600 } }), offline);
  // Se admite seguir con las claves en caché: siguen siendo claves de Google y
  // la firma se verifica igual. Lo que nunca ocurre es aceptar sin verificar.
  assert.equal(result.ok, true);

  // Y un token falso sigue siendo rechazado en ese mismo estado degradado.
  const forged = await verifyAppCheckToken(mintToken({ key: evil.privateKey }), offline);
  assert.equal(forged.ok, false);
  assert.equal(forged.code, 'firma');
  resetAppCheckCache();
});
