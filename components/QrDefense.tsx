"use client";

import { useState } from "react";
import { QrCode, ScanLine } from "lucide-react";
import { useI18n } from "@/components/LanguageProvider";
import { auditQrPayload, type QrInspection } from "@/lib/analysis/qr";

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

export default function QrDefense({
  onSendUrlToLab,
}: {
  onSendUrlToLab: (url: string) => void;
}) {
  const { lang } = useI18n();
  const [payload, setPayload] = useState("");
  const [result, setResult] = useState<QrInspection | null>(null);
  const [statusNote, setStatusNote] = useState("");

  const inspectText = (text: string) => {
    setPayload(text);
    setResult(auditQrPayload(text));
    setStatusNote("");
  };

  const handleImageFile = async (file: File | undefined) => {
    if (!file) return;
    setStatusNote("");
    const w = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor };
    if (!w.BarcodeDetector) {
      setStatusNote(
        lang === "en"
          ? "Browser BarcodeDetector is unavailable here; paste the decoded QR text or URL below."
          : "BarcodeDetector no está disponible en este navegador; pega abajo el texto o enlace del QR.",
      );
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const detector = new w.BarcodeDetector({ formats: ["qr_code"] });
      const codes = await detector.detect(bitmap);
      bitmap.close();
      const raw = codes[0]?.rawValue?.trim() ?? "";
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
      </div>
      {statusNote && <p className="notice">{statusNote}</p>}
      {result && (
        <div className="qr-result" role="status">
          <strong>
            {lang === "en" ? `Risk: ${result.risk}` : `Riesgo: ${result.risk}`} ·{" "}
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
