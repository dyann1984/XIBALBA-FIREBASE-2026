"use client";
import { useState } from "react";
import type { Audit, AuditIndicator, Severity } from "@/lib/analysis/risk";
import type { Assessment } from "@/lib/analysis/guardian";
import { ChevronDown } from "lucide-react";

const SEVERITY_ORDER: Record<Severity, number> = {
  critico: 0,
  alto: 1,
  medio: 2,
  bajo: 3,
  informativo: 4,
};

function byRelevance(a: AuditIndicator, b: AuditIndicator) {
  const suspicious = Number(b.status === "sospechoso") - Number(a.status === "sospechoso");
  return suspicious || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
}

function Group({
  letter,
  title,
  caption,
  count,
  children,
  open: initiallyOpen = true,
}: {
  letter: string;
  title: string;
  caption: string;
  count: number;
  children: React.ReactNode;
  open?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <section className={`evidence-group ${open ? "open" : ""}`}>
      <button type="button" className="evidence-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="evidence-letter" aria-hidden="true">
          {letter}
        </span>
        <span className="evidence-title">
          <strong>{title}</strong>
          <small>{caption}</small>
        </span>
        <span className="evidence-count">{count}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && <div className="evidence-body">{children}</div>}
    </section>
  );
}

function Indicator({ item }: { item: AuditIndicator }) {
  return (
    <article className={`indicator status-${item.status.replace(/\s+/g, "-")} sev-${item.severity}`}>
      <header>
        <strong>{item.indicator}</strong>
        <span className="chips">
          <span className={`chip chip-${item.status.replace(/\s+/g, "-")}`}>{item.status}</span>
          {item.severity !== "informativo" && item.status === "sospechoso" && (
            <span className={`chip chip-sev-${item.severity}`}>severidad {item.severity}</span>
          )}
        </span>
      </header>
      <p className="indicator-evidence">{item.evidence}</p>
      <dl>
        <div>
          <dt>Recomendación</dt>
          <dd>{item.recommendation}</dd>
        </div>
        <div>
          <dt>Limitación</dt>
          <dd>{item.limitation}</dd>
        </div>
        <div>
          <dt>Fuente</dt>
          <dd>
            {item.source} · {new Date(item.checkedAt).toLocaleString("es-MX")}
          </dd>
        </div>
      </dl>
    </article>
  );
}

/**
 * Separación estricta entre lo comprobado, lo interpretado, lo pendiente y lo
 * fallido. Las cuatro categorías nunca se mezclan en una misma lista.
 */
export default function EvidenceList({
  audit,
  assessment,
  aiError,
}: {
  audit: Audit;
  assessment: Assessment | null;
  aiError: string | null;
}) {
  const deterministic = audit.indicators.filter((i) => i.classification === "determinista").sort(byRelevance);
  const pending = audit.indicators.filter((i) => i.classification === "pendiente-externo");
  const failed = audit.indicators.filter((i) => i.classification === "error");
  const aiItems = assessment?.evidence ?? [];

  return (
    <div className="evidence">
      <Group
        letter="A"
        title="Evidencia determinista verificada"
        caption="Hechos comprobados en el dispositivo sobre el contenido recibido."
        count={deterministic.length}
      >
        {deterministic.length ? (
          deterministic.map((item) => <Indicator key={item.id} item={item} />)
        ) : (
          <p className="evidence-empty">No se ejecutó ninguna comprobación determinista.</p>
        )}
      </Group>

      <Group
        letter="B"
        title="Interpretación mediante inteligencia artificial"
        caption="Lectura del modelo. No verificada y no equivalente a una comprobación."
        count={aiItems.length}
      >
        {assessment ? (
          <>
            <p className="indicator-evidence">{assessment.summary}</p>
            <ul className="plain-list">
              {aiItems.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
            <h4>Recomendaciones del modelo</h4>
            <ul className="plain-list">
              {assessment.recommendations.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
            <p className="evidence-note">
              El modelo estimó un riesgo {assessment.risk}. Esa estimación no está calibrada y no
              puede elevarse a hecho comprobado.
            </p>
          </>
        ) : (
          <p className="evidence-empty">
            {aiError
              ? `No hay interpretación de IA disponible: ${aiError}`
              : "No se solicitó interpretación de IA para este contenido."}
          </p>
        )}
      </Group>

      <Group
        letter="C"
        title="Pendiente de comprobación externa"
        caption="Consultas de red deshabilitadas en esta versión. Su ausencia limita la conclusión."
        count={pending.length + audit.coverage.pendingExternal.length}
        open={false}
      >
        {audit.coverage.pendingExternal.length > 0 && (
          <ul className="plain-list">
            {audit.coverage.pendingExternal.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        {pending.map((item) => (
          <Indicator key={item.id} item={item} />
        ))}
        <p className="evidence-note">
          No se consultaron reputación, certificados, titularidad ni destino final. No se inventa
          ninguno de esos datos: simplemente no están disponibles.
        </p>
      </Group>

      {(failed.length > 0 || aiError) && (
        <Group
          letter="D"
          title="Errores e información no disponible"
          caption="Comprobaciones que no pudieron ejecutarse."
          count={failed.length + (aiError ? 1 : 0)}
        >
          {aiError && <p className="indicator-evidence">Interpretación de IA: {aiError}</p>}
          {failed.map((item) => (
            <Indicator key={item.id} item={item} />
          ))}
        </Group>
      )}

      <p className="evidence-note strong">{audit.limitation}</p>
    </div>
  );
}
