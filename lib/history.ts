// Historial de análisis.
//
// QUÉ GUARDA Y QUÉ NO
// -------------------
// Guarda el **resultado**, no el contenido: fecha, tipo, semáforo, nivel,
// confianza, agentes que participaron, cuántas señales se encontraron y las
// tres principales. Del texto analizado solo conserva un fragmento corto y
// saneado, para que la persona reconozca cuál de sus análisis es cada línea.
//
// El saneado no es decorativo. Antes de guardar nada:
//   · toda secuencia de 4 o más dígitos se enmascara — una CLABE, una tarjeta,
//     un NIP o un código de un solo uso nunca llegan al almacenamiento;
//   · las direcciones de correo se reducen a su dominio;
//   · las direcciones con forma de monedero se recortan;
//   · el fragmento se limita a 90 caracteres.
//
// DÓNDE VIVE
// ----------
// En memoria mientras la pestaña está abierta. Solo si la persona lo pide
// expresamente se copia a `localStorage` **de su propio navegador**. No hay
// nube: nada de esto viaja a Firestore ni a ningún servidor. Las reglas de
// Firestore siguen denegando todo, porque ningún código escribe ahí.
// El diseño del historial en la nube por usuario está en `docs/historial.md`,
// pendiente de Firebase Authentication.
//
// Este módulo es puro: recibe el almacenamiento como parámetro, así que se
// prueba sin navegador y no depende de React.

import type { AgentId } from './analysis/coordinator.ts';
import type { RiskLevel, TrafficLight } from './analysis/risk.ts';

export const HISTORY_KEY = 'xibalba.historial.v1';

/** Máximo de análisis conservados. Al superarlo se descarta el más antiguo. */
export const HISTORY_LIMIT = 20;

/** Longitud máxima del fragmento saneado que se conserva. */
export const PREVIEW_LIMIT = 90;

export type HistoryEntry = {
  id: string;
  /** Fecha en ISO 8601. */
  at: string;
  /** Tipo declarado en la interfaz. */
  kind: string;
  light: TrafficLight;
  riskLevel: RiskLevel;
  confidence: 'alta' | 'media' | 'baja';
  /** Agentes que aportaron alguna evidencia. */
  agents: AgentId[];
  /** Señales comprobadas y marcadas como sospechosas. */
  signals: number;
  /** Nombre de las tres señales principales, sin su evidencia. */
  topSignals: string[];
  checksRun: number;
  checksTotal: number;
  /** Fragmento saneado del contenido. Puede quedar vacío. */
  preview: string;
  /** Ruta de ejecución informada por el SDK, si la informó. */
  source: string | null;
  /** `true` si hubo adjuntos; no se guarda ningún archivo. */
  hadAttachments: boolean;
  /** Huellas no sensibles para correlación local de incidentes y campañas. */
  domains?: string[];
  phonePrefixes?: string[];
  signalIds?: string[];
};

/**
 * Deja un texto en condiciones de guardarse.
 *
 * Enmascara cualquier secuencia de 4 o más dígitos: es más agresivo que el
 * enmascarado de las evidencias (12 o más) a propósito, porque aquí también
 * hay que proteger un NIP de 4 dígitos, un código de un solo uso o un importe
 * que identifique la operación.
 */
export function maskSensitive(input: string): string {
  return (input ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    // Correo → solo el dominio.
    .replace(/[\w.+-]+@([\w-]+(?:\.[\w-]+)+)/g, '…@$1')
    // Monederos de criptomoneda: se recortan por forma, no por validez.
    .replace(/\b(bc1[a-z0-9]{6})[a-z0-9]{10,}\b/gi, '$1…')
    .replace(/\b(0x[a-fA-F0-9]{6})[a-fA-F0-9]{30,}\b/g, '$1…')
    // Cualquier corrida de 4 o más dígitos, admitiendo los separadores con que
    // se escriben de verdad: espacios, guiones, puntos, comas y barras. Así se
    // enmascara igual «1234 5678 9012 3456», «0021-2345-6789-0123-43» y
    // «$8,450.00». Un número de dos o tres dígitos («a las 10», «3 de 4») no se
    // toca: no identifica nada y borrarlo haría ilegible el fragmento.
    .replace(/\d(?:[\d\s.,/-]*\d){3,}/g, '••••');
}

/** Fragmento saneado y acotado que se guarda en el historial. */
export function previewOf(input: string): string {
  const masked = maskSensitive(input);
  if (masked.length <= PREVIEW_LIMIT) return masked;
  return `${masked.slice(0, PREVIEW_LIMIT - 1).trimEnd()}…`;
}

type SummarySource = {
  kind: string;
  text: string;
  hadAttachments?: boolean;
  domains?: string[];
  phonePrefixes?: string[];
  signalIds?: string[];
  risk: {
    light: TrafficLight;
    riskLevel: RiskLevel;
    confidence: 'alta' | 'media' | 'baja';
    coverage: { checksRun: number; checksTotal: number };
    deterministic: { suspicious: number; topSignals: string[] };
  };
  contributing: AgentId[];
  source: string | null;
};

/**
 * Construye la entrada de historial a partir de un resultado de análisis.
 * El identificador se recibe para no depender de `crypto` ni del reloj dentro
 * de una función pura.
 */
export function summarize(result: SummarySource, id: string, now = new Date()): HistoryEntry {
  return {
    id,
    at: now.toISOString(),
    kind: result.kind,
    light: result.risk.light,
    riskLevel: result.risk.riskLevel,
    confidence: result.risk.confidence,
    agents: [...result.contributing],
    signals: result.risk.deterministic.suspicious,
    topSignals: result.risk.deterministic.topSignals.slice(0, 3),
    checksRun: result.risk.coverage.checksRun,
    checksTotal: result.risk.coverage.checksTotal,
    preview: previewOf(result.text),
    source: result.source,
    hadAttachments: Boolean(result.hadAttachments),
    ...(result.domains?.length ? { domains: result.domains.slice(0, 5) } : {}),
    ...(result.phonePrefixes?.length ? { phonePrefixes: result.phonePrefixes.slice(0, 5) } : {}),
    ...(result.signalIds?.length ? { signalIds: result.signalIds.slice(0, 12) } : {}),
  };
}

/** Añade una entrada al principio y recorta al límite. */
export function append(entries: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return [entry, ...entries].slice(0, HISTORY_LIMIT);
}

/** Quita una sola entrada por `id`. El borrado completo sigue siendo `clear`. */
export function remove(entries: HistoryEntry[], id: string): HistoryEntry[] {
  return entries.filter((entry) => entry.id !== id);
}

const LIGHTS = new Set<string>(['verde', 'amarillo', 'rojo', 'gris']);
const LEVELS = new Set<string>(['bajo', 'medio', 'alto', 'no concluyente']);
const CONFIDENCES = new Set<string>(['alta', 'media', 'baja']);

/**
 * Valida una entrada leída del almacenamiento. Lo que viene de
 * `localStorage` es dato no confiable: pudo quedar de una versión anterior o
 * haberlo escrito otra cosa. Una entrada que no cuadre se descarta en silencio
 * en lugar de romper la interfaz.
 */
export function isEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.at === 'string' &&
    !Number.isNaN(Date.parse(entry.at)) &&
    typeof entry.kind === 'string' &&
    typeof entry.light === 'string' &&
    LIGHTS.has(entry.light) &&
    typeof entry.riskLevel === 'string' &&
    LEVELS.has(entry.riskLevel) &&
    typeof entry.confidence === 'string' &&
    CONFIDENCES.has(entry.confidence) &&
    Array.isArray(entry.agents) &&
    entry.agents.every((agent) => typeof agent === 'string') &&
    typeof entry.signals === 'number' &&
    Array.isArray(entry.topSignals) &&
    entry.topSignals.every((signal) => typeof signal === 'string') &&
    typeof entry.checksRun === 'number' &&
    typeof entry.checksTotal === 'number' &&
    typeof entry.preview === 'string'
  );
}

/** Almacenamiento mínimo que necesita el historial. */
export type HistoryStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/**
 * Lee el historial guardado. Nunca lanza: si el almacenamiento no está
 * disponible (modo privado, permisos) o el contenido no es válido, devuelve una
 * lista vacía.
 */
export function load(storage: HistoryStorage | null | undefined): HistoryEntry[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

/**
 * Guarda el historial. Vuelve a sanear el fragmento antes de escribir: es la
 * última puerta antes del almacenamiento, y preferimos enmascarar dos veces a
 * confiar en que quien llama lo hizo.
 */
export function save(storage: HistoryStorage | null | undefined, entries: HistoryEntry[]): boolean {
  if (!storage) return false;
  try {
    const safe = entries.slice(0, HISTORY_LIMIT).map((entry) => ({
      ...entry,
      preview: previewOf(entry.preview),
    }));
    storage.setItem(HISTORY_KEY, JSON.stringify(safe));
    return true;
  } catch {
    return false;
  }
}

/** Borra el historial guardado. */
export function clear(storage: HistoryStorage | null | undefined): void {
  if (!storage) return;
  try {
    storage.removeItem(HISTORY_KEY);
  } catch {
    // Sin almacenamiento no hay nada que borrar.
  }
}

export const KIND_LABEL: Record<string, string> = {
  message: 'Mensaje',
  url: 'Enlace',
  transcripcion: 'Llamada',
  financiero: 'Dinero',
};

/** Etiqueta del tipo de análisis, con respaldo para un valor desconocido. */
export function describeKind(kind: string): string {
  return KIND_LABEL[kind] ?? 'Análisis';
}

/**
 * Fecha y hora legibles, sin segundos. El locale es un parámetro para que el
 * historial se lea en el idioma de la interfaz; por omisión, el del proyecto.
 */
export function describeWhen(at: string, locale: string = 'es-MX'): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return locale.startsWith('en') ? 'unreadable date' : 'fecha no legible';
  return date.toLocaleString(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
