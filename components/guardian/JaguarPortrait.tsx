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

  return (
    <div
      ref={host}
      className={`guardian-stage portrait state-${state} light-${light}${speaking ? " speaking" : ""}${
        blinking ? " blinking" : ""
      }${active ? "" : " paused"}`}
      style={style}
      data-guardian-state={state}
    >
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
      <div className="portrait-fx" aria-hidden="true">
        <span className="portrait-eye portrait-eye-left" />
        <span className="portrait-eye portrait-eye-right" />
        <span className="portrait-blink" />
        <span className="portrait-scan" />
        <span className="portrait-vignette" />
        <span className="portrait-mouth-glow" />
      </div>
      <p className="visually-hidden" role="status">
        {label}
      </p>
    </div>
  );
}
