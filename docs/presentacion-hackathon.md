# Presentación de hackathon · guía de 2 a 3 minutos

Complementa a [`guion-video.md`](guion-video.md) (el guion minuto a minuto para
grabar el video) y a [`jueces.md`](jueces.md) (la guía de evaluación). Este
documento organiza los mismos hechos ya verificados en el proyecto alrededor
de los siete puntos que suele pedir un jurado de hackathon, para usarlos en
diapositivas o en la presentación en vivo. No introduce ninguna capacidad ni
métrica que no esté ya comprobada en el código o en las pruebas de esta
sesión — cada cifra lleva dónde se verificó.

## 1. El problema

El fraude digital no gana por sofisticación técnica, gana por tiempo: "tu
cuenta será bloqueada en dos horas", "tenemos a tu hijo, no cuelgues". La
víctima no necesita un informe de seguridad, necesita treinta segundos y una
razón concreta para detenerse antes de actuar.

## 2. Diferenciación tecnológica

- **Evidencia separada por origen**, no un veredicto opaco: comprobado en el
  dispositivo, verificado contra un registro público, estimado por IA, o
  pendiente de comprobar — y la IA **nunca puede bajar** un veredicto que la
  evidencia determinista ya puso en rojo (`lib/analysis/risk.ts`, probado en
  vivo contra Gemini real en esta sesión: ver §4).
- **Un cuarto color honesto**: gris, "información insuficiente", cuando no
  hay señales ni interpretación de IA. La ausencia de señales no se disfraza
  de seguridad.
- **Cada evidencia trae su propia limitación escrita junto a ella**: lo que
  esa señal específica no puede demostrar, no una nota legal genérica al
  final.

## 3. Arquitectura Firebase

- **Firebase AI Logic**, modo `PREFER_ON_DEVICE`: intenta primero el modelo
  del propio navegador y usa Gemini en la nube solo si no está disponible; la
  interfaz muestra cuál de los dos respondió realmente (`lib/firebase.ts`).
- **App Check verificado de verdad en el servidor** (`app/api/audit/external`):
  firma RS256 contra el JWKS público de Firebase, emisor, audiencia y
  caducidad — nunca un token sin verificar.
- El SDK de Firebase **ya no viaja en el paquete inicial de la portada**:
  se carga con `import()` dinámico solo cuando hace falta (montaje del
  indicador de estado, o el primer análisis con consentimiento). Medido esta
  sesión con una build de producción real: 412 kB → 261 kB de "First Load JS"
  en la portada (-37 %).
- Firestore está inicializado pero **nada lo usa todavía**: las reglas niegan
  todo acceso a propósito, porque el historial por usuario en la nube depende
  de Firebase Authentication, que aún no existe (`docs/app-check.md`,
  `docs/historial.md`).

## 4. Inteligencia artificial multiagente

Cinco agentes con nombres del *Popol Vuh*, coordinados por EL GUARDIÁN según
lo que de verdad encuentra en el contenido (no solo por el tipo que elegiste):
CAMAZOTZ (voz y llamadas), IXBALANQUÉ (mensajes), VUCUB CAMÉ (dinero), HUN
CAMÉ (enlaces). El tablero de operaciones (`AgentOperationsBoard.tsx`) solo
dibuja una línea hacia un agente que de verdad participó — nunca una red
decorativa fija.

**Verificado en esta sesión contra servicios reales**, no simulados: con el
token de depuración de App Check y una llamada real a Gemini vía Firebase AI
Logic, un mensaje con evidencia determinista crítica se mantuvo en rojo
después de la respuesta real del modelo (`tests/e2e/cloud-ai.spec.ts`).

## 5. Ejemplo funcional de detección

Caso de demostración "Llamada: «no cuelgue» y una cuenta dictada": la persona
que llama dice *Santander*, pero la CLABE que dicta pertenece a otra
institución — calculado en el dispositivo con el dígito verificador de la
CLABE, sin consultar a nadie. XIBALBÁ marca la evidencia como sospechosa de
severidad alta **y al mismo tiempo escribe su límite**: no es prueba de
fraude, porque alguien puede pedir legítimamente un depósito en otro banco.
Paso a paso en [`jueces.md`](jueces.md#1-recorrido-de-dos-minutos).

## 6. Funcionamiento en móviles

- Responsive verificado sin desbordamiento horizontal en 320, 360, 375, 390,
  430, 768, 1024 y 1440 px esta sesión (capturas reales en
  `artifacts/xibalba-2.0/` y `artifacts/xibalba-3-phase5.3/`).
- PWA instalable: iconos reales (192/512, `any` y `maskable`) y un *service
  worker* que cachea solo el cascarón estático, nunca `/api/*` — confirmado
  activo en el navegador esta sesión.
- Cámara (captura en vivo y archivo), selección de imágenes JPEG/PNG/WebP, y
  dictado por voz con permiso explícito y corte automático a los 15 segundos,
  probados con emulación de Android (Chrome, user-agent y 5 puntos táctiles
  reales) en esta sesión.
- **Límite real, no ocultado**: esta máquina solo pudo emular un navegador
  Android; una verificación en un iPhone físico (Safari, sin
  `SpeechRecognition`, instalación por la hoja de compartir en vez de un
  `beforeinstallprompt`) queda pendiente de un dispositivo real.

## 7. Impacto social

XIBALBÁ no promete detectar fraudes: le da a alguien sin formación en
ciberseguridad, en los treinta segundos en que alguien le exige una decisión
urgente, una lista concreta de qué sí se comprobó, qué no, y por qué. Elegir
decir "información insuficiente" en vez de un falso "seguro" es la apuesta de
producto completa — una herramienta que exagera entrena a la gente a
ignorarla, y una que nunca dice nada útil entrena a la gente a cerrarla. Todo
el análisis base corre en el dispositivo de la persona, sin cuenta ni
conexión, lo que importa para quien no tiene datos móviles de sobra o no
quiere compartir el contenido de un mensaje con nadie más.

## Cifras de esta sesión, para no repetir de memoria

| Cifra | Dónde se verificó |
|---|---|
| 226 pruebas automatizadas (204 unitarias + 22 E2E) | `npm test`, `npx playwright test` |
| 0 violaciones de axe-core (WCAG 2.0/2.1 A y AA) | `tests/e2e/a11y.spec.ts` |
| First Load JS de la portada: 412 kB → 261 kB | `npm run build`, antes/después del `import()` dinámico de Firebase |
| 1 prueba real contra Firebase/Gemini, no simulada | `tests/e2e/cloud-ai.spec.ts` |
| Lighthouse: accesibilidad 100, buenas prácticas 100, SEO 100 | Ejecutado esta sesión contra una build de producción real; la puntuación de *performance* no se reporta como confiable por contención de CPU de otros procesos en la misma máquina (ver el commit de rendimiento) |
