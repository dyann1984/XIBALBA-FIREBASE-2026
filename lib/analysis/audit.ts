import { parse } from 'tldts';
import { contentPatterns, normalizeWithMap, quoteFragment } from './patterns.ts';
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
const URL_LOCAL_CHECKS = 18;

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

  for (const pattern of contentPatterns) {
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
  }

  const urls = extractUrls(input);
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
// Auditoría de imágenes adjuntas
// ---------------------------------------------------------------------------

export type ImageFacts = { name: string; mimeType: string; size: number; width?: number; height?: number };

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
      limitation: 'No se extrajo texto de la imagen en el dispositivo.',
    });
  }

  build.add({
    id: 'imagen-ocr-pendiente',
    indicator: 'Lectura de texto en la imagen',
    category: 'externo',
    classification: 'pendiente-externo',
    status: 'no verificado',
    severity: 'informativo',
    evidence:
      'No se ejecutó reconocimiento de texto local. Si la imagen se procesa, lo hace el modelo multimodal bajo consentimiento explícito.',
    source: 'OCR local no implementado',
    recommendation:
      'Si el contenido importante está en la imagen, transcribe también el texto para que el análisis determinista lo cubra.',
    limitation:
      'Las señales deterministas de texto no se aplican al contenido que solo aparece dentro de la imagen.',
  });

  return {
    subject: 'imagen',
    indicators: build.indicators,
    coverage: {
      label: 'Solo metadatos locales de la imagen; sin lectura de su contenido.',
      checksRun: images.length,
      checksTotal: images.length + 2,
      pendingExternal: ['reconocimiento de texto en la imagen', 'procedencia de la imagen'],
    },
    limitation:
      'Una imagen sin señales no indica seguridad: su contenido no se analizó de forma determinista.',
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
