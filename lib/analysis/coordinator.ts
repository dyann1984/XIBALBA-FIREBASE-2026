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
  FINANCE_ARITHMETIC_CHECKS,
  URL_LOCAL_CHECKS,
  type ImageFacts,
} from './audit.ts';
import { contentPatterns } from './patterns.ts';
import { voicePatterns } from './voice.ts';
import { financePatterns } from './finance-patterns.ts';
import { findFinancialIdentifiers } from './finance.ts';
import { auditPhones } from './phone.ts';
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

/** Por qué se eligió cada agente. Es una clave, no texto: el texto hardcodeado
 * aquí se mostraba sin pasar por i18n y quedaba en español aunque la persona
 * cambiara a inglés (hallazgo real de la prueba visual de esta sesión). La
 * traducción vive en `lib/i18n/dictionary.ts`, sección `agentReasons`. */
export type AgentReasonKey =
  | "declaredKind"
  | "audioAttached"
  | "callMention"
  | "financialIdentifier"
  | "moneyLanguage"
  | "linksPresent"
  | "generalCatalog"
  | "imageMetadata"
  | "guardianCoordinates";

export type AgentSelection = {
  /** Agentes que van a analizar, en orden de presentación. */
  agents: AgentId[];
  /** Por qué se eligió cada uno. Clave a traducir, no texto fijo. */
  reasons: Record<string, AgentReasonKey>;
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
  const reasons: Record<string, AgentReasonKey> = {};

  const add = (id: AgentId, reason: AgentReasonKey) => {
    if (agents.includes(id)) return;
    agents.push(id);
    reasons[id] = reason;
  };

  // 1. El agente declarado siempre participa.
  const declared = KIND_AGENT[input.kind];
  add(declared, 'declaredKind');

  // 2. CAMAZOTZ si hay audio o si el texto describe una llamada.
  if (input.hasAudio) add('camazotz', 'audioAttached');
  else if (input.kind !== 'url' && CALL_HINTS.test(text)) {
    add('camazotz', 'callMention');
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
      add('vucub', 'financialIdentifier');
    } else if (MONEY_HINTS.test(text)) {
      add('vucub', 'moneyLanguage');
    }
  }

  // 4. HUN CAMÉ si aparece algún enlace.
  if (input.kind !== 'url' && extractUrls(text).length) {
    add('hun', 'linksPresent');
  }

  // 5. IXBALANQUÉ solo si nadie más va a recorrer el catálogo general.
  //    CAMAZOTZ y VUCUB CAMÉ ya lo recorren con el suyo, así que añadirlo
  //    aquí presentaría como participante a un agente que no ejecuta nada.
  const generalCovered = agents.includes('camazotz') || agents.includes('vucub');
  if (input.kind !== 'url' && text.trim() && !generalCovered) {
    add('ixbalanque', 'generalCatalog');
  }

  if (input.hasImages) add('vucub', 'imageMetadata');

  // 6. EL GUARDIÁN siempre coordina y explica.
  add('guardian', 'guardianCoordinates');

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
  onEvent?: (event: AgentEvent) => void;
};

/** Eventos de trabajo real, sin contenido de entrada ni excepciones internas. */
export type AgentEvent = {
  agent: AgentId;
  phase: 'queued' | 'started' | 'completed' | 'error';
  task: string;
  elapsedMs?: number;
  findings?: number;
};

export type CoordinatedAudit = {
  audit: Audit;
  selection: AgentSelection;
  /** Evidencias con la atribución por agente, para mostrarlas. */
  attributed: AttributedIndicator[];
  /** Agentes que efectivamente aportaron alguna evidencia. */
  contributing: AgentId[];
  executed: AgentId[];
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
  const clock = () => typeof performance !== 'undefined' ? performance.now() : Date.now();
  const emit = (event: AgentEvent) => { try { request.onEvent?.(event); } catch { /* La telemetría no altera el análisis. */ } };
  const guardianStart = clock();
  emit({ agent: 'guardian', phase: 'started', task: 'coordinación' });
  const text = request.text ?? '';
  const selection = selectAgents({
    kind: request.kind,
    text,
    hasImages: Boolean(request.images?.length),
    hasAudio: Boolean(request.audio),
  });
  // EL GUARDIÁN ya anunció su propio inicio; el resto queda en cola en el
  // orden real en que se eligió, antes de que ninguno ejecute su catálogo.
  for (const agent of selection.agents) {
    if (agent === 'guardian') continue;
    emit({ agent, phase: 'queued', task: 'en cola' });
  }

  const parts: { agent: AgentId; audit: Audit }[] = [];
  const run = (agent: AgentId, task: string, work: () => Audit) => {
    const start = clock();
    emit({ agent, phase: 'started', task });
    try {
      const audit = work();
      parts.push({ agent, audit });
      emit({ agent, phase: 'completed', task, elapsedMs: clock() - start, findings: audit.indicators.length });
    } catch (error) {
      emit({ agent, phase: 'error', task, elapsedMs: clock() - start });
      throw error;
    }
  };
  // Qué catálogos se recorrieron de verdad, para contar la cobertura una sola
  // vez. Sumar las coberturas de cada parte inflaría el número: el catálogo
  // general lo recorren tanto CAMAZOTZ como VUCUB CAMÉ.
  const ran = { general: false, voz: false, financiero: false, url: false };

  if (request.kind === 'url') {
    run('hun', 'URL', () => auditUrl(text, now));
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
        run(agent, 'voz y texto', () => auditTranscript(text, now));
        ran.general = true;
        ran.voz = true;
      } else if (agent === 'vucub') {
        run(agent, 'finanzas y texto', () => auditFinancial(text, now));
        ran.general = true;
        ran.financiero = true;
      } else if (agent === 'ixbalanque') {
        run(agent, 'mensaje', () => auditMessage(text, now));
        ran.general = true;
        // Las comprobaciones de URL solo se ejecutaron si había algún enlace.
        if (extractUrls(text).length) ran.url = true;
      } else if (agent === 'hun') {
        run(agent, 'enlaces', () => auditTextLinks(text, now));
        if (extractUrls(text).length) ran.url = true;
      }
    }
  }

  if (request.audio) {
    const audio = request.audio;
    run('camazotz', 'archivo de audio', () => auditAudio(audio, request.transcription ?? TRANSCRIPTION_PENDING, now));
  }

  if (request.images?.length) {
    const images = request.images;
    run('vucub', 'metadatos de imagen', () => auditImages(images, now));
  }

  if (request.kind !== 'url' && text.trim()) {
    const phoneAgent: AgentId = selection.agents.includes('camazotz') ? 'camazotz' : 'ixbalanque';
    const phoneStart = clock();
    emit({ agent: phoneAgent, phase: 'started', task: 'teléfonos' });
    const phoneAudit = auditPhones(text, now);
    emit({ agent: phoneAgent, phase: 'completed', task: 'teléfonos', elapsedMs: clock() - phoneStart, findings: phoneAudit.indicators.length });
    if (phoneAudit.indicators.length) {
      parts.push({
        agent: phoneAgent,
        audit: {
          subject: 'mensaje',
          indicators: phoneAudit.indicators,
          coverage: {
            label: 'Análisis telefónico local.',
            checksRun: 4,
            checksTotal: 5,
            pendingExternal: ['reputación y titularidad de línea telefónica'],
          },
          limitation: 'No se consultó ninguna base externa de reputación telefónica.',
        },
      });
    }
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
    emit({ agent: 'guardian', phase: 'completed', task: 'coordinación', elapsedMs: clock() - guardianStart, findings: 0 });
    return { audit: empty, selection, attributed: [], contributing: [], executed: ['guardian'] };
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
  if (ran.financiero) checksRun += financePatterns.length + FINANCE_ARITHMETIC_CHECKS;
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

  emit({ agent: 'guardian', phase: 'completed', task: 'coordinación', elapsedMs: clock() - guardianStart, findings: attributed.length });
  return { audit, selection, attributed, contributing, executed: [...new Set<AgentId>([...parts.map(part => part.agent), 'guardian'])] };
}
