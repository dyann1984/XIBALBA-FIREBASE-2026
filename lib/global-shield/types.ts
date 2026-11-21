// Tipos del directorio global de ayuda contra fraude (Escudo Global).
//
// El encargo es explícito: "no inventes contactos". Estos tipos existen para
// que esa regla se pueda hacer cumplir en código, no solo pedir por escrito —
// ver `assertValidRecord` en `directory.ts`.

/** ISO 3166-1 alpha-2, ej. "MX", "US", "GB". No se valida contra una lista
 * completa aquí a propósito: el directorio debe poder registrar cualquier
 * país sin esperar a que alguien actualice un enum. */
export type CountryCode = string;

/** ISO 3166-2, ej. "MX-CMX". Opcional: no todo registro es subnacional. */
export type SubdivisionCode = string;

export type VerificationStatus =
  | "verificado" // 2+ fuentes de dominios distintos coinciden
  | "en-revision" // un dato recolectado, sin segunda fuente que lo confirme
  | "pendiente"; // sin ningún registro todavía para ese país

export type HelpChannelKind = "telefono" | "correo" | "portal";

export type HelpChannel = {
  kind: HelpChannelKind;
  /** Número con código de país, dirección de correo, o URL — según `kind`. */
  value: string;
  /** Idiomas de atención reales del canal, BCP-47 (ej. "es-MX"). */
  languages: string[];
  hoursNote?: string;
};

export type IncidentCategory =
  | "fraude-financiero"
  | "phishing"
  | "extorsion"
  | "suplantacion"
  | "ciberdelito"
  | "otro";

export type EmergencyRecord = {
  id: string;
  countryCode: CountryCode;
  subdivision?: SubdivisionCode;
  incidentCategories: IncidentCategory[];
  agencyName: string;
  channels: HelpChannel[];
  /** Nunca vacío: de dónde sale la información. */
  sourceUrls: string[];
  /** ISO 8601, fecha real en que se comprobó el dato. */
  lastVerifiedAt: string;
  status: VerificationStatus;
  /** Matices reales (ej. "el número no se confirmó en la fuente oficial"). */
  notes?: string;
};

export type CountryEntry = {
  code: CountryCode;
  nameEs: string;
  nameEn: string;
};
