// Comprobaciones financieras deterministas.
//
// Esto es lo que distingue a VUCUB CAMÉ del resto de agentes: aquí hay
// aritmética que sale o no sale, no heurística con falsos positivos. Una CLABE
// trae dígito verificador y una tarjeta trae Luhn.
//
// REGLA QUE NO SE NEGOCIA
// Una CLABE o una tarjeta matemáticamente válida NO demuestra nada: ni que sea
// legítima, ni que sea segura, ni que pertenezca a quien dice el mensaje. La
// cuenta del estafador también pasa el verificador. Por eso un número válido
// se emite como evidencia informativa y nunca reduce el riesgo, igual que la
// antigüedad de un dominio.
//
// PRIVACIDAD
// Ninguna función de este módulo devuelve un número completo para mostrar.
// `maskClabe` y `maskCard` son el único camino hacia la evidencia.

// ---------------------------------------------------------------------------
// CLABE
// ---------------------------------------------------------------------------

/**
 * Dígito verificador de una CLABE.
 *
 * 18 dígitos: 3 de institución, 3 de plaza, 11 de cuenta, 1 verificador.
 * Pesos 3, 7, 1 repetidos sobre los 17 primeros; de cada producto se toma el
 * módulo 10; el verificador es (10 − (suma mod 10)) mod 10.
 *
 * Comprobado contra una CLABE válida conocida, 002010077777777771, cuyo
 * verificador calculado es 1.
 */
export function clabeCheckDigit(first17: string): number | null {
  if (!/^\d{17}$/.test(first17)) return null;
  const weights = [3, 7, 1];
  let sum = 0;
  for (let index = 0; index < 17; index += 1) {
    sum += (Number(first17[index]) * weights[index % 3]) % 10;
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * El resultado NO incluye el número completo, a propósito: así no hay forma de
 * que una CLABE entera llegue a una evidencia, a un registro o a la interfaz
 * por descuido. Solo salen el código de institución y la versión enmascarada.
 */
export type ClabeCheck =
  | { ok: true; institution: string; masked: string }
  | { ok: false; reason: 'longitud' | 'no-numerico' | 'verificador'; masked: string };

/** Valida una CLABE completa. Nunca devuelve el número sin enmascarar. */
export function validateClabe(input: string): ClabeCheck {
  const digits = input.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(digits)) return { ok: false, reason: 'no-numerico', masked: maskClabe(digits) };
  if (digits.length !== 18) return { ok: false, reason: 'longitud', masked: maskClabe(digits) };

  const expected = clabeCheckDigit(digits.slice(0, 17));
  if (expected === null || expected !== Number(digits[17])) {
    return { ok: false, reason: 'verificador', masked: maskClabe(digits) };
  }
  return { ok: true, institution: digits.slice(0, 3), masked: maskClabe(digits) };
}

/** Deja visibles los 3 dígitos de institución y los 4 últimos. */
export function maskClabe(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length < 8) return '*'.repeat(Math.max(digits.length, 1));
  const head = digits.slice(0, 3);
  const tail = digits.slice(-4);
  return `${head}${'*'.repeat(digits.length - 7)}${tail}`;
}

// ---------------------------------------------------------------------------
// Tarjeta
// ---------------------------------------------------------------------------

/** Algoritmo de Luhn. */
export function luhnValid(input: string): boolean {
  const digits = input.replace(/[\s-]/g, '');
  if (!/^\d{12,19}$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let value = Number(digits[index]);
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Deja visibles solo los 4 últimos dígitos. */
export function maskCard(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length < 5) return '*'.repeat(Math.max(digits.length, 1));
  return `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Extracción
// ---------------------------------------------------------------------------

/** Secuencias de 12 a 19 dígitos, admitiendo espacios y guiones de separación. */
const NUMBER_RUN = /\b\d(?:[\d\s-]{10,27})\d\b/g;

/**
 * Direcciones con forma de monedero de criptomoneda. Es detección de FORMA:
 * no se consulta ninguna cadena de bloques ni se comprueba que exista.
 */
const CRYPTO_ADDRESS = [
  /\b(bc1[a-z0-9]{25,62})\b/i, // Bitcoin segwit
  /\b([13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/, // Bitcoin heredado
  /\b(0x[a-fA-F0-9]{40})\b/, // Ethereum y compatibles
  /\b(T[A-Za-z0-9]{33})\b/, // Tron
];

export type FinancialFindings = {
  /** CLABE con verificador correcto. Enmascaradas. */
  validClabes: string[];
  /** Candidatas de 18 dígitos cuyo verificador no cuadra. Enmascaradas. */
  invalidClabes: string[];
  /** Tarjetas que pasan Luhn. Enmascaradas. */
  validCards: string[];
  /** Candidatas de 13 a 19 dígitos que no pasan Luhn. Enmascaradas. */
  invalidCards: string[];
  /** Instituciones distintas mencionadas por código CLABE. */
  institutions: string[];
  /** Direcciones con forma de monedero, enmascaradas. */
  cryptoAddresses: string[];
};

/**
 * Busca identificadores financieros en un texto.
 *
 * Un número de 18 dígitos se trata como CLABE; uno de 13 a 19 que pase Luhn,
 * como tarjeta. Una CLABE de 18 dígitos que además pasara Luhn se cuenta como
 * CLABE: en México es la interpretación correcta.
 */
export function findFinancialIdentifiers(input: string): FinancialFindings {
  const validClabes: string[] = [];
  const invalidClabes: string[] = [];
  const validCards: string[] = [];
  const invalidCards: string[] = [];
  const institutions = new Set<string>();
  const cryptoAddresses: string[] = [];

  for (const match of input.matchAll(NUMBER_RUN)) {
    const digits = match[0].replace(/[\s-]/g, '');
    if (!/^\d+$/.test(digits)) continue;

    if (digits.length === 18) {
      const check = validateClabe(digits);
      if (check.ok) {
        if (!validClabes.includes(check.masked)) validClabes.push(check.masked);
        institutions.add(check.institution);
      } else if (!invalidClabes.includes(check.masked)) {
        invalidClabes.push(check.masked);
      }
      continue;
    }

    if (digits.length >= 13 && digits.length <= 19) {
      const masked = maskCard(digits);
      if (luhnValid(digits)) {
        if (!validCards.includes(masked)) validCards.push(masked);
      } else if (!invalidCards.includes(masked)) {
        invalidCards.push(masked);
      }
    }
  }

  for (const expression of CRYPTO_ADDRESS) {
    const match = expression.exec(input);
    if (!match) continue;
    const address = match[1];
    const masked = `${address.slice(0, 6)}…${address.slice(-4)}`;
    if (!cryptoAddresses.includes(masked)) cryptoAddresses.push(masked);
  }

  return {
    validClabes,
    invalidClabes,
    validCards,
    invalidCards,
    institutions: [...institutions],
    cryptoAddresses,
  };
}

/**
 * Construye una CLABE válida a partir de 17 dígitos. Existe para las pruebas:
 * así nunca hace falta una cuenta real para probar el verificador.
 */
export function buildClabe(first17: string): string | null {
  const check = clabeCheckDigit(first17);
  return check === null ? null : `${first17}${check}`;
}
