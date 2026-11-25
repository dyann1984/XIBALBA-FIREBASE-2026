export type AcademyLesson = {
  id: string;
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

export const ACADEMY_LESSONS: AcademyLesson[] = [
  {
    id: "phishing-domain",
    agent: "HUN CAMÉ",
    titleEs: "El dominio real siempre está justo antes del primer '/'",
    titleEn: "The real domain always sits right before the first '/'",
    summaryEs: "En https://bbva-mx.validacion.example.com/acceso, la marca está en el subdominio; el dueño real es example.com.",
    summaryEn: "In https://bbva-mx.verify.example.com/login, the brand sits in the subdomain; the true owner is example.com.",
    redFlagEs: "Subdominios con nombres de bancos + urgencia de bloqueo.",
    redFlagEn: "Subdomains naming banks + urgent suspension threats.",
  },
  {
    id: "otp-isolation",
    agent: "CAMAZOTZ",
    titleEs: "Ningún banco real prohíbe colgar o pide códigos OTP",
    titleEn: "No real bank forbids hanging up or asks for OTP codes",
    summaryEs: "Si alguien te pide no colgar, guardar silencio o dictar un código SMS para 'proteger tu cuenta', es ingeniería social.",
    summaryEn: "If a caller demands you stay on the line, keep quiet, or read an SMS code to 'protect your account', it is social engineering.",
    redFlagEs: "Aislamiento de la víctima, urgencia extrema y petición de NIP/OTP.",
    redFlagEn: "Victim isolation, extreme urgency, and PIN/OTP requests.",
  },
  {
    id: "guaranteed-yield",
    agent: "VUCUB CAMÉ",
    titleEs: "Rendimientos garantizados y pagos previos son alerta roja",
    titleEn: "Guaranteed returns and upfront job fees are red flags",
    summaryEs: "Triplicar dinero en 48 horas o pagar un kit antes de empezar un empleo remoto son patrones clásicos de fraude.",
    summaryEn: "Tripling money in 48 hours or paying for an onboarding kit before starting remote work are classic fraud patterns.",
    redFlagEs: "Ganancia garantizada sin riesgo o depósito previo obligatorio.",
    redFlagEn: "Risk-free guaranteed profit or mandatory upfront deposit.",
  },
  {
    id: "qr-traps",
    agent: "IXBALANQUÉ",
    titleEs: "Un código QR de pago nunca sirve para recibir dinero",
    titleEn: "A payment QR code never receives incoming money for you",
    summaryEs: "Al escanear un QR de pago autorizas un envío saliente. Inspecciona siempre la URL o esquema antes de confirmar.",
    summaryEn: "Scanning a payment QR authorizes an outgoing transfer. Always inspect the URL or scheme before confirming.",
    redFlagEs: "Acortadores opacos o QRs pegados encima de avisos físicos.",
    redFlagEn: "Opaque shorteners or stickers pasted over physical signs.",
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
