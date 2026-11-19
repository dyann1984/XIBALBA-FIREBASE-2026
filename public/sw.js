// Service worker minimo de XIBALBA: cachea el cascaron estatico de la app
// (shell) para que el navegador pueda ofrecer "Instalar app" en Android/iOS
// y para que una recarga sin red siga mostrando la interfaz. No cachea
// nunca /api/*: los analisis siempre deben ir a la red o fallar de forma
// explicita, jamas servir una respuesta vieja de fraude.
//
// Estrategia por tipo de recurso, no uniforme:
//   - Documentos (navegacion) y cualquier ruta sin hash en el nombre: RED
//     PRIMERO. Si la cache fuera prioritaria aqui, una recarga en linea
//     podria servir un HTML viejo que referencia archivos de un build
//     anterior (hash distinto) que el servidor ya no tiene -> 404 real,
//     visto en esta sesion con dos builds seguidos. Sin red, se usa la
//     copia guardada como ultimo recurso.
//   - `/_next/static/*` (Next.js nombra cada archivo con un hash de su
//     contenido: la URL cambia si el contenido cambia): CACHE PRIMERO. Es
//     seguro cachearlos de forma agresiva porque nunca pueden quedar
//     obsoletos bajo la misma URL.
const CACHE_NAME = "xibalba-shell-v2";
const SHELL_ASSETS = ["/", "/xibalba-logo.jpg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isImmutableAsset(pathname) {
  return pathname.startsWith("/_next/static/");
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error("offline-sin-copia-local");
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    isImmutableAsset(url.pathname) ? cacheFirst(request) : networkFirst(request),
  );
});
