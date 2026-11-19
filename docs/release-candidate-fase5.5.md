# Reporte de Release Candidate — Fase 5.5

Fecha: 19 de noviembre de 2026. Rama evaluada: `codex/xibalba-3-phase5-command-center`,
commit `776e71a`. No se hizo push, merge a `release/xibalba-2026` ni despliegue.

## 1. Estado de Git y comparación con `release/xibalba-2026`

- Ancestro común (`merge-base`): `bb49ea6`.
- Desde ahí, esta rama tiene **15 commits** propios (Fases 2 a 5.4);
  `release/xibalba-2026` tiene **11 commits** propios, de una integración
  paralela anterior (`finalizacion-mvp` + `codex/finalizacion-xibalba`).
- `git diff --stat` entre ambas mostraba 164 archivos y ~18 800 líneas de
  diferencia — una cifra engañosa de un diff plano entre ramas divergentes,
  no de una fusión real.

## 2. Integración de prueba (rama temporal, sin tocar producción)

Se creó `rc-integration-test` a partir de esta rama y se fusionó
`release/xibalba-2026` con `git merge --no-ff --no-commit`. **9 conflictos
reales**, revisados uno por uno (no resueltos por regla automática):

| Archivo | Causa del conflicto | Resolución |
|---|---|---|
| `lib/analysis/errors.ts` | `release` no tiene `errorKey()` (claves de error para i18n) | Se conservó esta rama (superconjunto) |
| `lib/analysis/guardian.ts` | `release` no tiene `InputErrorCode` (i18n de errores de entrada) | Se conservó esta rama |
| `lib/history.ts` | `release` no tiene `domains`/`phonePrefixes`/`signalIds` (requeridos por la correlación y el mapa) ni `describeWhen(locale)` | Se conservó esta rama |
| `next.config.ts` | `release` todavía bloqueaba el micrófono (`microphone=()`), de antes de que existiera el dictado de voz real | Se conservó esta rama |
| `app/globals.css` | `release` no tiene el CSS del Guardián (SVG ni retrato), del mapa, ni la capa de dirección de arte | Se conservó esta rama |
| `components/Dashboard.tsx` | `release` no tiene i18n, mapa, pestañas del laboratorio, ni búsqueda de historial | Se conservó esta rama |
| `package.json` | Cada rama tenía un script de prueba distinto | Se combinaron ambos (`test` + `test:e2e`) |
| `docs/despliegue.md`, `docs/devpost.md`, `docs/jueces.md` | Cada rama escribió su propia versión del documento | Se conservó la de esta rama (más reciente, con las correcciones de exactitud de la Fase 5.3–5.4) |

**Hallazgo central de esta integración**: tras resolver los 9 conflictos,
`git diff codex/xibalba-3-phase5-command-center..rc-integration-test` dio
**cero diferencias**. `release/xibalba-2026` no aporta ninguna función, archivo
ni corrección que esta rama no tenga ya — es un subconjunto estricto. La
fusión real, cuando se autorice, será mecánicamente trivial: tomar esta rama
tal cual.

Un efecto secundario real se encontró y corrigió durante la propia
resolución: escribir los archivos resueltos con la redirección `>` de
PowerShell les añadió una marca BOM (`U+FEFF`) al inicio. Se detectó al ver
diffs de "0 líneas de contenido" con 1 línea marcada como cambiada, y se quitó
de los 9 archivos antes de continuar.

La rama temporal `rc-integration-test` se verificó completa y se **borró**
al terminar: no queda ningún artefacto de esta prueba en el repositorio.

## 3. Pruebas ejecutadas (en la rama de trabajo final, no en un entorno aparte)

| Comprobación | Resultado |
|---|---|
| `tsc --noEmit` | 0 errores |
| `eslint .` | 0 problemas |
| `node --test` (unitarias) | **204 / 204** |
| `next build` | Compiló limpio. First Load JS de la portada: 261 kB |
| Playwright, batería principal | **22 / 22** (2 omitidos correctamente: dependen de servicios en la nube y corren en su propia config) |
| Playwright, batería de nube (`playwright.cloud.config.ts`) | **2 / 2**, contra Firebase App Check + Gemini reales |
| **Total** | **226 / 226** |

## 4. Verificación funcional

- **Guardián**: retrato premium carga (`<picture>` con WebP/JPG), estados
  reposo/alerta confirmados con el motor local; estado "seguridad" (verde)
  confirmado con una respuesta real de Gemini.
- **Firebase y Gemini**: token de App Check real obtenido, llamada real al
  modelo respondida, regla "la IA no baja un veredicto determinista"
  verificada con una respuesta real, no simulada.
- **Historial**: una entrada real se guardó y se mostró correctamente.
- **Mapa de investigaciones**: el caso real apareció como nodo; al
  seleccionarlo, mostró su evidencia real y el mensaje honesto de "sin
  conexión" al no compartir nada con otro caso.
- **Idiomas**: cambio EN→ES confirmado en la pantalla del mapa, con toda la
  interfaz traducida, no solo la navegación.
- **PWA**: manifest sirve los iconos PNG correctos (`any` y `maskable`); el
  *service worker* `xibalba-shell-v2` queda activo sin ninguna caché vieja.
- **Consola**: sin errores reales durante todo el recorrido (los únicos
  mensajes de error observados en las herramientas de depuración resultaron
  ser una lectura repetida de un búfer de una navegación muy anterior en esta
  misma sesión, no errores nuevos — se confirmó con una captura de pantalla
  real de la página, completamente renderizada, en el mismo instante).

## 5. Service worker: ¿sirve algo obsoleto tras actualizar?

Comprobado explícitamente: tras un `next build` nuevo y recargar, la caché
contiene únicamente `xibalba-shell-v2` (sin restos de `v1`), y el documento
HTML se sirve con **red primero** (corregido en la Fase 5.4 tras encontrar
el bug real: antes, un HTML cacheado podía referenciar archivos de un build
anterior y producir 404). Solo `/_next/static/*` —nombrado con un hash de su
propio contenido— sigue en caché primero, que es seguro porque esa URL nunca
cambia de contenido bajo el mismo nombre.

## 6. Variables de entorno, seguridad, App Check y Vercel

- `.env.example` no contiene ningún valor real; `.env.local` no está
  versionado (confirmado: `git ls-files` solo lista `.env.example`).
- `firestore.rules` y `storage.rules` deniegan todo acceso — correcto,
  ningún código del proyecto lee o escribe ahí todavía.
- `next.config.ts`: CSP de refuerzo, `Permissions-Policy` con cámara y
  micrófono habilitados **solo** para las funciones reales que los usan bajo
  consentimiento explícito (nunca en segundo plano).
- `vercel.json` fija framework Next.js y los comandos de build; no requiere
  cambios para esta integración.
- **`NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` sigue vacía** en todo entorno
  salvo el token de depuración local: la interpretación de IA en producción
  seguirá sin activarse hasta que exista una clave real de reCAPTCHA
  Enterprise (ver `docs/app-check.md`, ya escrito, nada nuevo que hacer aquí
  salvo conseguir la clave).

## 7. Lista exacta de acciones para publicar

### Bloqueos obligatorios (sin esto, no se puede publicar de forma responsable)

1. **Decidir y ejecutar la fusión real** de
   `codex/xibalba-3-phase5-command-center` a `release/xibalba-2026` (o cambiar
   cuál rama es la de producción en Vercel). Mecánicamente trivial según el
   §2 de este reporte, pero es una decisión humana, no técnica.
2. **Autorización explícita de la persona responsable** antes de cualquier
   `git push`, `merge` a la rama de producción o despliegue — ninguna de las
   tres se ha hecho.
3. Si se quiere la interpretación de IA en producción: conseguir la clave de
   sitio de reCAPTCHA Enterprise y cargarla en Vercel (`NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY`),
   y añadir el dominio de producción a esa clave. **Sin esto la aplicación
   sigue siendo publicable y honesta** — se desplegaría anunciando «IA · SIN
   CONFIGURAR» y ejecutando solo la auditoría determinista, que es real y
   completa.
4. Ejecutar la suite completa una vez más **en Node 24.x** (el entorno de
   desarrollo de esta sesión está en Node 22.23.4; Vercel sí usa 24.x según
   `engines`, y CI lo verificó en una fase anterior, pero con un conteo de
   pruebas desactualizado — conviene una corrida de CI fresca con las 226
   pruebas actuales antes de fusionar).

### Mejoras opcionales (no bloquean publicar, decisión de producto)

- Un modelo 3D rigged del Guardián con licencia verificada (el retrato actual
  ya es premium y honesto sobre no serlo; ver `docs/guardian-visual.md`).
- Verificación en un iPhone físico (esta sesión solo pudo emular Android).
- Una medición de Lighthouse *performance* en una máquina sin otros procesos
  compitiendo por CPU (accesibilidad, buenas prácticas y SEO ya dieron 100).
- Mapa de investigaciones con más dimensiones de correlación.
- Habilitar DNS/RDAP externos (`XIBALBA_EXTERNAL_AUDITS`), decisión consciente
  y documentada aparte.

## 8. Capturas de la versión integrada

Generadas en esta sesión, reales (Playwright + navegador manual), en
`artifacts/xibalba-3-phase5.4/` y `artifacts/xibalba-3-phase5.3/`: retrato del
Guardián en sus tres estados verificados, mapa de investigaciones en inglés y
español, veredicto rojo con evidencia, historial.

## 9. Veredicto

**No se puede publicar todavía — no por un defecto técnico, sino porque falta
la decisión y la autorización humana de los puntos 1 y 2 del §7.** Desde el
punto de vista técnico, esta rama está lista: 226/226 pruebas reales en
verde, cero conflictos sin resolver contra la rama de producción (la fusión
sería trivial), el service worker ya no sirve nada obsoleto, y la aplicación
es honesta y funcional con o sin la clave de App Check. Lo único que un
humano debe decidir es *cuándo* fusionar y desplegar, no *si la base está
lista*.
