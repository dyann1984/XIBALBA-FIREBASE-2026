"use client";

/**
 * Escudo Global: directorio internacional de organismos oficiales contra el
 * fraude. Ningún contacto se inventa — ver `lib/global-shield/directory.ts`,
 * donde cada registro trae su fuente real y `assertValidRecord` impide
 * marcar "verificado" sin dos fuentes de dominios distintos.
 *
 * Un país sin datos no desaparece de la lista: se muestra como "pendiente",
 * tal como pide el encargo, en vez de ocultar la ausencia de cobertura.
 */

import { useState } from "react";
import { Mail, MapPin, Phone, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { useI18n } from "@/components/LanguageProvider";
import SosXibalba from "@/components/SosXibalba";
import { KNOWN_COUNTRIES, recordsFor, statusFor } from "@/lib/global-shield/directory";
import { ALL_INCIDENT_CATEGORIES, procedureFor } from "@/lib/global-shield/procedures";
import type { HelpChannel, IncidentCategory, VerificationStatus } from "@/lib/global-shield/types";

const INCIDENT_LABEL_KEY = {
  "fraude-financiero": "incidentFraudeFinanciero",
  phishing: "incidentPhishing",
  extorsion: "incidentExtorsion",
  suplantacion: "incidentSuplantacion",
  ciberdelito: "incidentCiberdelito",
  otro: "incidentOtro",
} as const satisfies Record<IncidentCategory, string>;

const STATUS_ICON: Record<VerificationStatus, typeof ShieldCheck> = {
  verificado: ShieldCheck,
  "en-revision": ShieldQuestion,
  pendiente: ShieldAlert,
};

const CHANNEL_ICON: Record<HelpChannel["kind"], typeof Phone> = {
  telefono: Phone,
  correo: Mail,
  portal: MapPin,
};

function StatusBadge({ status }: { status: VerificationStatus }) {
  const { t } = useI18n();
  const Icon = STATUS_ICON[status];
  const label =
    status === "verificado"
      ? t("globalShield", "statusVerified")
      : status === "en-revision"
        ? t("globalShield", "statusReview")
        : t("globalShield", "statusPending");
  return (
    <span className={`shield-status shield-status-${status}`}>
      <Icon size={13} /> {label}
    </span>
  );
}

export default function GlobalShield({
  defaultCountry,
}: {
  /** País preseleccionado (ej. desde el botón de ayuda permanente). Nunca se
   * obtiene por geolocalización automática: siempre es una elección previa
   * de la persona en esta misma sesión. */
  defaultCountry?: string;
}) {
  const { t, lang } = useI18n();
  const [country, setCountry] = useState(defaultCountry ?? KNOWN_COUNTRIES[0].code);
  const [incident, setIncident] = useState<IncidentCategory | "todos">("todos");
  const allRecords = recordsFor(country);
  const records =
    incident === "todos" ? allRecords : allRecords.filter((record) => record.incidentCategories.includes(incident));
  const overallStatus = statusFor(country);
  const procedure = incident === "todos" ? null : procedureFor(incident, lang);

  return (
    <div className="global-shield">
      <div className="shield-controls">
        <label htmlFor="shield-country">{t("globalShield", "selectCountry")}</label>
        <select id="shield-country" value={country} onChange={(event) => setCountry(event.target.value)}>
          {KNOWN_COUNTRIES.map((entry) => (
            <option key={entry.code} value={entry.code}>
              {lang === "en" ? entry.nameEn : entry.nameEs}
            </option>
          ))}
        </select>
        <StatusBadge status={overallStatus} />
      </div>

      <div className="shield-controls">
        <label htmlFor="shield-incident">{t("globalShield", "selectIncident")}</label>
        <select
          id="shield-incident"
          value={incident}
          onChange={(event) => setIncident(event.target.value as IncidentCategory | "todos")}
        >
          <option value="todos">{t("globalShield", "incidentAll")}</option>
          {ALL_INCIDENT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {t("globalShield", INCIDENT_LABEL_KEY[category])}
            </option>
          ))}
        </select>
      </div>

      {procedure && (
        <div className="shield-procedure" role="region" aria-label={procedure.title}>
          <h4>{procedure.title}</h4>
          <ol>
            {procedure.steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
          <p className="shield-procedure-disclaimer">
            <b>{t("globalShield", "procedureDisclaimer")}:</b> {procedure.disclaimer}
          </p>
        </div>
      )}

      {records.length === 0 && incident !== "todos" && allRecords.length > 0 && (
        <div className="empty-row">
          <div className="empty-icon">
            <ShieldAlert size={20} />
          </div>
          <div>
            <p>{t("globalShield", "noMatchingAgencies")}</p>
          </div>
        </div>
      )}

      {allRecords.length === 0 ? (
        <div className="empty-row">
          <div className="empty-icon">
            <ShieldAlert size={20} />
          </div>
          <div>
            <strong>{t("globalShield", "pendingTitle")}</strong>
            <p>{t("globalShield", "pendingText")}</p>
          </div>
        </div>
      ) : (
        <ul className="shield-records">
          {records.map((record) => (
            <li key={record.id} className="shield-record">
              <div className="shield-record-head">
                <strong>{record.agencyName}</strong>
                <StatusBadge status={record.status} />
              </div>
              <ul className="shield-channels">
                {record.channels.map((channel, index) => {
                  const Icon = CHANNEL_ICON[channel.kind];
                  const href =
                    channel.kind === "telefono"
                      ? `tel:${channel.value.replace(/[^+\d]/g, "")}`
                      : channel.kind === "correo"
                        ? `mailto:${channel.value}`
                        : channel.value;
                  return (
                    <li key={index}>
                      <Icon size={14} />{" "}
                      <a href={href} target={channel.kind === "portal" ? "_blank" : undefined} rel="noreferrer">
                        {channel.value}
                      </a>
                      {channel.hoursNote && <small> · {channel.hoursNote}</small>}
                      <small className="shield-languages">
                        {" "}
                        · {t("globalShield", "languagesLabel")}: {channel.languages.join(", ")}
                      </small>
                    </li>
                  );
                })}
              </ul>
              {record.notes && (
                <p className="shield-notes">
                  <b>{t("globalShield", "notesLabel")}:</b> {record.notes}
                </p>
              )}
              <p className="shield-meta">
                {t("globalShield", "lastVerified")}: <time dateTime={record.lastVerifiedAt}>{record.lastVerifiedAt}</time>
                {" · "}
                {t("globalShield", "sources")}:{" "}
                {record.sourceUrls.map((url, index) => (
                  <span key={url}>
                    {index > 0 && ", "}
                    <a href={url} target="_blank" rel="noreferrer">
                      {new URL(url).hostname}
                    </a>
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ul>
      )}
      <SosXibalba country={country} />
    </div>
  );
}
