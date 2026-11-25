import { test, expect } from "@playwright/test";
import path from "node:path";

const AUDIT_SHOTS = path.join(process.cwd(), "artifacts", "audit-final");

test("Cambio de idioma ES/EN después de analizar actualiza veredicto, evidencias y Guardián", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation").getByRole("button", { name: /Nuevo análisis|New analysis/i }).click();
  await page.locator(".demo-chip").first().click();
  await page.getByRole("button", { name: /Auditar solo en este dispositivo|Analizar contenido/i }).click();
  await expect(page.locator(".verdict-rojo")).toBeVisible();
  await expect(page.locator(".evidence")).toContainText(/urgencia|bloqueo|dominio/i);

  // Cambio a inglés después del análisis
  await page.locator("button.language").click();
  await expect(page.locator(".verdict-rojo")).toContainText(/RED|HIGH/i);
  await expect(page.locator(".evidence")).toContainText(/urgency|block|domain/i);

  // Regreso a español
  await page.locator("button.language").click();
  await expect(page.locator(".verdict-rojo")).toContainText(/ROJO|ALTO/i);
});

test("Micrófono, voz TTS y preguntas al Guardián funcionan con cambio de idioma", async ({ page }) => {
  await page.addInitScript(() => {
    const spokenCalls: Array<{ text: string; lang: string }> = [];
    (window as unknown as { __spokenCalls?: typeof spokenCalls }).__spokenCalls = spokenCalls;

    class FakeSpeechRecognition {
      lang = "es-MX";
      interimResults = true;
      continuous = false;
      maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        setTimeout(() => {
          this.onresult?.({
            results: [[{ transcript: "¿Qué señal reviso primero?" }]],
          });
        }, 60);
      }
      stop() {
        this.onend?.();
      }
      abort() {
        this.onend?.();
      }
    }

    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = FakeSpeechRecognition;

    const fakeSynth = {
      getVoices: () => [
        { lang: "es-MX", name: "ES-MX Test" },
        { lang: "en-US", name: "EN-US Test" },
      ],
      speak: (utterance: { text: string; lang: string; onstart?: () => void; onend?: () => void }) => {
        spokenCalls.push({ text: utterance.text, lang: utterance.lang });
        utterance.onstart?.();
        setTimeout(() => utterance.onend?.(), 30);
      },
      cancel: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    Object.defineProperty(window, "speechSynthesis", {
      value: fakeSynth,
      configurable: true,
    });
    (window as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance = class {
      text: string;
      lang = "";
      voice: unknown = null;
      rate = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    };
  });

  await page.goto("/");
  await page.getByRole("navigation").getByRole("button", { name: /Nuevo análisis/i }).click();
  await page.locator(".demo-chip").first().click();
  await page.getByRole("button", { name: /Auditar solo en este dispositivo/i }).click();
  await expect(page.locator(".verdict-rojo")).toBeVisible();

  // Activar voz TTS del Guardián
  await page.getByRole("button", { name: /Activar voz|Turn on voice/i }).click();
  await page.getByRole("button", { name: /Escuchar explicación|Hear the explanation/i }).click();

  // Probar micrófono -> transcribe pregunta -> preguntar al Guardián
  await page.getByRole("button", { name: /Dictar pregunta|Dictate a question/i }).click();
  await expect(page.locator("#guardian-question")).toHaveValue(/primero/i);
  await page.getByRole("button", { name: /Dejar de escuchar|Stop listening/i }).click();
  await page.getByRole("button", { name: /Preguntar al guardián|Ask the guardian/i }).click();
  await expect(page.locator(".guardian-answer").first()).toBeVisible();

  const callsEs = await page.evaluate(
    () => (window as unknown as { __spokenCalls?: Array<{ text: string; lang: string }> }).__spokenCalls ?? [],
  );
  expect(callsEs.length).toBeGreaterThanOrEqual(2);
  expect(callsEs.some((c) => c.lang.startsWith("es"))).toBe(true);

  // Cambiar a inglés y volver a escuchar
  await page.locator("button.language").click();
  await page.getByRole("button", { name: /Hear the explanation/i }).click();
  const callsEn = await page.evaluate(
    () => (window as unknown as { __spokenCalls?: Array<{ text: string; lang: string }> }).__spokenCalls ?? [],
  );
  expect(callsEn.some((c) => c.lang.startsWith("en"))).toBe(true);
});

test("SOS XIBALBÁ, QR Defense, XIBALBÁ Academy y PWA Share Target manifest", async ({ page, request }) => {
  const manifestRes = await request.get("/manifest.webmanifest");
  expect(manifestRes.ok()).toBe(true);
  const manifest = await manifestRes.json();
  expect(manifest.share_target?.action).toBe("/");
  expect(manifest.share_target?.params?.url).toBe("share_url");

  const swRes = await request.get("/sw.js");
  expect(swRes.ok()).toBe(true);

  await page.goto("/");
  // QR Defense
  await page.getByRole("navigation").getByRole("button", { name: /Nuevo análisis/i }).click();
  await page.locator("#qr-payload-input").fill("https://bbva-mx.validacion-de-cuenta.example.com/acceso");
  await page.getByRole("button", { name: /Inspeccionar QR|Inspect QR/i }).click();
  await expect(page.locator(".qr-result")).toContainText(/alto|high/i);
  await page.getByRole("button", { name: /HUN CAMÉ/i }).click();
  await expect(page.locator("#content")).toHaveValue(/bbva-mx\.validacion-de-cuenta\.example\.com/);

  // SOS XIBALBÁ
  await page.getByRole("navigation").getByRole("button", { name: /Escudo Global|Global Shield/i }).click();
  await expect(page.locator(".sos-panel")).toBeVisible();
  await page.locator(".sos-step input[type='checkbox']").first().check();
  await expect(page.locator(".sos-progress")).toContainText("1/4");

  // XIBALBÁ Academy: rutas diferenciadas y persistencia al cambiar idioma
  await page.getByRole("navigation").getByRole("button", { name: /Academia|Academy/i }).click();
  await expect(page.locator(".academy-card").first()).toBeVisible();
  await page.locator(".academy-card button", { hasText: /Marcar completada|Mark complete/i }).first().click();
  await expect(page.locator("body")).toContainText(/10 XP/);
  await page.locator("button.language").click();
  await expect(page.locator("body")).toContainText(/10 XP/);
  await page.locator("button.language").click();
  await page.locator(".academy-opt").nth(1).click();
  await expect(page.locator(".academy-panel")).toContainText(/registrable|example\.com/i);
});

test("Capturas reales ES/EN en escritorio (1440px) y móvil (390px)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.screenshot({ path: path.join(AUDIT_SHOTS, "01-home-es-desktop.png"), fullPage: true });

  await page.locator("button.language").click();
  await page.screenshot({ path: path.join(AUDIT_SHOTS, "02-home-en-desktop.png"), fullPage: true });

  await page.locator("button.language").click();
  await page.getByRole("navigation").getByRole("button", { name: /Nuevo análisis/i }).click();
  await page.locator(".demo-chip").first().click();
  await page.getByRole("button", { name: /Auditar solo en este dispositivo/i }).click();
  await expect(page.locator(".verdict-rojo")).toBeVisible();
  await page.screenshot({ path: path.join(AUDIT_SHOTS, "03-lab-red-es-desktop.png"), fullPage: true });

  await page.locator("button.language").click();
  await page.screenshot({ path: path.join(AUDIT_SHOTS, "04-lab-red-en-desktop.png"), fullPage: true });

  await page.locator("button.language").click();
  await page.getByRole("navigation").getByRole("button", { name: /Escudo Global/i }).click();
  await page.screenshot({ path: path.join(AUDIT_SHOTS, "05-escudo-sos-es-desktop.png"), fullPage: true });

  await page.getByRole("navigation").getByRole("button", { name: /Academia/i }).click();
  await page.screenshot({ path: path.join(AUDIT_SHOTS, "06-academy-es-desktop.png"), fullPage: true });

  await page.locator("button.language").click();
  await page.screenshot({ path: path.join(AUDIT_SHOTS, "07-academy-en-desktop.png"), fullPage: true });

  // Móvil 390px
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("button.language").click();
  await page.locator("button.menu-button").click();
  await page.getByRole("navigation").getByRole("button", { name: /Panel principal/i }).click();
  await page.screenshot({ path: path.join(AUDIT_SHOTS, "08-home-es-mobile.png"), fullPage: true });

  await page.locator("button.language").click();
  await page.locator("button.menu-button").click();
  await page.getByRole("navigation").getByRole("button", { name: /New analysis/i }).click();
  await page.screenshot({ path: path.join(AUDIT_SHOTS, "09-lab-en-mobile.png"), fullPage: true });
});

test("Descarga real de reportes (MD, JSON, PDF) y diploma PDF de XIBALBÁ Academy", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation").getByRole("button", { name: /Nuevo análisis/i }).click();
  await page.locator(".demo-chip").first().click();
  await page.getByRole("button", { name: /Auditar solo en este dispositivo/i }).click();
  await expect(page.locator(".verdict-rojo")).toBeVisible();

  const [mdDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Exportar reporte \(.md\)|Export report \(.md\)/i }).click(),
  ]);
  expect(mdDownload.suggestedFilename()).toMatch(/xibalba-report-.*\.md$/);

  const [jsonDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Exportar JSON|Export JSON/i }).click(),
  ]);
  expect(jsonDownload.suggestedFilename()).toMatch(/xibalba-report-.*\.json$/);

  const [pdfDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Exportar PDF|Export PDF/i }).click(),
  ]);
  expect(pdfDownload.suggestedFilename()).toMatch(/xibalba-report-.*\.pdf$/);

  // Diploma PDF de XIBALBÁ Academy
  await page.getByRole("navigation").getByRole("button", { name: /Academia/i }).click();
  const completeButtons = page.locator(".academy-card button", { hasText: /Marcar completada|Mark complete/i });
  const count = await completeButtons.count();
  for (let i = 0; i < count; i++) {
    await completeButtons.first().click();
  }
  await page.locator(".academy-panel").first().locator(".academy-opt").nth(1).click();
  // Responder todas las preguntas del quiz
  const quizCards = page.locator(".academy-panel .academy-card");
  const quizCount = await quizCards.count();
  for (let i = 0; i < quizCount; i++) {
    await quizCards.nth(i).locator(".academy-opt").nth(1).click();
  }
  const [diplomaDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Descargar diploma|Download participation diploma/i }).click(),
  ]);
  expect(diplomaDownload.suggestedFilename()).toBe("xibalba-academy.pdf");
});
