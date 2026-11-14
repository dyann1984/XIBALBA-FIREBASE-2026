// Orquestador de auditorías externas.
//
// Qué se consulta y qué NO
// ------------------------
// Se consultan únicamente REGISTROS PÚBLICOS y resolutores de terceros:
//   · DNS-over-HTTPS en Cloudflare y Google (lista cerrada).
//   · RDAP en el servidor que publica el bootstrap oficial de IANA.
//
// NUNCA se contacta con el sitio sospechoso. No se descarga su página, no se
// siguen sus redirecciones y no se resuelve ninguna URL que él controle. El
// estafador no recibe ni una petición, así que no sabe que su enlace fue
// analizado y no puede servir contenido distinto a este analizador.
//
// Interruptor
// -----------
// `EXTERNAL_AUDITS_ENABLED` es `false` salvo que el entorno declare
// `XIBALBA_EXTERNAL_AUDITS=1`. Apagado, nada sale a la red: cada comprobación
// devuelve `deshabilitada` y la auditoría muestra «No verificable». Los tests
// inyectan su propio `fetch` y no dependen de esta variable.

import type { Audit, AuditIndicator } from '../analysis/risk.ts';
import { validateHostForLookup } from './hostname.ts';
import { lookupDns, type FetchLike } from './doh.ts';
import { hasRdap, lookupRdap } from './rdap.ts';
import { lookupWhoisMx } from './whois-mx.ts';
import { interpretDns } from './interpret-dns.ts';
import { interpretRegistration } from './interpret-rdap.ts';
import { RateLimiter, TtlCache } from './cache.ts';
import type { DnsFacts, ExternalResult, RegistrationFacts } from './types.ts';
import { nowIso } from './types.ts';

export const EXTERNAL_AUDITS_ENABLED =
  typeof process !== 'undefined' && process.env?.XIBALBA_EXTERNAL_AUDITS === '1';

/** Comprobaciones de `URL_PENDING_EXTERNAL` que este módulo puede resolver. */
export const DNS_PENDING_LABEL = 'resolución DNS';
export const REGISTRATION_PENDING_LABELS = ['titularidad RDAP/WHOIS', 'antigüedad del dominio'];

const DNS_TTL_MS = 5 * 60 * 1000;
const RDAP_TTL_MS = 60 * 60 * 1000;

const dnsCache = new TtlCache<ExternalResult<DnsFacts>>(DNS_TTL_MS, 300);
const registrationCache = new TtlCache<ExternalResult<RegistrationFacts>>(RDAP_TTL_MS, 300);

/** Techo global: 30 consultas por minuto por clave (p. ej. una sesión). */
const limiter = new RateLimiter(30, 60 * 1000);

export type ExternalAuditDeps = {
  fetch?: FetchLike;
  now?: Date;
  /** Clave del limitador. Nunca un dato personal: un identificador opaco. */
  rateKey?: string;
  timeoutMs?: number;
  /** Fuerza la ejecución pese al interruptor (solo para pruebas con fetch inyectado). */
  force?: boolean;
  useCache?: boolean;
};

export type ExternalAudit = {
  /** Evidencia lista para fusionar con la auditoría local. */
  indicators: AuditIndicator[];
  /** Etiquetas de `pendingExternal` que ya quedaron comprobadas. */
  resolved: string[];
  dns: ExternalResult<DnsFacts> | null;
  registration: ExternalResult<RegistrationFacts> | null;
};

function disabled(check: 'dns' | 'rdap', reason: string, now?: Date): ExternalResult<never> {
  return {
    check,
    status: 'deshabilitada',
    source: 'no consultado',
    checkedAt: nowIso(now),
    data: null,
    reason,
  };
}

/**
 * Ejecuta las comprobaciones externas de un host.
 * Nunca lanza: todo fallo se devuelve como evidencia de clase C o D.
 */
export async function runExternalAudit(
  rawHost: string,
  deps: ExternalAuditDeps = {},
): Promise<ExternalAudit> {
  const empty: ExternalAudit = { indicators: [], resolved: [], dns: null, registration: null };

  const check = validateHostForLookup(rawHost);
  if (!check.ok) {
    return {
      ...empty,
      indicators: [
        {
          id: 'externo-host-rechazado',
          indicator: 'Comprobaciones externas no aplicables',
          category: 'Infraestructura del dominio',
          classification: 'pendiente-externo',
          status: 'no verificado',
          severity: 'informativo',
          evidence: `No se consultó ningún registro público: ${check.reason}`,
          source: 'validación local',
          checkedAt: nowIso(deps.now),
          recommendation: 'Trata el destino como no verificado.',
          limitation: 'Sin un dominio válido no hay registro público que consultar.',
        },
      ],
    };
  }

  const active = deps.force === true || EXTERNAL_AUDITS_ENABLED;
  const fetchImpl = deps.fetch ?? (typeof fetch === 'function' ? (fetch as unknown as FetchLike) : null);

  if (!active || !fetchImpl) {
    const reason = !active
      ? 'Las comprobaciones externas están deshabilitadas en esta instalación (XIBALBA_EXTERNAL_AUDITS no activo).'
      : 'No hay cliente HTTP disponible en este entorno.';
    const dns = disabled('dns', reason, deps.now);
    const registration = disabled('rdap', reason, deps.now);
    return {
      indicators: [...interpretDns(dns), ...interpretRegistration(registration, { now: deps.now })],
      resolved: [],
      dns,
      registration,
    };
  }

  if (!limiter.tryAcquire(deps.rateKey ?? 'global')) {
    const reason = 'Se alcanzó el límite de consultas externas por minuto. Inténtalo en un momento.';
    const dns: ExternalResult<DnsFacts> = { ...disabled('dns', reason, deps.now), status: 'error' };
    const registration: ExternalResult<RegistrationFacts> = {
      ...disabled('rdap', reason, deps.now),
      status: 'error',
    };
    return {
      indicators: [...interpretDns(dns), ...interpretRegistration(registration, { now: deps.now })],
      resolved: [],
      dns,
      registration,
    };
  }

  const useCache = deps.useCache !== false;

  // --- DNS ---------------------------------------------------------------
  let dns = useCache ? dnsCache.get(check.host) : null;
  if (!dns) {
    dns = await lookupDns(check.host, {
      fetch: fetchImpl,
      now: deps.now,
      timeoutMs: deps.timeoutMs,
    });
    if (useCache && dns.status === 'ok') dnsCache.set(check.host, dns);
  }

  // --- Registro (RDAP, o WHOIS .mx cuando se habilite) -------------------
  let registration = useCache ? registrationCache.get(check.registrable) : null;
  if (!registration) {
    if (hasRdap(check.tld)) {
      registration = await lookupRdap(check.registrable, check.tld, {
        fetch: fetchImpl,
        now: deps.now,
        timeoutMs: deps.timeoutMs,
      });
    } else if (check.tld === 'mx') {
      // «mx» no está en el bootstrap de IANA, así que no hay RDAP que
      // consultar. La vía alterna prevista es WHOIS, hoy deshabilitada:
      // `lookupWhoisMx` no abre ningún socket mientras WHOIS_MX_ENABLED sea
      // falso y devuelve el motivo para mostrarlo como «No verificable».
      registration = await lookupWhoisMx(check.registrable, { now: deps.now });
    } else {
      // Otros TLD sin RDAP (cl, co, es, us, io…): `lookupRdap` devuelve
      // «no disponible» con la publicación del bootstrap como fuente.
      registration = await lookupRdap(check.registrable, check.tld, {
        fetch: fetchImpl,
        now: deps.now,
        timeoutMs: deps.timeoutMs,
      });
    }
    if (useCache && registration.status === 'ok') {
      registrationCache.set(check.registrable, registration);
    }
  }

  const resolved: string[] = [];
  if (dns.status === 'ok') resolved.push(DNS_PENDING_LABEL);
  if (registration.status === 'ok' && registration.data?.registeredAt) {
    resolved.push(...REGISTRATION_PENDING_LABELS);
  }

  return {
    indicators: [...interpretDns(dns), ...interpretRegistration(registration, { now: deps.now })],
    resolved,
    dns,
    registration,
  };
}

/**
 * Fusiona la evidencia externa en una auditoría local.
 *
 * Quita de `pendingExternal` solo las etiquetas realmente comprobadas y suma
 * los indicadores. No puede volver verde una URL: `deterministicVerdict`
 * fuerza `locallyExhaustive = false` para los sujetos `url` y `mixto`, así que
 * resolver el DNS o conocer la antigüedad nunca basta para declarar un sitio
 * seguro. Devuelve una auditoría nueva; no modifica la recibida.
 */
export function applyExternalAudit(audit: Audit, external: ExternalAudit): Audit {
  const resolved = new Set(external.resolved);
  const pendingExternal = audit.coverage.pendingExternal.filter((label) => !resolved.has(label));
  return {
    ...audit,
    indicators: [...audit.indicators, ...external.indicators],
    coverage: {
      ...audit.coverage,
      checksRun: audit.coverage.checksRun + resolved.size,
      pendingExternal,
    },
  };
}

/** Vacía cachés y limitador. Solo para pruebas. */
export function resetExternalState(): void {
  dnsCache.clear();
  registrationCache.clear();
  limiter.clear();
}

export { validateHostForLookup } from './hostname.ts';
export { classifyIp, isPublicIp, assertSafeOutboundUrl } from './net-guard.ts';
export { hasRdap, rdapServerFor, parseRdapDomain, BOOTSTRAP_PUBLICATION } from './rdap.ts';
export { parseWhoisMx, parseWhoisDate, WHOIS_MX_ENABLED } from './whois-mx.ts';
export { DOH_PROVIDERS } from './doh.ts';
export { TtlCache, RateLimiter } from './cache.ts';
export type { DnsFacts, RegistrationFacts, ExternalResult, ExternalStatus } from './types.ts';
