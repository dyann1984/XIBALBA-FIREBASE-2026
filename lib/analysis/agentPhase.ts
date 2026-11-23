import type { AgentEvent, AgentId } from "./coordinator";
import type { Lang } from "@/lib/i18n";

export type Phase = AgentEvent["phase"] | "idle";

/** Fase real de un agente según los eventos emitidos en este análisis, nunca
 * inventada. Compartido por el tablero 2D (`AgentOperationsBoard`) y el mapa
 * 3D de los cinco dioses (`GodsMap3D`): misma fuente de verdad, una sola vez. */
export function phaseOf(events: AgentEvent[], agent: AgentId, busy: boolean): Phase {
  const records = events.filter((event) => event.agent === agent);
  const latest = records.at(-1);
  if (!latest) return "idle";
  if (latest.phase === "started" && !busy) return "error"; // se interrumpió
  return latest.phase;
}

export const PHASE_LABEL: Record<Phase, Record<Lang, string>> = {
  idle: { es: "Sin iniciar", en: "Not started" },
  queued: { es: "En cola", en: "Queued" },
  started: { es: "En ejecución", en: "Running" },
  completed: { es: "Completado", en: "Completed" },
  error: { es: "Error", en: "Error" },
};

/** Participación real: el resultado final (`executed`) una vez terminado, o
 * ya durante el análisis, que un evento real de ese agente haya llegado. */
export function participatedIn(events: AgentEvent[], executed: AgentId[], id: AgentId): boolean {
  return executed.includes(id) || events.some((event) => event.agent === id);
}
