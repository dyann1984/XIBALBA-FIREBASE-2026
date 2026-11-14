// Traduce hechos de registro (RDAP, o WHOIS cuando se habilite) a evidencia.
//
// Igual que con el DNS: la antigüedad no es un certificado. Un dominio de diez
// años puede estar comprometido o haber sido comprado para suplantar a una
// marca. La antigüedad alta se emite como contexto informativo; solo la
// antigüedad muy corta constituye señal de riesgo.

import type { AuditIndicator, Severity } from '../analysis/risk.ts';
import type { ExternalResult, RegistrationFacts } from './types.ts';
import { ageInDays } from './types.ts';

const CATEGORY = 'Titularidad y antigüedad del dominio';

/** Estados RDAP/EPP que indican un dominio retenido o en proceso de baja. */
const ALARMING_STATUS = [
  'client hold',
  'server hold',
  'clienthold',
  'serverhold',
  'pending delete',
  'pendingdelete',
  'redemption period',
  'redemptionperiod',
];

export function interpretRegistration(
  result: ExternalResult<RegistrationFacts>,
  options: { now?: Date } = {},
): AuditIndicator[] {
  const base = {
    category: CATEGORY,
    source: result.source,
    checkedAt: result.checkedAt,
  };

  if (result.status === 'deshabilitada') {
    return [
      {
        ...base,
        id: `${result.check}-deshabilitada`,
        indicator: 'Antigüedad y titularidad del dominio',
        classification: 'pendiente-externo',
        status: 'no verificado',
        severity: 'informativo',
        evidence: result.reason ?? 'La comprobación está deshabilitada.',
        recommendation: 'Trata la antigüedad del dominio como desconocida: no verificable.',
        limitation: 'Sin este dato no se puede saber si el dominio se creó hace años o esta semana.',
      },
    ];
  }

  if (result.status === 'no-disponible') {
    return [
      {
        ...base,
        id: 'rdap-no-disponible',
        indicator: 'Antigüedad y titularidad del dominio',
        classification: 'pendiente-externo',
        status: 'no verificado',
        severity: 'informativo',
        evidence: result.reason ?? 'El registro no ofrece consulta automatizada.',
        recommendation:
          'No concluyente. Verifica el negocio por otro medio: un teléfono oficial, una sucursal o el sitio que ya conocías.',
        limitation:
          'No todos los registros nacionales publican estos datos de forma automatizada. La ausencia del dato no es señal de riesgo ni de seguridad.',
      },
    ];
  }

  if (result.status === 'error') {
    return [
      {
        ...base,
        id: `${result.check}-error`,
        indicator: 'Antigüedad y titularidad del dominio',
        classification: 'error',
        status: 'error',
        severity: 'informativo',
        evidence: result.reason ?? 'La consulta al registro falló.',
        recommendation: 'Vuelve a intentarlo más tarde; por ahora el dato es no verificable.',
        limitation: 'Un fallo de consulta no dice nada sobre el dominio.',
      },
    ];
  }

  // status === 'ok'
  if (!result.data) {
    return [
      {
        ...base,
        id: 'rdap-no-registrado',
        indicator: 'El dominio no está registrado',
        classification: 'verificado-externo',
        status: 'sospechoso',
        severity: 'medio',
        evidence: result.reason ?? 'El registro responde que el dominio no está registrado.',
        recommendation:
          'Un enlace cuyo dominio no está registrado no puede ser el sitio oficial de nadie. No lo abras.',
        limitation: 'Puede deberse a un error de escritura en la dirección recibida.',
      },
    ];
  }

  const facts = result.data;
  const indicators: AuditIndicator[] = [];

  if (facts.registeredAt) {
    const days = ageInDays(facts.registeredAt, options.now);
    const date = facts.registeredAt.slice(0, 10);

    if (days === null) {
      indicators.push({
        ...base,
        id: 'rdap-fecha-ilegible',
        indicator: 'Antigüedad del dominio',
        classification: 'error',
        status: 'error',
        severity: 'informativo',
        evidence: `El registro devolvió una fecha de creación que no se pudo interpretar: «${facts.registeredAt}».`,
        recommendation: 'Trata la antigüedad como desconocida.',
        limitation: 'Dato contradictorio: no se usa para calcular riesgo.',
      });
    } else if (days < 0) {
      // Fecha en el futuro: el registro se contradice.
      indicators.push({
        ...base,
        id: 'rdap-fecha-contradictoria',
        indicator: 'Fecha de creación inconsistente',
        classification: 'error',
        status: 'error',
        severity: 'informativo',
        evidence: `El registro declara una fecha de creación futura (${date}), lo que es imposible.`,
        recommendation: 'Trata la antigüedad como desconocida.',
        limitation: 'Dato contradictorio: se descarta en lugar de interpretarlo.',
      });
    } else {
      const severity: Severity | null = days < 30 ? 'alto' : days < 180 ? 'medio' : null;
      if (severity) {
        indicators.push({
          ...base,
          id: 'rdap-dominio-reciente',
          indicator: days < 30 ? 'Dominio creado hace muy poco' : 'Dominio creado hace pocos meses',
          classification: 'verificado-externo',
          status: 'sospechoso',
          severity,
          evidence: `El registro indica que el dominio se creó el ${date}: hace ${days} día(s).`,
          recommendation:
            'Las campañas de fraude usan dominios nuevos porque los anteriores ya fueron bloqueados. Desconfía de cobros, pagos o datos solicitados desde un dominio tan reciente.',
          limitation:
            'Un negocio legítimo que acaba de abrir también tiene un dominio nuevo. Es señal de alerta, no prueba de fraude.',
        });
      } else {
        indicators.push({
          ...base,
          id: 'rdap-antiguedad',
          indicator: 'Antigüedad del dominio',
          classification: 'verificado-externo',
          status: 'verificado',
          severity: 'informativo',
          evidence: `El registro indica que el dominio se creó el ${date}: hace ${days} día(s)${facts.registrar ? `, a través de ${facts.registrar}` : ''}.`,
          recommendation: 'Dato de contexto: no lo tomes como prueba de que el sitio sea legítimo.',
          limitation:
            'La antigüedad no acredita nada. Un dominio antiguo puede estar comprometido o haberse comprado para suplantar a una marca, y no reduce el riesgo.',
        });
      }
    }
  } else if (facts.dateRedacted) {
    indicators.push({
      ...base,
      id: 'rdap-fecha-redactada',
      indicator: 'Antigüedad del dominio',
      classification: 'pendiente-externo',
      status: 'no verificado',
      severity: 'informativo',
      evidence: 'El registro respondió, pero no publica la fecha de creación del dominio.',
      recommendation: 'Trata la antigüedad como desconocida: no verificable.',
      limitation: 'Muchos registros ocultan estos campos por política de privacidad. No es señal de riesgo.',
    });
  }

  const alarming = facts.statuses.filter((status) =>
    ALARMING_STATUS.includes(status.trim().toLowerCase()),
  );
  if (alarming.length) {
    indicators.push({
      ...base,
      id: 'rdap-estado-retenido',
      indicator: 'El dominio está retenido o en proceso de baja',
      classification: 'verificado-externo',
      status: 'sospechoso',
      severity: 'medio',
      evidence: `El registro declara los estados: ${alarming.join(', ')}.`,
      recommendation:
        'Un dominio retenido suele indicar una denuncia en curso o un impago. No introduzcas datos ni pagues nada ahí.',
      limitation: 'También ocurre por trámites administrativos del titular.',
    });
  }

  if (facts.expiresAt) {
    const remaining = ageInDays(facts.expiresAt, options.now);
    if (remaining !== null && remaining > 0) {
      indicators.push({
        ...base,
        id: 'rdap-vencido',
        indicator: 'El registro del dominio está vencido',
        classification: 'verificado-externo',
        status: 'sospechoso',
        severity: 'bajo',
        evidence: `La fecha de vencimiento declarada (${facts.expiresAt.slice(0, 10)}) ya pasó hace ${remaining} día(s).`,
        recommendation: 'Un dominio vencido puede cambiar de dueño en cualquier momento. No confíes en él.',
        limitation: 'El registro puede estar en periodo de gracia y renovarse sin incidencia.',
      });
    }
  }

  return indicators;
}
