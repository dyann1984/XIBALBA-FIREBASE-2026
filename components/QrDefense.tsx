"use client";

import { useEffect, useRef, useState } from "react";
import { QrCode, ScanLine } from "lucide-react";
import { useI18n } from "@/components/LanguageProvider";
import { auditQrPayload, type QrInspection } from "@/lib/analysis/qr";

async function decodeQr(source: CanvasImageSource, width: number, height: number): Promise<string> {
  const { default: jsQR } = await import("jsqr");
  const scale = Math.min(1, 1600 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("canvas unavailable");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(pixels.data, pixels.width, pixels.height)?.data ?? "";
}

export default function QrDefense({
  onSendUrlToLab,
}: {
  onSendUrlToLab: (url: string) => void;
}) {
  const { lang } = useI18n();
  const [payload, setPayload] = useState("");
  const [result, setResult] = useState<QrInspection | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(false);
  const requestingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; streamRef.current?.getTracks().forEach((track) => track.stop()); };
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  };

  useEffect(() => {
    if (!scanning) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const scan = async () => {
      const video = videoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth) {
        try {
          const raw = await decodeQr(video, video.videoWidth, video.videoHeight);
          if (!cancelled && raw) {
            setPayload(raw);
            setResult(auditQrPayload(raw));
            setStatusNote("");
            streamRef.current?.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
            setScanning(false);
            return;
          }
        } catch { /* Try the next frame. */ }
      }
      if (!cancelled) timer = setTimeout(scan, 400);
    };
    void scan();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [scanning]);

  const startCamera = async () => {
    if (requestingRef.current) return;
    requestingRef.current = true;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unavailable");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      if (!mountedRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      setStatusNote("");
      setScanning(true);
    } catch {
      if (mountedRef.current) setStatusNote(lang === "en" ? "Camera unavailable or permission denied. You can upload an image instead." : "Cámara no disponible o permiso denegado. También puedes cargar una imagen.");
    } finally {
      requestingRef.current = false;
    }
  };

  useEffect(() => {
    if (scanning && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => setStatusNote(lang === "en" ? "Camera preview could not start." : "No se pudo iniciar la cámara."));
    }
  }, [scanning, lang]);

  const inspectText = (text: string) => {
    setPayload(text);
    setResult(auditQrPayload(text));
    setStatusNote("");
  };

  const handleImageFile = async (file: File | undefined) => {
    if (!file) return;
    setStatusNote("");
    if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) {
      setStatusNote(lang === "en" ? "Choose an image under 20 MB." : "Elige una imagen de menos de 20 MB.");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      let raw: string;
      try { raw = await decodeQr(bitmap, bitmap.width, bitmap.height); } finally { bitmap.close(); }
      if (!raw) {
        setStatusNote(
          lang === "en"
            ? "No QR code detected in this image."
            : "No se detectó ningún código QR en la imagen.",
        );
        return;
      }
      inspectText(raw);
    } catch {
      setStatusNote(
        lang === "en"
          ? "Could not read QR from this image; paste the URL manually."
          : "No se pudo leer el QR de la imagen; pega el enlace manualmente.",
      );
    }
  };

  return (
    <section
      className="qr-panel"
      aria-label={lang === "en" ? "QR Defense inspector" : "Inspector QR Defense"}
    >
      <div className="eyebrow">
        <QrCode size={14} /> QR DEFENSE
      </div>
      <p className="notice">
        {lang === "en"
          ? "Inspect a QR image or paste its decoded payload before opening it."
          : "Inspecciona una imagen QR o pega su contenido antes de abrirlo."}
      </p>
      <label htmlFor="qr-payload-input">
        {lang === "en" ? "QR payload or URL" : "Contenido o enlace del QR"}
      </label>
      <input
        id="qr-payload-input"
        type="text"
        value={payload}
        onChange={(e) => {
          setPayload(e.target.value);
          setResult(null);
        }}
        placeholder="https://ejemplo.example.com/pago"
      />
      <div className="qr-actions">
        <button
          type="button"
          className="export-btn"
          disabled={!payload.trim()}
          onClick={() => inspectText(payload)}
        >
          <ScanLine size={14} /> {lang === "en" ? "Inspect QR" : "Inspeccionar QR"}
        </button>
        <label className="export-btn" htmlFor="qr-file-input">
          <QrCode size={14} /> {lang === "en" ? "Scan QR image" : "Leer imagen QR"}
          <input
            id="qr-file-input"
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => void handleImageFile(e.target.files?.[0])}
          />
        </label>
        <button type="button" className="export-btn" onClick={() => scanning ? stopCamera() : void startCamera()}>
          {scanning ? (lang === "en" ? "Stop camera" : "Detener cámara") : (lang === "en" ? "Scan with camera" : "Escanear con cámara")}
        </button>
      </div>
      {scanning && <video ref={videoRef} muted playsInline aria-label={lang === "en" ? "QR camera preview" : "Vista de cámara QR"} style={{ width: "100%", maxWidth: 480 }} />}
      {statusNote && <p className="notice">{statusNote}</p>}
      {result && (
        <div className="qr-result" role="status">
          <strong>
            {lang === "en" ? `Risk: ${{ alto: "high", medio: "medium", bajo: "low", "no concluyente": "inconclusive" }[result.risk]}` : `Riesgo: ${result.risk}`} ·{" "}
            {result.scheme.toUpperCase()}
          </strong>
          <p className="qr-payload">{result.payload}</p>
          <p>{lang === "en" ? result.summaryEn : result.summaryEs}</p>
          {(lang === "en" ? result.findingsEn : result.findingsEs).map((item, idx) => (
            <small key={idx}>• {item}<br /></small>
          ))}
          {result.extractedUrl && (
            <div className="qr-actions">
              <button
                type="button"
                className="text-link"
                onClick={() => onSendUrlToLab(result.extractedUrl!)}
              >
                {lang === "en"
                  ? "Analyze this QR URL with HUN CAMÉ"
                  : "Analizar este enlace QR con HUN CAMÉ"}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
