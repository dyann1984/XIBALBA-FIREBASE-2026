"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, PhoneCall } from "lucide-react";
import { useI18n } from "@/components/LanguageProvider";
import { SOS_SCENARIOS, sosQuickSummary } from "@/lib/global-shield/sos";

export default function SosXibalba({ country }: { country: string }) {
  const { lang } = useI18n();
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [scenarioId, setScenarioId] = useState("");
  const scenario = SOS_SCENARIOS.find((item) => item.id === scenarioId);
  const { steps, primaryRecord } = sosQuickSummary(country);
  const completedCount = steps.filter((s) => done[s.id]).length;
  const phoneChannel = primaryRecord?.channels.find((c) => c.kind === "telefono");
  const portalChannel = primaryRecord?.channels.find((c) => c.kind === "portal");

  return (
    <section
      className="sos-panel"
      aria-label={lang === "en" ? "SOS XIBALBÁ emergency protocol" : "Protocolo de emergencia SOS XIBALBÁ"}
    >
      <div className="sos-head">
        <div>
          <div className="eyebrow">
            <AlertTriangle size={14} /> SOS XIBALBÁ
          </div>
          <h3>
            {lang === "en"
              ? "Immediate containment checklist"
              : "Protocolo de contención inmediata"}
          </h3>
        </div>
        <span className="sos-progress">
          <CheckCircle2 size={14} /> {completedCount}/{steps.length}
        </span>
      </div>

      <label htmlFor="sos-scenario">{lang === "en" ? "What happened?" : "¿Qué ocurrió?"}</label>
      <select id="sos-scenario" value={scenarioId} onChange={(event) => setScenarioId(event.target.value)}>
        <option value="">{lang === "en" ? "Choose a situation" : "Elige una situación"}</option>
        {SOS_SCENARIOS.map((item) => <option key={item.id} value={item.id}>{lang === "en" ? item.titleEn : item.titleEs}</option>)}
      </select>
      {scenario && <div className="academy-card" role="status">
        <p><strong>{lang === "en" ? "Act now: " : "Actúa ahora: "}</strong>{lang === "en" ? scenario.actionEn : scenario.actionEs}</p>
        <p><strong>{lang === "en" ? "Protect accounts: " : "Protege tus cuentas: "}</strong>{lang === "en" ? scenario.accountEn : scenario.accountEs}</p>
        <p>{lang === "en" ? "Preserve messages, URLs, receipts and timestamps; avoid deleting evidence. Use the official directory below to report." : "Conserva mensajes, enlaces, comprobantes y fechas; evita borrar evidencias. Utiliza el directorio oficial de abajo para denunciar."}</p>
      </div>}

      <div className="sos-steps">
        {steps.map((step) => (
          <label key={step.id} className={`sos-step ${done[step.id] ? "sos-step-done" : ""}`}>
            <input
              type="checkbox"
              checked={Boolean(done[step.id])}
              onChange={(e) => setDone((prev) => ({ ...prev, [step.id]: e.target.checked }))}
            />
            <div>
              <strong>{lang === "en" ? step.titleEn : step.titleEs}</strong>
              <p>{lang === "en" ? step.detailEn : step.detailEs}</p>
            </div>
          </label>
        ))}
      </div>

      {primaryRecord && (
        <div className="sos-authority">
          <span>
            {lang === "en" ? "Direct official channel:" : "Canal oficial directo:"}{" "}
            <b>{primaryRecord.agencyName}</b>
          </span>
          <div className="sos-actions">
            {phoneChannel && (
              <a className="export-btn" href={`tel:${phoneChannel.value.replace(/\s+/g, "")}`}>
                <PhoneCall size={14} /> {phoneChannel.value}
              </a>
            )}
            {portalChannel && (
              <a
                className="export-btn"
                href={portalChannel.value}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={14} /> {lang === "en" ? "Official portal" : "Portal oficial"}
              </a>
            )}
          </div>
        </div>
      )}
      {!primaryRecord && <p className="notice">{lang === "en" ? "No official channel is available in the directory for this country." : "No hay un canal oficial disponible en el directorio para este país."}</p>}
    </section>
  );
}
