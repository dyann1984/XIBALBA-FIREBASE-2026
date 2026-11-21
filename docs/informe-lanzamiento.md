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

### La IA híbrida, comprobada de verdad

El 14 de noviembre se ejecutó contra el proyecto de Firebase real, en local,
donde App Check funciona por **token de depuración** (solo `localhost`, solo en
desarrollo):

| Prueba | Resultado |
|---|---|
| Estado de la IA | «IA · SIN CONFIGURAR» → «IA · SIN VERIFICAR» → **«IA · NUBE»** |
| Caso de control, con IA | **Verde**, riesgo bajo, confianza **baja**, con la nota «el nivel depende de la interpretación no verificada del modelo». Sin IA daba gris |
| Caso de la llamada, con IA | sigue **Rojo**, 8 señales, confianza alta: el modelo coincidió y **no pudo rebajar nada** |
| **Respaldo determinista** | cortando la red hacia el modelo: **Rojo intacto**, «Interpretación de IA: No Disponible», mensaje «No se pudo conectar…» y **ninguna fuga técnica** (`TypeError`, `FirebaseError`) a la pantalla |

Esa última fila es la que sostiene el diseño: el motor determinista no depende
del modelo, y el error del proveedor nunca llega literal a la persona.

Lo que falta para que ocurra lo mismo **en el despliegue** es una clave de App
Check de verdad: la del token de depuración no vale fuera de `localhost`. Pasos
en [`app-check.md`](app-check.md).

### Rendimiento, medido sobre la URL en vivo

| | Primera carga | Carga tibia |
|---|---|---|
| TTFB | 241 ms | 82 ms |
| DOM listo | 510 ms | 155 ms |
| `load` | 1.00 s | 258 ms |

Transferido con Brotli: HTML **5.2 KB**, y los dos fragmentos compartidos de
JavaScript **45.3 KB** y **54.3 KB**. El informe de build declara 98.5 kB para
`/` y 352 kB de *first load JS* sin comprimir.

FCP y LCP no se pudieron medir: el panel del navegador no registró entradas de
pintado. No se inventan; si los necesitas para la presentación, sácalos de
Lighthouse en un navegador normal.

## 4. Lo que falta para lanzar, en orden

Ya están hechos: crear el proyecto en Vercel, desplegar y comprobar la
aplicación en línea. Queda esto, y nada de ello impide que un jurado la pruebe
hoy mismo:

Hechos: proyecto de Vercel creado, aplicación desplegada y comprobada en línea,
**Node 24 verificado** (`nodejs24.x`), **repositorio conectado** a Vercel, tres
de las cuatro variables públicas de Firebase cargadas en *Production* y
*Preview*, e **IA híbrida comprobada funcionando** en local. Desde la
integración del PR #1 (20 de noviembre), además: **PR abierto** de
`xibalba-global-defense` hacia `release/xibalba-2026`, con 214 pruebas
unitarias y 28 E2E en verde.

Queda esto, y solo tú puedes hacerlo:

1. **Generar la clave de App Check** (reCAPTCHA Enterprise) y añadir
   `xibalba-firebase-2026.vercel.app` **y** `localhost` a sus dominios
   permitidos. Paso a paso en [`app-check.md`](app-check.md). **Es lo único que
   separa a la IA de funcionar en línea.**
2. **Cargar dos variables en Vercel**: la clave de sitio recién generada y
   `NEXT_PUBLIC_FIREBASE_API_KEY`. Esta última no se cargó a propósito: Vercel
   exige confirmación humana explícita para exponer públicamente un valor con
   forma de clave, y esa confirmación es tuya. Órdenes exactas en
   [`app-check.md`](app-check.md), sección 2.
3. **Revisar y fusionar el PR #1** (o decidir otra estrategia de integración)
   antes de que `release/xibalba-2026` refleje el trabajo de Global Defense 4.0
   y el rediseño premium. Con el repositorio ya conectado, **un empujón a
   `release/xibalba-2026` despliega a producción**; `vercel deploy` sin
   `--prod` hace una vista previa.
4. **Decidir el acceso del jurado al código**: colaboradores, público temporal o
   solo la aplicación. Tabla en [`despliegue.md`](despliegue.md), sección 6.
5. **Publicar las reglas de Firestore** tal como están, que deniegan todo:
   `firebase deploy --only firestore:rules`.
6. *Opcional:* alinear el panel de Vercel a Node 24.x. Cosmético: el runtime ya
   es `nodejs24.x` por `engines`.

## 5. Lo que sigue sin resolverse, dicho sin adornos

- La suite pasa en Node 24 **en CI** (Ubuntu), no en este equipo, que sigue con
  Node 22.23.4. Es la combinación que importa para el despliegue, pero si vas a
  demostrar en vivo desde esta máquina, lo que corre aquí es Node 22.
- **La IA funciona, pero todavía no en el despliegue.** Comprobada de punta a
  punta en local contra el proyecto de Firebase real; en línea no, porque App
  Check allí necesita una clave de sitio que aún no existe y el token de
  depuración solo vale en `localhost`. La aplicación desplegada lo anuncia («IA
  · SIN CONFIGURAR») y el endpoint externo **falla cerrado** con 503 en vez de
  aceptar nada sin verificar. **No se desactivó App Check** para aparentar que
  algo funciona, y no se cargaron credenciales falsas.
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
