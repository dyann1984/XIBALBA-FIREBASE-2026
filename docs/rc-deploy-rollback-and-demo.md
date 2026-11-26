# XIBALBÁ 2.0 RC — Guía de Demostración, Despliegue y Rollback

## 1. Flujo de Demostración Reproducible para Jueces (ES / EN)

1. **Portada y privacidad (`/`):** Mostrar la pantalla principal en español, cambiar a inglés (`EN`) y de vuelta a español (`ES`), destacando el botón de **Ayuda urgente** y el indicador transparente del motor de IA.
2. **Recepción de mensaje sospechoso:** Entrar a **Nuevo análisis / New analysis** y cargar el caso sintético #1 (*SMS de «tu banco» con enlace falso* / *"Your bank" SMS with fake link*, usando `example.com`).
3. **Análisis híbrido:** Ejecutar primero en modo local (100 % en dispositivo) o activar el consentimiento explícito para enviar a Firebase AI Logic (Gemini con App Check).
4. **Participación real de los cinco agentes:** Observar la **Mesa de Investigación** y el **Mundo Maya 3D** (`GodsMap3D`) donde solo se iluminan y conectan los agentes que realmente participaron (`IXBALANQUÉ`, `HUN CAMÉ`, `EL GUARDIÁN`). Hacer clic en un templo para ver enfoque automático, especialidad y duración real en ms.
5. **Evidencias y semáforo de riesgo:** Mostrar el semáforo **Rojo · no continúes**, la separación estricta entre **A. Evidencia determinista**, **B. Interpretación de IA** y **C. Comprobaciones pendientes**, y exportar el reporte en **PDF** (con `analysisId`, motor y datos enmascarados).
6. **Visualización de relaciones (`Mapa de relaciones`):** Ejecutar un segundo caso con el mismo dominio `example.com` y un mensaje legítimo de control; abrir el mapa para mostrar contadores reales, leyenda interactiva, zoom/pan y conexión solo entre casos con motivo compartido.
7. **Interacción con el Guardián:** Mostrar el **Jaguar holográfico 3D** reaccionando al estado de alerta/seguridad, activar voz/micrófono (o pregunta por texto) y recibir explicación contextual.
8. **Protección y orientación (`Escudo Global`, `SOS XIBALBÁ`, `QR Defense`, `XIBALBÁ Academy`):** Mostrar el directorio oficial por país (MX, US, ES, IN, CO, AR, CL, PE), el protocolo SOS de 8 escenarios, inspección local de QR (`jsQR`) y las 5 rutas de Academy con diploma PDF.
9. **Compatibilidad móvil:** Redimensionar a `390×844` o abrir en móvil para mostrar navegación por pestañas (`A · Evidencia`, `B · Investigación`, `C · Evaluación`) sin desbordamiento horizontal.

## 2. Procedimiento de Despliegue (solo con autorización expresa)

1. Confirmar rama y commit validado (`git status`, `git log -n 1`).
2. Ejecutar verificación bajo Node 24 (`$env:PATH = "C:\Program Files\nodejs;$env:PATH"`):
   - `npm.cmd run typecheck`
   - `npm.cmd run lint`
   - `npm.cmd test`
   - `npm.cmd audit --audit-level=moderate`
   - `npm.cmd run build`
3. Desplegar primero Preview aislado (`vercel.cmd deploy --yes`) y validar estado `READY` y rutas `/`, `/manifest.webmanifest`, `/sw.js`.
4. Solo tras aprobación explícita del responsable: ejecutar `vercel.cmd deploy --prod` y verificar `https://xibalba-firebase-2026.vercel.app` en sesión sin autenticación.

## 3. Procedimiento de Rollback en Producción

- **Despliegue de Producción estable actual (referencia de reversión):** `dpl_DPhRM4ZpRTAySg2SzfFHbE5Dzcio` (`https://xibalba-firebase-2026.vercel.app`, rama `release/xibalba-2.0`, commit `c0861ef`).
- **Rollback inmediato vía Vercel CLI:**
  ```powershell
  vercel.cmd rollback dpl_DPhRM4ZpRTAySg2SzfFHbE5Dzcio --yes
  ```
- **Verificación post-rollback:** Confirmar estado `READY` en `vercel.cmd ls` y respuesta `HTTP 200` en `https://xibalba-firebase-2026.vercel.app`.
