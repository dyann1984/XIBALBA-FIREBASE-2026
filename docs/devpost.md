# Descripción para Devpost

Texto listo para pegar. Las secciones siguen la plantilla habitual de Devpost.

---

## Enlaces del proyecto

| Campo de Devpost | Valor |
|---|---|
| **Try it out** | <https://xibalba-firebase-2026.vercel.app> |
| **Repositorio** | `https://github.com/dyann1984/XIBALBA-FIREBASE-2026` (privado: ábrelo o invita a los jueces antes de enviar) |
| Guía de evaluación | `docs/jueces.md` |

En la aplicación aparece **«IA · SIN CONFIGURAR»**: la clave de App Check no
está cargada en el despliegue, así que la interpretación de IA no se activa y se
dice en pantalla. Menciónalo en la descripción en lugar de dejar que lo
descubran: es coherente con la regla del proyecto, que es no afirmar lo que no
puede demostrar. Lo que el jurado prueba es la auditoría determinista completa,
que es la mayor parte del trabajo.

## Nombre

**XIBALBÁ AI** — Inteligencia de protección contra el fraude digital.

## Frase corta (tagline)

Cinco agentes de IA que te dicen qué encontraron en un mensaje sospechoso, qué
no pudieron comprobar, y por qué. Todo el análisis base, en tu dispositivo.

## Inspiración

El fraude digital en México no gana por sofisticación técnica: gana por tiempo.
«Su cuenta será bloqueada en dos horas». «Tenemos a su hijo, no cuelgue». La
víctima no necesita un informe de seguridad; necesita treinta segundos y una
razón concreta para detenerse.

Las herramientas existentes fallan en dos direcciones opuestas. Unas marcan todo
como peligroso, y la gente aprende a ignorarlas. Otras dicen «este sitio es
seguro» cuando lo único que comprobaron es que el dominio existe. Las dos
enseñan a desconfiar de la herramienta.

XIBALBÁ nació de una regla incómoda: **la ausencia de señales no es prueba de
seguridad**. Si no podemos demostrar algo, lo decimos.

## Qué hace

Pegas un mensaje, un enlace, lo que recuerdas de una llamada o una petición de
dinero. XIBALBÁ responde con:

- un **semáforo** —verde, amarillo, rojo o **gris** cuando la información no
  alcanza, que es una respuesta tan válida como las otras tres;
- **cada evidencia por separado**, clasificada por origen: lo comprobado en el
  dispositivo, lo verificado contra registros públicos, lo que interpretó la IA,
  lo que quedó pendiente y lo que falló;
- la **limitación** de cada evidencia, escrita junto a ella;
- la **cobertura**: cuántas comprobaciones se ejecutaron de cuántas posibles;
- **qué agentes participaron y por qué**.

Los cinco agentes, con nombres del *Popol Vuh*:

| Agente | Qué hace hoy |
|---|---|
| **CAMAZOTZ** · voz y llamadas | 14 señales propias de llamada: suplantación, secuestro virtual, aislamiento de la víctima, petición de claves dinámicas. Audita el archivo de audio adjunto |
| **IXBALANQUÉ** · mensajes | Catálogo general de patrones de fraude y extracción de los enlaces del texto |
| **VUCUB CAMÉ** · dinero | Dígito verificador de CLABE, algoritmo de Luhn, forma de monederos cripto, 10 señales financieras y la institución a la que corresponde la cuenta |
| **HUN CAMÉ** · enlaces | 18 comprobaciones locales de URL: homoglifos, subdominios que imitan marcas, credenciales incrustadas, esquemas y puertos. DNS y RDAP implementados |
| **EL GUARDIÁN** · coordinación | Elige los agentes según el contenido, fusiona la evidencia sin duplicarla, emite un solo semáforo y responde preguntas de seguimiento |

El resultado que mejor resume el proyecto: en una llamada de secuestro virtual
que dicta una cuenta, XIBALBÁ detecta que **la llamada dice «Santander» y la
CLABE pertenece a otra institución** —y aun así escribe, junto a la evidencia,
que eso no prueba un fraude, porque alguien puede pedir legítimamente un
depósito en otro banco.

## Cómo está construido

- **Next.js 15** y **React 19** (App Router, TypeScript estricto).
- **Firebase AI Logic** con inferencia híbrida: `PREFER_ON_DEVICE`, con Gemini
  en la nube como respaldo. La interfaz muestra qué ruta se usó realmente, según
  lo que informa el SDK, no lo que esperábamos.
- **Firebase App Check** verificado **de verdad en el servidor**: firma RS256
  contra el JWKS público, emisor, audiencia, tipo y caducidad. Sin cuenta de
  servicio.
- **SVG procedural** para el Guardián (`components/guardian/JaguarAvatar.tsx`):
  sin modelo 3D ni librería de render, reacciona en tiempo real al semáforo, al
  micrófono y a la síntesis de voz (respiración, parpadeo, mirada, mandíbula
  sincronizada con el habla).
- **Motor determinista propio** en TypeScript: catálogos de patrones,
  aritmética financiera y un modelo de riesgo donde la IA solo puede **elevar**
  el nivel, nunca rebajarlo.
- **Cero dependencias de análisis de terceros.** Ninguna lista de reputación,
  ningún servicio de puntuación: lo que afirma el sistema, lo calcula y lo puede
  mostrar.

## Retos

1. **Resistir la tentación de afirmar.** La versión fácil de este proyecto da
   verde cuando no encuentra nada. La correcta da gris y explica qué falta. Esa
   decisión obligó a rehacer el modelo de riesgo y a inventar una clase de
   evidencia para lo que *no se comprobó*.
2. **Transcripción de audio sin inventar texto.** `transcribeAudio` tiene cinco
   estados explícitos. Si el modelo responde «no puedo procesar este audio», el
   estado es *no disponible*, no una transcripción vacía.
3. **Privacidad en los datos que más duelen.** Una CLABE no debe llegar entera a
   ninguna parte. Durante las pruebas descubrimos que el fragmento citado de una
   evidencia reproducía el número completo; se corrigió y hay prueba de
   regresión.
4. **Auditorías externas sin exponer a nadie.** DNS y RDAP están implementados y
   verificados contra dominios públicos, pero permanecen **deshabilitados** tras
   un interruptor de servidor.

## Logros

- **226 pruebas automatizadas** en verde (204 unitarias + 22 E2E con
  Playwright, 4 de ellas de accesibilidad con axe-core), incluidas pruebas de
  privacidad, de integridad del semáforo y un **control negativo** que
  comprueba que el verde sigue siendo alcanzable.
- La aplicación es **útil sin conexión y sin configurar Firebase**: la auditoría
  determinista completa se ejecuta en el dispositivo, y una PWA instalable con
  service worker cachea el cascarón estático (nunca las rutas de análisis).
- Cabeceras de seguridad que respaldan lo que la interfaz promete: la política
  de permisos solo habilita cámara y micrófono para lo que la propia interfaz
  ofrece de forma explícita (adjuntar fotos, dictar una pregunta al Guardián),
  nunca en segundo plano y nunca sin que la persona pulse el botón.

## Qué aprendimos

Que en seguridad la honestidad es una característica del producto, no una nota
legal. Un usuario que recibe «no lo sé, esto es lo que falta por comprobar»
aprende a confiar en el «esto es un fraude» cuando llega.

## Qué sigue

- Historial por usuario en la nube con Firebase Authentication (diseño y reglas
  ya escritos; hoy el historial vive solo en el dispositivo).
- Habilitar DNS y RDAP para el público general, con límites de consumo.
- Mapa de investigaciones con más dimensiones de correlación (hoy: dominio,
  prefijo telefónico y patrón de fraude compartido).
- Catálogo completo de instituciones del SPEI, verificado contra la lista
  vigente de Banco de México.
- Protección contra reenvío de tokens de App Check (requiere el Admin SDK).

## Aviso

XIBALBÁ no confirma un fraude ni garantiza que algo sea seguro, no accede a
llamadas, WhatsApp ni redes sociales, y no sustituye la verificación por el
canal oficial de tu institución.
