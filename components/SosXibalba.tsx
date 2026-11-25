"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, PhoneCall } from "lucide-react";
import { useI18n } from "@/components/LanguageProvider";
import { sosQuickSummary } from "@/lib/global-shield/sos";

export default function SosXibalba({ country }: { country: string }) {
  const { lang } = useI18n();
  const [done, setDone] = useState<Record<string, boolean>>({});
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
    </section>
  );
}
