"use client";
import { useMemo, useRef, useState } from "react";
import { Crosshair, Maximize2, Minus, Network, Plus, RotateCcw, ShieldAlert } from "lucide-react";
import type { HistoryEntry } from "@/lib/history";
import { describeWhen } from "@/lib/history";
import { correlateIncidents, detectCampaigns, type CampaignMatch } from "@/lib/analysis/correlation";
import { AGENT_NAMES } from "@/lib/analysis/coordinator";
import type { Lang } from "@/lib/i18n";

/**
 * Mapa de relaciones entre investigaciones: centro de inteligencia visual
 * respaldado estrictamente por `correlateIncidents` y el historial real de la
 * sesión. Ningún nodo, enlace o métrica se inventa.
 */

type Light = HistoryEntry["light"];

const LIGHT_COLOR: Record<Light, string> = {
  rojo: "#f43f5e",
  amarillo: "#fbbf24",
  verde: "#34d399",
  gris: "#64748b",
};

const LIGHT_LABEL: Record<Light, { es: string; en: string }> = {
  rojo: { es: "Riesgo alto", en: "High risk" },
  amarillo: { es: "Precaución", en: "Caution" },
  verde: { es: "Bajo (IA)", en: "Low (AI)" },
  gris: { es: "No concluyente", en: "Inconclusive" },
};

const KIND_LABEL: Record<string, { es: string; en: string }> = {
  message: { es: "Mensaje", en: "Message" },
  url: { es: "Enlace", en: "Link" },
  transcripcion: { es: "Llamada", en: "Call" },
  financiero: { es: "Dinero", en: "Money" },
};

type Edge = { a: string; b: string; reasonsEs: string[]; reasonsEn: string[] };

function glyphFor(kind: string) {
  switch (kind) {
    case "url":
      return (
        <>
          <circle cx="-3.5" cy="-2" r="3.4" />
          <circle cx="3.5" cy="2" r="3.4" />
        </>
      );
    case "transcripcion":
      return <path d="M-7 1 C-7 -4 -3 -4 -3 1 C-3 6 1 6 1 1 C1 -4 5 -4 5 1" />;
    case "financiero":
      return (
        <>
          <circle cx="0" cy="0" r="5.2" />
          <path d="M0 -2.6 L0 2.6 M-2 -1.2 L2 1.2 M-2 1.2 L2 -1.2" />
        </>
      );
    default:
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

function campaignsFor(entry: HistoryEntry, campaigns: CampaignMatch[]): CampaignMatch[] {
  const signals = new Set(entry.signalIds ?? []);
  return campaigns.filter((c) => c.matchedSignals.some((id) => signals.has(id)));
}

const SIZE = 460;
const CENTER = SIZE / 2;

export default function InvestigationMap({ history, lang }: { history: HistoryEntry[]; lang: Lang }) {
  const [selectedRaw, setSelected] = useState<string | null>(null);
  const [lightFilter, setLightFilter] = useState<Light | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const { edges, campaigns } = useMemo(() => buildGraph(history), [history]);
  const connected = useMemo(() => new Set(edges.flatMap((edge) => [edge.a, edge.b])), [edges]);
  const selected = selectedRaw ?? (history.length === 1 ? history[0].id : null);

  // Distribución dinámica: casos conectados forman una constelación interior;
  // casos aislados orbitan en el anillo exterior sin inventar cercanía.
  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    if (history.length === 1) {
      map.set(history[0].id, { x: CENTER, y: CENTER });
      return map;
    }
    const inner = history.filter((e) => connected.has(e.id));
    const outer = history.filter((e) => !connected.has(e.id));
    const innerRadius = inner.length <= 2 ? 95 : 118;
    const outerRadius = 176;
    inner.forEach((entry, idx) => {
      const angle = (idx / Math.max(inner.length, 1)) * Math.PI * 2 - Math.PI / 2;
      map.set(entry.id, {
        x: CENTER + Math.cos(angle) * innerRadius,
        y: CENTER + Math.sin(angle) * innerRadius,
      });
    });
    outer.forEach((entry, idx) => {
      const angle = (idx / Math.max(outer.length, 1)) * Math.PI * 2 - Math.PI / 3;
      map.set(entry.id, {
        x: CENTER + Math.cos(angle) * outerRadius,
        y: CENTER + Math.sin(angle) * outerRadius,
      });
    });
    return map;
  }, [history, connected]);

  const lightCounts = useMemo(() => {
    const counts: Record<Light, number> = { rojo: 0, amarillo: 0, verde: 0, gris: 0 };
    for (const entry of history) counts[entry.light] += 1;
    return counts;
  }, [history]);

  const selectedEntry = history.find((entry) => entry.id === selected) ?? null;
  const selectedEdges = selected ? edges.filter((edge) => edge.a === selected || edge.b === selected) : [];

  if (history.length === 0) {
    return (
      <div className="map-empty-state">
        <div className="empty-row">
          <div className="empty-icon">
            <Network size={22} />
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
        <div className="map-empty-guide">
          <div>
            <b>01</b>
            <span>{lang === "en" ? "Open New analysis and paste a message or link." : "Abre Nuevo análisis y pega un mensaje o enlace."}</span>
          </div>
          <div>
            <b>02</b>
            <span>{lang === "en" ? "Run a second case with a shared domain or pattern." : "Analiza un segundo caso con dominio o patrón compartido."}</span>
          </div>
          <div>
            <b>03</b>
            <span>{lang === "en" ? "Verified relationships connect automatically here." : "Las relaciones reales aparecerán conectadas aquí."}</span>
          </div>
        </div>
      </div>
    );
  }

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="investigation-map">
      <div className="map-stats-grid" aria-label={lang === "en" ? "Investigation counters" : "Contadores de investigaciones"}>
        <div className="map-stat-card">
          <small>{lang === "en" ? "CASES" : "CASOS"}</small>
          <strong>{history.length}</strong>
        </div>
        <div className="map-stat-card">
          <small>{lang === "en" ? "RELATIONS" : "RELACIONES"}</small>
          <strong>{edges.length}</strong>
        </div>
        <div className="map-stat-card">
          <small>{lang === "en" ? "CONNECTED" : "CONECTADOS"}</small>
          <strong>{connected.size}</strong>
        </div>
        <div className="map-stat-card">
          <small>{lang === "en" ? "CAMPAIGNS" : "CAMPAÑAS"}</small>
          <strong>{campaigns.length}</strong>
        </div>
      </div>

      <div className="map-hud-bar">
        <div className="map-legend" role="group" aria-label={lang === "en" ? "Risk level legend" : "Leyenda de riesgo"}>
          {(["rojo", "amarillo", "verde", "gris"] as Light[]).map((light) => {
            const active = lightFilter === light;
            return (
              <button
                key={light}
                type="button"
                className={`map-legend-pill${active ? " active" : ""}`}
                onClick={() => setLightFilter(active ? null : light)}
                aria-pressed={active}
              >
                <span className="map-legend-dot" style={{ background: LIGHT_COLOR[light] }} />
                {LIGHT_LABEL[light][lang]} ({lightCounts[light]})
              </button>
            );
          })}
        </div>

        <div className="map-zoom-controls" role="group" aria-label={lang === "en" ? "Map zoom controls" : "Controles de zoom del mapa"}>
          <button
            type="button"
            className="map-zoom-btn"
            onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.2).toFixed(2)))}
            aria-label={lang === "en" ? "Zoom out" : "Alejar mapa"}
          >
            <Minus size={14} />
          </button>
          <span className="map-zoom-readout">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="map-zoom-btn"
            onClick={() => setZoom((z) => Math.min(2.2, +(z + 0.2).toFixed(2)))}
            aria-label={lang === "en" ? "Zoom in" : "Acercar mapa"}
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            className="map-zoom-btn"
            onClick={resetView}
            aria-label={lang === "en" ? "Reset map view" : "Restablecer vista"}
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      <div
        className="map-canvas"
        onPointerDown={(e) => {
          if ((e.target as Element).closest(".map-node")) return;
          dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y };
        }}
        onPointerMove={(e) => {
          const d = dragRef.current;
          if (!d) return;
          setPan({ x: d.origX + (e.clientX - d.startX), y: d.origY + (e.clientY - d.startY) });
        }}
        onPointerUp={() => { dragRef.current = null; }}
        onPointerLeave={() => { dragRef.current = null; }}
      >
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={lang === "en" ? "Investigation relationship map" : "Mapa de relaciones entre investigaciones"}
        >
          <g transform={`translate(${CENTER + pan.x} ${CENTER + pan.y}) scale(${zoom}) translate(${-CENTER} ${-CENTER})`}>
            {/* Anillos de radar Maya de fondo */}
            <circle cx={CENTER} cy={CENTER} r={118} className="map-radar-ring" />
            <circle cx={CENTER} cy={CENTER} r={176} className="map-radar-ring" />

            <g className="map-edges">
              {edges.map((edge) => {
                const a = positions.get(edge.a);
                const b = positions.get(edge.b);
                if (!a || !b) return null;
                const active = selected === edge.a || selected === edge.b;
                return (
                  <g key={`${edge.a}-${edge.b}`}>
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`map-edge${active ? " map-edge-active" : ""}`} />
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
                <circle r={64} className="map-node-pedestal" />
              </g>
            )}

            {history.map((entry) => {
              const pos = positions.get(entry.id);
              if (!pos) return null;
              const isSelected = selected === entry.id;
              const isolated = !connected.has(entry.id);
              const dimmed = Boolean(lightFilter && entry.light !== lightFilter);
              const radius = 12 + Math.min(entry.signals, 7);
              const color = LIGHT_COLOR[entry.light];
              return (
                <g
                  key={entry.id}
                  transform={`translate(${pos.x} ${pos.y})`}
                  className={`map-node${isSelected ? " map-node-selected" : ""}${isolated ? " map-node-isolated" : ""}${dimmed ? " map-node-dimmed" : ""}`}
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
                  <circle r={radius + 10} className="map-node-aura" />
                  <circle r={radius} className="map-node-base" fill={color} />
                  <g className="map-node-glyph">{glyphFor(entry.kind)}</g>
                  {isSelected && <circle r={radius + 5} className="map-node-ring" />}
                  <text y={radius + 18} textAnchor="middle" className="map-node-caption">
                    {KIND_LABEL[entry.kind]?.[lang] ?? entry.kind}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {history.length === 1 && (
        <p className="map-single-note">
          <Crosshair size={13} />{" "}
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
              <div>
                <span className="map-detail-badge" style={{ borderColor: LIGHT_COLOR[selectedEntry.light], color: LIGHT_COLOR[selectedEntry.light] }}>
                  {LIGHT_LABEL[selectedEntry.light][lang]}
                </span>{" "}
                <strong>{KIND_LABEL[selectedEntry.kind]?.[lang] ?? selectedEntry.kind}</strong>
              </div>
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
            <Maximize2 size={13} />{" "}
            {lang === "en"
              ? "Drag to pan, zoom in/out, or select a node to see its real evidence and verified links."
              : "Arrastra para desplazar, usa el zoom o selecciona un nodo para ver su evidencia y conexiones reales."}
          </p>
        )}
      </div>
    </div>
  );
}
