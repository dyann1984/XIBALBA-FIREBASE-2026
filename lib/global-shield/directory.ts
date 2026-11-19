// Directorio global de ayuda contra fraude — datos y reglas de verificación.
//
// Cada registro de `SEED_RECORDS` viene de una búsqueda real hecha para esta
// fase (19 de noviembre de 2026). Donde dos fuentes independientes no
// coincidían, el registro quedó en "en-revision", no en "verificado" — la
// regla se hace cumplir con `assertValidRecord`, no solo se promete.

import type { CountryEntry, EmergencyRecord } from "./types.ts";

/** Lista curada para el selector, no la lista completa ISO 3166-1. Un país
 * ausente aquí igual puede tener registros: `recordsFor` no depende de
 * esta lista. Ampliar esta lista es trabajo futuro explícito. */
export const KNOWN_COUNTRIES: CountryEntry[] = [
  { code: "MX", nameEs: "México", nameEn: "Mexico" },
  { code: "US", nameEs: "Estados Unidos", nameEn: "United States" },
  { code: "GB", nameEs: "Reino Unido", nameEn: "United Kingdom" },
  { code: "ES", nameEs: "España", nameEn: "Spain" },
  { code: "CA", nameEs: "Canadá", nameEn: "Canada" },
  { code: "AR", nameEs: "Argentina", nameEn: "Argentina" },
  { code: "CO", nameEs: "Colombia", nameEn: "Colombia" },
  { code: "BR", nameEs: "Brasil", nameEn: "Brazil" },
];

export const SEED_RECORDS: EmergencyRecord[] = [
  {
    id: "MX-condusef",
    countryCode: "MX",
    incidentCategories: ["fraude-financiero", "suplantacion"],
    agencyName: "CONDUSEF (Comisión Nacional para la Protección y Defensa de los Usuarios de Servicios Financieros)",
    channels: [
      { kind: "telefono", value: "01 800 999 8080", languages: ["es-MX"] },
      { kind: "portal", value: "https://phpapps.condusef.gob.mx/fraudes_financieros/index.php", languages: ["es-MX"] },
    ],
    sourceUrls: [
      "https://www.gob.mx/condusef",
      "https://banorte.com/cms/banorte/CONDUSEF/2024/Abril/Art-Portal-de-fraudes-financieros.pdf",
    ],
    lastVerifiedAt: "2026-11-19",
    status: "verificado",
    notes: "El teléfono y el portal coinciden en varias fuentes de 2026; los documentos oficiales más antiguos de gob.mx no se usaron como única fuente.",
  },
  {
    id: "US-ftc",
    countryCode: "US",
    incidentCategories: ["fraude-financiero", "phishing", "suplantacion", "ciberdelito"],
    agencyName: "Federal Trade Commission (FTC)",
    channels: [
      { kind: "telefono", value: "+1-877-382-4357", languages: ["en-US", "es-US"] },
      { kind: "portal", value: "https://reportfraud.ftc.gov", languages: ["en-US", "es-US"] },
    ],
    sourceUrls: ["https://consumer.ftc.gov", "https://reportfraud.ftc.gov"],
    lastVerifiedAt: "2026-11-19",
    status: "verificado",
    notes: "La FTC aclara que nunca llama para pedir datos sobre un reporte ya hecho; cualquier llamada así es en sí misma una señal de suplantación.",
  },
  {
    id: "GB-actionfraud",
    countryCode: "GB",
    incidentCategories: ["fraude-financiero", "phishing", "ciberdelito"],
    agencyName: "Action Fraud (National Fraud & Cyber Crime Reporting Centre)",
    channels: [
      { kind: "telefono", value: "+44-300-123-2040", languages: ["en-GB"], hoursNote: "Lunes a viernes, 8:00–20:00" },
      { kind: "portal", value: "https://www.actionfraud.police.uk", languages: ["en-GB"] },
    ],
    sourceUrls: ["https://www.actionfraud.police.uk/report", "https://www.nidirect.gov.uk/node/12748"],
    lastVerifiedAt: "2026-11-19",
    status: "verificado",
    notes: "Action Fraud no es un servicio de emergencia: ante peligro inmediato, el número real es el 999, no este.",
  },
  {
    id: "CA-antifraud-centre",
    countryCode: "CA",
    incidentCategories: ["fraude-financiero", "phishing", "suplantacion", "ciberdelito"],
    agencyName: "Canadian Anti-Fraud Centre / Centre antifraude du Canada",
    channels: [
      { kind: "telefono", value: "+1-888-495-8501", languages: ["en-CA", "fr-CA"] },
      { kind: "portal", value: "https://antifraudcentre-centreantifraude.ca/report-signalez-eng.htm", languages: ["en-CA", "fr-CA"] },
    ],
    sourceUrls: ["https://sk.211.ca/services/report-a-scam-fraud-or-cybercrime", "https://halton.cioc.ca/record/IMP0344?Number=0"],
    lastVerifiedAt: "2026-11-19",
    status: "en-revision",
    notes: "El teléfono coincide en varios directorios independientes (211.ca, cioc.ca), pero ninguna fuente de esta búsqueda es el propio sitio oficial antifraudcentre-centreantifraude.ca, así que queda en revisión hasta confirmarlo ahí directamente.",
  },
  {
    id: "ES-policia-nacional",
    countryCode: "ES",
    incidentCategories: ["fraude-financiero", "phishing", "ciberdelito"],
    agencyName: "Policía Nacional — Portal de Denuncias",
    channels: [
      { kind: "portal", value: "https://www.policia.es/_es/denuncias.php", languages: ["es-ES"] },
    ],
    sourceUrls: ["https://www.interior.gob.es"],
    lastVerifiedAt: "2026-11-19",
    status: "en-revision",
    notes: "No se encontró, en esta sesión, una fuente oficial única que confirme un teléfono específico para denuncia de fraude online (091 y 062 son líneas generales de distintos cuerpos, sin confirmación cruzada en esta búsqueda). Queda 'en revisión' hasta verificarlo directamente en interior.gob.es.",
  },
];

/** Registros reales para un país. Vacío si el país no tiene ninguno todavía
 * — la interfaz debe mostrar eso como "pendiente", nunca omitir el país. */
export function recordsFor(countryCode: string): EmergencyRecord[] {
  const code = countryCode.toUpperCase();
  return SEED_RECORDS.filter((record) => record.countryCode === code);
}

export function statusFor(countryCode: string): "verificado" | "en-revision" | "pendiente" {
  const records = recordsFor(countryCode);
  if (!records.length) return "pendiente";
  if (records.some((record) => record.status === "verificado")) return "verificado";
  return "en-revision";
}

/** Hace cumplir en código la regla del encargo: nunca "verificado" sin
 * respaldo real. Se usa en pruebas unitarias para que ningún registro futuro
 * la pase por alto. */
export function assertValidRecord(record: EmergencyRecord): void {
  if (!record.sourceUrls.length) {
    throw new Error(`${record.id}: un registro no puede existir sin sourceUrls.`);
  }
  if (record.status === "verificado") {
    const domains = new Set(
      record.sourceUrls.map((url) => {
        try {
          return new URL(url).hostname;
        } catch {
          return url;
        }
      }),
    );
    if (domains.size < 2) {
      throw new Error(
        `${record.id}: no puede marcarse "verificado" con menos de 2 fuentes de dominios distintos.`,
      );
    }
  }
  if (!record.channels.length) {
    throw new Error(`${record.id}: un registro no puede existir sin al menos un canal de ayuda.`);
  }
}
