"use client";
import { useState } from "react";
import type { Audit, AuditIndicator, Severity } from "@/lib/analysis/risk";
import type { Assessment } from "@/lib/analysis/guardian";
import { AGENT_NAMES, type AgentId } from "@/lib/analysis/coordinator";
import { useI18n } from "@/components/LanguageProvider";
import { localizeIndicator, localizeAuditLimitation, localizePending } from "@/lib/i18n/evidence";
import { LANG_TAG } from "@/lib/i18n";
import { ChevronDown } from "lucide-react";

/**
 * Agentes que aportaron esta evidencia. La auditoría coordinada las trae
 * atribuidas; una auditoría de un solo agente no, y entonces no se muestra
 * nada en lugar de atribuirla a quien no participó.
 */
function agentsOf(item: AuditIndicator): AgentId[] {
  const value = (item as { agents?: unknown }).agents;
  return Array.isArray(value) ? (value.filter((id) => typeof id === "string" && id in AGENT_NAMES) as AgentId[]) : [];
}

const SEVERITY_ORDER: Record<Severity, number> = {
  critico: 0,
  alto: 1,
  medio: 2,
  bajo: 3,
  informativo: 4,
};

const STATUS_KEY: Record<string, "statusSospechoso" | "statusVerificado" | "statusNoVerificado" | "statusNoConcluyente" | "statusError"> = {
  sospechoso: "statusSospechoso",
  verificado: "statusVerificado",
  "no verificado": "statusNoVerificado",
  "no concluyente": "statusNoConcluyente",
  error: "statusError",
};
const SEV_KEY: Record<Severity, "sevCritico" | "sevAlto" | "sevMedio" | "sevBajo" | "sevInformativo"> = {
  critico: "sevCritico",
  alto: "sevAlto",
  medio: "sevMedio",
  bajo: "sevBajo",
  informativo: "sevInformativo",
};
const AI_RISK_KEY: Record<string, "riskAlto" | "riskMedio" | "riskBajo"> = {
  alto: "riskAlto",
  medio: "riskMedio",
  bajo: "riskBajo",
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
  const { t, lang } = useI18n();
  const agents = agentsOf(item);
  // El motor redacta en español. `localizeIndicator` devuelve la versión en el
  // idioma elegido cuando existe y, si no, el texto original: es preferible una
  // evidencia en español a una evidencia ausente.
  const text = localizeIndicator(item, lang);
  const statusKey = STATUS_KEY[item.status];
  return (
    <article className={`indicator status-${item.status.replace(/\s+/g, "-")} sev-${item.severity}`}>
      <header>
        <strong>{text.indicator}</strong>
        <span className="chips">
          <span className={`chip chip-${item.status.replace(/\s+/g, "-")}`}>
            {statusKey ? t("evidence", statusKey) : item.status}
          </span>
          {item.severity !== "informativo" && item.status === "sospechoso" && (
            <span className={`chip chip-sev-${item.severity}`}>
              {t("evidence", "severity", { level: t("evidence", SEV_KEY[item.severity]) })}
            </span>
          )}
          {agents.map((id) => (
            <span key={id} className="chip chip-agent">
              {AGENT_NAMES[id]}
            </span>
          ))}
        </span>
      </header>
      <p className="indicator-evidence">{text.evidence}</p>
      <dl>
        <div>
          <dt>{t("evidence", "recommendation")}</dt>
          <dd>{text.recommendation}</dd>
        </div>
        <div>
          <dt>{t("evidence", "limitation")}</dt>
          <dd>{text.limitation}</dd>
        </div>
        <div>
          <dt>{t("evidence", "source")}</dt>
          <dd>
            {text.source} · {new Date(item.checkedAt).toLocaleString(LANG_TAG[lang])}
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
  const { t, lang } = useI18n();
  const deterministic = audit.indicators.filter((i) => i.classification === "determinista").sort(byRelevance);
  const external = audit.indicators
    .filter((i) => i.classification === "verificado-externo")
    .sort(byRelevance);
  const pending = audit.indicators.filter((i) => i.classification === "pendiente-externo");
  const failed = audit.indicators.filter((i) => i.classification === "error");
  const aiItems = assessment?.evidence ?? [];
  // Honestidad del idioma: si alguna evidencia se quedó en español por no tener
  // traducción exacta, se dice en lugar de disimularlo. En español el aviso
  // está vacío y no se muestra.
  const untranslated = t("evidence", "untranslated");
  const hasUntranslated =
    Boolean(untranslated) && audit.indicators.some((item) => localizeIndicator(item, lang).fallback);

  return (
    <div className="evidence">
      <Group
        letter="A"
        title={t("evidence", "aTitle")}
        caption={t("evidence", "aCaption")}
        count={deterministic.length}
      >
        {deterministic.length ? (
          deterministic.map((item) => <Indicator key={item.id} item={item} />)
        ) : (
          <p className="evidence-empty">{t("evidence", "aEmpty")}</p>
        )}
      </Group>

      {external.length > 0 && (
        <Group
          letter="A′"
          title={t("evidence", "aPrimeTitle")}
          caption={t("evidence", "aPrimeCaption")}
          count={external.length}
        >
          {external.map((item) => (
            <Indicator key={item.id} item={item} />
          ))}
          <p className="evidence-note">{t("evidence", "aPrimeNote")}</p>
        </Group>
      )}

      <Group
        letter="B"
        title={t("evidence", "bTitle")}
        caption={t("evidence", "bCaption")}
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
            <h4>{t("evidence", "bRecommendations")}</h4>
            <ul className="plain-list">
              {assessment.recommendations.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
            <p className="evidence-note">
              {t("evidence", "bNote", {
                level: t("verdict", AI_RISK_KEY[assessment.risk] ?? "riskBajo").toLowerCase(),
              })}
            </p>
          </>
        ) : (
          <p className="evidence-empty">
            {aiError ? t("evidence", "bError", { error: aiError }) : t("evidence", "bNoAi")}
          </p>
        )}
      </Group>

      <Group
        letter="C"
        title={t("evidence", "cTitle")}
        caption={t("evidence", "cCaption")}
        count={pending.length + audit.coverage.pendingExternal.length}
        open={false}
      >
        {audit.coverage.pendingExternal.length > 0 && (
          <ul className="plain-list">
            {audit.coverage.pendingExternal.map((item) => (
              <li key={item}>{localizePending(item, lang)}</li>
            ))}
          </ul>
        )}
        {pending.map((item) => (
          <Indicator key={item.id} item={item} />
        ))}
        <p className="evidence-note">{t("evidence", "cNote")}</p>
      </Group>

      {(failed.length > 0 || aiError) && (
        <Group
          letter="D"
          title={t("evidence", "dTitle")}
          caption={t("evidence", "dCaption")}
          count={failed.length + (aiError ? 1 : 0)}
        >
          {aiError && <p className="indicator-evidence">{t("evidence", "dAi", { error: aiError })}</p>}
          {failed.map((item) => (
            <Indicator key={item.id} item={item} />
          ))}
        </Group>
      )}

      <p className="evidence-note strong">{localizeAuditLimitation(audit.limitation, lang)}</p>
      {hasUntranslated && <p className="evidence-note">{untranslated}</p>}
    </div>
  );
}
