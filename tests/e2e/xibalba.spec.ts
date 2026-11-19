import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ARTIFACTS_DIR = path.resolve(process.cwd(), "artifacts", "xibalba-2.0");

// PNG válido de 1x1 píxel para pruebas reales de subida de imagen
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
// WebP lossless mínimo válido de 1x1 píxel
const TINY_WEBP = Buffer.from(
  "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA",
  "base64",
);

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
});

/**
 * El sidebar siempre tiene un botón "Nuevo análisis"; el panel de Historial
 * añade un segundo botón con el mismo texto cuando está vacío. Se ancla al
 * `<nav>` para que el selector no dependa del estado del historial.
 */
function newAnalysisButton(page: import("@playwright/test").Page) {
  return page.getByRole("navigation").getByRole("button", { name: /Nuevo análisis|New analysis/i });
}

/**
 * Igual que arriba: la pantalla principal tiene botones "Ver historial" que
 * también coinciden con /Historial/i. Se ancla al `<nav>`, exacto, para
 * tomar solo el botón de navegación.
 */
function historyNavButton(page: import("@playwright/test").Page) {
  return page.getByRole("navigation").getByRole("button", { name: /^(Historial|History)$/i });
}

/** Genera una imagen PNG en memoria con texto conocido, para medir OCR real. */
async function syntheticTextImage(page: import("@playwright/test").Page, text: string): Promise<Buffer> {
  const base64 = await page.evaluate((value) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 300;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 1000, 300);
    ctx.fillStyle = "#111";
    ctx.font = "bold 32px Arial";
    ctx.fillText(value, 35, 130);
    return canvas.toDataURL("image/png").split(",")[1];
  }, text);
  return Buffer.from(base64, "base64");
}

test("1. Pantalla principal, quick-scan, agentes, análisis de estafa, reportes y capturas desktop", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();

  // Captura 1: Página principal en computadora (español)
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "01-home-desktop.png"), fullPage: true });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "06-ui-spanish.png"), fullPage: false });

  // Verificar los 5 agentes visibles desde inicio y navegables
  await expect(page.locator(".agent-card")).toHaveCount(5);

  // Ir al área de análisis para ver al Jaguar en reposo antes de analizar
  await newAnalysisButton(page).click();
  const jaguar = page.locator("[data-guardian-state]");
  await expect(jaguar).toHaveAttribute("data-guardian-state", "reposo");
  await jaguar.screenshot({ path: path.join(ARTIFACTS_DIR, "03-jaguar-idle.png") });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "02-dashboard-full.png"), fullPage: true });

  // Volver a inicio y probar el Análisis Rápido directo desde la pantalla principal
  await page.getByRole("button", { name: /Panel principal|Dashboard/i }).click();
  await page.getByRole("button", { name: /Probar ejemplo de estafa/i }).click();
  await page.getByRole("button", { name: /Analizar ahora/i }).click();

  // Debe aterrizar en el resultado con semáforo rojo y Jaguar en estado alerta
  await expect(page.locator(".verdict-rojo")).toBeVisible();
  await expect(jaguar).toHaveAttribute("data-guardian-state", "alerta");
  await jaguar.screenshot({ path: path.join(ARTIFACTS_DIR, "04-jaguar-alert.png") });
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, "05-scam-analysis-result.png"),
    fullPage: true,
  });

  // Verificar exportación de reporte (.md y .json)
  const [mdDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Exportar reporte/i }).click(),
  ]);
  expect(mdDownload.suggestedFilename()).toMatch(/^xibalba-report-.*\.md$/);

  const [jsonDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Exportar JSON/i }).click(),
  ]);
  expect(jsonDownload.suggestedFilename()).toMatch(/^xibalba-report-.*\.json$/);

  // Verificar Guardián en modo local: nunca afirma "escuchando" sin micrófono activo
  await expect(page.locator(".mic-live")).toHaveCount(0);
  await page.locator("#guardian-question").fill("¿Qué evidencia debería revisar primero?");
  await page.getByRole("button", { name: /Preguntar al guardián/i }).click();
  await expect(page.locator(".guardian-answer").first()).toBeVisible();
});

test("2. Cambio de idioma ES/EN completo y persistencia", async ({ page }) => {
  await page.goto("/");
  const langBtn = page.locator("button.language");
  await langBtn.click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(page.locator("h1")).toContainText("peace of mind");
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "07-ui-english.png"), fullPage: false });

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
});

test("3. Subida de imágenes PNG y WebP, cámara real simulada, historial persistente y correlación", async ({
  page,
}) => {
  await page.goto("/");
  await newAnalysisButton(page).click();

  // Subir PNG y WebP
  const fileInput = page.locator("#photo");
  await fileInput.setInputFiles([
    { name: "captura.png", mimeType: "image/png", buffer: TINY_PNG },
    { name: "captura.webp", mimeType: "image/webp", buffer: TINY_WEBP },
  ]);
  await expect(page.locator(".thumbs li")).toHaveCount(2);

  // Probar cámara con stream simulado de Chromium
  await page.getByRole("button", { name: /Usar cámara|Use camera/i }).click();
  const video = page.locator(".camera video");
  await expect(video).toBeVisible();
  await expect
    .poll(async () => video.evaluate((el: HTMLVideoElement) => el.videoWidth))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: /^Capturar$|^Capture$/i }).click();
  await expect(page.locator(".thumbs li")).toHaveCount(3);

  // Activar historial persistente, ejecutar dos análisis relacionados y verificar correlación
  await historyNavButton(page).click();
  await page.locator(".history-panel input[type='checkbox']").check();

  await newAnalysisButton(page).click();
  await page.locator("#content").fill(
    "BBVA informa bloqueo de cuenta. Entra a https://bbva-soporte.example.com y llama al +52 55 1234 5678.",
  );
  await page.getByRole("button", { name: /Auditar solo en este dispositivo|Analizar contenido/i }).click();
  await expect(page.locator(".verdict")).toBeVisible();

  // Segundo análisis con mismo dominio para disparar correlación
  await page.locator("#content").fill(
    "Segundo aviso BBVA: verifica tu NIP en https://bbva-soporte.example.com o llama al +52 55 9999 0000.",
  );
  await page.getByRole("button", { name: /Auditar solo en este dispositivo|Analizar contenido/i }).click();
  await expect(page.locator(".correlation-box")).toBeVisible();

  // Recargar y comprobar que el historial persistió en localStorage
  await page.reload();
  await historyNavButton(page).click();
  await expect(page.locator(".history-row")).toHaveCount(2);
});

test("4. Manejo de errores de entrada y endpoint App Check sin token", async ({ page, request }) => {
  await page.goto("/");
  await newAnalysisButton(page).click();
  await page.locator("#kind").selectOption("url");
  await page.locator("#content").fill("no-es-una-url");
  await page.getByRole("button", { name: /Auditar solo en este dispositivo|Analizar contenido/i }).click();
  // `getByRole("alert")` también encuentra el anunciador de rutas oculto que
  // Next.js siempre renderiza (`__next-route-announcer__`); se ancla a la
  // clase propia del aviso de error para no depender de ese detalle interno.
  await expect(page.locator(".error-notice")).toBeVisible();
  await expect(page.locator(".error-notice")).toContainText(/URL completa/);

  // El origen se calcula de la propia página, no se fija a mano: el servidor
  // deriva el origen esperado del encabezado `Host` real de la petición, que
  // cambia según cómo arrancó el servidor de pruebas (127.0.0.1 o localhost).
  const origin = new URL(page.url()).origin;
  const res = await request.post("/api/audit/external", {
    data: { host: "example.com" },
    headers: { "sec-fetch-site": "same-origin", origin },
  });
  // Sin token de App Check, nunca debe pasar la capa anti-CSRF (403) estando
  // en el mismo origen: debe llegar a la autenticación real y fallar ahí
  // (401 credencial ausente, o 503 si el propio servidor no puede verificar).
  expect(res.status()).not.toBe(403);
  expect([401, 503]).toContain(res.status());

  const manifestRes = await request.get("/manifest.webmanifest");
  expect(manifestRes.status()).toBe(200);
  const manifest = await manifestRes.json();
  expect(manifest.short_name).toBe("XIBALBÁ");
});

test("5. Validación responsive en 360px, 390px, 430px, 768px, 1024px y 1440px + capturas móviles", async ({
  page,
}) => {
  const widths = [360, 390, 430, 768, 1024, 1440];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow, `Desbordamiento horizontal en ${width}px`).toBe(false);

    if (width === 390) {
      await page.screenshot({
        path: path.join(ARTIFACTS_DIR, "08-home-mobile-390.png"),
        fullPage: true,
      });
      await page.getByRole("button", { name: /Probar ejemplo de estafa/i }).click();
      await page.getByRole("button", { name: /Analizar ahora/i }).click();
      await expect(page.locator(".verdict-rojo")).toBeVisible();
      await page.screenshot({
        path: path.join(ARTIFACTS_DIR, "09-analysis-mobile-390.png"),
        fullPage: true,
      });
    }
  }
});

test("6. La actividad de los 5 agentes se transmite progresivamente, no solo al terminar", async ({ page }) => {
  await page.goto("/");
  await newAnalysisButton(page).click();
  await page.locator("#content").fill(
    "Paga de inmediato o tu cuenta será bloqueada. Deposita a esta cuenta: https://bbva-seguridad.example.com",
  );
  await page.getByRole("button", { name: /Auditar solo en este dispositivo|Analizar contenido/i }).click();

  // La mesa de 5 agentes se renderiza con estado real, no solo tras terminar.
  await expect(page.locator(".agent-status")).toHaveCount(5);
  await expect(page.locator(".verdict")).toBeVisible();

  // La cronología contiene eventos reales de más de un agente, en más de una
  // fase del ciclo de vida (no solo "completó" al final).
  await page.locator(".timeline summary").click();
  const timelineText = await page.locator(".timeline ol").innerText();
  expect(timelineText).toMatch(/EL GUARDIÁN/);
  expect(/en cola|queued/.test(timelineText) || /inició|started/.test(timelineText)).toBe(true);
  expect(timelineText).toMatch(/completó|completed/);

  // Cada hallazgo mostrado declara qué agente lo atribuyó: no se presenta
  // evidencia sin origen.
  await expect(page.locator(".indicator .chip-agent").first()).toBeVisible();
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "10-agentes-en-vivo.png"), fullPage: true });
});

test("7. OCR con imagen sintética y corrección manual del texto reconocido", async ({ page }) => {
  await page.goto("/");
  await newAnalysisButton(page).click();

  // Imagen con texto benigno: sin ella, el semáforo no debería escalar.
  const benignImage = await syntheticTextImage(page, "Nos vemos el jueves en la cafeteria");
  await page.locator("#photo").setInputFiles({ name: "captura.png", mimeType: "image/png", buffer: benignImage });
  await page.getByRole("button", { name: /Auditar solo en este dispositivo|Analizar contenido/i }).click();
  await expect(page.locator(".ocr-evidence")).toBeVisible();
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "11-ocr-reconocido.png"), fullPage: true });

  // Corrección manual: la persona edita el texto reconocido para añadir lo
  // que el OCR no leyó bien, y vuelve a analizar con su corrección.
  const correction = page.locator("#ocr-correction");
  await expect(correction).toBeVisible();
  await correction.fill("BBVA: tu cuenta sera bloqueada. Envianos el codigo de verificacion ahora.");
  await expect(page.locator(".ocr-edited-badge")).toBeVisible();
  await page.getByRole("button", { name: /Auditar solo en este dispositivo|Analizar contenido/i }).click();

  // El texto corregido a mano, no el original leído por OCR, debe disparar
  // las señales de phishing y escalar el semáforo.
  await expect(page.locator(".verdict-rojo, .verdict-amarillo")).toBeVisible();
  // El contenedor de evidencia completo, no cada tarjeta por separado: basta
  // con que la señal aparezca en alguna.
  await expect(page.locator(".evidence")).toContainText(/amenaza|credencial|código/i);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "12-ocr-corregido.png"), fullPage: true });
});

test("8. Un mensaje limpio sin interpretación de IA queda en gris, nunca en verde", async ({ page }) => {
  // Esta app de pruebas corre sin Firebase/App Check configurados (botón
  // "Auditar solo en este dispositivo"), así que nunca hay interpretación de
  // IA. Por regla (ver tests/phase3.test.mjs), sin IA el semáforo nunca
  // afirma seguridad por sí solo: queda en gris aunque el texto esté limpio.
  await page.goto("/");
  await newAnalysisButton(page).click();
  await page.locator("#content").fill("Hola, nos vemos el jueves en la cafetería de siempre.");
  await page.getByRole("button", { name: /Auditar solo en este dispositivo|Analizar contenido/i }).click();
  await expect(page.locator(".verdict-gris")).toBeVisible();
  await expect(page.locator(".verdict-why")).toContainText(/no se detectaron señales|no hay interpretación/i);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "13-semaforo-gris.png"), fullPage: true });
});

test("9. El laboratorio forense muestra las tres áreas en escritorio y se navega por pestañas en móvil", async ({ page }) => {
  await page.goto("/");
  await newAnalysisButton(page).click();

  // Escritorio: las tres áreas (A, B, C) están presentes a la vez, sin
  // depender de ninguna pestaña.
  await expect(page.locator(".lab-area-evidence")).toBeVisible();
  await expect(page.locator(".lab-area-investigation")).toBeVisible();
  await expect(page.locator(".lab-area-evaluation")).toBeVisible();
  await expect(page.locator(".lab-tabs")).toBeHidden();

  // Móvil: solo una pestaña visible a la vez, y cambiar de pestaña cambia
  // cuál área se ve sin perder las otras dos (siguen montadas, ocultas).
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".lab-tabs")).toBeVisible();
  await expect(page.locator(".lab-area-evidence")).toBeVisible();
  await expect(page.locator(".lab-area-investigation")).toBeHidden();
  await page.getByRole("tab", { name: /B · Investig/i }).click();
  await expect(page.locator(".lab-area-investigation")).toBeVisible();
  await expect(page.locator(".lab-area-evidence")).toBeHidden();
  await page.getByRole("tab", { name: /C · Evalua/i }).click();
  await expect(page.locator(".lab-area-evaluation")).toBeVisible();
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "14-lab-tabs-movil.png"), fullPage: true });
});

test("10. El centro de operaciones de agentes solo conecta a quien de verdad participó", async ({ page }) => {
  await page.goto("/");
  await newAnalysisButton(page).click();
  // Un mensaje sin dinero, llamada ni enlaces: solo IXBALANQUÉ y EL GUARDIÁN
  // deberían participar; CAMAZOTZ, VUCUB CAMÉ y HUN CAMÉ no tienen nada que
  // analizar y el tablero no debe inventarles una conexión.
  await page.locator("#content").fill("Oye, ¿nos vemos mañana para comer? Avísame a qué hora.");
  await page.getByRole("button", { name: /Auditar solo en este dispositivo|Analizar contenido/i }).click();
  await expect(page.locator(".ops-board")).toBeVisible();
  await expect(page.locator(".ops-ixbalanque.ops-active")).toBeVisible();
  await expect(page.locator(".ops-camazotz.ops-inactive")).toBeVisible();
  await expect(page.locator(".ops-vucub.ops-inactive")).toBeVisible();
  await expect(page.locator(".ops-hun.ops-inactive")).toBeVisible();
  // Tantas líneas reales como agentes activos listados, ni una más.
  await expect(page.locator(".ops-link")).toHaveCount(1);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "15-ops-board.png"), fullPage: true });
});

test("11. El historial se puede buscar y filtrar por semáforo", async ({ page }) => {
  await page.goto("/");
  await newAnalysisButton(page).click();
  await page.locator("#content").fill("BBVA: detectamos actividad sospechosa en tu cuenta. Envíanos el código de verificación que te llegó.");
  await page.getByRole("button", { name: /Auditar solo en este dispositivo|Analizar contenido/i }).click();
  await expect(page.locator(".verdict-rojo")).toBeVisible();

  await newAnalysisButton(page).click();
  await page.locator("#content").fill("Hola, nos vemos el jueves en la cafetería de siempre.");
  await page.getByRole("button", { name: /Auditar solo en este dispositivo|Analizar contenido/i }).click();
  await expect(page.locator(".verdict")).toBeVisible();

  await historyNavButton(page).click();
  await expect(page.locator(".history-row")).toHaveCount(2);

  // Filtrar por semáforo rojo deja solo la entrada de riesgo alto.
  await page.getByRole("button", { name: /^RED$|^ROJO$/i }).click();
  await expect(page.locator(".history-row")).toHaveCount(1);
  await expect(page.locator(".history-row")).toContainText(/alto|high/i);

  await page.getByRole("button", { name: /^All$|^Todos$/i }).click();
  await expect(page.locator(".history-row")).toHaveCount(2);

  // Buscar texto que no coincide con ningún caso vacía la lista con un aviso,
  // no con una lista rota.
  await page.locator(".history-search").fill("xyz-no-existe");
  await expect(page.locator(".history-row")).toHaveCount(0);
  await expect(page.getByText(/coincide con este filtro|does not match this filter/i)).toBeVisible();
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "16-historial-filtro.png"), fullPage: true });
});

test("12. El mapa de investigaciones solo conecta casos con un motivo real compartido", async ({ page }) => {
  const mapNavButton = (p: import("@playwright/test").Page) =>
    p.getByRole("navigation").getByRole("button", { name: /Mapa de relaciones|Relationship map/i });

  await page.goto("/");
  // Historial vacío: el mapa debe decirlo, nunca inventar un caso.
  await mapNavButton(page).click();
  await expect(page.getByText(/Todavía no hay investigaciones|No investigations yet/i)).toBeVisible();

  // Dos casos que comparten exactamente el mismo dominio sospechoso: la
  // correlación real (lib/analysis/correlation.ts) debe unirlos con una
  // línea; un tercero sin nada en común debe quedar aislado.
  await newAnalysisButton(page).click();
  await page.locator("#content").fill("Tu paquete está detenido, paga la aduana aquí: http://envios-mx.validacion-paquete.example.com/pagar");
  await page.getByRole("button", { name: /Auditar solo en este dispositivo|Analizar contenido/i }).click();
  await expect(page.locator(".verdict")).toBeVisible();

  await newAnalysisButton(page).click();
  await page.locator("#content").fill("Confirma tu entrega en http://envios-mx.validacion-paquete.example.com/confirmar o se cancelará el envío.");
  await page.getByRole("button", { name: /Auditar solo en este dispositivo|Analizar contenido/i }).click();
  await expect(page.locator(".verdict")).toBeVisible();

  await newAnalysisButton(page).click();
  await page.locator("#content").fill("Hola, ¿comemos el viernes? Avísame la hora.");
  await page.getByRole("button", { name: /Auditar solo en este dispositivo|Analizar contenido/i }).click();
  await expect(page.locator(".verdict")).toBeVisible();

  await mapNavButton(page).click();
  await expect(page.locator(".map-node")).toHaveCount(3);
  // El dominio compartido produce exactamente una línea entre los dos primeros casos.
  await expect(page.locator(".map-edge")).toHaveCount(1);

  // El caso aislado (sin dominio ni patrón compartido) lo dice explícitamente.
  await page.locator(".map-node-isolated").click();
  await expect(
    page.getByText(/Ningún dominio, prefijo telefónico o patrón de fraude compartido|No shared domain, phone prefix or fraud pattern/i),
  ).toBeVisible();

  // Un nodo conectado muestra el motivo real: el dominio compartido.
  await page.locator(".map-node:not(.map-node-isolated)").first().click();
  await expect(page.getByText(/Mismo dominio|Shared domain/i)).toBeVisible();
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "17-mapa-investigaciones.png"), fullPage: true });
});
