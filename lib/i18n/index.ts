// Núcleo de internacionalización. Sin dependencias: el diccionario es un
// objeto y la traducción, una búsqueda por ruta con sustitución de variables.
//
// Se mantiene fuera de React a propósito para poder probarlo con `node --test`,
// igual que el resto de la lógica.

import { en, es, type Dictionary } from "./dictionary.ts";

export type Lang = "es" | "en";

export const LANGS: Lang[] = ["es", "en"];

/** Clave del idioma elegido. Es una preferencia, no un dato personal. */
export const LANG_STORAGE_KEY = "xibalba.idioma.v1";

const DICTIONARIES: Record<Lang, Dictionary> = { es, en };

/** Etiqueta corta para el selector. No se traduce: es el idioma en sí. */
export const LANG_LABEL: Record<Lang, string> = { es: "ES", en: "EN" };

/** Etiqueta del `lang` del documento, que los lectores de pantalla usan. */
export const LANG_TAG: Record<Lang, string> = { es: "es-MX", en: "en-US" };

export function isLang(value: unknown): value is Lang {
  return value === "es" || value === "en";
}

type Section = keyof Dictionary;
type KeyOf<S extends Section> = keyof Dictionary[S];

/**
 * Traduce `sección.clave` y sustituye `{variable}` por su valor.
 *
 * Nunca devuelve la clave cruda: si algo faltara, cae al español, que es el
 * idioma de origen. Una pantalla a medias en español se entiende; una llena de
 * identificadores, no.
 */
export function translate(
  lang: Lang,
  section: Section,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const dictionary = DICTIONARIES[lang] ?? es;
  const group = dictionary[section] as Record<string, string> | undefined;
  const fallback = (es[section] as Record<string, string> | undefined)?.[key];
  const raw = group?.[key] ?? fallback ?? "";
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** Firma cómoda para los componentes: `t("analyze", "panelTitle")`. */
export type Translate = <S extends Section>(
  section: S,
  key: KeyOf<S> & string,
  vars?: Record<string, string | number>,
) => string;

export function translatorFor(lang: Lang): Translate {
  return (section, key, vars) => translate(lang, section, key as string, vars);
}

/**
 * Idioma inicial. El orden importa: lo que la persona eligió antes manda sobre
 * lo que diga el navegador, y el español es el idioma del proyecto.
 */
export function resolveInitialLang(stored: string | null, navigatorLangs: readonly string[]): Lang {
  if (isLang(stored)) return stored;
  for (const tag of navigatorLangs) {
    const base = tag.slice(0, 2).toLowerCase();
    if (base === "es") return "es";
    if (base === "en") return "en";
  }
  return "es";
}

export { en, es, type Dictionary };
