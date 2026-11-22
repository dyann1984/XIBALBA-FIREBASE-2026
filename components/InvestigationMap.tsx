"use client";
import { useMemo, useState } from "react";
import { Network, ShieldAlert } from "lucide-react";
import type { HistoryEntry } from "@/lib/history";
import { describeWhen } from "@/lib/history";
import { correlateIncidents, detectCampaigns, type CampaignMatch } from "@/lib/analysis/correlation";
import { AGENT_NAMES } from "@/lib/analysis/coordinator";
import type { Lang } from "@/lib/i18n";

/**
 * Mapa de relaciones entre investigaciones: un nodo por caso del historial de
 * esta sesión, con una línea solo cuando `correlateIncidents` (la misma
 * lógica probada que ya usa el panel de un análisis en curso) encontró un
 * motivo real compartido — mismo dominio, mismo prefijo telefónico o
 * patrones de fraude coincidentes. No hay geolocalización ni relaciones
 * inventadas: un caso sin ninguna coincidencia queda como nodo aislado, y lo
 * dice.
 */

const LIGHT_COLOR: Record<HistoryEntry["light"], string> = {
  rojo: "#f43f5e",
  amarillo: "#fbbf24",
  verde: "#34d399",
  gris: "#5b6b76",
};

const KIND_LABEL: Record<string, { es: string; en: string }> = {
  message: { es: "Mensaje", en: "Message" },
  url: { es: "Enlace", en: "Link" },
  transcripcion: { es: "Llamada", en: "Call" },
  financiero: { es: "Dinero", en: "Money" },
};

type Edge = { a: string; b: string; reasonsEs: string[]; reasonsEn: string[] };

/**
 * Glifo pequeño por tipo de caso: convierte el nodo en una entidad
 * reconocible (no un punto genérico), sin inventar un ícono para datos que
 * no existen. Trazo simple, un solo color heredado (`currentColor`), barato
 * de pintar en cualquier equipo.
 */
function glyphFor(kind: string) {
  switch (kind) {
    case "url":
      // Enlace: dos eslabones.
      return (
        <>
          <circle cx="-3.5" cy="-2" r="3.4" />
          <circle cx="3.5" cy="2" r="3.4" />
        </>
      );
    case "transcripcion":
      // Llamada: onda de voz.
      return (
        <>
          <path d="M-7 1 C-7 -4 -3 -4 -3 1 C-3 6 1 6 1 1 C1 -4 5 -4 5 1" />
        </>
      );
    case "financiero":
      // Dinero: glifo de moneda.
      return (
        <>
          <circle cx="0" cy="0" r="5.2" />
          <path d="M0 -2.6 L0 2.6 M-2 -1.2 L2 1.2 M-2 1.2 L2 -1.2" />
        </>
      );
    default:
      // Mensaje: ojo-rombo, el mismo lenguaje visual que las runas del Guardián.
      return <path d="M-7 0 Q0 -5.5 7 0 Q0 5.5 -7 0 Z M0 -1.6 L1.6 0 L0 1.6 L-1.6 0 Z" />;
  }
}

function buildGraph(history: HistoryEntry[]) {
  const edges: Edge[] = [];
  const seen = new Set<string>();
  for (const entry of history) {
    const { relatedEntries } = correlateIncidents(
      {
        id: entry.id,
        domains: entry.domains,
        phonePrefixes: entry.phonePrefixes,
        signalIds: entry.signalIds,
        topSignals: entry.topSignals,
      },
      history,
    );
    for (const rel of relatedEntries) {
      const key = [entry.id, rel.entry.id].sort().join("::");
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ a: entry.id, b: rel.entry.id, reasonsEs: rel.reasonsEs, reasonsEn: rel.reasonsEn });
    }
  }
  const campaigns = detectCampaigns(history.flatMap((entry) => entry.signalIds ?? []));
  return { edges, campaigns };
}

/** Campañas cuyas señales coinciden con las de este caso en particular. */
function campaignsFor(entry: HistoryEntry, campaigns: CampaignMatch[]): CampaignMatch[] {
  const signals = new Set(entry.signalIds ?? []);
  return campaigns.filter((c) => c.matchedSignals.some((id) => signals.has(id)));
}

const SIZE = 420;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2 - 54;

export default function InvestigationMap({ history, lang }: { history: HistoryEntry[]; lang: Lang }) {
  const [selectedRaw, setSelected] = useState<string | null>(null);
  const { edges, campaigns } = useMemo(() => buildGraph(history), [history]);
  // Un único caso no se deja como un punto perdido en el vacío: se
  // selecciona solo, para que el pedestal ritual y la explicación aparezcan
  // de inmediato en vez de esperar un clic sobre un nodo aislado.
  const selected = selectedRaw ?? (history.length === 1 ? history[0].id : null);

  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    history.forEach((entry, index) => {
      const angle = (index / Math.max(history.length, 1)) * Math.PI * 2 - Math.PI / 2;
      map.set(entry.id, {
        x: CENTER + Math.cos(angle) * RADIUS,
        y: CENTER + Math.sin(angle) * RADIUS,
      });
    });
    return map;
  }, [history]);

  const connected = new Set(edges.flatMap((edge) => [edge.a, edge.b]));
  const selectedEntry = history.find((entry) => entry.id === selected) ?? null;
  const selectedEdges = selected ? edges.filter((edge) => edge.a === selected || edge.b === selected) : [];

  if (history.length === 0) {
    return (
      <div className="empty-row">
        <div className="empty-icon">
          <Network size={20} />
        </div>
        <div>
          <strong>{lang === "en" ? "No investigations yet" : "Todavía no hay investigaciones"}</strong>
          <p>
            {lang === "en"
              ? "Run an analysis and keep it in your history to see it appear here. Nothing is invented: an empty map means an empty history."
              : "Haz un análisis y consérvalo en tu historial para que aparezca aquí. Nada se inventa: un mapa vacío significa un historial vacío."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="investigation-map">
      <div className="map-canvas">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={lang === "en" ? "Investigation relationship map" : "Mapa de relaciones entre investigaciones"}>
          <g className="map-edges">
            {edges.map((edge) => {
              const a = positions.get(edge.a);
              const b = positions.get(edge.b);
              if (!a || !b) return null;
              const active = selected === edge.a || selected === edge.b;
              return (
                <g key={`${edge.a}-${edge.b}`}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`map-edge${active ? " map-edge-active" : ""}`} />
                  {/* Segunda línea punteada animada, solo sobre relaciones
                      tocadas por la selección: "luminosa" sin animar las
                      decenas de líneas que puede tener un historial grande. */}
                  {active && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="map-edge-flow" />}
                </g>
              );
            })}
          </g>
          {history.length === 1 && positions.get(history[0].id) && (
            <g
              transform={`translate(${positions.get(history[0].id)!.x} ${positions.get(history[0].id)!.y})`}
              className="map-node-pedestal-group"
              style={{ color: LIGHT_COLOR[history[0].light] }}
              aria-hidden="true"
            >
              <circle r={44} className="map-node-pedestal" />
              <circle r={60} className="map-node-pedestal" />
            </g>
          )}
          {history.map((entry) => {
            const pos = positions.get(entry.id);
            if (!pos) return null;
            const isSelected = selected === entry.id;
            const isolated = !connected.has(entry.id);
            const radius = 10 + Math.min(entry.signals, 6);
            const color = LIGHT_COLOR[entry.light];
            return (
              <g
                key={entry.id}
                transform={`translate(${pos.x} ${pos.y})`}
                className={`map-node${isSelected ? " map-node-selected" : ""}${isolated ? " map-node-isolated" : ""}`}
                style={{ color }}
                tabIndex={0}
                role="button"
                aria-pressed={isSelected}
                aria-label={`${KIND_LABEL[entry.kind]?.[lang] ?? entry.kind} · ${describeWhen(entry.at, lang === "en" ? "en-US" : "es-MX")}`}
                onClick={() => setSelected(isSelected ? null : entry.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelected(isSelected ? null : entry.id);
                  }
                }}
              >
                <circle r={radius + 9} className="map-node-aura" />
                <circle r={radius} className="map-node-base" fill={color} />
                <g className="map-node-glyph">{glyphFor(entry.kind)}</g>
                {isSelected && <circle r={radius + 5} className="map-node-ring" />}
              </g>
            );
          })}
        </svg>
      </div>
      {history.length === 1 && (
        <p className="map-single-note">
          {lang === "en"
            ? "A single case stands at the centre. Run more analyses to see verified relationships form between them."
            : "Un único caso está en el centro. Haz más análisis para ver relaciones verificadas formarse entre ellos."}
        </p>
      )}

      {campaigns.length > 0 && (
        <div className="correlation-box">
          <div className="eyebrow">
            <ShieldAlert size={13} /> {lang === "en" ? "Campaigns detected across your history" : "Campañas detectadas en tu historial"}
          </div>
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="campaign-chip">
              <strong>{lang === "en" ? campaign.nameEn : campaign.nameEs}</strong>
              <span>{lang === "en" ? campaign.descriptionEn : campaign.descriptionEs}</span>
            </div>
          ))}
        </div>
      )}

      <div className="map-detail">
        {selectedEntry ? (
          <>
            <div className="map-detail-head">
              <strong>{KIND_LABEL[selectedEntry.kind]?.[lang] ?? selectedEntry.kind}</strong>
              <time dateTime={selectedEntry.at}>{describeWhen(selectedEntry.at, lang === "en" ? "en-US" : "es-MX")}</time>
            </div>
            <p className="history-preview">
              {selectedEntry.preview ? `«${selectedEntry.preview}»` : lang === "en" ? "No text kept." : "Sin texto conservado."}
            </p>
            {selectedEntry.topSignals.length > 0 && <p className="history-signals">{selectedEntry.topSignals.join(" · ")}</p>}
            {selectedEntry.agents.length > 0 && (
              <p className="history-meta">{selectedEntry.agents.map((id) => AGENT_NAMES[id] ?? id).join(" · ")}</p>
            )}
            {selectedEdges.length > 0 ? (
              <ul className="map-reasons">
                {selectedEdges.map((edge) => {
                  const other = edge.a === selectedEntry.id ? edge.b : edge.a;
                  const otherEntry = history.find((item) => item.id === other);
                  const reasons = lang === "en" ? edge.reasonsEn : edge.reasonsEs;
                  return (
                    <li key={other}>
                      <b>{otherEntry ? describeWhen(otherEntry.at, lang === "en" ? "en-US" : "es-MX") : other}</b> ·{" "}
                      {reasons.join(", ")}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="notice">
                {lang === "en"
                  ? "No shared domain, phone prefix or fraud pattern links this case to another one in your history."
                  : "Ningún dominio, prefijo telefónico o patrón de fraude compartido conecta este caso con otro de tu historial."}
              </p>
            )}
            {campaignsFor(selectedEntry, campaigns).map((campaign) => (
              <p className="notice" key={campaign.id}>
                {lang === "en" ? "Matches campaign:" : "Coincide con la campaña:"}{" "}
                <b>{lang === "en" ? campaign.nameEn : campaign.nameEs}</b>
              </p>
            ))}
          </>
        ) : (
          <p className="notice">
            {lang === "en"
              ? "Select a node to see its evidence and, if any, the real reasons it connects to another case."
              : "Selecciona un nodo para ver su evidencia y, si existen, los motivos reales que lo conectan con otro caso."}
          </p>
        )}
      </div>
    </div>
  );
}
