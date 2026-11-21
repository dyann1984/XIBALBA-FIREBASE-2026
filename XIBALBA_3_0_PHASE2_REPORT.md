# XIBALBÁ 3.0 — Fase 2

## Estado: NO-GO para producción

Se amplió la instrumentación local, pero no se ha demostrado OCR compatible de producción, inferencia multimodal con un proveedor real, ejecución paralela, visualización en vivo durante el trabajo síncrono ni un personaje 3D profesional. No se hizo merge, push ni despliegue.

## Agentes y ejecución real

- CAMAZOTZ: reglas locales de voz y metadatos de audio; la transcripción usa el modelo solo con consentimiento específico.
- IXBALANQUÉ: catálogo determinista de mensajes y análisis telefónico local.
- VUCUB CAMÉ: reglas financieras, aritmética y metadatos de imágenes.
- HUN CAMÉ: reglas locales sobre URL; las consultas externas no forman parte del flujo general.
- EL GUARDIÁN: selección, fusión y explicación del riesgo. La interpretación opcional de Firebase AI es una llamada compartida, no cinco agentes generativos independientes.

El coordinador emite inicios y finales medidos con reloj monotónico, número de indicadores y errores por tarea; los eventos no contienen entrada ni excepciones internas. La interfaz muestra cinco especialidades, estado y cronología, además de evidencias atribuidas y el resultado combinado. El tiempo del coordinador incluye los catálogos y no debe sumarse a sus tiempos. La ejecución sigue siendo secuencial en el hilo principal: React puede mostrar los eventos solo después de terminar la sección síncrona. La comprobación telefónica tiene su propio evento. La selección y fusión dependen de los resultados de los catálogos; no hay colaboración autónoma ni paralelismo.

## Imágenes

Se conserva TextDetector local cuando existe. Si no devuelve texto y existe consentimiento y configuración, se intenta una transcripción mediante el modelo multimodal de Firebase. El modelo puede omitir o inventar texto; se muestra su procedencia como IA, se exige cotejo con la imagen y se reduce la confianza. Las reglas reconocen patrones en la transcripción recibida; esto no demuestra que los caracteres estén presentes en la imagen. La lectura está limitada a 6000 caracteres combinados y la UI muestra el fragmento utilizado. Sin lectura se indica incertidumbre. En modo URL no se ejecuta OCR.

Se intentó instalar Tesseract.js como alternativa local, pero la instalación no terminó en este entorno; no se incluyó ni se considera validada. Se requieren distribución local del worker, WASM y modelos de idioma, evaluación de licencias, CSP, tamaño, privacidad y pruebas reales. El respaldo de modelo requiere configuración, conectividad y consentimiento; no equivale a OCR local universal y no ha sido validado con un proveedor real en esta fase.

## Command Center y jaguar

El centro muestra estado de investigación, número de casos del historial y último resultado basados en datos locales. La mesa integra eventos reales y evidencia; el historial, las correlaciones y los reportes son los existentes. No hay una visualización nueva de grafo de incidentes. El jaguar existente es SVG 2.5D, no 3D; se evita el seguimiento de puntero cuando no es visible o se solicita movimiento reducido. Mantiene sus estados asociados al procesamiento y resultado reales.

Plan para 3D: diseñar y licenciar un modelo GLB original con anatomía y materiales PBR, rig facial y animaciones; validar presupuesto de polígonos y texturas en móviles; cargarlo bajo demanda con Three.js, pausa fuera de vista, fallback SVG para WebGL no disponible y movimiento reducido. Conectar estados a eventos comprobados, probar memoria, FPS, accesibilidad y recuperación de contexto antes de sustituir el SVG. No hay un recurso 3D profesional validado en el repositorio.

## Validación

La suite de Node pasó 202 pruebas, incluidas dos nuevas sobre eventos y aislamiento del observador. Se preparó Playwright para centro, mesa, jaguar, móvil y tres imágenes sintéticas, pero las imágenes sencillas generadas por canvas no sustituyen un corpus realista de SMS, WhatsApp y correo. La prueba debe confirmar el texto reconocido, indicadores y riesgos cuando un motor real esté disponible. Los resultados de ejecución y capturas se anotan al terminar las pruebas de navegador. No se han probado credenciales ni servicios de producción.

### Ejecución de navegador

Playwright con Chrome instalado y compilación local aislada: 4/4 pruebas pasaron. Se generaron capturas en `artifacts/xibalba-3-phase2/`: `command-center.png`, `mesa-y-evidencias.png`, `jaguar.png`, `analisis-movil.png`, `sms.png`, `whatsapp.png` y `correo.png`. La captura SMS muestra «lectura incompleta» y veredicto gris: en esta ejecución no se obtuvo texto por OCR y el modelo no estaba configurado. Por tanto estas pruebas verifican el manejo de ausencia de OCR, no la precisión de reconocimiento ni las señales derivadas de una captura. No existe captura de agentes ejecutándose simultáneamente: el trabajo es síncrono y secuencial; la captura de mesa muestra eventos terminados. Las capturas de página completa pueden superponer barras fijas por el método de captura.

La compilación aislada terminó con éxito. TypeScript y ESLint pasaron. La primera compilación compartida falló al recopilar páginas con un error de `/_not-found`; la compilación aislada posterior sí terminó. La primera ejecución Playwright carecía del navegador empaquetado; con Chrome instalado y servidor aislado se pudo ejecutar.

Nota de comprobación: ESLint pasó en una ejecución anterior de la fase. La última repetición completa se interrumpió tras quedar ejecutándose sin resultado; no se cuenta como una validación final adicional.
