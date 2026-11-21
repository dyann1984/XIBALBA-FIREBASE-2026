"use client";

/**
 * Idioma de la interfaz, compartido por toda la aplicación.
 *
 * Tres cosas que antes no ocurrían y ahora sí:
 *  1. La elección persiste entre navegaciones y recargas (`localStorage`).
 *  2. El atributo `lang` del documento cambia con ella, así que un lector de
 *     pantalla pronuncia el idioma correcto.
 *  3. La voz del guardián usa ese mismo idioma al leer la explicación.
 *
 * El primer render siempre es en español, el idioma del HTML servido. La
 * preferencia se aplica después del montaje: leer `localStorage` durante el
 * render haría que el servidor y el cliente produjeran marcados distintos.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  LANG_STORAGE_KEY,
  LANG_TAG,
  isLang,
  resolveInitialLang,
  translatorFor,
  type Lang,
  type Translate,
} from "@/lib/i18n";

type LanguageValue = { lang: Lang; setLang: (next: Lang) => void; t: Translate };

const LanguageContext = createContext<LanguageValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("es");

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      let stored: string | null = null;
      try {
        stored = window.localStorage.getItem(LANG_STORAGE_KEY);
      } catch {
        // Modo privado o almacenamiento bloqueado: se sigue con el idioma del
        // navegador. No tener dónde guardar la preferencia no es un error.
      }
      setLangState(resolveInitialLang(stored, navigator.languages ?? [navigator.language]));
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = LANG_TAG[lang];
    // El <title> del documento viene fijo en español desde los metadatos del
    // servidor (Next.js no re-renderiza metadata por una elección de idioma
    // puramente en cliente). Sin esto, la pestaña del navegador se quedaba en
    // español aunque toda la interfaz ya hubiera cambiado a inglés.
    document.title = translatorFor(lang)("app", "documentTitle");
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    if (!isLang(next)) return;
    setLangState(next);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      // Sin almacenamiento el idioma dura lo que la pestaña. Es preferible a
      // no poder cambiarlo.
    }
  }, []);

  const value = useMemo<LanguageValue>(
    () => ({ lang, setLang, t: translatorFor(lang) }),
    [lang, setLang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n(): LanguageValue {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useI18n debe usarse dentro de LanguageProvider.");
  return value;
}
