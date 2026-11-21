// Verificación REAL de tokens de Firebase App Check en el servidor.
//
// Por qué no se usa el Admin SDK
// ------------------------------
// `firebase-admin` resuelve esto con `appCheck().verifyToken()`, pero exige
// credenciales de aplicación: un archivo de cuenta de servicio (que no debe
// vivir en el repositorio) o credenciales administradas del entorno. Mientras
// no haya un despliegue con identidad administrada, esa vía añade una
// credencial nueva sin aportar seguridad adicional en local.
//
// La vía que se implementa aquí es el procedimiento OFICIAL de Firebase para
// backends sin Admin SDK: validar el JWT contra el conjunto de claves públicas
// que publica App Check.
//
//   JWKS: https://firebaseappcheck.googleapis.com/v1/jwks
//
// Pasos exigidos por la documentación, todos implementados abajo:
//   1. Obtener el JWKS del endpoint de App Check.
//   2. Verificar la firma del token.
//   3. Exigir algoritmo RS256 en la cabecera.
//   4. Exigir tipo JWT en la cabecera.
//   5. Comprobar que lo emitió App Check para este proyecto.
//   6. Comprobar que no ha caducado.
//   7. Comprobar que la audiencia corresponde a este proyecto.
//   8. (Opcional) Comprobar que el sujeto es el ID de la aplicación.
//
// Propiedades de esta vía:
//   · NO necesita cuenta de servicio, clave de API ni ningún secreto nuevo.
//     El JWKS es público y el número de proyecto se deriva del ID de
//     aplicación, que ya es configuración pública del cliente.
//   · El JWKS se consulta a Google, nunca al cliente, y se guarda en caché
//     hasta 6 horas, el máximo que recomienda la documentación.
//
// Lo que esta vía NO ofrece: protección contra reenvío (consumo de token de un
// solo uso). Eso es una función beta y solo existe en los Admin SDK. Queda
// documentado como pendiente, no simulado.

import { createPublicKey, createVerify } from 'node:crypto';
// El tipo de `node:crypto`, no el del DOM: lleva firma de índice.
import type { JsonWebKey as CryptoJsonWebKey } from 'node:crypto';

export const APP_CHECK_JWKS_URL = 'https://firebaseappcheck.googleapis.com/v1/jwks';
export const APP_CHECK_HEADER = 'X-Firebase-AppCheck';

/** Seis horas: el máximo que recomienda la documentación. */
const JWKS_TTL_MS = 6 * 60 * 60 * 1000;

/** Margen de reloj aceptado al comprobar la caducidad. */
const CLOCK_SKEW_SECONDS = 60;

export type AppCheckFailure =
  /** Falta configuración del servidor: no se puede verificar nada. */
  | 'configuracion'
  /** El token no tiene forma de JWT o no se puede decodificar. */
  | 'formato'
  /** No se pudo obtener el conjunto de claves públicas. */
  | 'jwks'
  /** La firma no corresponde a ninguna clave pública de App Check. */
  | 'firma'
  /** Emisor, audiencia o sujeto no corresponden a este proyecto. */
  | 'proyecto'
  /** El token ya caducó. */
  | 'expirado';

export type AppCheckResult =
  | { ok: true; appId: string; expiresAt: number }
  | { ok: false; code: AppCheckFailure; reason: string };

export type AppCheckFetch = (url: string, init?: Record<string, unknown>) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}>;

export type AppCheckDeps = {
  fetch?: AppCheckFetch;
  /** Segundos epoch. Inyectable para probar caducidades. */
  nowSeconds?: number;
  projectNumber?: string;
  /** Si se indica, se exige que `sub` sea uno de estos ID de aplicación. */
  allowedAppIds?: readonly string[];
  jwksUrl?: string;
  /** Salta la caché. Solo para pruebas. */
  noCache?: boolean;
};

type Jwk = { kid?: string; kty?: string; alg?: string; use?: string; n?: string; e?: string };

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

/**
 * Número de proyecto. No es un secreto: va dentro del ID de aplicación, que el
 * cliente publica en cada carga. Se admite también una variable propia para
 * entornos donde el ID de aplicación no esté disponible en el servidor.
 */
/**
 * Quita BOM y espacios de ancho cero que paneles como Vercel a veces dejan
 * pegados a un valor. `.trim()` por sí solo basta cuando están al borde
 * (lo cubre igual la especificación de ECMAScript), pero no si quedaran en
 * medio de la cadena; ver la misma nota en `lib/firebase.ts`.
 */
function cleanEnvValue(value: string | undefined): string {
  return value?.replace(/[﻿​-‍⁠]/g, '').trim() ?? '';
}

export function projectNumberFromEnv(env: Record<string, string | undefined> = process.env): string | null {
  const explicit = cleanEnvValue(env.FIREBASE_PROJECT_NUMBER);
  if (explicit && /^\d{1,30}$/.test(explicit)) return explicit;

  const appId = cleanEnvValue(env.NEXT_PUBLIC_FIREBASE_APP_ID);
  const parts = appId.split(':');
  if (parts.length >= 3 && /^\d{1,30}$/.test(parts[1])) return parts[1];

  return null;
}

// ---------------------------------------------------------------------------
// Caché del JWKS
// ---------------------------------------------------------------------------

let jwksCache: { keys: Jwk[]; fetchedAtMs: number } | null = null;

/** Vacía la caché de claves. Solo para pruebas. */
export function resetAppCheckCache(): void {
  jwksCache = null;
}

function parseJwks(body: string): Jwk[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const keys = (parsed as { keys?: unknown }).keys;
  if (!Array.isArray(keys)) return null;
  const valid = keys.filter((key): key is Jwk => {
    if (!key || typeof key !== 'object') return false;
    const jwk = key as Jwk;
    return jwk.kty === 'RSA' && typeof jwk.n === 'string' && typeof jwk.e === 'string';
  });
  return valid.length ? valid : null;
}

async function loadJwks(deps: AppCheckDeps): Promise<Jwk[] | null> {
  const nowMs = (deps.nowSeconds ?? Math.floor(Date.now() / 1000)) * 1000;
  if (!deps.noCache && jwksCache && nowMs - jwksCache.fetchedAtMs < JWKS_TTL_MS) {
    return jwksCache.keys;
  }

  const fetchImpl = deps.fetch ?? (typeof fetch === 'function' ? (fetch as unknown as AppCheckFetch) : null);
  if (!fetchImpl) return null;

  const url = deps.jwksUrl ?? APP_CHECK_JWKS_URL;
  // El JWKS es de Google y la URL es fija; aun así se exige HTTPS.
  if (!url.startsWith('https://')) return null;

  try {
    const response = await fetchImpl(url, { headers: { accept: 'application/json' }, redirect: 'error' });
    if (!response.ok) return deps.noCache ? null : (jwksCache?.keys ?? null);
    const body = await response.text();
    if (body.length > 131_072) return null;
    const keys = parseJwks(body);
    if (!keys) return null;
    if (!deps.noCache) jwksCache = { keys, fetchedAtMs: nowMs };
    return keys;
  } catch {
    // Si la red falla, se sigue usando la caché vigente si existe. Nunca se
    // acepta un token sin verificar.
    return deps.noCache ? null : (jwksCache?.keys ?? null);
  }
}

// ---------------------------------------------------------------------------
// Decodificación y verificación
// ---------------------------------------------------------------------------

function decodeSegment(segment: string): unknown {
  // Solo caracteres de base64url: cierra la entrada arbitraria antes de decodificar.
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) return null;
  try {
    const json = Buffer.from(segment, 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function asStringArray(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return [];
}

/**
 * Verifica un token de App Check. Nunca lanza: devuelve un resultado.
 * Un fallo nunca se convierte en acceso concedido.
 */
export async function verifyAppCheckToken(
  token: unknown,
  deps: AppCheckDeps = {},
): Promise<AppCheckResult> {
  const projectNumber = deps.projectNumber ?? projectNumberFromEnv();
  if (!projectNumber) {
    return {
      ok: false,
      code: 'configuracion',
      reason:
        'El servidor no conoce el número de proyecto, así que no puede verificar tokens de App Check. ' +
        'Se requiere NEXT_PUBLIC_FIREBASE_APP_ID o FIREBASE_PROJECT_NUMBER.',
    };
  }

  if (typeof token !== 'string' || !token) {
    return { ok: false, code: 'formato', reason: 'No se recibió credencial de App Check.' };
  }
  if (token.length > 8192) {
    return { ok: false, code: 'formato', reason: 'La credencial de App Check excede el tamaño admitido.' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { ok: false, code: 'formato', reason: 'La credencial no tiene la estructura de un JWT.' };
  }
  const [headerPart, payloadPart, signaturePart] = parts;

  const header = decodeSegment(headerPart) as Record<string, unknown> | null;
  const payload = decodeSegment(payloadPart) as Record<string, unknown> | null;
  if (!header || !payload) {
    return { ok: false, code: 'formato', reason: 'La credencial no se pudo decodificar.' };
  }

  // Paso 3: algoritmo. Se exige RS256 ANTES de tocar la firma, de modo que un
  // token con `alg: none` o un algoritmo simétrico no llegue a verificarse.
  if (header.alg !== 'RS256') {
    return { ok: false, code: 'firma', reason: `Algoritmo no admitido: ${String(header.alg)}. Se exige RS256.` };
  }
  // Paso 4: tipo.
  if (header.typ !== 'JWT') {
    return { ok: false, code: 'formato', reason: `Tipo de token no admitido: ${String(header.typ)}.` };
  }

  // Paso 1: claves públicas.
  const keys = await loadJwks(deps);
  if (!keys) {
    return {
      ok: false,
      code: 'jwks',
      reason: 'No se pudo obtener el conjunto de claves públicas de App Check. No se concede acceso sin verificar.',
    };
  }

  const kid = typeof header.kid === 'string' ? header.kid : null;
  const candidates = kid ? keys.filter((key) => key.kid === kid) : keys;
  if (!candidates.length) {
    return { ok: false, code: 'firma', reason: 'Ninguna clave pública de App Check corresponde al token.' };
  }

  // Paso 2: firma.
  const signedData = Buffer.from(`${headerPart}.${payloadPart}`, 'utf8');
  let signature: Buffer;
  try {
    signature = Buffer.from(signaturePart, 'base64url');
  } catch {
    return { ok: false, code: 'formato', reason: 'La firma no está en base64url.' };
  }

  let verified = false;
  for (const jwk of candidates) {
    try {
      const key = createPublicKey({ key: jwk as unknown as CryptoJsonWebKey, format: 'jwk' });
      if (createVerify('RSA-SHA256').update(signedData).verify(key, signature)) {
        verified = true;
        break;
      }
    } catch {
      // Clave ilegible: se prueba la siguiente.
    }
  }
  if (!verified) {
    return { ok: false, code: 'firma', reason: 'La firma de la credencial no es válida.' };
  }

  // Paso 5: emisor.
  const expectedIssuer = `https://firebaseappcheck.googleapis.com/${projectNumber}`;
  if (payload.iss !== expectedIssuer) {
    return { ok: false, code: 'proyecto', reason: 'La credencial no la emitió App Check para este proyecto.' };
  }

  // Paso 7: audiencia. Puede venir como cadena o como lista.
  const expectedAudience = `projects/${projectNumber}`;
  if (!asStringArray(payload.aud).includes(expectedAudience)) {
    return { ok: false, code: 'proyecto', reason: 'La audiencia de la credencial no corresponde a este proyecto.' };
  }

  // Paso 6: caducidad.
  const nowSeconds = deps.nowSeconds ?? Math.floor(Date.now() / 1000);
  const exp = typeof payload.exp === 'number' ? payload.exp : null;
  if (exp === null) {
    return { ok: false, code: 'formato', reason: 'La credencial no declara caducidad.' };
  }
  if (exp + CLOCK_SKEW_SECONDS <= nowSeconds) {
    return { ok: false, code: 'expirado', reason: 'La credencial de App Check ya caducó.' };
  }

  const appId = typeof payload.sub === 'string' ? payload.sub : '';
  if (!appId) {
    return { ok: false, code: 'formato', reason: 'La credencial no declara aplicación.' };
  }

  // Paso 8 (opcional): lista de aplicaciones admitidas.
  if (deps.allowedAppIds && !deps.allowedAppIds.includes(appId)) {
    return { ok: false, code: 'proyecto', reason: 'La aplicación de la credencial no está en la lista admitida.' };
  }

  return { ok: true, appId, expiresAt: exp };
}
