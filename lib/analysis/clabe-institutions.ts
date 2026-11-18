// Catálogo de instituciones por código CLABE.
//
// Los 3 primeros dígitos de una CLABE identifican a la institución ante el
// SPEI. Hasta esta fase la evidencia mostraba el código desnudo («002»), que no
// dice nada a una persona. Aquí se traduce a un nombre.
//
// LO QUE ESTE CATÁLOGO NO ES
// --------------------------
//  1. **No está completo.** Es un subconjunto de la lista pública de
//     participantes del SPEI de Banco de México: los bancos de uso corriente en
//     México y las instituciones de pago electrónico que más aparecen en
//     mensajes de fraude. Un código que no esté aquí se declara «no
//     identificado», nunca se adivina y nunca se trata como sospechoso por el
//     solo hecho de faltar.
//  2. **No es una consulta en línea.** No se contacta a Banco de México ni a
//     ninguna institución: es una tabla en el dispositivo.
//  3. **No prueba nada sobre la cuenta.** Saber que un número pertenece al
//     rango de un banco no dice si la cuenta existe, si está activa, de quién
//     es, ni si el cobro es legítimo. La cuenta de un estafador también vive en
//     un banco real. Por eso el nombre de la institución se emite siempre como
//     evidencia **informativa** y nunca reduce el riesgo.
//
// Los códigos y nombres deben re-verificarse contra la lista vigente de
// participantes del SPEI antes de presentar el proyecto: las instituciones se
// fusionan, cambian de nombre y causan baja. Ver `docs/pendientes-hackathon.md`.

/** Tipo de institución, solo para explicar el dato a la persona. */
export type InstitutionType =
  | 'banco'
  | 'banca-de-desarrollo'
  | 'pago-electronico'
  | 'entidad-de-ahorro';

export type Institution = {
  /** Nombre comercial con el que la gente la conoce. */
  name: string;
  type: InstitutionType;
  /**
   * Formas de nombrarla dentro de un mensaje, ya normalizadas (minúsculas, sin
   * acentos). Solo se incluyen las que no se confunden con palabras comunes:
   * una entrada sin alias no participa en la detección de discrepancias.
   */
  aliases?: string[];
};

/**
 * Subconjunto del catálogo de participantes del SPEI.
 * Fuente: lista pública de participantes del SPEI de Banco de México.
 * Última revisión manual incorporada: noviembre de 2026.
 */
export const CLABE_INSTITUTIONS: Record<string, Institution> = {
  '002': { name: 'Citibanamex (Banamex)', type: 'banco', aliases: ['banamex', 'citibanamex'] },
  '006': { name: 'Bancomext', type: 'banca-de-desarrollo', aliases: ['bancomext'] },
  '009': { name: 'Banobras', type: 'banca-de-desarrollo', aliases: ['banobras'] },
  '012': { name: 'BBVA México', type: 'banco', aliases: ['bbva', 'bancomer'] },
  '014': { name: 'Santander', type: 'banco', aliases: ['santander'] },
  '019': { name: 'Banjército', type: 'banca-de-desarrollo', aliases: ['banjercito'] },
  '021': { name: 'HSBC', type: 'banco', aliases: ['hsbc'] },
  '030': { name: 'Banco del Bajío', type: 'banco', aliases: ['banco del bajio', 'banbajio'] },
  '036': { name: 'Inbursa', type: 'banco', aliases: ['inbursa'] },
  '042': { name: 'Mifel', type: 'banco', aliases: ['mifel'] },
  '044': { name: 'Scotiabank', type: 'banco', aliases: ['scotiabank', 'scotia'] },
  '058': { name: 'Banregio', type: 'banco', aliases: ['banregio'] },
  '059': { name: 'Invex', type: 'banco', aliases: ['invex'] },
  '060': { name: 'Bansi', type: 'banco', aliases: ['bansi'] },
  '062': { name: 'Afirme', type: 'banco', aliases: ['afirme'] },
  '072': { name: 'Banorte', type: 'banco', aliases: ['banorte'] },
  '103': { name: 'American Express Bank', type: 'banco', aliases: ['american express', 'amex'] },
  '106': { name: 'Bank of America', type: 'banco', aliases: ['bank of america'] },
  '108': { name: 'MUFG Bank', type: 'banco', aliases: ['mufg'] },
  '110': { name: 'J.P. Morgan', type: 'banco', aliases: ['jp morgan', 'j.p. morgan'] },
  '112': { name: 'BMonex', type: 'banco', aliases: ['bmonex', 'monex'] },
  '113': { name: 'Ve por Más', type: 'banco', aliases: ['ve por mas', 'bx+'] },
  '127': { name: 'Banco Azteca', type: 'banco', aliases: ['banco azteca', 'azteca'] },
  '128': { name: 'Banco Autofin', type: 'banco', aliases: ['autofin'] },
  '129': { name: 'Barclays', type: 'banco', aliases: ['barclays'] },
  '130': { name: 'Compartamos Banco', type: 'banco', aliases: ['compartamos'] },
  '132': { name: 'Multiva', type: 'banco', aliases: ['multiva'] },
  '133': { name: 'Actinver', type: 'banco', aliases: ['actinver'] },
  '135': { name: 'Nacional Financiera (Nafin)', type: 'banca-de-desarrollo', aliases: ['nafin'] },
  '136': { name: 'Intercam Banco', type: 'banco', aliases: ['intercam'] },
  '137': { name: 'BanCoppel', type: 'banco', aliases: ['bancoppel'] },
  '138': { name: 'ABC Capital', type: 'banco', aliases: ['abc capital'] },
  '140': { name: 'Consubanco', type: 'banco', aliases: ['consubanco'] },
  '141': { name: 'Volkswagen Bank', type: 'banco', aliases: ['volkswagen bank'] },
  '143': { name: 'CIBanco', type: 'banco', aliases: ['cibanco'] },
  '145': { name: 'Banco BASE', type: 'banco', aliases: ['banco base'] },
  '147': { name: 'Bankaool', type: 'banco', aliases: ['bankaool'] },
  '148': { name: 'Banco PagaTodo', type: 'banco', aliases: ['pagatodo'] },
  '166': { name: 'Banco del Bienestar', type: 'banca-de-desarrollo', aliases: ['banco del bienestar', 'bansefi'] },
  '168': { name: 'Sociedad Hipotecaria Federal', type: 'banca-de-desarrollo' },
  '646': { name: 'STP (Sistema de Transferencias y Pagos)', type: 'pago-electronico', aliases: ['stp'] },
  '670': { name: 'Libertad Servicios Financieros', type: 'entidad-de-ahorro', aliases: ['libertad servicios'] },
  '677': { name: 'Caja Popular Mexicana', type: 'entidad-de-ahorro', aliases: ['caja popular mexicana'] },
  '706': { name: 'Arcus', type: 'pago-electronico' },
  '710': { name: 'NVIO Pagos México', type: 'pago-electronico', aliases: ['nvio'] },
  '722': { name: 'Mercado Pago', type: 'pago-electronico', aliases: ['mercado pago'] },
  '723': { name: 'Cuenca', type: 'pago-electronico' },
  '728': { name: 'SPIN by OXXO', type: 'pago-electronico', aliases: ['spin by oxxo'] },
};

export const INSTITUTION_TYPE_LABEL: Record<InstitutionType, string> = {
  banco: 'banco',
  'banca-de-desarrollo': 'banca de desarrollo',
  'pago-electronico': 'institución de pago electrónico',
  'entidad-de-ahorro': 'entidad de ahorro y crédito popular',
};

/** Texto que acompaña a toda evidencia que use este catálogo. */
export const CATALOGUE_NOTE =
  'El nombre proviene de una tabla incorporada en la aplicación (subconjunto de la lista pública de participantes del SPEI), no de una consulta a Banco de México. Saber a qué institución corresponde el rango de un número no dice si la cuenta existe, de quién es, ni si el cobro es legítimo.';

/** Minúsculas y sin acentos, para comparar nombres escritos de cualquier forma. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Nombre de la institución, o `null` si el código no está en el catálogo. */
export function institutionName(code: string): string | null {
  return CLABE_INSTITUTIONS[code]?.name ?? null;
}

/**
 * Descripción legible de un código de institución. Un código ausente se
 * declara como tal: no se adivina un nombre.
 */
export function describeInstitution(code: string): string {
  const institution = CLABE_INSTITUTIONS[code];
  if (!institution) return `${code} · institución no identificada en el catálogo incorporado`;
  return `${code} · ${institution.name} (${INSTITUTION_TYPE_LABEL[institution.type]})`;
}

/**
 * Códigos de las instituciones **nombradas en el texto**.
 *
 * Solo se buscan los alias declarados, que están elegidos para no confundirse
 * con palabras de uso común: «oxxo» o «cuenca», por ejemplo, no son alias de
 * nadie, porque aparecen en frases que no hablan de esa institución.
 */
export function mentionedInstitutions(text: string): string[] {
  const haystack = normalize(text ?? '');
  if (!haystack.trim()) return [];
  const codes: string[] = [];
  for (const [code, institution] of Object.entries(CLABE_INSTITUTIONS)) {
    for (const alias of institution.aliases ?? []) {
      // Frontera de palabra manual: los alias pueden contener espacios y «+».
      const pattern = new RegExp(`(^|[^a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`);
      if (pattern.test(haystack)) {
        if (!codes.includes(code)) codes.push(code);
        break;
      }
    }
  }
  return codes;
}

/**
 * Discrepancia entre la institución que el texto nombra y la institución a la
 * que pertenece la CLABE dictada.
 *
 * Es un hecho comprobable: «tu cuenta BBVA» con una CLABE que empieza en 127
 * no es una cuenta de BBVA. No es prueba de fraude —una persona puede pedir el
 * depósito en otro banco— pero sí una señal que merece verificarse.
 *
 * Devuelve `null` cuando no hay nada que comparar: sin nombres reconocidos en
 * el texto, sin CLABE identificada, o cuando alguna de las instituciones
 * nombradas sí coincide con alguna de las cuentas.
 */
export function institutionMismatch(
  text: string,
  clabeCodes: string[],
): { mentioned: string[]; fromClabe: string[] } | null {
  const identified = clabeCodes.filter((code) => CLABE_INSTITUTIONS[code]);
  if (!identified.length) return null;
  const mentioned = mentionedInstitutions(text);
  if (!mentioned.length) return null;
  if (mentioned.some((code) => identified.includes(code))) return null;
  return { mentioned, fromClabe: identified };
}
