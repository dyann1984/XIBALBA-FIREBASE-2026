# Plan técnico · auditorías reales de DNS y RDAP

Estado: **implementado y probado en local, con las consultas reales apagadas por
omisión.** Fecha de diseño: 13 de noviembre de 2026. Véase la sección 13 para lo
que quedó construido, lo que cambió respecto a este diseño y lo que sigue sin
verificarse.

Fase 1 de la matriz de `docs/auditorias-externas-pendientes.md`. Se eligen DNS
y RDAP primero porque son **gratuitos, abiertos y sin contrato ni clave de
API**, y porque son los que más reducen la incertidumbre actual.

---

## 0. Propiedad que hace segura esta fase

**Ninguna de las dos comprobaciones contacta con el sitio sospechoso.**

- DNS se consulta a un *resolver* público fijo (Cloudflare, Google).
- RDAP se consulta al registro del TLD, descubierto por el *bootstrap* de IANA.

Consecuencias directas, y la razón de que esta fase vaya antes que las otras:

| | DNS + RDAP (fase 1) | Redirecciones (fase 4) |
|---|---|---|
| ¿Avisa al estafador? | **No** | Sí |
| ¿Consume enlaces de un solo uso? | **No** | Sí |
| Destino de la conexión | Host fijo y conocido | **URL del atacante** |
| Superficie SSRF | Mínima (inyección de parámetros) | Máxima |

El vector residual no es «conectar a donde diga el atacante», sino
**inyección en el parámetro de consulta**. Eso define las defensas.

---

## 1. Qué responde cada comprobación

### DNS
- ¿El dominio existe? (`NOERROR` frente a `NXDOMAIN`)
- ¿Tiene dirección? (`A` / `AAAA`)
- ¿Apunta a una IP privada o reservada? → truco conocido para atacar la red local de la víctima.
- ¿Tiene `NS` y `MX`? (presencia, no reputación)

### RDAP
- **Fecha de registro del dominio** — la señal más predictiva de phishing que se puede obtener gratis.
- Registrador y estados (`client hold`, `pending delete`, …).

---

## 2. Arquitectura

Todo en servidor. Nunca en el navegador: protege la IP de la persona usuaria y
permite aplicar límites de tasa reales.

```
app/api/audit/external/route.ts     Route handler (runtime nodejs), App Check obligatorio
lib/external/hostname.ts            Validación y normalización del host (puerta de entrada)
lib/external/doh.ts                 Cliente DNS-over-HTTPS (transporte)
lib/external/rdap.ts                Cliente RDAP + bootstrap (transporte)
lib/external/interpret-dns.ts       JSON -> AuditIndicator[]   (función pura)
lib/external/interpret-rdap.ts      JSON -> AuditIndicator[]   (función pura)
lib/external/cache.ts               Caché con TTL
data/rdap-bootstrap.json            Copia vendorizada de respaldo del bootstrap de IANA
```

**Separación deliberada entre transporte e interpretación.** Las funciones
`interpret*` reciben JSON ya analizado y devuelven indicadores. Así toda la
lógica de señales se prueba con *fixtures*, **sin red en las pruebas**.

---

## 3. Capa de validación del host (puerta única)

Ninguna consulta sale sin pasar por aquí. Se rechaza, no se corrige:

1. Reutilizar `tldts.parse()`, que ya es dependencia.
2. Exigir dominio registrable con sufijo **ICANN** (`isIcann`).
3. Rechazar literales IP (`info.isIp`): RDAP de dominios no aplica.
4. Rechazar sufijos no enrutables: `.test`, `.local`, `.localhost`, `.invalid`, `.example`, y los privados de la PSL.
5. Formato: ≤ 253 caracteres totales, cada etiqueta ≤ 63, solo `[a-z0-9-]` y `xn--` (el host ya llega en Punycode desde `URL`).
6. **Rechazar cualquier carácter fuera de ese conjunto** — cierra la inyección de `&`, espacios, saltos de línea o `?` en la URL de consulta.
7. Construir la consulta **siempre con `URLSearchParams`**, nunca por concatenación de cadenas.

Alcance de cada consulta:
- DNS → el **host completo** (`www.ejemplo.com`).
- RDAP → el **dominio registrable** (`ejemplo.com`), que es la unidad registrada.

---

## 4. Cliente DNS-over-HTTPS

| Aspecto | Decisión |
|---|---|
| Proveedores | `https://cloudflare-dns.com/dns-query` y `https://dns.google/resolve`, en ese orden |
| Formato | JSON DoH (`accept: application/dns-json`) |
| Coste / contrato | **Gratuito, sin clave, sin registro** |
| Consultas | `A`, `AAAA`, `NS`, `MX` |
| Tiempos | 3 s por proveedor, 5 s en total |
| Reintentos | 1, cambiando de proveedor (no se martillea al mismo) |
| Respuesta | Límite de 64 KB; `JSON.parse` dentro de `try`; validación de esquema antes de usar |
| Caché | TTL de la propia respuesta, acotado a `[60 s, 900 s]` |

Notas de diseño:
- Se usan dos proveedores por disponibilidad. Una discrepancia entre ambos es
  anotable, pero como indicador **informativo**: el *DNS geográfico* legítimo
  produce respuestas distintas constantemente.
- `Status: 3` (NXDOMAIN) y `Status: 0` con respuesta vacía son casos distintos
  y se tratan por separado.

### Señales derivadas

| Condición | Severidad | Razonamiento |
|---|---|---|
| Resuelve a IP privada / reservada / loopback | **alto** | Un dominio público apuntando a `10/8`, `127/8`, `169.254/16`, `::1` o `fc00::/7` es un patrón de ataque a la red local de la víctima |
| `NXDOMAIN` | medio | El dominio no existe; un enlace a un dominio inexistente en un mensaje es anómalo (aunque puede ser una errata) |
| Existe pero sin `A`/`AAAA` | medio | Dominio registrado y sin servicio: típico de dominio aparcado para campañas |
| Sin `MX` | informativo | Muchísimos sitios legítimos no tienen correo. **No puntúa** |
| Resuelve con normalidad | informativo | **Nunca suma hacia verde.** Resolver no es ser legítimo |

---

## 5. Cliente RDAP

| Aspecto | Decisión |
|---|---|
| Descubrimiento | `https://data.iana.org/rdap/dns.json` (bootstrap oficial) |
| Respaldo | **Copia vendorizada en `data/rdap-bootstrap.json`**, para que una caída de IANA no rompa la función |
| Caché del bootstrap | 7 días |
| Consulta | `<base>/domain/<dominio-registrable>`, `accept: application/rdap+json` |
| Coste / contrato | **Gratuito, sin clave, sin registro** |
| Tiempos | 5 s |
| Redirecciones | Máximo 2, solo `https`, solo hacia host público |
| Caché del resultado | 24 h (los datos de registro cambian rara vez) |

### Reglas de seguridad propias de RDAP

1. La URL base sale del bootstrap de IANA (fuente confiable), pero igualmente
   se exige **esquema `https`** y se **rechaza que resuelva a IP privada**.
2. **Nunca seguir `links[].href` del cuerpo RDAP.** Ese contenido lo controla
   parcialmente el registro/registrador: es exactamente el punto donde un
   RDAP malicioso podría intentar un SSRF. Se leen datos, no se navegan.
3. Analizar con esquema estricto y descartar lo que no encaje; el cuerpo RDAP
   es **dato no confiable**, igual que el texto que analiza el motor local.
4. Limitar el tamaño de la respuesta (256 KB) y la profundidad del JSON.

### Extracción

- `events[]` → `eventAction: "registration"` → `eventDate` (fecha de registro).
  También `"expiration"` y `"last changed"`.
- `status[]` → `client hold`, `server hold`, `pending delete`, `redemption period`.
- `entities[]` con `roles: ["registrar"]` → nombre del registrador.

### Señales derivadas

| Condición | Severidad | Razonamiento |
|---|---|---|
| Registrado hace **< 7 días** | **alto** | Combinación casi definitoria de campaña activa |
| Registrado hace **< 30 días** | **alto** | Señal fuerte y bien documentada |
| Entre 30 y 180 días | medio | Sospechoso, insuficiente por sí solo |
| `pending delete` / `hold` | medio | Dominio en estado anómalo |
| **Más de 1 año** | **informativo** | **No puntúa hacia seguridad.** Los dominios antiguos se comprometen y se revenden |
| Sin RDAP, o fecha redactada | — | **Permanece en categoría C.** No se infiere nada |

---

## 6. Integración en el modelo de evidencias

Se añade una quinta clasificación, para no mezclar lo comprobado en el
dispositivo con lo comprobado contra un registro externo:

```ts
export type EvidenceClass =
  | 'determinista'        // A — comprobado localmente
  | 'verificado-externo'  // A' — comprobado contra fuente autoritativa (NUEVO)
  | 'ia'                  // B
  | 'pendiente-externo'   // C
  | 'error';              // D
```

Cambios acompañantes:

- `deterministicVerdict()` puntúa **`determinista` + `verificado-externo`**.
- Cada indicador externo lleva `source` (el *resolver* o el registro concreto)
  y `checkedAt` reales, no los del análisis local.
- `coverage.pendingExternal` **pierde** `'resolución DNS'`, `'titularidad
  RDAP/WHOIS'` y `'antigüedad del dominio'`, y la cobertura mostrada sube sola.
- La interfaz gana un bloque **A′** en `EvidenceList`, visualmente distinto de A.

### El semáforo no cambia de regla

Tras esta fase siguen pendientes el certificado TLS, la reputación y el destino
final, así que `locallyExhaustive` **continúa siendo `false` para URLs**:

> **La fase 1 no habilita el verde para URLs, y es intencional.** Lo que
> consigue es convertir grises en ámbar y rojo con fundamento verificable, y
> subir la cobertura declarada. La recomendación de diseño es que un dominio
> desconocido **nunca** se declare verde automáticamente, ni siquiera con las
> cinco comprobaciones: el mejor resultado posible debería ser «sin señales
> adversas, cobertura completa», que no es lo mismo que «seguro».

---

## 7. Protección del endpoint

- **App Check obligatorio** (*enforced*). Sin él, el servicio es un proxy
  abierto de reconocimiento para cualquiera.
- Límite de tasa: *token bucket* por sesión (p. ej. 10 dominios/min) y tope
  global por instancia.
- *Circuit breaker*: ante fallos repetidos de un proveedor, se deja de
  consultar durante N minutos y los indicadores pasan a **categoría D**.
- Respuesta sin eco de la entrada cruda; solo el host normalizado.
- Sin registro en claro de las URL analizadas más allá del TTL declarado.

---

## 8. Privacidad

El dominio consultado se revela a Cloudflare/Google y al registro del TLD.
**No** se revela la ruta ni la cadena de consulta: solo se envía el host, y a
RDAP únicamente el dominio registrable.

Debe comunicarse en la interfaz, aunque sin la advertencia de «puedes avisar al
estafador», que aquí **no aplica** (ver §0). Conviene un consentimiento
diferenciado del de IA: *«consultar registros públicos del dominio»*.

---

## 9. Modos de fallo → categoría D

Tiempo agotado, proveedor caído, TLD sin RDAP, JSON malformado, límite de tasa
alcanzado. En todos los casos:

1. El indicador se emite como `error` con el motivo concreto.
2. El elemento correspondiente **vuelve** a `coverage.pendingExternal`.
3. **El nivel de riesgo no baja jamás por un fallo de comprobación.**
4. La auditoría local se entrega igual: no depende de la red.

---

## 10. Plan de pruebas (sin red)

**Unitarias con *fixtures*** — `interpretDns` / `interpretRdap` sobre JSON guardados:
dominio normal, NXDOMAIN, resolución a `10.0.0.1`, registro de hace 3 días,
de hace 5 años, fecha redactada, `pending delete`, TLD sin RDAP, JSON basura.

**Seguridad de la validación de host** — debe rechazar:
`192.168.1.1`, `[::1]`, `algo.test`, `algo.local`, etiqueta de 64 caracteres,
host de 300 caracteres, y los intentos de inyección
`ejemplo.com&type=ANY`, `ejemplo.com?x=1`, `ejemplo.com%0d%0a`, `ejemplo.com ANY`.

**Seguridad RDAP** — rechazar base `http://`, base que resuelve a IP privada,
cadena de redirecciones > 2, y comprobar que **no se sigue ningún `links[].href`**
del cuerpo.

**Integración del modelo** — la cobertura sube, `pendingExternal` encoge, y
**una URL con DNS y RDAP correctos sigue sin ser verde**.

Objetivo: **≥ 20 pruebas nuevas**, todas offline, sumadas a las 32 actuales.

---

## 11. Checklist previo a escribir código (fase 0)

1. **Verificar la disponibilidad de RDAP para `.mx`** y otros ccTLD de la región
   objetivo. Si el registro no publica RDAP o redacta la fecha de registro, el
   valor de la función cae mucho para el público principal del producto. **Esto
   se comprueba antes de invertir en la implementación.**
2. Revisar las condiciones de uso de los *resolvers* DoH para el volumen previsto.
3. Decidir dónde vive la caché: memoria por instancia (simple, se pierde en
   cada despliegue) frente a Firestore (persistente, pero implica reglas, coste
   y contradice el «sin persistencia» actual). **Recomendación: memoria en la
   fase 1.**
4. Confirmar que el despliegue permite runtime `nodejs` y salida a Internet.

---

## 12. Fuera de alcance de esta fase

No se hace handshake TLS, no se consulta reputación, no se siguen
redirecciones, **no se visita el sitio**, no se contrata ningún servicio y no
se activa facturación. Nada de la fase 1 requiere contrato, clave de API ni
pago.


---

## 13. Lo que quedó implementado (13 de noviembre de 2026)

### 13.1 El hallazgo sobre «.mx», verificado

Se comprobó de forma independiente y el dato **se confirma**:

| Fuente consultada | Fecha | Resultado |
|---|---|---|
| `https://data.iana.org/rdap/dns.json` | 13 nov 2026 | Versión 1.0, publicación `2026-10-28T22:00:04Z`, 592 servicios, 1203 TLD. **`mx` no aparece.** |
| `https://www.iana.org/domains/root/db/mx.html` | 13 nov 2026 | Campo «RDAP Base URLs»: `-` (vacío). Campo «WHOIS Server»: `whois.mx`. |

Consecuencia que amplía el hallazgo: **tampoco tienen RDAP** `cl`, `co`, `es`,
`us` ni `io`. Y dos TLD (`kg`, `mg`) solo publican `http://`, que este cliente
**rechaza** en lugar de degradar la conexión. Del bootstrap quedan utilizables
**1201 TLD por HTTPS**.

Por tanto RDAP **no puede ser la única vía** de antigüedad y titularidad. El
diseño se adaptó así:

- Para un TLD sin servidor RDAP, `lookupRdap` devuelve `status: "no-disponible"`
  citando la publicación del bootstrap como fuente. No se inventa un servidor.
- Para `.mx` y `.com.mx`, el orquestador deriva al **adaptador WHOIS**, que está
  **deshabilitado** y devuelve `status: "deshabilitada"` con su motivo.
- En la interfaz ambos casos aparecen en la **categoría C** como
  **«No verificable»**, nunca como un dato.

> Estas consultas a IANA son las **únicas** consultas externas realmente
> realizadas. Todas las pruebas automatizadas son simuladas, con `fetch`
> inyectado (`tests/external.test.mjs`). No se mezclan.

### 13.2 Condiciones para habilitar WHOIS `.mx`

`WHOIS_MX_ENABLED` está en `false` en `lib/external/whois-mx.ts`. Para
encenderlo hay que verificar y dejar escrito aquí:

1. **Condiciones de uso de NIC México** para consulta automatizada: frecuencia
   permitida, atribución exigida, usos prohibidos.
2. **Conectividad real al puerto 43** desde el entorno de despliegue. WHOIS es
   TCP en claro; el runtime Edge no abre sockets, así que exige runtime Node.
3. **Qué campos devuelve de verdad** y cuáles redacta. Las etiquetas que hoy
   reconoce el analizador son tolerantes a propósito: hasta ver una respuesta
   real **no se afirma** que el registro publique fecha de creación.

Mientras tanto el analizador `parseWhoisMx` ya está escrito y probado con
respuestas de ejemplo, de modo que habilitarlo sea un cambio de una línea más
la verificación de arriba.

### 13.3 Archivos

| Archivo | Papel |
|---|---|
| `lib/external/net-guard.ts` | Clasificación de IP y validación de URL de salida (SSRF) |
| `lib/external/hostname.ts` | Puerta única de validación de host |
| `lib/external/types.ts` | Contrato `ExternalResult<T>`, hechos DNS y de registro |
| `lib/external/doh.ts` | Cliente DNS-over-HTTPS, proveedores en lista cerrada |
| `lib/external/rdap.ts` | Cliente RDAP sobre el bootstrap de IANA |
| `lib/external/rdap-servers.generated.ts` | Mapa TLD → servidor, **generado** |
| `lib/external/whois-mx.ts` | Adaptador WHOIS `.mx`, **deshabilitado** |
| `lib/external/cache.ts` | Caché con vencimiento y limitador de solicitudes |
| `lib/external/interpret-dns.ts` | Hechos DNS → evidencia |
| `lib/external/interpret-rdap.ts` | Hechos de registro → evidencia |
| `lib/external/index.ts` | Orquestador, interruptor y fusión con la auditoría local |
| `app/api/audit/external/route.ts` | Endpoint, runtime Node |
| `scripts/generate-rdap-servers.mjs` | Regenera el mapa desde `data/rdap-bootstrap.json` |
| `tests/external.test.mjs` | 36 pruebas, todas simuladas |

El mapa de servidores **se genera** en lugar de importar el JSON en tiempo de
ejecución: así no hay lectura de disco en el servidor, no se depende de
atributos de importación (`with { type: "json" }`, que no sobreviven al modo
«strip-only» de Node ni al empaquetador) y el mapa queda revisable en el
control de versiones. Se comprobó que **no llega al paquete del cliente**.

### 13.4 Interruptor: apagado por omisión

`EXTERNAL_AUDITS_ENABLED` solo es verdadero si el entorno declara
`XIBALBA_EXTERNAL_AUDITS=1`. Apagado, **no sale ni una petición**: cada
comprobación devuelve `deshabilitada` y la interfaz muestra «No verificable».
Así la función queda lista sin que el comportamiento actual cambie hasta que se
decida encenderla.

### 13.5 Cambios respecto al diseño

| Diseño (secciones 1–12) | Implementación | Por qué |
|---|---|---|
| RDAP: «máximo 2 redirecciones, solo https, solo host público» | `redirect: "error"`: **ninguna** redirección | Más estricto y más simple de auditar. Si un registro redirige, el dato se declara no verificable en lugar de seguir la URL de un tercero |
| Semáforo: quitar etiquetas de `pendingExternal` al comprobarlas | Igual, **y además** `locallyExhaustive` es siempre `false` para los sujetos `url` y `mixto` | Garantía estructural: aunque algún día se resolvieran las siete etiquetas, una URL no podría ponerse en verde |
| Endpoint: «App Check obligatorio» | Mismo origen + formato de JWT + límite de solicitudes | **La firma del token NO se verifica.** Véase 13.6 |

### 13.6 Limitación abierta: App Check en el servidor

El endpoint **no verifica criptográficamente** el token de App Check. Hacerlo
exige `firebase-admin` y una clave de cuenta de servicio, es decir una
credencial nueva, que no está autorizada en este proyecto. Hoy la cabecera solo
demuestra que el cliente la envió.

La protección real del endpoint es, por ahora: **mismo origen**
(`sec-fetch-site` + `origin`), **límite de solicitudes** y **validación estricta
del host**. No debe presentarse como «App Check aplicado en el servidor».

### 13.7 Privacidad

No se registra la dirección IP ni el dominio consultado. El limitador usa un
resumen SHA-256 irreversible y truncado de la IP, con sal de proceso, solo en
memoria y por un minuto. Las cachés viven en memoria y se pierden en cada
despliegue, como recomendaba la sección 11.

### 13.8 Qué sigue sin comprobarse

Certificado TLS, reputación en listas de amenazas, redirecciones y destino
final, y contenido publicado en el sitio. Siguen en la categoría C y así se
muestran. La antigüedad y la titularidad quedan comprobadas **solo** en los
1201 TLD con RDAP por HTTPS; en México, no.
