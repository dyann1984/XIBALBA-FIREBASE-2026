// EL GUARDIÁN · coordinación multiagente.
//
// Qué resuelve
// ------------
// Una entrada rara vez pertenece a un solo agente. «Me llamaron del banco y me
// dictaron esta cuenta: 002… » es a la vez una llamada (CAMAZOTZ) y una
// operación financiera (VUCUB CAMÉ). Antes, la persona elegía un tipo y el
// resto del análisis se perdía.
//
// Reglas de coordinación
// ----------------------
//  1. El GUARDIÁN elige los agentes según lo que hay en la entrada, no según
//     lo que la persona declaró. Lo declarado solo garantiza que ese agente
//     participe.
//  2. Las evidencias se fusionan **sin duplicar**: un mismo patrón detectado
//     por dos agentes aparece una vez, atribuido a los dos.
//  3. Un solo semáforo. El veredicto sale de `combineRisk` sobre la auditoría
//     ya fusionada, nunca de promediar veredictos por agente.
//  4. Lo comprobado y lo estimado siguen separados: la fusión no cambia la
//     clase de ninguna evidencia.
//
// Lo que NO hace: no inventa un agente para una entrada que no lo necesita, y
// no presenta como participante a un agente que no aportó nada.

import type { Audit, AuditIndicator } from './risk.ts';
import {
  auditAudio,
  auditFinancial,
  auditImages,
  auditMessage,
  auditTextLinks,
  auditTranscript,
  auditUrl,
  extractUrls,
  mergeAudits,
  URL_LOCAL_CHECKS,
  type ImageFacts,
} from './audit.ts';
import { contentPatterns } from './patterns.ts';
import { voicePatterns } from './voice.ts';
import { financePatterns } from './finance-patterns.ts';
import { findFinancialIdentifiers } from './finance.ts';
import type { PreparedAudio, Transcription } from './audio.ts';
import { TRANSCRIPTION_PENDING } from './audio.ts';

export type AgentId = 'camazotz' | 'ixbalanque' | 'vucub' | 'hun' | 'guardian';

export const AGENT_NAMES: Record<AgentId, string> = {
  camazotz: 'CAMAZOTZ',
  ixbalanque: 'IXBALANQUÉ',
  vucub: 'VUCUB CAMÉ',
  hun: 'HUN CAMÉ',
  guardian: 'EL GUARDIÁN',
};

/** Tipo de entrada que la persona declara en la interfaz. */
export type InputKind = 'message' | 'url' | 'transcripcion' | 'financiero';

export const KIND_AGENT: Record<InputKind, AgentId> = {
  message: 'ixbalanque',
  url: 'hun',
  transcripcion: 'camazotz',
  financiero: 'vucub',
};

// ---------------------------------------------------------------------------
// Selección de agentes
// ---------------------------------------------------------------------------

/** Señales de que el texto describe una llamada. */
const CALL_HINTS =
  /\b(llam\w+|telefon\w+|celular|marc(o|aron|ó)|colg\w+|al telefono|me hablaron|contest\w+|linea|buzon de voz|whatsapp de voz|nota de voz|audio)\b/i;

/** Señales de que el texto trata de dinero. */
const MONEY_HINTS =
  /\b(deposit\w+|transfer\w+|clabe|cuenta bancaria|tarjeta|pago|pagar|cobr\w+|invers\w+|invertir|rendimiento|credito|prestamo|comision|bitcoin|cripto\w*|usdt|spei|oxxo|efectivo|dinero|pesos|mxn|\$\s?\d)\b/i;

export type AgentSelection = {
  /** Agentes que van a analizar, en orden de presentación. */
  agents: AgentId[];
  /** Por qué se eligió cada uno. Se muestra a la persona. */
  reasons: Record<string, string>;
};

/**
 * Decide qué agentes participan. El agente del tipo declarado siempre entra;
 * los demás solo si la entrada tiene algo que les corresponda.
 */
export function selectAgents(input: {
  kind: InputKind;
  text: string;
  hasImages?: boolean;
  hasAudio?: boolean;
}): AgentSelection {
  const text = input.text ?? '';
  const agents: AgentId[] = [];
  const reasons: Record<string, string> = {};

  const add = (id: AgentId, reason: string) => {
    if (agents.includes(id)) return;
    agents.push(id);
    reasons[id] = reason;
  };

  // 1. El agente declarado siempre participa.
  const declared = KIND_AGENT[input.kind];
  add(declared, 'Lo elegiste como tipo de contenido.');

  // 2. CAMAZOTZ si hay audio o si el texto describe una llamada.
  if (input.hasAudio) add('camazotz', 'Adjuntaste un archivo de audio.');
  else if (input.kind !== 'url' && CALL_HINTS.test(text)) {
    add('camazotz', 'El texto menciona una llamada o un audio.');
  }

  // 3. VUCUB CAMÉ si hay identificadores financieros o lenguaje de dinero.
  if (input.kind !== 'url') {
    const found = findFinancialIdentifiers(text);
    const hasIdentifier =
      found.validClabes.length +
        found.invalidClabes.length +
        found.validCards.length +
        found.invalidCards.length +
        found.cryptoAddresses.length >
      0;
    if (hasIdentifier) {
      add('vucub', 'El texto contiene un número de cuenta, tarjeta o monedero.');
    } else if (MONEY_HINTS.test(text)) {
      add('vucub', 'El texto habla de dinero, pagos o inversiones.');
    }
  }

  // 4. HUN CAMÉ si aparece algún enlace.
  if (input.kind !== 'url' && extractUrls(text).length) {
    add('hun', 'El contenido incluye enlaces.');
  }

  // 5. IXBALANQUÉ solo si nadie más va a recorrer el catálogo general.
  //    CAMAZOTZ y VUCUB CAMÉ ya lo recorren con el suyo, así que añadirlo
  //    aquí presentaría como participante a un agente que no ejecuta nada.
  const generalCovered = agents.includes('camazotz') || agents.includes('vucub');
  if (input.kind !== 'url' && text.trim() && !generalCovered) {
    add('ixbalanque', 'Hay texto que analizar con el catálogo general.');
  }

  // 6. EL GUARDIÁN siempre coordina y explica.
  add('guardian', 'Coordina a los agentes y explica el resultado.');

  return { agents, reasons };
}

// ---------------------------------------------------------------------------
// Fusión sin duplicados
// ---------------------------------------------------------------------------

export type AttributedIndicator = AuditIndicator & {
  /** Agentes que aportaron esta misma evidencia. */
  agents: AgentId[];
};

/**
 * Fusiona evidencias quitando duplicados por `id`.
 *
 * Cuando dos agentes detectan el mismo patrón, se conserva una sola evidencia
 * y se atribuye a los dos: la persona ve una lista limpia y sigue sabiendo
 * quién la aportó. Si coincide el id pero difiere la severidad, se conserva la
 * más grave, porque rebajar evidencia al fusionar sería perder información.
 */
export function dedupeIndicators(
  parts: { agent: AgentId; indicators: AuditIndicator[] }[],
): AttributedIndicator[] {
  const order: string[] = [];
  const byId = new Map<string, AttributedIndicator>();
  const WEIGHT = { critico: 5, alto: 4, medio: 3, bajo: 2, informativo: 1 } as const;

  for (const part of parts) {
    for (const indicator of part.indicators) {
      const existing = byId.get(indicator.id);
      if (!existing) {
        byId.set(indicator.id, { ...indicator, agents: [part.agent] });
        order.push(indicator.id);
        continue;
      }
      if (!existing.agents.includes(part.agent)) existing.agents.push(part.agent);
      if (WEIGHT[indicator.severity] > WEIGHT[existing.severity]) {
        byId.set(indicator.id, { ...indicator, agents: existing.agents });
      }
    }
  }

  return order.map((id) => byId.get(id)!).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Auditoría coordinada
// ---------------------------------------------------------------------------

export type CoordinatedRequest = {
  kind: InputKind;
  text: string;
  images?: ImageFacts[];
  audio?: Pick<PreparedAudio, 'name' | 'mimeType' | 'size' | 'durationSeconds'> | null;
  transcription?: Transcription;
};

export type CoordinatedAudit = {
  audit: Audit;
  selection: AgentSelection;
  /** Evidencias con la atribución por agente, para mostrarlas. */
  attributed: AttributedIndicator[];
  /** Agentes que efectivamente aportaron alguna evidencia. */
  contributing: AgentId[];
};

/**
 * Ejecuta los agentes seleccionados y devuelve una sola auditoría.
 *
 * Importante: el texto se analiza una vez por cada catálogo que corresponda,
 * pero las evidencias repetidas se colapsan, así que una misma señal no
 * puntúa dos veces en el veredicto.
 */
export function auditCoordinated(
  request: CoordinatedRequest,
  now = new Date(),
): CoordinatedAudit {
  const text = request.text ?? '';
  const selection = selectAgents({
    kind: request.kind,
    text,
    hasImages: Boolean(request.images?.length),
    hasAudio: Boolean(request.audio),
  });

  const parts: { agent: AgentId; audit: Audit }[] = [];
  // Qué catálogos se recorrieron de verdad, para contar la cobertura una sola
  // vez. Sumar las coberturas de cada parte inflaría el número: el catálogo
  // general lo recorren tanto CAMAZOTZ como VUCUB CAMÉ.
  const ran = { general: false, voz: false, financiero: false, url: false };

  if (request.kind === 'url') {
    parts.push({ agent: 'hun', audit: auditUrl(text, now) });
    ran.url = true;
  } else if (text.trim()) {
    // Cada agente seleccionado ejecuta su propio catálogo, en el orden en que
    // EL GUARDIÁN los eligió:
    //  · CAMAZOTZ    → general + voz
    //  · VUCUB CAMÉ  → general + financiero + aritmética
    //  · IXBALANQUÉ  → general (y los enlaces del texto)
    //  · HUN CAMÉ    → los enlaces escritos en el texto
    // Varios recorren el catálogo general a propósito: así ninguna evidencia
    // queda sin atribuir. Las coincidencias repetidas se colapsan después y la
    // cobertura se cuenta una sola vez, de modo que no puntúan dos veces.
    for (const agent of selection.agents) {
      if (agent === 'camazotz') {
        parts.push({ agent, audit: auditTranscript(text, now) });
        ran.general = true;
        ran.voz = true;
      } else if (agent === 'vucub') {
        parts.push({ agent, audit: auditFinancial(text, now) });
        ran.general = true;
        ran.financiero = true;
      } else if (agent === 'ixbalanque') {
        parts.push({ agent, audit: auditMessage(text, now) });
        ran.general = true;
        // Las comprobaciones de URL solo se ejecutaron si había algún enlace.
        if (extractUrls(text).length) ran.url = true;
      } else if (agent === 'hun') {
        parts.push({ agent, audit: auditTextLinks(text, now) });
        if (extractUrls(text).length) ran.url = true;
      }
    }
  }

  if (request.audio) {
    parts.push({
      agent: 'camazotz',
      audit: auditAudio(request.audio, request.transcription ?? TRANSCRIPTION_PENDING, now),
    });
  }

  if (request.images?.length) {
    parts.push({ agent: 'vucub', audit: auditImages(request.images, now) });
  }

  if (!parts.length) {
    const empty: Audit = {
      subject: 'mensaje',
      indicators: [],
      coverage: {
        label: 'Sin contenido analizado.',
        checksRun: 0,
        checksTotal: 0,
        pendingExternal: ['contenido no proporcionado'],
      },
      limitation: 'No se recibió contenido que auditar.',
    };
    return { audit: empty, selection, attributed: [], contributing: [] };
  }

  const attributed = dedupeIndicators(
    parts.map((part) => ({ agent: part.agent, indicators: part.audit.indicators })),
  );

  // La auditoría fusionada usa las evidencias ya deduplicadas, de modo que el
  // veredicto no cuente dos veces la misma señal.
  const merged = mergeAudits(parts.map((part) => part.audit));

  // Cobertura contada una sola vez por catálogo recorrido.
  let checksRun = 0;
  if (ran.general) checksRun += contentPatterns.length + 1;
  if (ran.voz) checksRun += voicePatterns.length;
  if (ran.financiero) checksRun += financePatterns.length + 4;
  if (ran.url) checksRun += URL_LOCAL_CHECKS;
  if (request.audio) checksRun += 2;
  if (request.images?.length) checksRun += request.images.length + 2;

  const audit: Audit = {
    ...merged,
    indicators: attributed,
    coverage: {
      ...merged.coverage,
      checksRun,
      checksTotal: checksRun + merged.coverage.pendingExternal.length,
    },
  };

  const contributing = [...new Set(attributed.flatMap((item) => item.agents))];

  return { audit, selection, attributed, contributing };
}
