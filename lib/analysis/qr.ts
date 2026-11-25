import { auditUrl } from "./audit.ts";

export type QrInspection = {
  payload: string;
  scheme: "url" | "payment" | "wifi" | "sms" | "tel" | "text";
  risk: "alto" | "medio" | "bajo" | "no concluyente";
  summaryEs: string;
  summaryEn: string;
  findingsEs: string[];
  findingsEn: string[];
  extractedUrl: string | null;
};

const SHORTENERS = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "cutt.ly",
  "rb.gy",
]);

export function auditQrPayload(raw: string): QrInspection {
  const payload = raw.trim();
  if (!payload) {
    return {
      payload: "",
      scheme: "text",
      risk: "no concluyente",
      summaryEs: "No se proporcionó ningún contenido QR para inspeccionar.",
      summaryEn: "No QR payload provided to inspect.",
      findingsEs: [],
      findingsEn: [],
      extractedUrl: null,
    };
  }

  if (/^https?:\/\//i.test(payload)) {
    const urlAudit = auditUrl(payload);
    const findingsEs: string[] = [];
    const findingsEn: string[] = [];
    let high = false;
    let medium = false;

    try {
      const parsed = new URL(payload);
      if (parsed.protocol === "http:") {
        medium = true;
        findingsEs.push("El enlace QR usa HTTP sin cifrado TLS.");
        findingsEn.push("QR link uses unencrypted HTTP instead of HTTPS.");
      }
      if (SHORTENERS.has(parsed.hostname.toLowerCase())) {
        medium = true;
        findingsEs.push("Usa un acortador de enlaces que oculta el destino real.");
        findingsEn.push("Uses a URL shortener that hides the true destination.");
      }
    } catch {
      medium = true;
    }

    for (const ind of urlAudit.indicators) {
      if (ind.status === "sospechoso") {
        if (ind.severity === "critico" || ind.severity === "alto") high = true;
        else medium = true;
        findingsEs.push(ind.indicator);
        findingsEn.push(ind.indicator);
      }
    }

    return {
      payload,
      scheme: "url",
      risk: high ? "alto" : medium ? "medio" : "no concluyente",
      summaryEs: high
        ? "El código QR apunta a un enlace con señales altas de suplantación o phishing."
        : medium
          ? "El código QR contiene un enlace que requiere precaución antes de abrirse."
          : "Enlace QR sin señales locales inmediatas; verifica el dominio antes de iniciar sesión.",
      summaryEn: high
        ? "QR code points to a link with high-risk phishing or impersonation signals."
        : medium
          ? "QR code contains a link that requires caution before opening."
          : "QR link has no immediate local red flags; verify the domain before signing in.",
      findingsEs,
      findingsEn,
      extractedUrl: payload,
    };
  }

  if (/^(upi:\/\/|000201)/i.test(payload)) {
    return {
      payload,
      scheme: "payment",
      risk: "medio",
      summaryEs: "QR de cobro/pago directo (UPI/EMVCo). Confirmar destinatario antes de autorizar.",
      summaryEn: "Direct payment QR (UPI/EMVCo). Confirm recipient identity before authorizing.",
      findingsEs: ["Un QR de pago nunca sirve para 'recibir' dinero; solo autoriza envíos o cobros."],
      findingsEn: ["A payment QR never deposits money to you; it authorizes an outgoing payment."],
      extractedUrl: null,
    };
  }

  if (/^WIFI:/i.test(payload)) {
    return {
      payload,
      scheme: "wifi",
      risk: "medio",
      summaryEs: "QR de conexión Wi-Fi automática. Evita redes públicas desconocidas para banca.",
      summaryEn: "Automatic Wi-Fi configuration QR. Avoid unknown public networks for banking.",
      findingsEs: ["Conectarse por QR puede exponerte a portales cautivos falsos."],
      findingsEn: ["Joining via QR can expose traffic to rogue captive portals."],
      extractedUrl: null,
    };
  }

  if (/^(SMSTO:|SMS:|TEL:)/i.test(payload)) {
    return {
      payload,
      scheme: /^TEL:/i.test(payload) ? "tel" : "sms",
      risk: "medio",
      summaryEs: "QR que inicia llamada o envío de SMS automático.",
      summaryEn: "QR that initiates an automatic phone call or SMS message.",
      findingsEs: ["Verifica el número antes de confirmar el envío o llamada."],
      findingsEn: ["Verify the destination number before confirming the SMS or call."],
      extractedUrl: null,
    };
  }

  return {
    payload,
    scheme: "text",
    risk: "no concluyente",
    summaryEs: "QR de texto plano sin URL ejecutable detectada.",
    summaryEn: "Plain-text QR with no executable URL detected.",
    findingsEs: [],
    findingsEn: [],
    extractedUrl: null,
  };
}
