import { test, expect } from "@playwright/test";

test("RC Fase 9 — Casos de control: legítimo, sospechoso, fraude evidente, offline y permiso de micrófono denegado", async ({ page, context }) => {
  await page.addInitScript(() => {
    class DeniedSpeechRecognition {
      lang = "es-MX";
      interimResults = true;
      continuous = false;
      maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        setTimeout(() => {
          this.onerror?.({ error: "not-allowed" });
          this.onend?.();
        }, 40);
      }
      stop() { this.onend?.(); }
      abort() { this.onend?.(); }
    }
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = DeniedSpeechRecognition;
  });

  await page.goto("/");
  await page.getByRole("navigation").getByRole("button", { name: /Nuevo análisis/i }).click();

  // 1. Mensaje legítimo (sin IA => gris, nunca verde por sí solo)
  await page.locator("#content").fill("Hola, confirmo nuestra reunión del martes a las 11 en la oficina.");
  await page.getByRole("button", { name: /Auditar solo en este dispositivo/i }).click();
  await expect(page.locator(".verdict-gris")).toBeVisible();

  // 2. Mensaje sospechoso (amarillo / precaución)
  await page.locator("#content").fill("Confirma tu entrega hoy en http://envios-mx.validacion-paquete.example.com/confirmar");
  await page.getByRole("button", { name: /Auditar solo en este dispositivo/i }).click();
  await expect(page.locator(".verdict-amarillo, .verdict-rojo").first()).toBeVisible();

  // 3. Fraude evidente (rojo / riesgo alto)
  await page.locator(".demo-chip").first().click();
  await page.getByRole("button", { name: /Auditar solo en este dispositivo/i }).click();
  await expect(page.locator(".verdict-rojo")).toBeVisible();

  // 4. Permiso de micrófono denegado -> muestra aviso claro y mantiene alternativa de texto
  await page.getByRole("button", { name: /Dictar pregunta/i }).click();
  await expect(page.locator(".lab-jaguar [role='alert']")).toBeVisible();
  await page.locator("#guardian-question").fill("¿Qué señal reviso primero?");
  await page.getByRole("button", { name: /Preguntar al guardián/i }).click();
  await expect(page.locator(".guardian-answer").first()).toBeVisible();

  // 5. Pérdida de conexión (offline) -> auditoría local sigue funcionando sin fallos
  await context.setOffline(true);
  await page.locator("#content").fill("URGENTE: tu cuenta será bloqueada en 1 hora, ingresa tu NIP en https://bbva-alerta.example.com/acceso");
  await page.getByRole("button", { name: /Auditar solo en este dispositivo/i }).click();
  await expect(page.locator(".verdict-rojo")).toBeVisible();
  await context.setOffline(false);

  // 6. Cambio de idioma ES -> EN mantiene resultado traducido
  await page.locator("button.language").click();
  await expect(page.locator(".verdict-rojo")).toContainText(/RED|HIGH/i);
});
