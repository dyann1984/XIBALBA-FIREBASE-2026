# Pruebas de la fase de finalización

Fecha: 14 de noviembre de 2026. Equipo: Windows 11, **Node v22.23.4**, npm 10.9.9.
Todo lo que sigue se ejecutó de verdad; los números son los que devolvió la
terminal.

## 1. Suite automatizada

`npm test` → `node --experimental-strip-types --test tests/*.test.mjs`

```
# tests 166
# pass 166
# fail 0
```

> **Qué rama aporta qué.** Esa ejecución se hizo sobre el árbol de trabajo tal
> como está, que contiene también el trabajo de una sesión paralela
> (`codex/finalizacion-xibalba`, commit `bb49ea6`: lectura limitada del cuerpo
> HTTP y mensajes de error del proveedor que ya no se reenvían al cliente). La
> rama `finalizacion-mvp` aporta **162** de esas 166; las otras **4** son
> `tests/limited-body.test.mjs`, de la rama paralela. Las dos ramas no tocan los
> mismos ficheros y pasan juntas; decidir si se fusionan es una decisión
> pendiente, anotada en `docs/pendientes-hackathon.md`.

Desglose medido fichero a fichero:

| Fichero | Pruebas |
|---|---|
| `tests/agents.test.mjs` | 46 |
| `tests/external.test.mjs` | 43 |
| `tests/phase3.test.mjs` | 24 |
| `tests/security.test.mjs` | 21 |
| `tests/finalizacion.test.mjs` | **20 (nuevas)** |
| `tests/audit.test.mjs` | 4 |
| `tests/limited-body.test.mjs` | 4 (rama paralela) |
| `tests/phase1.test.mjs` | 4 |

Las 142 anteriores siguen en verde: el catálogo de instituciones y el cambio de
cobertura de VUCUB CAMÉ no rompieron ninguna.

### Qué cubren las 20 nuevas

**Catálogo de instituciones (8)**

- un código conocido da nombre; uno ausente se declara «no identificada» y
  **nunca** se adivina con el nombre de otra institución;
- toda entrada tiene 3 dígitos y nombre, y **ningún alias se repite** entre dos
  instituciones;
- las palabras comunes no disparan nada: «el OXXO de la esquina» y «la cuenca
  del río» no nombran a ninguna institución;
- no hay discrepancia cuando el banco nombrado es el de la cuenta, ni cuando el
  código está fuera del catálogo;
- una CLABE 127 en un texto que dice «Santander» emite
  `clabe-institucion-discrepante`, severidad media, con la limitación «no es
  prueba de fraude» incluida;
- el nombre de la institución **no baja el riesgo**: la evidencia sigue siendo
  informativa;
- **regresión de privacidad**: la CLABE completa no aparece en ningún campo de
  la auditoría, ni siquiera parcialmente;
- la discrepancia suma puntuación y el resultado nunca queda verde.

**Historial (8)**

- el saneado enmascara CLABE, tarjeta con espacios, cuenta con guiones, importes
  con coma y punto, y reduce un correo a su dominio; un «a las 10» se conserva;
- el fragmento nunca supera los 90 caracteres;
- `summarize` guarda tres señales como máximo y jamás el texto completo;
- el historial no crece más allá de 20 y conserva lo más reciente primero;
- lo leído de `localStorage` es dato no confiable: JSON inválido, un objeto en
  lugar de un arreglo o entradas corruptas devuelven lista vacía o se descartan
  una a una sin arrastrar a las válidas;
- un almacenamiento que **lanza** en `getItem`, `setItem` y `removeItem` no
  rompe nada;
- `save` vuelve a sanear: si alguien construyera una entrada con la CLABE
  completa, no llega al disco;
- las etiquetas tienen respaldo para valores desconocidos.

**Casos de demostración (4)**

- ningún caso contiene una CLABE mal formada ni un número de tarjeta, y **todos
  los enlaces usan `example.com`**, reservado por la IANA para documentación;
- cada caso produce el semáforo que anuncia (comprobado contra el motor real,
  no contra un texto escrito a mano);
- el caso de control da **gris** sin IA y **verde** con interpretación de IA
  baja: el verde sigue siendo alcanzable;
- la llamada de demostración convoca a CAMAZOTZ y a VUCUB CAMÉ y produce la
  discrepancia de institución.

## 2. Tipos y compilación

```
npm run typecheck   → sin errores
npm run build       → ✓ Compiled successfully, 6 rutas, sin avisos
```

Durante la auditoría, el build emitía cuatro avisos de `autoprefixer`
(`align-items:end` y `align-items:start` tienen soporte dispar entre
navegadores). Se corrigieron a `flex-end` y `flex-start` en `app/globals.css`;
el build de verificación salió limpio.

Tamaño de la ruta principal: 98.4 kB, 352 kB de JS en la primera carga (antes de
esta fase: 92.9 kB / 346 kB; el aumento son los casos de demostración y el
historial).

## 3. Verificación en el navegador

Servidor de desarrollo real (`npm run dev`), navegador integrado.

| Comprobación | Resultado |
|---|---|
| Caso de demostración de la llamada, auditado en el dispositivo | **Rojo**, confianza alta, 8 señales, 46/50 comprobaciones |
| Evidencia de discrepancia de institución | Visible, con la CLABE enmascarada `127***********0006` |
| Historial tras el análisis | 1 entrada, con el fragmento saneado y las tres señales principales |
| Casilla «Guardar en este navegador» | Escribe en `localStorage`; **la CLABE no aparece** en lo guardado |
| Recarga de la página | El historial persiste y se vuelve a pintar |
| Consola del navegador | Sin errores |
| Móvil 375×812 | Sin desbordamiento horizontal (`scrollWidth` = `clientWidth` = 375); los casos de demostración pasan a una columna y el historial se lee completo |

### Cabeceras de seguridad (medidas con `Invoke-WebRequest` sobre el servidor real)

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' …;
  connect-src 'self' https://firebaseappcheck.googleapis.com …;
  object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()
Cross-Origin-Opener-Policy: same-origin
X-Powered-By: (ausente)
Strict-Transport-Security: (ausente en desarrollo, correcto)
```

Comprobado además dentro de la página:
`document.featurePolicy.allowsFeature('microphone')` → **false**, y
`…('camera')` → **true**. El micrófono queda cerrado por el navegador, que es
justo lo que la interfaz promete; la cámara sigue disponible porque adjuntar una
foto es una función real.

> **Hallazgo durante esta verificación.** La primera versión de la política de
> permisos llevaba `camera=()` y habría roto el botón «Usar cámara» de
> `ImageAttachments.tsx` en producción. Se detectó al revisar el código que
> llama a `getUserMedia`, antes de desplegar nada, y se corrigió a
> `camera=(self)`.

## 4. Lo que NO se probó, y por qué

- **La ruta de IA de punta a punta.** `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY`
  está vacía, así que no hay forma honesta de ejercitar Firebase AI Logic ni la
  transcripción de audio. No se simuló una respuesta del modelo para fingir que
  funcionaba.
- **DNS y RDAP en vivo.** Siguen deshabilitados (`XIBALBA_EXTERNAL_AUDITS`). Su
  verificación contra dominios públicos es la de la fase anterior
  (`scripts/verify-external-live.mjs`), no se repitió aquí.
- **El endpoint `/api/audit/external` contra un token real de App Check.**
  Requiere la clave de sitio. Sus pruebas unitarias (firma, emisor, audiencia,
  caducidad, caché del JWKS) sí se ejecutaron: están entre las 21 de
  `security.test.mjs`.
- **Navegadores reales distintos del integrado.** El tamaño móvil se emuló; no
  se probó en un teléfono físico.
