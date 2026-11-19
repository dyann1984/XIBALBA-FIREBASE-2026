# XIBALBÁ Global Defense — Propuesta de arquitectura

Fecha: 19 de noviembre de 2026. Rama: `xibalba-global-defense`, creada desde
`codex/xibalba-3-phase5-command-center` (commit `f48c8ba`). Esto es la
**propuesta** que el encargo pidió antes de implementar; el Incremento 1
(abajo, §6) ya se construyó sobre esta misma rama para que la propuesta no
quede solo en papel, pero las Misiones 2 y 4 completas (rediseño visual total
y evaluación forense ampliada) están descritas aquí como diseño, no
implementadas todavía — por su tamaño y porque tocan la identidad visual ya
aprobada, conviene tu confirmación antes de construirlas enteras.

## 0. Honestidad sobre el alcance de esta sesión

Un directorio mundial verificado de organismos contra el fraude en ~195
países es, en sí mismo, un proyecto de investigación de semanas, no de una
sesión. Lo que se construyó hoy es la **arquitectura** que lo sostiene (datos,
tipos, componente, i18n) y una **semilla real y verificada** de 3 países
(México, Estados Unidos, Reino Unido) más 1 país deliberadamente dejado en
estado "pendiente de verificación" (España) para demostrar que esa distinción
funciona de verdad, no decorativamente. Cada dato de la semilla viene de una
búsqueda real hecha en esta sesión, citada con su fuente; donde las fuentes no
coincidían o eran de un solo origen, el registro quedó marcado como no
verificado en vez de publicarse como si lo fuera.

## 1. Modelo de datos del directorio global

```ts
type CountryCode = string; // ISO 3166-1 alpha-2, ej. "MX", "US", "GB"
type SubdivisionCode = string; // ISO 3166-2, opcional, ej. "MX-CMX"

type VerificationStatus =
  | "verificado"      // al menos 2 fuentes oficiales o gubernamentales independientes coinciden
  | "en-revision"      // un dato recolectado, sin segunda fuente que lo confirme
  | "pendiente";       // sin ningún dato todavía; el país existe en el directorio pero vacío

type HelpChannel = {
  kind: "telefono" | "correo" | "portal";
  value: string;              // número con código de país, correo, o URL
  languages: string[];        // BCP-47, ej. ["es-MX"]
  hoursNote?: string;         // ej. "Lunes a viernes, 8:00–20:00"
};

type IncidentCategory =
  | "fraude-financiero" | "phishing" | "extorsion" | "suplantacion"
  | "ciberdelito" | "otro";

type EmergencyRecord = {
  id: string;                         // `${countryCode}-${agencySlug}`
  countryCode: CountryCode;
  subdivision?: SubdivisionCode;
  incidentCategories: IncidentCategory[];
  agencyName: string;
  channels: HelpChannel[];
  sourceUrls: string[];                // siempre al menos 1; páginas .gob/.gov oficiales
  lastVerifiedAt: string;              // ISO 8601, fecha real de la comprobación
  status: VerificationStatus;
  notes?: string;                      // matices reales, ej. "el 062 no se confirmó en fuente oficial"
};
```

**Reglas no negociables, aplicadas en el código, no solo documentadas:**
- Ningún registro se puede insertar sin `sourceUrls` no vacío.
- `status: "verificado"` exige 2 o más `sourceUrls` de dominios distintos
  (se comprueba al construir los datos, con una prueba unitaria que falla si
  alguien intenta marcar "verificado" con una sola fuente).
- Un país sin registros se muestra en la interfaz como `"pendiente"`, nunca
  se omite de la lista de países — así "cobertura verificada vs. países
  pendientes" es visible, tal como pide el encargo.

## 2. Pantallas — Misión 2 (diseño; implementación completa pendiente de tu confirmación)

| Pantalla | Qué muestra | Qué NO hace |
|---|---|---|
| **Centro de mando internacional** | Extiende el Command Center actual con un selector de país/jurisdicción que filtra las métricas ya reales (no inventa estadísticas globales) | No muestra un mapa de calor de "fraude global" sin datos reales que lo sustenten |
| **Escudo Global** | El directorio: selector de país, tarjetas de `EmergencyRecord` con insignia de estado (verificado/en revisión/pendiente), fecha de última comprobación visible siempre | No oculta la fecha ni el estado para parecer "más completo" |
| **Botón de ayuda permanente** | Flotante, visible en cualquier pantalla, abre el Escudo Global ya filtrado por el país detectado o elegido | No usa geolocalización precisa sin un consentimiento explícito y separado del de análisis |
| **Sala operativa (5 agentes)** | Ya existe (`AgentOperationsBoard.tsx`); Misión 3 solo pide conservarla y queda intacta | — |
| **Red holográfica forense interactiva** | Extensión del mapa de investigaciones ya real (`InvestigationMap.tsx`) con zoom/pan y leyenda explícita de qué representa cada conexión | No se construye una "red" que sugiera más conexiones de las que `correlateIncidents` encuentra de verdad |
| **Expediente vivo** | Vista de un caso del historial con su evidencia, fuentes y estado de verificación en un solo lugar (ya existe la mayoría de las piezas; falta unificarlas en una sola pantalla) | — |

Esta sesión implementó el **Escudo Global** y el **botón de ayuda
permanente** (Incremento 1, §6). El resto de la tabla queda como diseño
aprobado-para-construir, no construido todavía.

## 3. Misión 3 — Agentes comprobables

Ya se cumple: `AgentOperationsBoard.tsx` solo dibuja una conexión hacia un
agente que de verdad participó (`executed`/`events` reales, probado en
`tests/e2e/xibalba.spec.ts` prueba 10). No se toca nada aquí; se documenta
porque el encargo pide confirmarlo explícitamente.

## 4. Misión 4 — Evaluación forense ampliada (diseño)

El modelo de riesgo actual (`lib/analysis/risk.ts`) ya separa evidencia
determinista, verificada externamente, estimada por IA y pendiente. Las ocho
dimensiones del encargo se **mapean**, no se inventan desde cero:

| Dimensión pedida | De dónde sale hoy | Qué falta |
|---|---|---|
| Riesgo preventivo | `risk.riskLevel` | — (ya existe) |
| Confianza | `risk.confidence` | — (ya existe) |
| Verificación de identidad | — | **No existe y no debe simularse.** Se mostraría siempre como "no verificado": XIBALBÁ no tiene forma real de confirmar identidades |
| Señales detectadas | `audit.indicators` | — (ya existe) |
| Impacto potencial | — | Nuevo campo derivado de `incidentCategories` del directorio (ej. "fraude financiero" → impacto económico) |
| Acciones recomendadas | `indicator.recommendation` | — (ya existe por evidencia; falta una recomendación a nivel de veredicto completo) |
| Fuentes oficiales | `risk.coverage` + el directorio nuevo | Enlazar el directorio del país relevante cuando el caso lo amerite |
| Evidencia faltante | `risk.coverage.pendingExternal` | — (ya existe) |

No se implementó en esta sesión (requiere decidir el diseño visual de la
pantalla de veredicto ampliada primero). Diseño listo para construir cuando
confirmes.

## 5. Misión 5 — Internacionalización escalable

`lib/i18n/dictionary.ts` ya obliga (por tipos de TypeScript) a que `en` tenga
exactamente las mismas claves que `es` — no hay forma de compilar con un
idioma a medias. La propuesta para escalar a más idiomas:

- Cada idioma nuevo vive en su propio archivo (`lib/i18n/fr.ts`, etc.), con el
  mismo tipo que `es`. El idioma **no aparece en el selector** hasta que el
  archivo compila completo — es el mismo mecanismo que ya impide mezclar
  español e inglés, extendido.
- El directorio (`EmergencyRecord.channels[].languages`) es independiente del
  idioma de la interfaz: un registro en México puede ofrecer atención en
  español e inglés aunque la interfaz esté en francés.
- No se agregó ningún idioma nuevo en esta sesión (el encargo pide empezar
  conservando español e inglés); esto es la estructura para cuando se decida
  agregar el primero.

## 6. Incremento 1 (implementado en esta sesión)

- `lib/global-shield/` — tipos (§1), datos semilla reales con fuentes, y
  validación (`assertValidRecord`) que impide marcar "verificado" sin 2
  fuentes.
- Componente nuevo `components/GlobalShield.tsx` — directorio real, filtro
  por país, insignias de estado, botón de ayuda permanente.
- Integrado como nueva sección de navegación, sin tocar ninguna pantalla
  existente.
- Pruebas unitarias de la validación de datos y E2E del directorio.

Ver el reporte de pruebas y capturas en el mensaje de entrega de esta sesión.
