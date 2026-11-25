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

export type SosScenario = {
  id: string;
  titleEs: string;
  titleEn: string;
  actionEs: string;
  actionEn: string;
  accountEs: string;
  accountEn: string;
};

export const SOS_SCENARIOS: SosScenario[] = [
  { id: "transfer", titleEs: "Ya transferí dinero", titleEn: "I transferred money", actionEs: "Contacta inmediatamente a tu banco por un canal oficial; solicita detener o rastrear la transferencia.", actionEn: "Contact your bank immediately through an official channel; ask to stop or trace the transfer.", accountEs: "Bloquea los medios de pago comprometidos y revisa movimientos.", accountEn: "Freeze compromised payment methods and review transactions." },
  { id: "bank", titleEs: "Compartí información bancaria", titleEn: "I shared banking information", actionEs: "Informa al banco exactamente qué datos compartiste; solicita bloqueo o reposición cuando corresponda.", actionEn: "Tell your bank exactly what information you shared; request a freeze or replacement as appropriate.", accountEs: "Revisa movimientos y activa alertas desde la aplicación oficial.", accountEn: "Review transactions and enable alerts in the official app." },
  { id: "password", titleEs: "Compartí mi contraseña", titleEn: "I shared my password", actionEs: "Desde un dispositivo confiable cambia la contraseña y cualquier otra que hayas reutilizado.", actionEn: "From a trusted device change the password and any reused passwords.", accountEs: "Cierra otras sesiones y activa la verificación en dos pasos.", accountEn: "Sign out other sessions and enable two-step verification." },
  { id: "link", titleEs: "Abrí un enlace sospechoso", titleEn: "I opened a suspicious link", actionEs: "Cierra la página y no descargues archivos ni introduzcas datos. Abrir un enlace no demuestra por sí solo una infección.", actionEn: "Close the page; do not download files or enter information. Opening a link alone does not prove infection.", accountEs: "Si introdujiste una contraseña, cámbiala desde un dispositivo confiable y cierra otras sesiones.", accountEn: "If you entered a password, change it from a trusted device and sign out other sessions." },
  { id: "app", titleEs: "Instalé una aplicación sospechosa", titleEn: "I installed a suspicious app", actionEs: "Desconecta el dispositivo de la red, revoca permisos y busca asistencia técnica confiable para retirarla.", actionEn: "Disconnect the device from the network, revoke permissions and seek trusted technical help to remove it.", accountEs: "Desde otro dispositivo confiable cambia contraseñas y revisa sesiones y transacciones.", accountEn: "From another trusted device change passwords and review sessions and transactions." },
  { id: "extortion", titleEs: "Estoy sufriendo extorsión", titleEn: "I am being extorted", actionEs: "Interrumpe el contacto si es seguro hacerlo; no envíes dinero ni contenido adicional. Si hay peligro inmediato llama a emergencias locales.", actionEn: "Stop contact if safe to do so; do not send money or additional content. If in immediate danger call local emergency services.", accountEs: "Protege tus cuentas y avisa a una persona de confianza sin compartir códigos.", accountEn: "Secure your accounts and tell someone you trust without sharing codes." },
  { id: "identity", titleEs: "Están suplantando mi identidad", titleEn: "Someone is impersonating me", actionEs: "Comunícate con las plataformas y entidades afectadas mediante sus canales oficiales para reportar la suplantación.", actionEn: "Contact affected platforms and institutions through official channels to report impersonation.", accountEs: "Protege tus cuentas, revisa sesiones y alerta a tus contactos de la suplantación.", accountEn: "Secure your accounts, review sessions and warn your contacts about the impersonation." },
  { id: "code", titleEs: "Compartí un código de verificación", titleEn: "I shared a verification code", actionEs: "Contacta inmediatamente al servicio oficial y reporta el código compartido.", actionEn: "Immediately contact the official service and report the shared code.", accountEs: "Cambia la contraseña desde un dispositivo confiable, cierra otras sesiones y revisa métodos de recuperación.", accountEn: "Change your password from a trusted device, sign out other sessions and review recovery methods." },
];
