# Pendientes para el hackathon

Fecha: 14 de noviembre de 2026. Ordenado por lo que impide presentar, no por
dificultad.

## 1. Bloqueante para la demostración con IA

### 1.1 Clave de sitio de App Check

`NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` está vacía.

- **Consecuencia:** la interpretación de IA no se habilita y
  `/api/audit/external` responde 401 a todo.
- **Quién lo resuelve:** solo la persona dueña del proyecto de Firebase, en la
  consola. Ningún agente puede generarla.
- **Se puede demostrar sin ella.** La auditoría determinista completa corre en
  el dispositivo y el guion de video está escrito para funcionar así. Pero si se
  quiere enseñar la inferencia híbrida en vivo, esto va primero.
- Pasos exactos: `docs/despliegue.md`, sección 2.

### 1.2 Dominio de producción en reCAPTCHA Enterprise

Aunque exista la clave, App Check falla en el dominio desplegado si ese dominio
no está en la lista de la clave. Es el fallo más común y solo aparece después de
desplegar.

## 2. Necesario antes de publicar el repositorio

| Tarea | Estado |
|---|---|
| Remoto de GitHub configurado | **No hay remoto.** Comandos en `docs/despliegue.md`, sección 6 |
| Comprobar que `.env.local` no está en el historial de Git | Pendiente de ejecutar; `.gitignore` ya lo cubre |
| Decidir qué rama se publica (`master`, `finalizacion-mvp`) | Pendiente |
| Revisar que el logo puede acompañar al código en el repositorio público | Pendiente: el logo **no** está bajo la licencia MIT del código |

## 3. Verificaciones de contenido antes de presentar

### 3.1 Catálogo de instituciones del SPEI

`lib/analysis/clabe-institutions.ts` es un **subconjunto** de la lista pública
de participantes del SPEI, incorporado a mano. Las instituciones se fusionan,
cambian de nombre y causan baja.

- **Qué hacer:** contrastar los códigos y nombres con la lista vigente de Banco
  de México antes de la presentación.
- **Riesgo si no se hace:** mostrar un nombre de banco obsoleto en una
  evidencia. El código no se adivina nunca —un código ausente se declara «no
  identificada»—, así que el riesgo es un nombre antiguo, no uno inventado.

### 3.2 Casos de demostración

`data/demo-cases.json` está verificado por pruebas: sin CLABE mal formada, sin
tarjetas y con todos los enlaces en `example.com`. Si alguien añade un caso,
las pruebas lo comprobarán, pero conviene releerlo: **no pegues nunca un mensaje
real recibido por una persona**.

## 4. Deuda técnica conocida (no bloquea)

| Pendiente | Por qué sigue abierto |
|---|---|
| **CSP con nonce** | Hoy `script-src` conserva `'unsafe-inline'` porque Next.js inyecta scripts en línea. Una CSP estricta exige un nonce por petición y, por tanto, un middleware. El resto de la política (`connect-src`, `object-src`, `frame-ancestors`, `form-action`) ya aporta |
| **Protección contra reenvío de tokens de App Check** | Es una función beta de los Admin SDK y exige credenciales administradas. No se simula: un token válido puede reutilizarse dentro de su vigencia y el límite de solicitudes es lo único que acota ese abuso |
| **Límite de solicitudes distribuido** | El limitador vive en memoria: con varias instancias serverless, cada una lleva su propio contador. Ver `docs/seguridad-endpoint.md` |
| **Historial en la nube por usuario** | Requiere Firebase Authentication. Diseño y reglas propuestas, ya escritos, en `docs/historial.md` |
| **Internacionalización ES/EN** | La interfaz está solo en español y el selector de idioma es decorativo. Si el jurado es anglófono, esto pesa |
| **WHOIS `.mx`** | Adaptador preparado y deshabilitado; `.mx` no publica RDAP |
| **DNS y RDAP para el público** | Implementados y verificados, deshabilitados tras `XIBALBA_EXTERNAL_AUDITS`. Habilitarlos exige decidir límites de consumo |
| **Duración del audio** | No siempre se lee; se informa «duración no legible» en lugar de inventarla |
| **Node 24.12 en el equipo local** | Aquí hay Node 22.23.4. `@firebase/ai` exige 24.12; el entorno de despliegue debe cumplirlo |

## 5. Lo que deliberadamente no se va a hacer

No son pendientes: son decisiones.

1. **No se intercepta ninguna llamada**, no se abre el micrófono y no se graba.
   No existe una API que lo permita sin el consentimiento del titular de la
   línea, y afirmarlo sería mentir en la presentación.
2. **No se leen WhatsApp, SMS ni redes sociales.** Se analiza lo que la persona
   pega.
3. **No se consulta la titularidad de ninguna cuenta.** No hay integración con
   CNBV ni CONDUSEF, y no se ha solicitado.
4. **El verde no se regala.** Una URL desconocida o una cuenta dictada nunca
   pueden dar verde, por mucho que no haya señales.
5. **No se guarda el contenido analizado.** Ni en el historial, ni en la nube,
   ni en registros del servidor.

## 6. Comprobación final, el día de la presentación

- [ ] `npm run typecheck`, `npm test` (166) y `npm run build` en verde.
- [ ] `npm run dev` levanta y el caso de demostración de la llamada da **rojo**
      con 8 señales.
- [ ] El caso de control da **gris**.
- [ ] Historial borrado antes de grabar o presentar.
- [ ] Ninguna variable de depuración de App Check definida.
- [ ] El guion de `docs/guion-video.md` se ajusta a lo que la aplicación hace
      hoy (si cambió algo, se actualiza el guion, no al revés).
