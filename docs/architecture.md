# Arquitectura y fases

La aplicación Next.js incluye una integración cliente preparada para inferencia híbrida. Los cinco agentes están implementados y coordinados por `lib/analysis/coordinator.ts`; la interpretación de IA requiere configuración de Firebase y validación real, mientras que la auditoría determinista se ejecuta siempre en el dispositivo. El contenido analizado vive en el estado de la página y solo se envía a la nube con consentimiento. Del resultado se guarda un resumen en el historial local (`lib/history.ts`), nunca el contenido; no se abre ningún enlace introducido.

## Estado de los cinco agentes

| Agente | Ámbito | Estado real |
| --- | --- | --- |
| CAMAZOTZ | Llamadas y transcripciones | **Operativo sobre texto, parcial con audio.** 14 señales propias de llamada y auditoría del archivo adjunto. No abre el micrófono, no graba y la transcripción automática depende del modelo y del consentimiento: sin motor, el estado queda pendiente y no se inventa texto. |
| IXBALANQUÉ | Mensajes y empleos | **Operativo.** Auditoría determinista de texto (16 patrones) más interpretación de IA con consentimiento. |
| VUCUB CAMÉ | Fraude financiero | **Operativo.** Catálogo financiero propio, dígito verificador de CLABE, Luhn, forma de monederos, institución emisora según el código de la CLABE y aviso cuando la cuenta no pertenece al banco que nombra el mensaje. |
| HUN CAMÉ | URLs, tiendas y phishing | **Operativo.** Auditoría determinista de URL (18 comprobaciones locales) más interpretación de IA. Sin comprobaciones de red. |
| EL GUARDIÁN | Coordinación y explicación | **Operativo.** Elige los agentes según el contenido, fusiona su evidencia sin duplicarla, emite un solo semáforo y responde preguntas de seguimiento (`lib/analysis/coordinator.ts`). |

La interfaz no presenta como funcional ningún agente sin implementación real: la ficha de los agentes descriptivos indica que su integración está prevista para una etapa posterior.

## Capas de análisis

Catálogos (`patterns.ts` contenido, `voice.ts` llamadas, `finance-patterns.ts` dinero, `clabe-institutions.ts` instituciones) → `lib/analysis/audit.ts` (motor determinista de URL, mensaje, transcripción, financiero, audio e imagen) → `lib/analysis/coordinator.ts` (selección de agentes, fusión sin duplicados y cobertura contada una sola vez) → `lib/analysis/risk.ts` (veredicto local, combinación con IA y semáforo) → `lib/analysis/analyze.ts` (orquestación; la ruta local no depende del modelo ni de la red) → interfaz (`RiskVerdict`, `EvidenceList`, `ImageAttachments`, `AudioAttachment`, `Guardian`) → `lib/history.ts` (resumen del resultado, nunca el contenido).

Los detalles de cobertura, límites y reglas del semáforo están en `docs/auditoria-fase3.md`; el estado de cada funcionalidad, en `docs/auditoria-finalizacion.md`.

## Pendientes

1. Clave de sitio de App Check y dominio de producción registrado en reCAPTCHA Enterprise: sin eso, la interpretación de IA no se habilita y el endpoint externo devuelve 401. Ver `docs/despliegue.md`.
2. Historial por usuario en la nube con Firebase Authentication: diseño, modelo de datos y reglas propuestas en `docs/historial.md`. Hasta entonces, `firestore.rules` deniega todo, que es lo correcto porque ningún código escribe en Firestore.
3. Habilitar DNS y RDAP para el público general (hoy tras `XIBALBA_EXTERNAL_AUDITS`), decidir límites de consumo y resolver el límite de solicitudes distribuido.
4. Internacionalización real en español e inglés, CSP con nonce y catálogo completo de instituciones del SPEI. La lista viva está en `docs/pendientes-hackathon.md`.

No hay acceso a llamadas, WhatsApp ni Facebook. Cualquier integración futura requiere autorización y API apropiada. No incluir secretos en el cliente o Git; la configuración pública de Firebase no sustituye reglas de seguridad ni App Check. El indicador muestra la ruta de ejecución comunicada por el SDK tras una respuesta real.

