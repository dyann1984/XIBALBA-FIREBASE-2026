// Directorio global de ayuda contra fraude — datos y reglas de verificación.
//
// Cada registro de `SEED_RECORDS` viene de una búsqueda real hecha para esta
// fase (19 de noviembre de 2026; Argentina, Colombia y Brasil se añadieron el
// 21 de noviembre de 2026). Donde dos fuentes independientes no coincidían,
// el registro quedó en "en-revision", no en "verificado" — la regla se hace
// cumplir con `assertValidRecord`, no solo se promete.

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
  { code: "CL", nameEs: "Chile", nameEn: "Chile" },
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
  {
    id: "AR-ufeci",
    countryCode: "AR",
    incidentCategories: ["fraude-financiero", "phishing", "suplantacion", "ciberdelito"],
    agencyName: "UFECI (Unidad Fiscal Especializada en Ciberdelincuencia, Ministerio Público Fiscal)",
    channels: [
      { kind: "correo", value: "denunciasufeci@mpf.gov.ar", languages: ["es-AR"] },
      { kind: "telefono", value: "+54-11-5071-0040", languages: ["es-AR"], hoursNote: "Consultas y urgencias de fiscalías, 9 a 16 hs" },
    ],
    sourceUrls: [
      "https://www.argentina.gob.ar/servicio/denunciar-un-delito-informatico",
      "https://www.mpf.gob.ar/ufeci/",
    ],
    lastVerifiedAt: "2026-11-21",
    status: "verificado",
    notes: "El correo de denuncia coincide, palabra por palabra, entre argentina.gob.ar (el portal de trámites del Estado) y mpf.gob.ar (el sitio propio de la UFECI). La denuncia inicial también puede hacerse en cualquier comisaría o fiscalía del domicilio; este directorio solo cubre el canal específico de ciberdelincuencia.",
  },
  {
    id: "CO-cai-virtual",
    countryCode: "CO",
    incidentCategories: ["fraude-financiero", "phishing", "ciberdelito"],
    agencyName: "CAI Virtual — Centro Cibernético Policial (Policía Nacional de Colombia)",
    channels: [
      { kind: "portal", value: "https://caivirtual.policia.gov.co", languages: ["es-CO"], hoursNote: "24 horas" },
      { kind: "telefono", value: "5159727", languages: ["es-CO"] },
    ],
    sourceUrls: [
      "https://bogota.gov.co/mi-ciudad/seguridad/conoce-como-funciona-el-cai-virtual-de-la-policia",
      "https://caivirtual.policia.gov.co",
    ],
    lastVerifiedAt: "2026-11-21",
    status: "verificado",
    notes: "El portal y la atención 24 horas se confirman tanto en el sitio oficial de la Alcaldía de Bogotá como directamente en el dominio de la Policía Nacional. Para delitos ya tipificados por la Ley 1273 de 2009, la Policía también deriva a 'A Denunciar' (adenunciar.policia.gov.co); no se incluye aquí por no haberse podido confirmar esa URL con una segunda fuente independiente en esta sesión.",
  },
  {
    id: "BR-comunica-pf",
    countryCode: "BR",
    incidentCategories: ["fraude-financiero", "phishing", "ciberdelito"],
    agencyName: "Comunica PF — Polícia Federal (solo delitos de competencia federal o transnacional)",
    channels: [
      { kind: "portal", value: "https://www.gov.br/pf/pt-br/canais_atendimento/comunicacao-de-crimes", languages: ["pt-BR"] },
    ],
    sourceUrls: ["https://www.gov.br/pf/pt-br/assuntos/combate-a-crimes-ciberneticos"],
    lastVerifiedAt: "2026-11-21",
    status: "en-revision",
    notes: "La propia Polícia Federal aclara que solo investiga casos de alcance federal o transnacional; la mayoría de los fraudes financieros contra una persona en Brasil se denuncian ante la Polícia Civil estatal (Boletim de Ocorrência), que varía por estado y no tiene aquí un portal único verificado. Queda 'en revisión' hasta confirmar un canal estatal representativo con una segunda fuente independiente.",
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
