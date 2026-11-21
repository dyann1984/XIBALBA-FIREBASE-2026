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
