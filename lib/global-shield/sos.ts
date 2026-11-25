import { recordsFor } from "./directory.ts";
import type { EmergencyRecord } from "./types.ts";

export type SosStep = {
  id: string;
  titleEs: string;
  titleEn: string;
  detailEs: string;
  detailEn: string;
};

export const SOS_STEPS: SosStep[] = [
  {
    id: "freeze",
    titleEs: "1. Bloquea tarjetas y banca móvil",
    titleEn: "1. Freeze cards and mobile banking",
    detailEs: "Llama al número oficial al reverso de tu tarjeta o usa el apagado temporal en tu app bancaria.",
    detailEn: "Call the official number on the back of your card or lock cards immediately in your banking app.",
  },
  {
    id: "cut-contact",
    titleEs: "2. Corta contacto y niega códigos OTP / acceso remoto",
    titleEn: "2. Cut contact and refuse OTP codes / remote access",
    detailEs: "Cuelga si te presionan para no colgar. Desinstala AnyDesk/TeamViewer si te pidieron instalarlos.",
    detailEn: "Hang up if pressured to stay on the line. Uninstall remote-control apps if asked to install them.",
  },
  {
    id: "preserve",
    titleEs: "3. Resguarda evidencia antes de borrar chats",
    titleEn: "3. Preserve evidence before deleting chats",
    detailEs: "Guarda capturas con fecha/hora, URL completa, comprobantes de transferencia y número remitente.",
    detailEn: "Save screenshots with timestamps, full URLs, transfer receipts, and sender phone numbers.",
  },
  {
    id: "report",
    titleEs: "4. Denuncia en el canal oficial de tu país",
    titleEn: "4. Report via your country's official channel",
    detailEs: "Usa solo portales gubernamentales o líneas verificadas; desconfía de gestores que cobran por recuperar fondos.",
    detailEn: "Use verified government portals or hotlines only; beware of recovery scammers charging upfront fees.",
  },
];

export function sosQuickSummary(countryCode: string): {
  steps: SosStep[];
  primaryRecord: EmergencyRecord | null;
} {
  const records = recordsFor(countryCode);
  const verified = records.find((r) => r.status === "verificado") ?? records[0] ?? null;
  return { steps: SOS_STEPS, primaryRecord: verified };
}
