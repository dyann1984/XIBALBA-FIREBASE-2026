# Informe para autorizar el lanzamiento

Fecha: 14 de noviembre de 2026 · rama `release/xibalba-2026` · commit `fb3f123`
(más la preparación de publicación descrita aquí).

Este documento existe para que la decisión de lanzar se tome mirando lo que está
comprobado y lo que no, no la impresión de que «compila».

## 1. Qué está publicado

| | |
|---|---|
| Repositorio | [`dyann1984/XIBALBA-FIREBASE-2026`](https://github.com/dyann1984/XIBALBA-FIREBASE-2026) |
| Visibilidad | **privado** |
| Rama por omisión | `release/xibalba-2026` |
| Ramas publicadas | **solo** `release/xibalba-2026` |
| Ramas intactas en local | `master`, `finalizacion-mvp`, `codex/finalizacion-xibalba` |
| Desplegado | **nada**, ni vista previa ni producción |

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

No hay `lint`: el proyecto no tiene ESLint ni script `lint`, y añadirlo a esta
altura significa dependencias nuevas. La comprobación estática es `tsc --noEmit`
en modo estricto.

## 4. Lo que falta para lanzar, en orden

1. **Crear el proyecto en Vercel** con la integración de GitHub y fijar
   `release/xibalba-2026` como rama de producción. Pasos en
   [`despliegue.md`](despliegue.md), sección 4A. Requiere tu consentimiento en
   la aplicación de GitHub de Vercel: no se puede hacer por línea de órdenes.
2. **Desplegar la vista previa** y abrirla. Funcionará con la auditoría
   determinista completa y mostrará «IA · SIN CONFIGURAR».
3. **Generar la clave de App Check** en la consola de Firebase y cargarla en
   Vercel, si quieres enseñar la interpretación de IA en vivo. Solo tú puedes
   hacerlo.
4. **Registrar el dominio desplegado** en la clave de reCAPTCHA Enterprise. Es
   el fallo más común y solo aparece después de desplegar.
5. **Publicar las reglas de Firestore** tal como están, que deniegan todo:
   `firebase deploy --only firestore:rules`.
6. **Autorizar producción** (`vercel --prod` o *Promote to Production*).

## 5. Lo que sigue sin resolverse, dicho sin adornos

- La suite pasa en Node 24 **en CI** (Ubuntu), no en este equipo, que sigue con
  Node 22.23.4. Es la combinación que importa para el despliegue, pero si vas a
  demostrar en vivo desde esta máquina, lo que corre aquí es Node 22.
- `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` está vacía: sin ella la
  interpretación de IA no se habilita y `/api/audit/external` responde 401. **No
  se desactivó App Check** para disimularlo: se eligió que la aplicación diga la
  verdad sobre su propio estado.
- 4 avisos altos de `npm audit`, todos en la cadena `@grpc/grpc-js`, que
  describe el comportamiento de un servidor gRPC que este proyecto no ejecuta.
  Análisis en [`seguridad-dependencias.md`](seguridad-dependencias.md).
- `public/xibalba-logo.jpg` no está cubierto por la licencia MIT del código.
  Irrelevante en un repositorio privado; hay que decidirlo antes de hacerlo
  público.
- Deuda técnica conocida y no bloqueante en
  [`pendientes-hackathon.md`](pendientes-hackathon.md), sección 4: CSP con
  nonce, límite de solicitudes distribuido, internacionalización.
