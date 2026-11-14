# Matriz de auditorías externas pendientes

Fecha: 13 de noviembre de 2026.

Estado actual: **DNS y RDAP (fase 1) están implementados**, con las consultas
reales apagadas por omisión (`XIBALBA_EXTERNAL_AUDITS` no activo). Las otras
cuatro siguen **deshabilitadas y sin implementar**. El detalle de lo construido,
y la limitación abierta de App Check en el servidor, están en
`docs/plan-dns-rdap.md`, sección 13.

En México la fase 1 queda **incompleta por causa ajena**: el registro de `.mx`
no publica servidor RDAP, así que la antigüedad y la titularidad de un dominio
mexicano permanecen en la categoría C. El adaptador WHOIS previsto está escrito
pero deshabilitado.

El motor de la fase 3 es exclusivamente local. Las comprobaciones de esta
matriz son las que hoy se declaran en la categoría **C (pendiente de
comprobación externa)** y las que impiden que una URL desconocida alcance el
verde. Este documento define qué haría falta para habilitarlas de forma segura,
autorizada y verificable.

> Ninguna de estas comprobaciones debe implementarse en el cliente. Todas
> requieren un punto de ejecución en servidor: protege las claves de API y
> evita revelar la dirección IP de la persona usuaria a terceros.

---

## Requisitos transversales (obligatorios para cualquiera de las cinco)

| Requisito | Detalle |
|---|---|
| **Ubicación** | Route handler de Next o Cloud Function. Nunca desde el navegador. |
| **Autenticación del endpoint** | App Check **enforced** + límite por sesión e IP. Sin esto, el servicio se convierte en un proxy abierto de escaneo. |
| **Defensa SSRF** | Resolver DNS antes de conectar; rechazar IP privadas, reservadas, loopback, link-local y ULA (`10/8`, `172.16/12`, `192.168/16`, `127/8`, `169.254/16`, `::1`, `fc00::/7`, `fe80::/10`); **revalidar en cada salto de redirección**; fijar la IP validada en la conexión para evitar DNS rebinding. |
| **Límites** | Máx. 5 redirecciones · tiempo total ≤ 5 s · respuesta ≤ 256 KB · sin cookies, sin credenciales, sin ejecución de JavaScript. |
| **Aislamiento de red** | Egreso dedicado con lista de permitidos; el proceso no debe alcanzar metadatos de nube (`169.254.169.254`) ni la red interna. |
| **Privacidad** | Una URL es dato personal: puede contener identificadores en la ruta o la consulta. Enviar a terceros solo el dominio registrable salvo consentimiento explícito para la URL completa. Documentar retención y borrado. |
| **Consentimiento** | Abrir un enlace **avisa al atacante** y puede consumir un enlace de un solo uso. Requiere consentimiento por análisis, distinto del consentimiento de IA. |
| **Caché** | TTL por tipo de dato, para limitar coste, exposición a terceros y límites de tasa. |
| **Modelo de evidencia** | Un resultado externo solo pasa a categoría **A** si la fuente es autoritativa y el dato es verificable. Los veredictos de reputación son opinión de un tercero: se atribuyen con fuente y fecha y **nunca** se presentan como comprobación propia. |
| **Regla del semáforo** | «No aparece en ninguna lista» **no es verde**. La ausencia de señal sigue sin demostrar seguridad; a lo sumo reduce la incertidumbre. |

---

## 1. DNS — ¿existe y a dónde apunta?

| Campo | Valor |
|---|---|
| **Responde a** | Si el dominio resuelve; registros A/AAAA, NS, MX, TXT; uso de infraestructura compartida o de bulletproof hosting. |
| **Fuentes** | Google DNS-over-HTTPS (`dns.google/resolve`) · Cloudflare DoH (`1.1.1.1`) · `node:dns/promises` con resolvers fijados. |
| **Permisos / claves** | Ninguna. Sin registro. |
| **Coste** | Gratuito. |
| **Seguridad específica** | Usar DoH sobre HTTPS para evitar manipulación en ruta. Limitar la cadena CNAME (máx. 8). No aceptar respuestas que resuelvan a rangos privados. Validar el formato antes de parsear. |
| **TTL de caché** | 5–15 min. |
| **Evidencia resultante** | **A** — hecho verificable con marca de tiempo. Un dominio que no resuelve es señal fuerte; que resuelva no es señal de legitimidad. |
| **Prioridad** | **Alta.** Es la más barata, sin claves y la que más reduce la incertidumbre actual. |

## 2. RDAP / WHOIS — ¿cuándo se registró y quién lo administra?

| Campo | Valor |
|---|---|
| **Responde a** | Fecha de creación (la **antigüedad del dominio** es de las señales más predictivas de phishing), registrador, estado del dominio, servidores de nombres. |
| **Fuentes** | RDAP vía bootstrap de IANA (`data.iana.org/rdap/dns.json`) — abierto, estandarizado y en JSON. WHOIS (puerto 43) solo como respaldo: texto no estructurado y frágil. |
| **Permisos / claves** | Ninguna, pero cada registro impone sus propios límites de tasa y condiciones de uso. |
| **Coste** | Gratuito. |
| **Seguridad específica** | Solo servidor. Parsear con esquema estricto y rechazar respuestas malformadas. No seguir enlaces `related` arbitrarios del RDAP (es contenido controlable por terceros). |
| **TTL de caché** | 24 h o más; los datos de registro cambian rara vez. |
| **Limitaciones reales** | Muchos ccTLD no publican RDAP, y el RGPD obliga a redactar los datos de contacto. La fecha de creación suele seguir disponible; cuando no lo está, el resultado permanece en **C**, no se infiere. |
| **Evidencia resultante** | **A** cuando hay fecha de creación; **C** cuando el registro la oculta. |
| **Prioridad** | **Alta.** Alto valor de señal y coste cero. |

## 3. Certificado TLS — ¿quién lo emitió y cuándo?

| Campo | Valor |
|---|---|
| **Responde a** | Validez para el host (coincidencia SAN), emisor, fecha de emisión. Un certificado emitido hace horas sobre un dominio recién registrado es una combinación muy indicativa. |
| **Fuentes** | Handshake TLS directo desde el servidor (`node:tls`) · Certificate Transparency: `crt.sh` (gratuito, de mejor esfuerzo, con límites) o la API de CT de Google. |
| **Permisos / claves** | Ninguna. |
| **Coste** | Gratuito. |
| **Seguridad específica** | Realizar **solo el handshake**: no enviar ninguna petición HTTP (eso ya sería visitar el sitio). Indicar SNI, tiempo de espera corto y **nunca** deshabilitar la validación del certificado. Aplican íntegras las reglas anti-SSRF: validar la IP resuelta antes de conectar. |
| **TTL de caché** | 6–24 h. |
| **Evidencia resultante** | **A**. Con la limitación explícita de que un certificado válido solo prueba control del dominio, **no** legitimidad del titular: Let's Encrypt emite gratis para cualquiera. |
| **Prioridad** | **Media.** |

## 4. Reputación — ¿está en listas de amenazas conocidas?

| Campo | Valor |
|---|---|
| **Responde a** | Si la URL o el dominio figura en listas públicas de phishing o malware. |
| **Fuentes** | Google Safe Browsing (Lookup API v4 / v5) · URLhaus de abuse.ch (sin clave) · PhishTank (clave, cuota reducida) · VirusTotal (4 req/min gratis, de pago por encima). |
| **Permisos / claves** | Safe Browsing: clave de API + aceptación de sus condiciones, que **exigen atribución visible** y limitan el almacenamiento en caché. VirusTotal: clave; el plan gratuito prohíbe uso comercial. Claves siempre en servidor. |
| **Coste** | Safe Browsing: cuota gratuita amplia. VirusTotal de pago al escalar → **requiere autorización previa**. |
| **Seguridad y privacidad específicas** | La URL completa sale del dispositivo hacia un tercero. Preferir la **Update API de Safe Browsing (prefijos hash)**, que permite consultar sin revelar la URL. Si se usa la Lookup API, hace falta consentimiento explícito y aviso de privacidad. Respetar los TTL de caché que imponen las condiciones del servicio. |
| **Evidencia resultante** | Clase propia: **veredicto de tercero**, atribuido con fuente y fecha. Un positivo es señal muy fuerte (→ rojo). Un negativo **no** mueve el semáforo a verde: las listas van por detrás de las campañas, que suelen durar horas. |
| **Prioridad** | **Media.** Alto valor en positivos, nulo en negativos. |

## 5. Redirecciones y destino final — ¿a dónde lleva realmente?

| Campo | Valor |
|---|---|
| **Responde a** | La cadena real de saltos y la URL final. Imprescindible para acortadores, que hoy solo se marcan como «destino desconocido». |
| **Fuentes** | Servidor propio siguiendo redirecciones. No hay tercero fiable que no introduzca sus propios riesgos. |
| **Permisos / claves** | Ninguna externa. |
| **Coste** | Solo tráfico de salida. |
| **Seguridad específica** | **Es el elemento de mayor riesgo de toda la matriz.** Vector clásico de SSRF. Además de los requisitos transversales: `HEAD` primero y `GET` solo si es imprescindible; validar la IP en **cada** salto, no solo en el primero; conectar a la IP ya validada con la cabecera `Host` correcta (evita DNS rebinding entre la comprobación y la conexión); sin cookies ni cabeceras de autenticación; no renderizar ni ejecutar nada de la respuesta; tratar todo el contenido como dato no confiable. Ejecutar en un trabajador aislado con egreso restringido. |
| **Consideración no técnica** | Visitar el enlace **avisa al operador del fraude** de que el mensaje llegó y puede invalidar enlaces de un solo uso, perjudicando a la víctima. Exige consentimiento informado y específico. |
| **Evidencia resultante** | **A** para la cadena observada, con la limitación de que un servidor puede *cloaking*: responder distinto según User-Agent, IP o país, de modo que lo que ve el servidor puede no ser lo que vería la persona. |
| **Prioridad** | **Baja para implementar, alta en impacto.** Debe ser la última y la más revisada. |

---

## Orden de implementación recomendado

1. **DNS + RDAP** — sin claves, sin coste, sin exposición de datos a terceros y con el mayor aumento de cobertura. Convertiría «antigüedad del dominio» y «resolución DNS» de C a A.
2. **Certificado TLS** — gratuito, encaja con lo anterior y completa el bloque de señales de infraestructura.
3. **Reputación** — requiere clave, condiciones de uso y decisión de privacidad sobre qué se envía.
4. **Redirecciones** — al final, con revisión de seguridad dedicada y consentimiento propio.

## Criterios de aceptación antes de habilitar cualquiera

- Pruebas de SSRF contra `127.0.0.1`, `169.254.169.254`, `[::1]`, dominios que resuelven a IP privadas y **redirecciones que saltan de una IP pública a una privada**.
- Pruebas de tiempo de espera, respuesta enorme y bucle de redirecciones.
- El endpoint rechaza peticiones sin App Check válido.
- El resultado se integra en `coverage.pendingExternal` reduciendo la lista, y en la categoría de evidencia correcta.
- Se mantiene la regla rectora: **ningún resultado externo negativo convierte una URL en verde por sí solo.**
- Registro de auditoría sin almacenar las URL analizadas en claro más allá del TTL declarado.
