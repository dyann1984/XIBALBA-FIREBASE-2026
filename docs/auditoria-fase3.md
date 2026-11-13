# Auditoría, semáforo y guardián · fase 3

Última revisión: 13 de noviembre de 2026.

## 1. Alcance real del motor determinista

La auditoría es **estrictamente local**. No hay ninguna conexión de red: no se
resuelve DNS, no se abre el sitio, no se siguen redirecciones y no se consulta
reputación, RDAP/WHOIS ni certificados. Por tanto **no existe un servicio de red
que pueda probarse contra SSRF**; cualquier servicio futuro deberá validar DNS e
IP en cada conexión y en cada redirección, aislarse en red, y limitar tiempos y
abuso.

### Comprobaciones de URL (`lib/analysis/audit.ts`, 18 locales)

Estructura normalizada · dominio registrable y sufijo público (`tldts`) ·
transporte declarado · host como IP · Punycode · mezcla de alfabetos
(homógrafos) · marca reconstruida por plegado de confundibles · marca fuera de
su dominio exacto · typosquatting por distancia de edición · dominio que une
marca y palabra de seguridad · terminación con abuso frecuente · acortadores ·
profundidad de subdominios · puerto no estándar · ruta orientada a credenciales
· enlace a ejecutable · enlace a comprimido · otra dirección incrustada · host
extenso u ofuscado.

### Comprobaciones de mensaje (`lib/analysis/patterns.ts`, 16 patrones)

Solicitud de contraseña/PIN/código · frase semilla o clave privada · cobro
anticipado · datos bancarios · presión de tiempo · amenaza de bloqueo de cuenta
· amenaza legal o de cobranza · premio no solicitado · traslado a canal privado
· empleo con condiciones improbables · inversión con rendimiento garantizado ·
condiciones de venta atípicas · petición de secreto · suplantación institucional
con saludo genérico · medio de pago irreversible · contacto no solicitado.

Cada coincidencia **cita el fragmento literal del texto recibido**, con sus
acentos, mediante un mapa de índices sobre la normalización. No se parafrasea ni
se inventa la evidencia. Los enlaces encontrados dentro de un mensaje se
auditan sintácticamente (máximo 5) sin abrirse.

## 2. Separación obligatoria de evidencias

Toda evidencia se clasifica en una y solo una categoría (`classification`):

| | Categoría | Significado |
|---|---|---|
| **A** | `determinista` | Hecho comprobado en el dispositivo sobre el dato recibido. |
| **B** | `ia` | Interpretación del modelo. No verificada, no calibrada. |
| **C** | `pendiente-externo` | Comprobación que requiere red y está deshabilitada. |
| **D** | `error` | La comprobación no pudo ejecutarse. |

Solo la categoría A puntúa el veredicto local. La interfaz las presenta en
bloques separados que nunca se mezclan.

## 3. Semáforo: tres magnitudes distintas

`combineRisk` (`lib/analysis/risk.ts`) devuelve por separado:

- **Nivel de riesgo**: alto / medio / bajo / no concluyente.
- **Confianza de la evaluación**: alta solo con evidencia crítica o dos señales
  altas; media con señales deterministas discutibles; baja cuando el nivel
  depende solo del modelo o no hay evidencia.
- **Cobertura de la auditoría**: comprobaciones ejecutadas frente al total,
  más la lista explícita de las que faltan.

Reglas que el código garantiza y las pruebas verifican:

1. **Una URL desconocida nunca es verde.** Sin comprobaciones externas el
   resultado es *gris / no concluyente*, aunque el modelo diga «bajo».
2. La evidencia determinista alta **no se rebaja** por una IA más benigna; el
   modelo solo puede elevar el nivel.
3. Si el nivel alto procede solo del modelo, se advierte explícitamente que no
   hay respaldo determinista y la confianza es baja.
4. Solo un mensaje **sin enlaces y sin imágenes** puede alcanzar verde, porque
   es el único caso en que el análisis local agota el objeto analizado.
5. Siempre se muestran las evidencias responsables del resultado (`rationale`).

Los estados `verificado` y `sospechoso` se refieren a la propiedad sintáctica
mostrada, no a la seguridad del sitio. Las listas de marcas, terminaciones y
acortadores son parciales y pueden producir falsos positivos; cada indicador
declara su propia limitación.

## 4. Multimodal

Entrada por escritura, pegado de texto, selección de archivo, pegado de captura
con **Ctrl+V** y **cámara** con el permiso que solicita el navegador. Hasta 3
imágenes JPEG o PNG de 4 MB, con vista previa y eliminación individual. Las
imágenes viven en memoria (`URL.createObjectURL`, revocado al quitarlas) y no se
guardan.

La auditoría determinista **no lee el contenido de la imagen**: no hay OCR
local. Por eso una imagen adjunta deja la cobertura incompleta y el resultado
no puede ser verde. El envío al modelo multimodal requiere el consentimiento
explícito; sin él se ejecuta igualmente la auditoría local.

## 5. Guardián holográfico

Escena 3D real con three.js 0.187.0 (MIT), construida **procedimentalmente en
código** (`components/guardian/scene.ts`): no hay modelo descargado, ni recurso
de terceros, ni problema de licencia. El logo oficial no se usa ni se sustituye
en la escena.

Implementado: malla 3D con cabeza, cuerpo, hocico, brazos, diadema maya dorada
con bloques de glifos, seis branquias en abanico y glifos luminosos en el pecho;
parpadeo por escala de párpado; seguimiento del puntero; ondulación de
branquias; respiración; y cinco estados animados (reposo, escuchando,
analizando, explicando, alerta) más el estado de error. El color de ojos,
glifos, aura y anillo sigue al semáforo.

Rendimiento y accesibilidad: carga diferida (`next/dynamic`, fuera del paquete
inicial), pausa por `IntersectionObserver` y `visibilitychange`, `devicePixelRatio`
limitado a 2, `prefers-reduced-motion` sin bucle de animación, lienzo
`aria-hidden` con estado en texto, y degradación silenciosa si falta WebGL.

**Pendiente para un personaje definitivo**: la geometría procedimental es una
aproximación, no un personaje esculpido. Para alcanzar el acabado del logo hace
falta un modelo glTF original esculpido y riggeado, con *blend shapes* faciales
(parpadeo, sonrisa, sorpresa, alerta), texturas PBR y normal maps, branquias con
simulación o huesos, animaciones exportadas por estado, y compresión Draco/KTX2.
Debe encargarse como recurso original con cesión de derechos, o adquirirse con
licencia comercial revisada; no se ha incorporado ningún recurso externo.

## 6. Voz y preguntas

La voz usa síntesis del navegador bajo activación explícita, eligiendo una voz
`es-MX` si el sistema la ofrece. Las preguntas al guardián son solicitudes
independientes al modelo: viajan con las evidencias deterministas y la
advertencia de no afirmar comprobaciones externas, pueden ir a la nube bajo el
consentimiento del análisis y **no constituyen una conversación persistente**.
No se guarda historial.

## 7. Riesgos conocidos

- Las listas de marcas, terminaciones y acortadores son parciales y estáticas.
- El plegado de confundibles es heurístico y puede coincidir con nombres
  legítimos parecidos a una marca.
- La confianza de la IA no está calibrada y su salida se descarta si no cumple
  el esquema (`parseAssessment` falla cerrado).
- `npm audit` reporta 6 vulnerabilidades **preexistentes** en dependencias
  transitivas (`firebase` → `@grpc/grpc-js`, `next` → `postcss`). No proceden de
  three.js. Actualizarlas implica cambios mayores y requiere autorización.
