"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAX_IMAGES,
  describeImageRejection,
  imagesFromClipboard,
  prepareImage,
  releaseImage,
  type PreparedImage,
} from "@/lib/analysis/images";
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
        onError(`Puedes adjuntar hasta ${MAX_IMAGES} imágenes.`);
        return;
      }
      const accepted: PreparedImage[] = [];
      for (const file of files.slice(0, room)) {
        const rejection = describeImageRejection(file);
        if (rejection) {
          onError(rejection);
          continue;
        }
        try {
          accepted.push(await prepareImage(file));
        } catch (error) {
          onError(error instanceof Error ? error.message : "No se pudo preparar la imagen.");
        }
      }
      if (files.length > room) onError(`Solo se añadieron ${room}: el límite es ${MAX_IMAGES} imágenes.`);
      if (accepted.length) onChange([...images, ...accepted]);
    },
    [disabled, images, onChange, onError],
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
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Este navegador no permite usar la cámara.");
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
        audio: false,
      });
      stream.current = media;
      setCameraOn(true);
      if (video.current) {
        video.current.srcObject = media;
        await video.current.play().catch(() => {});
      }
    } catch (error) {
      stopCamera();
      const name = (error as { name?: string })?.name;
      onError(
        name === "NotAllowedError"
          ? "No se concedió permiso para usar la cámara."
          : name === "NotFoundError"
            ? "No se encontró ninguna cámara disponible."
            : error instanceof Error
              ? error.message
              : "No se pudo abrir la cámara.",
      );
    } finally {
      setCameraBusy(false);
    }
  };

  const capture = async () => {
    const element = video.current;
    if (!element || !element.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;
    canvas.getContext("2d")?.drawImage(element, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((value) => resolve(value), "image/jpeg", 0.9),
    );
    if (!blob) {
      onError("No se pudo capturar la imagen.");
      return;
    }
    stopCamera();
    await addFiles([new File([blob], `captura-${Date.now()}.jpg`, { type: "image/jpeg" })]);
  };

  return (
    <div className="attachments">
      <div className="attachments-actions">
        <button type="button" disabled={disabled || images.length >= MAX_IMAGES} onClick={() => fileInput.current?.click()}>
          <ImagePlus size={15} /> Añadir imagen
        </button>
        <button
          type="button"
          disabled={disabled || images.length >= MAX_IMAGES || cameraBusy}
          onClick={() => (cameraOn ? stopCamera() : void startCamera())}
          aria-pressed={cameraOn}
        >
          {cameraOn ? <CameraOff size={15} /> : <Camera size={15} />} {cameraOn ? "Cerrar cámara" : "Usar cámara"}
        </button>
        <span className="attachments-hint">
          <Clipboard size={13} /> También puedes pegar una captura con Ctrl+V
        </span>
      </div>

      <input
        ref={fileInput}
        id="photo"
        className="visually-hidden"
        type="file"
        accept="image/jpeg,image/png"
        multiple
        disabled={disabled}
        onChange={(event) => {
          void addFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />

      {cameraOn && (
        <div className="camera">
          <video ref={video} playsInline muted aria-label="Vista previa de la cámara" />
          <div className="camera-actions">
            <button type="button" className="primary" onClick={() => void capture()}>
              <Camera size={15} /> Capturar
            </button>
            <button type="button" onClick={stopCamera}>
              Cancelar
            </button>
          </div>
          <p className="notice">La cámara permanece activa solo mientras esta vista está abierta.</p>
        </div>
      )}

      {images.length > 0 && (
        <ul className="thumbs">
          {images.map((image) => (
            <li key={image.id}>
              {/* Vista previa local: es un object URL, no una imagen remota. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.previewUrl} alt={`Vista previa de ${image.name}`} />
              <div className="thumb-meta">
                <strong>{image.name}</strong>
                <small>
                  {image.mimeType.replace("image/", "").toUpperCase()} ·{" "}
                  {(image.size / 1024).toFixed(0)} KB
                  {image.width && image.height ? ` · ${image.width}×${image.height}` : ""}
                </small>
              </div>
              <button type="button" aria-label={`Quitar ${image.name}`} disabled={disabled} onClick={() => remove(image)}>
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="notice">
        Hasta {MAX_IMAGES} imágenes JPEG o PNG de 4 MB. Permanecen en memoria, no se guardan y solo
        se envían al modelo si aceptas el consentimiento. Cubre los datos personales antes de
        compartir una captura.
      </p>
    </div>
  );
}
