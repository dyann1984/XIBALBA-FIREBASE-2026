# Historial de análisis

Fecha: 14 de noviembre de 2026. Implementación: `lib/history.ts` y la sección
«Historial» de `components/Dashboard.tsx`.

Hasta la fase anterior no había historial y la interfaz lo decía: «el
almacenamiento privado está pendiente». Ya existe, con una decisión de diseño
que conviene explicar antes que el código.

## 1. Se guarda el resultado, no el contenido

Guardar lo que una persona pega en una herramienta antifraude es guardar
exactamente lo que un atacante querría: cuentas, nombres, importes, capturas de
conversaciones. Por eso el historial conserva el **veredicto** y lo mínimo para
reconocer de qué análisis se trata:

| Campo | Ejemplo |
|---|---|
| `at` | `2026-11-14T19:03:01.948Z` |
| `kind` | `transcripcion` |
| `light` / `riskLevel` / `confidence` | `rojo` / `alto` / `alta` |
| `agents` | `["camazotz","vucub"]` |
| `signals` | `8` |
| `topSignals` | las tres principales, solo el nombre |
| `checksRun` / `checksTotal` | `46` / `50` |
| `preview` | fragmento saneado, 90 caracteres como máximo |
| `source` | ruta de ejecución informada por el SDK, o `null` |
| `hadAttachments` | `true` si hubo adjuntos; **ningún archivo se guarda** |

### El saneado del fragmento

`maskSensitive` se aplica antes de guardar y **otra vez al escribir**, porque el
almacenamiento es la última puerta y preferimos enmascarar dos veces a confiar
en que quien llama lo hizo:

- toda corrida de 4 o más dígitos, con sus separadores reales (espacios,
  guiones, puntos, comas, barras) → `••••`. Eso cubre una CLABE, una tarjeta, un
  NIP, un código de un solo uso y un importe. Es más agresivo que el enmascarado
  de las evidencias (12 dígitos o más), a propósito;
- un correo se reduce a su dominio: `…@ejemplo.test`;
- las direcciones con forma de monedero se recortan;
- se colapsan los espacios y se corta a 90 caracteres.

Un número de dos o tres dígitos («a las 10», «3 de 4») no se toca: no identifica
nada y borrarlo dejaría el fragmento ilegible.

## 2. Dónde vive

1. **En memoria**, mientras la pestaña está abierta. Es el comportamiento por
   defecto y no requiere ninguna casilla.
2. **En `localStorage` del propio navegador**, solo si la persona marca la
   casilla «Guardar el historial en este navegador». Al desmarcarla se borra lo
   guardado, en el acto.

Nada de esto viaja por la red. Ni a Firestore, ni al endpoint, ni al modelo.

`localStorage` puede no existir o lanzar (modo privado, permisos denegados):
todas las funciones del módulo lo toleran y devuelven una lista vacía en lugar
de romper la interfaz. Lo que se lee de ahí es **dato no confiable** —pudo
quedar de una versión anterior o escribirlo otra cosa—, así que cada entrada se
valida contra `isEntry` y la que no cuadra se descarta en silencio.

## 3. Límite

20 análisis (`HISTORY_LIMIT`). Al superarlo se descarta el más antiguo. El
límite está en el módulo, no en la interfaz, y `save` vuelve a aplicarlo.

## 4. Lo que falta: historial en la nube por usuario

**No está implementado.** Requiere Firebase Authentication, que este proyecto
todavía no usa: no hay inicio de sesión, no hay identidad y, por tanto, no hay a
quién atribuir un documento. Mientras eso siga así, `firestore.rules` deniega
todo acceso y esa es la regla correcta: ningún código escribe en Firestore.

Cuando se implemente, el diseño previsto es el siguiente.

**Modelo de datos.** Un documento por análisis bajo el usuario que lo hizo, para
que la regla de acceso sea una comparación de identidad y no un filtro de
consulta:

```
/usuarios/{uid}/analisis/{analisisId}
  at: timestamp
  kind: string
  light: 'verde' | 'amarillo' | 'rojo' | 'gris'
  riskLevel: string
  confidence: string
  signals: number
  topSignals: string[]   (máximo 3)
  checksRun / checksTotal: number
  preview: string        (saneado, ≤ 90 caracteres)
```

Sin `preview` sin sanear, sin imágenes, sin audio y sin el texto completo: lo
mismo que guarda hoy el historial local.

**Reglas propuestas** (no activas; se incorporarán cuando exista Authentication
y código que escriba):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /usuarios/{uid}/analisis/{analisisId} {
      allow read, delete: if request.auth != null && request.auth.uid == uid;
      allow create: if request.auth != null
        && request.auth.uid == uid
        && request.resource.data.keys().hasOnly([
             'at','kind','light','riskLevel','confidence',
             'signals','topSignals','checksRun','checksTotal','preview'
           ])
        && request.resource.data.light in ['verde','amarillo','rojo','gris']
        && request.resource.data.preview is string
        && request.resource.data.preview.size() <= 90
        && request.resource.data.topSignals.size() <= 3;
      allow update: if false;   // un análisis no se corrige: se vuelve a hacer
    }
    match /{document=**} { allow read, write: if false; }
  }
}
```

Tres decisiones que conviene no perder:

1. **`allow update: if false`.** Un veredicto es un hecho fechado. Si algo
   cambia, se ejecuta otro análisis.
2. **Lista cerrada de campos** (`hasOnly`) y límite de tamaño del fragmento. Sin
   esto, un cliente modificado podría usar el historial como almacenamiento
   arbitrario a costa del proyecto.
3. **Borrado por el dueño.** Quien puede leer su historial tiene que poder
   borrarlo.

Falta además decidir la **retención** (caducidad automática de los documentos) y
dejar escrito que el borrado en el cliente no elimina las copias de seguridad
del proveedor.
