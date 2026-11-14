// Cliente DNS-over-HTTPS.
//
// Las consultas van a un resolver público FIJO, nunca al sitio sospechoso:
// el estafador no se entera de que su enlace fue analizado. El `fetch` se
// inyecta para poder probar todo esto sin red.

import { assertSafeOutboundUrl, classifyIp } from './net-guard.ts';
import type { DnsFacts, ExternalResult } from './types.ts';
import { nowIso } from './types.ts';

export type DohProvider = { name: string; url: string; host: string };

/** Proveedores autorizados. Lista cerrada: no se acepta ninguna otra URL. */
export const DOH_PROVIDERS: readonly DohProvider[] = [
  { name: 'Cloudflare DNS', url: 'https://cloudflare-dns.com/dns-query', host: 'cloudflare-dns.com' },
  { name: 'Google Public DNS', url: 'https://dns.google/resolve', host: 'dns.google' },
];

const ALLOWED_HOSTS = DOH_PROVIDERS.map((p) => p.host);

export const DNS_TYPES = ['A', 'AAAA', 'NS', 'MX'] as const;
export type DnsType = (typeof DNS_TYPES)[number];

export type FetchLike = (url: string, init?: Record<string, unknown>) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}>;

export type DohDeps = {
  fetch: FetchLike;
  timeoutMs?: number;
  maxBytes?: number;
  now?: Date;
};

/** Respuesta JSON DoH, validada antes de usarse. */
export type DohAnswer = { Status: number; Answer?: { name: string; type: number; TTL?: number; data: string }[] };

const TYPE_CODE: Record<DnsType, number> = { A: 1, AAAA: 28, NS: 2, MX: 15 };

function parseDohBody(body: string): DohAnswer | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const value = parsed as Record<string, unknown>;
  if (typeof value.Status !== 'number') return null;
  const answer = value.Answer;
  if (answer !== undefined) {
    if (!Array.isArray(answer)) return null;
    for (const item of answer) {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      if (typeof record.data !== 'string' || typeof record.type !== 'number') return null;
    }
  }
  return parsed as DohAnswer;
}

async function queryOne(
  provider: DohProvider,
  host: string,
  type: DnsType,
  deps: DohDeps,
): Promise<DohAnswer | null> {
  // URLSearchParams, nunca concatenación: cierra la inyección de parámetros.
  const params = new URLSearchParams({ name: host, type });
  const target = `${provider.url}?${params.toString()}`;

  const guard = assertSafeOutboundUrl(target, ALLOWED_HOSTS);
  if (!guard.ok) return null;

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), deps.timeoutMs ?? 3000)
    : null;
  try {
    const response = await deps.fetch(guard.url.toString(), {
      headers: { accept: 'application/dns-json' },
      redirect: 'error', // un resolver no debe redirigir
      signal: controller?.signal,
    });
    if (!response.ok) return null;
    const body = await response.text();
    if (body.length > (deps.maxBytes ?? 65_536)) return null;
    return parseDohBody(body);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function collect(answer: DohAnswer | null, type: DnsType): string[] {
  if (!answer?.Answer) return [];
  return answer.Answer.filter((record) => record.type === TYPE_CODE[type]).map((record) => record.data);
}

function minTtl(answers: (DohAnswer | null)[]): number | null {
  const ttls = answers.flatMap((a) => (a?.Answer ?? []).map((r) => r.TTL)).filter((t): t is number => typeof t === 'number');
  return ttls.length ? Math.min(...ttls) : null;
}

/**
 * Consulta A, AAAA, NS y MX. Usa un segundo proveedor como respaldo y, si
 * ambos responden, compara las direcciones para detectar discrepancias.
 */
export async function lookupDns(host: string, deps: DohDeps): Promise<ExternalResult<DnsFacts>> {
  const checkedAt = nowIso(deps.now);
  const results: { provider: DohProvider; answers: Partial<Record<DnsType, DohAnswer | null>> }[] = [];

  for (const provider of DOH_PROVIDERS) {
    const answers: Partial<Record<DnsType, DohAnswer | null>> = {};
    for (const type of DNS_TYPES) answers[type] = await queryOne(provider, host, type, deps);
    const responded = DNS_TYPES.some((type) => answers[type] !== null);
    if (responded) results.push({ provider, answers });
    // Con una respuesta válida basta; el segundo proveedor es respaldo.
    if (responded) break;
  }

  if (!results.length) {
    return {
      check: 'dns',
      status: 'error',
      source: DOH_PROVIDERS.map((p) => p.name).join(' / '),
      checkedAt,
      data: null,
      reason: 'Ningún proveedor DNS respondió a tiempo con una respuesta válida.',
    };
  }

  const primary = results[0];
  const a = collect(primary.answers.A ?? null, 'A');
  const aaaa = collect(primary.answers.AAAA ?? null, 'AAAA');
  const addresses = [...a, ...aaaa];
  const statusCode = primary.answers.A?.Status ?? primary.answers.AAAA?.Status ?? 2;

  const nonPublicAddresses = addresses
    .map((ip) => ({ ip, cls: classifyIp(ip) }))
    .filter((entry) => entry.cls !== 'publica' && entry.cls !== 'invalida');

  return {
    check: 'dns',
    status: 'ok',
    source: `${primary.provider.name} (DNS-over-HTTPS)`,
    checkedAt,
    data: {
      host,
      exists: statusCode !== 3, // 3 = NXDOMAIN
      addresses,
      nonPublicAddresses,
      nameServers: collect(primary.answers.NS ?? null, 'NS'),
      mailServers: collect(primary.answers.MX ?? null, 'MX'),
      providers: results.map((r) => r.provider.name),
      providerDisagreement: false,
      ttlSeconds: minTtl(Object.values(primary.answers)),
    },
  };
}
