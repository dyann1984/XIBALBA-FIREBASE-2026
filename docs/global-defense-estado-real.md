# XIBALBÁ Global Defense 4.0 — Estado real por fase

Fecha: 19 de noviembre de 2026. Rama: `xibalba-global-defense`. Commits de
esta sesión (de más antiguo a más reciente): `395dae3`, `4843df1`, `24f8a92`,
`abe90c5`, `e7bb1be`, `d02069c`. No se hizo push, merge a producción ni
despliegue.

**Honestidad sobre el alcance.** La orden pedía implementar íntegramente 12
fases que incluyen, entre otras cosas, un modelo 3D riggeado del Guardián,
una red holográfica 3D interactiva y un rediseño visual total de 10
pantallas. Eso es, objetivamente, un proyecto de varias semanas con un
equipo de diseño, no algo que se pueda construir de verdad — sin fingirlo —
en una sesión. Lo que sigue es el estado **real**, fase por fase, sin marcar
nada como terminado que no lo esté.

## Tabla de las 12 fases

| Fase | Estado | Por qué |
|---|---|---|
| 1. Rediseño Obsidian Intelligence | **PARCIAL** | La dirección de arte (obsidiana, turquesa, oro maya, rojo reservado) ya existía y se mantiene; 2 pantallas nuevas (Escudo Global, botón de ayuda) se construyeron con ese mismo sistema. Las otras 8 pantallas de la lista obligatoria no se rediseñaron de raíz esta sesión — replantear "composición, navegación, jerarquía" de 8 pantallas existentes sin una revisión visual humana es justo el riesgo que la Fase 5.4 anterior ya decidió no correr sin confirmación. |
| 2. Guardián Jaguar animado | **PARCIAL** (sin cambios esta sesión) | Ya tiene respiración, parpadeo, mirada reactiva, mandíbula sincronizada con el habla, viñeta de color por estado — verificado de nuevo esta sesión en las capturas (`03-impacto-potencial.png`, `04-boton-ayuda-permanente.png`). Sigue siendo una ilustración 2.5D con capas CSS, **no un rig 3D**: no existe ningún GLB en el repositorio y no se afirma lo contrario en ningún lugar (`docs/guardian-visual.md`). Un rig 3D real necesita un modelador, no solo código. |
| 3. Cinco agentes operativos | **VERIFICADO** (sin cambios esta sesión) | `AgentOperationsBoard.tsx` sigue dibujando solo conexiones reales (`tests/e2e/xibalba.spec.ts` prueba 10); visible en `03-impacto-potencial.png` (solo IXBALANQUÉ y EL GUARDIÁN activos para un mensaje de phishing). Los 5 agentes conservan sus nombres e identidades originales. |
| 4. Motor de investigación profunda | **PARCIAL** | Etapas A-D ya existían (OCR nativo + Tesseract, catálogo de patrones, DNS/RDAP opcionales). Etapa E (evaluación) ganó esta sesión una dimensión real nueva: **impacto potencial**, independiente de riesgo y confianza, derivada solo de categorías de evidencia ya verificada (`lib/analysis/risk.ts::potentialImpactOf`). No se tocó la adquisición de evidencia ni el OCR: seguían funcionando según la auditoría de la Fase 5.3. |
| 5. Protección internacional | **PARCIAL** | Directorio real con 5 países: México, EE. UU. y Reino Unido **verificados** (2+ fuentes de dominios distintos cada uno); Canadá y España **en revisión** a propósito (datos reales pero sin segunda fuente *oficial*); cualquier otro país (ej. Brasil) se muestra como **pendiente**, nunca inventado — probado en `tests/e2e/global-shield.spec.ts` prueba 16. El mensaje de ayuda dice explícitamente que no es un servicio de emergencia y que el número real depende del país, nunca asume 911. Cobertura real: 5 de ~195 países. |
| 6. Centro mundial de auxilio | **PARCIAL** | El botón "Ayuda urgente" es permanente y real (visible en toda la app, probado en `global-shield.spec.ts`). Implementa el modo A (protección inmediata: aviso + acceso al directorio). El modo B (procedimientos específicos por tipo de incidente: fraude bancario, robo de cuenta, extorsión, fraude laboral, suplantación) **no se construyó** esta sesión — es contenido real que requiere redactarse con el mismo cuidado que el resto de la app, no placeholder. |
| 7. Mapa holográfico forense | **PENDIENTE** | El mapa real por evidencia (`InvestigationMap.tsx`) sigue intacto y sigue sin inventar conexiones. **No se construyó una versión 3D/holográfica** esta sesión: hacerlo bien (perspectiva, zoom, rotación, sin inventar una "red global de amenazas en vivo") es un proyecto de UI en sí mismo que merece su propia sesión de diseño, no una improvisación. |
| 8. Expediente vivo y denuncias | **PARCIAL** (sin cambios esta sesión) | La exportación a Markdown y JSON ya existe (`lib/analysis/report.ts`, botones reales en el laboratorio). **No existe** exportación a PDF ni un asistente de borrador de denuncia adaptado por país — ninguno de los dos se construyó esta sesión. |
| 9. Firebase, Gemini y persistencia | **VERIFICADO** | Diagnóstico granular nuevo y real: `lib/firebase.ts::diagnoseFirebaseStack()` separa las 6 etapas que pedía el encargo (SDK disponible, servicio configurado, autenticación exitosa, llamada real ejecutada, respuesta real obtenida, persistencia confirmada), verificado en el navegador con una llamada real a Gemini (`in_cloud`, respuesta real). "Persistencia" queda honestamente en "no aplica": ningún código del proyecto usa Firestore todavía. Se encontró y corrigió, además, un bug real de caché del service worker que servía código viejo en `next dev`. |
| 10. Idiomas y dispositivos | **PARCIAL** (sin cambios esta sesión) | Español e inglés siguen completos (los tipos de TypeScript lo exigen). El directorio internacional ya es independiente del idioma de la interfaz (`HelpChannel.languages`). No se agregó ningún idioma nuevo ni se tocó la adaptación de fechas/números por jurisdicción más allá de lo que ya hacía `describeWhen(locale)`. |
| 11. Pruebas de protección real | **PARCIAL** | De los 20 escenarios pedidos, esta sesión agregó 5 reales y verificados (13 a 16: usuarios de México/EE. UU./España/país sin directorio, más el botón de ayuda). Los escenarios ya cubiertos en fases anteriores (phishing bancario, inversión fraudulenta, imagen ilegible, cambio de idioma, Guardián reaccionando, exportación, móvil) se reconfirmaron al correr la batería completa. Extorsión telefónica, oferta laboral (legítima vs. sospechosa) específicas y transferencia fraudulenta ya tenían casos de demostración pero no una prueba E2E dedicada nueva esta sesión. |
| 12. Demostración internacional | **PENDIENTE** | No se escribió un guion de demostración nuevo que recorra explícitamente "selecciona tu país → sube una captura → el Guardián explica → se abre la red holográfica" — ese último paso en particular depende de la Fase 7, que no existe todavía. |

## Archivos modificados o creados en esta sesión

**Nuevos:**
- `lib/global-shield/types.ts`, `lib/global-shield/directory.ts`
- `components/GlobalShield.tsx`, `components/HelpButton.tsx`
- `docs/propuesta-global-defense.md`, `docs/global-defense-estado-real.md` (este documento)
- `tests/global-shield.test.mjs`, `tests/e2e/global-shield.spec.ts`, `tests/e2e/capturas-global-defense.spec.ts`
- `artifacts/xibalba-global-defense/` (4 capturas reales)

**Modificados:**
- `lib/analysis/risk.ts` (impacto potencial)
- `lib/firebase.ts` (diagnóstico granular de 6 etapas)
- `app/diagnostico-app-check/page.tsx` (UI del diagnóstico)
- `components/Dashboard.tsx`, `components/RiskVerdict.tsx`
- `lib/i18n/dictionary.ts` (es/en completos, exigido por tipos)
- `public/sw.js` (corrección del bug de caché en dev)
- `app/globals.css`
- `tests/phase3.test.mjs`

## Resultados de pruebas (ejecutadas en esta sesión, reales)

| Comprobación | Resultado |
|---|---|
| `tsc --noEmit` | 0 errores |
| `eslint .` | 0 problemas |
| `node --test` (unitarias) | **211 / 211** |
| `next build` | Compiló limpio |
| Playwright, batería principal | **27 / 27** (2 omitidos correctamente: dependen de servicios en la nube) |
| Playwright, batería de nube (Firebase + Gemini reales) | **2 / 2** |
| **Total** | **240 / 240** |

Distinción de qué depende de qué:
- **Servicios reales**: `tests/e2e/cloud-ai.spec.ts` (token real de App Check, llamada real a Gemini). Requiere red; se omite solo, nunca falla en silencio, si no responde a tiempo.
- **Mocks**: ninguno. La batería principal usa el motor determinista real (sin red) a propósito, no una respuesta fabricada.
- **Requieren dispositivo físico**: verificación en un iPhone real (Safari, sin `SpeechRecognition`) — esta sesión solo puede emular Android Chrome.

## Diagnóstico de Firebase (real, de esta sesión)

Ejecutado en `/diagnostico-app-check` contra el proyecto real `xibalba-ai-2026`:

1. SDK disponible — ✔
2. Servicio configurado — ✔
3. Autenticación exitosa (App Check) — ✔ (token real de depuración local)
4. Llamada real ejecutada (Gemini) — ✔ (`generateContent()`, ruta `in_cloud`)
5. Respuesta real obtenida — ✔ (2 caracteres, "OK")
6. Persistencia confirmada — **no aplica**: ningún código del proyecto lee ni escribe en Firestore todavía; las reglas deniegan todo acceso a propósito.

## Pendientes y bloqueos reales

- **Bloqueo de diseño, no técnico**: las Fases 1, 7 y 12 completas requieren
  una sesión de diseño visual dedicada (y, para el rig 3D del Guardián, un
  activo que no existe). Seguir "implementando" ahí sin esa base produciría
  exactamente lo que el encargo prohíbe: una maqueta decorativa.
- Cobertura del directorio: 5 de ~195 países, 3 verificados y 2 en revisión.
  Ampliarlo de verdad (no por relleno) requiere investigación país por país,
  al mismo ritmo honesto que esta sesión.
- Modo B del Centro de Auxilio (procedimientos por tipo de incidente) y el
  asistente de borrador de denuncia: contenido real pendiente de redactar.
- Exportación a PDF del expediente: no existe (sí existen Markdown y JSON).
- `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` sigue vacía en Vercel (Preview y
  Production): decisión pendiente del usuario, no un defecto de código.

## Instrucciones para ejecutar y probar

```bash
npm run dev
```
Abrir `http://localhost:3000`. Batería completa:
```bash
npm test
npm run build
npx playwright test
npx playwright test --config=playwright.cloud.config.ts
```
