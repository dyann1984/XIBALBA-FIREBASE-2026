"use client";
import { useEffect, useRef } from "react";
import {
  ALLOWED_AUDIO_TYPES,
  MAX_AUDIO_BYTES,
  describeTranscription,
  prepareAudio,
  releaseAudio,
  type PreparedAudio,
  type Transcription,
} from "@/lib/analysis/audio";
import { FileAudio, Info, MicOff, Trash2 } from "lucide-react";

/**
 * Adjunto de audio para CAMAZOTZ.
 *
 * No abre el micrófono y no graba: solo acepta un archivo que la persona
 * elige a mano. El estado de la transcripción se muestra literalmente, de modo
 * que «pendiente» se lea como pendiente y nunca se insinúe que hay texto.
 */
export default function AudioAttachment({
  audio,
  transcription,
  onChange,
  disabled,
  onError,
}: {
  audio: PreparedAudio | null;
  transcription: Transcription | null;
  onChange: (next: PreparedAudio | null) => void;
  disabled: boolean;
  onError: (message: string) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);

  // Libera el object URL al desmontar; quitar el archivo lo hace en `remove`.
  useEffect(
    () => () => {
      if (audio) releaseAudio(audio);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const pick = async (file: File | undefined) => {
    if (disabled || !file) return;
    try {
      const prepared = await prepareAudio(file);
      if (audio) releaseAudio(audio);
      onChange(prepared);
    } catch (error) {
      onError(error instanceof Error ? error.message : "No se pudo preparar el audio.");
    }
  };

  const remove = () => {
    if (audio) releaseAudio(audio);
    onChange(null);
  };

  const minutes = audio?.durationSeconds
    ? `${Math.floor(audio.durationSeconds / 60)}:${String(audio.durationSeconds % 60).padStart(2, "0")}`
    : null;

  return (
    <div className="attachments">
      <div className="attachments-actions">
        <button type="button" disabled={disabled} onClick={() => fileInput.current?.click()}>
          <FileAudio size={15} /> {audio ? "Cambiar audio" : "Adjuntar audio"}
        </button>
        <input
          ref={fileInput}
          id="audio"
          className="visually-hidden"
          type="file"
          accept={ALLOWED_AUDIO_TYPES.join(",")}
          disabled={disabled}
          onChange={(event) => {
            void pick(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <span className="attachments-hint">
          <MicOff size={13} /> No se usa el micrófono ni se graban llamadas
        </span>
      </div>

      {audio && (
        <div className="audio-card">
          <div className="thumb-meta">
            <strong>{audio.name}</strong>
            <small>
              {audio.mimeType.replace("audio/", "").toUpperCase()} ·{" "}
              {(audio.size / 1024 / 1024).toFixed(2)} MB
              {minutes ? ` · ${minutes}` : " · duración no legible"}
            </small>
          </div>
          {/* Reproducción local desde un object URL; no hay descarga remota. */}
          <audio controls src={audio.previewUrl} aria-label={`Escuchar ${audio.name}`} />
          <button type="button" aria-label={`Quitar ${audio.name}`} disabled={disabled} onClick={remove}>
            <Trash2 size={15} />
          </button>
        </div>
      )}

      {audio && (
        <p className={`notice ${transcription?.status === "disponible" ? "" : "pending-notice"}`}>
          <Info size={13} />{" "}
          {transcription
            ? describeTranscription(transcription)
            : "Transcripción pendiente: el audio no se ha transcrito. Escribe en el campo de contenido lo que recuerdes de la llamada para analizarlo como transcripción."}
        </p>
      )}

      <p className="notice">
        Un archivo MP3, M4A, WAV, OGG o WebM de hasta {MAX_AUDIO_BYTES / 1024 / 1024} MB. Permanece en
        memoria, no se guarda y solo se envía al modelo si aceptas el consentimiento de audio. Graba
        solo conversaciones en las que participaste y de las que puedas compartir el contenido.
      </p>
    </div>
  );
}
