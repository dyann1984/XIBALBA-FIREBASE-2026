# Diagnóstico técnico real: por qué Gemini seguía fallando en producción

Fecha: 21 de noviembre de 2026. Rama: `finalizacion/app-check-y-pendientes`,
desde `release/xibalba-2026` @ `8135a69`. Todo lo descrito aquí se demostró
interceptando `fetch()` en el navegador real contra la URL pública y, para la
segunda parte, contra un build de producción servido en `localhost` con las
variables de entorno reales de Vercel (`vercel env pull --environment=production`,
nunca commiteadas: `.env.prodcheck.local` se usó y se borró en esta misma sesión).

## Hallazgo 1 (causa raíz, ya corregida en código)

La API real `exchangeRecaptchaEnterpriseToken` devolvía, en producción:

```
400 INVALID_ARGUMENT
"Invalid resource name: projects/<BOM>xibalba-ai-2026/apps/<BOM>1:955339811744:web:7d2bf080e13864453ad2c5"
```

`NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` y
`NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, cargadas en Vercel (Production y Preview),
traen un carácter BOM (U+FEFF) al inicio del valor — probablemente quedó al
copiar el valor desde un archivo guardado con codificación UTF-8 con BOM. No
es un problema de la consola de Firebase: la clave de App Check y el proveedor
(reCAPTCHA Enterprise) son correctos.

**Corrección aplicada:** [lib/firebase.ts](../lib/firebase.ts) ahora limpia
BOM y espacios de ancho cero de las cinco variables antes de usarlas, sin
importar cómo se cargó la variable. Verificado: tras la corrección, la llamada
a `exchangeRecaptchaEnterpriseToken` ya no devuelve ese 400 (confirmado en
`localhost` con las variables reales de producción).

## Hallazgo 2 (bloqueo real restante, no es código)

Con el Hallazgo 1 corregido, el intercambio de App Check funciona, pero la
llamada real a Gemini falla en una etapa distinta:

```
POST https://firebasevertexai.googleapis.com/v1beta/projects/xibalba-ai-2026/models/gemini-3.5-flash-lite:generateContent
401 UNAUTHENTICATED
"Firebase App Check token is invalid."
```

Es decir: el token de App Check **se obtiene correctamente** (reCAPTCHA
Enterprise responde, el intercambio ya no da 400), pero **Firebase AI Logic
(Vertex AI en Firebase) lo rechaza como inválido** al verificarlo del lado del
servidor. Esto no se puede corregir desde el código del repositorio: ocurre
en la verificación servidor-a-servidor entre App Check y la API de IA.

### Procedimiento exacto para verificar (sin compartir ningún secreto)

1. Firebase Console → proyecto `xibalba-ai-2026` → **App Check** → pestaña
   **APIs**. Busca la fila **"Firebase AI Logic"** (o "Vertex AI en
   Firebase"). Confirma que aparece y que el contador de "solicitudes" no
   esté en cero (si no aparece nunca en esa lista, la API todavía no "ve"
   tráfico de App Check, lo que apunta a un problema de propagación o de
   vinculación del proyecto).
2. En la misma pantalla, confirma el estado: **"Sin aplicar" (Unenforced)**
   es lo recomendado para seguir probando (así lo pedía ya `docs/app-check.md`
   sección "Sobre la aplicación"). Si está en **"Aplicado" (Enforced)**, es
   la causa más probable del 401 mientras el registro no haya terminado de
   propagarse: dos verificaciones por separado rechazando el mismo token
   producen exactamente este síntoma.
3. App Check → pestaña **Apps** → tu app web → confirma que el **ID de app**
   mostrado ahí coincide con el que usa el proyecto (termina en
   `...3ad2c5`, visible también en *Configuración del proyecto → Tus apps*)
   y que el proveedor configurado es **reCAPTCHA Enterprise** con **la misma
   clave de sitio** que hay en Vercel (empieza por `6LehwSou...`; no hace
   falta pegarla en ningún sitio para comprobarlo, solo compararla visualmente
   carácter por carácter contra la que ya tienes en
   `Settings → Environment Variables` de Vercel).
4. Si todo lo anterior coincide y el 401 persiste: Firebase documenta que un
   App Check recién registrado puede tardar **hasta ~15–30 minutos** (a veces
   más) en propagarse a los verificadores de cada API individual. Como la
   clave se cargó hace más de 16 horas, esto ya no debería ser la causa, pero
   vale la pena un segundo intento después de confirmar los puntos 1–3 y
   esperar unos minutos tras cualquier cambio que hagas en la consola.

## Hallazgo 3 (21 de noviembre, continuación — causa exacta del Hallazgo 2)

Con el Hallazgo 1 ya corregido en código, se repitió la prueba varias veces en
`localhost` con las variables reales de producción (descargadas con
`vercel env pull --environment=production`, nunca commiteadas). El resultado
fue inconsistente al principio — a veces llegaba hasta Gemini — hasta
descubrir que el SDK de App Check **cachea el token en IndexedDB
(`firebase-app-check-database`) por origen**, y una sesión de desarrollo
anterior en ese mismo `localhost:3001` había dejado cacheado un token de
**depuración** (`FIREBASE_APPCHECK_DEBUG_TOKEN`, válido solo en local) que se
reutilizaba sin pedir uno nuevo, dando un falso "funciona". Al borrar esa base
de datos (`indexedDB.deleteDatabase(...)`) y recargar, la prueba volvió a
fallar — esta vez de forma reproducible.

Se interceptó `fetch()` para leer la cabecera real `X-Firebase-AppCheck` que
el SDK manda a `firebasevertexai.googleapis.com`. No es un JWT: son 36
caracteres que, decodificados en Base64, son literalmente
`{"error":"UNKNOWN_ERROR"}`. Es el comportamiento documentado del propio SDK
de App Check: cuando no logra obtener un token real, en vez de omitir la
cabecera manda este marcador de error — por eso el servidor responde,
correctamente, "token is invalid": el cliente nunca llegó a tener un token
de verdad que enviar.

Para encontrar el error exacto se invocó directamente
`grecaptcha.enterprise.execute(siteKey, {action})` en la consola del
navegador, con la misma clave de sitio que usa la app. La respuesta:

```
Error: Invalid site key or not loaded in api.js: 6LehwSou...
```

Este es un error específico de la propia biblioteca de reCAPTCHA Enterprise
de Google, no de Firebase ni del código de este repositorio: ocurre cuando el
dominio actual no coincide con los **dominios permitidos configurados para
esa clave de sitio** en la consola. Es consistente con lo observado en el
Hallazgo 1, donde en el dominio público real
(`xibalba-firebase-2026.vercel.app`) reCAPTCHA **sí** generó un token (llegó
a intercambiarse y dio el 400 del BOM) — la clave funciona ahí. Solo falla en
`localhost`, lo que indica que `localhost` no está realmente en la lista de
dominios permitidos de esta clave de reCAPTCHA Enterprise, al contrario de lo
que asumía `docs/app-check.md`.

**Conclusión:** no hay evidencia de que la corrección del BOM (Hallazgo 1)
sea insuficiente. La prueba en `localhost` no puede validar el flujo completo
porque reCAPTCHA Enterprise rechaza ese origen antes de llegar siquiera a la
etapa que el Hallazgo 2 describía. La única forma de confirmar si el 401
persiste **en el dominio real** es probar ahí, con el código corregido —
y eso requiere desplegar esta rama (al menos como vista previa alias al
dominio de producción, o con autorización para el propio dominio de
producción), porque un despliegue de vista previa con hash aleatorio
(`xibalba-firebase-2026-<hash>.vercel.app`) tampoco está en la lista de
dominios permitidos de la clave.

### Qué puedes revisar tú mismo, sin compartir ningún secreto

1. Google Cloud Console → Seguridad → reCAPTCHA Enterprise → la clave que
   empieza por `6LehwSou...` → pestaña de dominios. Confirma si `localhost`
   realmente está en la lista (si no lo está, añadirlo no cambia nada en
   producción, pero sí permitiría volver a probar localmente).
2. Autorizar que esta rama (`finalizacion/app-check-y-pendientes`) se
   despliegue — como vista previa alias al dominio de producción, o
   directamente a producción si ya revisaste el resto de esta sesión — para
   repetir ahí la prueba del Hallazgo 2 con el código ya corregido.

### Lo que NO se hizo, a propósito

- No se desactivó App Check.
- No se usó ningún token de depuración en producción.
- No se imprimió ni se pidió ninguna clave secreta; todas las comparaciones
  de esta sesión fueron sobre valores públicos (`NEXT_PUBLIC_*`) o mirando la
  consola directamente.
- No se tocó la rama `release/xibalba-2026`: todo este trabajo vive en
  `finalizacion/app-check-y-pendientes`.

## Qué falta para cerrar esto

Una vez confirmados los puntos 1–3 (o corregido lo que no coincida), repetir
la prueba real: `docs/app-check.md` sección 4, o directamente el caso
**"Control: un mensaje normal"** en `/` con el consentimiento de IA activo —
debe dar **verde** en vez de **gris**.
