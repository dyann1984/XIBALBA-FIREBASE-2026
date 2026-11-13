# XIBALBÁ AI

Prototipo independiente para #BuildHybridAI 2026. Interfaz y conexión preparada para Firebase AI Logic. El análisis requiere configuración y verificación real.

## Inicio

Requisitos: Node.js 24.12 o superior. Ejecuta `npm install`, `npm run dev` y abre http://localhost:3000. Verificaciones: `npm run typecheck`, `npm run build` y `npm test`.

## Estructura

- `app/`: rutas, metadatos y estilos responsivos.
- `components/`: interfaz y navegación del prototipo.
- `lib/agents.ts`: catálogo tipado de agentes y sus responsabilidades.
- `public/xibalba-logo.jpg`: logo original proporcionado por el usuario, sin modificar.
- `docs/architecture.md`: límites de la fase y trabajo futuro.

No uses datos personales reales en pruebas. No subas credenciales ni archivos `.env` al repositorio. El código es para este concurso y no debe reutilizarse en la presentación de Next Horizon.

Código bajo licencia MIT; el logo es un recurso de marca proporcionado por su titular y no está incluido en la licencia de código.

## Integración preparada

Consulta [docs/firebase.md](docs/firebase.md) para Firebase AI Logic, App Check, consentimiento y las reglas restrictivas de Firestore. La conexión requiere configuración y validación reales. No hay historial persistente. Se necesita Node 24.12 o superior para el SDK actual.

