"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAX_IMAGES,
  MAX_IMAGE_BYTES,
  describeImageRejection,
  imagesFromClipboard,
  prepareImage,
  releaseImage,
  type PreparedImage,
} from "@/lib/analysis/images";
import { useI18n } from "@/components/LanguageProvider";
import { Camera, CameraOff, Clipboard, ImagePlus, Trash2 } from "lucide-react";

/**
 * Adjuntos en memoria: selección de archivo, pegado con Ctrl+V y captura de
 * cámara con la autorización que solicita el navegador. Nada se sube ni se
 * guarda; el envío al modelo depende del consentimiento del análisis.
 */
export default function ImageAttachments({
  images,
  onChange,
  disabled,
  onError,
}: {
  images: PreparedImage[];
  onChange: (next: PreparedImage[]) => void;
  disabled: boolean;
  onError: (message: string) => void;
}) {
  const { t, lang } = useI18n();
  const fileInput = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);

  const stopCamera = useCallback(() => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setCameraOn(false);
  }, []);

  // Conecta el stream al elemento <video> una vez montado en el DOM.
  useEffect(() => {
    if (!cameraOn || !video.current || !stream.current) return;
    const element = video.current;
    element.srcObject = stream.current;
    void element.play().catch(() => {});
  }, [cameraOn]);

  // Libera cámara y URLs de vista previa al desmontar.
  useEffect(() => stopCamera, [stopCamera]);
  useEffect(
    () => () => {
      images.forEach(releaseImage);
    },
    // Deliberadamente al desmontar: la limpieza por elemento la hace `remove`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const addFiles = useCallback(
    async (files: File[]) => {
      if (disabled || !files.length) return;
      const room = MAX_IMAGES - images.length;
      if (room <= 0) {
        onError(t("images", "tooMany", { max: MAX_IMAGES }));
        return;
      }
      const accepted: PreparedImage[] = [];
      for (const file of files.slice(0, room)) {
        const rejection = describeImageRejection(file, lang);
        if (rejection) {
          onError(rejection);
          continue;
        }
        try {
          accepted.push(await prepareImage(file, lang));
        } catch (error) {
          onError(error instanceof Error ? error.message : t("images", "prepareFailed"));
        }
      }
      if (files.length > room) {
        onError(t("images", "partial", { room, max: MAX_IMAGES }));
      }
      if (accepted.length) onChange([...images, ...accepted]);
    },
    [disabled, images, lang, onChange, onError, t],
  );

  // Pegado global con Ctrl+V mientras el área de análisis está visible.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = imagesFromClipboard(event.clipboardData);
      if (!files.length) return;
      event.preventDefault();
      void addFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  const remove = (image: PreparedImage) => {
    releaseImage(image);
    onChange(images.filter((item) => item.id !== image.id));
  };

  const startCamera = async () => {
    if (disabled || cameraBusy) return;
    setCameraBusy(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error(t("images", "noCamera"));
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
        audio: false,
      });
      stream.current = media;
      setCameraOn(true);
    } catch (error) {
      stopCamera();
      const name = (error as { name?: string })?.name;
      onError(
        name === "NotAllowedError"
          ? t("images", "cameraDenied")
          : name === "NotFoundError"
            ? t("images", "cameraMissing")
            : error instanceof Error
              ? error.message
              : t("images", "cameraFailed"),
      );
    } finally {
      setCameraBusy(false);
    }
  };

  const capture = async () => {
    const element = video.current;
    if (!element || !element.videoWidth) {
      onError(t("images", "captureFailed"));
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;
    canvas.getContext("2d")?.drawImage(element, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((value) => resolve(value), "image/jpeg", 0.9),
    );
    if (!blob) {
      onError(t("images", "captureFailed"));
      return;
    }
    stopCamera();
    await addFiles([new File([blob], `captura-${Date.now()}.jpg`, { type: "image/jpeg" })]);
  };

  return (
    <div className="attachments">
      <div className="attachments-actions">
        <button
          type="button"
          disabled={disabled || images.length >= MAX_IMAGES}
          onClick={() => fileInput.current?.click()}
        >
          <ImagePlus size={15} /> {t("images", "add")}
        </button>
        <button
          type="button"
          disabled={disabled || images.length >= MAX_IMAGES || cameraBusy}
          onClick={() => (cameraOn ? stopCamera() : void startCamera())}
          aria-pressed={cameraOn}
        >
          {cameraOn ? <CameraOff size={15} /> : <Camera size={15} />}{" "}
          {cameraOn ? t("images", "cameraClose") : t("images", "camera")}
        </button>
        <span className="attachments-hint">
          <Clipboard size={13} /> {t("images", "pasteHint")}
        </span>
      </div>

      <input
        ref={fileInput}
        id="photo"
        className="visually-hidden"
        type="file"
        accept="image/*"
        multiple
        disabled={disabled}
        onChange={(event) => {
          void addFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />

      {cameraOn && (
        <div className="camera">
          <video ref={video} playsInline muted autoPlay aria-label={t("images", "cameraPreview")} />
          <div className="camera-actions">
            <button type="button" className="primary" onClick={() => void capture()}>
              <Camera size={15} /> {t("images", "capture")}
            </button>
            <button type="button" onClick={stopCamera}>
              {t("images", "cancel")}
            </button>
          </div>
          <p className="notice">{t("images", "cameraNote")}</p>
        </div>
      )}

      {images.length > 0 && (
        <ul className="thumbs">
          {images.map((image) => (
            <li key={image.id}>
              {/* Vista previa local: es un object URL, no una imagen remota. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.previewUrl} alt={t("images", "previewOf", { name: image.name })} />
              <div className="thumb-meta">
                <strong>{image.name}</strong>
                <small>
                  {image.mimeType.replace("image/", "").toUpperCase()} ·{" "}
                  {(image.size / 1024).toFixed(0)} KB
                  {image.width && image.height ? ` · ${image.width}×${image.height}` : ""}
                </small>
              </div>
              <button
                type="button"
                aria-label={t("images", "remove", { name: image.name })}
                disabled={disabled}
                onClick={() => remove(image)}
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="notice">
        {t("images", "note", { max: MAX_IMAGES, mb: MAX_IMAGE_BYTES / 1024 / 1024 })}
      </p>
    </div>
  );
}
