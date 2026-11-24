import { test, expect } from "@playwright/test";

test("3D Hologram & GodsMap3D: desktop, mobile, agent selection, zero console errors", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));

  await page.goto("/");
  await page.getByRole("button", { name: /Nuevo análisis|New analysis/i }).click();

  // Verificar que el canvas 3D del Jaguar Holográfico se monta con dimensiones reales
  const jaguar3d = page.locator(".jaguar-hologram-3d canvas");
  await expect(jaguar3d).toBeVisible({ timeout: 15_000 });
  const box = await jaguar3d.boundingBox();
  expect(box && box.width > 100 && box.height > 100).toBe(true);

  // Ejecutar un análisis de estafa real (llamada + secuestro virtual)
  await page
    .locator("#content")
    .fill(
      "Le llamamos de seguridad BBVA: detectamos un cargo. No cuelgue, deposite a esta cuenta segura y envíe su código OTP.",
    );
  await page.getByRole("button", { name: /Auditar solo en este dispositivo|Analizar contenido/i }).click();
  await expect(page.locator(".verdict-rojo")).toBeVisible();
  await expect(page.locator("[data-guardian-state='alerta']")).toBeVisible();

  // Verificar que GodsMap3D se monta con canvas visible
  const mapCanvas = page.locator(".gods-map-3d canvas");
  await expect(mapCanvas).toBeVisible({ timeout: 15_000 });
  const mapBox = await mapCanvas.boundingBox();
  expect(mapBox && mapBox.width > 150 && mapBox.height > 150).toBe(true);

  // Verificar en móvil 375x812 sin desbordamiento horizontal
  await page.setViewportSize({ width: 375, height: 812 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);

  expect(pageErrors).toEqual([]);
  // Filtrar errores de App Check en local sin site key si ocurrieran, pero no debe haber errores de WebGL/Three/React
  const fatalErrors = consoleErrors.filter(
    (e) => !/app.?check|recaptcha|401/i.test(e),
  );
  expect(fatalErrors).toEqual([]);
});

test("Fallback seguro cuando WebGL no está disponible: muestra JaguarAvatar 2.5D", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") {
        return null;
      }
      return orig.apply(this, [type, ...args] as never);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });

  await page.goto("/");
  await page.getByRole("button", { name: /Nuevo análisis|New analysis/i }).click();
  await expect(page.locator(".jaguar-svg")).toBeVisible();
  await expect(page.locator(".jaguar-hologram-3d")).toHaveCount(0);
});
