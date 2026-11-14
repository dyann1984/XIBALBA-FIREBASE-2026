// Catálogo determinista de señales de contenido.
// Cada patrón describe una propiedad observable del texto, nunca una conclusión
// sobre la intención real del remitente ni sobre la existencia de un fraude.

export type ContentCategory =
  | 'credenciales'
  | 'financiero'
  | 'phishing'
  | 'tienda'
  | 'empleo'
  | 'extorsion'
  | 'canal';

export type PatternSeverity = 'critico' | 'alto' | 'medio' | 'bajo';

export type ContentPattern = {
  id: string;
  label: string;
  category: ContentCategory;
  severity: PatternSeverity;
  /** Todas deben coincidir para aceptar la señal (contexto obligatorio). */
  all?: RegExp[];
  /** Al menos una debe coincidir; su coincidencia se cita como evidencia. */
  any: RegExp[];
  evidence: string;
  recommendation: string;
  limitation: string;
};

/**
 * Normaliza a minúsculas sin diacríticos conservando un mapa de índices hacia
 * el texto original, para poder citar el fragmento exacto que el usuario envió
 * en lugar de una reconstrucción aproximada.
 */
export function normalizeWithMap(value: string): { text: string; map: number[] } {
  const map: number[] = [];
  let text = '';
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const stripped = char
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[‘’ʼ]/g, "'")
      .replace(/[“”]/g, '"')
      .toLowerCase();
    for (const piece of stripped) {
      text += piece;
      map.push(index);
    }
  }
  return { text, map };
}

export function normalizeText(value: string): string {
  return normalizeWithMap(value).text;
}

/**
 * Enmascara las secuencias largas de dígitos de un fragmento citado.
 *
 * Una evidencia se muestra en la interfaz y se entrega al modelo como hecho
 * comprobado: si el fragmento citado contiene una CLABE o una tarjeta, el
 * número completo viajaría con ella. Se deja solo el final, suficiente para
 * reconocer el dato sin reproducirlo.
 *
 * Las comprobaciones aritméticas de `finance.ts` trabajan sobre el texto
 * original, no sobre esta versión, así que enmascarar aquí no les quita nada.
 */
function redactLongDigitRuns(value: string): string {
  return value.replace(/\d(?:[\d\s-]{10,27})\d/g, (run) => {
    const digits = run.replace(/\D/g, '');
    if (digits.length < 12) return run;
    return `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`;
  });
}

/** Recorta y colapsa un fragmento para mostrarlo como evidencia citada. */
export function quoteFragment(value: string, max = 120): string {
  const clean = redactLongDigitRuns(value.replace(/\s+/g, ' ').trim());
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

// Formas verbales con sufijos (enviános, mándame, compártelo…). El texto ya
// llega normalizado sin diacríticos.
const REQUEST = '(envi[ae]\\w*|mand[ae]\\w*|reenvi[ae]\\w*|proporcion\\w*|compart\\w*|confirm\\w*|ingres[ae]\\w*|introdu\\w*|escrib[ae]\\w*|facilit[ae]\\w*|tecle[ae]\\w*|pas[ae]me|dame|necesito|requiero|dicta|digita\\w*)';
const SECRET = '(contrasena|password|clave de acceso|clave bancaria|clave dinamica|pin|nip|cvv|codigo de verificacion|codigo de seguridad|codigo de confirmacion|codigo sms|otp|token de seguridad)';

export const contentPatterns: ContentPattern[] = [
  {
    id: 'solicitud-credenciales',
    label: 'Solicitud de contraseña, PIN o código',
    category: 'credenciales',
    severity: 'critico',
    any: [
      new RegExp(`\\b${REQUEST}\\b[^.;!?\\n]{0,40}\\b${SECRET}\\b`),
      new RegExp(`\\b${SECRET}\\b[^.;!?\\n]{0,40}\\b${REQUEST}\\b`),
      /\bcodigo\b[^.;!?\n]{0,30}\b(que (te )?(llego|enviamos|recibiste|mandamos)|de 6 digitos|de cuatro digitos)\b/,
    ],
    evidence: 'El texto pide de forma directa una contraseña, PIN, CVV o código de verificación.',
    recommendation:
      'Ninguna institución legítima solicita contraseñas ni códigos de un solo uso. No los compartas y contacta a la entidad por su canal oficial.',
    limitation: 'La coincidencia es textual; no identifica quién envió el mensaje ni su intención real.',
  },
  {
    id: 'frase-semilla',
    label: 'Solicitud de frase semilla o clave privada',
    category: 'credenciales',
    severity: 'critico',
    any: [
      /\b(frase (semilla|de recuperacion)|seed phrase|clave privada|private key|12 palabras|24 palabras)\b/,
    ],
    evidence: 'El texto menciona una frase semilla, frase de recuperación o clave privada de billetera.',
    recommendation:
      'Una frase semilla da control total e irreversible de los fondos. No existe soporte legítimo que la pida.',
    limitation: 'La mención puede aparecer también en material educativo o de advertencia.',
  },
  {
    id: 'pago-anticipado',
    label: 'Cobro anticipado para recibir algo',
    category: 'financiero',
    severity: 'critico',
    any: [
      /\b(pago|pagar|deposito|depositar|abono|transferencia|transferir|comision|anticipo|cuota|arancel|impuesto|gastos de (envio|gestion|tramite))\b[^.;!?\n]{0,70}\b(para (poder )?(recibir|liberar|desbloquear|procesar|activar|entregar|retirar|cobrar)|antes de (recibir|entregar|poder)|por adelantado|anticipad[oa])\b/,
      /\b(libera|liberar|desbloquea|desbloquear|activa|activar|retira|retirar)\b[^.;!?\n]{0,40}\b(tu|el|su|los|sus)\b[^.;!?\n]{0,30}\b(premio|paquete|envio|fondos|transferencia|herencia|saldo|credito|prestamo)\b/,
      /\b(solo|unicamente)\b[^.;!?\n]{0,30}\b(paga|pagas|depositas|cubres)\b[^.;!?\n]{0,30}\b(envio|gestion|tramite|comision|impuesto)\b/,
    ],
    evidence:
      'El texto condiciona la entrega de un bien, premio o fondo a un pago, depósito o comisión previa.',
    recommendation:
      'Pagar por adelantado para recibir un beneficio es el patrón central del fraude de pago anticipado. No transfieras dinero y verifica por un canal independiente.',
    limitation:
      'Algunos cobros anticipados son legítimos (anticipos, aduanas reales); la señal indica el patrón, no el fraude.',
  },
  {
    id: 'datos-bancarios',
    label: 'Solicitud de datos bancarios completos',
    category: 'financiero',
    severity: 'alto',
    any: [
      /\b(numero (completo )?de (tarjeta|cuenta)|datos de (tu|la) tarjeta|clabe|interbancaria|iban|swift|fecha de (vencimiento|expiracion)|los (3|tres) digitos|reverso de (tu|la) tarjeta)\b/,
    ],
    evidence: 'El texto solicita datos bancarios o de tarjeta que permiten disponer del dinero.',
    recommendation:
      'No envíes datos de tarjeta por mensaje. Usa únicamente la aplicación o el sitio oficial de tu banco.',
    limitation: 'La mención de datos bancarios puede ocurrir en contextos legítimos de facturación.',
  },
  {
    id: 'urgencia-temporal',
    label: 'Presión de tiempo',
    category: 'phishing',
    severity: 'medio',
    any: [
      /\b(urgente|urgentemente|de inmediato|inmediatamente|ahora mismo|ultimo aviso|ultima oportunidad|ultimo recordatorio|expira (hoy|manana|en breve)|caduca (hoy|manana)|solo por hoy|solo (por )?\d+ (horas|minutos)|en las proximas \d+ (horas|minutos)|antes de (que|las) \d)\b/,
    ],
    evidence: 'El texto introduce una fecha límite o urgencia que reduce el tiempo de verificación.',
    recommendation:
      'La urgencia es una técnica de presión. Tómate el tiempo de verificar por un canal oficial antes de actuar.',
    limitation: 'La urgencia aparece también en comunicaciones legítimas y no implica fraude por sí sola.',
  },
  {
    id: 'amenaza-cuenta',
    label: 'Amenaza de bloqueo o suspensión de cuenta',
    category: 'phishing',
    severity: 'alto',
    any: [
      /\b(sera (suspendid|bloquead|cancelad|eliminad|desactivad)|sera? dad[oa] de baja|suspenderemos|bloquearemos|cancelaremos|perderas (el acceso|tu cuenta|tu saldo)|cuenta (suspendida|bloqueada|restringida|inhabilitada))\b/,
      /\b(actividad|movimiento|acceso|cargo|intento)\b[^.;!?\n]{0,30}\b(sospechos[oa]|inusual|no reconocid[oa]|no autorizad[oa])\b/,
    ],
    evidence:
      'El texto anuncia la suspensión de una cuenta o un cargo no reconocido para provocar una reacción inmediata.',
    recommendation:
      'No uses los enlaces del mensaje. Abre la aplicación oficial o llama al número impreso en tu tarjeta.',
    limitation: 'Los avisos reales de seguridad usan un lenguaje similar; la señal no distingue el origen.',
  },
  {
    id: 'extorsion-legal',
    label: 'Amenaza legal o de cobranza',
    category: 'extorsion',
    severity: 'alto',
    any: [
      /\b(orden de (aprehension|arresto|embargo)|proceso (legal|judicial)|demanda|denuncia penal|buro de credito|despacho de cobranza|embargo|citatorio|requerimiento judicial)\b/,
      /\b(sabemos (donde|quien|tu)|tenemos (tus|sus) (fotos|datos|contactos)|publicaremos|difundiremos)\b/,
    ],
    evidence: 'El texto contiene una amenaza legal, de cobranza o de exposición de información.',
    recommendation:
      'No respondas ni pagues. Las notificaciones judiciales reales no llegan por mensajería y se verifican ante la autoridad.',
    limitation: 'No se verifica la existencia del procedimiento mencionado.',
  },
  {
    id: 'premio-inesperado',
    label: 'Premio, sorteo o herencia no solicitada',
    category: 'phishing',
    severity: 'alto',
    any: [
      /\b(ganaste|has ganado|eres el ganador|has sido (seleccionad|elegid|favorecid)|resultaste (ganador|seleccionad)|premio (mayor|acumulado)?|sorteo|loteria|rifa|beneficiari[oa]|herencia|fondo de compensacion)\b/,
    ],
    evidence: 'El texto anuncia un premio, sorteo o herencia a favor del destinatario.',
    recommendation:
      'Si no participaste, no hay premio. No entregues datos ni pagos para reclamarlo.',
    limitation: 'Existen sorteos legítimos; la señal solo registra el anuncio.',
  },
  {
    id: 'canal-alterno',
    label: 'Traslado a un canal privado',
    category: 'canal',
    severity: 'medio',
    all: [/\b(whatsapp|wasap|wathsapp|telegram|signal|wa\.me|t\.me)\b/],
    any: [
      /\b(escribenos|escribeme|contactanos|contactame|continuemos|hablemos|agregame|agreganos|mandame mensaje|comunicate)\b/,
      /\bwa\.me\b|\bt\.me\b/,
    ],
    evidence:
      'El texto propone continuar la conversación en una aplicación privada, fuera del canal original.',
    recommendation:
      'Cambiar de canal evita los controles antifraude de la plataforma original. Verifica la identidad antes de aceptar.',
    limitation: 'Muchos negocios legítimos atienden por mensajería.',
  },
  {
    id: 'empleo-sospechoso',
    label: 'Oferta de empleo con condiciones improbables',
    category: 'empleo',
    severity: 'alto',
    all: [
      /\b(trabajo|empleo|vacante|puesto|reclutamiento|contratacion|reclutador|home office|desde casa|medio tiempo)\b/,
    ],
    any: [
      /\b(sin (experiencia|entrevista|requisitos)|no (necesitas|requiere) experiencia|pago (diario|semanal|inmediato)|ganancias? diaria|solo necesitas (un |tu )?(celular|telefono|movil|whatsapp)|tareas? (sencilla|simple|facil)|\d+ ?(a|-) ?\d+ (horas|minutos) al dia)\b/,
      /\b(\$ ?\d{3,}|\d{3,} ?(pesos|mxn|usd|dolares))\b[^.;!?\n]{0,25}\b(al|por) (dia|hora|semana)\b/,
    ],
    evidence:
      'El texto ofrece empleo con una combinación de alta remuneración y requisitos mínimos atípica para un proceso formal.',
    recommendation:
      'Verifica la empresa en fuentes independientes. Un empleo real no exige pagos, ni datos bancarios antes de un contrato.',
    limitation:
      'Algunas ofertas flexibles reales coinciden con estas palabras; la señal no confirma un fraude laboral.',
  },
  {
    id: 'inversion-garantizada',
    label: 'Inversión con rendimiento garantizado',
    category: 'financiero',
    severity: 'alto',
    all: [/\b(inversion|invertir|invierte|rendimiento|ganancia|retorno|trading|forex|bitcoin|cripto|criptomoneda|usdt|binance|plataforma de inversion)\b/],
    any: [
      /\b(garantizad[oa]|asegurad[oa]|sin riesgo|riesgo cero|100 ?% seguro|libre de riesgo)\b/,
      /\b(duplica|triplica|multiplica|duplicar|triplicar)\b[^.;!?\n]{0,30}\b(tu|su|el)\b[^.;!?\n]{0,20}\b(dinero|capital|inversion|saldo)\b/,
      /\b(\d{2,3} ?% (de )?(ganancia|rendimiento|retorno|mensual|diario|semanal))\b/,
    ],
    evidence:
      'El texto promete un rendimiento garantizado, sin riesgo o extraordinariamente alto.',
    recommendation:
      'No existe inversión sin riesgo. Comprueba el registro de la entidad ante el regulador financiero correspondiente.',
    limitation: 'No se verifica la existencia ni el registro de la plataforma mencionada.',
  },
  {
    id: 'tienda-dudosa',
    label: 'Condiciones de venta atípicas',
    category: 'tienda',
    severity: 'medio',
    any: [
      /\b(solo (aceptamos|aceptan|recibimos)|unicamente)\b[^.;!?\n]{0,30}\b(transferencia|deposito|oxxo|efectivo|spei|cripto)\b/,
      /\bno (aceptamos|hay|se aceptan) (devoluciones|reembolsos|cancelaciones)\b/,
      /\b(liquidacion total|remate total|stock limitado|ultimas (piezas|unidades)|quedan \d+ (piezas|unidades))\b/,
      /\b(\b(7|8|9)\d ?% (de )?descuento|descuento del (7|8|9)\d ?%)\b/,
    ],
    evidence:
      'El texto describe condiciones de venta que eliminan la protección del comprador o presionan la compra.',
    recommendation:
      'Paga con métodos que permitan reclamación. Evita transferencias directas a personas físicas.',
    limitation: 'Las promociones agresivas también existen en comercios legítimos.',
  },
  {
    id: 'presion-secreto',
    label: 'Petición de no informar a terceros',
    category: 'phishing',
    severity: 'medio',
    any: [
      /\b(no (le )?(digas|comentes|avises|informes|menciones|cuentes)\b[^.;!?\n]{0,30}\b(a nadie|a tu (familia|banco|esposa|esposo)|al banco)|manten(lo)? en secreto|que quede entre nosotros|no compartas esta (conversacion|informacion))\b/,
    ],
    evidence: 'El texto pide ocultar la conversación o la operación a terceros.',
    recommendation:
      'El aislamiento es una técnica de manipulación. Consulta la situación con alguien de confianza antes de actuar.',
    limitation: 'La confidencialidad se solicita también en contextos legítimos.',
  },
  {
    id: 'saludo-impersonal',
    label: 'Suplantación institucional con saludo genérico',
    category: 'phishing',
    severity: 'medio',
    all: [
      /\b(sat|imss|infonavit|conagua|cfe|telmex|banco|bbva|santander|banamex|banorte|hsbc|scotiabank|azteca|nu|mercado ?pago|mercado ?libre|paypal|amazon|netflix|spotify|apple|icloud|microsoft|outlook|google|gmail|correos|dhl|fedex|ups|estafeta|aduana)\b/,
    ],
    any: [/\b(estimado cliente|querido cliente|estimado usuario|querido usuario|hola usuario|estimado contribuyente|apreciable cliente)\b/],
    evidence:
      'El texto invoca a una institución reconocible pero se dirige al destinatario con un saludo genérico, sin datos personales verificables.',
    recommendation:
      'Las comunicaciones reales suelen incluir datos específicos de tu cuenta. Verifica por el canal oficial.',
    limitation:
      'Los correos masivos legítimos también usan saludos genéricos; la coincidencia de marca no prueba suplantación.',
  },
  {
    id: 'medio-pago-irreversible',
    label: 'Exigencia de un medio de pago irreversible',
    category: 'financiero',
    severity: 'alto',
    any: [
      /\b(tarjeta de regalo|gift card|codigo de (google play|itunes|steam|amazon)|recarga|saldo de telefono|criptomoneda|bitcoin|usdt|western union|moneygram)\b[^.;!?\n]{0,40}\b(paga|pago|pagar|envia|enviar|deposita|depositar|compra|comprar|transfiere)\b/,
      /\b(paga|pago|pagar|envia|enviar|deposita|depositar|compra|comprar|transfiere)\b[^.;!?\n]{0,40}\b(tarjeta de regalo|gift card|codigo de (google play|itunes|steam|amazon)|western union|moneygram|usdt|bitcoin)\b/,
    ],
    evidence: 'El texto exige un medio de pago sin posibilidad de reclamación ni reversión.',
    recommendation:
      'Ninguna institución cobra con tarjetas de regalo o criptomonedas. Es un indicador consistente de fraude.',
    limitation: 'La compra legítima de tarjetas de regalo también coincide con estas palabras.',
  },
  {
    id: 'remitente-no-solicitado',
    label: 'Contacto no solicitado con identidad imprecisa',
    category: 'phishing',
    severity: 'bajo',
    any: [
      /\b(soy (un |una )?(asesor|ejecutiv|representante|agente|licenciad|abogad)[oa]?\b[^.;!?\n]{0,20}\bde\b|me comunico de parte de|le escribo en representacion)\b/,
    ],
    evidence: 'El texto presenta una identidad profesional sin datos verificables de identificación.',
    recommendation: 'Pide nombre completo, número de empleado y verifica por el conmutador oficial.',
    limitation: 'Señal débil: la presentación profesional es habitual en comunicaciones legítimas.',
  },
];
