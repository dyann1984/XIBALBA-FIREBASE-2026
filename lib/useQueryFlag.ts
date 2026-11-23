"use client";
import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

/**
 * Lee `?name=1` de la URL, de forma segura para SSR/hidratación (siempre
 * `false` en el servidor, valor real una vez en el cliente). Usado por los
 * prototipos 3D (holograma del jaguar, mapa de los cinco dioses) para no
 * cargarse nunca a un usuario real: solo quien visita la URL con la bandera.
 */
export function useQueryFlag(name: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(name) === "1",
    () => false,
  );
}
