"use client";
import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

/**
 * Lee `?name=1` de la URL, de forma segura para SSR/hidratación (siempre
 * `false` en el servidor, valor real una vez en el cliente).
 */
export function useQueryFlag(name: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(name) === "1",
    () => false,
  );
}

/**
 * Activa la experiencia 3D por defecto en el cliente (siempre `false` en SSR
 * para evitar desajustes de hidratación). Permite desactivarla con
 * `?preview3d=0` o `?no3d=1` para pruebas o dispositivos específicos.
 */
export function use3DEnabled(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => {
      const params = new URLSearchParams(window.location.search);
      return params.get("preview3d") !== "0" && params.get("no3d") !== "1";
    },
    () => false,
  );
}
