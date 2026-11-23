"use client";

/**
 * Prototipo del holograma 3D real del jaguar (fase evaluación, ver
 * docs/holograma-3d-jaguar.md). Carga un GLB real (malla + animación de
 * carrera por morph targets, CC-BY "3 Dreams of Black" / Google Data Arts
 * Team) y lo reviste con un material holográfico Fresnel propio. No sustituye
 * a JaguarAvatar por defecto hasta que se valide su calidad y rendimiento.
 */

import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import type { GuardianLight, GuardianState } from "@/components/guardian/JaguarAvatar";
import { guardianAccentFor } from "@/components/guardian/JaguarAvatar";
import { createHologramMaterial, createHologramWireMaterial } from "@/components/guardian/hologramMaterial";

const MODEL_URL = "/guardian/models/black-panther-base.glb";

const SPEED_FOR_STATE: Record<GuardianState, number> = {
  reposo: 0.35,
  escuchando: 0.55,
  analizando: 1.15,
  hablando: 0.7,
  explicando: 0.7,
  alerta: 1.6,
  seguridad: 0.5,
  error: 0.25,
};

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

    const material = createHologramMaterial(accent);
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

  useEffect(() => {
    const action = Object.values(actions)[0];
    if (!action) return;
    action.reset().play();
    action.timeScale = reducedMotion ? 0 : SPEED_FOR_STATE[state];
    return () => {
      action.stop();
    };
  }, [actions, state, reducedMotion]);

  useFrame((_frameState, delta) => {
    if (materialRef.current) materialRef.current.uniforms.uTime.value += reducedMotion ? 0 : delta;
    if (wireMeshRef.current && mainMeshRef.current) {
      wireMeshRef.current.morphTargetInfluences = mainMeshRef.current.morphTargetInfluences;
    }
  });

  return (
    <group ref={group} rotation={[0, Math.PI * 0.2, 0]} scale={0.0055} position={[0, -0.24, 0.16]}>
      <primitive object={scene} />
    </group>
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

  return (
    <div ref={host} className="jaguar-hologram-3d" data-guardian-state={state}>
      <Canvas
        frameloop={active ? "always" : "never"}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0.1, 2.6], fov: 36 }}
      >
        <ambientLight intensity={0.4} color={accent} />
        <pointLight position={[1, 1.5, 2]} intensity={1.1} color="#f4b942" />
        <Suspense fallback={null}>
          <JaguarModel state={state} light={light} reducedMotion={reducedMotion} />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL_URL);
