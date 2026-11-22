// Generación de reportes exportables (Markdown y JSON) sin datos sensibles.
//
// Distingue explícitamente entre:
//  - Evidencia comprobada (determinista y externa verificada)
//  - Interpretación de IA (estimación no verificada)
//  - Comprobaciones pendientes o fallidas
//  - Correlaciones locales y recomendaciones de protección

import type { AnalysisResult } from './analyze.ts';
import type { IncidentCorrelation } from './correlation.ts';
import { maskSensitive } from '../history.ts';
import { es as esDictionary, en as enDictionary } from '../i18n/dictionary.ts';

export type ExportableReport = {
  schema: 'xibalba-report/v1';
  generatedAt: string;
  lang: 'es' | 'en';
  verdict: {
    light: string;
    riskLevel: string;
    confidence: string;
    checksRun: number;
    checksTotal: number;
    source: string | null;
  };
  agents: string[];
  verifiedEvidence: {
    id: string;
    indicator: string;
    status: string;
    severity: string;
    classification: string;
    evidence: string;
    recommendation: string;
    limitation: string;
  }[];
  aiInterpretation: {
    available: boolean;
    risk: string | null;
    summary: string | null;
    evidence: string[];
    recommendations: string[];
    error: string | null;
  };
  pendingChecks: string[];
  campaigns: { name: string; confidence: string; description: string }[];
  relatedIncidentsCount: number;
};

export function buildReportData(
  result: AnalysisResult,
  correlation: IncidentCorrelation,
  lang: 'es' | 'en' = 'es',
  now = new Date(),
): ExportableReport {
  const verifiedEvidence = result.audit.indicators
    .filter(
      (i) => i.classification === 'determinista' || i.classification === 'verificado-externo',
    )
    .map((i) => ({
      id: i.id,
      indicator: i.indicator,
      status: i.status,
      severity: i.severity,
      classification: i.classification,
      evidence: maskSensitive(i.evidence),
      recommendation: i.recommendation,
      limitation: i.limitation,
    }));

  return {
    schema: 'xibalba-report/v1',
    generatedAt: now.toISOString(),
    lang,
    verdict: {
      light: result.risk.light,
      riskLevel: result.risk.riskLevel,
      confidence: result.risk.confidence,
      checksRun: result.risk.coverage.checksRun,
      checksTotal: result.risk.coverage.checksTotal,
      source: result.source,
    },
    agents: result.contributing,
    verifiedEvidence,
    aiInterpretation: {
      available: Boolean(result.assessment),
      risk: result.assessment?.risk ?? null,
      summary: result.assessment?.summary ?? null,
      evidence: result.assessment?.evidence ?? [],
      recommendations: result.assessment?.recommendations ?? [],
      // `result.aiError` es una clave (ver `lib/analysis/errors.ts`), no texto:
      // se traduce aquí, en el único lugar que ya conoce `lang`, para que el
      // reporte exportado (Markdown, JSON, PDF) respete el idioma elegido en
      // vez de mostrar siempre español como pasaba antes.
      error: result.aiError ? (lang === 'en' ? enDictionary : esDictionary).errors[result.aiError] : null,
    },
    pendingChecks: result.audit.coverage.pendingExternal,
    campaigns: correlation.campaigns.map((c) => ({
      name: lang === 'en' ? c.nameEn : c.nameEs,
      confidence: c.confidence,
      description: lang === 'en' ? c.descriptionEn : c.descriptionEs,
    })),
    relatedIncidentsCount: correlation.relatedEntries.length,
  };
}

export function formatReportMarkdown(report: ExportableReport): string {
  const en = report.lang === 'en';
  const lines: string[] = [
    en ? '# XIBALBÁ 2.0 — Fraud Investigation Report' : '# XIBALBÁ 2.0 — Reporte de Investigación Antifraude',
    '',
    `- **${en ? 'Generated' : 'Generado'}:** ${report.generatedAt}`,
    `- **${en ? 'Traffic light' : 'Semáforo'}:** ${report.verdict.light.toUpperCase()}`,
    `- **${en ? 'Risk level' : 'Nivel de riesgo'}:** ${report.verdict.riskLevel}`,
    `- **${en ? 'Confidence' : 'Confianza'}:** ${report.verdict.confidence}`,
    `- **${en ? 'Coverage' : 'Cobertura'}:** ${report.verdict.checksRun}/${report.verdict.checksTotal}`,
    `- **${en ? 'Active agents' : 'Agentes participantes'}:** ${report.agents.join(', ') || '—'}`,
    '',
    en ? '## A. Verified Deterministic & Public Evidence' : '## A. Evidencia Comprobada (Determinista / Externa)',
  ];

  if (!report.verifiedEvidence.length) {
    lines.push(en ? '_No deterministic signals recorded._' : '_No se registraron señales deterministas._');
  } else {
    for (const item of report.verifiedEvidence) {
      lines.push(
        `- **[${item.status.toUpperCase()} · ${item.severity}] ${item.indicator}**: ${item.evidence}`,
        `  - ${en ? 'Recommendation' : 'Recomendación'}: ${item.recommendation}`,
        `  - ${en ? 'Limitation' : 'Limitación'}: ${item.limitation}`,
      );
    }
  }

  lines.push('', en ? '## B. AI Interpretation (Unverified)' : '## B. Interpretación de IA (No verificada)');
  if (report.aiInterpretation.available) {
    lines.push(
      `- **${en ? 'Estimated risk' : 'Riesgo estimado'}:** ${report.aiInterpretation.risk}`,
      `- **${en ? 'Summary' : 'Resumen'}:** ${report.aiInterpretation.summary}`,
    );
    for (const rec of report.aiInterpretation.recommendations) {
      lines.push(`  - ${rec}`);
    }
  } else {
    lines.push(
      report.aiInterpretation.error
        ? `${en ? 'Unavailable' : 'No disponible'}: ${report.aiInterpretation.error}`
        : en
          ? '_No AI interpretation was requested._'
          : '_No se solicitó interpretación de IA._',
    );
  }

  lines.push('', en ? '## C. Pending / Unchecked Items' : '## C. Comprobaciones Pendientes');
  if (!report.pendingChecks.length) {
    lines.push(en ? '_None._' : '_Ninguna._');
  } else {
    for (const p of report.pendingChecks) lines.push(`- ${p}`);
  }

  if (report.campaigns.length || report.relatedIncidentsCount > 0) {
    lines.push('', en ? '## D. Local Correlation & Campaigns' : '## D. Correlación Local y Campañas');
    lines.push(
      en
        ? `- Related incidents in local history: ${report.relatedIncidentsCount}`
        : `- Incidentes relacionados en el historial local: ${report.relatedIncidentsCount}`,
    );
    for (const c of report.campaigns) {
      lines.push(`- **${c.name}** (${c.confidence}): ${c.description}`);
    }
  }

  lines.push(
    '',
    '---',
    en
      ? '_Note: This report masks sensitive sequences and does not confirm fraud or guarantee safety._'
      : '_Nota: Este reporte enmascara secuencias sensibles y no confirma un fraude ni garantiza que algo sea seguro._',
  );

  return lines.join('\n');
}
