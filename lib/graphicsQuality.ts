/**
 * Nivel de calidad gráfica automático para las escenas 3D (fase 4, auditoría
 * de estabilidad). No pide nada al usuario ni se guarda entre sesiones: se
 * calcula una sola vez a partir de señales reales del dispositivo
 * (resolución de viewport, núcleos de CPU y, cuando el navegador la expone,
 * memoria aproximada) — nunca una estimación inventada ni aleatoria.
 */
export type GraphicsQuality = "alta" | "media" | "baja";

type NavigatorWithMemory = Navigator & { deviceMemory?: number };

export function detectGraphicsQuality(): GraphicsQuality {
  if (typeof window === "undefined") return "alta";
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const width = window.innerWidth;
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as NavigatorWithMemory).deviceMemory;

  if (reducedMotion || width < 480 || cores <= 2 || (memory !== undefined && memory <= 2)) {
    return "baja";
  }
  if (width < 900 || cores <= 4 || (memory !== undefined && memory <= 4)) {
    return "media";
  }
  return "alta";
}

/** Rangos de dpr por nivel: solo afecta nitidez/costo de relleno de píxeles,
 * nunca la geometría o el conteo de triángulos. */
export function dprRangeFor(quality: GraphicsQuality): [number, number] {
  if (quality === "baja") return [1, 1];
  if (quality === "media") return [1, 1.25];
  return [1, 1.5];
}

export function isWebGLAvailable(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}
