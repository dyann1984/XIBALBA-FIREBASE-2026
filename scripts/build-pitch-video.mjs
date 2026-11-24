import { chromium } from "@playwright/test";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PORT = process.env.DEMO_PORT || "3114";
const BASE_URL = `http://127.0.0.1:${PORT}`;
const OUT_DIR = path.resolve(process.cwd(), "artifacts", "xibalba-2.0");
const WORK_DIR = path.join(OUT_DIR, "pitch-work");

fs.rmSync(WORK_DIR, { recursive: true, force: true });
fs.mkdirSync(WORK_DIR, { recursive: true });

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

const SRT_CONTENT = `1
00:00:00,500 --> 00:00:08,500
Digital scams combine urgency, lookalike bank links, and deceptive phone numbers.

2
00:00:08,800 --> 00:00:18,000
Meet XIBALBÁ 2.0: a Maya-inspired multi-agent AI platform that verifies fraud signals on-device.

3
00:00:18,500 --> 00:00:28,000
From the home screen, users can paste any suspicious message, URL, or phone number immediately.

4
00:00:28,500 --> 00:00:38,000
Let's run a real scam analysis on a fake bank alert requesting urgent verification.

5
00:00:38,500 --> 00:00:52,000
The 3D Holographic Jaguar reacts in real time—shifting from idle to active alert upon detecting threats.

6
00:00:52,500 --> 00:01:06,000
It explains the verdict clearly and supports follow-up questions via text or explicit microphone input.

7
00:01:06,500 --> 00:01:20,000
On the 3D Ceremonial Map, five Maya agents coordinate: CAMAZOTZ, IXBALANQUÉ, VUCUB CAMÉ, HUN CAMÉ, and THE GUARDIAN.

8
00:01:20,500 --> 00:01:34,000
Only agents that actually contributed light up and connect—clicking any figure reveals real execution metrics.

9
00:01:34,500 --> 00:01:48,000
Hybrid AI architecture: deterministic checks run locally first; Firebase AI + Gemini is optional under explicit consent.

10
00:01:48,500 --> 00:02:02,000
Verified facts (A), unverified AI estimates (B), and pending external checks (C) are never mixed. Reports export to MD, JSON, or PDF.

11
00:02:02,500 --> 00:02:14,000
Persistent masked history correlates scam campaigns locally, with full ES/EN support and responsive mobile PWA design.

12
00:02:14,500 --> 00:02:24,000
XIBALBÁ 2.0 — Intelligence that protects you. 3D base model: Google Data Arts Team (CC BY 3.0).
`;

const srtPath = path.join(WORK_DIR, "pitch-en.srt");
fs.writeFileSync(srtPath, SRT_CONTENT, "utf8");

async function recordScene(browser, name, fn) {
  const sceneDir = path.join(WORK_DIR, name);
  fs.mkdirSync(sceneDir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: "es-MX",
    permissions: ["camera", "microphone"],
    recordVideo: { dir: sceneDir, size: { width: 1920, height: 1080 } },
  });
  const page = await context.newPage();
  await fn(page);
  const videoPath = await page.video()?.path();
  await context.close();
  return videoPath;
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

  // Escena 1 (~18s): Portada + Problema + Jaguar 3D en reposo
  const clip1 = await recordScene(browser, "s1", async (page) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(5500);
    await page.evaluate(() => window.scrollBy({ top: 320, behavior: "smooth" }));
    await page.waitForTimeout(4500);
    await page.getByRole("button", { name: /Nuevo análisis|New analysis/i }).click();
    await page.locator(".jaguar-hologram-3d canvas").waitFor({ state: "visible", timeout: 15_000 });
    await page.waitForTimeout(7000);
  });

  // Escena 2 (~20s): Análisis rápido desde inicio
  const clip2 = await recordScene(browser, "s2", async (page) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(4500);
    await page.getByRole("button", { name: /Probar ejemplo de estafa/i }).click();
    await page.waitForTimeout(6500);
    await page.getByRole("button", { name: /Analizar ahora/i }).click();
    await page.locator(".verdict-rojo").waitFor({ state: "visible", timeout: 15_000 });
    await page.waitForTimeout(8000);
  });

  // Escena 3 (~28s): Jaguar 3D reaccionando en ALERTA + pregunta al Guardián
  const clip3 = await recordScene(browser, "s3", async (page) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Probar ejemplo de estafa/i }).click();
    await page.getByRole("button", { name: /Analizar ahora/i }).click();
    await page.locator(".verdict-rojo").waitFor({ state: "visible", timeout: 15_000 });
    await page.locator(".jaguar-hologram-3d canvas").waitFor({ state: "visible", timeout: 15_000 });
    await page.waitForTimeout(10_000);
    await page.locator("#guardian-question").fill("¿Qué evidencia debería revisar primero?");
    await page.waitForTimeout(4500);
    await page.getByRole("button", { name: /Preguntar al guardián/i }).click();
    await page.locator(".guardian-answer").first().waitFor({ state: "visible" });
    await page.waitForTimeout(11_000);
  });

  // Escena 4 (~28s): Mapa interactivo 3D de los 5 dioses y participación real
  const clip4 = await recordScene(browser, "s4", async (page) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Probar ejemplo de estafa/i }).click();
    await page.getByRole("button", { name: /Analizar ahora/i }).click();
    await page.locator(".gods-map-3d canvas").waitFor({ state: "visible", timeout: 15_000 });
    await page.locator(".gods-map-3d").scrollIntoViewIfNeeded();
    await page.waitForTimeout(9000);
    // Rotar suavemente el mapa 3D con el ratón para mostrar el volumen 3D real
    const box = await page.locator(".gods-map-3d canvas").boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 110, box.y + box.height / 2 - 20, { steps: 20 });
      await page.mouse.up();
    }
    await page.waitForTimeout(8000);
    await page.locator(".timeline summary").click();
    await page.waitForTimeout(8500);
  });

  // Escena 5 (~26s): IA híbrida, Semáforo, Evidencias A/B/C y Exportación
  const clip5 = await recordScene(browser, "s5", async (page) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Probar ejemplo de estafa/i }).click();
    await page.getByRole("button", { name: /Analizar ahora/i }).click();
    await page.locator(".verdict-rojo").waitFor({ state: "visible", timeout: 15_000 });
    await page.locator(".verdict-rojo").scrollIntoViewIfNeeded();
    await page.waitForTimeout(8000);
    await page.evaluate(() => window.scrollBy({ top: 450, behavior: "smooth" }));
    await page.waitForTimeout(8000);
    await page.evaluate(() => window.scrollBy({ top: 550, behavior: "smooth" }));
    await page.waitForTimeout(8000);
  });

  // Escena 6 (~24s): Historial, ES/EN, móvil 390px y cierre con atribución 3D
  const clip6 = await recordScene(browser, "s6", async (page) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Probar ejemplo de estafa/i }).click();
    await page.getByRole("button", { name: /Analizar ahora/i }).click();
    await page.locator(".verdict-rojo").waitFor({ state: "visible", timeout: 15_000 });
    await page.getByRole("button", { name: /Historial|History/i }).click();
    await page.waitForTimeout(5500);
    await page.locator("button.language").click();
    await page.waitForTimeout(5500);
    await page.getByRole("button", { name: /Dashboard|Panel principal/i }).click();
    await page.waitForTimeout(5500);
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
    await page.waitForTimeout(5000);
  });

  await browser.close();

  const clips = [clip1, clip2, clip3, clip4, clip5, clip6].filter(Boolean);
  const fadedClips = [];
  for (let i = 0; i < clips.length; i += 1) {
    const out = path.join(WORK_DIR, `faded-${i}.mp4`);
    // Fade-in de 0.5s al inicio de cada clip para transición profesional
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-i",
        clips[i],
        "-vf",
        "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fade=t=in:st=0:d=0.5",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        out,
      ],
      { stdio: "inherit" },
    );
    fadedClips.push(out);
  }

  const listFile = path.join(WORK_DIR, "concat.txt");
  fs.writeFileSync(
    listFile,
    fadedClips.map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n"),
    "utf8",
  );

  const mergedRaw = path.join(WORK_DIR, "merged-raw.mp4");
  execFileSync(
    "ffmpeg",
    ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", mergedRaw],
    { stdio: "inherit" },
  );

  const finalMp4 = path.join(OUT_DIR, "xibalba-2.0-pitch-final.mp4");
  const escapedSrt = srtPath.replace(/\\/g, "/").replace(/:/g, "\\:");
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      mergedRaw,
      "-vf",
      `subtitles='${escapedSrt}':force_style='FontName=Arial,FontSize=11,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&HAA050A0E,BorderStyle=4,Outline=1,Shadow=0,MarginV=16'`,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      finalMp4,
    ],
    { stdio: "inherit" },
  );

  fs.copyFileSync(srtPath, path.join(OUT_DIR, "xibalba-2.0-subtitles-en.srt"));
  fs.rmSync(WORK_DIR, { recursive: true, force: true });
  console.log("PITCH_MP4_GENERATED:", finalMp4);
} finally {
  server.kill("SIGTERM");
}
