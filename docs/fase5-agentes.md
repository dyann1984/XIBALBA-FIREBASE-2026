# Fase 5 · Los cinco agentes

Fecha de la verificación: 13 de noviembre de 2026.
Base conservada: commit `a8d169a`, Guardián 3D, logo oficial, identidad visual,
Firebase AI Logic y las 96 pruebas anteriores.

Este documento dice **lo que funciona hoy** y **lo que no**. No adelanta nada.

---

## 1. Estado real de cada agente

| Agente | Estado | Qué ejecuta de verdad | Qué sigue sin poder hacer |
|---|---|---|---|
| **IXBALANQUÉ** · mensajes | Funcional | Catálogo general de patrones + análisis sintáctico de los enlaces del texto | No consulta listas de reputación ni verifica remitentes |
| **HUN CAMÉ** · enlaces | Funcional (local) | 18 comprobaciones locales de URL; DNS y RDAP implementados y verificados | Las consultas externas siguen **deshabilitadas** para usuarios generales; no visita el sitio |
| **CAMAZOTZ** · voz y llamadas | Funcional sobre texto; audio parcial | 14 señales de voz + catálogo general; acepta audio y audita sus metadatos | **No transcribe por sí solo**: la transcripción depende del modelo y del consentimiento. No abre el micrófono ni graba |
| **VUCUB CAMÉ** · fraude financiero | Funcional | Dígito verificador de CLABE, Luhn, institución emisora, monederos, 10 señales financieras | No sabe de quién es una cuenta, si un pago se recibió, ni si una empresa está registrada |
| **EL GUARDIÁN** · coordinación | Funcional | Selección de agentes, fusión sin duplicados, semáforo único, preguntas de seguimiento, representación 3D | No guarda historial; el semáforo orienta, no confirma |

---

## 2. CAMAZOTZ

### Lo que se implementó
- `lib/analysis/voice.ts` — 14 señales propias de una llamada: suplantación de
  institución, asistencia remota, transferencia a «otra área», exigir no colgar
  ni avisar a nadie, familiar retenido, amenaza de daño, dictado de cuenta,
  cargo no reconocido, verificación de identidad, urgencia, datos personales
  como prueba de credibilidad, premio telefónico, cobranza amenazante y negativa
  a dar datos verificables.
- `lib/analysis/audio.ts` — carga de archivo en memoria (MP3, M4A, WAV, OGG,
  WebM; 10 MB), lectura de duración, y un **estado de transcripción explícito**
  con cinco valores: `pendiente`, `sin-consentimiento`, `no-disponible`,
  `error`, `disponible`.
- `auditTranscript` y `auditAudio` en `lib/analysis/audit.ts`.

### La regla que no se negocia
**Nunca se afirma que se transcribió un audio.** `transcribeAudio` no inventa
texto en ningún camino: sin consentimiento devuelve `sin-consentimiento`, sin
motor devuelve `no-disponible`, una respuesta vacía devuelve `error`, y una
negativa del modelo («no puedo procesar…») devuelve `no-disponible`, no una
transcripción. Cuando sí hay texto, se etiqueta como transcripción automática,
clase `ia`, con la limitación de que una palabra mal reconocida puede inventar o
borrar una señal.

### Micrófono y llamadas
El módulo **no** abre el micrófono, no graba y no intercepta llamadas. Solo
acepta un archivo que la persona elige a mano. La interfaz lo dice junto al
botón: «No se usa el micrófono ni se graban llamadas».

### Lo que una transcripción nunca acredita
`identidad real de quien llamó` y `número de origen de la llamada` se emiten
siempre como comprobaciones pendientes, con la nota de que el número en pantalla
puede falsificarse. Por eso **una transcripción nunca puede dar verde**.

---

## 3. VUCUB CAMÉ

### Aritmética verificable
- **CLABE** (`clabeCheckDigit`): pesos 3-7-1 sobre los 17 primeros dígitos,
  módulo 10 de cada producto, verificador `(10 − suma mod 10) mod 10`.
  Comprobado contra el caso conocido `002010077777777771` → verificador `1`.
- **Luhn** para tarjetas de 13 a 19 dígitos.
- Detección de direcciones con forma de monedero (Bitcoin segwit y heredado,
  Ethereum, Tron) — **solo la forma**: no se consulta ninguna cadena de bloques.

### La advertencia obligatoria
Una CLABE o una tarjeta matemáticamente válida **no demuestra nada**: ni que sea
legítima, ni que sea segura, ni que pertenezca a quien dice el mensaje. La cuenta
del estafador también pasa el verificador. Por eso una CLABE válida se emite como
evidencia **informativa** y nunca reduce el riesgo, igual que la antigüedad de un
dominio.

Además, si el texto contiene cualquier identificador financiero, se añaden como
pendientes `titularidad de la cuenta o del medio de pago` y `recepción real del
pago`, de modo que **el verde queda estructuralmente impedido** — el mismo
razonamiento que ya impedía declarar segura una URL que resuelve en el DNS.

### Privacidad de los números
- `validateClabe` **no devuelve el número completo** en ningún campo: solo el
  código de institución y la versión enmascarada.
- Las evidencias muestran `002***********0004` y `************1111`.
- **Corrección encontrada durante estas pruebas:** el fragmento citado de una
  evidencia llegaba a reproducir la CLABE o la tarjeta completas, porque
  `quoteFragment` copiaba el texto coincidente tal cual. Ahora enmascara toda
  secuencia de 12 o más dígitos antes de citarla. Hay una prueba de regresión.

---

## 4. Integración multiagente

`lib/analysis/coordinator.ts`.

1. **Selección por contenido, no por etiqueta.** El agente del tipo declarado
   siempre participa; los demás entran solo si la entrada tiene algo suyo:
   CAMAZOTZ con audio o menciones de llamada, VUCUB CAMÉ con identificadores o
   lenguaje de dinero, HUN CAMÉ con enlaces. Cada agente trae escrito **por qué**
   participa, y se muestra a la persona.
2. **Sin duplicar evidencia.** Un mismo patrón detectado por dos agentes aparece
   una sola vez, atribuido a los dos. Si coincide el id pero difiere la
   severidad, se conserva la más grave: rebajar al fusionar sería perder
   información.
3. **Un solo semáforo.** El veredicto sale de `combineRisk` sobre la auditoría ya
   fusionada, nunca de promediar veredictos por agente.
4. **Lo comprobado y lo estimado siguen separados.** La fusión no cambia la clase
   de ninguna evidencia. La interfaz mantiene los grupos A / A′ / B / C / D.
5. **Cobertura contada una sola vez.** Varios agentes recorren el catálogo
   general a propósito; sumar sus coberturas inflaría el número, así que se
   cuenta una vez por catálogo recorrido.
6. **No se presenta a un agente que no ejecuta nada.** Para una transcripción,
   CAMAZOTZ ya recorre el catálogo general, así que IXBALANQUÉ no se anuncia.
7. **Preguntas de seguimiento.** El Guardián conserva el hilo del análisis en
   curso y entrega al modelo las dos últimas vueltas, con las evidencias
   etiquetadas por clase («comprobado» / «estimado» / «no comprobado»).
8. **El Guardián 3D y sus animaciones se conservan sin tocar.** El `canvas`
   procedural sigue reaccionando al semáforo (`light-rojo`, etc.).

---

## 5. Seguridad

| Requisito | Estado |
|---|---|
| No modificar los secretos ni el proveedor de App Check | Cumplido: `.env.local`, `lib/security/app-check.ts` y `app/api/` sin cambios |
| Endpoints externos deshabilitados para usuarios generales | Cumplido: `EXTERNAL_AUDITS_ENABLED` sigue exigiendo `XIBALBA_EXTERNAL_AUDITS=1` |
| No habilitar facturación ni desplegar servicios | Cumplido: ninguna acción de infraestructura |
| No aceptar datos de prueba personales o bancarios reales | Cumplido: todas las CLABE se construyen con `buildClabe` desde dígitos inventados; la tarjeta es el número público de prueba `4111…1111` |
| No introducir dependencias vulnerables innecesarias | Cumplido: **cero dependencias nuevas** (`package.json` y `package-lock.json` sin cambios) |

Consentimientos separados: aceptar el envío de texto e imágenes **no** autoriza
el envío del audio. El audio tiene su propia casilla, que además pide confirmar
que la persona participó en la conversación.

---

## 6. Pruebas

```
# tests 142
# pass 142
# fail 0
```

96 anteriores conservadas y en verde, 46 nuevas en `tests/agents.test.mjs`,
repartidas en los ocho temas pedidos:

| Tema | Pruebas |
|---|---|
| Transcripciones ficticias | 5 |
| CLABE y Luhn | 7 |
| Mensajes financieros | 7 |
| Archivos de audio inválidos | 4 |
| Consentimiento | 4 |
| Evidencias contradictorias | 5 |
| Coordinación entre agentes | 8 |
| Integridad del semáforo | 6 |

Incluye un **control negativo** (`el verde sigue siendo posible para un texto que
se agota localmente`): si nada pudiera dar verde, el semáforo no informaría nada.

`npm run typecheck`, `npm run build` y `npm test` pasan.

---

## 7. Lo que todavía requiere servicios externos

1. **Transcripción de audio.** Depende de Firebase AI Logic y del consentimiento.
   Sin motor disponible el estado es `no-disponible` y se dice así.
2. **DNS y RDAP.** Implementados y verificados contra dominios públicos de
   referencia, pero **deshabilitados** salvo con `XIBALBA_EXTERNAL_AUDITS=1`.
3. **Titularidad de cuentas y registro regulatorio.** No hay integración con
   CNBV, CONDUSEF ni ninguna institución financiera, y no se ha pedido ninguna.
4. **WHOIS `.mx`.** Adaptador preparado y deshabilitado; `.mx` no publica RDAP.
5. **Protección contra repetición de tokens de App Check.** Requiere el Admin
   SDK; documentado como pendiente en `docs/seguridad-endpoint.md`.

## 8. Pendiente para la demo del hackathon

- **Bloqueante:** `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` está vacía. En
  producción el endpoint devolvería 401 a todo.
- El catálogo de instituciones por código CLABE no está incorporado: hoy se
  muestra el código (`002`), no el nombre del banco.
- La duración del audio no siempre se lee; se informa «duración no legible».
- No hay historial: cada análisis se pierde al salir (decisión de privacidad).
- Sugerencia de guion de demo: una transcripción de secuestro virtual que dicte
  una CLABE. Convoca a CAMAZOTZ y a VUCUB CAMÉ, muestra la atribución doble en
  «Presión de tiempo», enmascara la cuenta y da rojo con confianza alta.
