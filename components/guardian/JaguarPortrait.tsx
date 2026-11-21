"use client";

/**
 * EL GUARDIÁN · retrato premium (ilustración estática + animación por capas).
 *
 * Honestidad sobre lo que es esto: la imagen base es una ilustración de alta
 * calidad (la referencia aprobada para la dirección de arte del proyecto),
 * recortada a retrato en `public/guardian/jaguar-portrait.{jpg,webp}`. NO es
 * un modelo 3D ni una escena con rig: no existe ningún GLB en el repositorio
 * (se buscó antes de construir esto) y no se afirma lo contrario en ninguna
 * parte de la interfaz ni de la documentación. El "movimiento" es una
 * composición de capas CSS sobre una sola imagen fija: respiración (escala),
 * parpadeo (una capa oscura que cruza los ojos por ~140ms cada pocos
 * segundos), brillo de ojos por estado, un barrido de escaneo durante el
 * análisis y una viñeta de color durante la alerta — todo sincronizado con
 * props reales (`state`, `speaking`), nunca con un temporizador decorativo
 * que finja estados que no ocurren.
 *
 * `JaguarAvatar.tsx` (el avatar SVG procedural de una fase anterior) se
 * conserva intacto como alternativa: si la imagen no carga (`onError`), este
 * componente renderiza ese SVG en su lugar automáticamente, no solo en el
 * código fuente.
 *
 * Hallazgo real de esta sesión (prueba visual en navegador, no solo lectura
 * de código): la respiración existía mas a una escala de solo 1.2%
 * (`scale(1.012)`), invisible en la práctica — se confirmó con
 * `getComputedStyle` que la animación corría, pero nadie podía percibirla.
 * Se amplió a un rango perceptible y se añadió seguimiento de mirada
 * (parallax real sobre el puntero, con deriva autónoma en pantallas
 * táctiles), que antes no existía en absoluto en este componente — solo en
 * el SVG anterior que ya no se usa en la interfaz real.
 */

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import JaguarAvatar, { guardianAccentFor, type GuardianLight, type GuardianState } from "./JaguarAvatar";

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

// Parpadeo entre 4 y 8s, nunca con `prefers-reduced-motion` ni con la
// pestaña en segundo plano (el mismo criterio que ya usa JaguarAvatar).
const BLINK_MIN_MS = 4000;
const BLINK_MAX_MS = 8000;
const BLINK_DURATION_MS = 140;

export default function JaguarPortrait({
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
  const [blinking, setBlinking] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
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

  // Seguimiento de mirada real sobre el puntero (no existía en el retrato
  // premium: solo el SVG anterior, ya fuera de uso, lo tenía). En pantallas
  // táctiles nunca llega `pointermove`, así que una deriva autónoma y suave
  // mantiene al jaguar con vida sin fingir ningún estado que no sea real.
  useEffect(() => {
    if (!active || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const element = host.current;
    if (!element) return;
    const onMove = (event: PointerEvent) => {
      const box = element.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const x = (event.clientX - (box.left + box.width / 2)) / (box.width / 2);
      const y = (event.clientY - (box.top + box.height / 2)) / (box.height / 2);
      setGaze({ x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [active]);

  useEffect(() => {
    if (!active || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: none), (pointer: coarse)").matches) return;
    const timer = setInterval(() => {
      setGaze({ x: Math.random() * 1.2 - 0.6, y: Math.random() * 0.7 - 0.35 });
    }, 3600);
    return () => clearInterval(timer);
  }, [active]);

  useEffect(() => {
    if (!active || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let blinkTimeout: ReturnType<typeof setTimeout>;
    let closeTimeout: ReturnType<typeof setTimeout>;
    const scheduleBlink = () => {
      const delay = BLINK_MIN_MS + Math.random() * (BLINK_MAX_MS - BLINK_MIN_MS);
      blinkTimeout = setTimeout(() => {
        setBlinking(true);
        closeTimeout = setTimeout(() => {
          setBlinking(false);
          scheduleBlink();
        }, BLINK_DURATION_MS);
      }, delay);
    };
    scheduleBlink();
    return () => {
      clearTimeout(blinkTimeout);
      clearTimeout(closeTimeout);
    };
  }, [active]);

  if (imageFailed) {
    return <JaguarAvatar state={state} light={light} speaking={speaking} lang={lang} />;
  }

  const accent = guardianAccentFor(state, light);
  const label = SPOKEN_STATE[lang][state];
  const style = { "--guardian-accent": accent } as CSSProperties;
  // Transform directo, no var() dentro de `transform`: un custom property
  // referenciado con var() no dispara la `transition` de la propiedad que lo
  // usa en motores reales (solo se nota el salto, nunca la animación) —
  // hallazgo real al probar el seguimiento de mirada en un navegador, no
  // solo en el código. Con el valor puesto directo en línea, la transición
  // sí interpola con normalidad.
  const parallaxStyle: CSSProperties = {
    transform: `translate3d(${(gaze.x * 10).toFixed(2)}px, ${(gaze.y * 6).toFixed(2)}px, 0) scale(1.06)`,
  };

  return (
    <div
      ref={host}
      className={`guardian-stage portrait state-${state} light-${light}${speaking ? " speaking" : ""}${
        blinking ? " blinking" : ""
      }${active ? "" : " paused"}`}
      style={style}
      data-guardian-state={state}
    >
      <div className="portrait-parallax" style={parallaxStyle}>
        <picture>
          <source srcSet="/guardian/jaguar-portrait.webp" type="image/webp" />
          <img
            src="/guardian/jaguar-portrait.jpg"
            alt={label}
            className="portrait-img"
            onError={() => setImageFailed(true)}
            draggable={false}
          />
        </picture>
      </div>
      <div className="portrait-fx" aria-hidden="true">
        <span className="portrait-eye portrait-eye-left" />
        <span className="portrait-eye portrait-eye-right" />
        <span className="portrait-blink" />
        <span className="portrait-scan" />
        <span className="portrait-vignette" />
        <span className="portrait-mouth-glow" />
        <span className="portrait-mic-ring" />
      </div>
      <p className="visually-hidden" role="status">
        {label}
      </p>
    </div>
  );
}
