# Guion del video de presentación · 2:45

Formato: captura de pantalla de la aplicación con voz en off. Todo lo que se ve
es la aplicación real ejecutándose; los casos salen de `data/demo-cases.json` y
se cargan con un clic desde «Nuevo análisis».

**Antes de grabar:** `npm run dev`, ventana a 1440×900, menú lateral visible,
historial vacío (borra el historial si quedó de una prueba anterior).

---

## 0:00 – 0:20 · El problema

> *(Panel principal en pantalla.)*
>
> «Un mensaje dice que tu cuenta será bloqueada en dos horas. Una llamada dice
> que tienen a tu hijo y te dicta una cuenta. En México, el fraude digital no
> falla por falta de tecnología: falla porque nadie tiene treinta segundos para
> verificar.
>
> XIBALBÁ son treinta segundos.»

## 0:20 – 0:40 · Qué es

> *(Pasa el cursor por las cinco tarjetas de agentes.)*
>
> «Cinco agentes especializados. CAMAZOTZ escucha las llamadas que le cuentas.
> IXBALANQUÉ lee los mensajes. VUCUB CAMÉ revisa el dinero. HUN CAMÉ, los
> enlaces. Y EL GUARDIÁN los coordina y te da una sola respuesta.
>
> Todo el análisis determinista corre **en tu dispositivo**. La IA es un
> añadido, no el cimiento.»

## 0:40 – 1:30 · La demostración principal

> *(«Nuevo análisis» → caso «Llamada: "no cuelgue" y una cuenta dictada» →
> «Auditar solo en este dispositivo». Sin consentimiento de nube: se analiza
> localmente.)*
>
> «Esta es una llamada de secuestro virtual. Observen lo que pasa sin enviar
> nada a ningún servidor.»
>
> *(Señala el semáforo.)*
>
> «Rojo. Confianza alta. Ocho señales comprobadas de cuarenta y seis
> comprobaciones ejecutadas.
>
> Dos críticas: *exige no colgar ni avisar a nadie* y *afirma tener retenido a
> un familiar*. EL GUARDIÁN convocó solo a CAMAZOTZ, pero al encontrar una
> cuenta llamó también a VUCUB CAMÉ, y dice por qué lo hizo.»
>
> *(Baja hasta la evidencia «La cuenta no pertenece al banco que nombra el
> mensaje».)*
>
> «Y aquí está lo que ningún ojo humano alcanza en una llamada: **la voz dice
> Santander y la cuenta es de Banco Azteca**. Lo sabemos porque los tres
> primeros dígitos de una CLABE identifican a la institución, y el dígito
> verificador cuadra. La cuenta aparece enmascarada: XIBALBÁ nunca la guarda
> completa.»

## 1:30 – 2:00 · Lo que NO hace (el corazón del proyecto)

> *(Señala la limitación de esa misma evidencia, y luego «Comprobaciones
> pendientes».)*
>
> «Cada evidencia trae su limitación escrita. Esta dice: *no es prueba de
> fraude; alguien puede pedir un depósito en otro banco con toda legitimidad*.
>
> Y abajo, lo que **no** se comprobó: quién llamó, desde qué número, de quién es
> la cuenta. Por eso una llamada nunca puede dar verde.
>
> Una herramienta antifraude que exagera entrena a la gente a ignorarla.»

*(Carga el caso «Control: un mensaje normal» y analiza.)*

> «Un mensaje normal no se pinta de rojo: da **gris**, “información
> insuficiente”. Y solo da verde cuando el contenido se agota del todo y la IA
> coincide. La ausencia de señales no es prueba de seguridad.»

## 2:00 – 2:25 · Privacidad e historial

> *(Menú → Historial.)*
>
> «El historial guarda el **resultado**, no el contenido: el semáforo, las
> señales y un fragmento con todos los números enmascarados. Vive en tu
> navegador, y solo si tú lo autorizas con esta casilla.
>
> No se accede al micrófono. No se graban llamadas. No se leen tus mensajes. Lo
> que pegas, lo pegas tú.»

## 2:25 – 2:45 · Cierre técnico

> *(Panel principal, logo.)*
>
> «Next.js 15 y React 19, inferencia híbrida con Firebase AI Logic —local
> primero, nube como respaldo—, App Check verificado de verdad en el servidor
> contra el JWKS de Firebase, y ciento sesenta y seis pruebas automatizadas.
>
> XIBALBÁ no te dice que estás a salvo. Te dice qué encontró, qué no pudo
> comprobar, y te deja decidir con eso en la mano.»

---

## Notas para quien grabe

- **No digas** «detecta fraudes» ni «te protege de estafas»: la herramienta
  orienta sobre el contenido que recibe. El guion ya está redactado para no
  prometer de más; si improvisas, mantén ese tono.
- Si Firebase no está configurado, el botón dirá «Auditar solo en este
  dispositivo» y el indicador «IA · SIN CONFIGURAR». **Eso está bien para el
  video**: demuestra que el núcleo no depende de la nube. Menciónalo.
- Los tiempos suman 2:45; hay margen hasta 3:00 para pausas.
- Si el jurado pregunta por la transcripción de audio: se intenta solo con
  consentimiento propio y, si no hay motor disponible, el estado queda
  «pendiente» y **nunca se inventa texto**.
