"use client";
import { useEffect, useRef, useState } from "react";
import type { GuardianLight, GuardianState, SceneHandle } from "./scene";

/**
 * Monta la escena 3D solo en el cliente y solo cuando está a la vista.
 * Si WebGL no está disponible o la persona pide movimiento reducido, se
 * degrada sin romper la página: el contenido textual nunca depende de esto.
 */
export default function GuardianCanvas({
  state,
  light,
  speaking,
}: {
  state: GuardianState;
  light: GuardianLight;
  speaking: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const handle = useRef<SceneHandle | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    const element = canvas.current;
    const container = host.current;
    if (!element || !container) return;

    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    void (async () => {
      try {
        const { createGuardianScene } = await import("./scene");
        if (disposed) return;
        handle.current = createGuardianScene(element, { reducedMotion });
        setReady(true);
      } catch {
        if (!disposed) setFailed(true);
      }
    })();

    const onResize = () => handle.current?.resize();
    const observer = new ResizeObserver(onResize);
    observer.observe(container);

    // Pausa cuando no se ve o la pestaña está en segundo plano.
    const visibility = new IntersectionObserver(
      ([entry]) => handle.current?.setPaused(!entry.isIntersecting || document.hidden),
      { threshold: 0.05 },
    );
    visibility.observe(container);
    const onVisibility = () => handle.current?.setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);

    const onPointer = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      handle.current?.setPointer(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        ((event.clientY - rect.top) / rect.height) * 2 - 1,
      );
    };
    container.addEventListener("pointermove", onPointer);
    const onLeave = () => handle.current?.setPointer(0, 0);
    container.addEventListener("pointerleave", onLeave);

    return () => {
      disposed = true;
      observer.disconnect();
      visibility.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      container.removeEventListener("pointermove", onPointer);
      container.removeEventListener("pointerleave", onLeave);
      handle.current?.dispose();
      handle.current = null;
    };
  }, []);

  useEffect(() => {
    handle.current?.setState(state);
  }, [state, ready]);
  useEffect(() => {
    handle.current?.setLight(light);
  }, [light, ready]);
  useEffect(() => {
    handle.current?.setSpeaking(speaking);
  }, [speaking, ready]);

  return (
    <div className={`guardian-stage light-${light} ${failed ? "fallback" : ""}`} ref={host}>
      {/* Decorativo: todo el contenido informativo está en texto fuera del lienzo. */}
      <canvas ref={canvas} aria-hidden="true" />
      {failed && (
        <div className="guardian-fallback" aria-hidden="true">
          <span>✦</span>
        </div>
      )}
      <span className="visually-hidden" role="status">
        Guardián en estado {state}, semáforo {light}.
      </span>
    </div>
  );
}
