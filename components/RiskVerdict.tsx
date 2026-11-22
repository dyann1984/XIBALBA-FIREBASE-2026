"use client";
import { type CombinedRisk, type TrafficLight } from "@/lib/analysis/risk";
import { useI18n } from "@/components/LanguageProvider";
import { translate } from "@/lib/i18n";
import { localizeCoverageLabel, localizeJoinedList } from "@/lib/i18n/evidence";
import type { Lang } from "@/lib/i18n";
import { ShieldAlert, ShieldCheck, ShieldQuestion, TriangleAlert } from "lucide-react";

const ORDER: TrafficLight[] = ["verde", "amarillo", "rojo", "gris"];
const SHORT = {
  verde: "lightVerde",
  amarillo: "lightAmarillo",
  rojo: "lightRojo",
  gris: "lightGris",
} as const;
const LABEL = {
  verde: "labelVerde",
  amarillo: "labelAmarillo",
  rojo: "labelRojo",
  gris: "labelGris",
} as const;
const RISK = {
  alto: "riskAlto",
  medio: "riskMedio",
  bajo: "riskBajo",
  "no concluyente": "riskNinguno",
} as const;
const CONFIDENCE = { alta: "confidenceAlta", media: "confidenceMedia", baja: "confidenceBaja" } as const;
const IMPACT = {
  economico: "impactEconomico",
  identidad: "impactIdentidad",
  "sitio-fraudulento": "impactSitio",
  "no-concluyente": "impactNinguno",
} as const;
const AI_RISK = { alto: "riskAlto", medio: "riskMedio", bajo: "riskBajo" } as const;
const ICON: Record<TrafficLight, typeof ShieldCheck> = {
  verde: ShieldCheck,
  amarillo: TriangleAlert,
  rojo: ShieldAlert,
  gris: ShieldQuestion,
};

/**
 * `risk.rationaleKeys` trae motivos ya traducibles (clave + plantilla), pero
 * dos de sus variables (`signals`, `pending`) son listas de nombres de
 * indicador que el motor determinista siempre redacta en español — ver la
 * nota de `lib/i18n/evidence.ts` sobre por qué el motor no se traduce a sí
 * mismo. Sin esto, una pantalla en inglés mostraba la plantilla traducida
 * pero la lista de nombres intacta en español (visto en una vista previa real
 * con el caso de demostración de BBVA). Se traduce cada nombre por separado,
 * con el mismo separador que usó `risk.ts` al unirlos.
 */
function localizeListVars(vars: Record<string, string> | undefined, lang: Lang): Record<string, string> | undefined {
  if (!vars) return vars;
  const out = { ...vars };
  if (typeof out.signals === "string") out.signals = localizeJoinedList(out.signals, lang, "; ");
  if (typeof out.pending === "string") out.pending = localizeJoinedList(out.pending, lang, ", ");
  return out;
}

/**
 * Presenta por separado las tres magnitudes que no deben confundirse:
 * nivel de riesgo, confianza de la evaluación y cobertura de la auditoría.
 */
export default function RiskVerdict({ risk }: { risk: CombinedRisk }) {
  const { t, lang } = useI18n();
  const Icon = ICON[risk.light];
  const percent = risk.coverage.checksTotal
    ? Math.round((risk.coverage.checksRun / risk.coverage.checksTotal) * 100)
    : 0;
  // Los motivos llegan del motor como clave más variables, de modo que el
  // veredicto se lee entero en el idioma elegido. Si una clave no estuviera en
  // el diccionario, `translate` cae al español en lugar de mostrar la clave.
  const reasons = risk.rationaleKeys.length
    ? risk.rationaleKeys.map((item) => translate(lang, "reason", item.key, localizeListVars(item.vars, lang)))
    : risk.rationale;
  const confidenceReason = risk.confidenceKey
    ? translate(lang, "reason", risk.confidenceKey)
    : risk.confidenceReason;

  return (
    <div className={`verdict verdict-${risk.light}`} role="group" aria-label={t("verdict", "ariaLabel")}>
      <div className="verdict-head">
        <span className="verdict-icon" aria-hidden="true">
          <Icon size={28} />
        </span>
        <div>
          <div className="eyebrow">{t("verdict", "eyebrow")}</div>
          <h2>{t("verdict", LABEL[risk.light])}</h2>
        </div>
      </div>

      <ol className="light-bar" aria-label={t("verdict", "lightBar", { light: t("verdict", SHORT[risk.light]) })}>
        {ORDER.map((light) => (
          <li
            key={light}
            className={`lamp lamp-${light} ${light === risk.light ? "on" : ""}`}
            aria-current={light === risk.light ? "true" : undefined}
          >
            <span aria-hidden="true" />
            {t("verdict", SHORT[light])}
          </li>
        ))}
      </ol>

      <dl className="verdict-metrics">
        <div>
          <dt>{t("verdict", "metricRisk")}</dt>
          <dd>{t("verdict", RISK[risk.riskLevel])}</dd>
        </div>
        <div>
          <dt>{t("verdict", "metricConfidence")}</dt>
          <dd>
            {t("verdict", CONFIDENCE[risk.confidence])}
            <small>{confidenceReason}</small>
          </dd>
        </div>
        <div>
          <dt>{t("verdict", "metricCoverage")}</dt>
          <dd>
            {t("verdict", "checks", {
              run: risk.coverage.checksRun,
              total: risk.coverage.checksTotal,
              percent,
            })}
            <small>{localizeCoverageLabel(risk.coverage.label, lang)}</small>
          </dd>
        </div>
        <div>
          <dt>{t("verdict", "metricImpact")}</dt>
          <dd>
            {risk.potentialImpact.map((area) => t("verdict", IMPACT[area])).join(" · ")}
          </dd>
        </div>
        <div>
          <dt>{t("verdict", "metricAi")}</dt>
          <dd>
            {risk.aiRisk
              ? t("verdict", "aiRisk", { level: t("verdict", AI_RISK[risk.aiRisk]).toLowerCase() })
              : t("verdict", "aiNone")}
            <small>
              {t("verdict", "signals", {
                n: risk.deterministic.suspicious,
                score: risk.deterministic.score,
              })}
            </small>
          </dd>
        </div>
      </dl>

      <div className="verdict-why">
        <h3>{t("verdict", "why")}</h3>
        <ul>
          {reasons.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      </div>

      <p className="verdict-caveat">{t("verdict", "caveat")}</p>
    </div>
  );
}
