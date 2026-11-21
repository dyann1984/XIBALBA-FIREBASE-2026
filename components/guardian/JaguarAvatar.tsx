"use client";

/**
 * EL GUARDIÁN · Jaguar Maya Futurista Premium (avatar 2.5D por capas).
 *
 * Anatomía felina realista estilizada en obsidiana negra, ojos turquesa
 * luminosos con pupila vertical, ornamentos mayas de oro y jade, y elementos
 * tecnológicos holográficos sincronizados con eventos reales del sistema:
 *   - reposo: esperando
 *   - escuchando: micrófono activo escuchando al usuario
 *   - analizando: procesando información
 *   - hablando / explicando: reproduciendo voz o presentando resultados
 *   - alerta: advirtiendo peligro
 *   - seguridad: confirmando seguridad (sin señales de riesgo en contenido local)
 *   - error: error de conexión o servicio
 */

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

export type GuardianState =
  | "reposo"
  | "escuchando"
  | "analizando"
  | "hablando"
  | "explicando"
  | "alerta"
  | "seguridad"
  | "error";
export type GuardianLight = "verde" | "amarillo" | "rojo" | "gris";

const ACCENT: Record<GuardianLight, string> = {
  verde: "#34d399",
  amarillo: "#fbbf24",
  rojo: "#f43f5e",
  gris: "#2ee6e6",
};

/** Color de acento por estado real, compartido por cualquier representación
 * visual del Guardián (SVG procedural o retrato estático). Única fuente de
 * verdad para que las dos nunca diverjan de color por estado. */
export function guardianAccentFor(state: GuardianState, light: GuardianLight): string {
  return state === "escuchando"
    ? "#2ee6e6"
    : state === "seguridad"
      ? "#34d399"
      : state === "alerta" || state === "error"
        ? "#f43f5e"
        : ACCENT[light];
}

const SPOKEN_STATE: Record<"es" | "en", Record<GuardianState, string>> = {
  es: {
    reposo: "El guardián jaguar está en reposo, esperando un análisis.",
    escuchando: "El guardián jaguar está escuchando tu voz por el micrófono.",
    analizando: "El guardián jaguar está procesando la información.",
    hablando: "El guardián jaguar está hablando.",
    explicando: "El guardián jaguar está presentando el análisis.",
    alerta: "El guardián jaguar advierte peligro o riesgo alto.",
    seguridad: "El guardián jaguar confirma que no se hallaron señales locales de riesgo.",
    error: "El guardián jaguar reporta un error de conexión.",
  },
  en: {
    reposo: "The jaguar guardian is idle, waiting for an analysis.",
    escuchando: "The jaguar guardian is listening to your voice via microphone.",
    analizando: "The jaguar guardian is processing the information.",
    hablando: "The jaguar guardian is speaking.",
    explicando: "The jaguar guardian is presenting the analysis.",
    alerta: "The jaguar guardian warns of danger or high risk.",
    seguridad: "The jaguar guardian confirms no local risk signals were found.",
    error: "The jaguar guardian reports a connection error.",
  },
};

const PLUME_SPREAD: Record<GuardianState, number> = {
  reposo: 1,
  escuchando: 1.14,
  analizando: 1.07,
  hablando: 1.09,
  explicando: 1.06,
  alerta: 1.32,
  seguridad: 1.04,
  error: 0.82,
};

const PLUMES = [-74, -52, -30, 0, 30, 52, 74].map((angle, index) => ({
  angle,
  scale: 1 - Math.abs(index - 3) * 0.075,
  tone: Math.min(2, Math.abs(index - 3)),
}));

export default function JaguarAvatar({
  state,
  light,
  speaking,
  lang = "es",
}: {
  state: GuardianState;
  light: GuardianLight;
  speaking: boolean;
  lang?: "es" | "en";
}) {
  const host = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });

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

  useEffect(() => {
    const element = host.current;
    if (!element || !active || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const onMove = (event: PointerEvent) => {
      const box = element.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const x = (event.clientX - (box.left + box.width / 2)) / (box.width / 2);
      const y = (event.clientY - (box.top + box.height / 2)) / (box.height / 2);
      setGaze({
        x: Math.max(-1, Math.min(1, x)),
        y: Math.max(-1, Math.min(1, y)),
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [active]);

  // En pantallas táctiles nunca llega `pointermove`, así que sin esto la
  // mirada queda fija en el centro. Una deriva autónoma y suave mantiene al
  // jaguar con vida en móvil sin simular ningún estado que no sea real.
  useEffect(() => {
    if (!active || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: none), (pointer: coarse)").matches) return;
    const timer = setInterval(() => {
      setGaze({
        x: Math.random() * 1.2 - 0.6,
        y: Math.random() * 0.8 - 0.4,
      });
    }, 3400);
    return () => clearInterval(timer);
  }, [active]);

  const accent = guardianAccentFor(state, light);
  const label = SPOKEN_STATE[lang][state];
  const style = {
    "--guardian-accent": accent,
    "--plume-spread": PLUME_SPREAD[state],
    "--gaze-x": `${(gaze.x * 4).toFixed(2)}px`,
    "--gaze-y": `${(gaze.y * 2.5).toFixed(2)}px`,
    "--tilt": `${(gaze.x * 2.2).toFixed(2)}deg`,
  } as CSSProperties;

  return (
    <div
      ref={host}
      className={`guardian-stage jaguar state-${state} light-${light}${speaking ? " speaking" : ""}${
        active ? "" : " paused"
      }`}
      style={style}
      data-guardian-state={state}
    >
      <svg
        viewBox="0 -34 300 374"
        className="jaguar-svg"
        role="img"
        aria-label={label}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="jg-pelt" cx="50%" cy="34%" r="72%">
            <stop offset="0%" stopColor="#1b242d" />
            <stop offset="48%" stopColor="#0f151c" />
            <stop offset="100%" stopColor="#05080c" />
          </radialGradient>
          <linearGradient id="jg-cheek" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#212d38" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#090d12" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id="jg-muzzle" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#232e39" />
            <stop offset="100%" stopColor="#0e141a" />
          </linearGradient>
          <linearGradient id="jg-jade" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#5eead4" />
            <stop offset="45%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#0a4f46" />
          </linearGradient>
          <linearGradient id="jg-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fceabb" />
            <stop offset="45%" stopColor="#dfb15b" />
            <stop offset="100%" stopColor="#7a591e" />
          </linearGradient>
          <linearGradient id="jg-gold-soft" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#d9ad5a" />
            <stop offset="100%" stopColor="#523b16" />
          </linearGradient>
          <radialGradient id="jg-eye" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#ecfeff" stopOpacity="0.98" />
            <stop offset="30%" stopColor="var(--guardian-accent)" />
            <stop offset="100%" stopColor="#083344" stopOpacity="0.85" />
          </radialGradient>
          <linearGradient id="jg-scan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--guardian-accent)" stopOpacity="0" />
            <stop offset="50%" stopColor="var(--guardian-accent)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--guardian-accent)" stopOpacity="0" />
          </linearGradient>
          <filter id="jg-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id="jg-head-clip">
            <path d="M150 62 L198 75 L223 108 L231 154 L214 198 L182 226 L150 236 L118 226 L86 198 L69 154 L77 108 L102 75 Z" />
          </clipPath>
        </defs>

        {/* ---- Fondo: portal escalonado maya y anillos holográficos ---- */}
        <g className="jg-backdrop">
          <path
            className="jg-portal"
            d="M58 300 L58 120 L74 120 L74 96 L94 96 L94 74 L206 74 L206 96 L226 96 L226 120 L242 120 L242 300 Z"
          />
          <circle className="jg-ring jg-ring-outer" cx="150" cy="162" r="124" />
          <circle className="jg-ring jg-ring-inner" cx="150" cy="162" r="104" />
          <g className="jg-glyph-ring">
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2;
              return (
                <rect
                  key={i}
                  x={150 + Math.cos(a) * 114 - 3.5}
                  y={162 + Math.sin(a) * 114 - 3.5}
                  width="7"
                  height="7"
                  transform={`rotate(${(a * 180) / Math.PI} ${150 + Math.cos(a) * 114} ${
                    162 + Math.sin(a) * 114
                  })`}
                />
              );
            })}
          </g>
        </g>

        {/* ---- Ondas acústicas holográficas (solo en escuchando / hablando) ---- */}
        {(state === "escuchando" || state === "hablando") && (
          <g className="jg-voice-waves">
            <path d="M52 142 C38 156 38 176 52 190" />
            <path d="M40 132 C20 154 20 178 40 200" />
            <path d="M248 142 C262 156 262 176 248 190" />
            <path d="M260 132 C280 154 280 178 260 200" />
          </g>
        )}

        {/* ---- Penacho de plumas ---- */}
        <g className="jg-plumes">
          {PLUMES.map((plume, index) => (
            <g
              key={index}
              className={`jg-plume jg-plume-${plume.tone}`}
              style={
                {
                  "--a": `${plume.angle}deg`,
                  "--s": plume.scale,
                  "--d": `${index * 0.22}s`,
                } as CSSProperties
              }
            >
              <path d="M150 94 L137 26 L150 -26 L163 26 Z" />
              <path className="jg-plume-spine" d="M150 90 L150 -14" />
            </g>
          ))}
        </g>

        {/* ---- Cabeza felina realista en obsidiana ---- */}
        <g className="jg-head">
          <g className="jg-ear jg-ear-left">
            <path className="jg-ear-shell" d="M98 92 L54 26 L132 64 Z" />
            <path className="jg-ear-inner" d="M101 86 L70 43 L123 67 Z" />
            <circle className="jg-ear-hoop" cx="82" cy="74" r="5.5" />
          </g>
          <g className="jg-ear jg-ear-right">
            <path className="jg-ear-shell" d="M202 92 L246 26 L168 64 Z" />
            <path className="jg-ear-inner" d="M199 86 L230 43 L177 67 Z" />
            <circle className="jg-ear-hoop" cx="218" cy="74" r="5.5" />
          </g>

          <path
            className="jg-skull"
            d="M150 62 L198 75 L223 108 L231 154 L214 198 L182 226 L150 236 L118 226 L86 198 L69 154 L77 108 L102 75 Z"
          />
          {/* Planos musculares cigomáticos */}
          <path className="jg-cheek" d="M74 148 L112 162 L106 202 L84 186 Z" />
          <path className="jg-cheek" d="M226 148 L188 162 L194 202 L216 186 Z" />

          {/* Rosetas sutiles de jaguar negro */}
          <g className="jg-rosettes" clipPath="url(#jg-head-clip)">
            <path d="M88 120 l9 -6 7 7 -8 7 z" />
            <path d="M212 120 l-9 -6 -7 7 8 7 z" />
            <path d="M80 168 l10 -5 6 9 -9 6 z" />
            <path d="M220 168 l-10 -5 -6 9 9 6 z" />
            <path d="M96 198 l9 -5 5 8 -8 6 z" />
            <path d="M204 198 l-9 -5 -5 8 8 6 z" />
          </g>
          {/* Circuitos tecnológicos jade */}
          <path className="jg-tech-trace" d="M76 154 L92 162 L98 184" />
          <path className="jg-tech-trace" d="M224 154 L208 162 L202 184" />

          {/* Arcos supraorbitales */}
          <path className="jg-brow" d="M86 128 L142 110 L146 128 L90 142 Z" />
          <path className="jg-brow" d="M214 128 L158 110 L154 128 L210 142 Z" />

          {/* Puente nasal */}
          <path className="jg-bridge" d="M142 122 L158 122 L161 177 L139 177 Z" />

          {/* Ojos turquesa luminosos con pupila vertical y brillo especular */}
          <g className="jg-eyes" filter="url(#jg-glow)">
            <g className="jg-eye">
              <path
                className="jg-eye-socket"
                d="M87 152 C100 129 133 128 143 146 C130 166 100 168 87 152 Z"
              />
              <path
                className="jg-eye-ball"
                d="M91 151 C102 133 129 131 138 146 C128 163 102 165 91 151 Z"
              />
              <ellipse className="jg-pupil" cx="115" cy="148" rx="3.2" ry="11.2" />
              <circle className="jg-catchlight" cx="110" cy="143" r="2.1" />
            </g>
            <g className="jg-eye">
              <path
                className="jg-eye-socket"
                d="M213 152 C200 129 167 128 157 146 C170 166 200 168 213 152 Z"
              />
              <path
                className="jg-eye-ball"
                d="M209 151 C198 133 171 131 162 146 C172 163 198 165 209 151 Z"
              />
              <ellipse className="jg-pupil" cx="185" cy="148" rx="3.2" ry="11.2" />
              <circle className="jg-catchlight" cx="180" cy="143" r="2.1" />
            </g>
          </g>

          {/* Hocico y mandíbula articulada */}
          <path className="jg-muzzle" d="M110 178 L190 178 L198 204 L150 220 L102 204 Z" />
          <path className="jg-nose" d="M137 180 L163 180 L150 197 Z" />
          <g className="jg-jaw">
            <path className="jg-mouth" d="M150 197 L150 205" />
            <path className="jg-mouth" d="M150 205 C141 215 128 213 123 203" />
            <path className="jg-mouth" d="M150 205 C159 215 172 213 177 203" />
            <path className="jg-fang" d="M133 206 L141 206 L137 221 Z" />
            <path className="jg-fang" d="M167 206 L159 206 L163 221 Z" />
          </g>
          <g className="jg-whiskers">
            <circle cx="122" cy="190" r="1.6" />
            <circle cx="130" cy="197" r="1.6" />
            <circle cx="121" cy="199" r="1.6" />
            <circle cx="178" cy="190" r="1.6" />
            <circle cx="170" cy="197" r="1.6" />
            <circle cx="179" cy="199" r="1.6" />
          </g>

          {/* Diadema escalonada maya de oro con incrustaciones de jade */}
          <g className="jg-crown">
            <path d="M74 112 L74 96 L96 96 L96 84 L122 84 L122 72 L150 64 L178 72 L178 84 L204 84 L204 96 L226 96 L226 112 Z" />
            <g className="jg-crown-blocks">
              <rect x="88" y="99" width="9" height="9" />
              <rect x="110" y="93" width="9" height="9" />
              <rect x="181" y="93" width="9" height="9" />
              <rect x="203" y="99" width="9" height="9" />
            </g>
          </g>
          <path className="jg-crown-glyph" d="M150 80 l11 11 -11 11 -11 -11 z" />
        </g>

        {/* ---- Pecho, collar jade/oro y medallón ---- */}
        <g className="jg-chest">
          <path
            className="jg-chest-body"
            d="M96 250 C112 232 188 232 204 250 L224 318 L76 318 Z"
          />
          <path className="jg-chest-bib" d="M126 250 C140 242 160 242 174 250 L182 318 L118 318 Z" />
          <g className="jg-collar">
            <path d="M92 252 C116 228 184 228 208 252 L198 266 C178 248 122 248 102 266 Z" />
            <rect x="106" y="260" width="10" height="10" transform="rotate(-24 111 265)" />
            <rect x="184" y="260" width="10" height="10" transform="rotate(24 189 265)" />
          </g>
          <circle className="jg-medallion" cx="150" cy="276" r="17" />
          <path className="jg-medallion-glyph" d="M150 265 l11 11 -11 11 -11 -11 z" />
        </g>

        {/* ---- Barrido de escaneo holográfico ---- */}
        <rect className="jg-scan" x="46" y="0" width="208" height="54" fill="url(#jg-scan)" />
      </svg>

      <p className="visually-hidden" role="status">
        {label}
      </p>
    </div>
  );
}
