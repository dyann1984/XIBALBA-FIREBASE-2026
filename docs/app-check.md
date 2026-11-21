# Activar la IA en el despliegue: la clave de App Check

Esta es la única pieza que separa a XIBALBÁ de tener la IA híbrida funcionando
en <https://xibalba-firebase-2026.vercel.app>. Todo lo demás ya está hecho.

**Nada de lo que sigue requiere compartir una credencial con nadie.** La clave
de sitio que vas a generar es pública por diseño: viaja en el paquete de cliente
y se ve en el navegador de cualquiera. Lo que **nunca** sale de la consola es la
*clave secreta* de reCAPTCHA; XIBALBÁ no la usa ni la necesita.

## 0. Lo que ya se comprobó, para que sepas qué esperar

La IA **ya funciona**, verificada en local el 14 de noviembre de 2026 contra tu
proyecto de Firebase real:

| Prueba | Resultado |
|---|---|
| Etiqueta de estado | pasó de «IA · SIN CONFIGURAR» a «IA · SIN VERIFICAR» y luego a **«IA · NUBE»** |
| Caso de control, con IA | **Verde**, riesgo bajo, confianza **baja** con la nota «el nivel depende de la interpretación no verificada del modelo» |
| Caso de la llamada, con IA | sigue **Rojo**, 8 señales, confianza alta: el modelo coincidió y **no pudo rebajar nada** |
| Con el modelo caído | **Rojo** intacto, «Interpretación de IA: No Disponible» y el mensaje «No se pudo conectar…». Sin filtrar ni un `TypeError` |

En local eso funciona por el **token de depuración** de App Check, que solo vale
en `localhost` y en modo desarrollo. Para el despliegue hace falta una clave de
verdad. Eso es lo que configuras ahora.

## 1. Generar la clave (consola de Firebase, 5 minutos)

1. Abre la consola de Firebase, tu proyecto, y entra en **App Check**
   (*Compilación → App Check*).
2. En la pestaña **Apps**, localiza tu **aplicación web**. Si no aparece,
   regístrala primero en *Configuración del proyecto → Tus apps*.
3. Pulsa **Registrar** y elige el proveedor **reCAPTCHA Enterprise**.
4. Firebase te ofrece crear una clave de reCAPTCHA Enterprise o usar una
   existente. Crea una **de tipo sitio web (*Website*)**.
5. En **Dominios permitidos** de esa clave añade, **los dos**:
   - `xibalba-firebase-2026.vercel.app`
   - `localhost`
6. Copia la **clave de sitio** (empieza por `6L…`). Es la única que necesitas.

> **El error más común, y que solo aparece después de desplegar:** la clave
> funciona en `localhost` y falla en el dominio desplegado porque nadie añadió
> ese dominio en el paso 5. Si App Check devuelve 403 en producción, mira ahí
> primero.

### Sobre la aplicación (*enforcement*)

Déjala **sin aplicar** («unenforced») hasta que compruebes que el despliegue
obtiene tokens. Cuando lo confirmes, aplica la restricción para **Firebase AI
Logic**. Si la aplicas antes, la IA dejará de responder en producción y parecerá
un fallo del código cuando es de configuración.

## 2. Cargar la clave en Vercel

El proyecto `xibalba-firebase-2026` ya tiene cargadas, en *Production* y
*Preview*:

- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Faltan dos, y las dos tienes que ponerlas tú:

**a) La clave de API.** Vercel pide confirmación humana explícita para exponer
públicamente un valor con forma de clave, y se la doy a ti en lugar de forzarla.
Sustituye `<valor>` por el valor de `NEXT_PUBLIC_FIREBASE_API_KEY` de tu
`.env.local`:

```bash
vercel env add NEXT_PUBLIC_FIREBASE_API_KEY production --type config --value "<valor>" --yes
```

```bash
vercel env add NEXT_PUBLIC_FIREBASE_API_KEY preview --type config --value "<valor>" --yes
```

**b) La clave de sitio de App Check**, la que acabas de generar:

```bash
vercel env add NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY production --type config --value "<clave 6L...>" --yes
```

```bash
vercel env add NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY preview --type config --value "<clave 6L...>" --yes
```

También puedes hacerlo desde el panel: *Settings → Environment Variables*.

> **Nunca definas en Vercel** `NEXT_PUBLIC_FIREBASE_APP_CHECK_DEBUG` ni
> `FIREBASE_APP_CHECK_DEBUG_TOKEN`. Son exclusivas de `localhost` y en
> producción abrirían una puerta que App Check está ahí para cerrar. El endpoint
> `/api/app-check-debug` ya responde 404 fuera de desarrollo, pero la
> configuración debe decir lo mismo.

## 3. Volver a desplegar

Las variables `NEXT_PUBLIC_*` se **incrustan en el build**: cargarlas no basta,
hay que reconstruir. Y aquí hay algo que decidir, porque el repositorio ya está
conectado a Vercel:

- **Cualquier empujón a `release/xibalba-2026` desplegará a producción
  automáticamente.** Es lo que pediste al conectar GitHub, pero conviene saberlo
  antes del primer empujón.
- Si prefieres probar sin tocar producción: `vercel deploy` (sin `--prod`) crea
  una vista previa con las variables de *Preview*.

## 4. Comprobar que quedó bien

Con el despliegue nuevo abierto:

1. La etiqueta superior ya **no** debe decir «IA · SIN CONFIGURAR».
2. Marca la casilla de consentimiento en «Nuevo análisis»: el botón debe pasar
   de «Auditar solo en este dispositivo» a **«Analizar contenido»**.
3. Carga el caso **«Control: un mensaje normal»** y analiza. Debe dar **verde**;
   sin IA daba gris. Es la prueba más limpia de que el modelo respondió.
4. Carga el caso de **la llamada**. Debe seguir dando **rojo** con 8 señales: la
   IA no puede rebajar un veredicto determinista.
5. La etiqueta dirá **«IA · LOCAL»** o **«IA · NUBE»** según dónde se ejecutara
   la inferencia. En un navegador sin modelo en el dispositivo será «NUBE», y
   eso es correcto, no un fallo.

Si algo falla, el mensaje en pantalla te dirá qué mirar: «Falta completar la
configuración» (variables), «Firebase rechazó la solicitud» (App Check o
dominios), «Se alcanzó un límite de uso» (cuota).

## 5. Si no llegas a tiempo

**No pasa nada, y no hay que disimularlo.** La aplicación anuncia «IA · SIN
CONFIGURAR», ejecuta la auditoría determinista completa y el endpoint externo
falla cerrado en vez de aceptar tokens sin verificar. El guion de video y
`docs/jueces.md` están escritos para funcionar en ese estado.

Lo que no se va a hacer, en ningún caso, es desactivar App Check ni cargar
credenciales falsas para que parezca que la IA responde.
