"use client";
import { AGENT_NAMES, type AgentEvent, type AgentId } from "@/lib/analysis/coordinator";
import { participatedIn, phaseOf, PHASE_LABEL } from "@/lib/analysis/agentPhase";
import { agents as agentRoster } from "@/lib/agents";
import type { Lang } from "@/lib/i18n";

/**
 * Centro de operaciones de los 5 agentes: EL GUARDIÁN al centro, los cuatro
 * especialistas alrededor. Las líneas que los conectan solo se dibujan hacia
 * un agente que de verdad participó en este análisis (`executed`), nunca
 * como decoración fija: si un agente no corrió, su línea no existe.
 */

const SPECIALISTS: AgentId[] = ["camazotz", "ixbalanque", "vucub", "hun"];

// Posiciones en un lienzo de 300×300. El GUARDIÁN al centro; los cuatro
// especialistas en las esquinas, en el mismo orden en que ya se muestran en
// el resto de la interfaz (lib/agents.ts).
const POS: Record<AgentId, { x: number; y: number }> = {
  guardian: { x: 150, y: 150 },
  camazotz: { x: 48, y: 48 },
  ixbalanque: { x: 252, y: 48 },
  vucub: { x: 48, y: 252 },
  hun: { x: 252, y: 252 },
};

export default function AgentOperationsBoard({
  events,
  executed,
  busy,
  lang,
}: {
  events: AgentEvent[];
  /** Agentes que de verdad ejecutaron un catálogo en este análisis. */
  executed: AgentId[];
  busy: boolean;
  lang: Lang;
}) {
  const guardianPhase = phaseOf(events, "guardian", busy);
  const participated = (id: AgentId) => participatedIn(events, executed, id);
  return (
    <div className="ops-board" role="img" aria-label={lang === "en" ? "Agent operations board" : "Centro de operaciones de agentes"}>
      <svg className="ops-lines" viewBox="0 0 300 300" aria-hidden="true">
        {SPECIALISTS.map((id) => {
          const real = participated(id);
          if (!real) return null;
          const p = POS[id];
          const phase = phaseOf(events, id, busy);
          return (
            <line
              key={id}
              x1={POS.guardian.x}
              y1={POS.guardian.y}
              x2={p.x}
              y2={p.y}
              className={`ops-link ops-link-${phase}`}
            />
          );
        })}
      </svg>
      <div className="ops-node ops-guardian" data-phase={guardianPhase}>
        <strong>{AGENT_NAMES.guardian}</strong>
        <span>{PHASE_LABEL[guardianPhase][lang]}</span>
      </div>
      {SPECIALISTS.map((id) => {
        const roster = agentRoster.find((a) => a.id === id);
        const real = participated(id);
        const phase = phaseOf(events, id, busy);
        const record = events.filter((event) => event.agent === id).at(-1);
        return (
          <div
            key={id}
            className={`ops-node ops-${id} ${real ? "ops-active" : "ops-inactive"}`}
            data-phase={phase}
          >
            <strong>{roster?.name ?? AGENT_NAMES[id]}</strong>
            <span>{PHASE_LABEL[phase][lang]}</span>
            {record?.elapsedMs !== undefined && <small>{record.elapsedMs.toFixed(1)} ms</small>}
            {!real && <small>{lang === "en" ? "Did not participate" : "No participó"}</small>}
          </div>
        );
      })}
    </div>
  );
}
