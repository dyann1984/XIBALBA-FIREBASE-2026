"use client";

/**
 * Prototipo del holograma 3D real del jaguar (fase evaluación, ver
 * docs/holograma-3d-jaguar.md). Carga un GLB real (malla + animación de
 * carrera por morph targets, CC-BY "3 Dreams of Black" / Google Data Arts
 * Team) y lo reviste con un material holográfico Fresnel propio. No sustituye
 * a JaguarAvatar por defecto hasta que se valide su calidad y rendimiento.
 */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import type { GuardianLight, GuardianState } from "@/components/guardian/JaguarAvatar";
import { guardianAccentFor } from "@/components/guardian/JaguarAvatar";
import { createHologramMaterial, createHologramWireMaterial } from "@/components/guardian/hologramMaterial";

const MODEL_URL = "/guardian/models/black-panther-base.glb";

const SPEED_FOR_STATE: Record<GuardianState, number> = {
  reposo: 0,
  escuchando: 0.55,
  analizando: 1.15,
  hablando: 0.7,
  explicando: 0.7,
  alerta: 1.6,
  seguridad: 0,
  error: 0,
};

// El GLB solo trae un clip (ciclo de carrera, ver ATTRIBUTION.md): no hay
// ninguna pose de "pie quieto" capturada. En vez de inventar una animación
// de reposo que el modelo no soporta, estos estados simplemente no corren
// el clip (malla en su pose base, sin ningún peso de morph target) y el
// único movimiento que reciben es el balanceo/respiración rígida de más
// abajo — nunca deforma la geometría, solo mueve el grupo entero.
const STILL_STATES: GuardianState[] = ["reposo", "seguridad", "error"];

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const BASE_SCALE = 0.0055;
const BASE_POSITION: [number, number, number] = [0, -0.24, 0.16];

/** Anillo ceremonial + motas de energía: ornamento maya añadido aparte,
 * nunca una textura ni una geometría del GLB original. */
function MayaOrnaments({ accent, gold }: { accent: string; gold: string }) {
  const motes = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    motes.current?.children.forEach((mote, index) => {
      const offset = (index / 3) * Math.PI * 2;
      const radius = 0.34 + Math.sin(t * 0.4 + offset) * 0.03;
      mote.position.set(Math.cos(t * 0.5 + offset) * radius, 0.1 + Math.sin(t * 0.8 + offset) * 0.06, Math.sin(t * 0.5 + offset) * radius);
    });
  });
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.26, 0]}>
        <torusGeometry args={[0.46, 0.012, 8, 48]} />
        <meshBasicMaterial color={gold} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.26, 0]}>
        <torusGeometry args={[0.37, 0.006, 8, 48]} />
        <meshBasicMaterial color={accent} transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <group ref={motes}>
        {[0, 1, 2].map((index) => (
          <mesh key={index}>
            <octahedronGeometry args={[0.015, 0]} />
            <meshBasicMaterial color={gold} transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function JaguarModel({
  state,
  light,
  reducedMotion,
}: {
  state: GuardianState;
  light: GuardianLight;
  reducedMotion: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(MODEL_URL);
  const { actions } = useAnimations(animations, group);
  const accent = guardianAccentFor(state, light);
  const gold = "#f4b942";

  // Material y malla-eco wireframe viven en refs: son objetos imperativos de
  // three.js, mutados cuadro a cuadro en useFrame, nunca leídos en el render
  // de React (la jerarquía visible es `scene`, añadida una sola vez abajo).
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const wireMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const mainMeshRef = useRef<THREE.Mesh | null>(null);
  const wireMeshRef = useRef<THREE.Mesh | null>(null);

  useEffect(() => {
    let found: THREE.Mesh | null = null;
    scene.traverse((child) => {
      if (!found && (child as THREE.Mesh).isMesh) found = child as THREE.Mesh;
    });
    if (!found) return;
    const mesh: THREE.Mesh = found;
    if (!mesh.geometry.getAttribute("normal")) mesh.geometry.computeVertexNormals();

    // Inspecciona la caja delimitadora real de la malla (nunca una
    // coordenada Y fija adivinada) para que el shader sepa qué cuenta como
    // "mitad superior del cuerpo" al localizar el resplandor de los ojos.
    mesh.geometry.computeBoundingBox();
    const bbox = mesh.geometry.boundingBox;

    const material = createHologramMaterial(accent, gold);
    if (bbox) {
      material.uniforms.uBoundsMinY.value = bbox.min.y;
      material.uniforms.uBoundsMaxY.value = bbox.max.y;
    }
    mesh.material = material;

    const wire = new THREE.Mesh(mesh.geometry, createHologramWireMaterial(accent));
    wire.morphTargetDictionary = mesh.morphTargetDictionary;
    wire.morphTargetInfluences = mesh.morphTargetInfluences;
    mesh.add(wire);

    mainMeshRef.current = mesh;
    wireMeshRef.current = wire;
    materialRef.current = material;
    wireMaterialRef.current = wire.material as THREE.MeshBasicMaterial;

    return () => {
      mesh.remove(wire);
    };
    // Solo se reconstruye cuando cambia el GLB cargado; el color de acento se
    // sincroniza aparte, sin rehacer geometría ni material cada vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  useEffect(() => {
    materialRef.current?.uniforms.uColor.value.set(accent);
    wireMaterialRef.current?.color.set(accent);
  }, [accent]);

  const isStill = STILL_STATES.includes(state) || reducedMotion;

  useEffect(() => {
    const action = Object.values(actions)[0];
    if (!action) return;
    if (isStill) {
      action.reset().play();
      // El ciclo (12 cuadros a 24fps) no tiene una pose de pie quieto; 0.17s
      // es el cuadro con las patas más recogidas bajo el cuerpo, la postura
      // menos parecida a una carrera en marcha de las 12 disponibles.
      action.time = 0.17;
      action.paused = true;
      return;
    }
    action.reset().play();
    action.timeScale = SPEED_FOR_STATE[state];
    return () => {
      action.stop();
    };
  }, [actions, state, isStill]);

  useFrame(({ clock }, delta) => {
    if (materialRef.current) materialRef.current.uniforms.uTime.value += reducedMotion ? 0 : delta;
    if (wireMeshRef.current && mainMeshRef.current) {
      wireMeshRef.current.morphTargetInfluences = mainMeshRef.current.morphTargetInfluences;
    }
    const g = group.current;
    if (!g) return;
    if (isStill && !reducedMotion) {
      const t = clock.elapsedTime;
      const breathe = Math.sin(t * 1.1) * 0.014;
      g.scale.setScalar(BASE_SCALE * (1 + breathe));
      g.position.set(BASE_POSITION[0], BASE_POSITION[1] + Math.sin(t * 1.1) * 0.01, BASE_POSITION[2]);
      g.rotation.z = Math.sin(t * 0.55) * 0.012;
    } else {
      g.scale.setScalar(BASE_SCALE);
      g.position.set(...BASE_POSITION);
      g.rotation.z = 0;
    }
  });

  return (
    <>
      <group ref={group} rotation={[0, Math.PI * 0.2, 0]} scale={BASE_SCALE} position={BASE_POSITION}>
        <primitive object={scene} />
      </group>
      {/* Los ornamentos viven ya en la escala "mundo" final (no en las
          unidades crudas del GLB), así que van fuera del grupo con BASE_SCALE
          — si no, quedan 180 veces más pequeños e invisibles. */}
      <group position={BASE_POSITION}>
        <MayaOrnaments accent={accent} gold={gold} />
      </group>
    </>
  );
}

export default function GuardianHologram3D({
  state,
  light,
}: {
  state: GuardianState;
  light: GuardianLight;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);
  const [reducedMotion] = useState(prefersReducedMotion);

  useEffect(() => {
    const element = host.current;
    if (!element || typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting && !document.hidden),
      { threshold: 0.08 },
    );
    observer.observe(element);
    const onVisibility = () => setActive(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const accent = guardianAccentFor(state, light);
  const lights = useMemo(() => ({ accent }), [accent]);

  return (
    <div ref={host} className="jaguar-hologram-3d" data-guardian-state={state}>
      <Canvas
        frameloop={active ? "always" : "never"}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0.1, 2.6], fov: 36 }}
      >
        <ambientLight intensity={0.4} color={lights.accent} />
        <pointLight position={[1, 1.5, 2]} intensity={1.1} color="#f4b942" />
        <Suspense fallback={null}>
          <JaguarModel state={state} light={light} reducedMotion={reducedMotion} />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL_URL);
