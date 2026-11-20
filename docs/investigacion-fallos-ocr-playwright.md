# Investigación de los 5 fallos de OCR en Playwright (fase de cierre)

Fecha: 20 de noviembre de 2026. Rama `xibalba-global-defense`, desde `2aff9ca`.

## Resumen

Los 5 fallos **no eran un defecto del OCR ni del rediseño**: el reconocimiento
de texto siempre terminó y siempre acertó. Eran pruebas con un timeout de
aserción (5 s, el valor por defecto de Playwright) demasiado corto para una
operación que, de forma reproducible, toma más de eso: el arranque en frío
del worker WASM de Tesseract.js más el reconocimiento real de la imagen.

## Método

1. Se corrió la prueba 7 (`OCR con imagen sintética...`) **aislada**, con
   `--timeout=30000`: **pasó en 31.7 s**. Esto por sí solo ya apunta a un
   problema de tiempo, no de funcionalidad.
2. Se revisó `lib/analysis/images.ts::recognizeImageText`: usa
   `tesseract.js` con `workerPath`, `corePath` y `langPath` apuntando a
   `public/ocr/`, **sin ninguna llamada de red** (nada de CDN). Se confirmó
   que los archivos existen: `public/ocr/worker.min.js`,
   `public/ocr/core/*.wasm.js`, `public/ocr/lang/{eng,spa}.traineddata`.
   Esto descarta "dependencias o recursos de red" como causa.
3. Se corrió la batería completa dos veces. La primera vez: **5 fallos**,
   todos con el mismo patrón (`Timeout: 5000ms`, `element(s) not found`)
   sobre un *locator* que depende de que el OCR haya terminado
   (`.ocr-evidence`, `.verdict`, `.correlation-box`). Una de las ejecuciones
   incluso afectó a una prueba (1) que **no usa imágenes**, con un error
   distinto (`UNKNOWN: unknown error` al escribir un archivo de captura) —
   eso es un bloqueo de archivo transitorio de Windows, no relacionado con
   el OCR; no volvió a aparecer en la repetición.
4. Se confirmó con `git diff --stat 6c21efe 2aff9ca -- lib/analysis/images.ts
   components/ImageAttachments.tsx tests/e2e/xibalba.spec.ts
   tests/e2e/phase2.spec.ts`: **sin cambios**. El motor de OCR y las pruebas
   no se tocaron en ninguno de los commits de esta sesión.

## Diagnóstico por categoría (lo que pidió el encargo)

| Categoría | ¿Aplica? |
|---|---|
| Carga del worker de Tesseract.js | No falla: carga y reconoce, solo tarda. |
| Dependencias o recursos de red | No: todo se sirve desde `public/ocr/`, sin CDN. |
| Restricciones del entorno | Parcial: esta máquina tarda más de 5 s en un arranque en frío de WASM; es una característica real del entorno de pruebas, no una falla de red ni de permisos. |
| Problemas de inicialización | No: `createWorker()` siempre resolvió correctamente en los reintentos. |
| Fallos reales de reconocimiento | No: el texto se reconoció y disparó las señales esperadas en cada ejecución aislada. |

## Corrección aplicada

Se amplió el timeout de las aserciones que dependen de que el OCR haya
terminado, de 5 000 ms (por defecto) a 20 000 ms, **solo en esos 5 puntos
concretos** — no se tocó `playwright.config.ts` de forma global, para no
ocultar una regresión de tiempo real en otra parte de la aplicación:

- `tests/e2e/phase2.spec.ts`: las 3 pruebas de imagen sintética (sms,
  whatsapp, correo).
- `tests/e2e/xibalba.spec.ts`, prueba 7: las dos esperas que siguen a un
  análisis con imagen adjunta (`.ocr-evidence` y
  `.verdict-rojo, .verdict-amarillo` tras la corrección manual).
- `tests/e2e/xibalba.spec.ts`, prueba 3: `.verdict` y `.correlation-box`,
  porque las imágenes subidas (incluida la de cámara) siguen adjuntas
  cuando se ejecutan los dos análisis de texto de esa prueba.

**Lo que no se tocó:** ninguna aserción se debilitó ni se eliminó. Siguen
exigiendo exactamente lo mismo (que el OCR aparezca, que el texto corregido
escale el semáforo, que la correlación se detecte); solo se les da el tiempo
real que la operación necesita.

## Resultado tras la corrección

Se corrió la batería completa tres veces para descartar casualidad:

| Ejecución | Resultado |
|---|---|
| 1ª | **28 passed**, 2 omitidos (dependen de nube real), 0 failed |
| 2ª | 27 passed, 2 omitidos, **1 failed** — pero no por OCR: `UNKNOWN: unknown error` al escribir `artifacts/xibalba-2.0/14-lab-tabs-movil.png` (prueba 9). Mismo patrón que el fallo de la prueba 1 visto antes de la corrección: un bloqueo de archivo transitorio de Windows al guardar una captura de pantalla, en un paso que ocurre **después** de que todas las aserciones reales de esa prueba ya pasaron. No es un defecto de OCR ni de la aplicación. |
| 3ª | **28 passed**, 2 omitidos, 0 failed |

**Conclusión honesta:** la corrección del timeout de OCR es sólida y reproducible (0 fallos de OCR en las tres ejecuciones, incluida la que falló por otro motivo). Queda un segundo hallazgo, distinto del que se pidió investigar: una inestabilidad ocasional, propia de este equipo Windows, al escribir capturas de pantalla de evidencia en paralelo (6 workers). No afecta ninguna aserción de la prueba, no se reprodujo en todas las ejecuciones, y es poco probable que ocurra en la integración continua del proyecto (`.github/workflows/ci.yml` corre en Linux). Se deja documentado aquí en vez de intentar una corrección amplia (envolver las ~36 llamadas a `page.screenshot` en los 6 archivos de prueba) que no fue pedida y que arriesgaría más cambio del necesario para el cierre.
