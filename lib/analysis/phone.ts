// Análisis determinista de números telefónicos en mensajes y transcripciones.
//
// HONESTIDAD ESTRICTA
// -------------------
// No consulta bases de datos de reputación, ni el Registro Público de
// Telecomunicaciones (IFT), ni la titularidad de la línea. Solo analiza la
// estructura del número y el contexto del texto recibido, y enmascara los
// dígitos antes de emitir evidencias.

import type { AuditIndicator } from './risk.ts';

export type PhoneMatch = {
  raw: string;
  digits: string;
  masked: string;
  kind: 'mx' | 'us-ca' | 'intl' | 'premium' | 'shortcode';
  prefix: string;
};

const PREMIUM_RE = /^(?:01)?900\d{7}$|^1?900\d{7}$/;
const BANK_OR_GOV_RE =
  /\b(banco|bbva|santander|banamex|citibanamex|banorte|hsbc|scotiabank|sat|imss|infonavit|condusef|soporte|seguridad|ejecutivo|bloqueo|cargo no reconocido|paqueteria|fedex|dhl|estafeta|correos)\b/i;
const URL_HINT_RE = /https?:\/\/|www\.|\b[a-z0-9-]+\.(com|mx|net|org|xyz|top|tk|click|link)\b/i;

/** Enmascara un número conservando solo el prefijo de país/región y los últimos 2 dígitos. */
export function maskPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length <= 4) return '••••';
  const tail = digits.slice(-2);
  const hasPlus = raw.trim().startsWith('+');
  const head = digits.length > 10 ? digits.slice(0, digits.length - 10) : digits.slice(0, 2);
  return `${hasPlus ? '+' : ''}${head} •••• ••${tail}`;
}

/** Extrae números telefónicos plausibles de un texto sin capturar CLABEs ni tarjetas. */
export function extractPhoneNumbers(text: string): PhoneMatch[] {
  if (!text) return [];
  const matches: PhoneMatch[] = [];
  const seen = new Set<string>();
  // Excluir primero secuencias largas de tarjeta (15-16) o CLABE (18) para no capturar subcadenas.
  const sanitized = text.replace(/\b\d(?:[\s.-]?\d){14,18}\b/g, (seq) => ' '.repeat(seq.length));

  // Números con prefijo internacional (+52, +1, +34, etc.) o formato nacional 10 dígitos
  const phoneRe = /(?<!\d)(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,3}\)?[\s.-]?){2,4}\d{2,4}(?!\d)/g;
  for (const m of sanitized.matchAll(phoneRe)) {
    const raw = m[0].trim();
    const digits = raw.replace(/\D/g, '');
    // Evitar confundir con tarjetas (15-16) o CLABEs (18) o años/montos cortos (<10)
    if (digits.length < 10 || digits.length > 13) continue;
    // Evitar fechas tipo 2026-11-18 o decimales
    if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(raw)) continue;
    if (seen.has(digits)) continue;
    seen.add(digits);

    let kind: PhoneMatch['kind'] = 'mx';
    let prefix = digits.slice(0, 2);
    if (PREMIUM_RE.test(digits)) {
      kind = 'premium';
      prefix = '900';
    } else if (raw.startsWith('+52') || (digits.startsWith('52') && digits.length >= 12)) {
      kind = 'mx';
      const local = digits.slice(digits.length - 10);
      prefix = `+52-${local.slice(0, 2)}`;
    } else if (raw.startsWith('+1') || (digits.startsWith('1') && digits.length === 11)) {
      kind = 'us-ca';
      prefix = `+1-${digits.slice(1, 4)}`;
    } else if (raw.startsWith('+') || digits.length > 10) {
      kind = 'intl';
      prefix = `+${digits.slice(0, Math.min(3, digits.length - 8))}`;
    } else {
      kind = 'mx';
      prefix = digits.slice(0, 2);
    }

    matches.push({
      raw,
      digits,
      masked: maskPhone(raw),
      kind,
      prefix,
    });
  }

  return matches;
}

/** Audita los números telefónicos encontrados en un texto. */
export function auditPhones(text: string, now = new Date()): {
  matches: PhoneMatch[];
  indicators: AuditIndicator[];
} {
  const matches = extractPhoneNumbers(text);
  if (!matches.length) return { matches: [], indicators: [] };

  const checkedAt = now.toISOString();
  const indicators: AuditIndicator[] = [];
  const maskedList = matches.map((m) => m.masked).join(', ');

  indicators.push({
    id: 'tel-detectado',
    indicator: 'Número telefónico detectado en el contenido',
    category: 'telefono',
    status: 'verificado',
    severity: 'informativo',
    classification: 'determinista',
    evidence: `Se detectaron ${matches.length} número(s) (${maskedList}).`,
    recommendation:
      'Verifica el número en el sitio oficial o al reverso de tu tarjeta antes de devolver la llamada.',
    limitation:
      'El formato del número no identifica a su titular ni comprueba si ha sido reportado en bases externas.',
    source: 'Analizador telefónico local',
    checkedAt,
  });

  if (matches.some((m) => m.kind === 'premium')) {
    indicators.push({
      id: 'tel-tarificacion-especial',
      indicator: 'Número de tarificación especial (900)',
      category: 'telefono',
      status: 'sospechoso',
      severity: 'alto',
      classification: 'determinista',
      evidence: `Se encontró un número con prefijo de tarificación especial (${matches
        .filter((m) => m.kind === 'premium')
        .map((m) => m.masked)
        .join(', ')}).`,
      recommendation: 'No devuelvas la llamada a números 900 desde mensajes no solicitados.',
      limitation: 'Detectado por prefijo numérico; no se consultó al operador.',
      source: 'Analizador telefónico local',
      checkedAt,
    });
  }

  if (matches.length >= 2) {
    indicators.push({
      id: 'tel-multiples',
      indicator: 'Múltiples números telefónicos distintos',
      category: 'telefono',
      status: 'sospechoso',
      severity: 'medio',
      classification: 'determinista',
      evidence: `El contenido incluye ${matches.length} números diferentes (${maskedList}), patrón habitual en guiones de suplantación o redirección.`,
      recommendation: 'Desconfía de mensajes que piden llamar o escribir a otro número distinto al oficial.',
      limitation: 'Una empresa legítima también puede incluir dos líneas de contacto.',
      source: 'Analizador telefónico local',
      checkedAt,
    });
  }

  if (BANK_OR_GOV_RE.test(text) && matches.some((m) => m.kind === 'mx' || m.kind === 'intl')) {
    indicators.push({
      id: 'tel-contacto-en-suplantacion',
      indicator: 'Teléfono de contacto dentro de aviso institucional o bancario',
      category: 'telefono',
      status: 'sospechoso',
      severity: 'alto',
      classification: 'determinista',
      evidence: `El mensaje menciona una institución o paquetería e invita a contactar al número ${matches[0].masked}.`,
      recommendation:
        'Nunca llames al número incluido en un SMS o mensaje sospechoso; usa el teléfono del reverso de tu tarjeta o la app oficial.',
      limitation:
        'No se comprueba si el número pertenece realmente a la institución mencionada.',
      source: 'Analizador telefónico local',
      checkedAt,
    });
  }

  if (matches.some((m) => m.kind === 'intl') && URL_HINT_RE.test(text)) {
    indicators.push({
      id: 'tel-internacional-con-enlace',
      indicator: 'Prefijo telefónico internacional combinado con enlace',
      category: 'telefono',
      status: 'sospechoso',
      severity: 'medio',
      classification: 'determinista',
      evidence: `Se combina un número internacional (${matches
        .filter((m) => m.kind === 'intl')
        .map((m) => m.masked)
        .join(', ')}) con un enlace web.`,
      recommendation: 'Evita abrir el enlace o responder por mensajería a remitentes internacionales desconocidos.',
      limitation: 'Un prefijo internacional no prueba fraude por sí solo.',
      source: 'Analizador telefónico local',
      checkedAt,
    });
  }

  return { matches, indicators };
}
