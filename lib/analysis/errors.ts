// Traducción de errores a algo que la persona pueda leer.
//
// Vive en su propio módulo por una razón práctica: `analyze.ts` importa
// `@/lib/firebase`, un alias que solo resuelve dentro de Next, así que nada de
// lo que esté ahí se puede probar con `node --test`. El manejo de errores pasó
// a ser parte de la superficie de seguridad —decide qué texto ve la persona y
// cuál no sale nunca del dispositivo—, de modo que tiene que ser verificable.
//
// `analyze.ts` lo reexporta: para el resto del código nada cambia.

import { InputError } from './guardian.ts';

/**
 * Clave del mensaje que debe verse, para que la interfaz pueda mostrarlo en el
 * idioma elegido. `explainError` se conserva tal cual —devuelve el texto en
 * español— porque hay código y pruebas que dependen de él; esta función es la
 * misma clasificación expresada como clave.
 */
export type ErrorKey =
  | 'inputEmpty'
  | 'inputLong'
  | 'inputUrl'
  | 'inputUrlScheme'
  | 'config'
  | 'quota'
  | 'permission'
  | 'network'
  | 'format'
  | 'generic';

/**
 * Mensajes en español por clave, usados solo por `explainError` (ver su
 * comentario) y derivados de la misma clasificación que `errorKey`, para que
 * ninguna de las dos se desincronice de la otra.
 */
const SPANISH_MESSAGE: Record<Exclude<ErrorKey, 'inputEmpty' | 'inputLong' | 'inputUrl' | 'inputUrlScheme'>, string> = {
  config:
    'Falta completar la configuración de Firebase o de App Check: la interpretación de IA no está disponible. La auditoría local sigue funcionando.',
  quota: 'Se alcanzó un límite de uso. Espera antes de volver a intentar.',
  permission: 'Firebase rechazó la solicitud. Revisa App Check y los permisos del proyecto.',
  network: 'No se pudo conectar. Comprueba tu conexión y vuelve a intentar.',
  format: 'El modelo devolvió una respuesta que no cumple el formato exigido; se descartó.',
  generic: 'No se pudo completar el análisis. Inténtalo de nuevo.',
};

export function errorKey(error: unknown): ErrorKey {
  if (error instanceof InputError) return error.code;
  // El texto exacto del proveedor (App Check, reCAPTCHA, Gemini, red) nunca
  // debe llegar a la pantalla: puede traer rutas o identificadores del
  // proyecto. Pero tampoco debe perderse: queda en la consola del
  // navegador, donde quien depura la vista previa o producción puede leerlo,
  // sin exponerlo a quien solo usa la aplicación.
  if (typeof console !== 'undefined') console.error('[xibalba] interpretación de IA falló:', error);
  const message = error instanceof Error ? error.message : '';
  // Antes que la rama de App Check: «Falta configurar Firebase y App Check»
  // contiene «App Check» y caía en el mensaje de rechazo, que acusaba a
  // Firebase de rechazar una solicitud que nunca llegó a salir del dispositivo.
  if (/falta configurar/i.test(message)) return 'config';
  if (/429|quota|resource.exhausted/i.test(message)) return 'quota';
  if (/403|permission|app.?check/i.test(message)) return 'permission';
  if (/network|fetch|offline/i.test(message)) return 'network';
  if (/formato esperado/i.test(message)) return 'format';
  return 'generic';
}

/**
 * Texto en español de `errorKey`. Se conserva para quien no tenga el idioma
 * de la interfaz a mano (pruebas, módulos sin React): la interfaz misma debe
 * preferir `t("errors", errorKey(error))`, que sí traduce al inglés — usar
 * este texto tal cual en una pantalla en inglés fue el defecto real que
 * motivó separar la clasificación (`errorKey`) del texto (este mapa).
 *
 * Un `InputError` lo escribimos nosotros sobre lo que la persona tecleó
 * («Introduce una URL completa…»), así que se muestra tal cual.
 */
export function explainError(error: unknown): string {
  if (error instanceof InputError) return error.message;
  return SPANISH_MESSAGE[errorKey(error) as keyof typeof SPANISH_MESSAGE] ?? SPANISH_MESSAGE.generic;
}
