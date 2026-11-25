"use client";

/**
 * Centro de operaciones maya futurista tridimensional (MAPA 2).
 * Cinco deidades/agentes en templos ceremoniales escalonados con grabados
 * geométricos dorados, iluminación holográfica cian y conexiones energéticas
 * vinculadas exclusivamente a la participación y fases reales del análisis.
 */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Eye, Maximize2, Minimize2 } from "lucide-react";
import { AGENT_NAMES, type AgentEvent, type AgentId } from "@/lib/analysis/coordinator";
import { participatedIn, phaseOf, PHASE_LABEL, type Phase } from "@/lib/analysis/agentPhase";
import type { Lang, Translate } from "@/lib/i18n";
import { detectGraphicsQuality, dprRangeFor, type GraphicsQuality } from "@/lib/graphicsQuality";

const SPECIALISTS: AgentId[] = ["camazotz", "ixbalanque", "vucub", "hun"];
const ALL_AGENTS: AgentId[] = ["guardian", ...SPECIALISTS];

// Encuadre compacto para que los 5 templos queden íntegros dentro del campo de
// visión inicial tanto en escritorio como en móvil sin recortes.
const LAYOUT: Record<AgentId, [number, number]> = {
  guardian: [0, 0],
  camazotz: [-1.36, -1.0],
  ixbalanque: [1.36, -1.0],
  vucub: [-1.36, 1.0],
  hun: [1.36, 1.0],
};

const AGENT_COLOR: Record<AgentId, string> = {
  camazotz: "#b18cfb",
  ixbalanque: "#3ae8e0",
  vucub: "#e3bd72",
  hun: "#4f93ff",
  guardian: "#2fd697",
};

const PHASE_INTENSITY: Record<Phase, number> = {
  idle: 0.25,
  queued: 0.5,
  started: 1,
  completed: 0.68,
  error: 0.9,
};

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Geometrías unitarias compartidas a nivel de módulo para mantener 60 FPS.
const unitSphere = new THREE.SphereGeometry(1, 12, 10);
const unitHalfDome = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
const unitCone = new THREE.ConeGeometry(1, 1, 8);
const unitCapsule = new THREE.CapsuleGeometry(1, 1, 4, 8);
const unitTorus = new THREE.TorusGeometry(1, 0.28, 8, 24);
const unitOcta = new THREE.OctahedronGeometry(1, 0);
const unitBox = new THREE.BoxGeometry(1, 1, 1);

const obsidianMaterial = new THREE.MeshStandardMaterial({
  color: "#091821",
  roughness: 0.52,
  metalness: 0.45,
});

const goldTrimMaterial = new THREE.MeshStandardMaterial({
  color: "#f4b942",
  emissive: "#f4b942",
  emissiveIntensity: 0.25,
  roughness: 0.3,
  metalness: 0.8,
});

const maskMaterial = new THREE.MeshStandardMaterial({
  color: "#0b141c",
  roughness: 0.5,
  metalness: 0.3,
  transparent: true,
  opacity: 0.94,
});

const glowDotMaterial = new THREE.MeshBasicMaterial({ color: "#eafffb" });

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

type BodyParts = { body: THREE.Material };

function HumanoidBase({ body, torsoScale = [1, 1, 1] }: BodyParts & { torsoScale?: [number, number, number] }) {
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
      <Part geometry={unitSphere} material={glowDotMaterial} position={[-spread, y, z]} scale={[0.0085, 0.0085, 0.0085]} />
      <Part geometry={unitSphere} material={glowDotMaterial} position={[spread, y, z]} scale={[0.0085, 0.0085, 0.0085]} />
    </>
  );
}

function CamazotzFigure({ body, wingRef }: BodyParts & { wingRef: (group: THREE.Group | null) => void }) {
  return (
    <group>
      <HumanoidBase body={body} />
      <Part geometry={unitCone} material={body} position={[-0.028, 0.225, 0.01]} rotation={[0, 0, 0.35]} scale={[0.016, 0.048, 0.016]} />
      <Part geometry={unitCone} material={body} position={[0.028, 0.225, 0.01]} rotation={[0, 0, -0.35]} scale={[0.016, 0.048, 0.016]} />
      <Part geometry={unitCone} material={maskMaterial} position={[0, 0.16, 0.05]} rotation={[Math.PI / 2, 0, 0]} scale={[0.022, 0.035, 0.022]} />
      <Part geometry={unitTorus} material={goldTrimMaterial} position={[0, 0.06, 0.04]} rotation={[Math.PI / 2, 0, 0]} scale={[0.035, 0.035, 0.015]} />
      <EyeDots y={0.185} z={0.05} />
      <group ref={wingRef} position={[-0.11, 0.08, -0.01]}>
        <Part geometry={unitOcta} material={body} position={[-0.065, 0, 0]} rotation={[0, 0, 0.5]} scale={[0.15, 0.11, 0.015]} />
      </group>
      <group ref={wingRef} position={[0.11, 0.08, -0.01]}>
        <Part geometry={unitOcta} material={body} position={[0.065, 0, 0]} rotation={[0, 0, -0.5]} scale={[0.15, 0.11, 0.015]} />
      </group>
    </group>
  );
}

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
          material={index === 2 ? goldTrimMaterial : body}
          position={[Math.sin(angle) * 0.03, 0.235 + Math.cos(angle) * 0.015 + (index === 2 ? 0.015 : 0), -0.01 - Math.abs(angle) * 0.01]}
          rotation={[0.25, 0, angle]}
          scale={[0.011, 0.068 - Math.abs(angle) * 0.03, 0.011]}
        />
      ))}
      <Part geometry={unitOcta} material={goldTrimMaterial} position={[0, 0.03, 0.058]} rotation={[0.3, 0, 0]} scale={[0.028, 0.028, 0.012]} />
    </group>
  );
}

function VucubFigure({ body }: BodyParts) {
  return (
    <group rotation={[0.1, 0, 0]}>
      <HumanoidBase body={body} />
      <Part geometry={unitHalfDome} material={maskMaterial} position={[0, 0.16, 0.015]} rotation={[Math.PI * 1.02, 0, 0]} scale={[0.07, 0.065, 0.05]} />
      <Part geometry={unitSphere} material={maskMaterial} position={[-0.022, 0.182, 0.045]} scale={[0.016, 0.014, 0.008]} />
      <Part geometry={unitSphere} material={maskMaterial} position={[0.022, 0.182, 0.045]} scale={[0.016, 0.014, 0.008]} />
      <EyeDots y={0.182} spread={0.022} z={0.05} />
      {[-0.095, 0.095].map((x) => (
        <Part key={x} geometry={unitCone} material={goldTrimMaterial} position={[x, 0.105, 0]} rotation={[0, 0, x > 0 ? -0.6 : 0.6]} scale={[0.013, 0.034, 0.013]} />
      ))}
    </group>
  );
}

function HunCameFigure({ body }: BodyParts) {
  return (
    <group>
      <HumanoidBase body={body} torsoScale={[1.05, 1, 1.05]} />
      <Part geometry={unitHalfDome} material={maskMaterial} position={[0, 0.165, 0.015]} rotation={[Math.PI * 1.02, 0, 0]} scale={[0.072, 0.066, 0.05]} />
      <Part geometry={unitSphere} material={maskMaterial} position={[-0.023, 0.185, 0.046]} scale={[0.017, 0.015, 0.008]} />
      <Part geometry={unitSphere} material={maskMaterial} position={[0.023, 0.185, 0.046]} scale={[0.017, 0.015, 0.008]} />
      <EyeDots y={0.185} spread={0.023} z={0.051} />
      <Part geometry={unitCone} material={goldTrimMaterial} position={[0, 0.275, -0.005]} scale={[0.02, 0.075, 0.02]} />
      <Part geometry={unitCone} material={body} position={[-0.035, 0.25, -0.01]} rotation={[0, 0, 0.4]} scale={[0.014, 0.05, 0.014]} />
      <Part geometry={unitCone} material={body} position={[0.035, 0.25, -0.01]} rotation={[0, 0, -0.4]} scale={[0.014, 0.05, 0.014]} />
      <Part geometry={unitBox} material={body} position={[0, 0.0, -0.065]} rotation={[0.15, 0, 0]} scale={[0.13, 0.22, 0.01]} />
    </group>
  );
}

function GuardianFigure({ body }: BodyParts) {
  return (
    <group>
      <HumanoidBase body={body} torsoScale={[1.22, 1.06, 1.22]} />
      <EyeDots y={0.185} spread={0.021} z={0.054} />
      <Part geometry={unitSphere} material={goldTrimMaterial} position={[-0.118, 0.1, 0]} scale={[0.028, 0.022, 0.028]} />
      <Part geometry={unitSphere} material={goldTrimMaterial} position={[0.118, 0.1, 0]} scale={[0.028, 0.022, 0.028]} />
      <Part geometry={unitTorus} material={glowDotMaterial} position={[0, 0.03, 0.06]} rotation={[Math.PI / 2, 0, 0]} scale={[0.026, 0.026, 0.01]} />
      <Part geometry={unitCone} material={goldTrimMaterial} position={[0, 0.275, 0]} scale={[0.014, 0.085, 0.03]} />
    </group>
  );
}

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

/** Templo ceremonial maya escalonado con base de obsidiana, ribetes dorados,
 * estelas laterales en el templo central y halo holográfico cian/acento. */
function TemplePlatform({
  color,
  active,
  selected,
  big,
  lowDetail,
}: {
  color: string;
  active: boolean;
  selected: boolean;
  big: boolean;
  lowDetail: boolean;
}) {
  const scale = big ? 1.24 : 0.94;
  const steps = big ? (lowDetail ? 4 : 5) : lowDetail ? 3 : 4;
  const topY = (steps - 1) * 0.075;
  const radii = Array.from({ length: steps }, (_, index) => 0.5 - index * (0.42 / (steps + 0.5)));
  return (
    <group scale={scale}>
      {radii.map((radius, index) => (
        <group key={radius} position={[0, index * 0.075, 0]}>
          <mesh>
            <cylinderGeometry args={[radius, radius * 1.14, 0.072, 4]} />
            <meshStandardMaterial
              color={index === 0 ? "#07131a" : "#0b202b"}
              emissive={color}
              emissiveIntensity={active ? 0.35 + index * 0.06 : 0.1}
              metalness={0.45}
              roughness={0.42}
            />
          </mesh>
          {/* Moldura dorada en cada nivel ceremonial */}
          <mesh position={[0, 0.036, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
            <ringGeometry args={[radius * 0.96, radius * 1.01, 4]} />
            <meshBasicMaterial color="#f4b942" transparent opacity={active || selected ? 0.65 : 0.25} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {/* Estelas mayas en las cuatro esquinas del templo del Guardián */}
      {big && !lowDetail && [
        [-0.42, -0.42],
        [0.42, -0.42],
        [-0.42, 0.42],
        [0.42, 0.42],
      ].map(([px, pz], idx) => (
        <group key={idx} position={[px, 0.11, pz]}>
          <Part geometry={unitBox} material={obsidianMaterial} scale={[0.055, 0.22, 0.055]} />
          <Part geometry={unitOcta} material={goldTrimMaterial} position={[0, 0.14, 0]} scale={[0.026, 0.032, 0.026]} />
        </group>
      ))}
      {/* Anillo energético en la cúspide */}
      <mesh position={[0, topY + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.12, 0.23, 8]} />
        <meshBasicMaterial color={selected ? "#eafffb" : color} transparent opacity={selected ? 0.95 : active ? 0.85 : 0.32} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function MayaFloor({ lowDetail }: { lowDetail: boolean }) {
  return (
    <group position={[0, -0.04, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.55, lowDetail ? 24 : 48]} />
        <meshStandardMaterial color="#050c12" roughness={0.75} metalness={0.35} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <ringGeometry args={[1.68, 1.71, lowDetail ? 24 : 48]} />
        <meshBasicMaterial color="#3ae8e0" transparent opacity={0.28} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
        <ringGeometry args={[2.25, 2.28, lowDetail ? 24 : 48]} />
        <meshBasicMaterial color="#f4b942" transparent opacity={0.22} />
      </mesh>
    </group>
  );
}

function GodFigure({
  id,
  color,
  active,
  selected,
  big,
  reducedMotion,
  lowDetail,
  onSelect,
}: {
  id: AgentId;
  color: string;
  active: boolean;
  selected: boolean;
  big: boolean;
  reducedMotion: boolean;
  lowDetail: boolean;
  onSelect: (id: AgentId) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const wings = useRef<THREE.Group[]>([]);
  const seed = useMemo(() => (id.charCodeAt(0) % 7) * 0.9, [id]);
  const baseHeight = big ? 0.54 : 0.44;
  const body = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: active ? 0.65 : 0.42,
        transparent: true,
        opacity: 0.9,
        roughness: 0.32,
        metalness: 0.35,
      }),
    [color, active],
  );
  useEffect(() => () => body.dispose(), [body]);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    if (reducedMotion) {
      g.position.y = baseHeight;
    } else {
      const bobSpeed = active ? 2.2 : 1;
      g.position.y = baseHeight + Math.sin(t * bobSpeed + seed) * 0.032;
      g.rotation.y = t * (active ? 0.85 : 0.32);
    }
    if (!reducedMotion && !lowDetail && id === "camazotz") {
      const flap = Math.sin(t * (active ? 5 : 2) + seed) * (active ? 0.36 : 0.14);
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
      position={[0, baseHeight, 0]}
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
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.34, 0.34, 0.64, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <GodCore id={id} body={body} wingRef={registerWing} />
      {selected && (
        <mesh position={[0, -0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.24, 0.28, 24]} />
          <meshBasicMaterial color="#eafffb" transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

function Connection({ from, to, color, phase }: { from: [number, number]; to: [number, number]; color: string; phase: Phase }) {
  const points = useMemo(
    () => [new THREE.Vector3(from[0], 0.36, from[1]), new THREE.Vector3((from[0] + to[0]) / 2, 0.64, (from[1] + to[1]) / 2), new THREE.Vector3(to[0], 0.32, to[1])],
    [from, to],
  );
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);
  const pulse = useRef<THREE.Mesh>(null);
  const running = phase === "started" || phase === "completed";
  useFrame(({ clock }) => {
    if (!running || !pulse.current) return;
    const speed = phase === "started" ? 0.75 : 0.35;
    const t = (clock.elapsedTime * speed) % 1;
    pulse.current.position.copy(curve.getPointAt(t));
  });
  return (
    <group>
      <Line points={curve.getPoints(28)} color={color} lineWidth={2.2} transparent opacity={PHASE_INTENSITY[phase] * 0.85} />
      {running && (
        <mesh ref={pulse}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshBasicMaterial color="#eafffb" transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

function AmbientParticles({ count }: { count: number }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 * 3.1;
      const radius = 1.3 + ((i * 37) % 100) / 90;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = ((i * 53) % 100) / 95 - 0.1;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <points geometry={geometry}>
      <pointsMaterial color="#3ae8e0" size={0.022} transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

/** Enfoca suavemente la cámara sobre el templo del agente seleccionado o vuelve al centro general. */
function CameraRig({
  selected,
  controlsRef,
  reducedMotion,
}: {
  selected: AgentId | null;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  reducedMotion: boolean;
}) {
  const { camera } = useThree();
  const targetVec = useMemo(() => new THREE.Vector3(), []);
  const camVec = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;
    if (selected) {
      const [x, z] = LAYOUT[selected];
      targetVec.set(x, 0.15, z);
      camVec.set(x * 0.75, 2.2, z + 2.45);
    } else {
      targetVec.set(0, 0, 0);
      camVec.set(0, 3.2, 4.35);
    }
    const alpha = reducedMotion ? 1 : Math.min(1, delta * 4.5);
    controls.target.lerp(targetVec, alpha);
    if (selected) camera.position.lerp(camVec, alpha * 0.5);
    controls.update();
  });
  return null;
}

function Scene({
  events,
  executed,
  busy,
  selected,
  setSelected,
  reducedMotion,
  lowDetail,
  quality,
  onFps,
}: {
  events: AgentEvent[];
  executed: AgentId[];
  busy: boolean;
  selected: AgentId | null;
  setSelected: (id: AgentId) => void;
  reducedMotion: boolean;
  lowDetail: boolean;
  quality: GraphicsQuality;
  onFps: (fps: number) => void;
}) {
  const guardianPhase = phaseOf(events, "guardian", busy);
  const frames = useRef(0);
  const lastSample = useRef(0);

  useFrame(({ clock }) => {
    frames.current += 1;
    const t = clock.elapsedTime;
    if (t - lastSample.current >= 1) {
      onFps(Math.round(frames.current / (t - lastSample.current)));
      frames.current = 0;
      lastSample.current = t;
    }
  });

  return (
    <>
      <ambientLight intensity={0.62} />
      <pointLight position={[2.4, 3.4, 2.4]} intensity={1.35} color="#f4b942" />
      <pointLight position={[-2.4, 2.4, -2.4]} intensity={0.9} color="#3ae8e0" />
      {quality === "alta" && <AmbientParticles count={70} />}
      {quality === "media" && <AmbientParticles count={35} />}
      <group position={[0, -0.32, 0]}>
        <MayaFloor lowDetail={lowDetail} />
        <TemplePlatform color={AGENT_COLOR.guardian} active={guardianPhase !== "idle"} selected={selected === "guardian"} big lowDetail={lowDetail} />
        <GodFigure
          id="guardian"
          color={AGENT_COLOR.guardian}
          active={guardianPhase !== "idle"}
          selected={selected === "guardian"}
          big
          reducedMotion={reducedMotion}
          lowDetail={lowDetail}
          onSelect={setSelected}
        />
        {SPECIALISTS.map((id) => {
          const real = participatedIn(events, executed, id);
          const [x, z] = LAYOUT[id];
          return (
            <group key={id} position={[x, 0, z]}>
              <TemplePlatform color={AGENT_COLOR[id]} active={real} selected={selected === id} big={false} lowDetail={lowDetail} />
              <GodFigure
                id={id}
                color={AGENT_COLOR[id]}
                active={real}
                selected={selected === id}
                big={false}
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
  const wrapRef = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const [active, setActive] = useState(true);
  const [reducedMotion] = useState(prefersReducedMotion);
  const [quality] = useState(detectGraphicsQuality);
  const lowDetail = quality === "baja";
  const [selected, setSelected] = useState<AgentId | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fps, setFps] = useState<number>(0);

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

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = async () => {
    const el = wrapRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch {
      setIsFullscreen((prev) => !prev);
    }
  };

  const selectedPhase = selected ? phaseOf(events, selected, busy) : null;
  const selectedRecord = selected ? events.filter((event) => event.agent === selected).at(-1) : undefined;

  return (
    <div ref={wrapRef} className={`gods-map-3d-wrap${isFullscreen ? " gods-map-fullscreen" : ""}`}>
      <div className="gods-map-toolbar">
        <div className="gods-map-agent-pills" role="group" aria-label={lang === "en" ? "Select 3D temple" : "Seleccionar templo 3D"}>
          {ALL_AGENTS.map((id) => {
            const realActive = id === "guardian" ? phaseOf(events, "guardian", busy) !== "idle" : participatedIn(events, executed, id);
            return (
              <button
                key={id}
                type="button"
                className={`gods-map-pill${selected === id ? " selected" : ""}${realActive ? " active" : ""}`}
                onClick={() => setSelected(selected === id ? null : id)}
              >
                <span className="map-legend-dot" style={{ background: AGENT_COLOR[id] }} />
                {AGENT_NAMES[id]}
              </button>
            );
          })}
        </div>
        <div className="gods-map-actions">
          <button type="button" className="map-zoom-btn" onClick={() => setSelected(null)} title={lang === "en" ? "Overview" : "Vista general"}>
            <Eye size={13} /> {lang === "en" ? "Overview" : "General"}
          </button>
          <button
            type="button"
            className="map-zoom-btn"
            onClick={() => void toggleFullscreen()}
            aria-label={isFullscreen ? (lang === "en" ? "Exit fullscreen" : "Salir de pantalla completa") : (lang === "en" ? "Fullscreen" : "Pantalla completa")}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      <div
        ref={host}
        className="gods-map-3d"
        data-fps={fps}
        role="img"
        aria-label={lang === "en" ? "3D Maya operations map of the five agents" : "Mapa 3D maya de los cinco agentes"}
      >
        <Canvas
          frameloop={active ? "always" : "never"}
          dpr={dprRangeFor(quality)}
          gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
          camera={{ position: [0, 3.2, 4.35], fov: 40 }}
          onPointerMissed={() => setSelected(null)}
        >
          <Suspense fallback={null}>
            <Scene
              events={events}
              executed={executed}
              busy={busy}
              selected={selected}
              setSelected={setSelected}
              reducedMotion={reducedMotion}
              lowDetail={lowDetail}
              quality={quality}
              onFps={setFps}
            />
          </Suspense>
          <OrbitControls
            ref={controlsRef}
            enablePan={false}
            minDistance={2.2}
            maxDistance={7.2}
            minPolarAngle={0.55}
            maxPolarAngle={1.2}
            enableDamping
            dampingFactor={0.08}
          />
          <CameraRig selected={selected} controlsRef={controlsRef} reducedMotion={reducedMotion} />
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
              {selectedRecord?.findings !== undefined && (
                <small>
                  {" "}· {selectedRecord.findings} {lang === "en" ? "findings" : "hallazgos"}
                </small>
              )}
            </div>
          </>
        ) : (
          <p className="muted">
            {lang === "en"
              ? "Select a Maya temple or use the buttons above to inspect each agent's real status."
              : "Toca un templo maya o usa los botones superiores para inspeccionar el estado real de cada agente."}
          </p>
        )}
      </div>
    </div>
  );
}
