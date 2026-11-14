// Adaptador WHOIS para dominios mexicanos. DESHABILITADO.
//
// Por qué existe
// --------------
// El bootstrap oficial de IANA no publica servidor RDAP para «.mx»
// (verificado: https://data.iana.org/rdap/dns.json, publicación
// 2026-10-28T22:00:04Z, y https://www.iana.org/domains/root/db/mx.html, cuyo
// campo «RDAP Base URLs» está vacío y cuyo «WHOIS Server» es «whois.mx»).
// Como una parte importante del fraude dirigido a México usa dominios .mx y
// .com.mx, RDAP por sí solo deja un hueco. Este módulo es la vía alterna
// prevista, preparada pero apagada.
//
// Por qué está apagado
// --------------------
// WHOIS es TCP en claro sobre el puerto 43: ni HTTPS, ni autenticación, ni
// formato definido. Antes de encenderlo hay que verificar, y dejar
// documentado:
//
//   1. Condiciones de uso publicadas por NIC México para consultas
//      automatizadas (frecuencia permitida, atribución, usos prohibidos).
//   2. Conectividad real al puerto 43 desde el entorno de despliegue. El
//      runtime Edge de Next.js no abre sockets TCP; esto exige runtime Node.
//   3. Qué campos devuelve de verdad la respuesta y cuáles redacta. Las
//      etiquetas que reconoce el analizador de abajo son tolerantes a
//      propósito: hasta comprobarlo con una respuesta real no se afirma que el
//      registro publique fecha de creación.
//
// Mientras las tres condiciones no estén verificadas, `lookupWhoisMx`
// devuelve siempre `deshabilitada` y la auditoría muestra «No verificable».
// No se inventa fecha de registro ni titularidad.

import type { ExternalResult, RegistrationFacts } from './types.ts';
import { nowIso } from './types.ts';

/** Interruptor único. Encenderlo exige cumplir las tres condiciones de arriba. */
export const WHOIS_MX_ENABLED = false as boolean;

export const WHOIS_MX_HOST = 'whois.mx';
export const WHOIS_MX_PORT = 43;

/** TLD que este adaptador cubriría. */
export const WHOIS_MX_SUFFIXES = ['mx'] as const;

export const WHOIS_MX_DISABLED_REASON =
  'La verificación de titularidad y antigüedad de dominios .mx está preparada pero deshabilitada: ' +
  'el registro de «.mx» no ofrece RDAP y la consulta WHOIS requiere confirmar antes las condiciones ' +
  'de uso de NIC México, la conectividad al puerto 43 y qué datos publica realmente. ' +
  'Hasta entonces el dato es no verificable.';

/** Respuestas que indican que el dominio no está registrado. */
const NOT_FOUND = [
  'object_not_found',
  'no_se_encontro',
  'no se encontro',
  'no se encontró',
  'not found',
  'no match',
  'no existe',
];

/** Etiquetas aceptadas por campo. Tolerante: el formato exacto está sin verificar. */
const LABELS: { key: 'registeredAt' | 'expiresAt' | 'lastChangedAt' | 'registrar'; names: string[] }[] = [
  { key: 'registeredAt', names: ['created on', 'creation date', 'fecha de creacion', 'fecha de creación'] },
  { key: 'expiresAt', names: ['expiration date', 'expires on', 'fecha de vencimiento', 'fecha de expiracion'] },
  {
    key: 'lastChangedAt',
    names: ['last updated on', 'updated date', 'last modified', 'fecha de ultima modificacion', 'fecha de última modificación'],
  },
  { key: 'registrar', names: ['registrar', 'registrador'] },
];

/** Convierte una fecha WHOIS a ISO 8601, o `null` si no se reconoce. */
export function parseWhoisDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  // YYYY-MM-DD, con hora opcional.
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (iso) {
    const parsed = Date.parse(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }

  // DD/MM/YYYY — orden habitual en México, no el estadounidense.
  const slash = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (slash) {
    const parsed = Date.parse(`${slash[3]}-${slash[2]}-${slash[1]}T00:00:00Z`);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }

  return null;
}

export type WhoisParse =
  | { found: false }
  | { found: true; facts: RegistrationFacts; unparsedDates: string[] };

/**
 * Analiza una respuesta WHOIS. Función pura: se prueba sin red y es lo único
 * de este módulo que está ejercitado por los tests.
 */
export function parseWhoisMx(text: string, registrable: string): WhoisParse {
  const lowered = text.toLowerCase();
  if (NOT_FOUND.some((needle) => lowered.includes(needle))) return { found: false };

  const facts: RegistrationFacts = {
    registrable,
    registeredAt: null,
    expiresAt: null,
    lastChangedAt: null,
    registrar: null,
    statuses: [],
    dateRedacted: false,
  };
  const unparsedDates: string[] = [];

  for (const line of text.split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator <= 0) continue;
    const label = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (!value) continue;

    if (label === 'domain status' || label === 'status' || label === 'estado') {
      if (facts.statuses.length < 12) facts.statuses.push(value.slice(0, 60));
      continue;
    }

    const match = LABELS.find((entry) => entry.names.includes(label));
    if (!match) continue;

    if (match.key === 'registrar') {
      facts.registrar ??= value.slice(0, 120);
      continue;
    }

    const date = parseWhoisDate(value);
    if (date) facts[match.key] ??= date;
    else unparsedDates.push(`${label}: ${value.slice(0, 40)}`);
  }

  // El registro respondió pero no entregó fecha de creación legible: eso es
  // «redactado», no «dominio nuevo».
  facts.dateRedacted = facts.registeredAt === null;

  return { found: true, facts, unparsedDates };
}

/**
 * Punto de entrada. Mientras `WHOIS_MX_ENABLED` sea `false` no abre ningún
 * socket: devuelve el estado `deshabilitada` con su motivo.
 */
export async function lookupWhoisMx(
  registrable: string,
  options: { now?: Date } = {},
): Promise<ExternalResult<RegistrationFacts>> {
  return {
    check: 'whois',
    status: 'deshabilitada',
    source: `${WHOIS_MX_HOST}:${WHOIS_MX_PORT} — consulta de «${registrable}» no realizada`,
    checkedAt: nowIso(options.now),
    data: null,
    reason: WHOIS_MX_DISABLED_REASON,
  };
}
