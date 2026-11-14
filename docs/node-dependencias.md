# Node 24 y compatibilidad de dependencias

Revisión: 14 de noviembre de 2026 · rama `release/xibalba-2026`.

Nada de lo descrito aquí cambió el entorno global del equipo: no se instaló ni
se desinstaló ninguna versión de Node. Los dos cambios son del repositorio
(`package.json`).

## 1. Qué versión de Node exige el proyecto, y en qué versión se verificó

| | Versión |
|---|---|
| Declarada en `engines.node` | **24.x** |
| Exigida por `@firebase/ai@3.1.0` | `>=24.12.0` |
| Instalada en el equipo de desarrollo | **22.23.4** |
| Usada para typecheck, 175 pruebas y build | **22.23.4** |

Esa última fila es el hueco honesto de esta revisión: **la suite no se ha
ejecutado nunca en Node 24**. Pasa en 22.23.4 porque ninguna de las tres tareas
ejecuta el SDK de Firebase en el servidor —la IA corre en el navegador y las
rutas de API solo usan `node:crypto` y `fetch`—, así que el mínimo de
`@firebase/ai` no se toca en tiempo de build. No es una garantía: es que el
camino que exige Node 24 no se recorre durante la verificación.

Subir el Node local resolvería el hueco, pero es un cambio del entorno global y
requiere autorización. Queda como paso pendiente en
[`despliegue.md`](despliegue.md).

## 2. `engines`: de `>=24.12.0` a `24.x`

El valor anterior era un rango abierto. Vercel lee `engines.node`, **sobrescribe
con él** el ajuste del panel y resuelve un rango al major más nuevo que soporta;
hoy ya ofrece 26.x. Con `>=24.12.0`, el runtime del despliegue podía pasar de 24
a 26 sin que nadie tocara el repositorio, y con él la verificación dejaba de
describir lo desplegado.

`24.x` fija el major y deja que el minor lo elija la plataforma. Es además la
forma que la documentación de Vercel pide para sobrescribir el ajuste del
proyecto.

## 3. El script de pruebas ya no depende de un flag experimental

Antes:

```
node --experimental-strip-types --test tests/*.test.mjs
```

Ahora:

```
node --test tests/*.test.mjs
```

Las pruebas importan `.ts` directamente, de modo que necesitan que Node elimine
los tipos. Desde Node 22.18 eso está activado por omisión y el flag sobra; si en
una versión futura el flag se retirara, `npm test` fallaría con «bad option»
antes de ejecutar una sola prueba —un fallo de herramienta disfrazado de fallo de
suite—. Sin el flag, el mismo comando sirve en 22.18+, 24 y 26.

Comprobado en 22.23.4: **175 de 175 pruebas en verde** con el comando nuevo,
exactamente las mismas que con el flag.

El límite: en Node 22.6–22.17 la eliminación de tipos existe pero está detrás
del flag, así que ahí el comando nuevo no funcionaría. `engines` declara 24.x, de
modo que ese rango no es un objetivo del proyecto.

## 4. Dependencias: estado y compatibilidad

```
npm ls --depth=0 → sin conflictos de pares
npm audit        → 4 avisos altos, todos en la cadena @grpc/grpc-js
```

Los cuatro avisos son los ya analizados en
[`seguridad-dependencias.md`](seguridad-dependencias.md): describen el
comportamiento de un **servidor gRPC**, que este proyecto no ejecuta, y
`@firebase/firestore` fija `@grpc/grpc-js` en `~1.9.0`, de modo que forzar la
versión corregida saltaría cuatro series menores por encima de lo declarado. La
decisión sigue siendo **aceptar y vigilar**.

### Versiones mayores disponibles, no aplicadas

| Paquete | Instalado | Último | Por qué no se sube |
|---|---|---|---|
| `next` | 15.5.29 | 16.4.6 | Actualización mayor. Cambiaría el runtime, las cabeceras y el comportamiento del App Router a tres días de la entrega. No autorizada. |
| `typescript` | 5.9.3 | 7.0.2 | Dos mayores. `tsc --noEmit` es hoy la única comprobación estática del proyecto: cambiarla es cambiar el criterio de corrección. |
| `lucide-react` | 0.468.0 | 1.73.0 | Solo iconos. Un mayor renombra exportaciones; el riesgo es romper la interfaz sin ganar nada funcional. |
| `@types/node` | 22.20.5 | 26.6.6 | Debe acompañar al Node que se ejecute. Subirlo a 24.x es coherente con `engines`, pero describiría una API que el equipo local (Node 22) no tiene, y typecheck dejaría de reflejar lo que corre aquí. Súbelo junto con el Node local, en el mismo paso. |

`firebase@13.3.0` y `next@15.5.29` son, a esta fecha, las últimas versiones
publicadas de sus ramas respectivas.

### Dos paquetes extraños en el árbol

`npm ls` marca como `extraneous` a `@emnapi/runtime` y `@img/sharp-wasm32`: son
dependencias opcionales de `sharp` (optimización de imágenes de Next) que
quedaron instaladas sin figurar en `package.json`. No entran en el paquete de
cliente ni afectan al build. `npm ci` las elimina; no se tocó `node_modules`
para no alterar un árbol ya verificado.

## 5. Resumen

- Dos cambios, ambos en `package.json`: `engines` determinista y `test` sin flag
  experimental. Verificados: typecheck limpio, 175/175, build de producción en
  verde.
- Un hueco real y declarado: la verificación corrió en Node 22.23.4, no en el
  Node 24 que el proyecto exige.
- Ninguna actualización mayor aplicada, y ninguna necesaria para desplegar.
