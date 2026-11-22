// Traducción de las evidencias que produce el motor.
//
// POR QUÉ ESTÁ SEPARADO DEL MOTOR
// -------------------------------
// El motor determinista redacta en español y así se queda: sus cadenas son el
// contrato de 175 pruebas y cambiarlas para internacionalizar sería romper lo
// que está verificado. Esta capa traduce **al mostrar**, por coincidencia
// exacta del texto original.
//
// Por eso el mapa está indexado por la frase en español y no por el
// identificador del indicador: las mismas frases se repiten entre catálogos
// (`patterns`, `finance-patterns`, `voice`, `audit`) y así una sola entrada
// sirve para todas.
//
// LO QUE NO SE TRADUCE, Y SE DICE
// -------------------------------
// Las evidencias con datos interpolados —un fragmento citado del mensaje, una
// CLABE enmascarada, el nombre de un archivo— se construyen en tiempo de
// ejecución. Las plantillas frecuentes tienen una regla en `RULES`; el resto
// cae al español. `localizeIndicator` informa de ello con `fallback`, para que
// la interfaz pueda decirlo en lugar de disimularlo.

import type { Lang } from "./index.ts";

type Localized = {
  indicator: string;
  evidence: string;
  recommendation: string;
  limitation: string;
  source: string;
  /** `true` si alguna parte se quedó en español por no tener traducción. */
  fallback: boolean;
};

type IndicatorLike = {
  indicator: string;
  evidence: string;
  recommendation: string;
  limitation: string;
  source: string;
};

/**
 * Vocabularios cerrados que aparecen **dentro** de una frase con datos
 * interpolados: nombres de alfabeto, etiquetas de catálogo, valores como
 * «(predeterminado)». No son datos de la persona, así que se traducen; lo que
 * sí son datos —un host, una CLABE, el nombre de un banco, un fragmento del
 * mensaje— se deja intacto.
 *
 * El orden importa: las entradas más largas se sustituyen primero, para que
 * «banca de desarrollo» no se parta en «banco».
 */
const TOKENS: [string, string][] = [
  ["institución no identificada en el catálogo incorporado", "institution not identified in the built-in catalogue"],
  ["(entidad de ahorro y crédito popular)", "(popular savings and credit institution)"],
  ["(institución de pago electrónico)", "(electronic payment institution)"],
  ["no registrable (.test reservado)", "not registrable (.test is reserved)"],
  ["(no reconocida en la lista)", "(not recognised in the list)"],
  [".test (reservada para pruebas)", ".test (reserved for testing)"],
  ["no identificado en la lista", "not identified in the list"],
  ["(banca de desarrollo)", "(development banking)"],
  ["formato no reconocido", "format not recognised"],
  ["duración no legible", "duration not readable"],
  ["(predeterminado)", "(default)"],
  ["no identificable", "not identifiable"],
  ["(banco)", "(bank)"],
];

/**
 * Nombres de alfabeto, en español en el motor. Se traducen por elemento, nunca
 * por sustitución dentro de la cadena: «han» es una palabra española corriente
 * y aparece dentro de nombres propios, así que reemplazarla a ciegas
 * destrozaría otros textos.
 */
const SCRIPT_EN: Record<string, string> = {
  latino: "Latin",
  cirílico: "Cyrillic",
  griego: "Greek",
  armenio: "Armenian",
  árabe: "Arabic",
  hebreo: "Hebrew",
  han: "Han",
  cherokee: "Cherokee",
  "alfabeto no identificado": "unidentified alphabet",
};

/** Traduce una lista de alfabetos unida con «, » o « y ». */
function scripts(list: string, lang: Lang): string {
  if (lang === "es") return list;
  const parts = list
    .split(/,\s*|\s+y\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => SCRIPT_EN[part] ?? part);
  if (parts.length < 2) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** Traduce los vocabularios cerrados de un segmento, dejando el resto igual. */
function tok(value: string, lang: Lang): string {
  if (lang === "es") return value;
  const exact = EN[value];
  if (exact) return exact;
  let out = value;
  for (const [from, to] of TOKENS) out = out.split(from).join(to);
  return out;
}

/**
 * Reglas para las evidencias con datos interpolados: traducen el armazón de la
 * frase y reinsertan los datos sin tocarlos. `build` devuelve `null` cuando una
 * parte anidada no tiene traducción, para que la frase caiga entera al español
 * en lugar de quedarse a medias.
 */
const RULES: { test: RegExp; build: (m: RegExpMatchArray, lang: Lang) => string | null }[] = [
  // --- URL: estructura ---
  {
    test: /^Host: (.+); dominio registrable: (.+); terminación: (.+)\.$/,
    build: (m, l) => `Host: ${m[1]}; registrable domain: ${tok(m[2], l)}; suffix: ${tok(m[3], l)}.`,
  },
  {
    test: /^Esquema: (.+); host: (.+); puerto: (.+); ruta: (.+); parámetros: (\d+); fragmento: (sí|no)\.$/,
    build: (m, l) =>
      `Scheme: ${m[1]}; host: ${m[2]}; port: ${tok(m[3], l)}; path: ${m[4]}; parameters: ${m[5]}; fragment: ${m[6] === "sí" ? "yes" : "no"}.`,
  },
  {
    test: /^El host mide (\d+) caracteres, con (\d+) etiquetas, (\d+) guiones y (\d+) dígitos\.$/,
    build: (m) => `The host is ${m[1]} characters long, with ${m[2]} labels, ${m[3]} hyphens and ${m[4]} digits.`,
  },

  // --- URL: homógrafos y marcas ---
  {
    test: /^La etiqueta «(.+)» combina los alfabetos (.+) en un mismo nombre\.$/,
    build: (m, l) => `The label “${m[1]}” mixes the ${scripts(m[2], l)} alphabets in a single name.`,
  },
  {
    test: /^El host escrito contiene caracteres no ASCII \((.+)\)\.$/,
    build: (m, l) => `The host as written contains non-ASCII characters (${scripts(m[1], l)}).`,
  },
  {
    test: /^Al sustituir caracteres visualmente equivalentes, el host «(.+)» se lee como «(.+)», pero el dominio real no contiene ese nombre\.$/,
    build: (m) =>
      `Substituting visually equivalent characters, the host “${m[1]}” reads as “${m[2]}”, but the real domain does not contain that name.`,
  },
  {
    test: /^El nombre contiene «(.+)», una marca o término financiero, fuera de un dominio exactamente coincidente \(dominio registrable: (.+)\)\.$/,
    build: (m, l) =>
      `The name contains “${m[1]}”, a brand or financial term, outside an exactly matching domain (registrable domain: ${tok(m[2], l)}).`,
  },
  {
    test: /^El dominio registrable «(.+)» difiere en (\d+) carácter\(es\) de «(.+)»\.$/,
    build: (m) => `The registrable domain “${m[1]}” differs by ${m[2]} character(s) from “${m[3]}”.`,
  },
  {
    test: /^El dominio registrable «(.+)» une la marca «(.+)» con un término de acceso o seguridad\.$/,
    build: (m) => `The registrable domain “${m[1]}” joins the brand “${m[2]}” with an access or security term.`,
  },

  // --- URL: terminación, acortadores, subdominios, puerto ---
  {
    test: /^La terminación «\.(.+)» figura entre las de registro gratuito o barato con uso frecuente en campañas de phishing\.$/,
    build: (m) =>
      `The “.${m[1]}” suffix is among those with free or cheap registration that are frequently used in phishing campaigns.`,
  },
  {
    test: /^El dominio «(.+)» es un acortador: la dirección real queda oculta tras una redirección\.$/,
    build: (m) => `The domain “${m[1]}” is a shortener: the real address is hidden behind a redirect.`,
  },
  {
    test: /^El host tiene (\d+) niveles de subdominio \(«(.+)»\), lo que desplaza el dominio real fuera de la vista en pantallas estrechas\.$/,
    build: (m) =>
      `The host has ${m[1]} levels of subdomain (“${m[2]}”), which pushes the real domain out of sight on narrow screens.`,
  },
  {
    test: /^La URL apunta al puerto (.+), distinto de los puertos web habituales\.$/,
    build: (m) => `The URL points to port ${m[1]}, which is not one of the usual web ports.`,
  },

  // --- URL: ruta y destino ---
  {
    test: /^La ruta o los parámetros contienen «(.+)», propio de páginas de acceso, verificación o pago\.$/,
    build: (m) => `The path or parameters contain “${m[1]}”, typical of sign-in, verification or payment pages.`,
  },
  {
    test: /^La URL apunta directamente a un archivo ejecutable o instalable \((.+)\)\.$/,
    build: (m) => `The URL points directly to an executable or installable file (${m[1]}).`,
  },
  {
    test: /^La URL apunta a un archivo comprimido \((.+)\), formato usado para evadir inspección\.$/,
    build: (m) => `The URL points to a compressed file (${m[1]}), a format used to evade inspection.`,
  },
  {
    test: /^La ruta o los parámetros incluyen otra dirección \(«(.+)»\), patrón de redirección abierta o de disimulo del destino\.$/,
    build: (m) =>
      `The path or parameters include another address (“${m[1]}”), a pattern of open redirect or destination concealment.`,
  },

  // --- Coincidencias de patrón: armazón traducido, cita intacta ---
  {
    test: /^([\s\S]+?) Fragmento citado: «([\s\S]*)»\.$/,
    build: (m, l) => {
      const head = phrase(m[1], l);
      return head === null ? null : `${head} Quoted fragment: “${m[2]}”.`;
    },
  },

  // --- Enlaces dentro de un mensaje ---
  {
    test: /^Enlace en el mensaje · ([\s\S]+)$/,
    build: (m, l) => {
      const tail = phrase(m[1], l);
      return tail === null ? null : `Link in the message · ${tail}`;
    },
  },
  {
    test: /^Enlace «(.+)»: ([\s\S]+)$/,
    build: (m, l) => {
      const tail = phrase(m[2], l);
      return tail === null ? null : `Link “${m[1]}”: ${tail}`;
    },
  },
  {
    test: /^No se pudo analizar «(.+)»: ([\s\S]+)$/,
    build: (m, l) => `“${m[1]}” could not be parsed: ${tok(m[2], l)}`,
  },

  // --- Cobertura del contenido ---
  {
    test: /^Texto de (\d+) caracteres y (\d+) palabras, analizado íntegramente en el dispositivo\.$/,
    build: (m) => `${m[1]} characters and ${m[2]} words of text, analysed entirely on the device.`,
  },
  {
    test: /^Transcripción de (\d+) caracteres y (\d+) palabras, analizada íntegramente en el dispositivo\.$/,
    build: (m) => `${m[1]} characters and ${m[2]} words of transcript, analysed entirely on the device.`,
  },
  {
    test: /^Se detectaron (\d+) enlace\(s\); ninguno se abrió\. Analizados localmente: (\d+)\.$/,
    build: (m) => `${m[1]} link(s) detected; none was opened. Analysed locally: ${m[2]}.`,
  },
  {
    test: /^Se detectaron (\d+) enlace\(s\) en la transcripción; ninguno se abrió\.$/,
    build: (m) => `${m[1]} link(s) detected in the transcript; none was opened.`,
  },
  {
    test: /^Se detectaron (\d+) enlace\(s\); ninguno se abrió\.$/,
    build: (m) => `${m[1]} link(s) detected; none was opened.`,
  },

  // --- Llamadas ---
  {
    test: /^La transcripción no permite establecer (.+)\.$/,
    build: (m, l) => `The transcript does not establish ${tok(m[1], l)}.`,
  },
  {
    test: /^No comprobado: ([\s\S]+)$/,
    build: (m, l) => `Not checked: ${tok(m[1], l)}`,
  },

  // --- Metadatos de archivo (audio e imagen) ---
  {
    test: /^«(.+)» · (.+) · (\d+) KB(.*)\. Permanece en memoria y no se guarda\.$/,
    build: (m, l) => `“${m[1]}” · ${m[2]} · ${m[3]} KB${tok(m[4], l)}. It stays in memory and is not saved.`,
  },

  // --- Contenido financiero ---
  {
    test: /^El número (.+) tiene 18 dígitos pero su dígito verificador no cuadra: no es una CLABE válida\.$/,
    build: (m) => `Number ${m[1]} has 18 digits but its check digit does not add up: it is not a valid CLABE.`,
  },
  {
    test: /^Se detectó (\d+) CLABE\(s\) cuyo dígito verificador cuadra: (.+)\. Institución\(es\) según el código: ([\s\S]+)\.$/,
    build: (m, l) =>
      `${m[1]} CLABE(s) detected whose check digit adds up: ${m[2]}. Institution(s) according to the code: ${tok(m[3], l)}.`,
  },
  {
    test: /^El texto nombra a (.+), pero la CLABE indicada corresponde a ([\s\S]+)\.$/,
    build: (m, l) => `The text names ${m[1]}, but the CLABE given corresponds to ${tok(m[2], l)}.`,
  },
  {
    test: /^El texto contiene (\d+) números de cuenta distintos\.$/,
    build: (m) => `The text contains ${m[1]} different account numbers.`,
  },
  {
    test: /^El número (.+) tiene longitud de tarjeta pero no cumple el algoritmo de Luhn\.$/,
    build: (m) => `Number ${m[1]} has card length but does not satisfy the Luhn algorithm.`,
  },
  {
    test: /^Se detectó (\d+) número\(s\) con estructura de tarjeta válida: (.+)\.$/,
    build: (m) => `${m[1]} number(s) detected with valid card structure: ${m[2]}.`,
  },
  {
    test: /^Se detectó una dirección con forma de monedero: (.+)\.$/,
    build: (m) => `An address shaped like a wallet was detected: ${m[1]}.`,
  },
  {
    test: /^Que el verificador cuadre solo significa que el número está bien formado\. La cuenta de un estafador también lo cumple\. ([\s\S]+)$/,
    build: (m, l) => {
      const note = phrase(m[1], l);
      return note === null
        ? null
        : `A matching check digit only means the number is well formed. A fraudster's account satisfies it too. ${note}`;
    },
  },
  {
    test: /^No es prueba de fraude: una persona o un negocio puede pedir el depósito en otro banco con toda legitimidad\. ([\s\S]+)$/,
    build: (m, l) => {
      const note = phrase(m[1], l);
      return note === null
        ? null
        : `It is not proof of fraud: a person or a business may legitimately ask for the deposit at another bank. ${note}`;
    },
  },
  // --- Transcripción automática ---
  {
    test: /^Transcripción automática disponible \((.+)\)\. Es texto reconocido por una máquina, no una cita textual\.$/,
    build: (m, l) =>
      `Automatic transcript available (${tok(m[1], l)}). It is text recognised by a machine, not a verbatim quote.`,
  },
  {
    test: /^Transcripción no disponible en este entorno\.[ ]?([\s\S]*)$/,
    build: (m) => `Transcript not available in this environment. ${m[1]}`.trim(),
  },
  {
    test: /^No se pudo transcribir el audio\.[ ]?([\s\S]*)$/,
    build: (m) => `The audio could not be transcribed. ${m[1]}`.trim(),
  },
  {
    test: /^Analizados (\d+) de (\d+) enlace\(s\), solo de forma sintáctica\. Ninguno se abrió\.$/,
    build: (m) => `${m[1]} of ${m[2]} link(s) analysed, syntactically only. None was opened.`,
  },

  {
    test: /^(.+) y catálogo de instituciones incorporado$/,
    build: (m, l) => {
      const head = phrase(m[1], l);
      return head === null ? null : `${head} and built-in institutions catalogue`;
    },
  },
  // --- Teléfonos ---
  {
    test: /^Se detectaron (\d+) número\(s\) \((.+)\)\.$/,
    build: (m) => `${m[1]} phone number(s) detected (${m[2]}).`,
  },
  {
    test: /^Se encontró un número con prefijo de tarificación especial \((.+)\)\.$/,
    build: (m) => `A premium-rate prefix number was found (${m[1]}).`,
  },
  {
    test: /^El contenido incluye (\d+) números diferentes \((.+)\), patrón habitual en guiones de suplantación o redirección\.$/,
    build: (m) => `The content includes ${m[1]} different numbers (${m[2]}), a common pattern in impersonation or redirection scripts.`,
  },
  {
    test: /^El mensaje menciona una institución o paquetería e invita a contactar al número (.+)\.$/,
    build: (m) => `The message mentions an institution or parcel service and invites contacting ${m[1]}.`,
  },
  {
    test: /^Se combina un número internacional \((.+)\) con un enlace web\.$/,
    build: (m) => `An international number (${m[1]}) is combined with a web link.`,
  },
];

/** Frases exactas. Clave: el texto tal cual lo escribe el motor en español. */
const EN: Record<string, string> = {
  // ---- Catálogo general de patrones (patterns.ts) ----
  "Solicitud de contraseña, PIN o código": "Request for a password, PIN or code",
  "El texto pide de forma directa una contraseña, PIN, CVV o código de verificación.":
    "The text directly asks for a password, PIN, CVV or verification code.",
  "Ninguna institución legítima solicita contraseñas ni códigos de un solo uso. No los compartas y contacta a la entidad por su canal oficial.":
    "No legitimate institution asks for passwords or one-time codes. Do not share them and contact the organisation through its official channel.",
  "La coincidencia es textual; no identifica quién envió el mensaje ni su intención real.":
    "The match is textual; it does not identify who sent the message or their real intent.",

  "Solicitud de frase semilla o clave privada": "Request for a seed phrase or private key",
  "El texto menciona una frase semilla, frase de recuperación o clave privada de billetera.":
    "The text mentions a seed phrase, recovery phrase or wallet private key.",
  "Una frase semilla da control total e irreversible de los fondos. No existe soporte legítimo que la pida.":
    "A seed phrase gives total, irreversible control of the funds. No legitimate support service ever asks for it.",
  "La mención puede aparecer también en material educativo o de advertencia.":
    "The mention may also appear in educational or warning material.",

  "Cobro anticipado para recibir algo": "Advance payment to receive something",
  "El texto condiciona la entrega de un bien, premio o fondo a un pago, depósito o comisión previa.":
    "The text makes delivery of a good, prize or fund conditional on a prior payment, deposit or fee.",
  "Pagar por adelantado para recibir un beneficio es el patrón central del fraude de pago anticipado. No transfieras dinero y verifica por un canal independiente.":
    "Paying in advance to receive a benefit is the core pattern of advance-fee fraud. Do not transfer money and verify through an independent channel.",
  "Algunos cobros anticipados son legítimos (anticipos, aduanas reales); la señal indica el patrón, no el fraude.":
    "Some advance charges are legitimate (deposits, real customs fees); the signal indicates the pattern, not the fraud.",

  "Solicitud de datos bancarios completos": "Request for full banking details",
  "El texto solicita datos bancarios o de tarjeta que permiten disponer del dinero.":
    "The text asks for banking or card details that would allow access to the money.",
  "No envíes datos de tarjeta por mensaje. Usa únicamente la aplicación o el sitio oficial de tu banco.":
    "Do not send card details by message. Use only your bank's official app or website.",
  "La mención de datos bancarios puede ocurrir en contextos legítimos de facturación.":
    "Banking details may legitimately be mentioned in billing contexts.",

  "Presión de tiempo": "Time pressure",
  "El texto introduce una fecha límite o urgencia que reduce el tiempo de verificación.":
    "The text introduces a deadline or urgency that shortens the time available to verify.",
  "La urgencia es una técnica de presión. Tómate el tiempo de verificar por un canal oficial antes de actuar.":
    "Urgency is a pressure technique. Take the time to verify through an official channel before acting.",
  "La urgencia aparece también en comunicaciones legítimas y no implica fraude por sí sola.":
    "Urgency also appears in legitimate communications and does not imply fraud on its own.",

  "Amenaza de bloqueo o suspensión de cuenta": "Threat of account block or suspension",
  "El texto anuncia la suspensión de una cuenta o un cargo no reconocido para provocar una reacción inmediata.":
    "The text announces an account suspension or an unrecognised charge to provoke an immediate reaction.",
  "No uses los enlaces del mensaje. Abre la aplicación oficial o llama al número impreso en tu tarjeta.":
    "Do not use the links in the message. Open the official app or call the number printed on your card.",
  "Los avisos reales de seguridad usan un lenguaje similar; la señal no distingue el origen.":
    "Genuine security alerts use similar language; the signal does not distinguish the origin.",

  "Amenaza legal o de cobranza": "Legal or debt-collection threat",
  "El texto contiene una amenaza legal, de cobranza o de exposición de información.":
    "The text contains a legal, debt-collection or information-exposure threat.",
  "No respondas ni pagues. Las notificaciones judiciales reales no llegan por mensajería y se verifican ante la autoridad.":
    "Do not reply and do not pay. Real court notifications do not arrive by messaging app and are verified with the authority.",
  "No se verifica la existencia del procedimiento mencionado.":
    "The existence of the proceeding mentioned is not verified.",

  "Premio, sorteo o herencia no solicitada": "Unsolicited prize, raffle or inheritance",
  "El texto anuncia un premio, sorteo o herencia a favor del destinatario.":
    "The text announces a prize, raffle or inheritance in the recipient's favour.",
  "Si no participaste, no hay premio. No entregues datos ni pagos para reclamarlo.":
    "If you did not enter, there is no prize. Do not hand over details or payments to claim it.",
  "Existen sorteos legítimos; la señal solo registra el anuncio.":
    "Legitimate raffles exist; the signal only records the announcement.",

  "Traslado a un canal privado": "Move to a private channel",
  "El texto propone continuar la conversación en una aplicación privada, fuera del canal original.":
    "The text proposes continuing the conversation in a private app, outside the original channel.",
  "Cambiar de canal evita los controles antifraude de la plataforma original. Verifica la identidad antes de aceptar.":
    "Switching channels avoids the original platform's anti-fraud controls. Verify the identity before agreeing.",
  "Muchos negocios legítimos atienden por mensajería.":
    "Many legitimate businesses do serve customers over messaging apps.",

  "Oferta de empleo con condiciones improbables": "Job offer with improbable conditions",
  "El texto ofrece empleo con una combinación de alta remuneración y requisitos mínimos atípica para un proceso formal.":
    "The text offers a job with a combination of high pay and minimal requirements that is atypical for a formal process.",
  "Verifica la empresa en fuentes independientes. Un empleo real no exige pagos, ni datos bancarios antes de un contrato.":
    "Check the company in independent sources. A real job does not demand payments or banking details before a contract.",
  "Algunas ofertas flexibles reales coinciden con estas palabras; la señal no confirma un fraude laboral.":
    "Some genuine flexible offers match these words; the signal does not confirm employment fraud.",

  "Inversión con rendimiento garantizado": "Investment with guaranteed returns",
  "El texto promete un rendimiento garantizado, sin riesgo o extraordinariamente alto.":
    "The text promises a guaranteed, risk-free or extraordinarily high return.",
  "No existe inversión sin riesgo. Comprueba el registro de la entidad ante el regulador financiero correspondiente.":
    "There is no risk-free investment. Check the entity's registration with the relevant financial regulator.",
  "No se verifica la existencia ni el registro de la plataforma mencionada.":
    "The existence and registration of the platform mentioned are not verified.",

  "Condiciones de venta atípicas": "Atypical sale conditions",
  "El texto describe condiciones de venta que eliminan la protección del comprador o presionan la compra.":
    "The text describes sale conditions that remove buyer protection or pressure the purchase.",
  "Paga con métodos que permitan reclamación. Evita transferencias directas a personas físicas.":
    "Pay with methods that allow a chargeback. Avoid direct transfers to individuals.",
  "Las promociones agresivas también existen en comercios legítimos.":
    "Aggressive promotions also exist in legitimate shops.",

  "Petición de no informar a terceros": "Request not to tell anyone",
  "El texto pide ocultar la conversación o la operación a terceros.":
    "The text asks you to hide the conversation or the transaction from third parties.",
  "El aislamiento es una técnica de manipulación. Consulta la situación con alguien de confianza antes de actuar.":
    "Isolation is a manipulation technique. Talk the situation over with someone you trust before acting.",
  "La confidencialidad se solicita también en contextos legítimos.":
    "Confidentiality is also requested in legitimate contexts.",

  "Suplantación institucional con saludo genérico": "Institutional impersonation with a generic greeting",
  "El texto invoca a una institución reconocible pero se dirige al destinatario con un saludo genérico, sin datos personales verificables.":
    "The text invokes a recognisable institution but addresses the recipient with a generic greeting, with no verifiable personal details.",
  "Las comunicaciones reales suelen incluir datos específicos de tu cuenta. Verifica por el canal oficial.":
    "Genuine communications usually include specific details of your account. Verify through the official channel.",
  "Los correos masivos legítimos también usan saludos genéricos; la coincidencia de marca no prueba suplantación.":
    "Legitimate bulk emails also use generic greetings; a brand match does not prove impersonation.",

  "Exigencia de un medio de pago irreversible": "Demand for an irreversible payment method",
  "El texto exige un medio de pago sin posibilidad de reclamación ni reversión.":
    "The text demands a payment method with no possibility of dispute or reversal.",
  "Ninguna institución cobra con tarjetas de regalo o criptomonedas. Es un indicador consistente de fraude.":
    "No institution collects payment in gift cards or cryptocurrency. It is a consistent indicator of fraud.",
  "La compra legítima de tarjetas de regalo también coincide con estas palabras.":
    "Legitimately buying gift cards also matches these words.",

  "Contacto no solicitado con identidad imprecisa": "Unsolicited contact with a vague identity",
  "El texto presenta una identidad profesional sin datos verificables de identificación.":
    "The text presents a professional identity with no verifiable identifying details.",
  "Pide nombre completo, número de empleado y verifica por el conmutador oficial.":
    "Ask for a full name and employee number, and verify through the official switchboard.",
  "Señal débil: la presentación profesional es habitual en comunicaciones legítimas.":
    "Weak signal: professional introductions are common in legitimate communications.",

  // ---- Catálogo financiero (finance-patterns.ts) ----
  "Pide depositar a una cuenta personal en nombre de una empresa":
    "Asks for a deposit into a personal account on behalf of a company",
  "El texto pide pagar a una cuenta cuyo titular es una persona distinta de quien vende o cobra.":
    "The text asks you to pay into an account held by someone other than the seller or biller.",
  "Si compras a una empresa, el pago va a nombre de la empresa. Una cuenta personal impide reclamar y es el patrón habitual de la tienda falsa.":
    "If you buy from a company, the payment goes to the company's name. A personal account blocks any claim and is the usual pattern of a fake shop.",
  "Hay negocios pequeños y vendedores legítimos que cobran así. Es señal de alerta, no prueba de fraude.":
    "Small businesses and legitimate sellers do charge this way. It is a warning sign, not proof of fraud.",

  "Exige un medio de pago irreversible": "Demands an irreversible payment method",
  "El texto exige pagar por un medio que no admite reclamación ni devolución.":
    "The text demands payment by a method that allows no dispute or refund.",
  "Tarjetas de regalo, tiempo aire y criptomonedas no tienen marcha atrás ni intermediario a quien reclamar. Ninguna institución cobra así.":
    "Gift cards, phone credit and cryptocurrency have no way back and no intermediary to complain to. No institution collects payment this way.",
  "Algunos servicios legítimos aceptan estos medios; el indicio está en que sea el único aceptado.":
    "Some legitimate services accept these methods; the clue is that it is the only one accepted.",

  "Presión para transferir el dinero de inmediato": "Pressure to transfer the money immediately",
  "El texto presiona para mover dinero de inmediato.": "The text pressures you to move money immediately.",
  "No existen las «cuentas seguras» ni las «cuentas espejo»: nadie te pide mover tu dinero para protegerlo. Detente y verifica por el canal oficial.":
    "There is no such thing as a “safe account” or a “mirror account”: nobody asks you to move your money to protect it. Stop and verify through the official channel.",
  "La urgencia aparece también en cobros legítimos. Pesa cuando se combina con una cuenta que no puedes verificar.":
    "Urgency also appears in legitimate charges. It carries weight when combined with an account you cannot verify.",

  "Rendimiento garantizado con cifra concreta": "Guaranteed return with a specific figure",
  "El texto promete un rendimiento garantizado o una cifra de ganancia concreta.":
    "The text promises a guaranteed return or a specific profit figure.",
  "Ninguna inversión legítima garantiza rendimientos: por ley deben advertir del riesgo. Una cifra garantizada es la señal más clara de un esquema fraudulento.":
    "No legitimate investment guarantees returns: by law they must warn of the risk. A guaranteed figure is the clearest sign of a fraudulent scheme.",
  "Un instrumento de renta fija sí ofrece una tasa conocida, pero se expresa como tasa anual y con riesgo declarado, no como ganancia garantizada.":
    "A fixed-income instrument does offer a known rate, but it is expressed as an annual rate with declared risk, not as a guaranteed profit.",

  "Ganancia por reclutar a otras personas": "Earnings for recruiting other people",
  "El texto condiciona la ganancia a reclutar a otras personas.":
    "The text makes the earnings conditional on recruiting other people.",
  "Si el dinero viene de quienes entran después y no de una actividad real, es un esquema piramidal: colapsa siempre y los últimos lo pierden todo.":
    "If the money comes from those who join later rather than from a real activity, it is a pyramid scheme: it always collapses and the last in lose everything.",
  "Existen programas de referidos legítimos como complemento; la señal está en que el reclutamiento sea la fuente de la ganancia.":
    "Legitimate referral programmes exist as a supplement; the signal is recruitment being the source of the earnings.",

  "Afirma estar regulado sin dar registro verificable":
    "Claims to be regulated without giving a verifiable registration",
  "El texto afirma estar regulado o autorizado por una autoridad financiera.":
    "The text claims to be regulated or authorised by a financial authority.",
  "Compruébalo tú: el registro se consulta en el padrón público de la CNBV y en el SIPRES de la CONDUSEF. Esta herramienta no consultó ningún padrón y no puede confirmarlo ni desmentirlo.":
    "Check it yourself: registration is looked up in the CNBV public register and in CONDUSEF's SIPRES. This tool consulted no register and can neither confirm nor deny it.",
  "La afirmación puede ser cierta. Aquí solo se detecta que se afirma, no si es verdad: el padrón no se consultó.":
    "The claim may be true. All that is detected here is that it is made, not whether it is true: the register was not consulted.",

  "Oferta de crédito que exige un pago previo": "Loan offer that demands an up-front payment",
  "El texto ofrece un crédito y condiciona su entrega a un pago, depósito o comisión previa.":
    "The text offers a loan and makes its release conditional on a prior payment, deposit or fee.",
  "Una institución legítima descuenta sus comisiones del crédito; nunca te pide depositar antes de recibirlo. Y ninguna otorga crédito sin revisar tu historial.":
    "A legitimate institution deducts its fees from the loan; it never asks you to deposit before you receive it. And none grants credit without reviewing your history.",
  "Existen comisiones de apertura legítimas, pero se cobran del crédito entregado, no por adelantado.":
    "Legitimate arrangement fees exist, but they are taken from the loan once granted, not paid in advance.",

  "Cupo limitado o cierre inminente de la oportunidad":
    "Limited places or imminent closing of the opportunity",
  "El texto presenta la oportunidad de inversión como limitada o a punto de cerrar.":
    "The text presents the investment opportunity as limited or about to close.",
  "La escasez artificial sirve para que inviertas sin analizar. Una oportunidad real sigue ahí mañana.":
    "Artificial scarcity exists so that you invest without analysing. A real opportunity is still there tomorrow.",
  "Hay ofertas comerciales legítimas con plazo. Por sí sola es una señal débil.":
    "There are legitimate time-limited commercial offers. On its own this is a weak signal.",

  "Presenta un comprobante como prueba de pago": "Presents a receipt as proof of payment",
  "El texto afirma haber pagado y presenta o anuncia un comprobante.":
    "The text claims a payment was made and shows or announces a receipt.",
  "No tomes un comprobante como pago recibido. Confirma el abono en tu propia cuenta, en tu aplicación bancaria, antes de entregar nada.":
    "Do not treat a receipt as payment received. Confirm the credit in your own account, in your banking app, before handing anything over.",
  "Esta herramienta no puede verificar si la transferencia ocurrió, ni si el comprobante es auténtico. Solo detecta que se afirma.":
    "This tool cannot verify whether the transfer happened, or whether the receipt is genuine. It only detects that the claim is made.",

  "Pide los datos completos de una tarjeta": "Asks for the full details of a card",
  "El texto solicita el número completo de la tarjeta, su vigencia, el código de seguridad o una fotografía de ella.":
    "The text asks for the full card number, its expiry date, the security code or a photograph of it.",
  "Con esos tres datos se puede comprar en tu nombre. Nadie legítimo los necesita juntos, y menos en una fotografía.":
    "With those three details, purchases can be made in your name. Nobody legitimate needs them together, least of all in a photograph.",
  "Un comercio legítimo pide estos datos en su propia pasarela de pago cifrada, nunca por mensaje ni por teléfono.":
    "A legitimate merchant asks for these details on its own encrypted payment page, never by message or by phone.",

  // ---- Catálogo de voz (voice.ts) ----
  "Quien llama dice representar a una institución": "The caller claims to represent an institution",
  "Quien llama se presenta como representante de una institución o de un área de seguridad.":
    "The caller introduces themselves as a representative of an institution or of a security department.",
  "Cuelga y marca tú al número oficial que aparece en tu tarjeta, tu recibo o el sitio de la institución. Nunca al número que te den en la llamada.":
    "Hang up and dial the official number yourself, the one on your card, your statement or the institution's site. Never the number given to you on the call.",
  "Las instituciones también llaman de verdad. Lo que distingue al fraude es lo que pide después, no cómo se presenta.":
    "Institutions do make real calls. What distinguishes fraud is what it asks for next, not how it introduces itself.",

  "Pide instalar una aplicación de control remoto": "Asks you to install a remote-control app",
  "La llamada pide instalar una aplicación de control remoto o compartir la pantalla del dispositivo.":
    "The call asks you to install a remote-control app or to share your device's screen.",
  "No la instales. Quien controla tu pantalla puede ver tus claves y mover tu dinero mientras hablas contigo. Ninguna institución legítima lo pide.":
    "Do not install it. Whoever controls your screen can see your passwords and move your money while they talk to you. No legitimate institution asks for this.",
  "El soporte técnico de un servicio contratado por ti sí puede usar estas herramientas; la diferencia es que la llamada la iniciaste tú.":
    "Technical support for a service you signed up to may use these tools; the difference is that you started the call.",

  "Ofrece transferir la llamada a otra área": "Offers to transfer the call to another department",
  "La llamada propone transferirte a un ejecutivo, supervisor o área especializada.":
    "The call offers to transfer you to an agent, a supervisor or a specialist department.",
  "La transferencia sirve para dar apariencia de estructura. Cuelga y verifica por el canal oficial antes de continuar.":
    "The transfer exists to give an appearance of structure. Hang up and verify through the official channel before continuing.",
  "Es una práctica normal en centros de atención legítimos. Solo cuenta junto con otras señales.":
    "This is normal practice in legitimate call centres. It only counts alongside other signals.",

  "Exige no colgar o no avisar a nadie": "Demands that you not hang up or tell anyone",
  "La llamada exige mantener la línea abierta o no avisar a nadie, lo que impide verificar lo que se afirma.":
    "The call demands that you keep the line open or tell nobody, which prevents you from verifying what is claimed.",
  "Esta es la señal más constante del fraude telefónico y la única cuya finalidad es impedirte comprobar. Cuelga y llama tú a quien dicen ser.":
    "This is the most constant signal of phone fraud and the only one whose purpose is to stop you checking. Hang up and call whoever they claim to be yourself.",
  "Un operador legítimo puede pedir que no cuelgues por motivos de proceso, pero nunca que no avises a nadie.":
    "A legitimate operator may ask you not to hang up for procedural reasons, but never that you tell nobody.",

  "Afirma tener retenido a un familiar": "Claims to be holding a relative",
  "La llamada afirma tener retenido o detenido a un familiar.":
    "The call claims that a relative is being held or has been detained.",
  "Es el patrón del secuestro virtual. Cuelga e intenta contactar directamente a esa persona por otro teléfono. En la mayoría de los casos está bien y nunca estuvo en peligro.":
    "This is the virtual kidnapping pattern. Hang up and try to reach that person directly on another phone. In most cases they are fine and were never in danger.",
  "La coincidencia es textual. No determina si la afirmación es cierta, y en una emergencia real la verificación directa sigue siendo el primer paso.":
    "The match is textual. It does not determine whether the claim is true, and in a real emergency direct verification is still the first step.",

  "Amenaza con daño físico": "Threatens physical harm",
  "La llamada contiene una amenaza de daño físico o menciona conocer el domicilio.":
    "The call contains a threat of physical harm or claims to know your address.",
  "No negocies ni pagues. Cuelga, resguárdate y denuncia. Los datos personales que mencionan suelen provenir de una filtración, no de una vigilancia real.":
    "Do not negotiate and do not pay. Hang up, get to safety and report it. The personal details they mention usually come from a data leak, not from real surveillance.",
  "La coincidencia es textual y no mide la capacidad real de quien amenaza.":
    "The match is textual and does not measure the real capability of whoever is threatening.",

  "Dicta una cuenta para depositar durante la llamada":
    "Dictates an account for a deposit during the call",
  "La llamada dicta datos de una cuenta para que hagas un depósito o transferencia.":
    "The call dictates account details so that you make a deposit or transfer.",
  "Una transferencia a una cuenta dictada por teléfono es prácticamente irrecuperable. No la hagas sin verificar por el canal oficial de la institución.":
    "A transfer to an account dictated over the phone is practically unrecoverable. Do not make it without verifying through the institution's official channel.",
  "También ocurre en cobros legítimos entre particulares. El riesgo está en no poder verificar a quién pertenece la cuenta.":
    "This also happens in legitimate payments between individuals. The risk lies in not being able to verify who owns the account.",

  "Anuncia un cargo no reconocido o una compra sospechosa":
    "Announces an unrecognised charge or a suspicious purchase",
  "La llamada anuncia un cargo o movimiento no reconocido en tu cuenta.":
    "The call announces an unrecognised charge or movement on your account.",
  "Es la apertura más común del fraude telefónico bancario. No confirmes ni niegues nada: cuelga y revisa tu cuenta en la aplicación oficial o llamando al número de tu tarjeta.":
    "This is the most common opening of banking phone fraud. Neither confirm nor deny anything: hang up and check your account in the official app or by calling the number on your card.",
  "Los bancos sí avisan de cargos sospechosos. La diferencia es que un banco real nunca te pide el NIP, la clave dinámica ni el código que te llega por mensaje.":
    "Banks do warn about suspicious charges. The difference is that a real bank never asks for your PIN, your dynamic password or the code sent to you by message.",

  "Pide verificar tu identidad entregando datos completos":
    "Asks you to verify your identity by handing over full details",
  "La llamada pide datos completos de identificación o de la tarjeta para «verificar».":
    "The call asks for complete identification or card details in order to “verify”.",
  "Quien te llama de verdad desde tu banco ya tiene tus datos: no necesita que se los dictes. Si te los pide, no es tu banco.":
    "Whoever really calls you from your bank already has your details: they do not need you to read them out. If they ask for them, it is not your bank.",
  "Un centro de atención legítimo puede pedir datos parciales de identificación, nunca el número completo, la fecha y el código de seguridad.":
    "A legitimate call centre may ask for partial identification details, never the full number, the expiry date and the security code.",

  "Presión para actuar durante la llamada": "Pressure to act during the call",
  "La llamada impone un plazo inmediato para decidir o actuar.":
    "The call imposes an immediate deadline to decide or to act.",
  "La urgencia existe para que no te detengas a verificar. Ningún trámite legítimo se pierde por colgar y volver a llamar al número oficial.":
    "Urgency exists so that you do not stop to verify. No legitimate procedure is lost by hanging up and calling the official number back.",
  "Hay avisos legítimos con plazo. La señal pesa cuando aparece junto con una petición de datos o de dinero.":
    "There are legitimate time-limited notices. The signal carries weight when it appears alongside a request for details or money.",

  "Menciona datos personales para generar confianza":
    "Mentions personal details to build trust",
  "La llamada recita datos personales tuyos como prueba de legitimidad.":
    "The call recites personal details of yours as proof of legitimacy.",
  "Conocer tus datos no acredita a nadie: circulan en filtraciones y bases vendidas. No lo tomes como prueba de que la llamada sea real.":
    "Knowing your details proves nothing: they circulate in leaks and in sold databases. Do not take it as proof that the call is genuine.",
  "Un operador legítimo también confirma datos. La señal está en usarlos como argumento de credibilidad.":
    "A legitimate operator also confirms details. The signal lies in using them as an argument for credibility.",

  "Anuncia un premio por teléfono": "Announces a prize by phone",
  "La llamada anuncia un premio, sorteo o selección que no solicitaste.":
    "The call announces a prize, raffle or selection that you did not enter.",
  "No participaste, no hay premio. Si además piden un pago o tus datos para «liberarlo», es fraude.":
    "You did not enter, so there is no prize. If they also ask for a payment or your details to “release” it, it is fraud.",
  "Existen promociones legítimas; ninguna exige pagar por adelantado para cobrar.":
    "Legitimate promotions exist; none require payment in advance in order to collect.",

  "Cobranza con amenaza de acción legal inmediata":
    "Debt collection with a threat of immediate legal action",
  "La llamada amenaza con embargo, demanda o detención inmediata por un adeudo.":
    "The call threatens seizure, a lawsuit or immediate arrest over a debt.",
  "La cobranza legítima no amenaza con detención ni embarga por teléfono. Pide el número de expediente por escrito y verifica con la institución acreedora.":
    "Legitimate debt collection does not threaten arrest and does not seize assets by phone. Ask for the case number in writing and verify with the creditor institution.",
  "Puede existir un adeudo real. Lo que no es legítimo es la amenaza inmediata y la exigencia de pago en la misma llamada.":
    "A real debt may exist. What is not legitimate is the immediate threat and the demand for payment on the same call.",

  "Se niega a dar datos verificables": "Refuses to give verifiable details",
  "La llamada se niega a dar un dato que permita verificarla, o pide no llamar a la institución.":
    "The call refuses to give any detail that would allow it to be verified, or asks you not to call the institution.",
  "Una llamada legítima resiste la verificación. Si te piden no comprobarla, ya tienes la respuesta.":
    "A legitimate call withstands verification. If they ask you not to check it, you already have your answer.",
  "Algunos operadores legítimos no dan datos personales propios por política interna.":
    "Some legitimate operators do not give out their own personal details, as a matter of internal policy.",

  // ---- Indicadores de la auditoría (audit.ts) ----
  "Dominio y terminación": "Domain and suffix",
  "Estructura normalizada": "Normalised structure",
  "HTTPS y certificado": "HTTPS and certificate",
  "Dirección IP en el host": "IP address in the host",
  "Nombre internacionalizado": "Internationalised name",
  "Mezcla de alfabetos en el dominio": "Mixed alphabets in the domain",
  "Caracteres no ASCII en el dominio": "Non-ASCII characters in the domain",
  "Marca reconstruida con caracteres similares": "Brand rebuilt with lookalike characters",
  "Posible marca en el host": "Possible brand in the host",
  "Dominio tipográficamente cercano a una marca": "Domain typographically close to a brand",
  "Dominio que combina marca y palabra de seguridad":
    "Domain combining a brand with a security word",
  "Terminación con abuso frecuente": "Suffix with frequent abuse",
  "Servicio de acortamiento de enlaces": "Link-shortening service",
  "Exceso de subdominios": "Excess of subdomains",
  "Puerto no estándar": "Non-standard port",
  "Ruta orientada a credenciales": "Path oriented towards credentials",
  "Enlace a un archivo ejecutable": "Link to an executable file",
  "Enlace a un archivo comprimido": "Link to a compressed file",
  "Otra dirección incrustada en la URL": "Another address embedded in the URL",
  "Host extenso u ofuscado": "Long or obfuscated host",
  "Reputación, redirecciones, RDAP y DNS": "Reputation, redirects, RDAP and DNS",
  "Enlace no analizable": "Link that cannot be parsed",
  "Contenido analizado": "Content analysed",
  "El mensaje contiene enlaces": "The message contains links",
  "Transcripción analizada": "Transcript analysed",
  "La transcripción menciona enlaces": "The transcript mentions links",
  "Archivo de audio recibido": "Audio file received",
  "Contenido financiero analizado": "Financial content analysed",
  "CLABE con dígito verificador incorrecto": "CLABE with an incorrect check digit",
  "CLABE con estructura válida": "CLABE with a valid structure",
  "La cuenta no pertenece al banco que nombra el mensaje":
    "The account does not belong to the bank the message names",
  "Se mencionan varias cuentas distintas": "Several different accounts are mentioned",
  "Número de tarjeta que no pasa la validación de Luhn":
    "Card number that fails Luhn validation",
  "El texto contiene un número de tarjeta": "The text contains a card number",
  "Dirección con forma de monedero de criptomoneda":
    "Address shaped like a cryptocurrency wallet",
  "El contenido financiero incluye enlaces": "The financial content includes links",
  "Imagen adjunta": "Attached image",
  "Lectura de texto en la imagen": "Text recognition in the image",
  "Transcripción del audio pendiente": "Audio transcript pending",

  // ---- Evidencias fijas de la auditoría ----
  "La URL usa HTTP sin cifrado declarado.": "The URL uses HTTP with no declared encryption.",
  "La URL declara HTTPS; no se consultó su certificado.":
    "The URL declares HTTPS; its certificate was not checked.",
  "No se consultaron fuentes externas ni se siguieron enlaces.":
    "No external sources were consulted and no links were followed.",
  "El dominio contiene una etiqueta Punycode (xn--).":
    "The domain contains a Punycode label (xn--).",
  "El host es una dirección IP, no un dominio.": "The host is an IP address, not a domain.",
  "No se ejecutó reconocimiento de texto local. Si la imagen se procesa, lo hace el modelo multimodal bajo consentimiento explícito.":
    "No local text recognition was run. If the image is processed, the multimodal model does it, under explicit consent.",
  "No se dispone de texto confirmado por OCR local para esta imagen. Puede no haber soporte, no haber texto legible o haber ocurrido un error.": "No locally recognized text is available for this image. OCR may be unsupported, the text unreadable, or an error may have occurred.",
  "Se reconoció texto automáticamente; puede haber errores u omisiones y debe cotejarse con la imagen.": "Text was recognized automatically; errors or omissions are possible, so check it against the image.",
  "El audio no se ha transcrito. Puedes escribir tú lo que recuerdes de la llamada y analizarlo como transcripción.":
    "The audio has not been transcribed. You can type out what you remember of the call and analyse that as a transcript.",
  "Escribe tú lo que recuerdes de la llamada y analízalo como transcripción.":
    "Type out what you remember of the call and analyse it as a transcript.",
  "Sin transcripción no se analizó ni una palabra del audio. El contenido de la llamada está sin revisar.":
    "With no transcript, not a single word of the audio was analysed. The content of the call is unreviewed.",

  // ---- Recomendaciones de la auditoría ----
  "Analiza el enlace por separado antes de abrirlo.":
    "Analyse the link separately before opening it.",
  "Compara el dominio con el canal oficial escrito manualmente.":
    "Compare the domain with the official channel typed out by hand.",
  "Compara la dirección normalizada con la que creías visitar.":
    "Compare the normalised address with the one you thought you were visiting.",
  "Comparte solo el contenido necesario para el análisis.":
    "Share only the content needed for the analysis.",
  "Comparte solo el fragmento relevante de la llamada.":
    "Share only the relevant fragment of the call.",
  "Comparte solo lo necesario de la conversación.":
    "Share only what is necessary from the conversation.",
  "Comprueba el dominio completo antes de actuar.":
    "Check the full domain before acting.",
  "Comprueba la dirección oficial por un canal independiente.":
    "Check the official address through an independent channel.",
  "Consulta fuentes oficiales independientemente.":
    "Consult official sources independently.",
  "Cubre los datos personales visibles antes de compartir una captura.":
    "Cover any visible personal data before sharing a screenshot.",
  "Dato de contexto: no lo tomes como prueba de que la cuenta sea legítima ni de que pertenezca a quien dice el mensaje.":
    "Context only: do not take it as proof that the account is legitimate or that it belongs to whoever the message says.",
  "El dominio que ves al principio puede no ser el destino. No continúes sin verificar.":
    "The domain you see at the start may not be the destination. Do not continue without verifying.",
  "El número que aparece en la pantalla puede falsificarse. No lo tomes como prueba de quién llamó.":
    "The number shown on your screen can be spoofed. Do not take it as proof of who called.",
  "Escribe el dominio oficial a mano y compara. Los dominios con una letra cambiada son un patrón habitual de suplantación.":
    "Type the official domain by hand and compare. Domains with one letter changed are a common impersonation pattern.",
  "Escribe la dirección oficial a mano en el navegador. La mezcla de alfabetos se usa para imitar nombres conocidos.":
    "Type the official address by hand in the browser. Mixed alphabets are used to imitate well-known names.",
  "Evita introducir información hasta verificar el origen.":
    "Avoid entering any information until you have verified the origin.",
  "Extrema la verificación; esta terminación no implica fraude por sí misma.":
    "Verify with extra care; this suffix does not imply fraud on its own.",
  "Las marcas no registran dominios de este tipo para atención a clientes. Accede por la aplicación oficial.":
    "Brands do not register domains of this kind for customer service. Use the official app instead.",
  "Lee el dominio de derecha a izquierda: lo que importa es la parte final, no la inicial.":
    "Read the domain from right to left: what matters is the final part, not the first.",
  "Los nombres largos dificultan ver el dominio real en un móvil.":
    "Long names make the real domain hard to see on a phone.",
  "Los servicios públicos de una marca no suelen publicarse en puertos atípicos.":
    "A brand's public services are not usually published on unusual ports.",
  "Nadie que espere cobrarte de verdad te da una CLABE inválida. Puede ser un número inventado o mal copiado: no transfieras.":
    "Nobody who genuinely expects to be paid gives you an invalid CLABE. It may be made up or mistyped: do not transfer.",
  "No abras archivos comprimidos recibidos por enlace sin verificar el origen.":
    "Do not open compressed files received by link without verifying the origin.",
  "No abras enlaces de pago recibidos por mensaje: entra tú a la aplicación oficial.":
    "Do not open payment links received by message: go into the official app yourself.",
  "No abras enlaces recibidos sin verificar el remitente por otro canal.":
    "Do not open links you receive without verifying the sender through another channel.",
  "No compartas números de cuenta o tarjeta completos más allá de lo necesario.":
    "Do not share full account or card numbers beyond what is necessary.",
  "No descargues ni instales archivos recibidos por enlace. Instala solo desde tiendas oficiales.":
    "Do not download or install files received by link. Install only from official stores.",
  "No es un número de tarjeta válido. Desconfía del origen del mensaje.":
    "It is not a valid card number. Treat the origin of the message with suspicion.",
  "No escribas credenciales en una página abierta desde un enlace recibido. Entra por la app oficial.":
    "Do not type credentials into a page opened from a link you received. Go in through the official app.",
  "No introduzcas datos sensibles sin verificar el sitio.":
    "Do not enter sensitive data without verifying the site.",
  "No uses este enlace. Accede escribiendo el dominio oficial a mano.":
    "Do not use this link. Go in by typing the official domain by hand.",
  "Pide el enlace completo al remitente. No se puede evaluar un destino que no se conoce.":
    "Ask the sender for the full link. A destination that is unknown cannot be assessed.",
  "Revisa el enlace manualmente antes de abrirlo.":
    "Review the link manually before opening it.",
  "Si el contenido importante está en la imagen, transcribe también el texto para que el análisis determinista lo cubra.":
    "If the important content is inside the image, type the text out as well so that the deterministic analysis covers it.",
  "Un cobro «de tu banco» que se paga a una cuenta de otra institución merece una llamada al número oficial de tu tarjeta antes de transferir.":
    "A charge “from your bank” that is paid into an account at another institution deserves a call to the official number on your card before you transfer.",
  "Un número de tarjeta no debe viajar por mensaje. Si es tuyo, bórralo de la conversación; si te lo enviaron, no lo reenvíes.":
    "A card number should not travel by message. If it is yours, delete it from the conversation; if it was sent to you, do not forward it.",
  "Un pago en criptomoneda no se puede revertir ni reclamar a nadie. Es el medio preferido del fraude por esa razón.":
    "A cryptocurrency payment cannot be reversed and cannot be claimed from anyone. That is exactly why fraud prefers it.",
  "Varias cuentas en un mismo mensaje es un patrón de reenvío de fraude. Confirma el dato por el canal oficial antes de pagar.":
    "Several accounts in one message is a fraud-forwarding pattern. Confirm the detail through the official channel before paying.",
  "Verifica visualmente el dominio carácter por carácter.":
    "Check the domain visually, character by character.",

  // ---- Limitaciones de la auditoría ----
  "Algunos dominios multilingües legítimos mezclan alfabetos; la señal no confirma suplantación.":
    "Some legitimate multilingual domains mix alphabets; the signal does not confirm impersonation.",
  "El análisis sintáctico no verifica propiedad ni existencia.":
    "Syntactic analysis verifies neither ownership nor existence.",
  "El catálogo de patrones es parcial: la ausencia de coincidencias no demuestra que el mensaje sea legítimo.":
    "The pattern catalogue is partial: the absence of matches does not prove the message is legitimate.",
  "El catálogo es parcial y la transcripción no acredita la identidad de quien llamó: la ausencia de coincidencias no demuestra que la llamada fuera legítima.":
    "The catalogue is partial and the transcript does not establish the caller's identity: the absence of matches does not prove the call was legitimate.",
  "El destino real de cada enlace queda sin comprobar porque las consultas de red están deshabilitadas.":
    "The real destination of each link remains unchecked because network queries are disabled.",
  "El destino real del enlace queda sin comprobar.":
    "The real destination of the link remains unchecked.",
  "El plegado es heurístico y puede coincidir con nombres legítimos que se parezcan a una marca.":
    "The folding is heuristic and may match legitimate names that resemble a brand.",
  "El reparto de archivos comprimidos es habitual y legítimo.":
    "Sharing compressed files is common and legitimate.",
  "El texto no permite verificar a quién pertenece ninguna cuenta.":
    "The text does not make it possible to verify who owns any account.",
  "El texto no permite verificar la identidad real del remitente.":
    "The text does not make it possible to verify the sender's real identity.",
  "Entornos de desarrollo y paneles internos usan puertos atípicos legítimamente.":
    "Development environments and internal dashboards legitimately use unusual ports.",
  "Es lo que se escribió o se reconoció del audio, no una grabación verificada. No permite identificar a quien llamó.":
    "This is what was typed or recognised from the audio, not a verified recording. It does not identify the caller.",
  "Esta herramienta no accede al registro de llamadas ni a datos de la operadora, por diseño.":
    "This tool does not access the call log or carrier data, by design.",
  "La ausencia de señales no demuestra que un sitio sea seguro.":
    "The absence of signals does not prove a site is safe.",
  "La lista de marcas es parcial y nombres legítimos pueden parecerse a una marca por coincidencia.":
    "The brand list is partial and legitimate names may resemble a brand by coincidence.",
  "La longitud por sí sola no indica intención maliciosa.":
    "Length alone does not indicate malicious intent.",
  "La normalización no revela el destino tras posibles redirecciones.":
    "Normalisation does not reveal the destination after any redirects.",
  "Las infraestructuras grandes usan subdominios profundos de forma legítima.":
    "Large infrastructures legitimately use deep subdomains.",
  "Las páginas de acceso legítimas usan exactamente las mismas palabras en su ruta.":
    "Legitimate sign-in pages use exactly the same words in their path.",
  "Las señales deterministas de texto no se aplican al contenido que solo aparece dentro de la imagen.":
    "The deterministic text signals do not apply to content that appears only inside the image.",
  "Los dominios internacionalizados son legítimos y habituales.":
    "Internationalised domains are legitimate and common.",
  "Los parámetros de retorno son habituales en flujos de acceso legítimos.":
    "Return parameters are common in legitimate sign-in flows.",
  "Muchos sitios legítimos usan estas terminaciones. Señal de contexto, no de culpabilidad.":
    "Many legitimate sites use these suffixes. A signal of context, not of guilt.",
  "No se abre el sitio ni se comprueba TLS.": "The site is not opened and TLS is not checked.",
  "No se consultó ninguna institución financiera ni padrón regulatorio. Una cuenta bien formada no es una cuenta legítima, y esta herramienta no puede confirmar que un pago se haya recibido.":
    "No financial institution and no regulatory register was consulted. A well-formed account is not a legitimate account, and this tool cannot confirm that a payment was received.",
  "No se descargó ni analizó el archivo; la extensión puede no reflejar su contenido.":
    "The file was not downloaded or analysed; the extension may not reflect its content.",
  "No se extrajo texto de la imagen en el dispositivo.":
    "No text was extracted from the image on the device.",
  "No se confirmó la lectura local de esta imagen.": "Local text recognition for this image was not confirmed.",
  "El texto reconocido automáticamente puede contener errores u omisiones.": "Automatically recognized text may contain errors or omissions.",
  "El OCR puede pasar por alto contenido; coteja el texto con la imagen.": "OCR can miss content; check the text against the image.",
  "No se inspeccionaron certificados, reputación, titularidad ni destino final.":
    "Certificates, reputation, ownership and final destination were not inspected.",
  "No se recibió contenido que auditar.": "No content was received to audit.",
  "No se resolvió la redirección: el destino final permanece sin comprobar.":
    "The redirect was not resolved: the final destination remains unchecked.",
  "Puede ocurrir en una conversación legítima que corrige un dato.":
    "This can happen in a legitimate conversation that corrects a detail.",
  "Puede ser un número de referencia, un folio o un identificador que no es una tarjeta.":
    "It may be a reference number, a docket number or an identifier that is not a card.",
  "Punycode es legítimo en muchos dominios y no confirma suplantación.":
    "Punycode is legitimate in many domains and does not confirm impersonation.",
  "Que pase Luhn solo significa que está bien formado: no indica que la tarjeta exista, esté activa ni a quién pertenece.":
    "Passing Luhn only means it is well formed: it does not indicate that the card exists, is active, or whose it is.",
  "Regla heurística limitada; puede producir falsos positivos y no identifica todos los homógrafos.":
    "A limited heuristic rule; it may produce false positives and does not identify every homoglyph.",
  "Solo se comprobó la forma de la cadena. No se consultó ninguna cadena de bloques: no se sabe si la dirección existe, ni su saldo, ni su historial.":
    "Only the shape of the string was checked. No blockchain was consulted: whether the address exists, its balance and its history are all unknown.",
  "Son los metadatos del archivo. No dicen nada sobre lo que se dijo en la llamada ni sobre quién habló.":
    "These are the file's metadata. They say nothing about what was said on the call or about who spoke.",
  "También puede ser un error de transcripción al copiar el número. Verifícalo con la persona por un canal que ya conocías.":
    "It may also be a transcription error when copying the number. Check it with the person through a channel you already knew.",
  "Un enlace no analizable no implica que sea seguro ni peligroso.":
    "A link that cannot be parsed is neither safe nor dangerous by implication.",
  "Un socio o distribuidor autorizado podría usar un nombre parecido.":
    "An authorised partner or distributor could use a similar name.",
  "Una imagen sin señales no indica seguridad: su contenido no se analizó de forma determinista.":
    "An image with no signals does not indicate safety: its content was not analysed deterministically.",
  "Una IP no demuestra fraude.": "An IP address does not prove fraud.",

  // ---- Fuentes ----
  "Comparación de rangos Unicode del host escrito":
    "Comparison of Unicode ranges in the host as written",
  "Comparación en el dispositivo entre el texto y el código de la CLABE":
    "On-device comparison between the text and the CLABE code",
  "Comprobación de formato en el dispositivo": "Format check on the device",
  "Comprobaciones de red deshabilitadas en esta versión":
    "Network checks disabled in this version",
  "Distancia de edición local contra una lista de marcas":
    "Local edit distance against a list of brands",
  "Lista local de acortadores conocidos": "Local list of known shorteners",
  "Lista local de terminaciones con abuso documentado":
    "Local list of suffixes with documented abuse",
  "OCR local no implementado": "Local OCR not implemented",
  "OCR local no confirmado": "Local OCR not confirmed",
  "Reconocimiento del navegador": "Browser text recognition",
  "Plegado local de caracteres confundibles": "Local folding of confusable characters",
  "Metadatos leídos en el dispositivo": "Metadata read on the device",
  "Análisis local de la URL y lista de sufijos públicos":
    "Local analysis of the URL plus the public suffix list",
  "Análisis local de los enlaces escritos en el texto":
    "Local analysis of the links written in the text",
  "Comparación local contra el catálogo de patrones de fraude":
    "Local comparison against the fraud pattern catalogue",
  "Comparación local contra los catálogos de patrones de fraude y de llamadas":
    "Local comparison against the fraud pattern and call catalogues",
  "Comparación local contra los catálogos de fraude y comprobación aritmética":
    "Local comparison against the fraud catalogues plus arithmetic verification",
  "Cálculo del dígito verificador en el dispositivo": "Check-digit calculation on the device",

  // Nota obligatoria del catálogo de instituciones (CATALOGUE_NOTE).
  "El nombre proviene de una tabla incorporada en la aplicación (subconjunto de la lista pública de participantes del SPEI), no de una consulta a Banco de México. Saber a qué institución corresponde el rango de un número no dice si la cuenta existe, de quién es, ni si el cobro es legítimo.":
    "The name comes from a table built into the app (a subset of the public list of SPEI participants), not from a query to Banco de México. Knowing which institution a number's range belongs to says nothing about whether the account exists, whose it is, or whether the charge is legitimate.",

  // ---- Etiquetas de cobertura ----
  "Sin contenido analizado.": "No content analysed.",
  "Solo metadatos locales de la imagen; sin lectura de su contenido.":
    "Local image metadata only; its content is not read.",
  "Metadatos y texto reconocido automáticamente; lectura incompleta posible.": "Metadata and automatically recognized text; the reading may be incomplete.",
  "Solo sintaxis y señales locales; sin inspección de red.":
    "Syntax and local signals only; no network inspection.",
  "Texto completo analizado localmente, con comprobación aritmética de CLABE y Luhn. No se consultó ninguna institución.":
    "Full text analysed locally, with arithmetic verification of CLABE and Luhn. No institution was consulted.",
  "Transcripción completa analizada localmente con los catálogos general y de llamadas.":
    "Full transcript analysed locally with the general and call catalogues.",

  "Texto completo analizado localmente; los enlaces solo de forma sintáctica.":
    "Full text analysed locally; the links only syntactically.",
  "Texto completo analizado localmente.": "Full text analysed locally.",
  "No se encontraron enlaces en el texto.": "No links were found in the text.",
  "Metadatos leídos y transcripción automática obtenida; su exactitud no está verificada.":
    "Metadata read and an automatic transcript obtained; its accuracy is not verified.",
  "Solo metadatos del archivo. El contenido del audio no se analizó.":
    "File metadata only. The content of the audio was not analysed.",

  // ---- Limitaciones condicionales ----
  "El destino real de cada enlace queda sin comprobar: una URL desconocida no puede calificarse como segura.":
    "The real destination of each link remains unchecked: an unknown URL cannot be called safe.",
  "No había enlaces que analizar en el texto.": "There were no links in the text to analyse.",
  "El análisis se hizo sobre una transcripción automática, que puede diferir de lo que se dijo.":
    "The analysis was done on an automatic transcript, which may differ from what was said.",
  "No se analizó el contenido del audio: no hay transcripción.":
    "The content of the audio was not analysed: there is no transcript.",
  "Es texto reconocido por una máquina, no una cita textual: una palabra mal reconocida puede inventar o borrar una señal.":
    "This is text recognised by a machine, not a verbatim quote: one misrecognised word can invent or erase a signal.",

  // ---- Estados de la transcripción ----
  "Transcripción pendiente: hace falta tu consentimiento para enviar el audio al modelo.":
    "Transcript pending: your consent is needed to send the audio to the model.",
  "Transcripción pendiente.": "Transcript pending.",
  "Revisa que la transcripción coincida con lo que recuerdas antes de confiar en el análisis.":
    "Check that the transcript matches what you remember before trusting the analysis.",
  "motor no informado": "engine not reported",

  // ---- Comprobaciones pendientes ----
  // Vocabulario exacto de `URL_PENDING_EXTERNAL`, `TRANSCRIPT_PENDING_EXTERNAL`
  // y los pendientes financieros, de imagen y de audio.
  "resolución DNS": "DNS resolution",
  "certificado TLS": "TLS certificate",
  "titularidad RDAP/WHOIS": "RDAP/WHOIS ownership",
  "antigüedad del dominio": "age of the domain",
  "reputación en listas de amenazas": "reputation in threat lists",
  "redirecciones y destino final": "redirects and final destination",
  "contenido publicado en el sitio": "content published on the site",
  "identidad real de quien llamó": "the real identity of the caller",
  "número de origen de la llamada": "the originating number of the call",
  "titularidad de la cuenta o del medio de pago": "ownership of the account or the payment method",
  "recepción real del pago": "actual receipt of the payment",
  "reconocimiento de texto en la imagen": "text recognition in the image",
  "procedencia de la imagen": "provenance of the image",
  "exactitud de la transcripción automática": "accuracy of the automatic transcript",
  "transcripción del contenido del audio": "transcription of the audio content",
  "contenido no proporcionado": "content not provided",
  "reputación y titularidad de línea telefónica": "phone line reputation and ownership",

  // ---- Analizador telefónico local (phone.ts) ----
  "Analizador telefónico local": "Local phone analyser",
  "Análisis telefónico local.": "Local phone analysis.",
  "No se consultó ninguna base externa de reputación telefónica.":
    "No external phone reputation database was queried.",
  "Número telefónico detectado en el contenido": "Phone number detected in content",
  "Verifica el número en el sitio oficial o al reverso de tu tarjeta antes de devolver la llamada.":
    "Verify the number on the official website or on the back of your card before calling back.",
  "El formato del número no identifica a su titular ni comprueba si ha sido reportado en bases externas.":
    "The number format does not identify its owner or check whether it has been reported in external databases.",
  "Número de tarificación especial (900)": "Premium-rate number (900)",
  "No devuelvas la llamada a números 900 desde mensajes no solicitados.":
    "Do not call back 900 numbers from unsolicited messages.",
  "Detectado por prefijo numérico; no se consultó al operador.":
    "Detected by numeric prefix; the carrier was not queried.",
  "Múltiples números telefónicos distintos": "Multiple distinct phone numbers",
  "Desconfía de mensajes que piden llamar o escribir a otro número distinto al oficial.":
    "Be wary of messages asking you to call or text a number different from the official one.",
  "Una empresa legítima también puede incluir dos líneas de contacto.":
    "A legitimate company may also list two contact lines.",
  "Teléfono de contacto dentro de aviso institucional o bancario":
    "Contact phone inside an institutional or bank notice",
  "Nunca llames al número incluido en un SMS o mensaje sospechoso; usa el teléfono del reverso de tu tarjeta o la app oficial.":
    "Never call the number inside a suspicious SMS or message; use the phone on the back of your card or the official app.",
  "No se comprueba si el número pertenece realmente a la institución mencionada.":
    "It is not checked whether the number actually belongs to the named institution.",
  "Prefijo telefónico internacional combinado con enlace":
    "International phone prefix combined with a link",
  "Evita abrir el enlace o responder por mensajería a remitentes internacionales desconocidos.":
    "Avoid opening the link or replying via messaging to unknown international senders.",
  "Un prefijo internacional no prueba fraude por sí solo.":
    "An international prefix does not prove fraud on its own.",
};

/** Traduce una frase exacta. Devuelve `null` si no hay traducción. */
function phrase(value: string, lang: Lang): string | null {
  if (lang === "es") return value;
  const direct = EN[value];
  if (direct) return direct;
  const trimmed = value.trim();
  if (trimmed !== value && EN[trimmed]) return EN[trimmed];
  for (const rule of RULES) {
    const match = trimmed.match(rule.test);
    if (match) {
      const built = rule.build(match, lang);
      if (built !== null) return built;
    }
  }
  return null;
}

/** Traduce si puede; si no, deja el original y lo señala. */
function field(value: string, lang: Lang, report: { fallback: boolean }): string {
  const translated = phrase(value, lang);
  if (translated === null) {
    report.fallback = true;
    return value;
  }
  return translated;
}

export function localizeIndicator(item: IndicatorLike, lang: Lang): Localized {
  const report = { fallback: false };
  return {
    indicator: field(item.indicator, lang, report),
    evidence: field(item.evidence, lang, report),
    recommendation: field(item.recommendation, lang, report),
    limitation: field(item.limitation, lang, report),
    source: field(item.source, lang, report),
    fallback: report.fallback,
  };
}

/**
 * Las auditorías fusionadas (`mergeAudits`, análisis coordinado) encadenan la
 * etiqueta de cobertura y la limitación de cada parte separadas por un espacio.
 * Aquí se traduce frase por frase, probando siempre el trozo más largo primero
 * para que una entrada del catálogo que ya tiene dos frases no se parta por la
 * mitad. Si una sola frase no se reconoce, se devuelve `null` y la cadena
 * entera se queda en español: media traducción sería peor que ninguna.
 */
function sequence(value: string, lang: Lang): string | null {
  const out: string[] = [];
  let rest = value.trim();
  let guard = 0;
  while (rest && guard < 40) {
    guard += 1;
    const cuts: number[] = [];
    for (let i = 0; i < rest.length - 1; i += 1) {
      if (rest[i] === "." && rest[i + 1] === " ") cuts.push(i + 1);
    }
    cuts.push(rest.length);
    let matched: { text: string; next: string } | null = null;
    for (let k = cuts.length - 1; k >= 0; k -= 1) {
      const translated = phrase(rest.slice(0, cuts[k]).trim(), lang);
      if (translated !== null) {
        matched = { text: translated, next: rest.slice(cuts[k]).trim() };
        break;
      }
    }
    if (!matched) return null;
    out.push(matched.text);
    rest = matched.next;
  }
  return rest ? null : out.join(" ");
}

export function localizeCoverageLabel(label: string, lang: Lang): string {
  return phrase(label, lang) ?? sequence(label, lang) ?? label;
}

export function localizeAuditLimitation(limitation: string, lang: Lang): string {
  return phrase(limitation, lang) ?? sequence(limitation, lang) ?? limitation;
}

export function localizePending(item: string, lang: Lang): string {
  return phrase(item, lang) ?? item;
}

/**
 * Traduce una lista de nombres de indicador unidos en una sola cadena (como
 * `risk.ts` arma `rationaleKeys[].vars.signals` y `.vars.pending`), elemento
 * por elemento y con el mismo separador. El motor determinista siempre
 * redacta en español (ver la nota al inicio de este archivo); sin esto, una
 * plantilla ya traducida («Pending checks: …», «Deterministic evidence of
 * high severity: …») dejaba la lista intacta en español — defecto real visto
 * en una vista previa desplegada con el caso de demostración de BBVA.
 */
export function localizeJoinedList(value: string, lang: Lang, separator: string): string {
  return value
    .split(separator)
    .map((item) => localizePending(item, lang))
    .join(separator);
}

/** Para las pruebas: cuántas frases cubre el diccionario de evidencias. */
export const EVIDENCE_PHRASES = Object.keys(EN).length;
