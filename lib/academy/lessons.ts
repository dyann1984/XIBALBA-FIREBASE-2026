export type AcademyPathId = "children" | "teens" | "adults" | "seniors" | "business";

export type AcademyLesson = {
  id: string;
  paths: AcademyPathId[];
  agent: string;
  titleEs: string;
  titleEn: string;
  summaryEs: string;
  summaryEn: string;
  redFlagEs: string;
  redFlagEn: string;
};

export type AcademyQuestion = {
  id: string;
  promptEs: string;
  promptEn: string;
  optionsEs: string[];
  optionsEn: string[];
  correctIndex: number;
  explanationEs: string;
  explanationEn: string;
};

export const ACADEMY_PATHS: { id: AcademyPathId; es: string; en: string }[] = [
  { id: "children", es: "Niños", en: "Children" },
  { id: "teens", es: "Adolescentes", en: "Teens" },
  { id: "adults", es: "Adultos", en: "Adults" },
  { id: "seniors", es: "Adultos mayores", en: "Older adults" },
  { id: "business", es: "Empresas", en: "Businesses" },
];

export const ACADEMY_LESSONS: AcademyLesson[] = [
  // Niños
  {
    id: "children-gifts",
    paths: ["children"],
    agent: "IXBALANQUÉ",
    titleEs: "Monedas gratis en juegos y regalos sorpresa",
    titleEn: "Free in-game coins and surprise gift links",
    summaryEs: "Nunca ingreses contraseñas de tus padres ni abras enlaces de 'monedas gratis' enviados por desconocidos en chats de videojuegos.",
    summaryEn: "Never enter your parents' passwords or open 'free coin' links sent by strangers in game chats.",
    redFlagEs: "Promesas de premios inmediatos a cambio de datos o descargas.",
    redFlagEn: "Instant reward promises asking for passwords or downloads.",
  },
  {
    id: "children-stranger",
    paths: ["children"],
    agent: "EL GUARDIÁN",
    titleEs: "Habla con un adulto de confianza antes de responder",
    titleEn: "Check with a trusted adult before replying",
    summaryEs: "Si alguien te pide fotos, tu escuela, tu dirección o guardar un secreto, detente y muéstraselo a mamá, papá o tu tutor.",
    summaryEn: "If someone asks for photos, your school, your address, or to keep a secret, stop and show a parent or guardian.",
    redFlagEs: "Peticiones de secreto o presión para responder rápido.",
    redFlagEn: "Requests for secrecy or pressure to reply quickly.",
  },
  // Adolescentes
  {
    id: "teens-social-links",
    paths: ["teens"],
    agent: "HUN CAMÉ",
    titleEs: "Enlaces de 'mira quién vio tu perfil' o sorteos virales",
    titleEn: "'See who viewed your profile' links and viral giveaways",
    summaryEs: "Los enlaces acortados o con dominios extraños roban tu sesión de redes sociales para suplantarte frente a tus contactos.",
    summaryEn: "Shortened links or strange domains steal your social-media session to impersonate you to friends.",
    redFlagEs: "Dominio registrable distinto al oficial y formulario de inicio de sesión.",
    redFlagEn: "Registrable domain differs from official brand with a login prompt.",
  },
  {
    id: "teens-sextortion",
    paths: ["teens"],
    agent: "CAMAZOTZ",
    titleEs: "Chantaje con imágenes, deepfakes y silencio forzado",
    titleEn: "Image blackmail, deepfakes, and forced silence",
    summaryEs: "Quien amenaza con publicar fotos reales o manipuladas con IA busca aislarte. No pagues: guarda capturas y pide ayuda.",
    summaryEn: "Anyone threatening to share real or AI-altered photos wants you isolated. Do not pay: save screenshots and seek help.",
    redFlagEs: "Amenaza urgente con cuenta regresiva y exigencia de dinero o silencio.",
    redFlagEn: "Countdown threat demanding money or silence.",
  },
  // Adultos
  {
    id: "phishing-domain",
    paths: ["adults", "business"],
    agent: "HUN CAMÉ",
    titleEs: "Revisa el dominio registrable del enlace",
    titleEn: "Check the link's registrable domain",
    summaryEs: "En https://bbva-mx.validacion.example.com/acceso, la marca está en el subdominio; el dueño real es example.com.",
    summaryEn: "In https://bbva-mx.verify.example.com/login, the brand sits in the subdomain; the true owner is example.com.",
    redFlagEs: "Subdominios con nombres de bancos + urgencia de bloqueo.",
    redFlagEn: "Subdomains naming banks + urgent suspension threats.",
  },
  {
    id: "jobs",
    paths: ["adults"],
    agent: "VUCUB CAMÉ",
    titleEs: "Examina las ofertas laborales con pago previo",
    titleEn: "Examine job offers asking for upfront fees",
    summaryEs: "Verifica la empresa por sus canales oficiales y desconfía de sueldos desproporcionados o depósitos previos por capacitación.",
    summaryEn: "Verify the company via official channels and beware of unrealistic pay or upfront training-kit deposits.",
    redFlagEs: "Pago previo, promesas de ganancias y entrevistas inexistentes.",
    redFlagEn: "Upfront fees, earnings promises, and absent interviews.",
  },
  {
    id: "qr-traps",
    paths: ["adults", "seniors"],
    agent: "IXBALANQUÉ",
    titleEs: "Revisa qué acción propone un código QR de pago",
    titleEn: "Check what action a payment QR code proposes",
    summaryEs: "Un QR puede contener instrucciones para pagar o abrir sitios externos. Revisa el destinatario, importe y URL antes de confirmar.",
    summaryEn: "A QR code may initiate a payment or open an external site. Check recipient, amount, and URL before confirming.",
    redFlagEs: "Acortadores opacos o QRs pegados encima de avisos físicos.",
    redFlagEn: "Opaque shorteners or stickers pasted over physical signs.",
  },
  // Adultos mayores
  {
    id: "seniors-grandparent",
    paths: ["seniors"],
    agent: "CAMAZOTZ",
    titleEs: "Llamadas de 'familiar en apuros' o suplantación bancaria",
    titleEn: "'Relative in trouble' calls and bank impersonation",
    summaryEs: "Si alguien dice ser tu nieto, hijo o ejecutivo del banco y te prohíbe colgar, cuelga y llama directo al número familiar que ya conoces.",
    summaryEn: "If a caller claims to be your grandchild or bank officer and forbids hanging up, hang up and call your family directly.",
    redFlagEs: "Prohibición de colgar, voz alterada o petición urgente de transferencia.",
    redFlagEn: "Forbidding you to hang up, altered voice, or urgent transfer request.",
  },
  {
    id: "otp-isolation",
    paths: ["seniors", "adults"],
    agent: "CAMAZOTZ",
    titleEs: "Ningún banco real pide códigos OTP ni acceso remoto",
    titleEn: "No real bank asks for OTP codes or remote access",
    summaryEs: "Nunca dictes códigos SMS ni instales aplicaciones de control remoto (AnyDesk/TeamViewer) para 'proteger tu pensión o cuenta'.",
    summaryEn: "Never read SMS codes or install remote-control apps (AnyDesk/TeamViewer) to 'protect your pension or account'.",
    redFlagEs: "Aislamiento de la víctima, urgencia extrema y petición de NIP/OTP.",
    redFlagEn: "Victim isolation, extreme urgency, and PIN/OTP requests.",
  },
  // Empresas
  {
    id: "business-bec",
    paths: ["business"],
    agent: "VUCUB CAMÉ",
    titleEs: "Fraude del CEO y cambio urgente de cuenta bancaria",
    titleEn: "CEO fraud (BEC) and urgent supplier bank-account changes",
    summaryEs: "Antes de pagar facturas nuevas o comprar tarjetas de regalo a pedido de 'dirección', confirma por voz o canal interno distinto al correo.",
    summaryEn: "Before paying changed supplier accounts or buying gift cards requested by 'executives', verify via an independent internal call.",
    redFlagEs: "Confidencialidad forzada, cambio repentino de CLABE/IBAN y plazo hoy.",
    redFlagEn: "Forced secrecy, sudden bank-account change, and same-day deadline.",
  },
  {
    id: "guaranteed-yield",
    paths: ["business", "adults"],
    agent: "VUCUB CAMÉ",
    titleEs: "Inversiones con rendimiento garantizado y cupo limitado",
    titleEn: "Guaranteed-return investments and artificial scarcity",
    summaryEs: "Ninguna inversión legítima garantiza duplicar capital en horas sin riesgo. Verifica registros ante la autoridad financiera.",
    summaryEn: "No legitimate investment guarantees risk-free doubled returns in hours. Verify registration with financial regulators.",
    redFlagEs: "Ganancia garantizada sin riesgo o depósito a cuenta personal.",
    redFlagEn: "Risk-free guaranteed profit or deposit to a personal account.",
  },
];

export const ACADEMY_QUIZ: AcademyQuestion[] = [
  {
    id: "q1",
    promptEs: "Recibes un SMS: 'Cargo de $8,450. Valida en https://santander.alerta.example.com/nip'. ¿Qué es lo más seguro?",
    promptEn: "You get an SMS: 'Charge of $8,450. Verify at https://santander.alert.example.com/pin'. What is safest?",
    optionsEs: [
      "Abrir el enlace rápido antes de que bloqueen la cuenta",
      "No abrir el enlace; revisar en la app oficial o llamar al número del reverso de tu tarjeta",
      "Responder el SMS con tu código OTP",
    ],
    optionsEn: [
      "Open the link quickly before the account is locked",
      "Do not open the link; check inside your official banking app or call the number on your card",
      "Reply to the SMS with your OTP code",
    ],
    correctIndex: 1,
    explanationEs: "El dominio registrable es example.com, no el banco. Siempre verifica por canales oficiales independientes.",
    explanationEn: "The registrable domain is example.com, not the bank. Always verify through independent official channels.",
  },
  {
    id: "q2",
    promptEs: "En una llamada te dicen: 'No cuelgue, estamos monitoreando su línea y debe transferir a una cuenta segura'. ¿Qué debes hacer?",
    promptEn: "A caller says: 'Do not hang up, we are monitoring your line and you must transfer to a safe account'. What should you do?",
    optionsEs: [
      "Obedecer para evitar perder el dinero",
      "Colgar de inmediato y contactar a tu familiar o banco por otro canal oficial",
      "Instalar AnyDesk para que verifiquen tu saldo",
    ],
    optionsEn: [
      "Comply so you do not lose money",
      "Hang up immediately and contact your family or bank via an official channel",
      "Install AnyDesk so they can check your balance",
    ],
    correctIndex: 1,
    explanationEs: "Prohibir colgar y pedir 'cuentas seguras' o acceso remoto son señales críticas de extorsión y suplantación.",
    explanationEn: "Forbidding you to hang up and demanding 'safe accounts' or remote access are critical extortion/impersonation signals.",
  },
];

/** Relaciona indicadores reales de un análisis con lecciones específicas de Academy. */
export function recommendedLessonsFor(indicatorIds: string[]): AcademyLesson[] {
  const joined = indicatorIds.join(" ").toLowerCase();
  const matchedIds = new Set<string>();
  if (/url|dominio|host|marca|brand|credencial/.test(joined)) {
    matchedIds.add("phishing-domain");
    matchedIds.add("teens-social-links");
  }
  if (/cuelgue|aislamiento|secuestro|extorsion|otp|nip|codigo|suplant/.test(joined)) {
    matchedIds.add("otp-isolation");
    matchedIds.add("seniors-grandparent");
  }
  if (/clabe|tarjeta|inversion|rendimiento|empleo|vacante|transfer/.test(joined)) {
    matchedIds.add("guaranteed-yield");
    matchedIds.add("jobs");
    matchedIds.add("business-bec");
  }
  if (/qr/.test(joined)) matchedIds.add("qr-traps");
  if (!matchedIds.size && indicatorIds.length > 0) matchedIds.add("phishing-domain");
  return ACADEMY_LESSONS.filter((lesson) => matchedIds.has(lesson.id));
}
