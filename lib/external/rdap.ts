// Cliente RDAP sobre el bootstrap oficial de IANA.
//
// Dos hechos gobiernan este módulo:
//
// 1. No todos los TLD tienen RDAP. `mx` NO aparece en el bootstrap oficial
//    (verificado en https://data.iana.org/rdap/dns.json, publicación
//    2026-10-28T22:00:04Z, 592 servicios / 1203 TLD). Tampoco `cl`, `co`,
//    `es`, `us` ni `io`. Para esos dominios la respuesta correcta es
//    «no disponible», nunca una fecha inventada.
// 2. Algunas entradas del bootstrap publican solo `http://`. No se degrada la
//    conexión: si no hay URL HTTPS, la comprobación es «no disponible».
//
// Nunca se siguen los `links[].href` de la respuesta: son URL controladas por
// un tercero y seguirlas convertiría este cliente en un proxy abierto.

import { assertSafeOutboundUrl } from './net-guard.ts';
import type { ExternalResult, RegistrationFacts } from './types.ts';
import { nowIso } from './types.ts';
import type { FetchLike } from './doh.ts';
import { RDAP_BOOTSTRAP_PUBLICATION, RDAP_SERVERS } from './rdap-servers.generated.ts';

export const BOOTSTRAP_PUBLICATION = RDAP_BOOTSTRAP_PUBLICATION;

/** URL base RDAP de un TLD, o `null` si IANA no publica ninguna por HTTPS. */
export function rdapServerFor(tld: string): string | null {
  return RDAP_SERVERS.get(tld.toLowerCase()) ?? null;
}

export function hasRdap(tld: string): boolean {
  return rdapServerFor(tld) !== null;
}

export type RdapDeps = {
  fetch: FetchLike;
  timeoutMs?: number;
  maxBytes?: number;
  now?: Date;
};

/** Eventos RDAP que nos interesan, según RFC 9083. */
const EVENT_KEYS = {
  registration: 'registeredAt',
  expiration: 'expiresAt',
  'last changed': 'lastChangedAt',
} as const;

function pickVcardName(entity: Record<string, unknown>): string | null {
  const vcard = entity.vcardArray;
  if (!Array.isArray(vcard) || vcard.length < 2 || !Array.isArray(vcard[1])) return null;
  for (const field of vcard[1] as unknown[]) {
    if (!Array.isArray(field) || field.length < 4) continue;
    if (field[0] === 'fn' && typeof field[3] === 'string' && field[3].trim()) {
      return field[3].trim().slice(0, 120);
    }
  }
  return null;
}

function findRegistrar(entities: unknown): string | null {
  if (!Array.isArray(entities)) return null;
  for (const item of entities) {
    if (!item || typeof item !== 'object') continue;
    const entity = item as Record<string, unknown>;
    const roles = Array.isArray(entity.roles) ? entity.roles : [];
    if (!roles.includes('registrar')) continue;
    const name = pickVcardName(entity);
    if (name) return name;
  }
  return null;
}

/** Extrae solo los campos que vamos a citar. El resto se descarta. */
export function parseRdapDomain(body: unknown, registrable: string): RegistrationFacts | null {
  if (!body || typeof body !== 'object') return null;
  const domain = body as Record<string, unknown>;

  const facts: RegistrationFacts = {
    registrable,
    registeredAt: null,
    expiresAt: null,
    lastChangedAt: null,
    registrar: findRegistrar(domain.entities),
    statuses: Array.isArray(domain.status)
      ? domain.status.filter((s): s is string => typeof s === 'string').slice(0, 12)
      : [],
    dateRedacted: false,
  };

  const events = Array.isArray(domain.events) ? domain.events : [];
  for (const item of events) {
    if (!item || typeof item !== 'object') continue;
    const event = item as Record<string, unknown>;
    const action = typeof event.eventAction === 'string' ? event.eventAction.toLowerCase() : '';
    const key = (EVENT_KEYS as Record<string, 'registeredAt' | 'expiresAt' | 'lastChangedAt'>)[action];
    if (!key) continue;
    const date = event.eventDate;
    if (typeof date !== 'string' || Number.isNaN(Date.parse(date))) continue;
    facts[key] = new Date(date).toISOString();
  }

  // Un registro puede responder correctamente y ocultar la fecha (política de
  // privacidad o redacción RFC 9537). Eso se declara, no se rellena.
  if (!facts.registeredAt) {
    const redacted = Array.isArray(domain.redacted) ? domain.redacted : [];
    facts.dateRedacted = redacted.length > 0 || events.length > 0;
  }

  return facts;
}

export async function lookupRdap(
  registrable: string,
  tld: string,
  deps: RdapDeps,
): Promise<ExternalResult<RegistrationFacts>> {
  const checkedAt = nowIso(deps.now);
  const base = rdapServerFor(tld);

  if (!base) {
    return {
      check: 'rdap',
      status: 'no-disponible',
      source: `Bootstrap RDAP de IANA (publicación ${RDAP_BOOTSTRAP_PUBLICATION})`,
      checkedAt,
      data: null,
      reason:
        `El registro de «.${tld}» no publica un servidor RDAP por HTTPS en el bootstrap oficial de IANA. ` +
        'La antigüedad y la titularidad del dominio no son verificables por esta vía.',
    };
  }

  const target = `${base}domain/${encodeURIComponent(registrable)}`;
  const guard = assertSafeOutboundUrl(target, [new URL(base).hostname]);
  if (!guard.ok) {
    return {
      check: 'rdap',
      status: 'error',
      source: base,
      checkedAt,
      data: null,
      reason: `URL RDAP rechazada por la validación de salida: ${guard.reason}`,
    };
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), deps.timeoutMs ?? 4000) : null;
  try {
    const response = await deps.fetch(guard.url.toString(), {
      headers: { accept: 'application/rdap+json' },
      // Nunca se sigue una redirección del registro: el destino sería una URL
      // de un tercero sin validar.
      redirect: 'error',
      signal: controller?.signal,
    });

    if (response.status === 404) {
      return {
        check: 'rdap',
        status: 'ok',
        source: `${new URL(base).hostname} (RDAP)`,
        checkedAt,
        data: null,
        reason: `El registro responde que «${registrable}» no está registrado.`,
      };
    }
    if (response.status === 429 || response.status === 503) {
      return {
        check: 'rdap',
        status: 'error',
        source: `${new URL(base).hostname} (RDAP)`,
        checkedAt,
        data: null,
        reason: 'El registro limitó la consulta (demasiadas solicitudes). Dato no verificable ahora.',
      };
    }
    if (!response.ok) {
      return {
        check: 'rdap',
        status: 'error',
        source: `${new URL(base).hostname} (RDAP)`,
        checkedAt,
        data: null,
        reason: `El registro respondió con código ${response.status}.`,
      };
    }

    const body = await response.text();
    if (body.length > (deps.maxBytes ?? 262_144)) {
      return {
        check: 'rdap',
        status: 'error',
        source: `${new URL(base).hostname} (RDAP)`,
        checkedAt,
        data: null,
        reason: 'La respuesta RDAP excede el tamaño admitido.',
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return {
        check: 'rdap',
        status: 'error',
        source: `${new URL(base).hostname} (RDAP)`,
        checkedAt,
        data: null,
        reason: 'La respuesta RDAP no es JSON válido.',
      };
    }

    const facts = parseRdapDomain(parsed, registrable);
    if (!facts) {
      return {
        check: 'rdap',
        status: 'error',
        source: `${new URL(base).hostname} (RDAP)`,
        checkedAt,
        data: null,
        reason: 'La respuesta RDAP no tiene la forma esperada.',
      };
    }

    return {
      check: 'rdap',
      status: 'ok',
      source: `${new URL(base).hostname} (RDAP)`,
      checkedAt,
      data: facts,
    };
  } catch {
    return {
      check: 'rdap',
      status: 'error',
      source: `${new URL(base).hostname} (RDAP)`,
      checkedAt,
      data: null,
      reason: 'La consulta RDAP falló o agotó el tiempo de espera.',
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
