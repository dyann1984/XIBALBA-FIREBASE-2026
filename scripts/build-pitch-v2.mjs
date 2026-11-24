import { chromium } from "@playwright/test";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PORT = process.env.DEMO_PORT || "3115";
const BASE_URL = `http://127.0.0.1:${PORT}`;
const OUT_DIR = path.resolve(process.cwd(), "artifacts", "xibalba-2.0");
const WORK_DIR = path.join(OUT_DIR, "pitch-v2-work");
const LOGO_PATH = path.resolve(process.cwd(), "public", "xibalba-logo.jpg");

// Limpiar archivo temporal de prueba si existe
fs.rmSync(path.join(OUT_DIR, "test-voice.wav"), { force: true });
fs.rmSync(WORK_DIR, { recursive: true, force: true });
fs.mkdirSync(WORK_DIR, { recursive: true });

const SCENES = [
  {
    id: "s1_intro",
    narration:
      "Cada día, miles de personas caen en estafas por mensajes falsos, enlaces clonados y llamadas urgentes. Presentamos Xibalbá dos punto cero: protección digital multiagente inspirada en la cultura maya.",
    subtitles: [
      "Every day, scams exploit urgent texts, cloned bank links, and fake calls.",
      "Meet XIBALBÁ 2.0: Maya-inspired multi-agent digital fraud protection.",
    ],
  },
  {
    id: "s2_jaguar_idle",
    narration:
      "Este es nuestro Guardián Jaguar Holográfico en tres D. En reposo vigila el entorno sin consumir recursos innecesarios y responde únicamente a eventos reales del sistema.",
    subtitles: [
      "Our 3D Holographic Jaguar Guardian stays in idle watch,",
      "reacting strictly to real system events with zero fake animations.",
    ],
  },
  {
    id: "s3_quick_scan",
    narration:
      "Desde la pantalla principal, la persona pega cualquier mensaje sospechoso sin navegar por menús complejos. Probemos un aviso bancario fraudulento que exige validar la cuenta de inmediato.",
    subtitles: [
      "Right from home, users paste any suspicious message with no friction.",
      "Let's test a fake bank alert demanding urgent account verification.",
    ],
  },
  {
    id: "s4_jaguar_alert",
    narration:
      "Al detectar señales críticas, el Jaguar cambia en tiempo real a estado de alerta roja, resume los hallazgos comprobados y permite preguntas de seguimiento por texto o voz autorizada.",
    subtitles: [
      "Upon detecting critical threats, the 3D Jaguar shifts to red ALERT,",
      "explaining verified findings via text or explicit microphone input.",
    ],
  },
  {
    id: "s5_gods_map",
    narration:
      "En el mapa ceremonial tres D coordinan cinco agentes: Camazotz, Ixbalanqué, Vucub Camé, Hun Camé y El Guardián. Solo se iluminan y conectan los que realmente participaron en el análisis.",
    subtitles: [
      "On the 3D Ceremonial Map, five Maya agents coordinate live.",
      "Only agents that actually contributed light up and connect.",
    ],
  },
  {
    id: "s6_verdict_evidence",
    narration:
      "Aquí vemos el semáforo en rojo: riesgo alto, confianza alta y treinta y cinco de cuarenta y dos comprobaciones. Xibalbá separa con rigor los hechos deterministas de las estimaciones de inteligencia artificial y las consultas pendientes.",
    subtitles: [
      "Red traffic light: High Risk, High Confidence, 35/42 checks.",
      "Verified deterministic facts (A) stay strictly apart from AI (B) and pending checks (C).",
    ],
  },
  {
    id: "s7_hybrid_ai_local",
    narration:
      "Nota transparente: en esta demostración el indicador muestra inteligencia artificial sin configurar porque no hay claves de nube activas aquí; aun así, el motor local detecta la estafa al instante, y con App Check se suma Gemini en la nube bajo consentimiento.",
    subtitles: [
      "Transparent note: with cloud keys unset here (IA · SIN CONFIGURAR),",
      "the local engine still catches the scam; Firebase + Gemini adds hybrid AI under consent.",
    ],
  },
  {
    id: "s8_outro",
    narration:
      "Con historial enmascarado, correlación de campañas, exportación de reportes y soporte bilingüe español e inglés, Xibalbá dos punto cero está listo para proteger a las personas.",
    subtitles: [
      "Masked history, campaign correlation, MD/JSON/PDF export, ES/EN & PWA.",
      "XIBALBÁ 2.0 — 3D base model: Google Data Arts Team (CC BY 3.0).",
    ],
  },
];

function probeDuration(filePath) {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath],
    { encoding: "utf8" },
  );
  return parseFloat(out.trim());
}

function synthesizeSpanishWav(text, outWavPath) {
  const escapedText = text.replace(/'/g, "''");
  const escapedOut = outWavPath.replace(/'/g, "''");
  const psScript = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
Function Await($WinRtTask, $ResultType) {
  $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
  $netTask = $asTask.Invoke($null, @($WinRtTask))
  $netTask.Wait(-1) | Out-Null
  $netTask.Result
}
[Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType=WindowsRuntime] | Out-Null
[Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType=WindowsRuntime] | Out-Null
$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$voice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.DisplayName -like '*Raul*' } | Select-Object -First 1
if ($voice) { $synth.Voice = $voice }
$synth.Options.SpeakingRate = 1.04
$stream = Await ($synth.SynthesizeTextToStreamAsync('${escapedText}')) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
$reader = New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))
Await ($reader.LoadAsync([uint32]$stream.Size)) ([uint32]) | Out-Null
$bytes = New-Object byte[] $stream.Size
$reader.ReadBytes($bytes)
[System.IO.File]::WriteAllBytes('${escapedOut}', $bytes)
`;
  const psFile = path.join(WORK_DIR, "tts.ps1");
  fs.writeFileSync(psFile, psScript, "utf8");
  execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", psFile], {
    stdio: "inherit",
  });
}

function formatSrtTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec - Math.floor(sec)) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

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

// 1. Generar todas las narraciones en español y medir duración real
for (const scene of SCENES) {
  const rawWav = path.join(WORK_DIR, `${scene.id}-raw.wav`);
  const padWav = path.join(WORK_DIR, `${scene.id}.wav`);
  synthesizeSpanishWav(scene.narration, rawWav);
  // Añadir 0.5s de respiro antes y 0.7s después en estéreo 48kHz
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      rawWav,
      "-af",
      "adelay=500|500,apad=pad_dur=0.7",
      "-ar",
      "48000",
      "-ac",
      "2",
      padWav,
    ],
    { stdio: "ignore" },
  );
  scene.duration = probeDuration(padWav);
  scene.wavPath = padWav;
  console.log(`TTS ${scene.id}: ${scene.duration.toFixed(2)}s`);
}

// 2. Generar Intro y Outro 1920x1080 con el logo XIBALBÁ vía Playwright PNG (sin drawtext/fontconfig)
async function buildLogoCard(browser, outMp4, durationSec, headline, subline) {
  const logoB64 = fs.readFileSync(LOGO_PATH).toString("base64");
  const cardPng = outMp4.replace(/\.mp4$/, ".png");
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.setContent(`
    <html><body style="margin:0;background:radial-gradient(circle at 50% 42%,#0e2b33 0%,#050a0e 68%);color:#eef5f1;font-family:Segoe UI,Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;text-align:center;">
      <img src="data:image/jpeg;base64,${logoB64}" style="width:540px;height:auto;border-radius:16px;box-shadow:0 0 60px rgba(46,230,230,0.22);margin-bottom:36px;" />
      <div style="font-size:44px;font-weight:700;letter-spacing:4px;color:#e5be67;margin-bottom:14px;">${headline}</div>
      <div style="font-size:24px;letter-spacing:1.5px;color:#9fd8d6;">${subline}</div>
    </body></html>
  `);
  await page.screenshot({ path: cardPng });
  await page.close();

  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-loop",
      "1",
      "-i",
      cardPng,
      "-t",
      durationSec.toFixed(2),
      "-vf",
      `fade=t=in:st=0:d=0.6,fade=t=out:st=${(durationSec - 0.5).toFixed(2)}:d=0.5`,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-r",
      "25",
      outMp4,
    ],
    { stdio: "inherit" },
  );
}

const introMp4 = path.join(WORK_DIR, "s1_intro.mp4");
const outroMp4 = path.join(WORK_DIR, "s8_outro.mp4");

// 3. Grabar escenas reales de la aplicación con Playwright
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

  await buildLogoCard(
    browser,
    introMp4,
    SCENES[0].duration,
    "XIBALBÁ 2.0",
    "INTELIGENCIA MULTIAGENTE CONTRA FRAUDES DIGITALES",
  );
  await buildLogoCard(
    browser,
    outroMp4,
    SCENES[7].duration,
    "XIBALBÁ 2.0",
    "INTELLIGENCE THAT PROTECTS YOU  ·  3D: Google Data Arts Team (CC BY 3.0)",
  );

  // Escena 2: Jaguar 3D en reposo (acercamiento cinematográfico al marco del Jaguar)
  const s2Webm = await recordScene(browser, "s2", async (page) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Nuevo análisis|New analysis/i }).click();
    await page.locator(".jaguar-hologram-3d canvas").waitFor({ state: "visible", timeout: 15_000 });
    await page.waitForTimeout(Math.ceil((SCENES[1].duration + 1.0) * 1000));
  });

  // Escena 3: Quick Scan desde inicio
  const s3Webm = await recordScene(browser, "s3", async (page) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    await page.getByRole("button", { name: /Probar ejemplo de estafa/i }).click();
    await page.waitForTimeout(3000);
    await page.getByRole("button", { name: /Analizar ahora/i }).click();
    await page.locator(".verdict-rojo").waitFor({ state: "visible", timeout: 15_000 });
    await page.waitForTimeout(4500);
  });

  // Escena 4: Jaguar 3D en estado ALERTA (acercamiento cinematográfico)
  const s4Webm = await recordScene(browser, "s4", async (page) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Probar ejemplo de estafa/i }).click();
    await page.getByRole("button", { name: /Analizar ahora/i }).click();
    await page.locator(".jaguar-hologram-3d canvas").waitFor({ state: "visible", timeout: 15_000 });
    await page.locator("[data-guardian-state='alerta']").waitFor({ state: "visible", timeout: 15_000 });
    await page.waitForTimeout(Math.ceil((SCENES[3].duration + 1.0) * 1000));
  });

  // Escena 5: Mapa 3D de los 5 dioses ampliado + rotación
  const s5Webm = await recordScene(browser, "s5", async (page) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Probar ejemplo de estafa/i }).click();
    await page.getByRole("button", { name: /Analizar ahora/i }).click();
    await page.locator(".gods-map-3d canvas").waitFor({ state: "visible", timeout: 15_000 });
    await page.locator(".gods-map-3d").evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(3000);
    const box = await page.locator(".gods-map-3d canvas").boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 - 20, { steps: 25 });
      await page.mouse.up();
    }
    await page.waitForTimeout(Math.ceil((SCENES[4].duration + 3.0) * 1000));
  });

  // Escena 6: Semáforo rojo y evidencias A/B/C (acercamiento al panel C)
  const s6Webm = await recordScene(browser, "s6", async (page) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Probar ejemplo de estafa/i }).click();
    await page.getByRole("button", { name: /Analizar ahora/i }).click();
    await page.locator(".verdict-rojo").waitFor({ state: "visible", timeout: 15_000 });
    await page.locator(".verdict-rojo").scrollIntoViewIfNeeded();
    await page.waitForTimeout(5500);
    await page.evaluate(() => window.scrollBy({ top: 420, behavior: "smooth" }));
    await page.waitForTimeout(6000);
    await page.evaluate(() => window.scrollBy({ top: 420, behavior: "smooth" }));
    await page.waitForTimeout(6500);
  });

  // Escena 7: IA híbrida local/nube + cambio a inglés + historial
  const s7Webm = await recordScene(browser, "s7", async (page) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Probar ejemplo de estafa/i }).click();
    await page.getByRole("button", { name: /Analizar ahora/i }).click();
    await page.locator(".verdict-rojo").waitFor({ state: "visible", timeout: 15_000 });
    await page.waitForTimeout(4500);
    await page.locator("button.language").click();
    await page.waitForTimeout(5000);
    await page.getByRole("button", { name: /History|Historial/i }).click();
    await page.waitForTimeout(6000);
  });

  await browser.close();

  // 4. Procesar cada clip con recortes cinematográficos exactos y emparejar duración con su WAV
  function renderClip(inPath, outMp4, durationSec, cropFilter, skipSec = 0) {
    const fadeOutSt = Math.max(0.5, durationSec - 0.5).toFixed(2);
    const vf = cropFilter
      ? `${cropFilter},scale=1920:1080:flags=lanczos,fade=t=in:st=0:d=0.45,fade=t=out:st=${fadeOutSt}:d=0.45`
      : `scale=1920:1080:flags=lanczos,fade=t=in:st=0:d=0.45,fade=t=out:st=${fadeOutSt}:d=0.45`;
    execFileSync(
      "ffmpeg",
      [
        "-y",
        ...(skipSec > 0 ? ["-ss", String(skipSec)] : []),
        "-i",
        inPath,
        "-t",
        durationSec.toFixed(2),
        "-vf",
        vf,
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "19",
        "-pix_fmt",
        "yuv420p",
        "-r",
        "25",
        outMp4,
      ],
      { stdio: "inherit" },
    );
  }

  // Coordenadas reales en viewport 1920x1080:
  const JAGUAR_ZOOM = "crop=960:540:280:200";
  const MAP_ZOOM = "crop=1060:596:670:250";
  const VERDICT_ZOOM = "crop=1120:630:790:140";

  const videoClips = [
    introMp4,
    (() => {
      const p = path.join(WORK_DIR, "s2.mp4");
      renderClip(s2Webm, p, SCENES[1].duration, JAGUAR_ZOOM, 2.5);
      return p;
    })(),
    (() => {
      const p = path.join(WORK_DIR, "s3.mp4");
      renderClip(s3Webm, p, SCENES[2].duration, null, 0);
      return p;
    })(),
    (() => {
      const p = path.join(WORK_DIR, "s4.mp4");
      renderClip(s4Webm, p, SCENES[3].duration, JAGUAR_ZOOM, 3.0);
      return p;
    })(),
    (() => {
      const p = path.join(WORK_DIR, "s5.mp4");
      renderClip(s5Webm, p, SCENES[4].duration, MAP_ZOOM, 3.5);
      return p;
    })(),
    (() => {
      const p = path.join(WORK_DIR, "s6.mp4");
      renderClip(s6Webm, p, SCENES[5].duration, VERDICT_ZOOM, 3.0);
      return p;
    })(),
    (() => {
      const p = path.join(WORK_DIR, "s7.mp4");
      renderClip(s7Webm, p, SCENES[6].duration, null, 2.5);
      return p;
    })(),
    outroMp4,
  ];

  // 5. Combinar cada clip de video con su pista WAV sincronizada
  const avClips = [];
  for (let i = 0; i < SCENES.length; i += 1) {
    const outAv = path.join(WORK_DIR, `av-${i}.mp4`);
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-i",
        videoClips[i],
        "-i",
        SCENES[i].wavPath,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        outAv,
      ],
      { stdio: "inherit" },
    );
    avClips.push(outAv);
  }

  // 6. Construir SRT sincronizado exacto según las duraciones reales medidas
  let cursor = 0;
  let srtIdx = 1;
  const srtLines = [];
  for (const scene of SCENES) {
    const dur = scene.duration;
    const mid = cursor + dur * 0.48;
    srtLines.push(
      String(srtIdx++),
      `${formatSrtTime(cursor + 0.3)} --> ${formatSrtTime(mid - 0.1)}`,
      scene.subtitles[0],
      "",
      String(srtIdx++),
      `${formatSrtTime(mid)} --> ${formatSrtTime(cursor + dur - 0.3)}`,
      scene.subtitles[1],
      "",
    );
    cursor += dur;
  }
  const srtPath = path.join(OUT_DIR, "xibalba-2.0-v2-subtitles-en.srt");
  fs.writeFileSync(srtPath, srtLines.join("\n"), "utf8");

  // 7. Concatenar todos los clips AV y quemar subtítulos compactos en inglés
  const listFile = path.join(WORK_DIR, "concat-av.txt");
  fs.writeFileSync(
    listFile,
    avClips.map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n"),
    "utf8",
  );
  const mergedAv = path.join(WORK_DIR, "merged-av.mp4");
  execFileSync(
    "ffmpeg",
    ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", mergedAv],
    { stdio: "inherit" },
  );

  const finalV2 = path.join(OUT_DIR, "xibalba-2.0-pitch-v2.mp4");
  const escapedSrt = srtPath.replace(/\\/g, "/").replace(/:/g, "\\:");
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      mergedAv,
      "-vf",
      `subtitles='${escapedSrt}':force_style='FontName=Arial,FontSize=9,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&HAA050A0E,BorderStyle=4,Outline=1,Shadow=0,MarginV=12'`,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "19",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "copy",
      "-movflags",
      "+faststart",
      finalV2,
    ],
    { stdio: "inherit" },
  );

  fs.rmSync(WORK_DIR, { recursive: true, force: true });
  console.log("PITCH_V2_GENERATED:", finalV2);
} finally {
  server.kill("SIGTERM");
}
