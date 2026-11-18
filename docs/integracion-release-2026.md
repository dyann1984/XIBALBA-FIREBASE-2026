# Integración: `release/xibalba-2026`

Fecha: 14 de noviembre de 2026.

Dos sesiones trabajaron en paralelo sobre el mismo directorio: Claude en
`finalizacion-mvp` y Codex en `codex/finalizacion-xibalba`, las dos partiendo de
`8c0d8e0` (fase 5). Este documento deja constancia de cómo se juntaron, qué se
rompió al juntarlas y cómo se comprobó.

## Commits

| | Commit | Qué es |
|---|---|---|
| Base común | `8c0d8e0` | Fase 5: CAMAZOTZ, VUCUB CAMÉ y los cinco agentes |
| Padre 1 | `0ec7289` | `finalizacion-mvp` (Claude) |
| Padre 2 | `bb49ea6` | `codex/finalizacion-xibalba` (Codex) |
| Fusión | `febb002` | Integración de las dos ramas, sin conflictos |
| **Final** | **`5042342`** | Corrección de la regresión que nació de la fusión |

`release/xibalba-2026` apunta a `5042342`. Las dos ramas de origen se conservan
intactas.

## Qué aportó cada rama

**`finalizacion-mvp`** — 21 archivos, +2101/−41: catálogo de instituciones CLABE
y detección de discrepancia banco↔cuenta, historial local con enmascarado,
cabeceras de seguridad en `next.config.ts` (CSP, HSTS, `Permissions-Policy`),
seis casos de demostración, `vercel.json` y la documentación de entrega (guion
de video, Devpost, despliegue, pruebas, pendientes).

**`codex/finalizacion-xibalba`** — 4 archivos, +57/−4: `readLimitedBody`, que
limita el cuerpo de `POST /api/audit/external` contando bytes de verdad sobre el
flujo en lugar de confiar en `Content-Length`, con sus pruebas; y el endurecido
de `explainError` para que el texto de un error del proveedor no llegue al
cliente.

Las dos ramas no tocaron los mismos archivos salvo `lib/analysis/analyze.ts`, y
ahí en líneas distintas: `git merge-tree` calculó la fusión **sin un solo
conflicto**.

## La regresión que solo existía en la fusión

Ninguna de las dos ramas podía verla por separado.

Codex dejó de reenviar al cliente el texto de los errores. Para un error del
proveedor es lo correcto: puede traer rutas, identificadores de proyecto o
detalles internos. Pero `explainError` también traducía **nuestros propios
mensajes de validación**, los que se escribieron para que la persona supiera qué
corregir. Con el cambio, escribir una URL mal formada dejó de decir «Introduce
una URL completa con https:// o http://» y pasó a decir «No se pudo completar el
análisis. Inténtalo de nuevo.»: un mensaje que no explica nada sobre algo que la
persona sí puede arreglar.

La corrección separa las dos cosas en lugar de elegir entre ellas:

- `InputError` (en `lib/analysis/guardian.ts`) marca lo que redactamos nosotros
  sobre la entrada de la persona. `explainError` lo muestra tal cual.
- Todo lo demás —modelo, red, proveedor— se reduce a un mensaje nuestro. Su
  texto no sale nunca a pantalla.
- `explainError` se trasladó a `lib/analysis/errors.ts`. `analyze.ts` importa
  `@/lib/firebase`, cuyo alias solo resuelve dentro del empaquetador de Next, así
  que nada alojado ahí se podía probar con `node --test`. El manejo de errores
  pasó a ser superficie de seguridad —decide qué texto ve la persona y cuál no
  sale del dispositivo—, de modo que tenía que ser verificable. `analyze.ts` lo
  reexporta: para el resto del código nada cambió.
- De paso, «Falta configurar…» se evalúa **antes** que la rama del 403: contiene
  la cadena «App Check» y caía en el mensaje de rechazo, que acusaba a Firebase
  de rechazar una solicitud que nunca había salido del dispositivo.

`tests/integracion.test.mjs` (9 pruebas) fija exactamente este riesgo: que los
mensajes propios se muestren, que los ajenos no, que la rama de configuración no
se confunda con la del 403, los bordes de `readLimitedBody` (justo en el límite,
un byte de más, sin cuerpo) y que la superficie pública de las dos ramas siga
completa tras la fusión.

## Cómo se protegió el árbol de trabajo

La otra sesión seguía activa en el mismo directorio: durante el trabajo, `HEAD`
se movió sin intervención nuestra y el puerto 3000 llegó a servir brevemente otra
aplicación.

Por eso **nada de esta integración usó `checkout`, `merge`, `stash` ni `reset`**.
La fusión se calculó con `git merge-tree --write-tree`, y los dos commits se
escribieron con un índice temporal (`GIT_INDEX_FILE` + `read-tree`, `add`,
`write-tree`, `commit-tree`, `update-ref`). `HEAD` sigue donde lo dejó la otra
sesión, en `codex/finalizacion-xibalba`, y el árbol de trabajo nunca se tocó.

Se comprobó después, blob por blob, que el contenido de `release/xibalba-2026`
coincide con el árbol de trabajo verificado: lo que pasó las pruebas es lo que
está en la rama.

## Verificación sobre el árbol integrado

| Comprobación | Resultado |
|---|---|
| `npm run typecheck` (`tsc --noEmit`, strict) | sin errores |
| `npm test` | **175 / 175**, 0 fallos |
| `npm run build` | limpio, salida 0 |
| Seis casos de demostración en la aplicación real | rojo · rojo · rojo · rojo · rojo · **gris** |
| App Check en `/diagnostico-app-check` | «entregó un token válido al SDK» |
| CLABE completa en `localStorage` | ausente; en evidencias, `002***********2343` |

Reparto de las 175: 162 venían de `finalizacion-mvp`, 4 de la rama de Codex
(`limited-body`) y 9 son nuevas de la integración.

No hay `lint`. El proyecto no tiene ESLint instalado ni script `lint`, y no se
añadió: instalar dependencias nuevas a esta altura es un riesgo mayor que el
que cubriría. La comprobación estática de hoy es `tsc --noEmit` en modo
estricto, que sí pasa.

## Lo que esta integración no resuelve

- La suite corrió en **Node 22.23.4**; `engines` exige 24.x. Ver
  [`node-dependencias.md`](node-dependencias.md).
- `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` sigue vacía: sin ella la
  interpretación de IA no se habilita y `/api/audit/external` responde 401. La
  auditoría determinista funciona completa sin esa clave, y App Check **no se
  desactivó** para disimularlo.
- Nada está desplegado y no hay remoto de Git. Ver
  [`despliegue.md`](despliegue.md).
