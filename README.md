# XIBALBÁ AI

Protección contra fraudes digitales con inteligencia artificial híbrida.
Proyecto independiente para **#BuildHybridAI 2026**.

> ### ▶ Pruébalo: <https://xibalba-firebase-2026.vercel.app>
>
> Sin instalar nada y sin registrarse. El recorrido de evaluación, con qué
> mirar en cada pantalla, está en **[`docs/jueces.md`](docs/jueces.md)**; el
> material completo para jueces (guion de 3 min ES/EN, arquitectura, Q&A y
> limitaciones) está en
> **[`docs/material-jueces-final.md`](docs/material-jueces-final.md)**.
>
> La auditoría determinista se ejecuta siempre en el dispositivo. En este
> despliegue, App Check y Firebase AI Logic ya están configurados: con tu
> consentimiento explícito, la interpretación de IA (Gemini) también se activa
> — nunca puede rebajar un veredicto que el motor determinista ya calificó de
> riesgo alto.

XIBALBÁ analiza un mensaje, un enlace, una transcripción de llamada o una
solicitud de dinero y responde con un semáforo, la evidencia que lo sostiene y
lo que **no** pudo comprobar. La auditoría determinista se ejecuta siempre en el
dispositivo; la interpretación de IA es un añadido opcional que solo puede
elevar el riesgo, nunca rebajarlo.

> **Lo que esta herramienta no hace.** No intercepta llamadas, no abre el
> micrófono, no lee WhatsApp ni redes sociales, no visita los enlaces que le
> pegas y no confirma un fraude. Orienta con evidencia; la verificación por el
> canal oficial sigue siendo tuya.

## Inicio rápido

Requisitos: **Node.js 24.12 o superior** (lo exige `@firebase/ai@3.1.0`) y npm.

```bash
npm install
cp .env.example .env.local   # Windows: copy .env.example .env.local
npm run dev
```

Abre <http://localhost:3000>. **La aplicación funciona sin configurar Firebase**:
sin claves se ejecuta la auditoría local completa y la interfaz lo dice
(«IA · SIN CONFIGURAR»). Para habilitar la interpretación de IA, rellena
`.env.local` con los datos de tu proyecto de Firebase; cada variable está
explicada en [`.env.example`](.env.example). El despliegue público de
producción ya tiene esas variables configuradas (ver
[`docs/app-check.md`](docs/app-check.md)).

Verificaciones:

```bash
npm run typecheck
npm test
npm run build
```

## Demostración

La sección **Nuevo análisis** trae ocho casos de demostración bilingües
cargables con un clic ([`data/demo-cases.json`](data/demo-cases.json)). Todo en
ellos es inventado: las CLABE se construyeron con su dígito verificador a
partir de dígitos de relleno, la tarjeta es el número público de prueba y los
dominios usan `example.com`, reservado para documentación. Uno de los casos es
un **control negativo**: un mensaje normal que la herramienta no pinta de rojo.

El guion de demostración de 3 minutos (ES/EN) para jueces está en
[`docs/material-jueces-final.md`](docs/material-jueces-final.md) y
[`docs/demo-3min-jueces.md`](docs/demo-3min-jueces.md).

## Qué hay dentro

| Carpeta | Contenido |
|---|---|
| `app/` | Rutas de Next.js, estilos y el endpoint de auditoría externa |
| `components/` | Interfaz, Guardián 3D (Three.js), listas de evidencia |
| `lib/analysis/` | Motor determinista: patrones, voz, finanzas, riesgo y coordinación |
| `lib/external/` | DNS sobre HTTPS, RDAP y WHOIS `.mx` (deshabilitados por defecto) |
| `lib/security/` | Verificación real de los tokens de Firebase App Check |
| `lib/history.ts` | Historial local: guarda el resultado, nunca el contenido |
| `data/` | Catálogo RDAP y casos de demostración |
| `tests/` | 240 pruebas con `node --test` + batería E2E con Playwright |

Los cinco agentes —CAMAZOTZ (llamadas), IXBALANQUÉ (mensajes), VUCUB CAMÉ
(dinero), HUN CAMÉ (enlaces) y EL GUARDIÁN (coordinación)— están descritos con
lo que hacen hoy y lo que no en [`lib/agents.ts`](lib/agents.ts) y en
[`docs/fase5-agentes.md`](docs/fase5-agentes.md).

## Privacidad

- El contenido analizado **no se envía a ningún servidor** sin tu consentimiento
  explícito, y el consentimiento del audio es independiente del texto.
- El historial guarda el **resultado**, no el contenido: semáforo, nivel,
  confianza, cobertura y un fragmento corto con todo número de cuatro o más
  dígitos enmascarado. Vive en tu navegador y solo si lo autorizas
  ([`docs/historial.md`](docs/historial.md)).
- Las CLABE y las tarjetas aparecen siempre enmascaradas, incluso en el
  fragmento citado de una evidencia.
- Las reglas de Firestore deniegan todo acceso, porque ningún código escribe en
  Firestore.

No uses datos personales reales en las pruebas. No subas `.env.local` ni ninguna
credencial al repositorio.

## Documentación

| Documento | De qué trata |
|---|---|
| [`XIBALBA_2_0_INFORME_CONSOLIDADO_FINAL.md`](XIBALBA_2_0_INFORME_CONSOLIDADO_FINAL.md) | Estado real más reciente: PASS/FAIL/BLOCKED/NOT TESTED por área |
| [`docs/jueces.md`](docs/jueces.md) | Recorrido de evaluación autoguiado para el jurado |
| [`docs/material-jueces-final.md`](docs/material-jueces-final.md) | Guion 3 min ES/EN, arquitectura, agentes, diferenciadores, Q&A y limitaciones |
| [`docs/demo-3min-jueces.md`](docs/demo-3min-jueces.md) | Guion minuto a minuto en español |
| [`docs/rc-deploy-rollback-and-demo.md`](docs/rc-deploy-rollback-and-demo.md) | Flujo de demo, despliegue y procedimiento de rollback |
| [`docs/pruebas-hardware-fisico.md`](docs/pruebas-hardware-fisico.md) | Guía de ~10 min para validar micrófono, cámara, PWA y offline en hardware real |
| [`docs/architecture.md`](docs/architecture.md) | Arquitectura y capas de análisis |
| [`docs/fase5-agentes.md`](docs/fase5-agentes.md) | Los cinco agentes y sus límites |
| [`docs/auditoria-fase3.md`](docs/auditoria-fase3.md) | Reglas del semáforo y clases de evidencia |
| [`docs/historial.md`](docs/historial.md) | Historial local (borrado individual y completo) y diseño del historial en la nube |
| [`docs/app-check.md`](docs/app-check.md) | Cómo activar la IA en el despliegue (clave de App Check) |
| [`docs/seguridad-endpoint.md`](docs/seguridad-endpoint.md) | App Check, CSRF y límites del endpoint |
| [`docs/seguridad-dependencias.md`](docs/seguridad-dependencias.md) | Avisos de dependencias y por qué se fijaron |
| [`docs/node-dependencias.md`](docs/node-dependencias.md) | Node 24, `engines` y compatibilidad de dependencias |
| [`docs/despliegue.md`](docs/despliegue.md) | Procedimiento de despliegue a Preview y producción |
| [`docs/devpost.md`](docs/devpost.md) | Descripción para Devpost |

## Licencia

Código bajo licencia MIT (ver [`LICENSE`](LICENSE)). El logo
`public/xibalba-logo.jpg` es un recurso de marca proporcionado por su titular y
**no** está incluido en la licencia de código. Este código es para este concurso
y no debe reutilizarse en la presentación de Next Horizon.
