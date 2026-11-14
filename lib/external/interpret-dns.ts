// Traduce hechos DNS a evidencia auditable.
//
// Regla que no se negocia: que un dominio resuelva NO es señal de legitimidad.
// Todo estafador registra un dominio que resuelve; es el primer paso del
// fraude, no una credencial. Por eso la resolución correcta se emite como
// contexto («verificado», severidad informativa) y nunca reduce el riesgo.

import type { AuditIndicator } from '../analysis/risk.ts';
import type { DnsFacts, ExternalResult } from './types.ts';

const CATEGORY = 'Infraestructura del dominio';

export function interpretDns(result: ExternalResult<DnsFacts>): AuditIndicator[] {
  const base = {
    category: CATEGORY,
    source: result.source,
    checkedAt: result.checkedAt,
  };

  if (result.status === 'deshabilitada' || result.status === 'no-disponible') {
    return [
      {
        ...base,
        id: 'dns-no-disponible',
        indicator: 'Resolución DNS',
        classification: 'pendiente-externo',
        status: 'no verificado',
        severity: 'informativo',
        evidence: result.reason ?? 'La consulta DNS no se realizó.',
        recommendation: 'Trata el dominio como no verificado.',
        limitation: 'Sin consulta DNS no se sabe si el dominio existe ni a dónde apunta.',
      },
    ];
  }

  if (result.status === 'error' || !result.data) {
    return [
      {
        ...base,
        id: 'dns-error',
        indicator: 'Resolución DNS',
        classification: 'error',
        status: 'error',
        severity: 'informativo',
        evidence: result.reason ?? 'La consulta DNS falló.',
        recommendation: 'Vuelve a intentarlo más tarde; por ahora el dato es no verificable.',
        limitation: 'Un fallo de consulta no dice nada sobre el dominio: no es señal de riesgo ni de seguridad.',
      },
    ];
  }

  const facts = result.data;
  const indicators: AuditIndicator[] = [];

  if (!facts.exists) {
    indicators.push({
      ...base,
      id: 'dns-inexistente',
      indicator: 'El dominio no existe en el DNS',
      classification: 'verificado-externo',
      status: 'sospechoso',
      severity: 'medio',
      evidence: `«${facts.host}» no está registrado o fue dado de baja: el DNS responde NXDOMAIN, según ${facts.providers.join(' y ')}.`,
      recommendation:
        'Un enlace que te enviaron y cuyo dominio no existe suele ser un fraude ya desactivado o una dirección mal escrita a propósito. No vuelvas a intentarlo.',
      limitation:
        'También puede tratarse de un error de escritura o de un dominio recién dado de baja por el propio proveedor.',
    });
    return indicators;
  }

  indicators.push({
    ...base,
    id: 'dns-resolucion',
    indicator: 'El dominio resuelve en el DNS',
    classification: 'verificado-externo',
    status: 'verificado',
    severity: 'informativo',
    evidence:
      `«${facts.host}» resuelve a ${facts.addresses.length} dirección(es) IP` +
      (facts.ttlSeconds !== null ? ` con TTL mínimo de ${facts.ttlSeconds} s` : '') +
      `. Servidores de nombres: ${facts.nameServers.length ? facts.nameServers.join(', ') : 'no publicados'}.`,
    recommendation: 'Dato de contexto: no lo tomes como prueba de que el sitio sea legítimo.',
    limitation:
      'Que un dominio resuelva solo significa que alguien lo configuró. No indica titularidad, antigüedad ni reputación, y no reduce el riesgo.',
  });

  if (facts.nonPublicAddresses.length) {
    const detail = facts.nonPublicAddresses.map((entry) => `${entry.ip} (${entry.cls})`).join(', ');
    indicators.push({
      ...base,
      id: 'dns-rango-no-publico',
      indicator: 'El dominio apunta a direcciones no enrutables',
      classification: 'verificado-externo',
      status: 'sospechoso',
      severity: 'alto',
      evidence: `El dominio resuelve a direcciones fuera de Internet público: ${detail}.`,
      recommendation:
        'Esta configuración se usa para evadir análisis automáticos o para alcanzar equipos de una red interna. No abras el enlace.',
      limitation: 'En entornos de desarrollo esta configuración es normal y no implica fraude.',
    });
  }

  if (facts.ttlSeconds !== null && facts.ttlSeconds < 60) {
    indicators.push({
      ...base,
      id: 'dns-ttl-muy-bajo',
      indicator: 'Tiempo de vida DNS muy corto',
      classification: 'verificado-externo',
      status: 'sospechoso',
      severity: 'bajo',
      evidence: `El registro tiene un TTL de ${facts.ttlSeconds} s, por debajo de 60 s.`,
      recommendation: 'Señal débil: considérala solo junto con otras evidencias.',
      limitation:
        'Las redes de distribución de contenido y los balanceadores legítimos también usan TTL muy cortos. Por sí sola no indica fraude.',
    });
  }

  if (facts.providerDisagreement) {
    indicators.push({
      ...base,
      id: 'dns-discrepancia',
      indicator: 'Los resolutores DNS no coinciden',
      classification: 'verificado-externo',
      status: 'no concluyente',
      severity: 'bajo',
      evidence: `Los proveedores consultados (${facts.providers.join(', ')}) devolvieron direcciones distintas.`,
      recommendation: 'Vuelve a comprobarlo antes de concluir.',
      limitation: 'El reparto geográfico de tráfico produce esta diferencia de forma habitual.',
    });
  }

  return indicators;
}
