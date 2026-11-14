# Diseño técnico · VUCUB CAMÉ (fraude financiero)

Estado: **diseño. No implementado.** Fecha: 14 de noviembre de 2026.

VUCUB CAMÉ es el agente de depósitos, inversiones y comprobantes. Hoy figura
como agente previsto y **no debe presentarse como funcional**.

---

## 0. Límite que define el alcance

**VUCUB CAMÉ no se conecta a ninguna cuenta.** No usa banca abierta, no pide
credenciales bancarias, no consulta saldos, no verifica si una transferencia
ocurrió y no contacta con ninguna institución financiera. Analiza lo que la
persona le entrega: un texto, una captura, unos datos de depósito.

Pedir credenciales bancarias en una aplicación antifraude es exactamente lo que
hace el fraude. La herramienta no puede enseñar ese hábito.

---

## 1. Por qué este agente es el más verificable de los cinco

Es el único donde hay **aritmética que comprobar**, no solo texto que
interpretar. Una CLABE tiene dígito verificador; una tarjeta tiene Luhn; un RFC
tiene formato. Eso es evidencia de categoría A de la clase más fuerte: no es
una heurística con falsos positivos, es un cálculo que sale o no sale.

Esa es la razón de ponerlo antes que cualquier integración externa.

---

## 2. Señales deterministas verificables por cálculo

### 2.1 CLABE interbancaria

18 dígitos: 3 de institución, 3 de plaza, 11 de cuenta, 1 verificador.

El dígito verificador se calcula con pesos `3, 7, 1` repetidos sobre los 17
primeros dígitos: para cada posición, `(dígito × peso) mod 10`; se suman los
resultados; el verificador es `(10 − (suma mod 10)) mod 10`.

> **Antes de programarlo hay que confirmar el algoritmo contra la
> especificación oficial de Banxico.** Queda escrito aquí como punto de
> partida, no como dato verificado. Si al comprobarlo no coincide, se corrige
> el documento, no se fuerza el código.

| Señal | Severidad | Razonamiento |
|---|---|---|
| La CLABE tiene 18 dígitos pero el verificador **no cuadra** | **alto** | Un número inventado o mal copiado. Nadie te da una CLABE inválida para pagarle de verdad |
| El texto pide depositar y la CLABE no tiene 18 dígitos | alto | No es una CLABE |
| Se dictan **dos CLABE distintas** en el mismo mensaje | alto | Patrón de reenvío de fraude |
| La CLABE cuadra | **informativo** | **No puntúa hacia seguridad.** Una CLABE válida es la de cualquier cuenta, incluida la del estafador |

La última fila es el equivalente de la antigüedad del dominio: comprobable,
cierto y sin valor exculpatorio.

### 2.2 Institución declarada frente a código de institución

Los 3 primeros dígitos identifican a la institución. Si el mensaje dice «cuenta
de BBVA» y el código es de otra institución, es **evidencia fuerte**: el
estafador copia el nombre del banco que inspira confianza y pega la cuenta que
controla.

**Esta comprobación queda deshabilitada** hasta vendorizar el catálogo oficial
de instituciones de Banxico, igual que se hizo con el *bootstrap* de IANA:
archivo en `data/`, origen y fecha citados, script de regeneración. **No se
escribe una tabla de memoria.** Mientras no exista el catálogo, la señal no
existe.

### 2.3 Tarjeta

| Señal | Severidad |
|---|---|
| Se piden los 16 dígitos, la fecha y el CVV por mensaje | **crítico** |
| El número no pasa Luhn | alto |
| Se pide una foto de la tarjeta | **crítico** |

Luhn es estándar y no necesita catálogo externo.

### 2.4 Criptomonedas y medios irreversibles

| Señal | Severidad | Razonamiento |
|---|---|---|
| Dirección con forma de monedero de criptomoneda como destino de pago | **alto** | Irreversible y sin intermediario que reclame |
| Pago exigido en tarjetas de regalo o tiempo aire | **alto** | Irreversible por diseño |
| Pago por transferencia a nombre de una persona física cuando se compra a una «empresa» | medio | Falso positivo real: hay negocios pequeños legítimos así |

La detección es por **forma** de la cadena, no por consulta a ninguna cadena de
bloques. No se consulta saldo ni historial de ningún monedero.

---

## 3. Señales de inversión y rendimientos

Aquí no hay aritmética que valide nada, pero sí patrones con evidencia sólida:

| Señal | Severidad |
|---|---|
| Rendimiento **garantizado** con cifra concreta | **alto** |
| Rendimiento prometido por encima de un umbral implausible mensual | alto |
| Estructura de referidos o reclutamiento para cobrar | **alto** |
| Presión por cerrar «hoy» o cupo limitado | medio |
| Afirma estar regulado sin dar número de registro verificable | medio |

> Lo que **no** se hace: afirmar que una empresa no está registrada ante la
> CNBV o la CONDUSEF. Eso exige consultar su padrón, no está implementado, y
> inventarlo sería exactamente el tipo de dato fabricado que el proyecto
> prohíbe. Se recomienda a la persona consultarlo, con el nombre del padrón.

---

## 4. Comprobantes en imagen

Las imágenes ya funcionan: hasta 3, JPEG o PNG, 4 MB, en memoria, sin
almacenamiento. Lo que falta es leerlas.

| Capacidad | Estado |
|---|---|
| Metadatos de la imagen (tamaño, tipo, dimensiones) | ya implementado, categoría A |
| OCR del comprobante | **categoría C.** No implementado |
| Detección de manipulación del comprobante | **fuera de alcance** |

La última fila merece ser explícita: **no se puede afirmar que un comprobante
esté editado.** Detectar manipulación de imágenes de forma fiable no está al
alcance de este proyecto, y un falso positivo acusaría a una persona honesta
de falsificar. Si el modelo comenta algo sobre la apariencia del comprobante,
va a categoría B con su advertencia, y nunca como hecho.

Cuando haya OCR, lo extraído se marca como **leído por reconocimiento
automático**, no como el contenido del comprobante, por la misma razón que la
transcripción de audio en [CAMAZOTZ](plan-camazotz.md).

---

## 5. Privacidad: el punto más delicado de los cinco agentes

Un comprobante de pago lleva nombre, cuenta parcial, importe y a veces
dirección. Una captura de banca en línea lleva más.

| Regla | Aplicación |
|---|---|
| Aviso **antes** de subir | «Cubre tu nombre y tu número de cuenta antes de compartir la captura» |
| Enmascarado en la evidencia | Una CLABE citada se muestra parcial: se ven los 3 de institución y los 4 últimos |
| Sin almacenamiento | Ya se cumple: memoria, liberada al terminar |
| Nube solo con consentimiento | Ya se cumple: casilla explícita |
| Sin datos reales en pruebas | CLABE y tarjetas **construidas** para que cuadre el verificador, nunca de una cuenta real |

El enmascarado aplica también a los registros: ninguna CLABE, tarjeta o RFC
completo debe terminar en un log.

---

## 6. Integración con el motor existente

Igual que CAMAZOTZ: **no hay modelo de riesgo nuevo.** Se amplía el catálogo de
patrones con una categoría `financiero`, se añaden las funciones de cálculo
(CLABE, Luhn) como comprobaciones deterministas y `combineRisk` sigue
decidiendo. Nuevo sujeto: `'financiero'`.

Las funciones de cálculo son puras, así que se prueban sin red y sin modelo.

---

## 7. Pruebas exigidas antes de declararlo funcional

1. CLABE con verificador correcto y con verificador incorrecto, construidas a
   mano, con el cálculo comprobado contra la especificación.
2. Luhn: válido, inválido, longitud incorrecta, con espacios y guiones.
3. Un caso por señal de inversión, con su falso positivo documentado.
4. Que una CLABE válida **no** baje el riesgo: prueba de regresión explícita,
   hermana de «resolver en el DNS no pone una URL en verde».
5. Enmascarado: ninguna evidencia emitida contiene una CLABE o tarjeta
   completa.
6. Entradas límite: muchos números, números pegados a texto, dígitos en otro
   alfabeto.

---

## 8. Fuera de alcance

Banca abierta, consulta de saldos, verificación de transferencias, contacto con
instituciones financieras, consulta de padrones de CNBV o CONDUSEF, detección
de manipulación de imágenes, y cualquier petición de credenciales bancarias.
Nada de esto se implementa sin autorización expresa.
