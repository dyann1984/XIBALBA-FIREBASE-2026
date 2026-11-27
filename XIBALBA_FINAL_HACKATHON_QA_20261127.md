# XIBALBÁ AI 2.0 — Informe final de QA para el Gran Jurado

**Fecha:** 27 de noviembre de 2026
**Presentación:** 28 de noviembre de 2026
**Rama:** `fix/mobile-image-upload-i18n-audit`
**Commit definitivo:** `9fd820a`
**Punto de restauración:** etiqueta `restore-point-20261127` (sobre `release/xibalba-2.0-rc`, commit `867ec09`)

---

## 1. Veredicto

**GO CONDICIONADO.**

La aplicación está estable, es bilingüe completa, funciona en móvil (Chromium y WebKit reales) y
conserva intactas todas sus protecciones. El fallo de carga de imágenes en móvil que originó esta
auditoría está corregido y verificado contra el despliegue real, no solo en local.

La condición es una sola y **no es un defecto del código**: la clave de reCAPTCHA Enterprise que
respalda App Check no tiene autorizado el dominio del Preview, así que desde el Preview no hay
interpretación de Gemini. La demostración debe hacerse sobre un dominio cuya clave sí esté
autorizada (el de producción ya lo está), o bien autorizar el dominio del Preview antes de la
presentación. Detalle y procedimiento exacto en la sección 7, hallazgo **P1-01**.

Sin IA en la nube la aplicación **no se rompe ni inventa resultados**: el motor determinista emite
el veredicto, los cinco agentes trabajan, y la tarjeta de IA dice con todas sus letras
"No hay interpretación de IA disponible: Firebase rechazó la solicitud". Esa degradación honesta
está capturada como evidencia.

---

## 2. Entregables

| Elemento | Valor |
|---|---|
| Commit final | `9fd820a` |
| Rama publicada | `fix/mobile-image-upload-i18n-audit` (en `origin`) |
| Preview (alias estable) | **https://xibalba-rc-preview.vercel.app** |
| Preview (URL del despliegue) | https://xibalba-firebase-2026-fjobb0gcs-dyann1984s-projects.vercel.app |
| Producción actual (sin tocar) | `xibalba-firebase-2026-5l26o5wk1-...vercel.app` |
| Capturas del Preview | `artifacts/preview-20261127/` |

### URL para probar desde tu celular

El Preview conserva su protección de acceso (Vercel Authentication). Para entrar desde el celular
sin iniciar sesión, abre **una vez** este enlace; deja una cookie y después puedes navegar normal:

```
https://xibalba-rc-preview.vercel.app/?x-vercel-protection-bypass=<SECRETO>&x-vercel-set-bypass-cookie=true
```

`<SECRETO>` es el valor de *Protection Bypass for Automation*, generado con tu autorización.
**A propósito no se escribe en este archivo**, para no dejar una credencial en el repositorio: se
entregó por separado y puedes consultarlo o rotarlo en Vercel → Project Settings → Deployment
Protection → Protection Bypass for Automation.

Ese secreto **no desactiva la protección**: el resto del mundo sigue viendo el login. Es revocable
en cualquier momento desde esa misma pantalla.

---

## 3. Resultados de pruebas (exactos, sin omitir fallos)

| Suite | Resultado |
|---|---|
| `tsc --noEmit` (modo estricto) | **limpio**, 0 errores |
| ESLint 9 | **limpio**, 0 errores, 0 avisos |
| `npm run build` (producción) | **correcto**, 7 rutas generadas |
| Unitarias (`node --test`) | **243 pasadas / 0 fallidas / 0 omitidas** |
| E2E local (`playwright.config.ts`) | **61 pruebas: 54 pasadas, 7 omitidas, 0 fallidas** |
| IA real en la nube (`playwright.cloud.config.ts`) | **4 pasadas / 0 fallidas** |
| Móvil contra el Preview (`playwright.preview.config.ts`) | **8 pasadas / 0 fallidas** (4 pruebas × 2 motores) |

Las 7 pruebas omitidas en la batería local no son fallos encubiertos: son las de
`cloud-ai.spec.ts` (4) y `production-image-analysis.spec.ts` (3), que se saltan por diseño cuando
se ejecutan sin la configuración de nube. Las 4 de `cloud-ai.spec.ts` se ejecutaron aparte y
pasaron; las 3 de producción-imagen requieren un despliegue con App Check operativo y quedan
pendientes por el hallazgo P1-01.

### Carga de imágenes en móvil — contra el Preview real (HTTPS + CSP de producción)

Las cuatro pruebas corrieron en **Chromium móvil** y en **WebKit real (iPhone 13)**, apuntando al
despliegue, no a un servidor local:

| Prueba | Chromium móvil | WebKit / iPhone 13 |
|---|---|---|
| El input acepta `image/*` (no filtra HEIC fuera del picker de iOS) | PASS | PASS |
| Una foto HEIC sin convertir muestra un mensaje claro | PASS | PASS |
| Una foto JPEG con MIME vacío (quirk de WebView Android) sí se adjunta | PASS | PASS |
| Recorrido completo: galería → vista previa → OCR → veredicto → reemplazo → segundo análisis | PASS | PASS |

Comprobación directa sobre el Preview en WebKit: `#photo` tiene `accept="image/*"`.

---

## 4. Evidencia de Gemini e IA real

### En local, con App Check operativo — FUNCIONA

`playwright.cloud.config.ts`, 4/4 pasadas, con llamadas reales a Firebase + Gemini:

- Interpretación de IA en la nube real nunca baja un veredicto determinista — PASS
- Holograma del Guardián en estado de seguridad (verde) con IA real — PASS
- **IA en la nube en inglés** y recuperación limpia si se revoca el consentimiento — PASS
- IA real con captura sintética (OCR + Gemini), **latencia medida: 4253 ms** — PASS

Esto demuestra que la ruta de código completa —App Check → Firebase AI Logic → Gemini → parseo
del JSON → evidencias y recomendaciones— funciona de verdad, en ambos idiomas.

### Desde el Preview — BLOQUEADO (no por el código)

La página de diagnóstico propia de la aplicación (`/diagnostico-app-check`) comprueba cada etapa
por separado, sin inferir ninguna de otra. Resultado en el Preview:

| Etapa | Resultado |
|---|---|
| 1. SDK disponible | ✔ ok |
| 2. Servicio configurado (`initializeApp` + App Check) | ✔ ok |
| 3. **Autenticación exitosa (App Check)** | ✖ **fallo — `AppCheck: ReCAPTCHA error. (appCheck/recaptcha-error)`** |
| 4. Llamada real ejecutada (Gemini) | pendiente (bloqueada por la 3) |
| 5. Respuesta real obtenida | pendiente |
| 6. Llamada forzada a la nube (`ONLY_IN_CLOUD`) | pendiente |
| 7. Persistencia (Firestore) | no aplica — el proyecto no lee ni escribe en Firestore a propósito |

Las variables de entorno **sí** están configuradas para el entorno Preview en Vercel
(`NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY`, `..._API_KEY`, `..._APP_ID`, `..._PROJECT_ID`,
`..._AUTH_DOMAIN`), y la interfaz lo refleja: "Inferencia de IA · Nube: configurada". El fallo es
de dominio, no de configuración de la app. Ver P1-01.

**Importante:** el token de depuración local no se usó como evidencia del funcionamiento en el
despliegue. Las dos situaciones se reportan por separado, como corresponde.

---

## 5. Internacionalización

- **Paridad estructural garantizada por el compilador:** `dictionary.ts` declara
  `type Dictionary = typeof es` y `export const en: Dictionary`, así que a una clave que falte en
  inglés no la deja pasar el `tsc`.
- **Nueva prueba automática** `tests/i18n-parity.test.mjs`: igualdad de conjuntos de claves,
  ausencia de traducciones vacías y ausencia de traducciones idénticas, con listas de excepciones
  explícitas y justificadas. Pasa.
- **Dos huecos reales encontrados y corregidos** en esta sesión:
  - `HelpButton` tenía `aria-label="Cerrar"` fijo en español → ahora usa `t()`.
  - `QrDefense` tenía el placeholder de ejemplo fijo en español → ahora depende del idioma.
  - Clave nueva `globalShield.helpPanelClose` en ES y EN.
- **Verificado en vivo sobre el Preview en inglés** (captura
  `04-preview-veredicto-en-desktop.png`): el veredicto, el nivel de riesgo, la confianza, la
  cobertura de auditoría, el "WHY THIS RESULT", las evidencias verificadas, las recomendaciones,
  las limitaciones y las fuentes aparecen **todos en inglés**, mientras que
  **el contenido original en español se conserva intacto como evidencia** — que es exactamente el
  comportamiento pedido.
- **Nombres propios respetados:** CAMAZOTZ, IXBALANQUÉ, VUCUB CAMÉ y HUN CAMÉ no se traducen.
  "XIBALBÁ AI" se conserva como marca.
- **Desviación conocida:** "EL GUARDIÁN" sigue apareciendo así en inglés. Ver P2-01.

---

## 6. Guardián, voz y mapas 3D

Verificado por pruebas automáticas (todas en verde en la batería local) y confirmado en vivo sobre
el Preview:

- Holograma del Guardián: estados reposo y alerta reales. En el Preview, tras un análisis de
  riesgo alto, `data-guardian-state` = **`alerta`** (captura `03-preview-guardian-alerta.png`).
- `hologram-3d.spec.ts`: escritorio, móvil, selección de agente, **cero errores de consola** — PASS.
- Fallback seguro sin WebGL: muestra el JaguarAvatar 2.5D y el antifraude sigue usable — PASS.
- `maps-redesign.spec.ts`: Mapa de Investigaciones (estadísticas, leyenda, zoom, ES/EN) y Mapa 3D
  Maya (templos, FPS, móvil) — PASS. FPS medido de `GodsMap3D`: 7 en el entorno de prueba
  headless (ver P3-03).
- Micrófono, voz TTS y preguntas al Guardián con cambio de idioma — PASS.
- Cambio de idioma ES/EN **después** de analizar actualiza veredicto, evidencias y Guardián sin
  volver a llamar a la nube — PASS.
- En el Preview, el modelo 3D `/guardian/models/black-panther-base.glb` se sirve con **200**.

---

## 7. Hallazgos clasificados

### P0 — Críticos

**Ninguno.**

### P1 — Altos

#### P1-01 · App Check falla en el dominio del Preview (`appCheck/recaptcha-error`)

- **Qué pasa:** desde el Preview, App Check no consigue token y Firebase rechaza la petición, así
  que no hay interpretación de Gemini. El veredicto determinista y los cinco agentes siguen
  funcionando; la app lo dice explícitamente en vez de simular un resultado.
- **Causa:** la clave de reCAPTCHA Enterprise sólo tiene autorizados los dominios registrados en
  Google Cloud. El dominio del Preview no está en esa lista. No es un defecto del código ni de la
  configuración de Vercel: las variables de entorno del Preview están completas.
- **Por qué no afecta a producción:** el dominio de producción ya está autorizado; por eso la
  versión v2.0.0 publicada funciona con Gemini.
- **Cómo resolverlo (requiere tu acceso a Google Cloud):**
  1. Google Cloud Console → Security → reCAPTCHA Enterprise → la clave usada por App Check.
  2. En la lista de dominios, añadir: `xibalba-rc-preview.vercel.app`
  3. Guardar y esperar un par de minutos.
  4. Volver a abrir `https://xibalba-rc-preview.vercel.app/diagnostico-app-check` y pulsar
     "Comprobar con una llamada real a Gemini". Las etapas 3 a 6 deben pasar a ✔.
- **Por qué el alias:** se asignó el alias estable `xibalba-rc-preview.vercel.app` precisamente
  para que autorices **un solo dominio** y siga sirviendo en futuros despliegues del candidato, en
  vez de una URL distinta cada vez.
- **No se tocó ninguna protección** para rodear esto.

### P2 — Medios

#### P2-01 · "EL GUARDIÁN" no se traduce a "THE GUARDIAN"

- **Qué pasa:** en inglés, el quinto agente sigue apareciendo como "EL GUARDIÁN". Los rótulos del
  panel sí están traducidos ("GUARDIAN", "Guardian and explanation"), pero el nombre del agente no.
- **Por qué no se cambió hoy:** el nombre es un dato en `lib/agents.ts` que además usa el
  coordinador (`lib/analysis/coordinator.ts`) como etiqueta de actividad, y hay **18 referencias en
  pruebas** que lo afirman. Hacerlo dependiente del idioma obliga a pasar `lang` al motor de
  análisis y a reescribir esas pruebas: es un cambio invasivo en el motor determinista la víspera
  de la presentación, justo lo que pediste congelar.
- **Recomendación:** dejarlo para después del concurso, o decidirlo tú explícitamente y lo aplico
  con sus pruebas.

### P3 — Bajos

#### P3-01 · Vercel bloquea su propio script de feedback por nuestra CSP (solo en Preview)

Consola del Preview: `Loading the script 'https://vercel.live/_next-live/feedback/feedback.js'
violates ... script-src`. Es la barra de feedback que Vercel inyecta **solo en despliegues de
Preview**; no forma parte de la aplicación y no afecta a ninguna función. En producción no
aparece. En realidad es evidencia de que la CSP está haciendo su trabajo.

#### P3-02 · Aviso de `Feature-Policy` duplicada

Vercel añade su propia cabecera `Feature-Policy` con `camera`, que coexiste con nuestra
`Permissions-Policy`. El navegador avisa y **aplica la nuestra**, que es la correcta. Sin impacto.

#### P3-03 · FPS bajo del mapa 3D en entorno de prueba

`GodsMap3D` midió 7 FPS bajo Playwright headless sin aceleración por GPU. No es representativo de
un equipo o teléfono real con GPU. No se midió en hardware físico.

#### P3-04 · Aviso de hidratación de React en modo desarrollo

Observado únicamente con `next dev` (servidor del proyecto WebKit), sobre el `style={{}}` del
input de análisis rápido. No se reprodujo en el Preview ni en el build de producción.

---

## 8. Qué se corrigió en este commit

1. **Carga de imágenes en móvil (la causa raíz del fallo del 26-nov).**
   `ImageAttachments` enumeraba `accept="image/jpeg,image/png,image/webp"`. El selector de fotos de
   Safari en iOS **oculta las fotos que siguen en HEIC** —el formato por defecto de la cámara del
   iPhone— cuando se le da una lista enumerada en vez de `image/*`, dejando la galería
   aparentemente vacía. Ahora es `image/*`, e `describeImageRejection` sigue rechazando con mensaje
   bilingüe claro lo que de verdad no se soporta. Cubierto por 4 pruebas nuevas en dos motores.

2. **Dos huecos de internacionalización** (sección 5) más la prueba automática de paridad ES/EN.

3. **Batería de pruebas WebKit, con la causa raíz correcta.**
   Las pruebas en WebKit fallaban porque *ningún* botón respondía. El diagnóstico real, confirmado
   con los registros de red: el build de producción añade `upgrade-insecure-requests` a la CSP;
   **WebKit aplica esa directiva también a `127.0.0.1`** y reescribe todas las subpeticiones (JS,
   CSS, imágenes) a `https://`, que el servidor de pruebas local no habla — `SSL connect error` en
   cada una, página sin estilos ni JavaScript. Chromium no reescribe sobre loopback, por eso el
   problema sólo se veía en WebKit. La corrección es un servidor propio en modo `next dev` (donde
   la CSP omite esa directiva) con su propio `distDir`. **La CSP de producción quedó intacta**, y
   las pruebas contra el Preview por HTTPS confirman que bajo la CSP real todo carga.

4. **Corrección de un diagnóstico previo equivocado.** Se había puesto `workers: 1` creyendo que
   los fallos intermitentes al escribir capturas eran una colisión entre pruebas. Se reprodujo el
   mismo error con un solo worker, sobre un archivo nuevo y único: no era colisión, sino un bloqueo
   transitorio de Windows sobre el archivo recién creado. Se revirtió a ejecución paralela con
   `retries: 1`, que es la corrección real y ~6× más rápida.

---

## 9. Seguridad: qué NO se tocó

- CSP de producción: **intacta**, incluido `upgrade-insecure-requests`. Verificada en vivo sobre el
  Preview (cabecera completa recibida con HTTP 200).
- App Check y reCAPTCHA Enterprise: **sin desactivar**, ni para pasar pruebas ni para desbloquear
  el Preview.
- Cabeceras de seguridad en el Preview, comprobadas: `Content-Security-Policy`,
  `Permissions-Policy`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`.
- Protección del despliegue: **sigue activa**. El acceso se dio con un secreto de bypass revocable,
  con tu autorización, no desactivando la protección.
- Ningún secreto se escribió en el repositorio: `playwright.preview.config.ts` lee la URL y el
  secreto de variables de entorno.
- No se promovió nada a producción.

---

## 10. Procedimiento de rollback

**Si algo sale mal con el candidato, producción no se ve afectada:** nada se promovió. La versión
v2.0.0 publicada sigue siendo la que está en línea.

Para deshacer el trabajo de esta rama en local:

```powershell
git checkout release/xibalba-2.0-rc
git reset --hard restore-point-20261127
```

Para retirar el Preview y el acceso:

```powershell
vercel alias rm xibalba-rc-preview.vercel.app
```

El secreto de bypass se revoca en Vercel → Project Settings → Deployment Protection → Protection
Bypass for Automation.

Si en algún momento se promoviera a producción y hubiera que volver atrás, el despliegue de
producción actual es `xibalba-firebase-2026-5l26o5wk1-dyann1984s-projects.vercel.app`, y se
restaura con *Promote to Production* sobre él desde el panel de Vercel.

---

## 11. Limitaciones conocidas y lo que falta por probar

| Elemento | Estado |
|---|---|
| Gemini desde el Preview | **BLOQUEADO** por P1-01 (dominio sin autorizar en reCAPTCHA Enterprise) |
| Gemini en producción | **NO PROBADO en esta sesión** — funciona según la publicación de v2.0.0, pero no se reverificó hoy |
| Celular físico (Android / iPhone) | **NO PROBADO** — requiere tu dispositivo; la URL está en la sección 2 |
| Service Worker: actualización en dispositivo real | **NO PROBADO en hardware** — auditado por código: red primero para documentos, caché sólo para recursos con hash, purga de cachés viejas al activar, nunca cachea `/api/*` |
| FPS de los mapas 3D en hardware real | **NO MEDIDO** (ver P3-03) |
| `production-image-analysis.spec.ts` (3 pruebas) | **OMITIDAS** — requieren despliegue con App Check operativo |
| Traducción de "EL GUARDIÁN" | **DESVIACIÓN CONSCIENTE** (P2-01) |

---

## 12. Lo que necesito de ti antes de la presentación

1. **Autorizar el dominio `xibalba-rc-preview.vercel.app`** en la clave de reCAPTCHA Enterprise
   (sección 7, P1-01). Es lo único que separa al candidato de un GO sin condiciones.
2. **Probar desde tu celular** con el enlace de la sección 2, en Android y en iPhone si es posible:
   seleccionar una foto de la galería, ver la vista previa, correr el análisis y comprobar que el
   menú lateral y la navegación responden.
3. **Decidir sobre P2-01** ("EL GUARDIÁN" → "THE GUARDIAN"): dejarlo o aplicarlo con sus pruebas.
4. **Decidir la promoción a producción**, que sigue sin autorizar y no se hizo.

---

*Informe generado el 27 de noviembre de 2026 sobre el commit `9fd820a`. Todas las cifras de esta
página provienen de ejecuciones reales registradas en esta sesión; ninguna prueba se eliminó,
desactivó ni se dio por buena sin ejecutarla.*
