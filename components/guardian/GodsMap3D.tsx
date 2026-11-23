"use client";

/**
 * Prototipo del mapa 3D de los cinco agentes (fase evaluación, ver
 * docs/mapa-3d-dioses.md). Cinco plataformas ceremoniales mayas (geometría
 * procedural propia, sin asset externo: no existe ningún "dios maya"
 * gratuito con licencia verificable) con una figura distinta por agente.
 * Usa exactamente los mismos datos reales de fase/participación que
 * AgentOperationsBoard (lib/analysis/agentPhase.ts) — ningún estado
 * inventado. Solo se carga con ?preview3d=1; no sustituye al tablero 2D.
 */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { AGENT_NAMES, type AgentEvent, type AgentId } from "@/lib/analysis/coordinator";
import { participatedIn, phaseOf, PHASE_LABEL, type Phase } from "@/lib/analysis/agentPhase";
import type { Lang, Translate } from "@/lib/i18n";

const SPECIALISTS: AgentId[] = ["camazotz", "ixbalanque", "vucub", "hun"];

// Guardián al centro, los cuatro especialistas alrededor en círculo — el
// mismo layout conceptual que ya usa AgentOperationsBoard (components/
// AgentOperationsBoard.tsx), trasladado del lienzo 2D al plano XZ.
const LAYOUT: Record<AgentId, [number, number]> = {
  guardian: [0, 0],
  camazotz: [-1.55, -1.15],
  ixbalanque: [1.55, -1.15],
  vucub: [-1.55, 1.15],
  hun: [1.55, 1.15],
};

const AGENT_COLOR: Record<AgentId, string> = {
  camazotz: "#b18cfb",
  ixbalanque: "#3ae8e0",
  vucub: "#e3bd72",
  hun: "#4f93ff",
  guardian: "#2fd697",
};

const PHASE_INTENSITY: Record<Phase, number> = {
  idle: 0.22,
  queued: 0.45,
  started: 1,
  completed: 0.6,
  error: 0.85,
};

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Plataforma ceremonial escalonada (3 cuerpos hexagonales decrecientes). */
function Platform({ color, active, big }: { color: string; active: boolean; big: boolean }) {
  const scale = big ? 1.25 : 1;
  return (
    <group scale={scale}>
      {[0.46, 0.33, 0.2].map((radius, index) => (
        <mesh key={radius} position={[0, index * 0.07, 0]}>
          <cylinderGeometry args={[radius, radius * 1.12, 0.07, 6]} />
          <meshStandardMaterial
            color="#0d2630"
            emissive={color}
            emissiveIntensity={active ? 0.55 : 0.18}
            metalness={0.3}
            roughness={0.5}
          />
        </mesh>
      ))}
      <mesh position={[0, 0.235, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.1, 0.2, 6]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.9 : 0.35} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Núcleo geométrico distinto por agente — nunca el mismo primitivo repetido. */
function GodCore({ id, color }: { id: AgentId; color: string }) {
  switch (id) {
    case "camazotz":
      return (
        <group>
          <mesh rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.12, 0.26, 4]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[0.12 * side, 0.02, 0]} rotation={[0, 0, side * 0.5]}>
              <coneGeometry args={[0.03, 0.22, 3]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} transparent opacity={0.8} />
            </mesh>
          ))}
        </group>
      );
    case "ixbalanque":
      return (
        <mesh rotation={[0.4, 0.4, 0]}>
          <octahedronGeometry args={[0.17, 0]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} wireframe={false} />
        </mesh>
      );
    case "vucub":
      return (
        <group>
          {[0, 0.09, 0.18].map((y, index) => (
            <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.15 - index * 0.015, 0.15 - index * 0.015, 0.03, 16]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
            </mesh>
          ))}
        </group>
      );
    case "hun":
      return (
        <group>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.13, 0.03, 8, 24]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} />
          </mesh>
          <mesh rotation={[Math.PI / 2, Math.PI / 2, 0]} position={[0.1, 0, 0]}>
            <torusGeometry args={[0.1, 0.025, 8, 24]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} />
          </mesh>
        </group>
      );
    case "guardian":
    default:
      return (
        <group>
          <mesh>
            <tetrahedronGeometry args={[0.2, 0]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[0.055 * side, 0.03, 0.14]}>
              <sphereGeometry args={[0.018, 8, 8]} />
              <meshBasicMaterial color="#eafffb" />
            </mesh>
          ))}
        </group>
      );
  }
}

function GodFigure({
  id,
  color,
  active,
  selected,
  reducedMotion,
  onSelect,
}: {
  id: AgentId;
  color: string;
  active: boolean;
  selected: boolean;
  reducedMotion: boolean;
  onSelect: (id: AgentId) => void;
}) {
  const group = useRef<THREE.Group>(null);
  // Desfase determinista por agente (no Math.random: nada de aleatoriedad
  // impura durante el render), solo para que las 5 figuras no respiren
  // exactamente en fase.
  const seed = useMemo(() => (id.charCodeAt(0) % 7) * 0.9, [id]);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    if (reducedMotion) {
      g.position.y = 0.42;
      return;
    }
    const bobSpeed = active ? 2.2 : 1;
    g.position.y = 0.42 + Math.sin(t * bobSpeed + seed) * 0.03;
    g.rotation.y = t * (active ? 0.9 : 0.35);
  });

  return (
    <group
      ref={group}
      position={[0, 0.42, 0]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(id);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      <GodCore id={id} color={color} />
      {selected && (
        <mesh>
          <ringGeometry args={[0.24, 0.27, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* Sin etiqueta flotante en el lienzo: drei <Html> rompía con un error
          de desmontaje de React 19 y drei <Text> (troika) con un error de
          worker de fuentes en este bundler — ambos descartados. El nombre,
          rol y fase reales de cada agente se ven en el panel bajo el mapa
          al seleccionarlo (ver gods-map-info más abajo), no inventados aquí. */}
    </group>
  );
}

/** Conexión luminosa guardián↔especialista: solo existe si el agente de
 * verdad participó — nunca decorativa ni fija (misma regla que el tablero 2D). */
function Connection({ from, to, color, phase }: { from: [number, number]; to: [number, number]; color: string; phase: Phase }) {
  const points = useMemo(
    () => [new THREE.Vector3(from[0], 0.3, from[1]), new THREE.Vector3((from[0] + to[0]) / 2, 0.52, (from[1] + to[1]) / 2), new THREE.Vector3(to[0], 0.3, to[1])],
    [from, to],
  );
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);
  const pulse = useRef<THREE.Mesh>(null);
  const running = phase === "started";
  useFrame(({ clock }) => {
    if (!running || !pulse.current) return;
    const t = (clock.elapsedTime * 0.6) % 1;
    const p = curve.getPointAt(t);
    pulse.current.position.copy(p);
  });
  return (
    <group>
      <Line points={curve.getPoints(24)} color={color} lineWidth={1.4} transparent opacity={PHASE_INTENSITY[phase] * 0.7} />
      {running && (
        <mesh ref={pulse}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

function Scene({
  events,
  executed,
  busy,
  selected,
  setSelected,
  reducedMotion,
}: {
  events: AgentEvent[];
  executed: AgentId[];
  busy: boolean;
  selected: AgentId | null;
  setSelected: (id: AgentId) => void;
  reducedMotion: boolean;
}) {
  const guardianPhase = phaseOf(events, "guardian", busy);
  return (
    <>
      <ambientLight intensity={0.55} />
      <pointLight position={[2, 3, 2]} intensity={1.1} color="#f4b942" />
      <pointLight position={[-2, 2, -2]} intensity={0.6} color="#3ae8e0" />
      <group position={[0, -0.3, 0]}>
        <Platform color={AGENT_COLOR.guardian} active={guardianPhase !== "idle"} big />
        <GodFigure
          id="guardian"
          color={AGENT_COLOR.guardian}
          active={guardianPhase !== "idle"}
          selected={selected === "guardian"}
          reducedMotion={reducedMotion}
          onSelect={setSelected}
        />
        {SPECIALISTS.map((id) => {
          const real = participatedIn(events, executed, id);
          const [x, z] = LAYOUT[id];
          return (
            <group key={id} position={[x, 0, z]}>
              <Platform color={AGENT_COLOR[id]} active={real} big={false} />
              <GodFigure
                id={id}
                color={AGENT_COLOR[id]}
                active={real}
                selected={selected === id}
                reducedMotion={reducedMotion}
                onSelect={setSelected}
              />
            </group>
          );
        })}
        {SPECIALISTS.map((id) => {
          const real = participatedIn(events, executed, id);
          if (!real) return null;
          const phase = phaseOf(events, id, busy);
          return <Connection key={id} from={LAYOUT.guardian} to={LAYOUT[id]} color={AGENT_COLOR[id]} phase={phase} />;
        })}
      </group>
    </>
  );
}

export default function GodsMap3D({
  events,
  executed,
  busy,
  lang,
  t,
}: {
  events: AgentEvent[];
  executed: AgentId[];
  busy: boolean;
  lang: Lang;
  t: Translate;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);
  const [reducedMotion] = useState(prefersReducedMotion);
  const [selected, setSelected] = useState<AgentId | null>(null);

  useEffect(() => {
    const element = host.current;
    if (!element || typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting && !document.hidden), { threshold: 0.08 });
    observer.observe(element);
    const onVisibility = () => setActive(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const selectedPhase = selected ? phaseOf(events, selected, busy) : null;
  const selectedRecord = selected ? events.filter((event) => event.agent === selected).at(-1) : undefined;

  return (
    <div className="gods-map-3d-wrap">
      <div ref={host} className="gods-map-3d" role="img" aria-label={lang === "en" ? "3D map of the five agents" : "Mapa 3D de los cinco agentes"}>
        <Canvas
          frameloop={active ? "always" : "never"}
          dpr={[1, 1.5]}
          gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
          camera={{ position: [0, 3.1, 3.6], fov: 42 }}
          onPointerMissed={() => setSelected(null)}
        >
          <Suspense fallback={null}>
            <Scene events={events} executed={executed} busy={busy} selected={selected} setSelected={setSelected} reducedMotion={reducedMotion} />
          </Suspense>
          <OrbitControls
            enablePan={false}
            minDistance={2.6}
            maxDistance={6.5}
            minPolarAngle={0.55}
            maxPolarAngle={1.3}
            enableDamping
            dampingFactor={0.08}
          />
        </Canvas>
      </div>
      <div className="gods-map-info" aria-live="polite">
        {selected && selectedPhase ? (
          <>
            <strong>{AGENT_NAMES[selected]}</strong>
            <span className="role">{t("agents", `${selected}Role` as "camazotzRole")}</span>
            <p>{t("agents", `${selected}Description` as "camazotzDescription")}</p>
            <div className="gods-map-info-phase">
              {PHASE_LABEL[selectedPhase][lang]}
              {selectedRecord?.elapsedMs !== undefined && <small> · {selectedRecord.elapsedMs.toFixed(1)} ms</small>}
            </div>
          </>
        ) : (
          <p className="muted">
            {lang === "en" ? "Tap or click a platform to see that agent's real status." : "Toca o haz clic en una plataforma para ver el estado real de ese agente."}
          </p>
        )}
      </div>
    </div>
  );
}
