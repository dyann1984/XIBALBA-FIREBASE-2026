# Despliegue

Fecha: 14 de noviembre de 2026.

> **Estado real: nada está desplegado.** No se ha creado ningún proyecto en
> Vercel, no se ha ejecutado `firebase deploy`, no se ha tocado ninguna
> configuración en la consola de Firebase y no hay remoto de Git configurado.
> Este documento deja el despliegue **preparado**; ejecutarlo requiere tu
> autorización y tus credenciales.

## 0. Antes de nada: el bloqueante

`NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` está vacía. Sin esa clave:

- la interpretación de IA no se habilita (la interfaz muestra «IA · SIN
  CONFIGURAR» y ejecuta solo la auditoría local, que sí funciona);
- `POST /api/audit/external` responde **401** a todas las peticiones, porque
  verifica el token de App Check de verdad.

La aplicación se puede desplegar y demostrar así —la auditoría determinista es
completa y no depende de la red—, pero la parte de IA solo funcionará cuando
esa clave exista. Ver el paso 2.

## 1. Node.js

`@firebase/ai@3.1.0` declara `engines: {"node": ">=24.12.0"}`. El entorno de
despliegue debe usar **Node 24.x**, y este proyecto ya lo fija así:

```json
"engines": { "node": "24.x" }
```

El detalle importa. Vercel lee `engines.node` y **sobrescribe** con él el ajuste
del proyecto, resolviendo un rango al major más nuevo que soporta. El valor
anterior, `>=24.12.0`, lo satisface también Node 26, que Vercel ya ofrece: el
runtime del despliegue habría podido cambiar de versión mayor sin que nadie
tocara el repositorio. Con `24.x` queda determinista. Ver
[`node-dependencias.md`](node-dependencias.md).

En el equipo donde se desarrollaron estas fases hay **Node 22.23.4**, por debajo
del mínimo declarado. `npm test`, `npm run typecheck` y `npm run build` pasan
ahí porque ninguno ejecuta el SDK de Firebase en el servidor, pero **nadie ha
ejecutado la suite en Node 24**: es un hueco de verificación real, no un
problema conocido. Conviene correr `npm ci && npm test && npm run build` una vez
en Node 24.x antes de la demostración.

## 2. Firebase (consola, una sola vez)

1. Crea o abre el proyecto de Firebase y registra una **aplicación web**. De ahí
   salen `apiKey`, `authDomain`, `projectId` y `appId`.
2. Habilita **Firebase AI Logic** con el backend de Google AI.
3. En **App Check**, registra la aplicación web con **reCAPTCHA Enterprise** y
   copia la clave de sitio a `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY`.
4. En reCAPTCHA Enterprise, **añade el dominio de producción** a la lista de
   dominios permitidos de la clave. Es el error más común: la clave funciona en
   `localhost` y falla en el dominio desplegado porque nadie lo registró.
5. **No** habilites el modo de depuración de App Check en producción. El
   endpoint `/api/app-check-debug` ya responde 404 fuera de desarrollo y fuera
   de `localhost`, pero la configuración también debe reflejarlo.
6. Publica las reglas de Firestore tal como están (deniegan todo):
   `firebase deploy --only firestore:rules`. No se necesita nada más de
   Firestore: ningún código escribe en él.

## 3. Variables de entorno

Las mismas de `.env.example`. En Vercel se definen en *Settings → Environment
Variables*:

| Variable | Entorno | Nota |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Production, Preview | Pública por diseño |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Production, Preview | |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Production, Preview | |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Production, Preview | |
| `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` | Production, Preview | Sin ella, 401 en el endpoint |
| `NEXT_PUBLIC_FIREBASE_APP_CHECK_DEBUG` | — | **No definir en producción** |
| `FIREBASE_APP_CHECK_DEBUG_TOKEN` | — | **No definir en producción** |
| `XIBALBA_EXTERNAL_AUDITS` | opcional | Solo si decides habilitar DNS y RDAP |

Las variables `NEXT_PUBLIC_*` se incrustan en el build: si cambias una, hay que
volver a desplegar.

## 4. Vercel (recomendado)

Es el destino natural: hay rutas de API con runtime Node (`node:crypto`, y el
adaptador WHOIS previsto necesitaría sockets TCP), así que un hosting
exclusivamente estático no sirve.

```bash
npm install -g vercel
vercel login
vercel link          # crea o enlaza el proyecto
vercel env pull      # comprueba que las variables llegaron
vercel               # despliegue de vista previa
vercel --prod        # producción, solo con autorización
```

[`vercel.json`](../vercel.json) deja fijados el framework y los comandos de
instalación y build. Las cabeceras de seguridad no se configuran ahí: las emite
`next.config.ts`, de modo que son las mismas en local, en vista previa y en
producción.

Después del primer despliegue:

1. Añade el dominio asignado a la clave de reCAPTCHA Enterprise (paso 2.4).
2. Comprueba las cabeceras:
   `curl -I https://<tu-dominio>` debe devolver `Content-Security-Policy`,
   `Strict-Transport-Security`, `X-Frame-Options: DENY`,
   `Referrer-Policy: no-referrer` y
   `Permissions-Policy: camera=(self), microphone=()…`.
3. Comprueba que `/api/app-check-debug` responde **404**.
4. Comprueba que `/api/audit/external` responde **401** sin token de App Check.

## 5. Firebase Hosting (alternativa)

`firebase.json` solo declara hoy las reglas de Firestore. Servir esta aplicación
desde Firebase Hosting exige la integración de frameworks
(`firebase experiments:enable webframeworks`), que despliega las rutas dinámicas
sobre Cloud Functions y **requiere plan de facturación Blaze**. No se ha
habilitado ni se ha tocado la facturación. Si se elige este camino, hay que
decidirlo a conciencia y documentar el coste.

## 6. GitHub

El repositorio es local y **no tiene remoto**. La rama que se despliega es
`release/xibalba-2026`: la integración de `finalizacion-mvp` (Claude) y
`codex/finalizacion-xibalba` (Codex), descrita en
[`integracion-release-2026.md`](integracion-release-2026.md). Para publicarlo:

```bash
git remote add origin https://github.com/<usuario>/<repositorio>.git
git push -u origin master
git push origin release/xibalba-2026
git push origin finalizacion-mvp codex/finalizacion-xibalba
```

Las dos ramas de origen se publican también a propósito: son los padres del
commit de integración y dejan el historial comprobable para los jueces.

En Vercel, apunta el proyecto a `release/xibalba-2026` como *Production Branch*
(*Settings → Git*), o enlázalo desde esa rama con `vercel link`. Si se deja
`master`, el despliegue serviría la fase 5 sin ninguna de las dos
finalizaciones.

Antes de publicar, comprueba que `.env.local` no está en el historial:

```bash
git log --all --name-only --diff-filter=A -- .env.local
```

No debe devolver nada. `.gitignore` ya lo cubre.

## 7. Lista de comprobación antes de `--prod`

- [ ] Node 24.x fijado en el proyecto de despliegue (`engines` ya lo declara).
- [ ] Suite ejecutada una vez **en Node 24.x**, no solo en 22.
- [ ] `release/xibalba-2026` fijada como rama de producción en Vercel.
- [ ] `npm run typecheck`, `npm test` y `npm run build` en verde.
- [ ] Variables de entorno cargadas, **sin** las dos de depuración.
- [ ] Dominio de producción registrado en la clave de reCAPTCHA Enterprise.
- [ ] Reglas de Firestore publicadas (siguen denegando todo).
- [ ] `XIBALBA_EXTERNAL_AUDITS` ausente, salvo decisión consciente.
- [ ] Autorización explícita de la persona responsable del proyecto.
