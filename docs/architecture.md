# Arquitectura y fases

La aplicación Next.js incluye una integración cliente preparada para inferencia híbrida. IXBALANQUÉ y HUN CAMÉ requieren configuración de Firebase y validación real; los demás agentes son descriptivos. El campo de análisis vive en el estado de la página y puede enviarse a la nube con consentimiento. No hay persistencia ni apertura de enlaces introducidos.

## Estado de los cinco agentes

| Agente | Ámbito | Estado real |
| --- | --- | --- |
| CAMAZOTZ | Llamadas y transcripciones | **Solo descriptivo.** No hay captación de audio ni transcripción. Una transcripción pegada a mano se analiza como mensaje. |
| IXBALANQUÉ | Mensajes y empleos | **Operativo.** Auditoría determinista de texto (16 patrones) más interpretación de IA con consentimiento. |
| VUCUB CAMÉ | Fraude financiero | **Parcial, sin agente propio.** Los patrones financieros (cobro anticipado, datos bancarios, medio de pago irreversible, inversión garantizada) ya se detectan dentro del motor de mensajes. |
| HUN CAMÉ | URLs, tiendas y phishing | **Operativo.** Auditoría determinista de URL (18 comprobaciones locales) más interpretación de IA. Sin comprobaciones de red. |
| EL GUARDIÁN | Coordinación y explicación | **Operativo con límites.** Combina evidencia local e IA en el semáforo, explica con voz y responde preguntas. No orquesta a los demás agentes. |

La interfaz no presenta como funcional ningún agente sin implementación real: la ficha de los agentes descriptivos indica que su integración está prevista para una etapa posterior.

## Capas de análisis

`lib/analysis/patterns.ts` (catálogo de señales de contenido) → `lib/analysis/audit.ts` (motor determinista de URL, mensaje e imagen) → `lib/analysis/risk.ts` (veredicto local, combinación con IA y semáforo) → `lib/analysis/analyze.ts` (orquestación; la ruta local no depende del modelo ni de la red) → interfaz (`RiskVerdict`, `EvidenceList`, `ImageAttachments`, `Guardian`).

Los detalles de cobertura, límites y reglas del semáforo están en `docs/auditoria-fase3.md`.

## Pendientes

1. Configurar un proyecto Firebase independiente, App Check y Firebase AI Logic. Verificar compatibilidad y disponibilidad real de Gemini Nano 4 y los mecanismos de inferencia local antes de elegir el modelo; implementar respaldo en nube solo cuando esté configurado y con transparencia para el usuario.
2. Definir contratos tipados y validación de entrada/salida para el análisis, evidencias y riesgos. Los resultados deben indicar incertidumbre y no garantizar seguridad.
3. Implementar la coordinación y los cinco agentes, minimización de datos, controles de acceso y reglas de seguridad de Firestore; diseñar consentimiento, retención y eliminación del historial.
4. Preparar internacionalización real en español e inglés, accesibilidad, pruebas automatizadas, evaluación de seguridad y despliegue Vercel.

No hay acceso a llamadas, WhatsApp ni Facebook. Cualquier integración futura requiere autorización y API apropiada. No incluir secretos en el cliente o Git; la configuración pública de Firebase no sustituye reglas de seguridad ni App Check. El indicador muestra la ruta de ejecución comunicada por el SDK tras una respuesta real.

