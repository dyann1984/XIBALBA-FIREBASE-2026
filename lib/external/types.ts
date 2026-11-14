// Contrato común de las comprobaciones externas.
//
// Toda comprobación devuelve siempre un resultado, nunca lanza: una consulta
// que falla es información («no verificable»), no una excepción que deba
// tumbar el análisis local.

export type ExternalCheckId = 'dns' | 'rdap' | 'whois';

export type ExternalStatus =
  /** La consulta se completó y hay datos. */
  | 'ok'
  /** La comprobación no aplica o el registro no la ofrece (p. ej. TLD sin RDAP). */
  | 'no-disponible'
  /** La consulta se intentó y falló: red, tiempo agotado, respuesta inválida. */
  | 'error'
  /** La comprobación existe pero está apagada por configuración. */
  | 'deshabilitada';

export type ExternalResult<T> = {
  check: ExternalCheckId;
  status: ExternalStatus;
  /** Proveedor o registro concreto consultado, para poder citarlo. */
  source: string;
  checkedAt: string;
  data: T | null;
  /** Motivo cuando el estado no es `ok`. Se muestra tal cual al usuario. */
  reason?: string;
};

export type DnsFacts = {
  host: string;
  /** `true` si el dominio existe (NOERROR), `false` si NXDOMAIN. */
  exists: boolean;
  addresses: string[];
  /** Direcciones que caen en rangos no enrutables, con su clasificación. */
  nonPublicAddresses: { ip: string; cls: string }[];
  nameServers: string[];
  mailServers: string[];
  /** Proveedores que respondieron, para poder declarar la fuente. */
  providers: string[];
  /** `true` si dos proveedores dieron conjuntos de direcciones distintos. */
  providerDisagreement: boolean;
  ttlSeconds: number | null;
};

export type RegistrationFacts = {
  registrable: string;
  /** ISO 8601, o `null` si el registro la oculta. */
  registeredAt: string | null;
  expiresAt: string | null;
  lastChangedAt: string | null;
  registrar: string | null;
  statuses: string[];
  /** `true` cuando el registro responde pero redacta la fecha. */
  dateRedacted: boolean;
};

export function nowIso(now: Date = new Date()): string {
  return now.toISOString();
}

export function ageInDays(isoDate: string, now: Date = new Date()): number | null {
  const then = Date.parse(isoDate);
  if (Number.isNaN(then)) return null;
  const days = (now.getTime() - then) / 86_400_000;
  return Number.isFinite(days) ? Math.floor(days) : null;
}
