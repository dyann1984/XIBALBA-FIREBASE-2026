# XIBALBÁ AI

Protección contra fraudes digitales con inteligencia artificial híbrida.
Proyecto independiente para **#BuildHybridAI 2026**.

> ### ▶ Pruébalo: <https://xibalba-firebase-2026.vercel.app>
>
> Sin instalar nada y sin registrarse. El recorrido de evaluación, con qué
> mirar en cada pantalla, está en **[`docs/jueces.md`](docs/jueces.md)**.
>
> La aplicación muestra «IA · SIN CONFIGURAR» a propósito: la clave de App Check
> no está cargada en el despliegue, así que la interpretación de IA no se activa
> y se dice en pantalla en lugar de disimularlo. Lo que funciona —y es la mayor
> parte— es la auditoría determinista, entera en tu dispositivo.

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
explicada en [`.env.example`](.env.example).

Verificaciones:

```bash
npm run typecheck
npm test
npm run build
```

## Demostración

La sección **Nuevo análisis** trae seis casos de demostración cargables con un
clic ([`data/demo-cases.json`](data/demo-cases.json)). Todo en ellos es
inventado: las CLABE se construyeron con su dígito verificador a partir de
dígitos de relleno, la tarjeta es el número público de prueba y los dominios
usan `example.com`, reservado para documentación. Uno de los casos es un
**control negativo**: un mensaje normal que la herramienta no pinta de rojo.

El guion de la demostración está en [`docs/guion-video.md`](docs/guion-video.md).

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
| `tests/` | 175 pruebas con `node --test` |

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
| [`docs/jueces.md`](docs/jueces.md) | Recorrido de evaluación para el jurado |
| [`docs/integracion-release-2026.md`](docs/integracion-release-2026.md) | Cómo se integraron las dos ramas de finalización |
| [`docs/auditoria-finalizacion.md`](docs/auditoria-finalizacion.md) | Matriz de funcionalidades con su estado real |
| [`docs/architecture.md`](docs/architecture.md) | Arquitectura y capas de análisis |
| [`docs/fase5-agentes.md`](docs/fase5-agentes.md) | Los cinco agentes y sus límites |
| [`docs/auditoria-fase3.md`](docs/auditoria-fase3.md) | Reglas del semáforo y clases de evidencia |
| [`docs/historial.md`](docs/historial.md) | Historial local y diseño del historial en la nube |
| [`docs/app-check.md`](docs/app-check.md) | Cómo activar la IA en el despliegue (clave de App Check) |
| [`docs/seguridad-endpoint.md`](docs/seguridad-endpoint.md) | App Check, CSRF y límites del endpoint |
| [`docs/seguridad-dependencias.md`](docs/seguridad-dependencias.md) | Avisos de dependencias y por qué se fijaron |
| [`docs/node-dependencias.md`](docs/node-dependencias.md) | Node 24, `engines` y compatibilidad de dependencias |
| [`docs/despliegue.md`](docs/despliegue.md) | Cómo desplegar (nada desplegado todavía) |
| [`docs/informe-lanzamiento.md`](docs/informe-lanzamiento.md) | Qué está comprobado y qué falta para lanzar |
| [`docs/pruebas-finalizacion.md`](docs/pruebas-finalizacion.md) | Pruebas ejecutadas y sus resultados reales |
| [`docs/pendientes-hackathon.md`](docs/pendientes-hackathon.md) | Lo que falta antes de presentar |
| [`docs/devpost.md`](docs/devpost.md) | Descripción para Devpost |

## Licencia

Código bajo licencia MIT (ver [`LICENSE`](LICENSE)). El logo
`public/xibalba-logo.jpg` es un recurso de marca proporcionado por su titular y
**no** está incluido en la licencia de código. Este código es para este concurso
y no debe reutilizarse en la presentación de Next Horizon.
