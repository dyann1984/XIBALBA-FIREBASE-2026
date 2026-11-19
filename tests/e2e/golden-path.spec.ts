import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ARTIFACTS_DIR = path.resolve(process.cwd(), "artifacts", "xibalba-3-phase5.3");

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
});

/**
 * CAMINO DORADO INTEGRAL — de extremo a extremo, para la demo de hackathon.
 *
 * QUÉ ES REAL AQUÍ (nada se simula ni se mockea):
 *  - El motor de análisis determinista (`lib/analysis/*`) corre de verdad en
 *    el navegador sobre el texto introducido: no hay `page.route` ni
 *    respuesta fabricada.
 *  - Los 5 agentes (`lib/analysis/coordinator.ts`) se ejecutan de verdad y
 *    el tablero de operaciones refleja su participación real.
 *  - El historial se escribe de verdad en `localStorage` del navegador de
 *    Playwright y se relee tras un `reload()` real.
 *  - El mapa de investigaciones corre la misma correlación real sobre ese
 *    historial.
 *  - El Guardián (`Guardian.tsx`) construye su explicación a partir de la
 *    evidencia real devuelta por el motor, no de un guion fijo.
 *
 * QUÉ NO CUBRE ESTA PRUEBA (limitación real del entorno, no ocultada):
 *  - La síntesis de voz (TTS) y el reconocimiento de voz (STT) dependen de
 *    `window.speechSynthesis` / `SpeechRecognition`, APIs que Chromium bajo
 *    Playwright expone pero sin hardware de audio real: se comprueba que los
 *    controles existen y reaccionan (aria-pressed, estado del Guardián),
 *    nunca que un altavoz físico sonó.
 *  - La interpretación de IA en la nube (Firebase + Gemini) queda fuera de
 *    este archivo a propósito: ver `tests/e2e/cloud-ai.spec.ts`, que sí la
 *    ejercita contra servicios reales y está separado porque depende de red
 *    y cuota, no es determinista por diseño.
 */
test("Camino dorado: inicio → Guardián → mensaje fraudulento → agentes → veredicto → explicación → historial → mapa → idioma → persistencia", async ({
  page,
}) => {
  // 1. Inicio de la aplicación.
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/tranquilidad|peace of mind/i);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "01-inicio.png"), fullPage: true });

  // 2. El Guardián se presenta: en reposo, sin micrófono activo, visible desde "Nuevo análisis".
  await page.getByRole("navigation").getByRole("button", { name: /Nuevo análisis|New analysis/i }).click();
  const jaguar = page.locator(".jaguar");
  await expect(jaguar).toHaveAttribute("data-guardian-state", "reposo");
  await expect(page.getByText(/explicará el resultado|will explain the result/i).first()).toBeVisible();

  // 3. Introduce un mensaje sospechoso real (texto de demostración, declarado
  // como tal en la propia interfaz; no hay datos de una persona real).
  const fraudText =
    "BANORTE: Detectamos un cargo no reconocido de $8,450. Si no reconoces el cargo, verifica tu cuenta en las próximas 2 horas en https://banorte-mx.verificacion-segura.example.com o será bloqueada.";
  await page.locator("#content").fill(fraudText);

  // 4-5. Ejecución real del motor + respuesta real de los agentes (auditoría
  // local, sin consentimiento de IA: es el camino que SIEMPRE es real, con o
  // sin servicios configurados).
  await page.getByRole("button", { name: /Auditar solo en este dispositivo|Analizar contenido/i }).click();
  await expect(page.locator(".ops-board")).toBeVisible();
  // Al menos un especialista además de EL GUARDIÁN participó de verdad.
  await expect(page.locator(".ops-node.ops-active")).not.toHaveCount(0);

  // 6. Clasificación de riesgo con evidencias reales y verificables.
  await expect(page.locator(".verdict-rojo")).toBeVisible();
  await expect(page.locator(".indicator").first()).toBeVisible();
  await expect(page.getByText(/Amenaza de bloqueo|Account block/i).first()).toBeVisible();
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "02-veredicto-rojo.png"), fullPage: true });

  // 7. El Guardián explica el resultado con el estado visual correcto
  // (alerta, no una animación de relleno) y un texto derivado del veredicto.
  await expect(jaguar).toHaveAttribute("data-guardian-state", "alerta");
  await expect(page.getByText(/riesgo alto|high risk/i).first()).toBeVisible();
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "03-guardian-alerta.png"), fullPage: true });

  // 8. Guarda la investigación: activa el permiso explícito de historial
  // ANTES del siguiente análisis para que esta entrada quede persistida.
  await page.getByRole("navigation").getByRole("button", { name: /^(Historial|History)$/i }).click();
  await page.locator(".history-panel input[type='checkbox']").check();
  await page.getByRole("navigation").getByRole("button", { name: /Nuevo análisis|New analysis/i }).click();
  await page.locator("#content").fill(fraudText);
  await page.getByRole("button", { name: /Auditar solo en este dispositivo|Analizar contenido/i }).click();
  await expect(page.locator(".verdict-rojo")).toBeVisible();

  // Dos análisis en esta sesión: el primero (antes de activar el permiso) y
  // el segundo (con el permiso activo). Ambos viven en el historial de la
  // pestaña; solo activar el permiso decide si sobreviven a un `reload()`.
  await page.getByRole("navigation").getByRole("button", { name: /^(Historial|History)$/i }).click();
  await expect(page.locator(".history-row")).toHaveCount(2);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "04-historial.png"), fullPage: true });

  // 9. Los casos aparecen en el mapa de relaciones (mismo historial real).
  await page.getByRole("navigation").getByRole("button", { name: /Mapa de relaciones|Relationship map/i }).click();
  await expect(page.locator(".map-node")).toHaveCount(2);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "05-mapa.png"), fullPage: true });

  // 10. Cambia de español a inglés: toda la pantalla actual se traduce, no
  // solo la navegación.
  await page.locator("button.language").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(page.getByText(/Relationships between cases|Investigation map/i).first()).toBeVisible();
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "06-mapa-ingles.png"), fullPage: true });

  // 11. Persistencia al recargar: idioma e historial sobreviven un `reload()`
  // real del navegador, no una navegación simulada.
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await page.getByRole("navigation").getByRole("button", { name: /^(History|Historial)$/i }).click();
  await expect(page.locator(".history-row")).toHaveCount(2);
});
