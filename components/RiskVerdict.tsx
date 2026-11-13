"use client";
import { LIGHT_LABEL, RISK_LABEL, type CombinedRisk, type TrafficLight } from "@/lib/analysis/risk";
import { ShieldAlert, ShieldCheck, ShieldQuestion, TriangleAlert } from "lucide-react";

const ORDER: TrafficLight[] = ["verde", "amarillo", "rojo", "gris"];
const SHORT: Record<TrafficLight, string> = {
  verde: "VERDE",
  amarillo: "AMARILLO",
  rojo: "ROJO",
  gris: "GRIS",
};
const ICON: Record<TrafficLight, typeof ShieldCheck> = {
  verde: ShieldCheck,
  amarillo: TriangleAlert,
  rojo: ShieldAlert,
  gris: ShieldQuestion,
};

/**
 * Presenta por separado las tres magnitudes que no deben confundirse:
 * nivel de riesgo, confianza de la evaluación y cobertura de la auditoría.
 */
export default function RiskVerdict({ risk }: { risk: CombinedRisk }) {
  const Icon = ICON[risk.light];
  const percent = risk.coverage.checksTotal
    ? Math.round((risk.coverage.checksRun / risk.coverage.checksTotal) * 100)
    : 0;
  return (
    <div className={`verdict verdict-${risk.light}`} role="group" aria-label="Resultado del análisis">
      <div className="verdict-head">
        <span className="verdict-icon" aria-hidden="true">
          <Icon size={26} />
        </span>
        <div>
          <div className="eyebrow">SEMÁFORO DE RIESGO</div>
          <h2>{LIGHT_LABEL[risk.light]}</h2>
        </div>
      </div>

      <ol className="light-bar" aria-label={`Semáforo en ${SHORT[risk.light]}`}>
        {ORDER.map((light) => (
          <li
            key={light}
            className={`lamp lamp-${light} ${light === risk.light ? "on" : ""}`}
            aria-current={light === risk.light ? "true" : undefined}
          >
            <span aria-hidden="true" />
            {SHORT[light]}
          </li>
        ))}
      </ol>

      <dl className="verdict-metrics">
        <div>
          <dt>Nivel de riesgo</dt>
          <dd>{RISK_LABEL[risk.riskLevel]}</dd>
        </div>
        <div>
          <dt>Confianza de la evaluación</dt>
          <dd>
            {risk.confidence}
            <small>{risk.confidenceReason}</small>
          </dd>
        </div>
        <div>
          <dt>Cobertura de la auditoría</dt>
          <dd>
            {risk.coverage.checksRun} de {risk.coverage.checksTotal} comprobaciones ({percent}%)
            <small>{risk.coverage.label}</small>
          </dd>
        </div>
        <div>
          <dt>Interpretación de IA</dt>
          <dd>
            {risk.aiRisk ? `riesgo ${risk.aiRisk}` : "no disponible"}
            <small>
              {risk.deterministic.suspicious} señal(es) determinista(s) · puntuación local{" "}
              {risk.deterministic.score}
            </small>
          </dd>
        </div>
      </dl>

      <div className="verdict-why">
        <h3>Por qué este resultado</h3>
        <ul>
          {risk.rationale.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      </div>

      <p className="verdict-caveat">
        Es una evaluación orientativa sobre el contenido recibido. No confirma un fraude ni
        garantiza que algo sea seguro, y no sustituye la verificación por el canal oficial.
      </p>
    </div>
  );
}
