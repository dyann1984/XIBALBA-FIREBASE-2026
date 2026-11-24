# XIBALBÁ 2.0 — PAQUETE FINAL DE ENTREGA PARA EL HACKATHON

**Fecha de cierre:** 2026-11-23  
**Rama:** `mejora-visual/holograma-guardian-y-mapa`  
**Proyecto Firebase:** `xibalba-ai-2026`

---

## 1. Verificación real del video (`artifacts/xibalba-2.0/xibalba-2.0-demo.mp4`)

Inspeccionado con `ffprobe` y verificado cuadro a cuadro con las capturas generadas en la misma sesión:
- **Archivo:** `artifacts/xibalba-2.0/xibalba-2.0-demo.mp4`
- **Formato real:** `H.264 (avc1)`, `1920×1080`, `25 fps`, duración **`23.76 s`**, tamaño **`3,806,006 bytes` (~3.8 MB)**.
- **Pista de audio / narración:** **NO tiene pista de audio** (`streams` contiene únicamente `codec_type: "video"`). Es una captura visual automatizada limpia del recorrido real en navegador; para la entrega final con voz se debe añadir la locución usando [guion-video-xibalba-2.0.md](file:///D:/XIBALBA-FIREBASE-2026/docs/guion-video-xibalba-2.0.md) (ES o EN) o grabar la presentación narrada de 2–3 min en OBS.
- **Contenido visual comprobado:** Inicio de XIBALBÁ 2.0 → Jaguar 3D holográfico en reposo → Análisis rápido con caso de estafa real (BBVA + enlace phishing) → Semáforo rojo con 7 evidencias deterministas → Mapa ceremonial 3D (`GodsMap3D`) con los 5 dioses mayas (solo `IXBALANQUÉ`, `HUN CAMÉ` y `EL GUARDIÁN` iluminados y conectados) → Jaguar 3D en estado `alerta` (rojo) → Pregunta de seguimiento al Guardián → Cambio a inglés (`EN`) → Historial. Sin errores visibles en consola ni pantallas rotas.

---

## 2. Estado de URL Preview vs URL pública para jueces

- **Preview URL desplegada:** `https://xibalba-firebase-2026-888cxkpiq-dyann1984s-projects.vercel.app`
  - **Comprobación real (`curl.exe`):** responde `HTTP 302` redirigiendo a `https://vercel.com/sso-api?...` (**protegida por Vercel Authentication**). Un juez externo sin cuenta autorizada en el equipo de Vercel no podrá abrirla directamente.
- **Production URL actual:** `https://xibalba-firebase-2026.vercel.app`
  - **Comprobación real (`curl.exe`):** responde `HTTP 200` pública (corresponde al despliegue de Production previo, que **no** se modificó).
- **Opciones accesibles para los jueces (sin cambiar código):**
  1. **Opción recomendada sin tocar Production:** Entrar al Inspector del Preview (`https://vercel.com/dyann1984s-projects/xibalba-firebase-2026/4DBoc8mJ24fDP6CEtUZu4eRJ2Nxz`) y generar un **Shareable Link** o desactivar *Vercel Authentication* para Preview en *Project Settings → Deployment Protection*.
  2. **Opción definitiva (requiere autorización explícita):** Promover el build validado a Production con `vercel deploy --prod`.

---

## 3. Estado de App Check, Gemini en la nube y las 2 pruebas omitidas

- **En Vercel (`vercel env ls`):** `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY`, `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID` y `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` **ya están configuradas** tanto para `Preview` como para `Production`.
- **Por qué se omitieron en la batería principal (`playwright.config.ts`):** La batería principal corre `next start` en `127.0.0.1:3110` sin `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` en `.env.local`, por lo que `cloud-ai.spec.ts` detecta que la nube no está activa en ese modo y se omite por diseño.
- **Verificación real en la nube (`playwright.cloud.config.ts` en `localhost:3103`):** Ejecutada con token de depuración de App Check + Gemini real:
  - **2 / 2 APROBADAS** (`37.7 s`):
    1. *Interpretación de IA en la nube real (Firebase + Gemini) nunca baja un veredicto determinista* (`11.4 s`).
    2. *Holograma del Guardián en estado de seguridad (verde) con IA real* (`13.9 s`, captura guardada en `artifacts/xibalba-3-phase5.4/03-retrato-seguridad.png`).

---

## 4. Descripción del proyecto lista para Devpost / Hackathon

### Nombre y subtítulo
**XIBALBÁ 2.0** — *Inteligencia artificial multiagente y guardián 3D maya para prevenir fraudes digitales sin exponer tu privacidad.*

### Descripción breve (Español)
XIBALBÁ 2.0 es una plataforma web y PWA instalable de prevención e investigación de fraudes digitales inspirada en la cultura maya. Combina un motor determinista local (validación aritmética de CLABE y tarjetas Luhn, análisis estructural de URLs/homoglifos, analizador telefónico, OCR de capturas y correlación local de campañas) con inferencia híbrida en Firebase AI Logic + Gemini protegida por Firebase App Check. Cinco agentes especializados (`CAMAZOTZ`, `IXBALANQUÉ`, `VUCUB CAMÉ`, `HUN CAMÉ` y `EL GUARDIÁN`) operan en tiempo real sobre un mapa ceremonial 3D interactivo junto a un Jaguar Holográfico 3D reactivo y voz conversacional bilingüe (ES/EN), separando estrictamente hechos comprobados de estimaciones de IA y comprobaciones pendientes.

### Short Description (English)
XIBALBÁ 2.0 is a Maya-inspired multi-agent digital fraud prevention and investigation platform (Web + installable PWA). It pairs a deterministic on-device engine (CLABE/Luhn math checks, URL homoglyph inspection, phone pattern analysis, client-side OCR, and local campaign correlation) with hybrid Firebase AI Logic + Gemini inference protected by Firebase App Check. Five specialized agents coordinate live on an interactive 3D ceremonial map alongside a state-driven 3D Holographic Jaguar and bilingual (ES/EN) conversational voice, strictly separating verified facts from unverified AI estimates and pending checks.

---

## 5. Inventario de evidencias verificadas

- **Video 1080p MP4 (sin pista de audio):** [xibalba-2.0-demo.mp4](file:///D:/XIBALBA-FIREBASE-2026/artifacts/xibalba-2.0/xibalba-2.0-demo.mp4)
- **Guion ES/EN y storyboard (2 min 35 s):** [guion-video-xibalba-2.0.md](file:///D:/XIBALBA-FIREBASE-2026/docs/guion-video-xibalba-2.0.md)
- **Capturas verificadas:** [artifacts/xibalba-2.0/](file:///D:/XIBALBA-FIREBASE-2026/artifacts/xibalba-2.0) (`01-home-desktop.png` a `18-agentes.png`) y `artifacts/xibalba-3-phase5.4/03-retrato-seguridad.png`
- **Informe QA completo:** [XIBALBA_2_0_QA_FINAL.md](file:///D:/XIBALBA-FIREBASE-2026/XIBALBA_2_0_QA_FINAL.md)
- **Métricas de calidad:** TypeScript `0` errores · ESLint `0` errores · `228/228` pruebas unitarias/integración · `31/31` E2E locales (`+2/2` E2E nube en `playwright.cloud.config.ts`) · Build de producción limpio.

---

## 6. Limitaciones pendientes documentadas con honestidad

1. **Audio de narración en el MP4:** `xibalba-2.0-demo.mp4` dura `23.76 s` y no incluye pista de voz; requiere locución en off (o grabación en vivo con OBS siguiendo el guion de 2:35 min).
2. **Protección de acceso en Preview:** La URL Preview recién desplegada exige inicio de sesión en Vercel (`HTTP 302`) hasta habilitar *Shareable Link* / desactivar *Vercel Authentication* o promover a Production.
3. **Micrófono físico:** El flujo de permisos y UI de voz está implementado y verificado en código, pero el reconocimiento de voz real con micrófono físico humano no se probó en esta sesión headless.
4. **Auditorías externas DNS/RDAP (`XIBALBA_EXTERNAL_AUDITS`):** Implementadas y protegidas por App Check RS256, deshabilitadas por defecto en entorno público mientras no se defina un rate limiter distribuido.
5. **Firebase Firestore / Storage:** Permanecen cerrados (`allow read, write: if false;`) porque la app procesa archivos en memoria y guarda historial solo localmente bajo consentimiento.
