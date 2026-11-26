import { test, expect } from "@playwright/test";

// Verifica la CSP real que sirve el servidor, no una copia del código: lee la
// cabecera `Content-Security-Policy` de la respuesta HTTP tal como llega al
// navegador. Tres cosas, exactas, nada más:
//   1. `connect-src` permite `https://www.google.com` — sin este origen,
//      reCAPTCHA Enterprise no puede reportar su propia telemetría
//      (`/recaptcha/enterprise/clr`) y Firebase App Check rechaza el token
//      resultante con 400 (encontrado y corregido en producción el 21 de
//      noviembre de 2026).
//   2. `connect-src` permite `data:` — el propio SDK de Firebase AI Logic
//      convierte cada imagen adjunta con `fetch("data:...;base64,...")` para
//      pasarla al modelo integrado de Chrome; sin `data:` aquí el navegador
//      bloquea esa llamada con "Failed to fetch" y la interpretación de IA
//      queda en "No disponible" (encontrado y corregido el 21 de noviembre
//      de 2026, probando un análisis real con imagen en la Preview).
//   3. `connect-src` permite `blob:` — el detector de texto nativo del
//      navegador (`TextDetector`, OCR sin IA en `lib/analysis/images.ts`)
//      hace `fetch()` sobre la URL de objeto local de la imagen adjunta para
//      leer su bitmap; sin `blob:` aquí esa lectura la bloquea el propio
//      navegador con un error de CSP y el OCR nativo nunca se intenta,
//      aunque el navegador lo ofrezca (encontrado y corregido el 26 de
//      noviembre de 2026, probando un análisis real con imagen en
//      producción mediante `setInputFiles`).
//   4. La política sigue siendo una lista cerrada de orígenes concretos: ni
//      comodín (`*`), ni `'unsafe-eval'` fuera de desarrollo, ni ningún
//      origen fuera de los que el proyecto documenta y necesita.

function directive(csp: string, name: string): string[] {
  const match = csp.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name} `));
  if (!match) return [];
  return match.slice(name.length).trim().split(/\s+/);
}

const EXPECTED_CONNECT_ORIGINS = [
  "'self'",
  "data:",
  "blob:",
  "https://www.google.com",
  "https://firebaseappcheck.googleapis.com",
  "https://content-firebaseappcheck.googleapis.com",
  "https://firebasevertexai.googleapis.com",
  "https://generativelanguage.googleapis.com",
  "https://firestore.googleapis.com",
  "https://firebaseinstallations.googleapis.com",
  "https://identitytoolkit.googleapis.com",
  "https://securetoken.googleapis.com",
  "https://www.googleapis.com",
];

test("CSP: connect-src permite reCAPTCHA Enterprise y sigue siendo una lista cerrada", async ({ request }) => {
  const response = await request.get("/");
  const csp = response.headers()["content-security-policy"];
  expect(csp, "la respuesta debe traer una Content-Security-Policy real").toBeTruthy();

  const connectSrc = directive(csp, "connect-src");
  expect(connectSrc, "connect-src no debe depender de un comodín").not.toContain("*");
  expect(connectSrc).toContain("https://www.google.com");

  // Exactamente los orígenes esperados, ni uno más ni uno menos: un origen
  // nuevo añadido sin querer (o uno retirado sin querer) rompe esta prueba.
  expect(new Set(connectSrc)).toEqual(new Set(EXPECTED_CONNECT_ORIGINS));

  // Ningún destino arbitrario pasaría: la política es un allowlist cerrado,
  // no "connect-src *" ni un origen demasiado amplio como "https://google.com"
  // (sin subdominio) que abriría cualquier servicio de Google, no solo los
  // que este proyecto usa de verdad.
  for (const origin of connectSrc) {
    if (origin === "'self'" || origin === "data:" || origin === "blob:") continue;
    expect(origin.startsWith("https://"), `${origin} debe ser HTTPS explícito`).toBe(true);
  }

  // Las demás directivas relevantes no se debilitaron con este cambio.
  const scriptSrc = directive(csp, "script-src");
  expect(scriptSrc).not.toContain("'unsafe-eval'");
  expect(scriptSrc).toContain("'wasm-unsafe-eval'");
  expect(directive(csp, "object-src")).toContain("'none'");
  expect(directive(csp, "frame-ancestors")).toContain("'none'");
});
