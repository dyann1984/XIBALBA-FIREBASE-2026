"use client";

/**
 * Mapa 3D de los cinco agentes (fase 4, ver docs/mapa-3d-dioses.md). Cinco
 * personajes humanoides procedurales (geometría propia, sin asset externo:
 * no existe ningún "dios maya" gratuito con licencia verificable) sobre
 * plataformas ceremoniales mayas, con un templo central monumental para EL
 * GUARDIÁN. Usa exactamente los mismos datos reales de fase/participación
 * que AgentOperationsBoard (lib/analysis/agentPhase.ts) — ningún estado
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

function isLowDetailViewport() {
  return typeof window !== "undefined" && window.innerWidth < 640;
}

/**
 * Geometrías "unitarias" (radio/alto 1) creadas una sola vez a nivel de
 * módulo y reutilizadas por los cinco personajes vía `scale`, en vez de que
 * cada parte del cuerpo instancie su propia geometría — menos buffers en la
 * GPU, mismo resultado visual (objetivo 4, "reutiliza geometrías").
 */
const unitSphere = new THREE.SphereGeometry(1, 12, 10);
const unitHalfDome = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
const unitCone = new THREE.ConeGeometry(1, 1, 8);
const unitCapsule = new THREE.CapsuleGeometry(1, 1, 4, 8);
const unitTorus = new THREE.TorusGeometry(1, 0.32, 8, 20);
const unitOcta = new THREE.OctahedronGeometry(1, 0);
const unitBox = new THREE.BoxGeometry(1, 1, 1);

/** Material oscuro de máscara/sombra, compartido por los cinco personajes
 * (no depende del color del agente, así que una sola instancia alcanza). */
const maskMaterial = new THREE.MeshStandardMaterial({
  color: "#0b141c",
  roughness: 0.55,
  metalness: 0.2,
  transparent: true,
  opacity: 0.92,
});
/** Puntos de luz (ojos, símbolos pequeños), también compartido. */
const glowDotMaterial = new THREE.MeshBasicMaterial({ color: "#eafffb" });

/** Parte de personaje: geometría y material SIEMPRE son la instancia
 * compartida que se les pasa (nunca se crean dentro de este componente). */
function Part({
  geometry,
  material,
  position,
  rotation,
  scale,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale: [number, number, number] | number;
}) {
  return <mesh geometry={geometry} material={material} position={position} rotation={rotation} scale={scale} />;
}

type BodyParts = {
  body: THREE.Material;
};

/** Esqueleto humanoide común a los cinco personajes: piernas, torso, brazos
 * y cabeza — nunca un primitivo suelto flotando sobre la plataforma. Cada
 * agente decora este esqueleto con máscara/tocado/símbolos distintos. */
function HumanoidBase({ body, torsoScale = [1, 1, 1] as [number, number, number] }: BodyParts & { torsoScale?: [number, number, number] }) {
  return (
    <group>
      <Part geometry={unitCapsule} material={body} position={[-0.045, -0.15, 0]} scale={[0.04, 0.16, 0.04]} />
      <Part geometry={unitCapsule} material={body} position={[0.045, -0.15, 0]} scale={[0.04, 0.16, 0.04]} />
      <Part geometry={unitCapsule} material={body} position={[0, 0.02, 0]} scale={[0.075 * torsoScale[0], 0.16 * torsoScale[1], 0.075 * torsoScale[2]]} />
      <Part geometry={unitCapsule} material={body} position={[-0.1, 0.06, 0]} rotation={[0, 0, 0.45]} scale={[0.032, 0.12, 0.032]} />
      <Part geometry={unitCapsule} material={body} position={[0.1, 0.06, 0]} rotation={[0, 0, -0.45]} scale={[0.032, 0.12, 0.032]} />
      <Part geometry={unitSphere} material={body} position={[0, 0.18, 0]} scale={[0.058, 0.058, 0.058]} />
    </group>
  );
}

function EyeDots({ y = 0.18, spread = 0.02, z = 0.05 }: { y?: number; spread?: number; z?: number }) {
  return (
    <>
      <Part geometry={unitSphere} material={glowDotMaterial} position={[-spread, y, z]} scale={[0.008, 0.008, 0.008]} />
      <Part geometry={unitSphere} material={glowDotMaterial} position={[spread, y, z]} scale={[0.008, 0.008, 0.008]} />
    </>
  );
}

/** CAMAZOTZ — deidad murciélago: orejas puntiagudas, hocico y alas
 * membranosas abiertas desde los hombros. */
function CamazotzFigure({ body, wingRef }: BodyParts & { wingRef: (group: THREE.Group | null) => void }) {
  return (
    <group>
      <HumanoidBase body={body} />
      <Part geometry={unitCone} material={body} position={[-0.028, 0.225, 0.01]} rotation={[0, 0, 0.35]} scale={[0.016, 0.045, 0.016]} />
      <Part geometry={unitCone} material={body} position={[0.028, 0.225, 0.01]} rotation={[0, 0, -0.35]} scale={[0.016, 0.045, 0.016]} />
      <Part geometry={unitCone} material={maskMaterial} position={[0, 0.16, 0.05]} rotation={[Math.PI / 2, 0, 0]} scale={[0.022, 0.035, 0.022]} />
      <EyeDots y={0.185} z={0.05} />
      <group ref={wingRef} position={[-0.11, 0.08, -0.01]}>
        <Part geometry={unitOcta} material={body} position={[-0.06, 0, 0]} rotation={[0, 0, 0.5]} scale={[0.14, 0.1, 0.015]} />
      </group>
      <group ref={wingRef} position={[0.11, 0.08, -0.01]}>
        <Part geometry={unitOcta} material={body} position={[0.06, 0, 0]} rotation={[0, 0, -0.5]} scale={[0.14, 0.1, 0.015]} />
      </group>
    </group>
  );
}

/** IXBALANQUÉ — héroe gemelo: tocado de cinco plumas en abanico y un
 * emblema de pecho (nunca el mismo octaedro suelto de antes). */
function IxbalanqueFigure({ body }: BodyParts) {
  const feathers = [-0.55, -0.27, 0, 0.27, 0.55];
  return (
    <group>
      <HumanoidBase body={body} />
      <EyeDots y={0.185} z={0.052} />
      {feathers.map((angle, index) => (
        <Part
          key={angle}
          geometry={unitCone}
          material={body}
          position={[Math.sin(angle) * 0.03, 0.235 + Math.cos(angle) * 0.015 + (index === 2 ? 0.015 : 0), -0.01 - Math.abs(angle) * 0.01]}
          rotation={[0.25, 0, angle]}
          scale={[0.01, 0.065 - Math.abs(angle) * 0.03, 0.01]}
        />
      ))}
      <Part geometry={unitOcta} material={body} position={[0, 0.03, 0.058]} rotation={[0.3, 0, 0]} scale={[0.028, 0.028, 0.012]} />
    </group>
  );
}

/** VUCUB CAMÉ — señor del inframundo: máscara ósea plana con cuencas
 * hundidas y pequeñas púas en los hombros, torso inclinado hacia delante. */
function VucubFigure({ body }: BodyParts) {
  return (
    <group rotation={[0.12, 0, 0]}>
      <HumanoidBase body={body} />
      <Part geometry={unitHalfDome} material={maskMaterial} position={[0, 0.16, 0.015]} rotation={[Math.PI * 1.02, 0, 0]} scale={[0.07, 0.065, 0.05]} />
      <Part geometry={unitSphere} material={maskMaterial} position={[-0.022, 0.182, 0.045]} scale={[0.016, 0.014, 0.008]} />
      <Part geometry={unitSphere} material={maskMaterial} position={[0.022, 0.182, 0.045]} scale={[0.016, 0.014, 0.008]} />
      <EyeDots y={0.182} spread={0.022} z={0.05} />
      {[-0.09, 0.09].map((x) => (
        <Part key={x} geometry={unitCone} material={body} position={[x, 0.1, 0]} rotation={[0, 0, x > 0 ? -0.6 : 0.6]} scale={[0.012, 0.03, 0.012]} />
      ))}
    </group>
  );
}

/** HUN CAMÉ — soberano del inframundo: corona de tres picos, máscara ósea y
 * una capa plana (más imponente que su hermano Vucub Camé). */
function HunCameFigure({ body }: BodyParts) {
  return (
    <group>
      <HumanoidBase body={body} torsoScale={[1.05, 1, 1.05]} />
      <Part geometry={unitHalfDome} material={maskMaterial} position={[0, 0.165, 0.015]} rotation={[Math.PI * 1.02, 0, 0]} scale={[0.072, 0.066, 0.05]} />
      <Part geometry={unitSphere} material={maskMaterial} position={[-0.023, 0.185, 0.046]} scale={[0.017, 0.015, 0.008]} />
      <Part geometry={unitSphere} material={maskMaterial} position={[0.023, 0.185, 0.046]} scale={[0.017, 0.015, 0.008]} />
      <EyeDots y={0.185} spread={0.023} z={0.051} />
      <Part geometry={unitCone} material={body} position={[0, 0.27, -0.005]} scale={[0.02, 0.07, 0.02]} />
      <Part geometry={unitCone} material={body} position={[-0.035, 0.25, -0.01]} rotation={[0, 0, 0.4]} scale={[0.014, 0.05, 0.014]} />
      <Part geometry={unitCone} material={body} position={[0.035, 0.25, -0.01]} rotation={[0, 0, -0.4]} scale={[0.014, 0.05, 0.014]} />
      <Part geometry={unitBox} material={body} position={[0, 0.0, -0.065]} rotation={[0.15, 0, 0]} scale={[0.13, 0.22, 0.01]} />
    </group>
  );
}

/** EL GUARDIÁN — figura protectora con armadura ceremonial: torso más
 * ancho, hombreras, emblema circular y una sola cresta alta al centro. */
function GuardianFigure({ body }: BodyParts) {
  return (
    <group>
      <HumanoidBase body={body} torsoScale={[1.2, 1.05, 1.2]} />
      <EyeDots y={0.185} spread={0.021} z={0.054} />
      <Part geometry={unitSphere} material={body} position={[-0.115, 0.1, 0]} scale={[0.028, 0.022, 0.028]} />
      <Part geometry={unitSphere} material={body} position={[0.115, 0.1, 0]} scale={[0.028, 0.022, 0.028]} />
      <Part geometry={unitTorus} material={glowDotMaterial} position={[0, 0.03, 0.06]} rotation={[Math.PI / 2, 0, 0]} scale={[0.026, 0.026, 0.01]} />
      <Part geometry={unitCone} material={body} position={[0, 0.27, 0]} scale={[0.012, 0.08, 0.03]} />
    </group>
  );
}

/** Núcleo geométrico distinto por agente — personajes con cabeza/máscara,
 * torso, extremidades, tocado y símbolo propio, nunca un primitivo suelto. */
function GodCore({ id, body, wingRef }: { id: AgentId; body: THREE.Material; wingRef: (group: THREE.Group | null) => void }) {
  switch (id) {
    case "camazotz":
      return <CamazotzFigure body={body} wingRef={wingRef} />;
    case "ixbalanque":
      return <IxbalanqueFigure body={body} />;
    case "vucub":
      return <VucubFigure body={body} />;
    case "hun":
      return <HunCameFigure body={body} />;
    case "guardian":
    default:
      return <GuardianFigure body={body} />;
  }
}

/** Plataforma ceremonial escalonada. La del GUARDIÁN es un templo
 * monumental (más escalones y una cresta luminosa); las de los
 * especialistas son pedestales iguales en forma pero con el glifo de su
 * propio color en la cúspide — diferenciadas por personaje, no solo por
 * tinte. */
function Platform({ color, active, big, lowDetail }: { color: string; active: boolean; big: boolean; lowDetail: boolean }) {
  const scale = big ? 1.3 : 1;
  const steps = big ? (lowDetail ? 4 : 5) : lowDetail ? 2 : 3;
  const radii = Array.from({ length: steps }, (_, index) => 0.48 - index * (0.48 / (steps + 1)));
  return (
    <group scale={scale}>
      {radii.map((radius, index) => (
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
      {/* El anillo va justo sobre el último escalón, a la altura de los
          pies del personaje (nunca más arriba): al escalar la plataforma
          del templo monumental 1.3x, un anillo colocado "un escalón por
          encima" terminaba casi a la altura de la cabeza, compitiendo con
          la figura y volviéndola un borrón indistinguible. */}
      <mesh position={[0, (steps - 1) * 0.07 + 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.1, 0.2, 6]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.9 : 0.35} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function GodFigure({
  id,
  color,
  active,
  selected,
  reducedMotion,
  lowDetail,
  onSelect,
}: {
  id: AgentId;
  color: string;
  active: boolean;
  selected: boolean;
  reducedMotion: boolean;
  lowDetail: boolean;
  onSelect: (id: AgentId) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const wings = useRef<THREE.Group[]>([]);
  // Desfase determinista por agente (no Math.random: nada de aleatoriedad
  // impura durante el render), solo para que las 5 figuras no respiren
  // exactamente en fase.
  const seed = useMemo(() => (id.charCodeAt(0) % 7) * 0.9, [id]);
  const body = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.55,
        transparent: true,
        opacity: 0.86,
        roughness: 0.35,
        metalness: 0.3,
      }),
    [color],
  );
  useEffect(() => () => body.dispose(), [body]);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    if (reducedMotion) {
      g.position.y = 0.42;
    } else {
      const bobSpeed = active ? 2.2 : 1;
      g.position.y = 0.42 + Math.sin(t * bobSpeed + seed) * 0.03;
      g.rotation.y = t * (active ? 0.9 : 0.35);
    }
    if (!reducedMotion && !lowDetail && id === "camazotz") {
      const flap = Math.sin(t * (active ? 5 : 2) + seed) * (active ? 0.35 : 0.14);
      wings.current.forEach((wing, index) => {
        if (wing) wing.rotation.z = (index === 0 ? 1 : -1) * (0.5 + flap);
      });
    }
  });

  const registerWing = (wingGroup: THREE.Group | null) => {
    if (!wingGroup) return;
    if (!wings.current.includes(wingGroup)) wings.current.push(wingGroup);
  };

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
      {/* Blanco de clic/toque invisible, más grande que la figura: sin esto,
          la animación de "respiración" hace que la figura real se mueva
          bajo el dedo y la selección en móvil falla la mayoría de las veces. */}
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 0.6, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <GodCore id={id} body={body} wingRef={registerWing} />
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
      <Line points={curve.getPoints(24)} color={color} lineWidth={2} transparent opacity={PHASE_INTENSITY[phase] * 0.75} />
      {running && (
        <mesh ref={pulse}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

/** Campo de partículas disperso para dar profundidad al fondo de la escena
 * (objetivo 3, "fondo ambiental con profundidad") — geometría generada una
 * vez, sin interacción, apagado en móvil por rendimiento. */
function AmbientParticles({ count }: { count: number }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      // Distribución determinista (no Math.random en render de React: esto
      // corre una sola vez dentro de useMemo, fuera del ciclo de render).
      const angle = (i / count) * Math.PI * 2 * 3.1;
      const radius = 1.6 + ((i * 37) % 100) / 100;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = ((i * 53) % 100) / 100 - 0.2;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <points geometry={geometry}>
      <pointsMaterial color="#3ae8e0" size={0.02} transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function Scene({
  events,
  executed,
  busy,
  selected,
  setSelected,
  reducedMotion,
  lowDetail,
}: {
  events: AgentEvent[];
  executed: AgentId[];
  busy: boolean;
  selected: AgentId | null;
  setSelected: (id: AgentId) => void;
  reducedMotion: boolean;
  lowDetail: boolean;
}) {
  const guardianPhase = phaseOf(events, "guardian", busy);
  const frames = useRef(0);
  const lastLog = useRef(0);
  useFrame(({ clock }) => {
    if (process.env.NODE_ENV === "production") return;
    frames.current += 1;
    const t = clock.elapsedTime;
    if (t - lastLog.current >= 2) {
      // Diagnóstico de desarrollo únicamente (objetivo 4, "mide FPS cuando
      // sea técnicamente posible") — nunca una UI de producción.
      console.info(`[GodsMap3D] ~${Math.round(frames.current / (t - lastLog.current))} fps`);
      frames.current = 0;
      lastLog.current = t;
    }
  });
  return (
    <>
      <ambientLight intensity={0.55} />
      <pointLight position={[2, 3, 2]} intensity={1.1} color="#f4b942" />
      <pointLight position={[-2, 2, -2]} intensity={0.6} color="#3ae8e0" />
      {!lowDetail && <AmbientParticles count={70} />}
      <group position={[0, -0.3, 0]}>
        <Platform color={AGENT_COLOR.guardian} active={guardianPhase !== "idle"} big lowDetail={lowDetail} />
        <GodFigure
          id="guardian"
          color={AGENT_COLOR.guardian}
          active={guardianPhase !== "idle"}
          selected={selected === "guardian"}
          reducedMotion={reducedMotion}
          lowDetail={lowDetail}
          onSelect={setSelected}
        />
        {SPECIALISTS.map((id) => {
          const real = participatedIn(events, executed, id);
          const [x, z] = LAYOUT[id];
          return (
            <group key={id} position={[x, 0, z]}>
              <Platform color={AGENT_COLOR[id]} active={real} big={false} lowDetail={lowDetail} />
              <GodFigure
                id={id}
                color={AGENT_COLOR[id]}
                active={real}
                selected={selected === id}
                reducedMotion={reducedMotion}
                lowDetail={lowDetail}
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
  const [lowDetail] = useState(isLowDetailViewport);
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
          dpr={[1, lowDetail ? 1 : 1.5]}
          gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
          camera={{ position: [0, 3.0, 3.5], fov: 38 }}
          onPointerMissed={() => setSelected(null)}
        >
          <Suspense fallback={null}>
            <Scene events={events} executed={executed} busy={busy} selected={selected} setSelected={setSelected} reducedMotion={reducedMotion} lowDetail={lowDetail} />
          </Suspense>
          <OrbitControls
            enablePan={false}
            minDistance={2.6}
            maxDistance={6.5}
            minPolarAngle={0.65}
            maxPolarAngle={1.15}
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
