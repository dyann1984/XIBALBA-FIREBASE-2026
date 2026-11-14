# Informe para autorizar el lanzamiento

Fecha: 14 de noviembre de 2026 · rama `release/xibalba-2026` · commit `fb3f123`
(más la preparación de publicación descrita aquí).

Este documento existe para que la decisión de lanzar se tome mirando lo que está
comprobado y lo que no, no la impresión de que «compila».

## 1. Qué está publicado

| | |
|---|---|
| **Aplicación en línea** | **<https://xibalba-firebase-2026.vercel.app>** (pública, 200 sin autenticación) |
| Repositorio | [`dyann1984/XIBALBA-FIREBASE-2026`](https://github.com/dyann1984/XIBALBA-FIREBASE-2026) |
| Visibilidad del repositorio | **privado** |
| Rama por omisión | `release/xibalba-2026` |
| Ramas publicadas | **solo** `release/xibalba-2026` |
| Ramas intactas en local | `master`, `finalizacion-mvp`, `codex/finalizacion-xibalba` |
| Objetivo del despliegue | **production**, asignado por la plataforma |
| Variables de entorno en Vercel | **ninguna**, a propósito |

Sobre el objetivo «production»: el despliegue se pidió como vista previa
(`vercel deploy`, sin `--prod`). Vercel contestó que, al ser el primero del
proyecto, lo asignaba a producción —un proyecto nuevo necesita uno y el primero
siempre lo ocupa—. No se promocionó nada; a partir del segundo, los despliegues
sin `--prod` son vistas previas. Si prefieres que no exista ese despliegue de
producción, se elimina con `vercel remove`, pero con él se va la URL.

## 2. Auditoría de credenciales previa a la publicación

Sobre los 14 commits de la ascendencia de `fb3f123`:

| Comprobación | Resultado |
|---|---|
| `.env.local` en cualquier commit | **no existe** |
| Ficheros `.env*` versionados | solo `.env.example`, con todos los valores vacíos |
| Claves de Google (`AIza…`) | sin coincidencias |
| Claves de sitio reCAPTCHA (`6L…`) | sin coincidencias |
| Tokens de GitHub (`ghp_`, `gho_`…) | sin coincidencias |
| Claves privadas PEM / cuentas de servicio | sin coincidencias |
| `.gitignore` cubre `.env*` | sí, con excepción explícita para `.env.example` |

Se publicaron 90 ficheros. El único binario es `public/xibalba-logo.jpg`.

## 3. Verificación

**Local, Node 22.23.4** (Windows 11, npm 10.9.9):

| | |
|---|---|
| `npm run typecheck` | sin errores |
| `npm test` | **175 / 175**, 0 fallos |
| `npm run build` | limpio, salida 0 |
| Seis casos demo en la app real | rojo · rojo · rojo · rojo · rojo · **gris** |
| App Check (`/diagnostico-app-check`) | «entregó un token válido al SDK» |

**Remoto, Node v24.22.2** (GitHub Actions, ejecución
[`43637879826`](https://github.com/dyann1984/XIBALBA-FIREBASE-2026/actions/runs/43637879826)):

| | |
|---|---|
| `npm ci` | sin fallos |
| `npm run typecheck` | sin errores |
| `npm test` | **175 / 175**, 0 fallos |
| `npm run build` | «Compiled successfully in 10.5s» |
| Conclusión del flujo | **success** |

Con eso, **el hueco de Node 24 está cerrado con evidencia**, no con suposiciones:
la misma suite pasa en la versión que el proyecto declara y que el despliegue va
a usar. `.github/workflows/ci.yml` la repite en cada empujón a `release/**`.

```bash
gh run list --branch release/xibalba-2026
```

**Instalación limpia, en un worktree aparte** (`git worktree`, separado para no
tocar el directorio compartido): `npm ci` sin fallos, typecheck sin errores,
**175 / 175 pruebas**. El `npm run build` de ese worktree falla, y conviene
saber por qué **no** es del proyecto: vive bajo `…\AppData\Local\Temp`, donde
hay un `package.json` ajeno de 56 bytes, con BOM y JSON inválido, del 11 de
octubre; el resolutor de webpack lo encuentra al subir por el árbol de
directorios y aborta. No se tocó ese fichero. El build está verificado en el
directorio del proyecto, en CI sobre Node 24 y en la propia construcción de
Vercel.

No hay `lint`: el proyecto no tiene ESLint ni script `lint`, y añadirlo a esta
altura significa dependencias nuevas. La comprobación estática es `tsc --noEmit`
en modo estricto.

### Sobre la aplicación desplegada, no sobre el código

Todo lo siguiente se comprobó en <https://xibalba-firebase-2026.vercel.app>:

| Comprobación | Resultado |
|---|---|
| Carga de la aplicación | correcta, **cero errores de consola**, cero violaciones de CSP |
| Etiqueta de estado de la IA | «IA · SIN CONFIGURAR» |
| Caso de la llamada | **Rojo · no continúes**, riesgo alto, confianza alta, 8 señales, puntuación 362, cobertura 46/50 (92 %) |
| Discrepancia CLABE ↔ institución | detectada: el texto dice «Santander», la cuenta es de **Banco Azteca** |
| Enmascarado | la evidencia muestra `127***********0006`; la CLABE completa solo está donde la escribió la persona |
| Caso de control | **Gris · información insuficiente** (el verde no se regala) |
| `localStorage` sin consentimiento | **vacío** |
| Historial con consentimiento | guarda resultado, no contenido; **ninguna secuencia de 5 o más dígitos** |
| Desmarcar el consentimiento | borra las dos claves |
| Cabeceras de seguridad | CSP, HSTS, `X-Frame-Options: DENY`, `Referrer-Policy`, COOP, `nosniff`, `Permissions-Policy` |
| `POST /api/app-check-debug` | **404** |
| `POST /api/audit/external` desde fuera | **403** (anti-CSRF) |
| `POST /api/audit/external` desde la página | **503**: no puede verificar el token, así que lo rechaza |
| Móvil (375 × 812) | sin desplazamiento horizontal; el flujo completo funciona |
| Secretos en el paquete de cliente | solo los cuatro `NEXT_PUBLIC_FIREBASE_*`, públicos por diseño. `FIREBASE_APP_CHECK_DEBUG_TOKEN` **no aparece**. Sin claves PEM, cuentas de servicio ni tokens |

## 4. Lo que falta para lanzar, en orden

Ya están hechos: crear el proyecto en Vercel, desplegar y comprobar la
aplicación en línea. Queda esto, y nada de ello impide que un jurado la pruebe
hoy mismo:

1. **Decidir sobre el despliegue de producción.** El primero quedó en
   *production* por la regla de la plataforma, no por una promoción. Mantenerlo
   —es la URL que verán los jueces— o eliminarlo con `vercel remove`, sabiendo
   que con él se va la URL.
2. **Fijar Node 24.x en el panel de Vercel** (*Settings → Build and
   Deployment*). Hoy muestra 26.x; `engines` declara `24.x` y debería
   sobrescribirlo, pero el registro no imprimió la versión usada.
3. **Conectar el repositorio** (*Add New → Import Git Repository*) y fijar
   `release/xibalba-2026` como *Production Branch*, para que cada empujón
   genere su vista previa. Requiere tu consentimiento en la aplicación de GitHub
   de Vercel: no se puede hacer por línea de órdenes.
4. **Generar la clave de App Check** en la consola de Firebase y cargarla en
   Vercel, si quieres enseñar la interpretación de IA en vivo. Solo tú puedes
   hacerlo.
5. **Registrar el dominio desplegado**
   (`xibalba-firebase-2026.vercel.app`) en la clave de reCAPTCHA Enterprise. Es
   el fallo más común y solo aparece después de desplegar.
6. **Publicar las reglas de Firestore** tal como están, que deniegan todo:
   `firebase deploy --only firestore:rules`.

## 5. Lo que sigue sin resolverse, dicho sin adornos

- La suite pasa en Node 24 **en CI** (Ubuntu), no en este equipo, que sigue con
  Node 22.23.4. Es la combinación que importa para el despliegue, pero si vas a
  demostrar en vivo desde esta máquina, lo que corre aquí es Node 22.
- **La interpretación de IA no está activa en el despliegue.** No hay ninguna
  variable de entorno cargada en Vercel, así que el despliegue no conoce el
  proyecto de Firebase y `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` sigue vacía
  también en local. La aplicación lo anuncia («IA · SIN CONFIGURAR») y el
  endpoint externo **falla cerrado** con 503 en vez de aceptar nada sin
  verificar. **No se desactivó App Check** para aparentar que algo funciona, y
  no se cargaron credenciales falsas.
- El despliegue quedó en el objetivo **production** sin que se pidiera, por la
  regla del primer despliegue de Vercel. Está dicho arriba y la decisión es
  tuya.
- 4 avisos altos de `npm audit`, todos en la cadena `@grpc/grpc-js`, que
  describe el comportamiento de un servidor gRPC que este proyecto no ejecuta.
  Análisis en [`seguridad-dependencias.md`](seguridad-dependencias.md).
- `public/xibalba-logo.jpg` no está cubierto por la licencia MIT del código.
  Irrelevante en un repositorio privado; hay que decidirlo antes de hacerlo
  público.
- Deuda técnica conocida y no bloqueante en
  [`pendientes-hackathon.md`](pendientes-hackathon.md), sección 4: CSP con
  nonce, límite de solicitudes distribuido, internacionalización.
