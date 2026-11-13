# Seguridad de dependencias

Revisión: 13 de noviembre de 2026 · `npm audit` pasó de **6 a 4** avisos.

## Resumen

Los 6 avisos iniciales procedían de **solo dos paquetes transitivos reales**;
los otros cuatro eran sus dependientes arrastrados en el informe.

| Paquete real | Instalado | Corregido en | Llega por | Estado |
|---|---|---|---|---|
| `postcss` | 8.4.31 | ≥ 8.5.23 | `next@15.5.29` (fijado exacto) | **Resuelto** con `overrides` → 8.5.32 |
| `@grpc/grpc-js` | 1.9.16 | ≥ 1.13.6 | `@firebase/firestore@4.20.0` ← `firebase@13.3.0` | **Aceptado con justificación** |

## Por qué no se aplicó `npm audit fix`

`npm audit fix --force` proponía:

- `firebase@13.3.0 → 9.14.0`: un **retroceso de cuatro versiones mayores**.
  Firebase AI Logic (`firebase/ai`, `getAI`, `InferenceMode`) no existe en la
  rama 9.x. Destruiría el producto.
- `next@15.5.29 → 16.4.6`: **actualización mayor**, no autorizada.

Ambas sugerencias se descartaron. `firebase@13.3.0` y `next@15.5.29` son, a
esta fecha, **las últimas versiones publicadas** de sus ramas: no existe
ninguna corrección aguas arriba que aplicar.

## postcss — resuelto

`next@15.5.29` fija `postcss` en la versión exacta `8.4.31`, que acumula cuatro
avisos de lectura arbitraria de archivos `.map` mediante `sourceMappingURL`
controlado por el atacante, más un XSS en la serialización de CSS.

Corregido con `overrides` en `package.json`:

```json
"overrides": { "postcss": "^8.5.32" }
```

8.5.x es la **misma versión mayor**: no es una actualización mayor y no toca
ninguna dependencia directa. Verificado tras el cambio: `typecheck`, `build` y
las 32 pruebas en verde, con tamaños de paquete idénticos (`/` sigue en 330 kB
de First Load JS).

Resultado: desaparecen el aviso alto de `postcss` y el moderado de `next`.

## @grpc/grpc-js — riesgo aceptado, con fundamento

No se fuerza, por dos motivos:

1. **La restricción impide hacerlo con seguridad.** `@firebase/firestore@4.20.0`
   declara `"@grpc/grpc-js": "~1.9.0"`: solo acepta la serie 1.9.x. La versión
   corregida es 1.13.6+ (hoy 1.14.7). Un `override` saltaría cuatro series
   menores por encima de lo que el paquete declara soportar, sin ninguna
   garantía de compatibilidad, en la ruta de datos de Firestore.

2. **Los avisos no son explotables en este proyecto.** Se verificó que
   `@grpc/grpc-js` **no aparece en ninguna salida compilada**, ni de cliente ni
   de servidor: la compilación de Firestore para navegador usa
   `@firebase/webchannel-wrapper` (WebChannel sobre HTTP), no gRPC. Además,
   ambos avisos describen comportamiento de un **servidor gRPC**:

   - `GHSA-m9gg-hp2v-232j` (alto): `getAuthContext` puede dar por autorizados
     certificados que no lo están — afecta a la validación de clientes mTLS en
     un servidor.
   - `GHSA-f596-whhp-79r4` (bajo): un servidor transmite al cliente mensajes de
     error lanzados por sus manejadores.

   Este proyecto **no ejecuta ningún servidor gRPC**. El paquete es peso muerto
   en `node_modules`.

**Seguimiento:** revisar en cada actualización de `firebase` si relajan el
rango `~1.9.0`. En cuanto lo hagan, el aviso desaparece sin intervención.

## Observación adicional: Firestore se envía al cliente sin usarse

`lib/firebase.ts` importa `getFirestore` y lo devuelve en `createServices()`,
pero **ningún componente consume `services.firestore`**. Se comprobó que el SDK
de Firestore sí entra en el paquete de cliente.

Quitar ese import eliminaría el SDK de Firestore del navegador: menos peso
descargado y menos superficie de ataque. No se ha hecho porque parece
preparación deliberada para el historial persistente previsto. **Decisión
pendiente del responsable del proyecto.** (No elimina el aviso de `npm audit`,
que mira el árbol de dependencias, no los imports.)

## Estado final

```
npm audit → 4 vulnerabilidades (4 altas, 0 moderadas, 0 bajas)
            todas en la cadena @grpc/grpc-js, no alcanzable en ejecución
```

Para actuar sobre las 4 restantes haría falta autorización para subir `firebase`
de versión mayor cuando exista una que relaje el rango, o aceptar el riesgo
documentado aquí. Recomendación: **aceptar y vigilar**.
