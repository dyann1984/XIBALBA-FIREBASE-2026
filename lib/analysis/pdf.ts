// Exportación a PDF del expediente de análisis, en el mismo espíritu que
// `report.ts` (Markdown/JSON): evidencia comprobada separada de la
// interpretación de IA, datos sensibles enmascarados (ya vienen así desde
// `buildReportData`), sin confirmar fraude ni inventar nada que el motor no
// haya encontrado. Se genera enteramente en el dispositivo con jsPDF; nada
// de esto sale del navegador.

import type { jsPDF } from "jspdf";
import type { ExportableReport } from "./report";

// `jspdf` pesa bastante (~130 kB) y solo lo necesita quien de verdad pulsa
// "Exportar PDF". El tipo se importa arriba (se borra en tiempo de
// compilación, no pesa nada), pero la clase real se carga de forma
// perezosa dentro de `buildReportPdf` para no inflar el paquete inicial de
// todo el mundo en móvil por una función que la mayoría no usa en cada
// sesión.

const COLORS = {
  verde: [34, 150, 95] as const,
  amarillo: [181, 136, 24] as const,
  rojo: [176, 48, 48] as const,
  gris: [110, 118, 130] as const,
  ink: [26, 30, 38] as const,
  muted: [96, 103, 115] as const,
};

function lightColor(light: string) {
  return COLORS[light as keyof typeof COLORS] ?? COLORS.gris;
}

/** Envuelve texto al ancho disponible y devuelve la coordenada Y siguiente,
 * saltando de página cuando no cabe más contenido. */
function writeParagraph(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight = 5,
): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  for (const line of lines) {
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

function sectionHeading(doc: jsPDF, title: string, y: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y > pageHeight - 30) {
    doc.addPage();
    y = 20;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.ink);
  doc.text(title, 14, y);
  doc.setDrawColor(...COLORS.muted);
  doc.setLineWidth(0.2);
  doc.line(14, y + 2, doc.internal.pageSize.getWidth() - 14, y + 2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  return y + 9;
}

/** Construye el PDF como bytes (`Uint8Array`), listo para empaquetar en un
 * `Blob` y descargarse, igual que las exportaciones Markdown/JSON. */
export async function buildReportPdf(report: ExportableReport): Promise<Uint8Array<ArrayBuffer>> {
  const { jsPDF: JsPdf } = await import("jspdf");
  const en = report.lang === "en";
  const doc = new JsPdf({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;
  let y = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.ink);
  doc.text("XIBALBÁ AI", marginX, y);
  y += 7;
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.muted);
  doc.text(
    en ? "Fraud Investigation Report" : "Reporte de Investigación Antifraude",
    marginX,
    y,
  );
  y += 6;
  doc.setFontSize(9);
  const engineLabel =
    report.verdict.source === "on_device"
      ? en ? "On-device AI + Deterministic Engine" : "IA local en dispositivo + Motor determinista"
      : report.verdict.source === "in_cloud"
        ? en ? "Cloud AI (Gemini) + Deterministic Engine" : "IA en la nube (Gemini) + Motor determinista"
        : en ? "Deterministic Engine (No AI)" : "Motor determinista (Sin IA)";
  doc.text(
    `${en ? "Analysis ID" : "ID de análisis"}: ${report.analysisId} · ${en ? "Generated" : "Generado"}: ${report.generatedAt}`,
    marginX,
    y,
  );
  y += 5;
  doc.text(`${en ? "Engine" : "Motor"}: ${engineLabel}`, marginX, y);
  y += 9;

  // Semáforo y veredicto, como un bloque destacado.
  const [r, g, b] = lightColor(report.verdict.light);
  doc.setFillColor(r, g, b);
  doc.roundedRect(marginX, y - 5, contentWidth, 22, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(
    `${report.verdict.light.toUpperCase()} · ${report.verdict.riskLevel}`,
    marginX + 4,
    y + 4,
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `${en ? "Confidence" : "Confianza"}: ${report.verdict.confidence} · ${en ? "Coverage" : "Cobertura"}: ${report.verdict.checksRun}/${report.verdict.checksTotal} · ${en ? "Agents" : "Agentes"}: ${report.agents.join(", ") || "—"}`,
    marginX + 4,
    y + 11,
  );
  y += 24;
  doc.setTextColor(...COLORS.ink);

  // A. Evidencia comprobada
  y = sectionHeading(
    doc,
    en ? "A. Verified Deterministic & Public Evidence" : "A. Evidencia Comprobada (Determinista / Externa)",
    y,
  );
  if (!report.verifiedEvidence.length) {
    doc.setTextColor(...COLORS.muted);
    y = writeParagraph(
      doc,
      en ? "No deterministic signals recorded." : "No se registraron señales deterministas.",
      marginX,
      y,
      contentWidth,
    );
    doc.setTextColor(...COLORS.ink);
  } else {
    for (const item of report.verifiedEvidence) {
      doc.setFont("helvetica", "bold");
      y = writeParagraph(
        doc,
        `[${item.status.toUpperCase()} · ${item.severity.toUpperCase()}] ${item.indicator}`,
        marginX,
        y,
        contentWidth,
        5,
      );
      doc.setFont("helvetica", "normal");
      y = writeParagraph(doc, item.evidence, marginX, y, contentWidth);
      doc.setTextColor(...COLORS.muted);
      y = writeParagraph(
        doc,
        `${en ? "Recommendation" : "Recomendación"}: ${item.recommendation}`,
        marginX + 2,
        y,
        contentWidth - 2,
      );
      y = writeParagraph(
        doc,
        `${en ? "Limitation" : "Limitación"}: ${item.limitation}`,
        marginX + 2,
        y,
        contentWidth - 2,
      );
      doc.setTextColor(...COLORS.ink);
      y += 3;
    }
  }

  // B. Interpretación de IA
  y = sectionHeading(doc, en ? "B. AI Interpretation (Unverified)" : "B. Interpretación de IA (No verificada)", y);
  if (report.aiInterpretation.available) {
    y = writeParagraph(
      doc,
      `${en ? "Estimated risk" : "Riesgo estimado"}: ${report.aiInterpretation.risk}`,
      marginX,
      y,
      contentWidth,
    );
    y = writeParagraph(doc, report.aiInterpretation.summary ?? "", marginX, y, contentWidth);
    for (const rec of report.aiInterpretation.recommendations) {
      y = writeParagraph(doc, `• ${rec}`, marginX + 2, y, contentWidth - 2);
    }
  } else {
    doc.setTextColor(...COLORS.muted);
    y = writeParagraph(
      doc,
      report.aiInterpretation.error ||
        (en ? "No AI interpretation was requested." : "No se solicitó interpretación de IA."),
      marginX,
      y,
      contentWidth,
    );
    doc.setTextColor(...COLORS.ink);
  }
  y += 3;

  // C. Pendientes
  y = sectionHeading(doc, en ? "C. Pending / Unchecked Items" : "C. Comprobaciones Pendientes", y);
  if (!report.pendingChecks.length) {
    doc.setTextColor(...COLORS.muted);
    y = writeParagraph(doc, en ? "None." : "Ninguna.", marginX, y, contentWidth);
    doc.setTextColor(...COLORS.ink);
  } else {
    for (const p of report.pendingChecks) {
      y = writeParagraph(doc, `• ${p}`, marginX, y, contentWidth);
    }
  }

  // D. Correlación local
  if (report.campaigns.length || report.relatedIncidentsCount > 0) {
    y += 3;
    y = sectionHeading(doc, en ? "D. Local Correlation & Campaigns" : "D. Correlación Local y Campañas", y);
    y = writeParagraph(
      doc,
      en
        ? `Related incidents in local history: ${report.relatedIncidentsCount}`
        : `Incidentes relacionados en el historial local: ${report.relatedIncidentsCount}`,
      marginX,
      y,
      contentWidth,
    );
    for (const c of report.campaigns) {
      y = writeParagraph(doc, `• ${c.name} (${c.confidence}): ${c.description}`, marginX, y, contentWidth);
    }
  }

  // Pie de página en cada hoja: fecha, disclaimer y numeración.
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.muted);
    doc.text(
      en
        ? "Masks sensitive sequences. Does not confirm fraud, guarantee safety, or constitute official certification."
        : "Enmascara secuencias sensibles. No confirma fraude, no garantiza seguridad ni constituye certificación oficial.",
      marginX,
      pageHeight - 10,
    );
    doc.text(`${page}/${pageCount}`, pageWidth - marginX - 8, pageHeight - 10);
  }

  const buffer = doc.output("arraybuffer") as ArrayBuffer;
  return new Uint8Array<ArrayBuffer>(buffer);
}
