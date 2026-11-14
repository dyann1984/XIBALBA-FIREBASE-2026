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
 * Dos reglas que no se mezclan:
 *
 *  1. Un `InputError` lo escribimos nosotros sobre lo que la persona tecleó
 *     («Introduce una URL completa…»), así que se muestra tal cual. Si no, la
 *     interfaz diría «no se pudo completar el análisis» ante una URL mal
 *     escrita y nadie sabría qué corregir.
 *  2. Cualquier otro error —modelo, red, proveedor— se reduce a un mensaje
 *     nuestro. Su texto no es nuestro: puede traer rutas, identificadores de
 *     proyecto o detalles internos que no tienen por qué aparecer en pantalla.
 */
export function explainError(error: unknown): string {
  if (error instanceof InputError) return error.message;
  const message = error instanceof Error ? error.message : '';
  // Antes que la rama de App Check: «Falta configurar Firebase y App Check»
  // contiene «App Check» y caía en el mensaje de rechazo, que acusaba a
  // Firebase de rechazar una solicitud que nunca llegó a salir del dispositivo.
  if (/falta configurar/i.test(message)) {
    return 'Falta completar la configuración de Firebase o de App Check: la interpretación de IA no está disponible. La auditoría local sigue funcionando.';
  }
  if (/429|quota|resource.exhausted/i.test(message)) {
    return 'Se alcanzó un límite de uso. Espera antes de volver a intentar.';
  }
  if (/403|permission|app.?check/i.test(message)) {
    return 'Firebase rechazó la solicitud. Revisa App Check y los permisos del proyecto.';
  }
  if (/network|fetch|offline/i.test(message)) {
    return 'No se pudo conectar. Comprueba tu conexión y vuelve a intentar.';
  }
  if (/formato esperado/i.test(message)) {
    return 'El modelo devolvió una respuesta que no cumple el formato exigido; se descartó.';
  }
  return 'No se pudo completar el análisis. Inténtalo de nuevo.';
}
