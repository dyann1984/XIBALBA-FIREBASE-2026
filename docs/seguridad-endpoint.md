# Diagnóstico de seguridad · endpoint de auditorías externas

Fecha: 14 de noviembre de 2026. Alcance: `app/api/audit/external/route.ts` y
`lib/security/app-check.ts`.

---

## 1. Qué protege ahora el endpoint

| Capa | Mecanismo | Papel |
|---|---|---|
| **Autenticación** | Token de Firebase App Check **verificado criptográficamente** | La que decide si se atiende |
| Anti-CSRF | `sec-fetch-site: same-origin` + `origin` | Capa adicional, **no** autenticación |
| Abuso | Límite de solicitudes por cliente | Acota el volumen |
| Entrada | Validación estricta de host y techo de 1 KB al cuerpo | Cierra inyección y SSRF |
| Salida | Resolutores en lista cerrada, solo HTTPS, sin redirecciones | Impide que el endpoint sea un proxy |

El mismo origen **ya no sustituye a la autenticación**, que era la objeción
correcta del informe anterior. Un token inválido se rechaza venga de donde
venga; un token válido es lo único que concede acceso.

---

## 2. Arquitectura elegida para verificar App Check

### 2.1 Las dos vías oficiales

| | Admin SDK | **JWKS público** |
|---|---|---|
| Llamada | `appCheck().verifyToken()` | Validar el JWT contra las claves públicas |
| Credencial | **Cuenta de servicio** o credenciales administradas del entorno | **Ninguna** |
| Rol IAM | «Firebase App Check Token Verifier» | — |
| Dependencia | `firebase-admin` | Ninguna: `node:crypto` |
| Protección contra reenvío | Sí (beta) | **No** |

### 2.2 Vía implementada: JWKS

Es el procedimiento que la documentación de Firebase define para backends sin
Admin SDK. Endpoint:

```
https://firebaseappcheck.googleapis.com/v1/jwks
```

Se implementan los ocho pasos exigidos: obtener el JWKS, verificar la firma,
exigir `RS256`, exigir `typ: JWT`, comprobar el emisor
(`https://firebaseappcheck.googleapis.com/<número de proyecto>`), comprobar que
no ha caducado, comprobar la audiencia (`projects/<número de proyecto>`) y, de
forma opcional, el sujeto contra una lista de aplicaciones.

**Por qué esta vía y no el Admin SDK**, dado que la propia documentación
recomienda el SDK: el SDK exige credenciales de aplicación. En local eso
significa un archivo de cuenta de servicio, que es precisamente lo que no debe
vivir en el repositorio, y añadir una credencial nueva no mejora la seguridad
de la verificación: la firma se comprueba igual de bien con la clave pública.
La diferencia real está en la protección contra reenvío, que se documenta como
pendiente en lugar de simularse.

### 2.3 Credenciales administradas, sin archivos en el repositorio

Si más adelante se quiere el Admin SDK (para el consumo de tokens de un solo
uso), **no hace falta guardar ningún archivo**:

| Entorno | Mecanismo | Qué hay que hacer |
|---|---|---|
| Firebase App Hosting | Credenciales por omisión de la aplicación | Nada: el SDK las toma del entorno |
| Cloud Run / Cloud Functions | Cuenta de servicio del servicio + rol de verificador | Asignar el rol; sin archivo |
| GitHub Actions | Federación de identidades de carga de trabajo | Configurar la federación; sin archivo |
| Local | `gcloud auth application-default login` | Credenciales del usuario, fuera del repositorio |

En ninguno de los cuatro se almacena una clave. Esa es la recomendación si se
decide dar el paso; **requiere autorización** porque toca infraestructura.

### 2.4 Lo que no es un secreto, y por qué eso importa

La verificación necesita el **número de proyecto**, `955339811744`. No es un
secreto: va dentro del ID de aplicación, que el cliente publica en cada carga
(`1:955339811744:web:…`). Se deriva de `NEXT_PUBLIC_FIREBASE_APP_ID`, con
`FIREBASE_PROJECT_NUMBER` como alternativa.

Resultado: **la verificación real no introdujo ni una credencial nueva.**

---

## 3. Hallazgos

### 3.1 Bloqueante · `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` está vacía

Sin clave de sitio de reCAPTCHA Enterprise, el cliente **no puede obtener un
token real de App Check**. En local funciona por el token de depuración; en
producción, `isConfigured()` da falso y no hay atestación.

Consecuencia directa: si se habilitaran hoy las auditorías externas en
producción, el endpoint **rechazaría todas las peticiones** con 401, porque no
habría token que verificar. La verificación es correcta; lo que falta es que
haya algo que verificar.

Para resolverlo hay que registrar la aplicación web en App Check con
reCAPTCHA Enterprise desde la consola de Firebase y poner la clave de sitio en
la variable. **Es una acción en la consola: requiere autorización y no se hizo.**

### 3.2 Medio · El límite de solicitudes vive en memoria de la instancia

En un despliegue sin servidor hay varias instancias y cada una tiene su propio
contador, así que el límite efectivo se multiplica por el número de instancias.
Además se reinicia en cada despliegue.

Mitigación real cuando importe: contador compartido (Firestore con TTL, o el
limitador del propio proveedor). No se implementa ahora porque el endpoint está
apagado y porque Firestore implicaría reglas y coste.

### 3.3 Medio · `x-forwarded-for` es manipulable

La clave del limitador sale de la primera entrada de `x-forwarded-for`. Si el
despliegue no está detrás de un proxy de confianza que la reescriba, un cliente
puede falsearla y evadir el límite. Hoy el valor se usa **solo** para limitar,
nunca para autorizar, así que el daño se acota a saltarse el límite.

Al desplegar hay que confirmar que el proxy del proveedor reescribe la cabecera
y, si no, tomar la IP de la cabecera específica del proveedor.

### 3.4 Medio · Sin protección contra reenvío

Un token válido y vigente puede reutilizarse durante su ventana de validez. El
consumo de tokens de un solo uso es beta y solo existe en los Admin SDK, así
que exige lo de la sección 2.3. **No se simula.** Mientras no exista, el límite
de solicitudes es lo único que acota el abuso con un token legítimo robado.

### 3.5 Bajo · Clave duplicada en `.env.local`

`NEXT_PUBLIC_FIREBASE_APP_CHECK_DEBUG` aparece dos veces. No es un problema de
seguridad (gana la última), pero una variable duplicada es una variable que
alguien va a editar creyendo que cambió algo. Conviene dejar una sola. **No se
modificó el archivo**, porque las credenciales y la configuración no se tocan
sin autorización.

### 3.6 Bajo, ya conocido · El token de depuración se imprime en consola

El SDK de Firebase escribe el token de depuración en la consola del navegador y
lo expone en `self.FIREBASE_APPCHECK_DEBUG_TOKEN`. Es comportamiento del SDK,
no del proyecto. Sigue recomendándose rotarlo, ya que apareció en una sesión de
trabajo. Documentado antes en `docs/firebase.md`.

---

## 4. Lo que se verificó con pruebas

21 pruebas en `tests/security.test.mjs`. Son simuladas, pero la comprobación de
firma que ejercitan es la real: se genera un par de claves RSA de verdad, se
firman tokens con RS256 y se sirve un JWKS construido con la clave pública.

Ataques cubiertos, todos rechazados:

- Token firmado con **otra clave**.
- `alg: none`.
- **Confusión de algoritmo**: HS256 usando la clave pública como secreto HMAC,
  el ataque clásico contra verificadores mal escritos.
- `kid` que no existe en el JWKS.
- **Contenido manipulado** conservando la firma original.
- Emisor de otro proyecto, con firma válida.
- Audiencia de otro proyecto, con firma válida; `aud` ausente, vacía o no textual.
- Token caducado; sin `exp`; sin `sub`.
- Aplicación fuera de la lista admitida.
- Entradas basura: nulo, vacío, numérico, dos segmentos, cuatro segmentos, no
  base64url, 9 000 caracteres.
- **JWKS inalcanzable** en seis variantes: red caída, HTTP 500, cuerpo vacío,
  JSON roto, sin claves, claves inválidas. En todas se **deniega**; nunca se
  concede acceso sin verificar.
- URL de JWKS que no es HTTPS.

Y dos propiedades:

- El JWKS se consulta **una vez** para tres tokens, y se vuelve a pedir pasadas
  6 horas, el máximo que recomienda la documentación.
- Con la caché vigente y la red caída, los tokens legítimos siguen funcionando
  y **los falsificados siguen siendo rechazados**.

---

## 5. Estado

| Punto | Estado |
|---|---|
| Verificación real de App Check en el servidor | **Implementada y probada** |
| Mismo origen como sustituto de autenticación | **Eliminado como tal** |
| Credenciales nuevas introducidas | **Ninguna** |
| Auditorías externas para usuarios | **Deshabilitadas** (`XIBALBA_EXTERNAL_AUDITS` apagado) |
| Clave de sitio de App Check en producción | **Falta.** Bloqueante, requiere la consola |
| Protección contra reenvío | Pendiente, documentada, no simulada |
| Límite de solicitudes distribuido | Pendiente |

El interruptor sigue apagado. Hay ahora una protección validada, pero queda el
bloqueante de 3.1: **habilitar las auditorías en producción antes de configurar
la clave de sitio daría 401 en todas las peticiones.**
