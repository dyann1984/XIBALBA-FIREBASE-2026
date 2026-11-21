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
import { useI18n } from "@/components/LanguageProvider";
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
  const { t } = useI18n();
  const fileInput = useRef<HTMLInputElement>(null);

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
      onError(error instanceof Error ? error.message : t("audio", "prepareFailed"));
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
          <FileAudio size={15} /> {audio ? t("audio", "change") : t("audio", "attach")}
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
          <MicOff size={13} /> {t("audio", "noMic")}
        </span>
      </div>

      {audio && (
        <div className="audio-card">
          <div className="thumb-meta">
            <strong>{audio.name}</strong>
            <small>
              {audio.mimeType.replace("audio/", "").toUpperCase()} ·{" "}
              {(audio.size / 1024 / 1024).toFixed(2)} MB
              {minutes ? ` · ${minutes}` : ` · ${t("audio", "unreadableDuration")}`}
            </small>
          </div>
          <audio
            controls
            src={audio.previewUrl}
            aria-label={t("audio", "listenLabel", { name: audio.name })}
          />
          <button
            type="button"
            aria-label={t("audio", "removeLabel", { name: audio.name })}
            disabled={disabled}
            onClick={remove}
          >
            <Trash2 size={15} />
          </button>
        </div>
      )}

      {audio && (
        <p className={`notice ${transcription?.status === "disponible" ? "" : "pending-notice"}`}>
          <Info size={13} />{" "}
          {transcription ? describeTranscription(transcription) : t("audio", "pendingDefault")}
        </p>
      )}

      <p className="notice">{t("audio", "note", { mb: MAX_AUDIO_BYTES / 1024 / 1024 })}</p>
    </div>
  );
}
