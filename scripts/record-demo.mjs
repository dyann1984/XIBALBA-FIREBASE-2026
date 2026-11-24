import { chromium } from "@playwright/test";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PORT = process.env.DEMO_PORT || "3112";
const BASE_URL = `http://127.0.0.1:${PORT}`;
const OUT_DIR = path.resolve(process.cwd(), "artifacts", "xibalba-2.0");
const RAW_DIR = path.join(OUT_DIR, "raw-video");

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(RAW_DIR, { recursive: true });

async function waitForServer(url, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Server did not respond at ${url}`);
}

const server = spawn("npm.cmd", ["run", "start"], {
  env: { ...process.env, PORT },
  stdio: "ignore",
  shell: true,
});

try {
  await waitForServer(BASE_URL);
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: "es-MX",
    permissions: ["camera", "microphone"],
    recordVideo: { dir: RAW_DIR, size: { width: 1920, height: 1080 } },
  });

  const page = await context.newPage();

  // Escena 1: Portada
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT_DIR, "01-home-desktop.png"), fullPage: true });
  await page.screenshot({ path: path.join(OUT_DIR, "06-ui-spanish.png") });

  // Escena 2: Ir a Nuevo análisis -> Jaguar 3D en reposo
  await page.getByRole("button", { name: /Nuevo análisis|New analysis/i }).click();
  await page.locator(".jaguar-hologram-3d canvas").waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(2200);
  await page.locator(".jaguar-frame").screenshot({ path: path.join(OUT_DIR, "03-jaguar-idle.png") });
  await page.screenshot({ path: path.join(OUT_DIR, "02-dashboard-full.png"), fullPage: true });

  // Escena 3 & 4 & 5: Análisis rápido desde inicio -> 5 agentes mapa 3D -> Jaguar en alerta
  await page.getByRole("button", { name: /Panel principal|Dashboard/i }).click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: /Probar ejemplo de estafa/i }).click();
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: /Analizar ahora/i }).click();

  await page.locator(".verdict-rojo").waitFor({ state: "visible", timeout: 15_000 });
  await page.locator(".gods-map-3d canvas").waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(2500);
  await page.locator(".jaguar-frame").screenshot({ path: path.join(OUT_DIR, "04-jaguar-alert.png") });
  await page.screenshot({ path: path.join(OUT_DIR, "05-scam-analysis-result.png"), fullPage: true });

  // Escena 6: Pregunta al guardián + cambio a inglés + historial
  await page.locator("#guardian-question").fill("¿Qué evidencia debería revisar primero?");
  await page.getByRole("button", { name: /Preguntar al guardián/i }).click();
  await page.locator(".guardian-answer").first().waitFor({ state: "visible" });
  await page.waitForTimeout(1800);

  await page.locator("button.language").click();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(OUT_DIR, "07-ui-english.png") });
  await page.locator("button.language").click();

  await page.getByRole("button", { name: /Historial|History/i }).click();
  await page.waitForTimeout(1500);

  // Escena 7: Cierre
  await page.getByRole("button", { name: /Panel principal|Dashboard/i }).click();
  await page.waitForTimeout(1500);

  const videoPath = await page.video()?.path();
  await context.close();
  await browser.close();

  if (videoPath && fs.existsSync(videoPath)) {
    const mp4Out = path.join(OUT_DIR, "xibalba-2.0-demo.mp4");
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-i",
        videoPath,
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-preset",
        "medium",
        "-crf",
        "20",
        "-movflags",
        "+faststart",
        mp4Out,
      ],
      { stdio: "inherit" },
    );
    fs.rmSync(RAW_DIR, { recursive: true, force: true });
    console.log("MP4_GENERATED:", mp4Out);
  }
} finally {
  server.kill("SIGTERM");
}
