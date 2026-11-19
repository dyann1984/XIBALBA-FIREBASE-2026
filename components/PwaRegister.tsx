"use client";
import { useEffect } from "react";

/** Registra el service worker del cascaron (ver public/sw.js). Si falla o el
 * navegador no lo soporta, la app sigue funcionando igual, solo sin el modo
 * instalable/offline. */
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
