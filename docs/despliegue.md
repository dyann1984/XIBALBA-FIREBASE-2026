# Despliegue

Fecha: 14 de noviembre de 2026.

> **Estado real: la aplicación está desplegada y es pública.**
> <https://xibalba-firebase-2026.vercel.app> responde 200 sin autenticación.
>
> | | |
> |---|---|
> | Proyecto de Vercel | `xibalba-firebase-2026` (creado el 14/11/2026) |
> | Despliegue | `dpl_FfEfeRyDFi35apaNpAMowtUerjVK`, estado *Ready* |
> | Objetivo | **production** — asignado por la plataforma, no solicitado |
> | Variables de entorno | **ninguna**, a propósito |
> | Repositorio | [`dyann1984/XIBALBA-FIREBASE-2026`](https://github.com/dyann1984/XIBALBA-FIREBASE-2026), privado |
>
> El despliegue se lanzó con `vercel deploy`, sin `--prod`, pidiendo una vista
> previa. Vercel respondió: *«This is the project's first deployment, so it was
> assigned to production»*. Un proyecto nuevo necesita un despliegue de
> producción y el primero siempre lo ocupa. No se promocionó nada: a partir del
> segundo, `vercel deploy` sin `--prod` genera vistas previas.
>
> Sigue **sin** ejecutarse `firebase deploy` y sin tocarse la consola de
> Firebase.

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
ahí porque ninguno ejecuta el SDK de Firebase en el servidor, pero localmente
**nadie ha ejecutado la suite en Node 24**.

Ese hueco **ya está cerrado** sin tocar el entorno global:
`.github/workflows/ci.yml` ejecuta `npm ci`, `npm run typecheck`, `npm test` y
`npm run build` **en Node 24.x** en cada empujón a `release/**`, y deja
constancia de la versión usada. No necesita ningún secreto.

Primera ejecución, en **Node v24.22.2**: typecheck sin errores, **175 / 175
pruebas**, build «Compiled successfully», conclusión **success**. Lo que sigue
sin cubrirse es este equipo, que continúa en Node 22.23.4.

**Node 24 en Vercel: comprobado.** El panel del proyecto muestra **26.x** —el
valor por omisión para proyectos nuevos— pero el despliegue **no corre en 26**.
Las funciones declaran el runtime `nodejs24.x`:

```bash
vercel inspect xibalba-firebase-2026-g6g9aqyh1-dyann1984s-projects.vercel.app --json
# → "nodejs24.x"
```

`engines.node: "24.x"` del `package.json` sobrescribe el ajuste del panel, como
promete la documentación de Vercel. Cambiar el panel a 24.x es **opcional y
cosmético**: quita la confusión al mirarlo, pero el valor que manda está en el
repositorio y viaja con él.

```bash
gh run list --branch release/xibalba-2026
gh run watch
```

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

Hay dos caminos. **El de la integración con Git es el recomendado**: cada
empujón a `release/xibalba-2026` genera una vista previa propia, y es lo que
conviene enseñar a un jurado.

**A. Integración con GitHub (recomendado, desde el panel)**

1. *Add New… → Project → Import Git Repository* y elige
   `dyann1984/XIBALBA-FIREBASE-2026`. La primera vez Vercel pide instalar su
   aplicación de GitHub: es un consentimiento tuyo, no puede hacerse por línea
   de órdenes.
2. Framework: **Next.js** (ya lo declara `vercel.json`). No cambies los comandos.
3. *Settings → Git → Production Branch*: **`release/xibalba-2026`**.
4. *Settings → Environment Variables*: las de la tabla anterior, **sin** las dos
   de depuración.
5. El primer despliegue arranca solo. Será de **vista previa** mientras no
   promuevas nada a producción.

**B. Línea de órdenes (despliega el directorio local, no la rama)**

```bash
vercel link          # crea o enlaza el proyecto
vercel env pull      # comprueba que las variables llegaron
vercel               # despliegue de vista previa
vercel --prod        # producción, solo con autorización
```

Ojo con la diferencia: `vercel` sube **lo que haya en el disco**, no lo que esté
en GitHub. Para que la vista previa corresponda al commit publicado, usa el
camino A o comprueba antes que el árbol de trabajo está limpio.

La CLI ya está instalada (64.2.0) y la sesión autenticada como `dyann1984`. El
proyecto **no está enlazado** todavía: no existe `.vercel/` y no se ha creado
ningún proyecto.

**Sobre las variables y la vista previa:** un build sin las
`NEXT_PUBLIC_FIREBASE_*` compila igual. Nada las lee durante la compilación
—`lib/firebase.ts` solo construye los servicios cuando alguien los pide, ya en
el navegador—, así que la vista previa funcionará con la auditoría determinista
completa y mostrará «IA · SIN CONFIGURAR». Es honesto para una demostración, y
es además el único estado posible mientras no exista la clave de App Check.

[`vercel.json`](../vercel.json) deja fijados el framework y los comandos de
instalación y build. Las cabeceras de seguridad no se configuran ahí: las emite
`next.config.ts`, de modo que son las mismas en local, en vista previa y en
producción.

Después del primer despliegue (**ya comprobado** sobre
<https://xibalba-firebase-2026.vercel.app>):

1. Añade el dominio asignado a la clave de reCAPTCHA Enterprise (paso 2.4).
   **Pendiente**, y no se puede hacer hasta que exista la clave.
2. Cabeceras: `curl -I` devuelve `Content-Security-Policy` (con los dos hosts de
   App Check), `Strict-Transport-Security`, `X-Frame-Options: DENY`,
   `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`,
   `X-Content-Type-Options: nosniff` y
   `Permissions-Policy: camera=(self), microphone=()…`. ✔
3. `POST /api/app-check-debug` → **404**. ✔
4. `POST /api/audit/external`, y aquí hay un matiz que conviene no confundir
   con un fallo:
   - **desde fuera del navegador → 403.** La capa anti-CSRF exige
     `sec-fetch-site: same-origin`, cabecera que solo pone un navegador. `curl`
     nunca pasará de aquí, con token o sin él.
   - **desde la propia página → 503**, con el mensaje «El servidor no conoce el
     número de proyecto, así que no puede verificar tokens de App Check». Sin
     variables de entorno, el servidor no puede verificar y por eso **rechaza**.
     Falla cerrado. ✔
   - El **401** que esperaba este documento aparece cuando sí hay configuración
     y el token recibido es inválido o ha caducado.

## 5. Firebase Hosting (alternativa)

`firebase.json` solo declara hoy las reglas de Firestore. Servir esta aplicación
desde Firebase Hosting exige la integración de frameworks
(`firebase experiments:enable webframeworks`), que despliega las rutas dinámicas
sobre Cloud Functions y **requiere plan de facturación Blaze**. No se ha
habilitado ni se ha tocado la facturación. Si se elige este camino, hay que
decidirlo a conciencia y documentar el coste.

## 6. GitHub

**Hecho.** El repositorio existe, es **privado** y contiene la rama de
integración:

| | |
|---|---|
| Repositorio | [`dyann1984/XIBALBA-FIREBASE-2026`](https://github.com/dyann1984/XIBALBA-FIREBASE-2026) |
| Visibilidad | **privado** |
| Rama por omisión | `release/xibalba-2026` |
| Commit publicado | `fb3f123` |
| Remoto local | `origin` |

Se publicó **solo** esa rama. `master`, `finalizacion-mvp` y
`codex/finalizacion-xibalba` siguen únicamente en local y sin tocar. Sus
commits sí están en GitHub —son antepasados del commit de integración—, de modo
que el historial completo es comprobable; lo que falta en el remoto son las
referencias de rama. Si quieres que los jueces las vean por nombre:

```bash
git push origin master finalizacion-mvp codex/finalizacion-xibalba
```

Antes de publicar se auditaron los 14 commits de la ascendencia de `fb3f123`:

- `.env.local` **nunca** se versionó;
- ningún fichero `.env*` salvo `.env.example`, y ahí todos los valores están
  vacíos;
- sin coincidencias de claves de Google (`AIza…`), claves de sitio de
  reCAPTCHA (`6L…`), tokens de GitHub, claves privadas PEM ni ficheros de
  cuenta de servicio.

**Antes de hacerlo público** queda una cosa pendiente, que no afecta a un
repositorio privado: `public/xibalba-logo.jpg` no está cubierto por la licencia
MIT del código. Decide su licencia o retíralo del repositorio público.

### Conectado a Vercel

El repositorio está **conectado** al proyecto de Vercel (`vercel git connect`,
14/11/2026). Consecuencia que conviene tener presente: **a partir de ahora, cada
empujón a `release/xibalba-2026` dispara un despliegue automático a
producción**. Para probar sin tocar producción, `vercel deploy` sin `--prod`
genera una vista previa.

### Cómo dar acceso al jurado sin abrir el repositorio

Tres modalidades, de menos a más expuesta. Las tres dejan intacta la aplicación
en línea, que ya es pública y no necesita ningún permiso:

| Modalidad | Cómo | Cuándo conviene |
|---|---|---|
| **Colaboradores** | *Settings → Collaborators → Add people*, con los usuarios de GitHub de los jueces (permiso **Read**) | Si el concurso te da sus cuentas. Es lo más controlado: acceso nominal y revocable |
| **Público temporal** | *Settings → General → Change repository visibility → Public*, y volver a privado al terminar | Si Devpost exige un enlace abierto. Antes: resolver la licencia del logo |
| **Solo la aplicación** | No dar acceso al código; entregar la URL y `docs/jueces.md` | Si las bases no exigen código. La guía está escrita para evaluar sin leer el repositorio |

Si eliges colaboradores:

```bash
gh api -X PUT repos/dyann1984/XIBALBA-FIREBASE-2026/collaborators/<usuario> -f permission=pull
```

Mientras decides, **el repositorio sigue privado**. No se ha cambiado su
visibilidad ni se ha invitado a nadie.

Antes de publicar, comprueba que `.env.local` no está en el historial:

```bash
git log --all --name-only --diff-filter=A -- .env.local
```

No debe devolver nada. `.gitignore` ya lo cubre.

## 7. Lista de comprobación antes de `--prod`

- [ ] Node 24.x fijado en el proyecto de despliegue (`engines` ya lo declara).
- [x] Suite ejecutada **en Node 24.x** (CI, v24.22.2: 175/175).
- [ ] `release/xibalba-2026` fijada como rama de producción en Vercel.
- [ ] `npm run typecheck`, `npm test` y `npm run build` en verde.
- [ ] Variables de entorno cargadas, **sin** las dos de depuración.
- [ ] Dominio de producción registrado en la clave de reCAPTCHA Enterprise.
- [ ] Reglas de Firestore publicadas (siguen denegando todo).
- [ ] `XIBALBA_EXTERNAL_AUDITS` ausente, salvo decisión consciente.
- [ ] Autorización explícita de la persona responsable del proyecto.
