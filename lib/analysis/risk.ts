// Modelo de riesgo y semáforo.
//
// Regla rectora: la ausencia de señales NO es evidencia de seguridad. Una URL
// cuya reputación, titularidad y destino final no se han comprobado nunca
// puede calificarse como verde de forma automática; el resultado correcto en
// ese caso es gris (no concluyente).

export type TrafficLight = 'verde' | 'amarillo' | 'rojo' | 'gris';

/** Nivel que puede emitir el modelo de IA. */
export type AiRiskLevel = 'bajo' | 'medio' | 'alto';

/** Nivel que puede emitir el motor combinado, incluido el caso sin conclusión. */
export type RiskLevel = 'bajo' | 'medio' | 'alto' | 'no concluyente';

export type Severity = 'critico' | 'alto' | 'medio' | 'bajo' | 'informativo';

/**
 * Clasificación obligatoria de cada evidencia:
 *  A.  `determinista`        — hecho comprobado localmente sobre el dato recibido.
 *  A′. `verificado-externo`  — hecho obtenido de un registro público (DNS, RDAP),
 *                              con fuente y fecha citables. Puede elevar el
 *                              riesgo; nunca puede demostrar seguridad.
 *  B.  `ia`                  — interpretación del modelo, no verificada.
 *  C.  `pendiente-externo`   — comprobación que requiere red y no se realizó.
 *  D.  `error`               — la comprobación no pudo ejecutarse.
 */
export type EvidenceClass =
  | 'determinista'
  | 'verificado-externo'
  | 'ia'
  | 'pendiente-externo'
  | 'error';

/** Clases cuya evidencia es un hecho comprobado, no una interpretación. */
export const VERIFIED_CLASSES: readonly EvidenceClass[] = ['determinista', 'verificado-externo'];

function isVerified(item: AuditIndicator): boolean {
  return item.classification === 'determinista' || item.classification === 'verificado-externo';
}

export type IndicatorStatus =
  | 'verificado'
  | 'sospechoso'
  | 'no concluyente'
  | 'no verificado'
  | 'error';

export type AuditIndicator = {
  id: string;
  indicator: string;
  category: string;
  classification: EvidenceClass;
  status: IndicatorStatus;
  severity: Severity;
  evidence: string;
  source: string;
  checkedAt: string;
  recommendation: string;
  limitation: string;
};

export type Coverage = {
  label: string;
  checksRun: number;
  checksTotal: number;
  /** Comprobaciones que requieren red y permanecen deshabilitadas. */
  pendingExternal: string[];
};

export type AuditSubject =
  | 'url'
  | 'mensaje'
  /** Transcripción de una llamada (CAMAZOTZ). */
  | 'transcripcion'
  /** Contenido financiero: depósitos, créditos, inversiones (VUCUB CAMÉ). */
  | 'financiero'
  /** Archivo de audio cuyo contenido aún no se ha transcrito. */
  | 'audio'
  | 'imagen'
  | 'mixto';

export type Audit = {
  subject: AuditSubject;
  indicators: AuditIndicator[];
  coverage: Coverage;
  limitation: string;
};

export type DeterministicVerdict = {
  /** El motor local nunca emite «bajo»: no puede demostrar seguridad. */
  level: 'alto' | 'medio' | 'no concluyente';
  score: number;
  suspicious: number;
  topSignals: string[];
  /**
   * `true` solo cuando la evidencia local agota el objeto analizado (texto
   * completo sin enlaces). Para URLs es siempre `false`.
   */
  locallyExhaustive: boolean;
};

export type CombinedRisk = {
  light: TrafficLight;
  riskLevel: RiskLevel;
  confidence: 'alta' | 'media' | 'baja';
  confidenceReason: string;
  coverage: Coverage;
  rationale: string[];
  aiRisk: AiRiskLevel | null;
  deterministic: DeterministicVerdict;
};

const WEIGHT: Record<Severity, number> = {
  critico: 100,
  alto: 45,
  medio: 18,
  bajo: 6,
  informativo: 0,
};

/**
 * Mapa directo nivel → color. Se conserva con la firma original: cualquier
 * valor ausente o desconocido produce gris, nunca verde.
 */
export function trafficLight(risk?: string | null): TrafficLight {
  return risk === 'bajo'
    ? 'verde'
    : risk === 'medio'
      ? 'amarillo'
      : risk === 'alto'
        ? 'rojo'
        : 'gris';
}

export function severityOf(indicator: AuditIndicator): Severity {
  return indicator.status === 'sospechoso' ? indicator.severity : 'informativo';
}

/**
 * Puntúa las evidencias comprobadas (locales A y externas verificadas A′)
 * marcadas como sospechosas. La interpretación de la IA no entra aquí.
 */
export function deterministicVerdict(audit: Audit): DeterministicVerdict {
  const suspicious = audit.indicators.filter((item) => isVerified(item) && item.status === 'sospechoso');
  const score = suspicious.reduce((total, item) => total + WEIGHT[item.severity], 0);
  const level: DeterministicVerdict['level'] =
    score >= 45 ? 'alto' : score >= 15 ? 'medio' : 'no concluyente';
  const topSignals = [...suspicious]
    .sort((a, b) => WEIGHT[b.severity] - WEIGHT[a.severity])
    .slice(0, 5)
    .map((item) => item.indicator);
  return {
    level,
    score,
    suspicious: suspicious.length,
    topSignals,
    // Una URL (o un contenido que la incluya) nunca se agota localmente: aunque
    // DNS y RDAP hayan respondido, siguen sin comprobarse el certificado, la
    // reputación, las redirecciones y el contenido publicado. Resolver en el
    // DNS o tener años de antigüedad no basta para declarar un sitio seguro.
    locallyExhaustive:
      audit.subject !== 'url' &&
      audit.subject !== 'mixto' &&
      audit.coverage.pendingExternal.length === 0,
  };
}

/**
 * Combina la evidencia determinista (A) con la interpretación de IA (B).
 * La evidencia determinista nunca se rebaja por una opinión más benigna del
 * modelo; el modelo solo puede elevar el nivel.
 */
export function combineRisk(audit: Audit, ai?: { risk: AiRiskLevel } | null): CombinedRisk {
  const deterministic = deterministicVerdict(audit);
  const aiRisk = ai?.risk ?? null;
  const rationale: string[] = [];

  let riskLevel: RiskLevel;
  if (deterministic.level === 'alto') {
    riskLevel = 'alto';
    rationale.push(
      `Evidencia determinista de severidad alta: ${deterministic.topSignals.join('; ')}.`,
    );
  } else if (aiRisk === 'alto') {
    riskLevel = 'alto';
    rationale.push('El modelo estimó riesgo alto; se adopta el nivel más protector.');
  } else if (deterministic.level === 'medio') {
    riskLevel = 'medio';
    rationale.push(`Señales deterministas de nivel medio: ${deterministic.topSignals.join('; ')}.`);
  } else if (aiRisk === 'medio') {
    riskLevel = 'medio';
    rationale.push('Sin señales deterministas relevantes; el modelo estimó riesgo medio.');
  } else if (!deterministic.locallyExhaustive) {
    riskLevel = 'no concluyente';
    rationale.push(
      'No se detectaron señales locales, pero quedan comprobaciones externas sin realizar: la ausencia de señales no demuestra seguridad.',
    );
  } else if (aiRisk === 'bajo') {
    riskLevel = 'bajo';
    rationale.push(
      'El contenido se analizó por completo de forma local, no se hallaron señales y el modelo estimó riesgo bajo.',
    );
  } else {
    riskLevel = 'no concluyente';
    rationale.push('No se hallaron señales locales y no hay interpretación de IA disponible.');
  }

  if (deterministic.level !== 'alto' && aiRisk === 'alto' && deterministic.suspicious === 0) {
    rationale.push('Advertencia: el nivel alto proviene solo del modelo, sin respaldo determinista.');
  }
  if (aiRisk === 'bajo' && riskLevel !== 'bajo') {
    rationale.push(
      'El modelo estimó riesgo bajo, pero no se puede confirmar seguridad sin las comprobaciones externas pendientes.',
    );
  }
  if (audit.coverage.pendingExternal.length) {
    rationale.push(`Comprobaciones pendientes: ${audit.coverage.pendingExternal.join(', ')}.`);
  }

  const criticalCount = audit.indicators.filter(
    (item) => isVerified(item) && item.status === 'sospechoso' && item.severity === 'critico',
  ).length;
  const highCount = audit.indicators.filter(
    (item) => isVerified(item) && item.status === 'sospechoso' && item.severity === 'alto',
  ).length;

  let confidence: CombinedRisk['confidence'];
  let confidenceReason: string;
  if (criticalCount > 0 || highCount >= 2) {
    confidence = 'alta';
    confidenceReason =
      'Se observaron directamente patrones de severidad crítica o varias señales altas en el contenido recibido.';
  } else if (deterministic.score >= 15) {
    confidence = 'media';
    confidenceReason = 'Existen señales deterministas, pero admiten explicaciones legítimas.';
  } else {
    confidence = 'baja';
    confidenceReason =
      deterministic.suspicious === 0 && aiRisk
        ? 'No hay evidencia determinista; el nivel depende de la interpretación no verificada del modelo.'
        : 'La cobertura local es limitada y no hay evidencia suficiente para sostener una conclusión.';
  }

  return {
    light: riskLevel === 'no concluyente' ? 'gris' : trafficLight(riskLevel),
    riskLevel,
    confidence,
    confidenceReason,
    coverage: audit.coverage,
    rationale,
    aiRisk,
    deterministic,
  };
}

export const RISK_LABEL: Record<RiskLevel, string> = {
  alto: 'Riesgo alto',
  medio: 'Riesgo medio',
  bajo: 'Riesgo bajo',
  'no concluyente': 'No concluyente',
};

export const LIGHT_LABEL: Record<TrafficLight, string> = {
  rojo: 'Rojo · no continúes',
  amarillo: 'Amarillo · verifica antes de actuar',
  verde: 'Verde · sin señales locales de riesgo',
  gris: 'Gris · información insuficiente',
};
