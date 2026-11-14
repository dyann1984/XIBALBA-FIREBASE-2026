# Auditoría de finalización · 14 de noviembre de 2026

Rama de trabajo: `finalizacion-mvp` (creada desde `master`, commit `8c0d8e0`).
Nada de lo anterior se eliminó ni se reconstruyó.

## 1. Verificación del estado heredado (antes de tocar nada)

Ejecutado en este equipo, en este orden:

| Comprobación | Resultado real |
|---|---|
| `npm run typecheck` | Sin errores |
| `npm test` | `# tests 142 · # pass 142 · # fail 0` |
| `npm run build` | `✓ Compiled successfully`, 6 rutas generadas |

Entorno medido: Node **v22.23.4**, npm 10.9.9, Windows 11.

> **Discrepancia real de entorno.** `package.json` exige `node >=24.12.0` y ese
> requisito **no es inventado**: `@firebase/ai@3.1.0` declara exactamente
> `{"node":">=24.12.0"}`. En este equipo hay Node 22.23.4, por debajo del
> mínimo. `build`, `typecheck` y `test` pasan porque las pruebas no cargan el
> SDK de Firebase y el build no lo ejecuta en el servidor, pero el entorno de
> despliegue **sí** debe tener Node 24.12 o superior. Está anotado en
> `docs/despliegue.md`.

## 2. Matriz de funcionalidades

Estados: **COMPLETO** (implementado y probado), **PARCIAL** (funciona con
límites declarados en la interfaz), **PENDIENTE** (no implementado),
**BLOQUEADO** (depende de algo que no está en este repositorio).

### Análisis y agentes

| Funcionalidad | Estado | Evidencia |
|---|---|---|
| Análisis de enlaces y dominios (HUN CAMÉ) | COMPLETO | 18 comprobaciones locales en `lib/analysis/audit.ts`; homoglifos, subdominio que imita marca, credenciales incrustadas, puertos, esquema |
| Semáforo verde / amarillo / rojo / gris | COMPLETO | `lib/analysis/risk.ts`; el gris existe para no fingir conclusión |
| Explicación de riesgo con evidencia citable | COMPLETO | Cada indicador lleva `evidence`, `source`, `checkedAt`, `recommendation`, `limitation` |
| Prevención de falsos positivos | COMPLETO | Clases A / A′ / B / C / D; la IA solo puede **subir** el riesgo, nunca bajarlo |
| Análisis de mensajes (IXBALANQUÉ) | COMPLETO | Catálogo de patrones en `lib/analysis/patterns.ts` |
| Ingeniería social en WhatsApp / SMS / redes | PARCIAL | Se analiza el texto que la persona pega. No hay integración con WhatsApp ni redes: no existe API que lo permita sin autorización del titular |
| Protección de llamadas (CAMAZOTZ) | PARCIAL | 14 señales de voz + auditoría del archivo de audio. **No** abre el micrófono, **no** graba, **no** intercepta llamadas, y la interfaz lo dice |
| Transcripción automática de audio | BLOQUEADO | Depende de Firebase AI Logic configurado y del consentimiento. Sin motor el estado es `no-disponible`; nunca se inventa texto |
| Fraude financiero (VUCUB CAMÉ) | COMPLETO | CLABE (dígito verificador), Luhn, monederos, 10 señales financieras |
| Nombre de la institución de una CLABE | COMPLETO (esta fase) | `lib/analysis/clabe-institutions.ts`; antes solo se mostraba el código `002` |
| Coordinación de los cinco agentes | COMPLETO | `lib/analysis/coordinator.ts`; selección por contenido, fusión sin duplicados, un solo semáforo |
| Manejo de errores de los agentes | COMPLETO | Si la IA falla, la auditoría local se conserva y el error se informa (`explainError`) |
| Preguntas de seguimiento al Guardián | COMPLETO | `components/Guardian.tsx`, con las evidencias etiquetadas por clase |
| Auditoría externa DNS / RDAP | PARCIAL (deliberado) | Implementada y verificada contra dominios públicos; **deshabilitada** salvo `XIBALBA_EXTERNAL_AUDITS=1` |
| WHOIS `.mx` | PENDIENTE | Adaptador preparado y deshabilitado; `.mx` no publica RDAP |
| Titularidad de cuentas / padrón CNBV | BLOQUEADO | No existe integración ni se ha solicitado ninguna |

### Interfaz y experiencia

| Funcionalidad | Estado | Evidencia |
|---|---|---|
| Panel principal e identidad visual | COMPLETO | `components/Dashboard.tsx`, `app/globals.css`, logo oficial sin modificar |
| Guardián 3D | COMPLETO | `components/guardian/` (Three.js), reacciona al semáforo |
| Estados de carga, error y resultado | COMPLETO | `busy`, `error`, `aria-live="polite"` en el panel de resultado |
| Responsivo móvil y escritorio | COMPLETO | Verificado en 375×812 y en escritorio (ver `docs/pruebas-finalizacion.md`) |
| Historial de análisis | COMPLETO (esta fase) | `lib/history.ts` + sección «Historial»: local, opcional, sin contenido sensible |
| Historial en la nube por usuario | PENDIENTE (diseñado) | Requiere Firebase Authentication. Diseño y reglas propuestas en `docs/historial.md`; las reglas activas siguen cerradas |
| Internacionalización ES/EN | PENDIENTE | La interfaz está en español; el selector de idioma es decorativo |
| Casos de demostración | COMPLETO (esta fase) | `data/demo-cases.json`, cargables desde la interfaz |

### Seguridad

| Funcionalidad | Estado | Evidencia |
|---|---|---|
| Verificación real de App Check en el servidor | COMPLETO | `lib/security/app-check.ts`: RS256 contra el JWKS público, emisor, audiencia, `typ`, caducidad |
| Clave de sitio de App Check | BLOQUEADO | `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` vacía. Sin ella el endpoint externo devuelve 401 en producción |
| Reglas de Firestore | COMPLETO | `firestore.rules` deniega todo. Correcto: **nada** en el código escribe en Firestore |
| Validación de entrada | COMPLETO | `validateInput`, límite de 1 024 bytes en el endpoint, validación de host, tipos y tamaño de adjuntos |
| Protección de endpoints | COMPLETO | App Check + capa anti-CSRF (`sec-fetch-site`, `origin`) + límite por cliente |
| Límites de consumo | PARCIAL | Limitador en memoria por minuto. En varias instancias (serverless) cada una lleva su propio contador: anotado en `docs/seguridad-endpoint.md` |
| Protección contra reenvío de token | PENDIENTE | Exige el Admin SDK y credenciales administradas. No se simula |
| Gestión de variables de entorno | COMPLETO | `.env.local` ignorado por Git; `.env.example` sin secretos; el token de depuración nunca llega al cliente salvo en localhost |
| Protección de datos personales | COMPLETO | CLABE y tarjetas enmascaradas incluso en el fragmento citado; la IP solo se usa como resumen SHA-256 con sal de proceso |
| Cabeceras de seguridad HTTP | COMPLETO (esta fase) | `next.config.ts`: CSP, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` |
| Manejo seguro de errores | COMPLETO | `explainError` no filtra detalles internos; el endpoint devuelve mensajes genéricos |

### Entrega

| Requisito | Estado |
|---|---|
| `README.md` actualizado | COMPLETO (esta fase) |
| `.env.example` sin secretos | COMPLETO (esta fase: se añadió `XIBALBA_EXTERNAL_AUDITS`) |
| Instrucciones de instalación | COMPLETO (esta fase) |
| Configuración de despliegue | COMPLETO (esta fase, `docs/despliegue.md` + `vercel.json`) — **sin desplegar** |
| Demo navegable y datos seguros | COMPLETO (esta fase) |
| Guion de video 2–3 min | COMPLETO (esta fase, `docs/guion-video.md`) |
| Descripción para Devpost | COMPLETO (esta fase, `docs/devpost.md`) |
| Pendientes del hackathon | COMPLETO (esta fase, `docs/pendientes-hackathon.md`) |
| GitHub | PARCIAL | Repositorio local con historial; **no hay remoto configurado** |
| Vercel / Firebase Hosting | PENDIENTE | Nada desplegado. Preparado, pendiente de autorización |

## 3. Lo que esta fase no toca, a propósito

1. **No se habilitan las auditorías externas** para el público general. El
   interruptor `XIBALBA_EXTERNAL_AUDITS` sigue siendo la única puerta.
2. **No se aflojan las reglas de Firestore.** Mientras ningún código escriba en
   Firestore, denegar todo es la regla correcta. El historial de esta fase es
   local al navegador.
3. **No se despliega nada** ni se cambian secretos ni proveedores.
4. **No se añade ninguna dependencia nueva.** `package.json` y
   `package-lock.json` no cambian.
