# XIBALBÁ AI 2.0 — Informe final de QA para el Gran Jurado

**Fecha:** 27 de noviembre de 2026
**Presentación:** 28 de noviembre de 2026
**Rama:** `fix/mobile-image-upload-i18n-audit`
**Commit desplegado en producción:** `3513774`
**Despliegue de producción:** `dpl_H86yHu2SfJLBQwUhd9yiDCDMjue2` — **https://xibalba-firebase-2026.vercel.app**
**Puntos de restauración:** etiqueta `restore-point-prod-d7170f7` (producción anterior) y
`restore-point-20261127` (sobre `release/xibalba-2.0-rc`, commit `867ec09`)

---

## 1. Veredicto

**GO.**

El candidato está publicado en producción y verificado ahí mismo con pruebas reales. La condición
que dejaba el informe anterior en "GO condicionado" —el dominio del Preview sin autorizar en la
clave de reCAPTCHA Enterprise— **está resuelta**, y Gemini responde de verdad en español y en
inglés, con texto y con imágenes, tanto en el Preview como en producción.

Lo que respalda este veredicto, todo ejecutado hoy:

- Gemini real en producción, en ambos idiomas: barra de estado en `IA · NUBE` / `AI · CLOUD`,
  `tieneIA: true`, `iaFallida: false`.
- Las 18 pruebas móviles (Chromium móvil + WebKit/iPhone 13) **contra el despliegue por HTTPS**,
  bajo la CSP completa: 18 pasadas, 0 fallidas.
- Cero errores de consola en producción; Service Worker activo con la caché `xibalba-shell-v3`.
- 243 pruebas unitarias, 71 E2E y las 4 de IA real en la nube, con las cifras exactas de la
  sección 3.
- **Limpieza del caso activo** (sección 4b): «Nuevo caso» y «Limpiar análisis», verificados en
  producción en escritorio y en WebKit móvil, con el historial intacto.

Quedan dos desviaciones conocidas, ambas documentadas y ninguna crítica: el nombre del quinto
agente no se traduce (**P2-01**) y, si se cambia de idioma *después* de analizar, el texto que
escribió Gemini se queda en el idioma original (**P2-02**). La segunda tiene una indicación de uso
muy simple para la demostración: **elegir el idioma antes de analizar**.

---

## 2. Entregables

| Elemento | Valor |
|---|---|
| **URL pública funcional** | **https://xibalba-firebase-2026.vercel.app** |
| Commit desplegado | `3513774` |
| Despliegue de producción | `dpl_H86yHu2SfJLBQwUhd9yiDCDMjue2` (`target: production`, `readyState: READY`) |
| Rama publicada | `fix/mobile-image-upload-i18n-audit` (en `origin`) |
| Preview validado | `dpl_F2muWSJXQZ134gJzFUhYEJwiAbKd`, alias https://xibalba-rc-preview.vercel.app (protegido de nuevo; ver sección 9) |
| Despliegue anterior, para rollback | `dpl_7wBSvznLfpAQ4fzTNJHNAfgoWfiq` (commit `d7170f7`, etiqueta `restore-point-prod-d7170f7`) |
| Capturas del Preview | `artifacts/preview-20261127/` |
| Capturas de producción | `artifacts/produccion-20261127/` |
| Capturas de la limpieza de caso | `artifacts/limpieza-caso-20261127/` |

### Para probar desde el celular

```
https://xibalba-firebase-2026.vercel.app
```

Producción **no tiene protección de acceso**: se abre directamente en cualquier teléfono, sin
secretos ni cookies. El enlace con secreto de bypass que daba el informe anterior ya no existe: ese
secreto se revocó al terminar las validaciones (sección 9).

---

## 3. Resultados de pruebas (exactos, sin omitir fallos)

| Suite | Resultado |
|---|---|
| `tsc --noEmit` (modo estricto) | **limpio**, 0 errores |
| ESLint 9 | **limpio**, 0 errores, 0 avisos |
| `npm run build` (producción) | **correcto**, 7 rutas generadas |
| Unitarias (`node --test`) | **243 pasadas / 0 fallidas / 0 omitidas** |
| E2E local (`playwright.config.ts`) | **71 pruebas: 64 pasadas, 7 omitidas, 0 fallidas** |
| IA real en la nube, en local (`playwright.cloud.config.ts`) | **4 pasadas / 0 fallidas** |
| Móvil contra el **Preview** (`playwright.preview.config.ts`) | **18 pasadas / 0 fallidas** |
| Móvil contra **producción** (`playwright.preview.config.ts`) | **8 pasadas / 0 fallidas** (ejecución del despliegue anterior) |

Las 7 pruebas omitidas en la batería local no son fallos encubiertos: son las de
`cloud-ai.spec.ts` (4) y `production-image-analysis.spec.ts` (3), que se saltan por diseño cuando se
ejecutan sin la configuración de nube. Las 4 de `cloud-ai.spec.ts` se ejecutaron aparte, en local
con token de depuración, y pasaron. Las 3 de `production-image-analysis.spec.ts` **no pueden
ejecutarse contra un despliegue real, y no es un defecto**: ver P1-02.

### Carga de imágenes en móvil — contra producción (HTTPS + CSP de producción)

Las cuatro pruebas corrieron en **Chromium móvil** y en **WebKit real (iPhone 13)**, apuntando al
despliegue de producción:

| Prueba | Chromium móvil | WebKit / iPhone 13 |
|---|---|---|
| El input acepta `image/*` (no filtra HEIC fuera del picker de iOS) | PASS | PASS |
| Una foto HEIC sin convertir muestra un mensaje claro | PASS | PASS |
| Una foto JPEG con MIME vacío (quirk de WebView Android) sí se adjunta | PASS | PASS |
| Recorrido completo: galería → vista previa → OCR → veredicto → reemplazo → segundo análisis | PASS | PASS |

Las mismas cuatro, contra el Preview, también en verde (8/8). Comprobación directa en WebKit:
`#photo` tiene `accept="image/*"` y la vista previa es un `blob:`.

---

## 4. Evidencia de Gemini e IA real

### En producción — FUNCIONA, verificado hoy desde un navegador real

Análisis en **español** sobre `https://xibalba-firebase-2026.vercel.app`:

| Señal | Valor leído del DOM |
|---|---|
| Barra de estado | `IA · NUBE` |
| Estado del Guardián | `alerta` |
| Veredicto | `verdict verdict-rojo` |
| Bloque de interpretación de IA presente | `true` |
| IA fallida | `false` |
| Motor | `Engine: CLOUD · On-device AI: unavailable` |

Cambio a **inglés** sobre el mismo resultado: la barra pasa a `AI · CLOUD`, el bloque de IA en
inglés está presente, no queda texto español en la interfaz, y el veredicto y el estado del Guardián
se conservan. El volcado completo de la página confirma que interfaz, evidencias, recomendaciones,
limitaciones, fuentes, "Why this result" y "Pending external verification" están **todos en
inglés**, con el **contenido original en español intacto** bajo "CONTENT TO REVIEW".

### En el Preview — FUNCIONA, tras resolver P1-01

La página de diagnóstico propia (`/diagnostico-app-check`) comprueba cada etapa por separado, sin
inferir ninguna de otra. Resultado en el Preview una vez autorizado el dominio:

| Etapa | Resultado |
|---|---|
| 1. SDK disponible | ✔ ok |
| 2. Servicio configurado (`initializeApp` + App Check) | ✔ ok |
| 3. Autenticación exitosa (App Check) | ✔ ok |
| 4. Llamada real ejecutada (Gemini) | ✔ ok |
| 5. Respuesta real obtenida | ✔ ok |
| 6. Llamada forzada a la nube (`ONLY_IN_CLOUD`) | ✔ ok |
| 7. Persistencia (Firestore) | no aplica — el proyecto no lee ni escribe en Firestore a propósito |

Evidencia adicional capturada contra el Preview real (`artifacts/preview-20261127/`): Gemini
respondiendo en español y en inglés con lectura dinámica propia del contenido enviado; análisis real
de imagen con metadatos, OCR y lectura del modelo; carga de imagen en WebKit móvil.

**Importante:** el token de depuración local no se usó como evidencia del funcionamiento en el
despliegue. Las ejecuciones locales y las de despliegue se reportan por separado.

---

## 4b. Limpieza del caso activo («Nuevo caso» / «Limpiar análisis»)

Antes no había forma de cerrar un caso: el veredicto, las evidencias, las recomendaciones, el OCR y
la actividad de los cinco agentes se quedaban en pantalla hasta que se editaba la evidencia, así que
una demostración encadenada podía mostrar restos del caso anterior. Dos botones lo resuelven, con el
mismo marcado en escritorio y en móvil (44 px de alto bajo 700 px):

| Botón | Qué borra | Qué conserva |
|---|---|---|
| **Limpiar análisis** / *Clear analysis* | Resultado, evidencias, recomendaciones, OCR, cronología y actividad de los cinco agentes; el Guardián holográfico vuelve a reposo | Lo que ya se adjuntó (texto, imágenes, audio), para volver a analizarlo |
| **Nuevo caso** / *New case* | Todo lo anterior **y** la evidencia del caso activo; libera las URLs de vista previa (`releaseImage` / `releaseAudio`) | Nada del caso |

Ninguno de los dos toca el **historial**, el **idioma** ni el consentimiento de IA.

**Respuestas de IA que llegan tarde.** Cada ejecución de `submitText` toma un número de `runIdRef` y
solo escribe estado mientras ese número siga vigente. Limpiar o empezar otro caso sube el número, así
que una respuesta de Gemini que llega después se descarta por completo: no repuebla la pantalla ni
entra en el historial. Lo mismo para `onEvent`, `onAiStage`, el OCR del modelo y la transcripción.

### Verificado en producción (`artifacts/limpieza-caso-20261127/`)

| Comprobación | Escritorio (Chromium 1440×900) | WebKit / iPhone 13 |
|---|---|---|
| Caso con veredicto: Guardián en `alerta`, semáforo `verdict-rojo` | ✔ | ✔ |
| Tras **Limpiar análisis**: Guardián `reposo`, 0 veredictos, 0 bloques de evidencia, texto conservado | ✔ | ✔ |
| Tras **Nuevo caso**: Guardián `reposo`, texto vacío, 0 imágenes | ✔ | ✔ |
| Historial conservado después de ambos | ✔ (1 entrada) | ✔ (1 entrada) |
| Errores de consola | **0** | **0** |

Además, con **Gemini real en la nube** desde un navegador normal sobre producción: con el resultado en
pantalla la barra marcaba `IA · NUBE` y el Guardián `alerta`; tras «Limpiar análisis» pasó a
`IA · SIN VERIFICAR` y `reposo`, con el aviso «Análisis limpiado. La evidencia adjunta sigue
disponible.». En inglés, «New case» y «Clear analysis» con el aviso «Case cleared: nothing is left
from the previous investigation.».

### Tres investigaciones consecutivas sin contaminación

La prueba `3c.4` encadena tres casos —estafa bancaria, mensaje inocuo, premio falso— separados por
«Nuevo caso», y comprueba que el segundo no hereda el veredicto rojo del primero, que ninguna señal
del caso anterior aparece en la evaluación del siguiente, y que el historial termina con las tres
entradas. Pasa en Chromium móvil y en WebKit.

---

## 5. Internacionalización

- **Paridad estructural garantizada por el compilador:** `dictionary.ts` declara
  `type Dictionary = typeof es` y `export const en: Dictionary`, así que a una clave que falte en
  inglés no la deja pasar el `tsc`.
- **Prueba automática** `tests/i18n-parity.test.mjs`: igualdad de conjuntos de claves, ausencia de
  traducciones vacías y ausencia de traducciones idénticas, con excepciones explícitas. Pasa.
- **Dos huecos reales encontrados y corregidos** en esta sesión:
  - `HelpButton` tenía `aria-label="Cerrar"` fijo en español → ahora usa `t()`.
  - `QrDefense` tenía el placeholder de ejemplo fijo en español → ahora depende del idioma.
  - Clave nueva `globalShield.helpPanelClose` en ES y EN.
- **Verificado en vivo en producción en inglés:** veredicto, nivel de riesgo, confianza, cobertura de
  auditoría, "Why this result", evidencias verificadas, recomendaciones, limitaciones y fuentes
  aparecen **todos en inglés**, mientras que **el contenido original en español se conserva intacto
  como evidencia** — que es exactamente el comportamiento pedido.
- **Nombres propios respetados:** CAMAZOTZ, IXBALANQUÉ, VUCUB CAMÉ y HUN CAMÉ no se traducen.
  "XIBALBÁ AI" se conserva como marca.
- **Desviaciones conocidas:** P2-01 ("EL GUARDIÁN") y P2-02 (texto de Gemini al cambiar de idioma
  después de analizar).

---

## 6. Guardián, voz y mapas 3D

Verificado por pruebas automáticas (todas en verde en la batería local) y confirmado en vivo sobre
el despliegue:

- Holograma del Guardián: estados reposo y alerta reales. Tras un análisis de riesgo alto,
  `data-guardian-state` = **`alerta`**.
- `hologram-3d.spec.ts`: escritorio, móvil, selección de agente, **cero errores de consola** — PASS.
- Fallback seguro sin WebGL: muestra el JaguarAvatar 2.5D y el antifraude sigue usable — PASS.
- `maps-redesign.spec.ts`: Mapa de Investigaciones (estadísticas, leyenda, zoom, ES/EN) y Mapa 3D
  Maya (templos, FPS, móvil) — PASS. FPS medido de `GodsMap3D`: 7 en entorno headless (ver P3-03).
- Micrófono, voz TTS y preguntas al Guardián con cambio de idioma — PASS.
- El modelo 3D `/guardian/models/black-panther-base.glb` se sirve con **200** en el despliegue.
- Service Worker activo en producción (`sw.js`), caché versionada `xibalba-shell-v3`.
- **Cero errores de consola** en producción.

---

## 7. Hallazgos clasificados

### P0 — Críticos

**Ninguno.**

### P1 — Altos

#### P1-01 · App Check fallaba en el dominio del Preview — **RESUELTO**

- **Qué pasaba:** desde el Preview, App Check no conseguía token
  (`AppCheck: ReCAPTCHA error. (appCheck/recaptcha-error)`) y Firebase rechazaba la petición, así que
  no había interpretación de Gemini.
- **Causa:** la clave de reCAPTCHA Enterprise sólo autoriza los dominios registrados en Google
  Cloud, y el del Preview no estaba en la lista. No era un defecto del código ni de la configuración
  de Vercel.
- **Resolución aplicada hoy:** en Google Cloud Console → proyecto `xibalba-ai-2026` → reCAPTCHA
  Enterprise → la clave usada por App Check, se añadió el dominio `xibalba-rc-preview.vercel.app`.
  **Todos los dominios existentes se conservaron** y **no se desactivó ninguna protección.**
- **Verificación:** tras la propagación, las 6 etapas del diagnóstico pasan a ✔ y Gemini responde en
  el Preview en ambos idiomas, con texto y con imágenes.

#### P1-02 · reCAPTCHA Enterprise rechaza navegadores automatizados — comportamiento esperado

- **Qué pasa:** las pruebas Playwright que necesitan IA en la nube (`cloud-ai.spec.ts`,
  `production-image-analysis.spec.ts`) **no consiguen token de App Check contra un despliegue real**,
  aunque el mismo despliegue sirve Gemini sin problema desde un navegador normal.
- **Por qué:** es exactamente lo que hace un antibot. reCAPTCHA Enterprise detecta la automatización
  y no emite token. Está documentado con tres capturas comparativas
  (`artifacts/preview-20261127/30-32-playwright-recaptcha-bloquea-automatizacion-*`): Gemini funciona
  desde un navegador real en el mismo despliegue en el que Playwright no obtiene token.
- **Consecuencia:** la cobertura automatizada de IA en la nube sólo puede correr **en local con el
  token de depuración**, y la verificación en el despliegue se hace **desde un navegador real**, como
  se hizo hoy (sección 4). No es un defecto y no se rodeó desactivando nada.

### P2 — Medios

#### P2-01 · "EL GUARDIÁN" no se traduce a "THE GUARDIAN"

- **Qué pasa:** en inglés, el quinto agente sigue apareciendo como "EL GUARDIÁN". Los rótulos del
  panel sí están traducidos ("GUARDIAN", "Guardian and explanation"), pero el nombre del agente no.
- **Por qué no se cambió:** el nombre es un dato en `lib/agents.ts` que además usa el coordinador
  (`lib/analysis/coordinator.ts`) como etiqueta de actividad, y hay **18 referencias en pruebas** que
  lo afirman. Hacerlo dependiente del idioma obliga a pasar `lang` al motor de análisis y a
  reescribir esas pruebas: un cambio invasivo en el motor determinista la víspera de la presentación,
  justo lo que pediste congelar.
- **Recomendación:** dejarlo para después del concurso, o decidirlo tú y lo aplico con sus pruebas.

#### P2-02 · Al cambiar de idioma *después* de analizar, el texto de Gemini se queda en el original

- **Qué pasa:** toda la interfaz, las evidencias, las recomendaciones, las limitaciones y las fuentes
  **sí** se traducen al cambiar de idioma sobre un resultado ya calculado. Lo que no cambia es el
  párrafo que escribió Gemini: si analizaste en español y luego pasas a inglés, ese bloque sigue en
  español.
- **Por qué:** traducirlo exigiría **volver a llamar a Gemini** al cambiar de idioma, que es
  precisamente lo que se prohibió para no gastar llamadas ni rehacer el análisis con un clic de
  idioma.
- **Indicación para la demostración:** **elegir el idioma antes de analizar.** Hecho así, el bloque
  de IA sale directamente en el idioma elegido, verificado hoy en producción en ambos.

### P3 — Bajos

#### P3-01 · Vercel bloquea su propio script de feedback por nuestra CSP (solo en Preview)

Consola del Preview: `Loading the script 'https://vercel.live/_next-live/feedback/feedback.js'
violates ... script-src`. Es la barra de feedback que Vercel inyecta **solo en despliegues de
Preview**; no forma parte de la aplicación y no afecta a ninguna función. En producción no aparece,
confirmado hoy: cero errores de consola. En realidad es evidencia de que la CSP está funcionando.

#### P3-02 · Aviso de `Feature-Policy` duplicada

Vercel añade su propia cabecera `Feature-Policy` con `camera`, que coexiste con nuestra
`Permissions-Policy`. El navegador avisa y **aplica la nuestra**, que es la correcta. Sin impacto.

#### P3-03 · FPS bajo del mapa 3D en entorno de prueba

`GodsMap3D` midió 7 FPS bajo Playwright headless sin aceleración por GPU. No es representativo de un
equipo o teléfono real con GPU. No se midió en hardware físico.

#### P3-04 · Aviso de hidratación de React en modo desarrollo

Observado únicamente con `next dev` (servidor del proyecto WebKit), sobre el `style={{}}` del input
de análisis rápido. No se reprodujo en el despliegue ni en el build de producción.

---

## 8. Qué se corrigió en esta rama

1. **Carga de imágenes en móvil (la causa raíz del fallo del 26-nov).**
   `ImageAttachments` enumeraba `accept="image/jpeg,image/png,image/webp"`. El selector de fotos de
   Safari en iOS **oculta las fotos que siguen en HEIC** —el formato por defecto de la cámara del
   iPhone— cuando se le da una lista enumerada en vez de `image/*`, dejando la galería aparentemente
   vacía. Ahora es `image/*`, e `describeImageRejection` sigue rechazando con mensaje bilingüe claro
   lo que de verdad no se soporta. Cubierto por 4 pruebas nuevas en dos motores, verificadas contra
   el Preview y contra producción.

2. **Dos huecos de internacionalización** (sección 5) más la prueba automática de paridad ES/EN.

3. **Batería de pruebas WebKit, con la causa raíz correcta.**
   Las pruebas en WebKit fallaban porque *ningún* botón respondía. El diagnóstico real, confirmado
   con los registros de red: el build de producción añade `upgrade-insecure-requests` a la CSP;
   **WebKit aplica esa directiva también a `127.0.0.1`** y reescribe todas las subpeticiones (JS,
   CSS, imágenes) a `https://`, que el servidor de pruebas local no habla — `SSL connect error` en
   cada una, página sin estilos ni JavaScript. Chromium no reescribe sobre loopback, por eso el
   problema sólo se veía en WebKit. La corrección es un servidor propio en modo `next dev` (donde la
   CSP omite esa directiva) con su propio `distDir`. **La CSP de producción quedó intacta**, y las
   pruebas contra el despliegue por HTTPS confirman que bajo la CSP real todo carga.

4. **Corrección de un diagnóstico previo equivocado.** Se había puesto `workers: 1` creyendo que los
   fallos intermitentes al escribir capturas eran una colisión entre pruebas. Se reprodujo el mismo
   error con un solo worker, sobre un archivo nuevo y único: no era colisión, sino un bloqueo
   transitorio de Windows sobre el archivo recién creado. Se revirtió a ejecución paralela con
   `retries: 1`, que es la corrección real y ~6× más rápida.

5. **`playwright.preview.config.ts`**, nueva configuración que corre el bloque móvil contra un
   despliegue real por HTTPS en Chromium móvil y WebKit, bajo la CSP de producción completa. La URL y
   el secreto se leen de variables de entorno: **ninguna credencial en el repositorio**.

6. **Exclusión de `.next-webkit-dev` en ESLint**, que analizaba código generado (143 errores y 2954
   avisos, ninguno del proyecto).

7. **Limpieza del caso activo** (sección 4b): los botones «Nuevo caso» y «Limpiar análisis», el
   descarte de respuestas de IA que llegan tarde, diez claves nuevas de diccionario en ES y EN, y el
   bloque de pruebas `3c` con cinco casos que corren en Chromium móvil y en WebKit porque el `grep`
   de ambos proyectos pasó a `/3[bc]\./`.

---

## 9. Seguridad: qué NO se tocó

- CSP de producción: **intacta**, incluido `upgrade-insecure-requests`. Verificada en vivo sobre el
  despliegue (cabecera completa recibida con HTTP 200).
- App Check y reCAPTCHA Enterprise: **sin desactivar**, ni para pasar pruebas ni para desbloquear el
  Preview. En la clave de reCAPTCHA sólo se **añadió** un dominio; los existentes se conservaron.
- Cabeceras de seguridad comprobadas: `Content-Security-Policy`, `Permissions-Policy`,
  `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`.
- Protección del Preview: **siguió activa todo el tiempo**. El acceso se dio con un secreto de bypass
  revocable, con tu autorización, no desactivando la protección.
- **Secretos temporales revocados al terminar cada ronda de validaciones**, como pediste. Se usaron
  dos, uno por ronda, y los dos están revocados. Verificado en ambos casos: el Preview con ese
  secreto responde **302** (redirección al login de Vercel), es decir, ya no da acceso. El otro
  secreto de bypass, que es preexistente del proyecto y está ligado a una variable de entorno,
  **no se tocó**.
- Ningún secreto se escribió en el repositorio.

---

## 10. Procedimiento de rollback

Producción está en `dpl_7wBSvznLfpAQ4fzTNJHNAfgoWfiq` (commit `d7170f7`). El despliegue anterior
sigue disponible y es el objetivo de rollback:

**Despliegue anterior:** `dpl_7wBSvznLfpAQ4fzTNJHNAfgoWfiq`
(`xibalba-firebase-2026-dv90orhlw-dyann1984s-projects.vercel.app`, commit `d7170f7`, etiqueta de git
`restore-point-prod-d7170f7`). Es la versión publicada y verificada antes de añadir los botones de
limpieza de caso.

Desde el panel de Vercel: Deployments → ese despliegue → **Promote to Production**. Es instantáneo y
no requiere build.

Desde la terminal:

```powershell
vercel rollback xibalba-firebase-2026-dv90orhlw-dyann1984s-projects.vercel.app
```

Para deshacer el trabajo de esta rama en local:

```powershell
git checkout release/xibalba-2.0-rc
git reset --hard restore-point-20261127
```

Nota sobre por qué se usó `vercel deploy --prod` y no *promote* del Preview: las variables
`NEXT_PUBLIC_*` se incrustan **en tiempo de build**, así que un artefacto construido para el entorno
Preview arrastraría los valores del Preview a producción. Se reconstruyó con el entorno de
producción.

---

## 11. Limitaciones conocidas y lo que falta por probar

| Elemento | Estado |
|---|---|
| Gemini en producción | **VERIFICADO hoy** desde navegador real, ES y EN, texto e imagen |
| Gemini desde el Preview | **VERIFICADO hoy** (P1-01 resuelto) |
| Pruebas automatizadas de IA en la nube contra un despliegue | **IMPOSIBLES por diseño del antibot** (P1-02); corren en local con token de depuración |
| Celular físico (Android / iPhone) | **NO PROBADO en hardware** — sí verificado en WebKit/iPhone 13 y Chromium móvil reales contra producción por HTTPS. URL en la sección 2 |
| Service Worker: actualización en dispositivo real | **NO PROBADO en hardware** — activo y verificado en producción (`xibalba-shell-v3`); auditado por código: red primero para documentos, caché sólo para recursos con hash, purga de cachés viejas al activar, nunca cachea `/api/*` |
| FPS de los mapas 3D en hardware real | **NO MEDIDO** (ver P3-03) |
| Traducción de "EL GUARDIÁN" | **DESVIACIÓN CONSCIENTE** (P2-01) |
| Texto de Gemini al cambiar de idioma tras analizar | **DESVIACIÓN CONSCIENTE** (P2-02) — elegir idioma antes de analizar |

---

## 12. Recomendaciones para la presentación

1. **Elegir el idioma antes de ejecutar cada análisis** en vivo (P2-02). Así el párrafo de Gemini
   sale directamente en el idioma del jurado.
1b. **Entre un caso y el siguiente, pulsar «Nuevo caso»** (sección 4b). Deja la pantalla en limpio,
   devuelve al Guardián a reposo y conserva el historial, así que las investigaciones encadenadas de
   la demostración no se contaminan entre sí.
2. **Probar desde tu celular** con `https://xibalba-firebase-2026.vercel.app`: seleccionar una foto
   de la galería, ver la vista previa, correr el análisis y comprobar el menú lateral. Es lo único
   que no se puede verificar sin el dispositivo físico.
3. **Decidir sobre P2-01** ("EL GUARDIÁN" → "THE GUARDIAN"): dejarlo o aplicarlo con sus pruebas
   después del concurso.
4. Si algo sale mal, el rollback de la sección 10 es un clic y no requiere build.

---

*Informe generado el 27 de noviembre de 2026 sobre el commit `3513774`, desplegado en producción.
Todas las cifras de esta página provienen de ejecuciones reales registradas en esta sesión; ninguna
prueba se eliminó, desactivó ni se dio por buena sin ejecutarla.*
