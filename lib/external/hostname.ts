// Puerta única de validación de host. Ninguna consulta externa sale sin pasar
// por aquí. Se rechaza, nunca se corrige: corregir una entrada sospechosa es
// la forma más rápida de convertir un filtro en un bypass.

import { parse } from 'tldts';
import { classifyIp } from './net-guard.ts';

export type HostCheck =
  | {
      ok: true;
      /** Host completo normalizado, para la consulta DNS. */
      host: string;
      /** Dominio registrable, unidad que usa RDAP/WHOIS. */
      registrable: string;
      /** Sufijo público completo, p. ej. `com.mx`. */
      publicSuffix: string;
      /** Última etiqueta del sufijo: la clave del bootstrap RDAP. */
      tld: string;
    }
  | { ok: false; reason: string };

/** Sufijos que no existen en el DNS público: consultarlos no tiene sentido. */
const NON_ROUTABLE = new Set(['test', 'local', 'localhost', 'invalid', 'example', 'onion', 'internal', 'home arpa']);

/** Solo letras, dígitos y guiones (LDH); el host ya llega en Punycode. */
const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export function validateHostForLookup(input: unknown): HostCheck {
  if (typeof input !== 'string') return { ok: false, reason: 'El host debe ser una cadena.' };

  const host = input.trim().toLowerCase().replace(/\.$/, '');
  if (!host) return { ok: false, reason: 'Host vacío.' };
  if (host.length > 253) return { ok: false, reason: 'El host supera 253 caracteres.' };

  // Cierra la inyección en el parámetro de consulta: cualquier carácter fuera
  // del juego LDH y el punto se rechaza antes de construir ninguna URL.
  if (!/^[a-z0-9.-]+$/.test(host)) {
    return { ok: false, reason: 'El host contiene caracteres no permitidos.' };
  }
  if (host.includes('..')) return { ok: false, reason: 'El host contiene una etiqueta vacía.' };

  if (classifyIp(host) !== 'invalida') {
    return { ok: false, reason: 'El host es una dirección IP: no admite consulta de dominio.' };
  }

  const labels = host.split('.');
  if (labels.length < 2) return { ok: false, reason: 'El host no tiene dominio y terminación.' };
  for (const label of labels) {
    if (!LABEL.test(label)) return { ok: false, reason: `Etiqueta no válida: «${label}».` };
  }

  const info = parse(host, { allowPrivateDomains: false });
  const publicSuffix = (info.publicSuffix ?? '').toLowerCase();
  const registrable = (info.domain ?? '').toLowerCase();

  if (!publicSuffix) return { ok: false, reason: 'No se identificó la terminación.' };
  if (NON_ROUTABLE.has(publicSuffix)) {
    return { ok: false, reason: `La terminación «.${publicSuffix}» no existe en el DNS público.` };
  }
  if (!info.isIcann) {
    return { ok: false, reason: `La terminación «.${publicSuffix}» no está en la lista ICANN.` };
  }
  if (!registrable) return { ok: false, reason: 'No se identificó un dominio registrable.' };

  const tld = publicSuffix.split('.').pop() ?? '';
  if (!tld) return { ok: false, reason: 'No se identificó la terminación de primer nivel.' };

  return { ok: true, host, registrable, publicSuffix, tld };
}
