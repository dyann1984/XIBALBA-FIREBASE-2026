"use client";

import { Component, type ReactNode } from "react";

/**
 * Red de seguridad para los prototipos 3D (fase 4, auditoría de
 * estabilidad). `GuardianHologram3D` y `GodsMap3D` solo se cargan con
 * `?preview3d=1`, pero antes de esta auditoría un fallo de WebGL/three.js
 * ahí dentro (contexto no disponible, GLB que no carga, driver roto) se
 * propagaba sin red hasta React y podía tumbar el panel entero del
 * Guardián o el tablero de investigación — es decir, el análisis real de
 * estafas, que no depende en nada de estos prototipos. Este boundary
 * aísla ese fallo a la propia escena y deja todo lo demás intacto.
 */
export default class Scene3DBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Diagnóstico de desarrollo: nunca se muestra en la interfaz, nunca se
    // envía a ningún servicio (estos prototipos no están aprobados para
    // usuarios reales).
    if (process.env.NODE_ENV !== "production") {
      console.error("[Scene3DBoundary] la escena 3D falló, usando alternativa:", error);
    }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
