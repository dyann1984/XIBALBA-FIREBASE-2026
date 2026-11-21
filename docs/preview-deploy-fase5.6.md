# Despliegue preview aislado — Fase 5.6

Fecha: 19 de noviembre de 2026. Commit desplegado: `3af439a`
(`codex/xibalba-3-phase5-command-center`). **No se tocó `release/xibalba-2026`,
no hubo push ni merge, no se activó App Check enforcement ni se modificaron
reglas de Firebase.**

## URL de la vista previa

<https://xibalba-firebase-2026-95on5h6dh-dyann1984s-projects.vercel.app>

**Protegida por autenticación de Vercel** (`deploymentProtection:
vercel_authentication`), que es la configuración por defecto del proyecto —
no la cambié. Para abrirla:

- **La forma normal**: inicia sesión en vercel.com como `dyann1984` y abre el
  enlace; Vercel te deja pasar porque eres dueño del proyecto.
- Si necesitas compartirla con alguien que no tiene esa cuenta, genera un
  enlace de bypass desde el panel del proyecto (*Deployment Protection* →
  *Sharable Link*) o pide que lo generemos juntos; no lo dejo aquí en texto
  plano porque es un token que otorga acceso sin iniciar sesión.

## 1. Rama `release/xibalba-2026`: intacta

```
git log --oneline release/xibalba-2026 -1   → f58bfec (sin cambios)
git log --oneline origin/release/xibalba-2026 -1 → c93ea2c (sin cambios)
```
No se hizo checkout, commit, merge ni push sobre esa rama en esta sesión.

## 2. Rama de desarrollo: validada y sin archivos sensibles

- HEAD: `3af439a`, árbol de trabajo limpio.
- `git ls-files | grep env` → solo `.env.example` (sin valores reales).
- Búsqueda de patrones de credenciales (`AIza…`, claves privadas PEM,
  tokens `ghp_`/`sk-`) en todo el contenido versionado → **sin coincidencias**.
- `.gitignore` cubre `.env*` (salvo `.env.example`) y `.vercel/`.

## 3. Configuración de Vercel: Node 24.x y variables de entorno

- `package.json` fija `engines.node: "24.x"`. Confirmado en el despliegue
  real (`vercel inspect`): **todas las funciones corren en `nodejs24.x`**.
- Variables de entorno actuales del proyecto (nombres únicamente, nunca sus
  valores):

  | Variable | Preview | Production |
  |---|---|---|
  | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | ✔ | ✔ |
  | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ✔ | ✔ |
  | `NEXT_PUBLIC_FIREBASE_APP_ID` | ✔ | ✔ |
  | `NEXT_PUBLIC_FIREBASE_API_KEY` | ❌ **falta** | ❌ **falta** |
  | `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` | ❌ **falta** | ❌ **falta** |

  Sin `NEXT_PUBLIC_FIREBASE_API_KEY`, Firebase no puede inicializarse en
  ningún entorno desplegado todavía — por eso la vista previa muestra «IA ·
  SIN CONFIGURAR» de forma honesta, exactamente como debe. **No agregué estas
  variables yo mismo**: aunque la clave de API de Firebase es pública por
  diseño, cargarla es una decisión tuya; los comandos exactos ya están en
  `docs/app-check.md` (§2) y `docs/despliegue.md` (§3).

## 4. App Check para despliegues preview: estado y cómo registrar dominios

- Sin `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY`, App Check no se activa en
  ningún entorno desplegado: la interpretación de IA permanece apagada y
  `/api/audit/external` falla cerrado (503), como ya documentaba
  `docs/jueces.md`. Esto no cambió.
- **Cuando exista la clave**, el reto específico de preview es que cada
  `vercel deploy` genera una URL con un hash distinto
  (`xibalba-firebase-2026-<hash>-dyann1984s-projects.vercel.app`), y
  reCAPTCHA Enterprise exige registrar dominios exactos. Dos caminos reales:
  1. **Recomendado**: usa el **alias de rama** que Vercel genera
     automáticamente para un proyecto conectado a Git
     (`xibalba-firebase-2026-git-<rama>-dyann1984s-projects.vercel.app`),
     que sí es estable entre despliegues de la misma rama, y registra *ese*
     dominio en la clave de reCAPTCHA Enterprise. Cubre todas las vistas
     previas de una rama sin tener que repetir el registro en cada deploy.
  2. **No recomendado para este proyecto**: registrar el dominio raíz
     `vercel.app` cubriría cualquier subdominio, pero eso autorizaría la
     clave para **cualquier proyecto de Vercel**, no solo el tuyo — un riesgo
     real de seguridad que no se justifica aquí.
  - El dominio de **producción** (`xibalba-firebase-2026.vercel.app`) se
    registra aparte, como ya indica `docs/app-check.md`.

## 5. Despliegue preview: ejecutado

```
vercel deploy --yes
```
(sin `--prod`; `target` del resultado es `null`, no `production`). Build
limpio, `readyState: READY`. Repetí la build de producción local justo antes
(`npm run build`) para confirmar que compila igual; el build remoto de Vercel
dio el mismo tamaño de "First Load JS" (261 kB en la portada).

## 6. Verificación real en la URL desplegada

Con el token de bypass de la propia CLI (generado por `vercel curl`, no
expuesto en texto plano aquí), verifiqué directamente contra la URL pública:

| Función | Resultado |
|---|---|
| Guardián (retrato premium) | Carga la imagen real; estado "alerta" confirmado tras un análisis real, viñeta roja visible en una captura de pantalla real de la URL desplegada |
| Análisis | Mensaje de fraude real auditado localmente, veredicto rojo, evidencia mostrada |
| Mapa de investigaciones | Pantalla y mensajes correctos (sin casos previos en esta sesión del navegador) |
| Idiomas | Cambio ES→EN confirmado, con toda la pantalla traducida |
| PWA | `manifest.webmanifest` sirve los iconos correctos; el *service worker* `xibalba-shell-v2` queda activo y registrado sobre HTTPS real |
| Cabeceras | `Content-Security-Policy`, `Permissions-Policy: camera=(self), microphone=(self)…` — idénticas a las de `next.config.ts`, no hay diferencia entre local y desplegado |
| Consola | **Un único error, repetido**, y es benigno: el widget de retroalimentación propio de Vercel (`vercel.live/_next-live/feedback/feedback.js`) lo bloquea la propia `Content-Security-Policy` del proyecto (`script-src 'self' …`), que no incluye `vercel.live` a propósito. Es un efecto secundario esperado de una CSP estricta en un entorno de vista previa, no un error de la aplicación — no se tocó la CSP para "arreglarlo", porque hacerlo debilitaría la protección real. |

## 7. Pasos exactos que faltan para publicar oficialmente

1. **Decidir y ejecutar la fusión** de `codex/xibalba-3-phase5-command-center`
   a `release/xibalba-2026` (ver `docs/release-candidate-fase5.5.md` — la
   fusión es mecánicamente trivial, release no tiene nada que esta rama no
   tenga ya).
2. **Tu autorización explícita** para el `push` de esa fusión y para
   `vercel deploy --prod` (o para fijar `release/xibalba-2026` como rama de
   producción si prefieres el camino de integración con Git).
3. Si quieres IA en la nube activa en producción: cargar
   `NEXT_PUBLIC_FIREBASE_API_KEY` y `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY`
   en Vercel (Production, y Preview si quieres probarla ahí también), y
   registrar los dominios correspondientes en la clave de reCAPTCHA
   Enterprise (§4). Sin esto, producción se publica igual de honesta, solo
   sin esa función.
4. Repetir la suite de 226 pruebas en CI (Node 24.x) antes de fusionar, para
   tener un registro fresco con el número actual.

Nada de esto se hizo en esta sesión: ni fusión, ni push a `release/xibalba-2026`,
ni activación de App Check enforcement, ni cambios a las reglas de Firebase.
