# Diseño técnico · CAMAZOTZ (voz, llamadas y extorsión)

Estado: **diseño. No implementado.** Fecha: 14 de noviembre de 2026.

CAMAZOTZ es el agente de llamadas. Hoy aparece en la interfaz como agente
previsto y **no debe presentarse como funcional** hasta que exista lo de abajo.

---

## 0. Límite que define el alcance

**CAMAZOTZ no accede al teléfono.** No lee el registro de llamadas, no
intercepta audio en curso, no pide permisos de telefonía y no se integra con
ninguna operadora. Analiza lo que la persona le entrega a mano.

Esto no es una limitación técnica que haya que superar: es la decisión de
diseño. Un agente que escucha llamadas es un agente que puede grabar a
terceros sin su consentimiento, lo que en México cae bajo la LFPDPPP y, según
el caso, bajo el delito de intervención de comunicaciones privadas. Queda
fuera de alcance mientras no exista autorización expresa y un marco legal
revisado.

---

## 1. Fases

| Fase | Entrada | Estado |
|---|---|---|
| **1** | Transcripción escrita o pegada por la persona | lo que se implementa primero |
| **2** | Audio subido por la persona, con consentimiento explícito | diseñado, no implementado |
| 3 | Dictado en vivo durante la llamada | **fuera de alcance** |

La fase 1 ya es útil: el patrón de una llamada de fraude es verbal y
reconocible por escrito. La fase 2 solo añade comodidad, no capacidad.

---

## 2. Señales deterministas (categoría A)

Se añaden a `lib/analysis/patterns.ts` con una categoría nueva, `voz`. Son
patrones sobre el texto, con el mismo contrato que los 16 existentes: id,
severidad, evidencia citada literalmente del original y **limitación escrita**.

### 2.1 Suplantación de institución

| Señal | Severidad | Razonamiento |
|---|---|---|
| Se presenta como banco y pide NIP, token, clave dinámica o CVV | **crítico** | Ningún banco mexicano los pide por teléfono. Es la frase que define el fraude |
| Se presenta como banco y anuncia «cargo no reconocido» o «bloqueo de cuenta» | alto | Apertura clásica del *vishing* |
| Se presenta como SAT, CFE, Telmex, Infonavit o IMSS y exige pago inmediato | alto | Esas instituciones no cobran por teléfono |
| Dice llamar «del departamento de seguridad» y pide transferir la llamada | medio | Técnica de escalada de confianza |
| Pide instalar una aplicación de asistencia remota | **crítico** | Toma de control del dispositivo |

### 2.2 Extorsión y secuestro virtual

| Señal | Severidad | Razonamiento |
|---|---|---|
| Afirma tener retenido a un familiar | **crítico** | Secuestro virtual |
| «No cuelgues», «no avises a nadie», «no llames a la policía» | **crítico** | Aislamiento de la víctima, el rasgo más constante |
| Exige depósito inmediato a una cuenta que dicta por teléfono | **crítico** | Combinado con lo anterior, es definitorio |
| Menciona datos personales para dar credibilidad | alto | Dato comprado o filtrado, no prueba de nada |
| Amenaza con daño físico | **crítico** | — |

### 2.3 Premios, cobranza y empleo

| Señal | Severidad |
|---|---|
| Premio o sorteo no solicitado que exige un pago previo | alto |
| Cobranza extrajudicial con amenaza de embargo inmediato | alto |
| Oferta de empleo que pide depósito para «apartar el lugar» | alto |

### 2.4 Señales estructurales de la transcripción

No dependen del contenido, sino de la forma: presión temporal acumulada
(varias frases de urgencia), negativa a dar un número de expediente
verificable, insistencia tras una negativa. Severidad media, con falsos
positivos documentados.

> Cada patrón lleva su limitación. «Cargo no reconocido» también lo dice un
> banco de verdad; lo que no hace un banco de verdad es pedir el NIP.

---

## 3. Lo que NO es determinista (categoría B)

La interpretación de tono, intención, credibilidad del interlocutor o
probabilidad de que la llamada sea real **es del modelo**, va en la categoría B
y no puntúa hacia el veredicto. Lo mismo para cualquier identificación de
institución que no venga de una coincidencia literal.

**No se infiere identidad del hablante.** Ni edad, ni género, ni acento, ni
región. No aporta a la detección de fraude y sí abre un problema de sesgo.

---

## 4. Audio (fase 2)

| Aspecto | Decisión |
|---|---|
| Formatos | Solo lo que el navegador ya decodifica; sin dependencias nuevas |
| Tamaño | Techo duro, al estilo de los 4 MB de imagen |
| Transcripción | Preferir el dispositivo. Si hay que usar la nube, **consentimiento explícito por separado**, distinto del de texto |
| Almacenamiento | **Ninguno.** En memoria, liberado al terminar, igual que las imágenes |
| Voces de terceros | Advertencia previa: la grabación puede contener la voz de otra persona, y compartirla tiene implicaciones legales que son de quien la sube |
| Evidencia | La transcripción automática es **categoría C hasta que exista**, y cuando exista se marca como transcripción automática, no como lo dicho |

El punto de la última fila importa: una transcripción automática se equivoca, y
una palabra mal transcrita puede inventar o borrar una señal. Se cita siempre
como «según la transcripción automática», nunca como cita textual.

---

## 5. Integración con el motor existente

CAMAZOTZ **no trae modelo de riesgo propio**. Reutiliza lo que ya está:

- `auditMessage` ya recorre el catálogo de patrones. Se amplía el catálogo, no
  el motor.
- `combineRisk` decide el semáforo, con las mismas reglas.
- Una transcripción sin enlaces **sí puede ser verde**, porque el texto se
  agota localmente. Una transcripción que menciona un enlace o una cuenta, no.
- Nuevo sujeto de auditoría: `'transcripcion'`, junto a `url`, `mensaje`,
  `imagen` y `mixto`.

Trabajo real estimado: el catálogo de patrones y sus pruebas. El motor no se
toca.

---

## 6. Pruebas exigidas antes de declararlo funcional

1. Un caso por señal, con la evidencia citada literal y con acentos.
2. Falsos positivos: llamada legítima del banco que avisa de un cargo y **no**
   pide el NIP → no debe dar alto.
3. Transcripciones con ruido: palabras cortadas, repeticiones, cambio de
   hablante sin marcar.
4. Transcripción vacía, de un solo carácter y muy larga.
5. **Ningún dato personal real en las pruebas.** Transcripciones redactadas a
   mano para el caso.

---

## 7. Fuera de alcance

Acceso al registro de llamadas, intercepción, grabación automática,
identificación del hablante, bloqueo de números, denuncia automatizada ante
una autoridad y cualquier integración con una operadora. Nada de esto se
implementa sin autorización expresa.
