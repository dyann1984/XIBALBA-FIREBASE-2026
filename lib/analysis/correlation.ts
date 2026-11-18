// Correlación local de incidentes y detección de campañas sospechosas.
//
// Opera únicamente sobre las huellas saneadas que ya viven en el historial del
// dispositivo (dominios, prefijos telefónicos enmascarados e identificadores de
// señales deterministas). No consulta bases externas ni guarda texto completo.

import type { HistoryEntry } from '../history.ts';

export type CampaignMatch = {
  id: string;
  nameEs: string;
  nameEn: string;
  confidence: 'alta' | 'media';
  matchedSignals: string[];
  descriptionEs: string;
  descriptionEn: string;
};

export type IncidentCorrelation = {
  relatedEntries: {
    entry: HistoryEntry;
    reasonsEs: string[];
    reasonsEn: string[];
  }[];
  campaigns: CampaignMatch[];
};

const CAMPAIGN_RULES: {
  id: string;
  nameEs: string;
  nameEn: string;
  requiredAny: string[];
  minMatches: number;
  descriptionEs: string;
  descriptionEn: string;
}[] = [
  {
    id: 'camp-suplantacion-bancaria',
    nameEs: 'Suplantación bancaria / SPEI urgente',
    nameEn: 'Bank impersonation / Urgent transfer',
    requiredAny: [
      'suplantacion-institucion',
      'solicitud-codigo-otp',
      'cuenta-segura',
      'banco-no-coincide',
      'tel-contacto-en-suplantacion',
      'presion-urgencia',
    ],
    minMatches: 2,
    descriptionEs:
      'Patrón de ingeniería social que simula un bloqueo o cargo bancario para obtener códigos OTP o desviar transferencias.',
    descriptionEn:
      'Social engineering pattern simulating a bank block or charge to harvest OTP codes or divert transfers.',
  },
  {
    id: 'camp-secuestro-extorsion',
    nameEs: 'Extorsión telefónica / Secuestro virtual',
    nameEn: 'Phone extortion / Virtual kidnapping',
    requiredAny: [
      'secuestro-virtual',
      'extorsion-amenaza',
      'aislamiento-victima',
      'no-colgar',
      'pago-irreversible',
    ],
    minMatches: 2,
    descriptionEs:
      'Guion de presión psicológica e intimidación que busca aislar a la persona y exigir pagos inmediatos.',
    descriptionEn:
      'Psychological pressure and intimidation script designed to isolate the victim and demand immediate payments.',
  },
  {
    id: 'camp-phishing-enlace',
    nameEs: 'Campaña de phishing por enlace',
    nameEn: 'Link-based phishing campaign',
    requiredAny: [
      'homoglifo-idn',
      'marca-en-subdominio',
      'ruta-credenciales',
      'acortador-url',
      'tld-abusado',
      'suplantacion-institucion',
    ],
    minMatches: 2,
    descriptionEs:
      'Infraestructura de enlaces engañosos orientada a capturar credenciales o datos personales.',
    descriptionEn:
      'Deceptive link infrastructure aimed at harvesting credentials or personal data.',
  },
  {
    id: 'camp-inversion-cripto',
    nameEs: 'Esquema de inversión o cripto fraudulento',
    nameEn: 'Fraudulent investment or crypto scheme',
    requiredAny: [
      'rendimiento-garantizado',
      'esquema-referidos',
      'direccion-cripto',
      'credito-con-anticipo',
      'deposito-a-tercero',
    ],
    minMatches: 2,
    descriptionEs:
      'Oferta con rendimientos garantizados, anticipos o pagos en activos irreversibles.',
    descriptionEn:
      'Offer promising guaranteed returns, advance fees, or payments in irreversible assets.',
  },
];

/** Detecta campañas sospechosas a partir de los IDs de señales observadas. */
export function detectCampaigns(signalIds: string[]): CampaignMatch[] {
  const set = new Set(signalIds);
  const found: CampaignMatch[] = [];

  for (const rule of CAMPAIGN_RULES) {
    const matched = rule.requiredAny.filter((id) => set.has(id));
    if (matched.length >= rule.minMatches) {
      found.push({
        id: rule.id,
        nameEs: rule.nameEs,
        nameEn: rule.nameEn,
        confidence: matched.length >= 3 ? 'alta' : 'media',
        matchedSignals: matched,
        descriptionEs: rule.descriptionEs,
        descriptionEn: rule.descriptionEn,
      });
    }
  }
  return found;
}

/** Correlaciona un conjunto de huellas actuales contra el historial local. */
export function correlateIncidents(
  current: {
    id?: string;
    domains?: string[];
    phonePrefixes?: string[];
    signalIds?: string[];
    topSignals?: string[];
  },
  history: HistoryEntry[],
): IncidentCorrelation {
  const currentDomains = new Set((current.domains ?? []).map((d) => d.toLowerCase()));
  const currentPhones = new Set(current.phonePrefixes ?? []);
  const currentTop = new Set(current.topSignals ?? []);
  const currentSignals = new Set(current.signalIds ?? []);

  const relatedEntries: IncidentCorrelation['relatedEntries'] = [];

  for (const entry of history) {
    if (current.id && entry.id === current.id) continue;
    const reasonsEs: string[] = [];
    const reasonsEn: string[] = [];

    const sharedDomains = (entry.domains ?? []).filter((d) => currentDomains.has(d.toLowerCase()));
    if (sharedDomains.length) {
      reasonsEs.push(`Mismo dominio: ${sharedDomains.join(', ')}`);
      reasonsEn.push(`Shared domain: ${sharedDomains.join(', ')}`);
    }

    const sharedPhones = (entry.phonePrefixes ?? []).filter((p) => currentPhones.has(p));
    if (sharedPhones.length) {
      reasonsEs.push(`Mismo prefijo telefónico: ${sharedPhones.join(', ')}`);
      reasonsEn.push(`Shared phone prefix: ${sharedPhones.join(', ')}`);
    }

    const sharedTop = entry.topSignals.filter((s) => currentTop.has(s));
    const sharedIds = (entry.signalIds ?? []).filter((s) => currentSignals.has(s));
    if (sharedTop.length >= 2 || sharedIds.length >= 2) {
      reasonsEs.push('Patrones de fraude coincidentes');
      reasonsEn.push('Matching fraud patterns');
    }

    if (reasonsEs.length) {
      relatedEntries.push({ entry, reasonsEs, reasonsEn });
    }
  }

  const allSignalIds = [...currentSignals];
  for (const rel of relatedEntries) {
    for (const id of rel.entry.signalIds ?? []) allSignalIds.push(id);
  }

  return {
    relatedEntries: relatedEntries.slice(0, 5),
    campaigns: detectCampaigns(allSignalIds),
  };
}
