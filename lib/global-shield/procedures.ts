// Centro de Auxilio — Modo B: orientación contextual por tipo de incidente.
//
// Estos pasos son prácticas generales de respuesta a fraude, no procedimientos
// legales de ningún país concreto ni un sustituto de asesoría profesional.
// Nunca nombran una institución, teléfono o ley específica que no esté ya en
// `directory.ts` con su propia fuente: ver el aviso en cada bloque.

import type { IncidentCategory } from "./types.ts";

export type IncidentProcedure = {
  category: IncidentCategory;
  title: string;
  /** Pasos en orden, el primero siempre es el más urgente. */
  steps: string[];
  disclaimer: string;
};

type Lang = "es" | "en";

const PROCEDURES: Record<Lang, Record<IncidentCategory, IncidentProcedure>> = {
  es: {
    "fraude-financiero": {
      category: "fraude-financiero",
      title: "Si ya hiciste o recibiste un pago sospechoso",
      steps: [
        "Si el dinero salió de tu cuenta, llama ahora mismo al número de atención al fraude que aparece al reverso de tu propia tarjeta o en la app oficial de tu banco — nunca a un número que te dio la persona que contactó.",
        "No hagas ninguna transferencia adicional, aunque te digan que es para \"revertir\" o \"liberar\" el pago anterior: esa segunda petición es, casi siempre, la propia estafa continuando.",
        "Guarda capturas de pantalla, comprobantes de transferencia y los mensajes originales antes de borrar nada.",
        "Reporta el caso a tu banco por escrito, pidiendo número de folio, y después usa el directorio de abajo para el organismo oficial de tu país.",
      ],
      disclaimer: "Esto no es asesoría legal ni financiera. Tu banco es quien puede bloquear o intentar recuperar una transferencia; este directorio solo ayuda a reportar el fraude ante un organismo oficial.",
    },
    phishing: {
      category: "phishing",
      title: "Si diste clic en un enlace o compartiste una clave",
      steps: [
        "Si escribiste una contraseña o código en el sitio falso, cambia esa contraseña ahora en el sitio real (escribiendo la dirección tú mismo, no desde el enlace) y en cualquier otro lugar donde la hayas reutilizado.",
        "Activa la verificación en dos pasos en la cuenta afectada si todavía no la tenías.",
        "Revisa la actividad reciente de la cuenta (sesiones abiertas, correos de recuperación añadidos, reenvíos configurados) y cierra sesión en dispositivos que no reconozcas.",
        "No vuelvas a abrir el enlace ni a reenviarlo: repórtalo con el organismo oficial de tu país en el directorio de abajo.",
      ],
      disclaimer: "Si el enlace venía de una cuenta de trabajo o de tu banco, avisa también por un canal interno distinto al enlace mismo.",
    },
    extorsion: {
      category: "extorsion",
      title: "Si te están extorsionando o amenazando",
      steps: [
        "No transfieras dinero ni envíes códigos de verificación: ceder a una primera petición no detiene la extorsión, casi siempre la prolonga.",
        "No confirmes datos personales de familiares ni digas dónde están; cuelga o deja de responder si la llamada busca aislarte o presionarte con urgencia.",
        "Si hay una amenaza directa a tu integridad física o la de alguien más, contacta primero al número de emergencias real de tu país, no este directorio.",
        "Conserva capturas, grabaciones (donde sea legal) y los números usados antes de bloquear al contacto.",
        "Repórtalo al organismo oficial de tu país contra ciberdelitos o extorsión en el directorio de abajo.",
      ],
      disclaimer: "Este directorio no es un servicio de emergencia. Ante peligro inmediato, el número real depende de tu país.",
    },
    suplantacion: {
      category: "suplantacion",
      title: "Si alguien se hizo pasar por una institución o por ti",
      steps: [
        "Verifica de forma independiente: busca tú mismo el número o sitio oficial de la institución mencionada, nunca uses el que te dieron en el mensaje o llamada.",
        "Si suplantaron tu identidad (cuenta, nombre o documento), cambia las contraseñas de las cuentas relacionadas y activa alertas de la institución real si existen.",
        "Pide a la institución real una constancia o folio de que el contacto no vino de ellos, si el fraude siguió un canal que dice representarlos.",
        "Repórtalo al organismo oficial de tu país en el directorio de abajo.",
      ],
      disclaimer: "Una institución legítima no suele pedir contraseñas, códigos de un solo uso ni pagos urgentes por los mismos canales que un mensaje no solicitado.",
    },
    ciberdelito: {
      category: "ciberdelito",
      title: "Si sospechas de un delito informático más amplio",
      steps: [
        "Desconecta el dispositivo de internet si crees que sigue comprometido, antes de seguir usándolo para operaciones sensibles.",
        "No pagues ningún rescate ni sigas instrucciones de la persona o grupo que afirma haber accedido a tus sistemas.",
        "Conserva evidencia técnica: capturas, registros, nombres de archivo o procesos que notaste como anómalos.",
        "Repórtalo al organismo oficial de ciberdelitos de tu país en el directorio de abajo; si hay impacto en un negocio, informa también a tu equipo de TI o proveedor.",
      ],
      disclaimer: "Para un incidente de seguridad complejo (servidores, datos de terceros), esto es un primer paso, no un plan de respuesta completo.",
    },
    otro: {
      category: "otro",
      title: "Si el caso no encaja en las categorías anteriores",
      steps: [
        "No sigas ninguna instrucción de pago, transferencia de datos o instalación de software que te haya dado la persona o mensaje sospechoso.",
        "Guarda la evidencia original (capturas, enlaces, números) antes de bloquear o borrar.",
        "Consulta el veredicto y las evidencias que ya generó el análisis de XIBALBÁ para esta investigación.",
        "Usa el directorio de abajo: muchos organismos aceptan reportes generales aunque el caso no tenga una categoría exacta.",
      ],
      disclaimer: "Si no estás seguro de qué tipo de incidente es, repórtalo igual: el organismo oficial puede reclasificarlo.",
    },
  },
  en: {
    "fraude-financiero": {
      category: "fraude-financiero",
      title: "If you already made or received a suspicious payment",
      steps: [
        "If money left your account, call the fraud line printed on the back of your own card or in your bank's official app right now — never a number given to you by the person who contacted you.",
        "Don't make any further transfer, even if you're told it's needed to \"reverse\" or \"release\" the previous payment: that second request is almost always the scam continuing.",
        "Save screenshots, transfer receipts and the original messages before deleting anything.",
        "Report the case to your bank in writing, asking for a case number, then use the directory below for your country's official agency.",
      ],
      disclaimer: "This is not legal or financial advice. Your bank is who can block or attempt to recover a transfer; this directory only helps you report the fraud to an official agency.",
    },
    phishing: {
      category: "phishing",
      title: "If you clicked a link or shared a password",
      steps: [
        "If you typed a password or code into the fake site, change that password now on the real site (typing the address yourself, not from the link) and anywhere else you reused it.",
        "Turn on two-step verification on the affected account if you hadn't already.",
        "Review recent account activity (open sessions, added recovery emails, forwarding rules) and sign out of devices you don't recognize.",
        "Don't reopen or forward the link: report it to your country's official agency in the directory below.",
      ],
      disclaimer: "If the link came through a work account or your bank, also notify them through a separate internal channel, not the link itself.",
    },
    extorsion: {
      category: "extorsion",
      title: "If you're being extorted or threatened",
      steps: [
        "Don't transfer money or send verification codes: giving in to a first request doesn't stop the extortion, it almost always prolongs it.",
        "Don't confirm personal details about family members or say where they are; hang up or stop responding if the call is trying to isolate or pressure you with urgency.",
        "If there's a direct threat to your physical safety or someone else's, contact your country's real emergency number first, not this directory.",
        "Keep screenshots, recordings (where legal) and the numbers used before blocking the contact.",
        "Report it to your country's official cybercrime or extortion agency in the directory below.",
      ],
      disclaimer: "This directory is not an emergency service. In immediate danger, the real number depends on your country.",
    },
    suplantacion: {
      category: "suplantacion",
      title: "If someone impersonated an institution or you",
      steps: [
        "Verify independently: look up the official number or site of the mentioned institution yourself, never the one given in the message or call.",
        "If your identity was impersonated (account, name or document), change passwords on related accounts and turn on alerts from the real institution if available.",
        "Ask the real institution for a record or case number confirming the contact didn't come from them, if the fraud used a channel claiming to represent them.",
        "Report it to your country's official agency in the directory below.",
      ],
      disclaimer: "A legitimate institution doesn't usually ask for passwords, one-time codes, or urgent payments through the same channels as an unsolicited message.",
    },
    ciberdelito: {
      category: "ciberdelito",
      title: "If you suspect a broader cybercrime",
      steps: [
        "Disconnect the device from the internet if you believe it's still compromised, before using it for anything sensitive.",
        "Don't pay any ransom or follow instructions from whoever claims to have accessed your systems.",
        "Preserve technical evidence: screenshots, logs, file names or processes you noticed as unusual.",
        "Report it to your country's official cybercrime agency in the directory below; if a business is affected, also notify your IT team or provider.",
      ],
      disclaimer: "For a complex security incident (servers, third-party data), this is a first step, not a complete response plan.",
    },
    otro: {
      category: "otro",
      title: "If the case doesn't fit the categories above",
      steps: [
        "Don't follow any instruction to pay, share data, or install software that came from the suspicious person or message.",
        "Keep the original evidence (screenshots, links, numbers) before blocking or deleting.",
        "Review the verdict and evidence that XIBALBÁ's analysis already generated for this investigation.",
        "Use the directory below: many agencies accept general reports even when a case doesn't fit one exact category.",
      ],
      disclaimer: "If you're not sure what type of incident this is, report it anyway: the official agency can reclassify it.",
    },
  },
};

export function procedureFor(category: IncidentCategory, lang: Lang): IncidentProcedure {
  return PROCEDURES[lang][category];
}

export const ALL_INCIDENT_CATEGORIES: IncidentCategory[] = [
  "fraude-financiero",
  "phishing",
  "extorsion",
  "suplantacion",
  "ciberdelito",
  "otro",
];
