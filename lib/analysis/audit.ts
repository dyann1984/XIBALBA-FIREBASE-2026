import { parse } from 'tldts';
import { contentPatterns, normalizeWithMap, quoteFragment, type ContentPattern } from './patterns.ts';
import { voicePatterns } from './voice.ts';
import { financePatterns } from './finance-patterns.ts';
import { findFinancialIdentifiers } from './finance.ts';
import {
  CATALOGUE_NOTE,
  describeInstitution,
  institutionMismatch,
  institutionName,
} from './clabe-institutions.ts';
import { describeTranscription, type PreparedAudio, type Transcription } from './audio.ts';
import type {
  Audit,
  AuditIndicator,
  EvidenceClass,
  IndicatorStatus,
  Severity,
} from './risk.ts';

export { combineRisk, deterministicVerdict, trafficLight, LIGHT_LABEL, RISK_LABEL } from './risk.ts';
export type {
  Audit,
  AuditIndicator,
  AiRiskLevel,
  CombinedRisk,
  Coverage,
  DeterministicVerdict,
  EvidenceClass,
  IndicatorStatus,
  RiskLevel,
  Severity,
  TrafficLight,
} from './risk.ts';

// ---------------------------------------------------------------------------
// Catálogos locales
// ---------------------------------------------------------------------------

/** Marcas y términos financieros suplantados con frecuencia. */
const BRANDS = [
  'paypal',
  'google',
  'microsoft',
  'amazon',
  'banco',
  'bbva',
  'santander',
  'banamex',
  'banorte',
  'scotiabank',
  'hsbc',
  'citibanamex',
  'mercadolibre',
  'mercadopago',
  'netflix',
  'spotify',
  'apple',
  'icloud',
  'outlook',
  'facebook',
  'instagram',
  'whatsapp',
  'binance',
  'coinbase',
  'metamask',
  'correos',
  'fedex',
  'estafeta',
  'infonavit',
];

/** Terminaciones con tasas de abuso altas según registros públicos de phishing. */
const ABUSED_SUFFIXES = new Set([
  'tk', 'ml', 'ga', 'cf', 'gq', 'top', 'xyz', 'club', 'work', 'click', 'link',
  'rest', 'country', 'stream', 'download', 'loan', 'review', 'men', 'win',
  'bid', 'cam', 'surf', 'icu', 'cyou', 'sbs', 'buzz', 'quest', 'monster',
  'autos', 'bond', 'cfd', 'mom', 'zip', 'mov', 'lol', 'shop', 'online', 'site',
]);

const SHORTENERS = new Set([
  'bit.ly', 't.co', 'tinyurl.com', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly',
  'cutt.ly', 'rb.gy', 'shorturl.at', 'rebrand.ly', 'bl.ink', 't.ly',
  'acortar.link', 'n9.cl', 'v.gd', 's.id', 'tiny.cc', 'shrtco.de', '1url.com',
]);

/** Palabras en ruta o consulta propias de captura de credenciales. */
const CREDENTIAL_PATH = /(login|signin|log-in|sign-in|logon|acceso|ingresar|ingreso|verificar|verify|verification|validar|validacion|confirmar|confirm|actualizar|update-?account|password|contrasena|recuperar|recovery|reset|unlock|desbloquear|secure|seguridad|security|account|cuenta|billing|facturacion|payment|wallet|oauth|sso|token|otp|2fa|mfa|suspendido|suspended|appeal|restore|reactivar)/i;

/** Extensiones cuya descarga directa desde un enlace recibido es de alto riesgo. */
const EXECUTABLE = /\.(apk|exe|msi|scr|bat|cmd|jar|vbs|ps1|hta|lnk|dmg|pkg|iso|img|sh)(?:$|[?#])/i;

const ARCHIVE = /\.(zip|rar|7z|gz|tar)(?:$|[?#])/i;

/** Confusables frecuentes hacia su equivalente ASCII. */
const CONFUSABLES: Record<string, string> = {
  а: 'a', ӓ: 'a', ᴀ: 'a', α: 'a', '@': 'a', '4': 'a',
  в: 'b', ь: 'b', ß: 'b', '8': 'b',
  с: 'c', ϲ: 'c', ᴄ: 'c', ç: 'c',
  ԁ: 'd', ɗ: 'd',
  е: 'e', ё: 'e', ε: 'e', ҽ: 'e', '3': 'e',
  ɡ: 'g', ց: 'g', '9': 'g',
  һ: 'h', ʹ: 'h',
  і: 'i', ї: 'i', ι: 'i', ɩ: 'i', '1': 'i', '!': 'i', '|': 'i',
  ј: 'j',
  к: 'k', κ: 'k',
  ӏ: 'l', ʟ: 'l',
  м: 'm', ᴍ: 'm',
  п: 'n', ɴ: 'n',
  о: 'o', ο: 'o', ө: 'o', ᴏ: 'o', '0': 'o',
  р: 'p', ρ: 'p',
  ԛ: 'q',
  г: 'r', ʀ: 'r',
  ѕ: 's', ʂ: 's', '5': 's', $: 's',
  т: 't', τ: 't', '7': 't',
  ᴜ: 'u', μ: 'u',
  ν: 'v', ѵ: 'v',
  ԝ: 'w', ѡ: 'w',
  х: 'x', χ: 'x',
  у: 'y', γ: 'y', ү: 'y',
  z: 'z', ᴢ: 'z', '2': 'z',
};

const SCRIPTS: { name: string; test: RegExp }[] = [
  { name: 'latino', test: /\p{Script=Latin}/u },
  { name: 'cirílico', test: /\p{Script=Cyrillic}/u },
  { name: 'griego', test: /\p{Script=Greek}/u },
  { name: 'armenio', test: /\p{Script=Armenian}/u },
  { name: 'árabe', test: /\p{Script=Arabic}/u },
  { name: 'hebreo', test: /\p{Script=Hebrew}/u },
  { name: 'han', test: /\p{Script=Han}/u },
  { name: 'cherokee', test: /\p{Script=Cherokee}/u },
];

const URL_IN_TEXT = /(?:https?:\/\/|www\.)[^\s<>"'`)\]}]+/gi;

const URL_PENDING_EXTERNAL = [
  'resolución DNS',
  'certificado TLS',
  'titularidad RDAP/WHOIS',
  'antigüedad del dominio',
  'reputación en listas de amenazas',
  'redirecciones y destino final',
  'contenido publicado en el sitio',
];

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function foldConfusables(value: string): string {
  return [...value.toLowerCase()].map((char) => CONFUSABLES[char] ?? char).join('');
}

function scriptsOf(value: string): string[] {
  return SCRIPTS.filter((script) => script.test.test(value)).map((script) => script.name);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_unused, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

/** Host tal como lo escribió el usuario, antes de que `URL` lo convierta a Punycode. */
function rawHost(input: string): string {
  const match = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i.exec(input.trim());
  if (!match) return '';
  const authority = match[1];
  const afterUserInfo = authority.slice(authority.lastIndexOf('@') + 1);
  return afterUserInfo.replace(/:\d+$/, '').replace(/^\[/, '').replace(/\]$/, '');
}

type NewIndicator = {
  id: string;
  indicator: string;
  category: string;
  classification: EvidenceClass;
  status: IndicatorStatus;
  severity: Severity;
  evidence: string;
  source: string;
  recommendation: string;
  limitation: string;
};

type Builder = {
  indicators: AuditIndicator[];
  add: (entry: NewIndicator) => void;
};

function builder(checkedAt: string): Builder {
  const indicators: AuditIndicator[] = [];
  return {
    indicators,
    add(entry) {
      indicators.push({ ...entry, checkedAt });
    },
  };
}

// ---------------------------------------------------------------------------
// Auditoría de URL
// ---------------------------------------------------------------------------

/** Comprobaciones locales que `auditUrl` ejecuta siempre, hallen o no señales. */
export const URL_LOCAL_CHECKS = 18;

/**
 * Comprobaciones aritméticas y de catálogo que `auditFinancial` ejecuta además
 * de los dos catálogos de patrones: dígito verificador de CLABE, Luhn, forma de
 * monedero, enlaces incrustados e institución emisora. El coordinador usa esta
 * misma constante para no contar la cobertura dos veces.
 */
export const FINANCE_ARITHMETIC_CHECKS = 5;

export function auditUrl(input: string, now = new Date()): Audit {
  const checkedAt = now.toISOString();
  const build = builder(checkedAt);
  const local = 'Análisis local de la URL y lista de sufijos públicos';

  const url = new URL(input.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Introduce una URL HTTP o HTTPS sin credenciales.');
  }

  const host = url.hostname.replace(/\.$/, '').toLowerCase();
  const typed = rawHost(input);
  const info = parse(host, { allowPrivateDomains: true });
  const reserved = host.endsWith('.test');
  const labels = host.split('.');
  const registrableLabel = (info.domainWithoutSuffix ?? '').toLowerCase();
  const pathAndQuery = `${url.pathname}${url.search}`;

  // 1. Dominio registrable y terminación. El formato de esta evidencia es
  //    estable: las pruebas de regresión comprueban que la terminación nunca
  //    se presente como si fuera un prefijo.
  build.add({
    id: 'dominio-sufijo',
    indicator: 'Dominio y terminación',
    category: 'dominio',
    classification: 'determinista',
    status: 'verificado',
    severity: 'informativo',
    evidence: `Host: ${host}; dominio registrable: ${
      reserved
        ? 'no registrable (.test reservado)'
        : info.isIcann || info.isPrivate
          ? (info.domain ?? 'no identificable')
          : 'no identificado en la lista'
    }; terminación: ${
      reserved
        ? '.test (reservada para pruebas)'
        : info.publicSuffix
          ? `.${info.publicSuffix}${info.isIcann || info.isPrivate ? '' : ' (no reconocida en la lista)'}`
          : 'no identificable'
    }.`,
    source: local,
    recommendation: 'Comprueba el dominio completo antes de actuar.',
    limitation: 'El análisis sintáctico no verifica propiedad ni existencia.',
  });

  // 2. Estructura normalizada.
  build.add({
    id: 'estructura-url',
    indicator: 'Estructura normalizada',
    category: 'estructura',
    classification: 'determinista',
    status: 'verificado',
    severity: 'informativo',
    evidence: `Esquema: ${url.protocol.replace(':', '')}; host: ${host}; puerto: ${
      url.port || '(predeterminado)'
    }; ruta: ${url.pathname || '/'}; parámetros: ${[...url.searchParams.keys()].length}; fragmento: ${
      url.hash ? 'sí' : 'no'
    }.`,
    source: local,
    recommendation: 'Compara la dirección normalizada con la que creías visitar.',
    limitation: 'La normalización no revela el destino tras posibles redirecciones.',
  });

  // 3. Transporte declarado.
  build.add({
    id: 'transporte',
    indicator: 'HTTPS y certificado',
    category: 'estructura',
    classification: url.protocol === 'https:' ? 'pendiente-externo' : 'determinista',
    status: url.protocol === 'https:' ? 'no verificado' : 'sospechoso',
    severity: url.protocol === 'https:' ? 'informativo' : 'medio',
    evidence:
      url.protocol === 'https:'
        ? 'La URL declara HTTPS; no se consultó su certificado.'
        : 'La URL usa HTTP sin cifrado declarado.',
    source: local,
    recommendation: 'No introduzcas datos sensibles sin verificar el sitio.',
    limitation: 'No se abre el sitio ni se comprueba TLS.',
  });

  // 4. Host como dirección IP.
  if (info.isIp) {
    build.add({
      id: 'host-ip',
      indicator: 'Dirección IP en el host',
      category: 'dominio',
      classification: 'determinista',
      status: 'sospechoso',
      severity: 'medio',
      evidence: 'El host es una dirección IP, no un dominio.',
      source: local,
      recommendation: 'Evita introducir información hasta verificar el origen.',
      limitation: 'Una IP no demuestra fraude.',
    });
  }

  // 5. Punycode declarado.
  if (host.includes('xn--')) {
    build.add({
      id: 'punycode',
      indicator: 'Nombre internacionalizado',
      category: 'suplantacion',
      classification: 'determinista',
      status: 'sospechoso',
      severity: 'medio',
      evidence: 'El dominio contiene una etiqueta Punycode (xn--).',
      source: local,
      recommendation: 'Compara el dominio con el canal oficial escrito manualmente.',
      limitation: 'Punycode es legítimo en muchos dominios y no confirma suplantación.',
    });
  }

  // 6. Mezcla de alfabetos en una misma etiqueta (homógrafos).
  if (typed && /[^\u0000-\u007f]/.test(typed)) {
    const mixed = typed
      .split('.')
      .map((label) => ({ label, scripts: scriptsOf(label) }))
      .filter((entry) => entry.scripts.length > 1);
    if (mixed.length) {
      build.add({
        id: 'homografos-mezcla',
        indicator: 'Mezcla de alfabetos en el dominio',
        category: 'suplantacion',
        classification: 'determinista',
        status: 'sospechoso',
        severity: 'alto',
        evidence: `La etiqueta «${mixed[0].label}» combina los alfabetos ${mixed[0].scripts.join(' y ')} en un mismo nombre.`,
        source: 'Comparación de rangos Unicode del host escrito',
        recommendation:
          'Escribe la dirección oficial a mano en el navegador. La mezcla de alfabetos se usa para imitar nombres conocidos.',
        limitation:
          'Algunos dominios multilingües legítimos mezclan alfabetos; la señal no confirma suplantación.',
      });
    } else {
      build.add({
        id: 'host-no-ascii',
        indicator: 'Caracteres no ASCII en el dominio',
        category: 'suplantacion',
        classification: 'determinista',
        status: 'no concluyente',
        severity: 'bajo',
        evidence: `El host escrito contiene caracteres no ASCII (${scriptsOf(typed).join(', ') || 'alfabeto no identificado'}).`,
        source: 'Comparación de rangos Unicode del host escrito',
        recommendation: 'Verifica visualmente el dominio carácter por carácter.',
        limitation: 'Los dominios internacionalizados son legítimos y habituales.',
      });
    }
  }

  // 7. Homógrafos que reconstruyen una marca al plegar confusables.
  if (typed) {
    const folded = foldConfusables(typed.replace(/[^\p{L}\p{N}.-]/gu, ''));
    const foldedLabel = folded.split('.').slice(0, -1).join('.');
    const brandByFold = BRANDS.find(
      (brand) =>
        brand.length >= 5 &&
        foldedLabel.includes(brand) &&
        !host.includes(brand) &&
        registrableLabel !== brand,
    );
    if (brandByFold) {
      build.add({
        id: 'homografos-marca',
        indicator: 'Marca reconstruida con caracteres similares',
        category: 'suplantacion',
        classification: 'determinista',
        status: 'sospechoso',
        severity: 'alto',
        evidence: `Al sustituir caracteres visualmente equivalentes, el host «${typed}» se lee como «${brandByFold}», pero el dominio real no contiene ese nombre.`,
        source: 'Plegado local de caracteres confundibles',
        recommendation: 'No uses este enlace. Accede escribiendo el dominio oficial a mano.',
        limitation:
          'El plegado es heurístico y puede coincidir con nombres legítimos que se parezcan a una marca.',
      });
    }
  }

  // 8. Marca presente fuera de su dominio exacto (regla heurística original).
  const label = labels.slice(0, -1).join('.');
  const brandInLabel = BRANDS.find(
    (brand) => label.includes(brand) && registrableLabel !== brand,
  );
  if (brandInLabel) {
    build.add({
      id: 'marca-host',
      indicator: 'Posible marca en el host',
      category: 'suplantacion',
      classification: 'determinista',
      status: 'sospechoso',
      severity: 'alto',
      evidence: `El nombre contiene «${brandInLabel}», una marca o término financiero, fuera de un dominio exactamente coincidente (dominio registrable: ${info.domain ?? 'no identificable'}).`,
      source: local,
      recommendation: 'Comprueba la dirección oficial por un canal independiente.',
      limitation:
        'Regla heurística limitada; puede producir falsos positivos y no identifica todos los homógrafos.',
    });
  }

  // 9. Error tipográfico cercano a una marca (typosquatting).
  if (registrableLabel.length >= 4 && !brandInLabel) {
    const near = BRANDS.filter((brand) => brand.length >= 5)
      .map((brand) => ({ brand, distance: levenshtein(registrableLabel, brand) }))
      .filter((entry) => entry.distance > 0 && entry.distance <= (entry.brand.length >= 8 ? 2 : 1))
      .sort((a, b) => a.distance - b.distance)[0];
    if (near) {
      build.add({
        id: 'typosquatting',
        indicator: 'Dominio tipográficamente cercano a una marca',
        category: 'suplantacion',
        classification: 'determinista',
        status: 'sospechoso',
        severity: 'alto',
        evidence: `El dominio registrable «${registrableLabel}» difiere en ${near.distance} carácter(es) de «${near.brand}».`,
        source: 'Distancia de edición local contra una lista de marcas',
        recommendation:
          'Escribe el dominio oficial a mano y compara. Los dominios con una letra cambiada son un patrón habitual de suplantación.',
        limitation:
          'La lista de marcas es parcial y nombres legítimos pueden parecerse a una marca por coincidencia.',
      });
    }
  }

  // 10. Marca acompañada de una palabra de seguridad en el dominio registrable.
  const brandPlusKeyword = BRANDS.find(
    (brand) =>
      brand.length >= 4 &&
      registrableLabel.includes(brand) &&
      registrableLabel !== brand &&
      CREDENTIAL_PATH.test(registrableLabel.replace(brand, '')),
  );
  if (brandPlusKeyword) {
    build.add({
      id: 'dominio-enganoso',
      indicator: 'Dominio que combina marca y palabra de seguridad',
      category: 'suplantacion',
      classification: 'determinista',
      status: 'sospechoso',
      severity: 'alto',
      evidence: `El dominio registrable «${registrableLabel}» une la marca «${brandPlusKeyword}» con un término de acceso o seguridad.`,
      source: local,
      recommendation:
        'Las marcas no registran dominios de este tipo para atención a clientes. Accede por la aplicación oficial.',
      limitation: 'Un socio o distribuidor autorizado podría usar un nombre parecido.',
    });
  }

  // 11. Terminación con abuso frecuente.
  const suffix = (info.publicSuffix ?? '').toLowerCase();
  if (!reserved && suffix && ABUSED_SUFFIXES.has(suffix)) {
    build.add({
      id: 'tld-abusada',
      indicator: 'Terminación con abuso frecuente',
      category: 'dominio',
      classification: 'determinista',
      status: 'sospechoso',
      severity: 'bajo',
      evidence: `La terminación «.${suffix}» figura entre las de registro gratuito o barato con uso frecuente en campañas de phishing.`,
      source: 'Lista local de terminaciones con abuso documentado',
      recommendation: 'Extrema la verificación; esta terminación no implica fraude por sí misma.',
      limitation:
        'Muchos sitios legítimos usan estas terminaciones. Señal de contexto, no de culpabilidad.',
    });
  }

  // 12. Acortador de enlaces.
  if (info.domain && SHORTENERS.has(info.domain.toLowerCase())) {
    build.add({
      id: 'acortador',
      indicator: 'Servicio de acortamiento de enlaces',
      category: 'estructura',
      classification: 'determinista',
      status: 'sospechoso',
      severity: 'medio',
      evidence: `El dominio «${info.domain}» es un acortador: la dirección real queda oculta tras una redirección.`,
      source: 'Lista local de acortadores conocidos',
      recommendation:
        'Pide el enlace completo al remitente. No se puede evaluar un destino que no se conoce.',
      limitation:
        'No se resolvió la redirección: el destino final permanece sin comprobar.',
    });
  }

  // 13. Profundidad de subdominios.
  const subdomainDepth = (info.subdomain ?? '').split('.').filter(Boolean).length;
  if (subdomainDepth >= 3) {
    build.add({
      id: 'subdominios-profundos',
      indicator: 'Exceso de subdominios',
      category: 'estructura',
      classification: 'determinista',
      status: 'sospechoso',
      severity: 'medio',
      evidence: `El host tiene ${subdomainDepth} niveles de subdominio («${info.subdomain}»), lo que desplaza el dominio real fuera de la vista en pantallas estrechas.`,
      source: local,
      recommendation:
        'Lee el dominio de derecha a izquierda: lo que importa es la parte final, no la inicial.',
      limitation: 'Las infraestructuras grandes usan subdominios profundos de forma legítima.',
    });
  }

  // 14. Puerto no estándar.
  if (url.port && !['80', '443'].includes(url.port)) {
    build.add({
      id: 'puerto-no-estandar',
      indicator: 'Puerto no estándar',
      category: 'estructura',
      classification: 'determinista',
      status: 'sospechoso',
      severity: 'bajo',
      evidence: `La URL apunta al puerto ${url.port}, distinto de los puertos web habituales.`,
      source: local,
      recommendation: 'Los servicios públicos de una marca no suelen publicarse en puertos atípicos.',
      limitation: 'Entornos de desarrollo y paneles internos usan puertos atípicos legítimamente.',
    });
  }

  // 15. Palabras de captura de credenciales en ruta o consulta.
  const credentialHit = CREDENTIAL_PATH.exec(pathAndQuery);
  if (credentialHit) {
    build.add({
      id: 'ruta-credenciales',
      indicator: 'Ruta orientada a credenciales',
      category: 'phishing',
      classification: 'determinista',
      status: 'sospechoso',
      severity: 'medio',
      evidence: `La ruta o los parámetros contienen «${credentialHit[0]}», propio de páginas de acceso, verificación o pago.`,
      source: local,
      recommendation:
        'No escribas credenciales en una página abierta desde un enlace recibido. Entra por la app oficial.',
      limitation:
        'Las páginas de acceso legítimas usan exactamente las mismas palabras en su ruta.',
    });
  }

  // 16. Descarga directa de ejecutables o archivos comprimidos.
  if (EXECUTABLE.test(pathAndQuery)) {
    build.add({
      id: 'descarga-ejecutable',
      indicator: 'Enlace a un archivo ejecutable',
      category: 'phishing',
      classification: 'determinista',
      status: 'sospechoso',
      severity: 'critico',
      evidence: `La URL apunta directamente a un archivo ejecutable o instalable (${EXECUTABLE.exec(pathAndQuery)?.[0]}).`,
      source: local,
      recommendation:
        'No descargues ni instales archivos recibidos por enlace. Instala solo desde tiendas oficiales.',
      limitation: 'No se descargó ni analizó el archivo; la extensión puede no reflejar su contenido.',
    });
  } else if (ARCHIVE.test(pathAndQuery)) {
    build.add({
      id: 'descarga-comprimida',
      indicator: 'Enlace a un archivo comprimido',
      category: 'phishing',
      classification: 'determinista',
      status: 'sospechoso',
      severity: 'medio',
      evidence: `La URL apunta a un archivo comprimido (${ARCHIVE.exec(pathAndQuery)?.[0]}), formato usado para evadir inspección.`,
      source: local,
      recommendation: 'No abras archivos comprimidos recibidos por enlace sin verificar el origen.',
      limitation: 'El reparto de archivos comprimidos es habitual y legítimo.',
    });
  }

  // 17. Otra dirección incrustada en la ruta o la consulta.
  const embedded = /(?:https?(?::|%3a)(?:\/\/|%2f%2f)|(?:^|[?&=])(?:www\.))([^\s&#]+)/i.exec(
    pathAndQuery,
  );
  if (embedded) {
    build.add({
      id: 'dominio-incrustado',
      indicator: 'Otra dirección incrustada en la URL',
      category: 'suplantacion',
      classification: 'determinista',
      status: 'sospechoso',
      severity: 'medio',
      evidence: `La ruta o los parámetros incluyen otra dirección («${quoteFragment(embedded[0], 60)}»), patrón de redirección abierta o de disimulo del destino.`,
      source: local,
      recommendation:
        'El dominio que ves al principio puede no ser el destino. No continúes sin verificar.',
      limitation: 'Los parámetros de retorno son habituales en flujos de acceso legítimos.',
    });
  }

  // Ofuscación del host.
  const hyphens = (host.match(/-/g) ?? []).length;
  const digits = (host.match(/\d/g) ?? []).length;
  if (!info.isIp && (hyphens >= 3 || host.length > 45 || labels.length >= 6 || digits >= 6)) {
    build.add({
      id: 'host-ofuscado',
      indicator: 'Host extenso u ofuscado',
      category: 'dominio',
      classification: 'determinista',
      status: 'sospechoso',
      severity: 'bajo',
      evidence: `El host mide ${host.length} caracteres, con ${labels.length} etiquetas, ${hyphens} guiones y ${digits} dígitos.`,
      source: local,
      recommendation: 'Los nombres largos dificultan ver el dominio real en un móvil.',
      limitation: 'La longitud por sí sola no indica intención maliciosa.',
    });
  }

  // Comprobaciones externas deliberadamente deshabilitadas (categoría C).
  build.add({
    id: 'externo-pendiente',
    indicator: 'Reputación, redirecciones, RDAP y DNS',
    category: 'externo',
    classification: 'pendiente-externo',
    status: 'no verificado',
    severity: 'informativo',
    evidence: 'No se consultaron fuentes externas ni se siguieron enlaces.',
    source: 'Comprobaciones de red deshabilitadas en esta versión',
    recommendation: 'Consulta fuentes oficiales independientemente.',
    limitation: 'No se inspeccionaron certificados, reputación, titularidad ni destino final.',
  });

  return {
    subject: 'url',
    indicators: build.indicators,
    coverage: {
      label: 'Solo sintaxis y señales locales; sin inspección de red.',
      checksRun: URL_LOCAL_CHECKS,
      checksTotal: URL_LOCAL_CHECKS + URL_PENDING_EXTERNAL.length,
      pendingExternal: URL_PENDING_EXTERNAL,
    },
    limitation: 'La ausencia de señales no demuestra que un sitio sea seguro.',
  };
}

// ---------------------------------------------------------------------------
// Auditoría de mensaje
// ---------------------------------------------------------------------------

/** Extrae las direcciones escritas en un texto, sin abrirlas. */
export function extractUrls(text: string): string[] {
  const found = text.match(URL_IN_TEXT) ?? [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of found) {
    const trimmed = raw.replace(/[.,;:!?)\]}'"]+$/, '');
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
    if (seen.has(candidate.toLowerCase())) continue;
    seen.add(candidate.toLowerCase());
    result.push(candidate);
  }
  return result;
}

/**
 * Recorre un catálogo de patrones y añade una evidencia por coincidencia,
 * citando el fragmento literal del texto original, con acentos.
 *
 * Extraído de `auditMessage` para poder aplicar varios catálogos sobre el
 * mismo texto: una transcripción se analiza con el catálogo general y con el
 * de voz, y un mensaje financiero con el general y el financiero.
 */
function matchCatalogue(
  catalogue: ContentPattern[],
  input: string,
  text: string,
  map: number[],
  build: ReturnType<typeof builder>,
  source: string,
): number {
  let found = 0;
  for (const pattern of catalogue) {
    if (pattern.all && !pattern.all.every((expression) => expression.test(text))) continue;
    let match: RegExpExecArray | null = null;
    for (const expression of pattern.any) {
      match = expression.exec(text);
      if (match) break;
    }
    if (!match) continue;
    const start = map[match.index] ?? 0;
    const end = (map[match.index + match[0].length - 1] ?? input.length - 1) + 1;
    build.add({
      id: pattern.id,
      indicator: pattern.label,
      category: pattern.category,
      classification: 'determinista',
      status: 'sospechoso',
      severity: pattern.severity,
      evidence: `${pattern.evidence} Fragmento citado: «${quoteFragment(input.slice(start, end))}».`,
      source,
      recommendation: pattern.recommendation,
      limitation: pattern.limitation,
    });
    found += 1;
  }
  return found;
}

/**
 * Añade las evidencias de los enlaces escritos en un texto. Ninguno se abre:
 * cada uno pasa por `auditUrl`, que es análisis puramente sintáctico. Solo se
 * conservan las señales relevantes, con el prefijo `enlace:` en el id para que
 * no choquen con las del texto.
 */
function addLinkIndicators(
  urls: string[],
  build: ReturnType<typeof builder>,
  now: Date,
  source: string,
): void {
  for (const candidate of urls.slice(0, 5)) {
    let nested: Audit;
    try {
      nested = auditUrl(candidate, now);
    } catch (error) {
      build.add({
        id: `enlace-invalido-${candidate}`,
        indicator: 'Enlace no analizable',
        category: 'externo',
        classification: 'error',
        status: 'error',
        severity: 'informativo',
        evidence: `No se pudo analizar «${quoteFragment(candidate, 60)}»: ${
          error instanceof Error ? error.message : 'formato no reconocido'
        }`,
        source,
        recommendation: 'Revisa el enlace manualmente antes de abrirlo.',
        limitation: 'Un enlace no analizable no implica que sea seguro ni peligroso.',
      });
      continue;
    }
    for (const indicator of nested.indicators) {
      if (indicator.severity === 'informativo' && indicator.status !== 'no verificado') continue;
      build.indicators.push({
        ...indicator,
        id: `enlace:${indicator.id}`,
        indicator: `Enlace en el mensaje · ${indicator.indicator}`,
        evidence: `Enlace «${quoteFragment(candidate, 60)}»: ${indicator.evidence}`,
      });
    }
  }
}

/**
 * HUN CAMÉ dentro de un contenido que no es una URL suelta: analiza los
 * enlaces escritos en un texto, sin abrir ninguno.
 *
 * Existe aparte para que la auditoría coordinada pueda atribuir esas
 * evidencias a su agente. Los ids coinciden con los que `auditMessage` genera,
 * así que cuando los dos participan la evidencia se muestra una sola vez,
 * atribuida a ambos.
 */
export function auditTextLinks(input: string, now = new Date()): Audit {
  const checkedAt = now.toISOString();
  const build = builder(checkedAt);
  const source = 'Análisis local de los enlaces escritos en el texto';
  const urls = extractUrls(input);
  addLinkIndicators(urls, build, now, source);

  const checks = urls.length ? URL_LOCAL_CHECKS : 0;
  return {
    // Con enlaces el objeto analizado incluye una URL, y eso impide por
    // construcción que la auditoría se considere agotada localmente.
    subject: urls.length ? 'url' : 'mensaje',
    indicators: build.indicators,
    coverage: {
      label: urls.length
        ? `Analizados ${Math.min(urls.length, 5)} de ${urls.length} enlace(s), solo de forma sintáctica. Ninguno se abrió.`
        : 'No se encontraron enlaces en el texto.',
      checksRun: checks,
      checksTotal: checks + (urls.length ? URL_PENDING_EXTERNAL.length : 0),
      pendingExternal: urls.length ? URL_PENDING_EXTERNAL : [],
    },
    limitation: urls.length
      ? 'El destino real de cada enlace queda sin comprobar: una URL desconocida no puede calificarse como segura.'
      : 'No había enlaces que analizar en el texto.',
  };
}

export function auditMessage(input: string, now = new Date()): Audit {
  const checkedAt = now.toISOString();
  const build = builder(checkedAt);
  const source = 'Comparación local contra el catálogo de patrones de fraude';
  const { text, map } = normalizeWithMap(input);

  build.add({
    id: 'contenido-recibido',
    indicator: 'Contenido analizado',
    category: 'contenido',
    classification: 'determinista',
    status: 'verificado',
    severity: 'informativo',
    evidence: `Texto de ${input.length} caracteres y ${input.trim() ? input.trim().split(/\s+/).length : 0} palabras, analizado íntegramente en el dispositivo.`,
    source,
    recommendation: 'Comparte solo el contenido necesario para el análisis.',
    limitation: 'El texto no permite verificar la identidad real del remitente.',
  });

  matchCatalogue(contentPatterns, input, text, map, build, source);

  const urls = extractUrls(input);
  addLinkIndicators(urls, build, now, source);

  if (urls.length) {
    build.add({
      id: 'mensaje-con-enlaces',
      indicator: 'El mensaje contiene enlaces',
      category: 'contenido',
      classification: 'determinista',
      status: 'no concluyente',
      severity: 'informativo',
      evidence: `Se detectaron ${urls.length} enlace(s); ninguno se abrió. Analizados localmente: ${Math.min(urls.length, 5)}.`,
      source,
      recommendation: 'No abras enlaces recibidos sin verificar el remitente por otro canal.',
      limitation:
        'El destino real de cada enlace queda sin comprobar porque las consultas de red están deshabilitadas.',
    });
  }

  return {
    subject: 'mensaje',
    indicators: build.indicators,
    coverage: {
      label: urls.length
        ? 'Texto completo analizado localmente; los enlaces solo de forma sintáctica.'
        : 'Texto completo analizado localmente.',
      checksRun: contentPatterns.length + 2,
      checksTotal:
        contentPatterns.length + 2 + (urls.length ? URL_PENDING_EXTERNAL.length : 0),
      // Un texto sin enlaces se agota localmente; con enlaces, no.
      pendingExternal: urls.length ? URL_PENDING_EXTERNAL : [],
    },
    limitation:
      'El catálogo de patrones es parcial: la ausencia de coincidencias no demuestra que el mensaje sea legítimo.',
  };
}

// ---------------------------------------------------------------------------
// CAMAZOTZ · transcripción de llamada
// ---------------------------------------------------------------------------

const TRANSCRIPT_PENDING_EXTERNAL = [
  'identidad real de quien llamó',
  'número de origen de la llamada',
];

/**
 * Audita una transcripción. Aplica el catálogo general y el de voz, porque
 * una llamada combina señales de ambos: pedir el NIP está en el general,
 * exigir que no cuelgues solo tiene sentido hablando.
 */
export function auditTranscript(input: string, now = new Date()): Audit {
  const checkedAt = now.toISOString();
  const build = builder(checkedAt);
  const source = 'Comparación local contra los catálogos de patrones de fraude y de llamadas';
  const { text, map } = normalizeWithMap(input);

  const words = input.trim() ? input.trim().split(/\s+/).length : 0;
  build.add({
    id: 'transcripcion-recibida',
    indicator: 'Transcripción analizada',
    category: 'contenido',
    classification: 'determinista',
    status: 'verificado',
    severity: 'informativo',
    evidence: `Transcripción de ${input.length} caracteres y ${words} palabras, analizada íntegramente en el dispositivo.`,
    source,
    recommendation: 'Comparte solo lo necesario de la conversación.',
    limitation:
      'Es lo que se escribió o se reconoció del audio, no una grabación verificada. No permite identificar a quien llamó.',
  });

  matchCatalogue(contentPatterns, input, text, map, build, source);
  matchCatalogue(voicePatterns, input, text, map, build, source);

  // Lo que una transcripción nunca puede decir, y conviene dejar escrito.
  for (const pending of TRANSCRIPT_PENDING_EXTERNAL) {
    build.add({
      id: `transcripcion-pendiente-${pending.replace(/\s+/g, '-')}`,
      indicator: `No comprobado: ${pending}`,
      category: 'externo',
      classification: 'pendiente-externo',
      status: 'no verificado',
      severity: 'informativo',
      evidence: `La transcripción no permite establecer ${pending}.`,
      source,
      recommendation:
        'El número que aparece en la pantalla puede falsificarse. No lo tomes como prueba de quién llamó.',
      limitation:
        'Esta herramienta no accede al registro de llamadas ni a datos de la operadora, por diseño.',
    });
  }

  const urls = extractUrls(input);
  if (urls.length) {
    build.add({
      id: 'transcripcion-con-enlaces',
      indicator: 'La transcripción menciona enlaces',
      category: 'contenido',
      classification: 'determinista',
      status: 'no concluyente',
      severity: 'informativo',
      evidence: `Se detectaron ${urls.length} enlace(s) en la transcripción; ninguno se abrió.`,
      source,
      recommendation: 'Analiza el enlace por separado antes de abrirlo.',
      limitation: 'El destino real del enlace queda sin comprobar.',
    });
  }

  const checks = contentPatterns.length + voicePatterns.length + 1;
  return {
    subject: 'transcripcion',
    indicators: build.indicators,
    coverage: {
      label: 'Transcripción completa analizada localmente con los catálogos general y de llamadas.',
      checksRun: checks,
      checksTotal: checks + TRANSCRIPT_PENDING_EXTERNAL.length + (urls.length ? URL_PENDING_EXTERNAL.length : 0),
      pendingExternal: urls.length
        ? [...TRANSCRIPT_PENDING_EXTERNAL, ...URL_PENDING_EXTERNAL]
        : TRANSCRIPT_PENDING_EXTERNAL,
    },
    limitation:
      'El catálogo es parcial y la transcripción no acredita la identidad de quien llamó: la ausencia de coincidencias no demuestra que la llamada fuera legítima.',
  };
}

// ---------------------------------------------------------------------------
// CAMAZOTZ · archivo de audio
// ---------------------------------------------------------------------------

/**
 * Audita un archivo de audio. Solo emite metadatos locales y el estado de la
 * transcripción. **Nunca afirma haber escuchado el audio.**
 */
export function auditAudio(
  audio: Pick<PreparedAudio, 'name' | 'mimeType' | 'size' | 'durationSeconds'>,
  transcription: Transcription,
  now = new Date(),
): Audit {
  const checkedAt = now.toISOString();
  const build = builder(checkedAt);
  const source = 'Metadatos leídos en el dispositivo';

  const duration =
    audio.durationSeconds !== undefined
      ? ` · ${Math.floor(audio.durationSeconds / 60)} min ${audio.durationSeconds % 60} s`
      : ' · duración no legible';

  build.add({
    id: `audio-${audio.name}`,
    indicator: 'Archivo de audio recibido',
    category: 'contenido',
    classification: 'determinista',
    status: 'verificado',
    severity: 'informativo',
    evidence: `«${quoteFragment(audio.name, 48)}» · ${audio.mimeType} · ${(audio.size / 1024).toFixed(0)} KB${duration}. Permanece en memoria y no se guarda.`,
    source,
    recommendation: 'Comparte solo el fragmento relevante de la llamada.',
    limitation:
      'Son los metadatos del archivo. No dicen nada sobre lo que se dijo en la llamada ni sobre quién habló.',
  });

  const available = transcription.status === 'disponible';
  build.add({
    id: 'audio-transcripcion',
    indicator: available ? 'Transcripción automática del audio' : 'Transcripción del audio pendiente',
    category: 'contenido',
    classification: available ? 'ia' : 'pendiente-externo',
    status: available ? 'no concluyente' : 'no verificado',
    severity: 'informativo',
    evidence: describeTranscription(transcription),
    source: available ? (transcription.engine ?? 'motor no informado') : source,
    recommendation: available
      ? 'Revisa que la transcripción coincida con lo que recuerdas antes de confiar en el análisis.'
      : 'Escribe tú lo que recuerdes de la llamada y analízalo como transcripción.',
    limitation: available
      ? 'Es texto reconocido por una máquina, no una cita textual: una palabra mal reconocida puede inventar o borrar una señal.'
      : 'Sin transcripción no se analizó ni una palabra del audio. El contenido de la llamada está sin revisar.',
  });

  const pendingExternal = available
    ? ['exactitud de la transcripción automática']
    : ['transcripción del contenido del audio'];

  return {
    subject: 'audio',
    indicators: build.indicators,
    coverage: {
      label: available
        ? 'Metadatos leídos y transcripción automática obtenida; su exactitud no está verificada.'
        : 'Solo metadatos del archivo. El contenido del audio no se analizó.',
      checksRun: 2,
      checksTotal: 3,
      pendingExternal,
    },
    limitation: available
      ? 'El análisis se hizo sobre una transcripción automática, que puede diferir de lo que se dijo.'
      : 'No se analizó el contenido del audio: no hay transcripción.',
  };
}

// ---------------------------------------------------------------------------
// VUCUB CAMÉ · contenido financiero
// ---------------------------------------------------------------------------

/**
 * Audita contenido financiero: catálogo general, catálogo financiero y las
 * comprobaciones aritméticas de CLABE y Luhn.
 *
 * Las evidencias **nunca** contienen un número completo: solo la versión
 * enmascarada que produce `finance.ts`.
 */
export function auditFinancial(input: string, now = new Date()): Audit {
  const checkedAt = now.toISOString();
  const build = builder(checkedAt);
  const source = 'Comparación local contra los catálogos de fraude y comprobación aritmética';
  const mathSource = 'Cálculo del dígito verificador en el dispositivo';
  const { text, map } = normalizeWithMap(input);

  const words = input.trim() ? input.trim().split(/\s+/).length : 0;
  build.add({
    id: 'financiero-recibido',
    indicator: 'Contenido financiero analizado',
    category: 'contenido',
    classification: 'determinista',
    status: 'verificado',
    severity: 'informativo',
    evidence: `Texto de ${input.length} caracteres y ${words} palabras, analizado íntegramente en el dispositivo.`,
    source,
    recommendation: 'No compartas números de cuenta o tarjeta completos más allá de lo necesario.',
    limitation: 'El texto no permite verificar a quién pertenece ninguna cuenta.',
  });

  matchCatalogue(contentPatterns, input, text, map, build, source);
  matchCatalogue(financePatterns, input, text, map, build, source);

  // --- Aritmética ---------------------------------------------------------
  const found = findFinancialIdentifiers(input);

  for (const masked of found.invalidClabes) {
    build.add({
      id: `clabe-invalida-${masked}`,
      indicator: 'CLABE con dígito verificador incorrecto',
      category: 'financiero',
      classification: 'determinista',
      status: 'sospechoso',
      severity: 'alto',
      evidence: `El número ${masked} tiene 18 dígitos pero su dígito verificador no cuadra: no es una CLABE válida.`,
      source: mathSource,
      recommendation:
        'Nadie que espere cobrarte de verdad te da una CLABE inválida. Puede ser un número inventado o mal copiado: no transfieras.',
      limitation:
        'También puede ser un error de transcripción al copiar el número. Verifícalo con la persona por un canal que ya conocías.',
    });
  }

  if (found.validClabes.length) {
    build.add({
      id: 'clabe-valida',
      indicator: 'CLABE con estructura válida',
      category: 'financiero',
      classification: 'determinista',
      status: 'verificado',
      severity: 'informativo',
      evidence: `Se detectó ${found.validClabes.length} CLABE(s) cuyo dígito verificador cuadra: ${found.validClabes.join(', ')}. Institución(es) según el código: ${found.institutions
        .map((code) => describeInstitution(code))
        .join('; ')}.`,
      source: `${mathSource} y catálogo de instituciones incorporado`,
      recommendation:
        'Dato de contexto: no lo tomes como prueba de que la cuenta sea legítima ni de que pertenezca a quien dice el mensaje.',
      limitation: `Que el verificador cuadre solo significa que el número está bien formado. La cuenta de un estafador también lo cumple. ${CATALOGUE_NOTE}`,
    });
  }

  // Discrepancia entre la institución nombrada en el texto y la institución a
  // la que pertenece la cuenta dictada. Es un hecho comprobable, no una
  // interpretación: «tu cuenta Santander» con una CLABE que empieza en 127 no
  // es una cuenta de Santander. No prueba fraude, así que se emite como medio.
  const mismatch = institutionMismatch(input, found.institutions);
  if (mismatch) {
    build.add({
      id: 'clabe-institucion-discrepante',
      indicator: 'La cuenta no pertenece al banco que nombra el mensaje',
      category: 'financiero',
      classification: 'determinista',
      status: 'sospechoso',
      severity: 'medio',
      evidence: `El texto nombra a ${mismatch.mentioned
        .map((code) => institutionName(code))
        .join(', ')}, pero la CLABE indicada corresponde a ${mismatch.fromClabe
        .map((code) => describeInstitution(code))
        .join('; ')}.`,
      source: 'Comparación en el dispositivo entre el texto y el código de la CLABE',
      recommendation:
        'Un cobro «de tu banco» que se paga a una cuenta de otra institución merece una llamada al número oficial de tu tarjeta antes de transferir.',
      limitation: `No es prueba de fraude: una persona o un negocio puede pedir el depósito en otro banco con toda legitimidad. ${CATALOGUE_NOTE}`,
    });
  }

  if (found.validClabes.length + found.invalidClabes.length >= 2) {
    build.add({
      id: 'clabe-multiple',
      indicator: 'Se mencionan varias cuentas distintas',
      category: 'financiero',
      classification: 'determinista',
      status: 'sospechoso',
      severity: 'medio',
      evidence: `El texto contiene ${found.validClabes.length + found.invalidClabes.length} números de cuenta distintos.`,
      source: mathSource,
      recommendation:
        'Varias cuentas en un mismo mensaje es un patrón de reenvío de fraude. Confirma el dato por el canal oficial antes de pagar.',
      limitation: 'Puede ocurrir en una conversación legítima que corrige un dato.',
    });
  }

  for (const masked of found.invalidCards) {
    build.add({
      id: `tarjeta-invalida-${masked}`,
      indicator: 'Número de tarjeta que no pasa la validación de Luhn',
      category: 'financiero',
      classification: 'determinista',
      status: 'sospechoso',
      severity: 'medio',
      evidence: `El número ${masked} tiene longitud de tarjeta pero no cumple el algoritmo de Luhn.`,
      source: mathSource,
      recommendation: 'No es un número de tarjeta válido. Desconfía del origen del mensaje.',
      limitation:
        'Puede ser un número de referencia, un folio o un identificador que no es una tarjeta.',
    });
  }

  if (found.validCards.length) {
    build.add({
      id: 'tarjeta-presente',
      indicator: 'El texto contiene un número de tarjeta',
      category: 'financiero',
      classification: 'determinista',
      status: 'sospechoso',
      severity: 'medio',
      evidence: `Se detectó ${found.validCards.length} número(s) con estructura de tarjeta válida: ${found.validCards.join(', ')}.`,
      source: mathSource,
      recommendation:
        'Un número de tarjeta no debe viajar por mensaje. Si es tuyo, bórralo de la conversación; si te lo enviaron, no lo reenvíes.',
      limitation:
        'Que pase Luhn solo significa que está bien formado: no indica que la tarjeta exista, esté activa ni a quién pertenece.',
    });
  }

  if (found.cryptoAddresses.length) {
    build.add({
      id: 'cripto-direccion',
      indicator: 'Dirección con forma de monedero de criptomoneda',
      category: 'financiero',
      classification: 'determinista',
      status: 'sospechoso',
      severity: 'alto',
      evidence: `Se detectó una dirección con forma de monedero: ${found.cryptoAddresses.join(', ')}.`,
      source: 'Comprobación de formato en el dispositivo',
      recommendation:
        'Un pago en criptomoneda no se puede revertir ni reclamar a nadie. Es el medio preferido del fraude por esa razón.',
      limitation:
        'Solo se comprobó la forma de la cadena. No se consultó ninguna cadena de bloques: no se sabe si la dirección existe, ni su saldo, ni su historial.',
    });
  }

  const urls = extractUrls(input);
  if (urls.length) {
    build.add({
      id: 'financiero-con-enlaces',
      indicator: 'El contenido financiero incluye enlaces',
      category: 'contenido',
      classification: 'determinista',
      status: 'no concluyente',
      severity: 'informativo',
      evidence: `Se detectaron ${urls.length} enlace(s); ninguno se abrió.`,
      source,
      recommendation: 'No abras enlaces de pago recibidos por mensaje: entra tú a la aplicación oficial.',
      limitation: 'El destino real del enlace queda sin comprobar.',
    });
  }

  // Si hay una cuenta, una tarjeta o un monedero en juego, la titularidad
  // queda sin comprobar y eso impide el verde. El cálculo demuestra que el
  // número está bien formado, nunca de quién es: exactamente el mismo
  // razonamiento que impide declarar segura una URL que resuelve en el DNS.
  const identifiers =
    found.validClabes.length +
    found.invalidClabes.length +
    found.validCards.length +
    found.invalidCards.length +
    found.cryptoAddresses.length;
  const financialPending = identifiers
    ? ['titularidad de la cuenta o del medio de pago', 'recepción real del pago']
    : [];

  const checks = contentPatterns.length + financePatterns.length + FINANCE_ARITHMETIC_CHECKS;
  return {
    subject: 'financiero',
    indicators: build.indicators,
    coverage: {
      label:
        'Texto completo analizado localmente, con comprobación aritmética de CLABE y Luhn. No se consultó ninguna institución.',
      checksRun: checks,
      checksTotal:
        checks + financialPending.length + (urls.length ? URL_PENDING_EXTERNAL.length : 0),
      pendingExternal: [...financialPending, ...(urls.length ? URL_PENDING_EXTERNAL : [])],
    },
    limitation:
      'No se consultó ninguna institución financiera ni padrón regulatorio. Una cuenta bien formada no es una cuenta legítima, y esta herramienta no puede confirmar que un pago se haya recibido.',
  };
}

// ---------------------------------------------------------------------------
// Auditoría de imágenes adjuntas
// ---------------------------------------------------------------------------

export type ImageFacts = { name: string; mimeType: string; size: number; width?: number; height?: number; ocrTextAvailable?: boolean };

export function auditImages(images: ImageFacts[], now = new Date()): Audit {
  const checkedAt = now.toISOString();
  const build = builder(checkedAt);
  const source = 'Metadatos leídos en el dispositivo';

  for (const image of images) {
    build.add({
      id: `imagen-${image.name}`,
      indicator: 'Imagen adjunta',
      category: 'contenido',
      classification: 'determinista',
      status: 'verificado',
      severity: 'informativo',
      evidence: `«${quoteFragment(image.name, 48)}» · ${image.mimeType} · ${(image.size / 1024).toFixed(0)} KB${
        image.width && image.height ? ` · ${image.width}×${image.height} px` : ''
      }. Permanece en memoria y no se guarda.`,
      source,
      recommendation: 'Cubre los datos personales visibles antes de compartir una captura.',
      limitation: image.ocrTextAvailable ? 'El texto reconocido automáticamente puede contener errores u omisiones.' : 'No se confirmó la lectura local de esta imagen.',
    });
  }

  build.add({
    id: 'imagen-ocr-pendiente',
    indicator: 'Lectura de texto en la imagen',
    category: 'externo',
    classification: 'pendiente-externo',
    status: 'no verificado',
    severity: 'informativo',
    evidence: images.some(image => image.ocrTextAvailable)
      ? 'Se reconoció texto automáticamente; puede haber errores u omisiones y debe cotejarse con la imagen.'
      : 'No se dispone de texto confirmado por OCR local para esta imagen. Puede no haber soporte, no haber texto legible o haber ocurrido un error.',
    source: images.some(image => image.ocrTextAvailable) ? 'Reconocimiento del navegador' : 'OCR local no confirmado',
    recommendation:
      'Si el contenido importante está en la imagen, transcribe también el texto para que el análisis determinista lo cubra.',
    limitation:
      'Las señales deterministas de texto no se aplican al contenido que solo aparece dentro de la imagen.',
  });

  return {
    subject: 'imagen',
    indicators: build.indicators,
    coverage: {
      label: images.some(image => image.ocrTextAvailable) ? 'Metadatos y texto reconocido automáticamente; lectura incompleta posible.' : 'Solo metadatos locales de la imagen; sin lectura de su contenido.',
      checksRun: images.length,
      checksTotal: images.length + 2,
      pendingExternal: ['reconocimiento de texto en la imagen', 'procedencia de la imagen'],
    },
    limitation: images.some(image => image.ocrTextAvailable) ? 'El OCR puede pasar por alto contenido; coteja el texto con la imagen.' : 'Una imagen sin señales no indica seguridad: su contenido no se analizó de forma determinista.',
  };
}

// ---------------------------------------------------------------------------
// Fusión
// ---------------------------------------------------------------------------

export function mergeAudits(parts: Audit[]): Audit {
  const present = parts.filter(Boolean);
  if (present.length === 1) return present[0];
  const subjects = new Set(present.map((part) => part.subject));
  const pending = new Set<string>();
  for (const part of present) for (const item of part.coverage.pendingExternal) pending.add(item);
  return {
    subject: subjects.size === 1 ? [...subjects][0] : 'mixto',
    indicators: present.flatMap((part) => part.indicators),
    coverage: {
      label: present.map((part) => part.coverage.label).join(' '),
      checksRun: present.reduce((total, part) => total + part.coverage.checksRun, 0),
      checksTotal: present.reduce((total, part) => total + part.coverage.checksTotal, 0),
      pendingExternal: [...pending],
    },
    limitation: present.map((part) => part.limitation).join(' '),
  };
}

/** Punto de entrada único usado por la interfaz. */
export function auditContent(
  payload: { kind: 'message' | 'url'; text: string; images?: ImageFacts[] },
  now = new Date(),
): Audit {
  const parts: Audit[] = [];
  if (payload.kind === 'url') parts.push(auditUrl(payload.text, now));
  else if (payload.text.trim()) parts.push(auditMessage(payload.text, now));
  if (payload.images?.length) parts.push(auditImages(payload.images, now));
  if (!parts.length) {
    return {
      subject: 'mensaje',
      indicators: [],
      coverage: { label: 'Sin contenido analizado.', checksRun: 0, checksTotal: 0, pendingExternal: ['contenido no proporcionado'] },
      limitation: 'No se recibió contenido que auditar.',
    };
  }
  return mergeAudits(parts);
}
