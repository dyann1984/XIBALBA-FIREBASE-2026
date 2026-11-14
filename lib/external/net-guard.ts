// Clasificación de direcciones IP y validación de URL de salida.
//
// Se usa en dos puntos: para decidir si una respuesta DNS apunta a un rango no
// enrutable (señal de riesgo) y para impedir que una consulta externa termine
// conectando a la red interna (SSRF y DNS rebinding).

export type IpClass =
  | 'publica'
  | 'privada'
  | 'loopback'
  | 'link-local'
  | 'reservada'
  | 'multicast'
  | 'invalida';

/** Rangos IPv4 no enrutables en Internet público. */
const IPV4_RANGES: { cidr: string; cls: IpClass }[] = [
  { cidr: '0.0.0.0/8', cls: 'reservada' },
  { cidr: '10.0.0.0/8', cls: 'privada' },
  { cidr: '100.64.0.0/10', cls: 'reservada' }, // CGNAT
  { cidr: '127.0.0.0/8', cls: 'loopback' },
  { cidr: '169.254.0.0/16', cls: 'link-local' }, // incluye 169.254.169.254
  { cidr: '172.16.0.0/12', cls: 'privada' },
  { cidr: '192.0.0.0/24', cls: 'reservada' },
  { cidr: '192.0.2.0/24', cls: 'reservada' },
  { cidr: '192.88.99.0/24', cls: 'reservada' },
  { cidr: '192.168.0.0/16', cls: 'privada' },
  { cidr: '198.18.0.0/15', cls: 'reservada' },
  { cidr: '198.51.100.0/24', cls: 'reservada' },
  { cidr: '203.0.113.0/24', cls: 'reservada' },
  { cidr: '224.0.0.0/4', cls: 'multicast' },
  { cidr: '240.0.0.0/4', cls: 'reservada' },
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    // Rechaza ceros a la izquierda: «010» puede interpretarse como octal.
    if (part.length > 1 && part[0] === '0') return null;
    value = value * 256 + octet;
  }
  return value >>> 0;
}

function inCidr(ipInt: number, cidr: string): boolean {
  const [base, bitsText] = cidr.split('/');
  const baseInt = ipv4ToInt(base);
  if (baseInt === null) return false;
  const bits = Number(bitsText);
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

function classifyIpv4(ip: string): IpClass {
  const value = ipv4ToInt(ip);
  if (value === null) return 'invalida';
  if (value === 0xffffffff) return 'reservada';
  for (const range of IPV4_RANGES) if (inCidr(value, range.cidr)) return range.cls;
  return 'publica';
}

/** Expande una dirección IPv6 a sus ocho grupos de 16 bits. */
function expandIpv6(input: string): number[] | null {
  let text = input.trim().toLowerCase();
  if (text.startsWith('[') && text.endsWith(']')) text = text.slice(1, -1);
  text = text.replace(/%[0-9a-z]+$/i, ''); // identificador de zona
  if (!/^[0-9a-f:.]+$/.test(text)) return null;

  // Forma mixta con cola IPv4: ::ffff:192.168.0.1
  let tailGroups: number[] = [];
  const lastColon = text.lastIndexOf(':');
  const tail = text.slice(lastColon + 1);
  if (tail.includes('.')) {
    const value = ipv4ToInt(tail);
    if (value === null) return null;
    tailGroups = [(value >>> 16) & 0xffff, value & 0xffff];
    text = text.slice(0, lastColon + 1) + '0';
  }

  const halves = text.split('::');
  if (halves.length > 2) return null;
  const parse = (part: string) =>
    part
      ? part.split(':').map((group) => (/^[0-9a-f]{1,4}$/.test(group) ? parseInt(group, 16) : NaN))
      : [];

  let groups: number[];
  if (halves.length === 2) {
    const head = parse(halves[0]);
    const rest = parse(halves[1]);
    const tailAll = tailGroups.length ? [...rest.slice(0, -1), ...tailGroups] : rest;
    const fill = 8 - head.length - tailAll.length;
    if (fill < 0) return null;
    groups = [...head, ...Array(fill).fill(0), ...tailAll];
  } else {
    const head = parse(halves[0]);
    groups = tailGroups.length ? [...head.slice(0, -1), ...tailGroups] : head;
  }
  if (groups.length !== 8 || groups.some((g) => Number.isNaN(g))) return null;
  return groups;
}

function classifyIpv6(input: string): IpClass {
  const groups = expandIpv6(input);
  if (!groups) return 'invalida';

  // IPv4 mapeada (::ffff:a.b.c.d) y traducida (64:ff9b::/96): hay que
  // desenvolverlas y reclasificar, o son una vía directa de evasión.
  const isMapped = groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff;
  const isNat64 = groups[0] === 0x0064 && groups[1] === 0xff9b && groups.slice(2, 6).every((g) => g === 0);
  if (isMapped || isNat64) {
    const a = (groups[6] >> 8) & 0xff;
    const b = groups[6] & 0xff;
    const c = (groups[7] >> 8) & 0xff;
    const d = groups[7] & 0xff;
    return classifyIpv4(`${a}.${b}.${c}.${d}`);
  }

  if (groups.every((g) => g === 0)) return 'reservada'; // ::
  if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) return 'loopback'; // ::1
  if ((groups[0] & 0xfe00) === 0xfc00) return 'privada'; // fc00::/7 ULA
  if ((groups[0] & 0xffc0) === 0xfe80) return 'link-local'; // fe80::/10
  if ((groups[0] & 0xff00) === 0xff00) return 'multicast'; // ff00::/8
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) return 'reservada'; // documentación
  if (groups[0] === 0x0100 && groups.slice(1, 4).every((g) => g === 0)) return 'reservada'; // descarte
  return 'publica';
}

export function classifyIp(ip: string): IpClass {
  const value = ip.trim();
  if (!value) return 'invalida';
  if (value.includes(':')) return classifyIpv6(value);
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return classifyIpv4(value);
  return 'invalida';
}

export function isPublicIp(ip: string): boolean {
  return classifyIp(ip) === 'publica';
}

/**
 * Comprueba que una URL de salida es aceptable antes de conectar.
 * No resuelve DNS: eso corresponde a la capa de transporte, que debe volver a
 * validar la IP resuelta en cada salto para cerrar el DNS rebinding.
 */
export function assertSafeOutboundUrl(
  raw: string,
  allowedHosts?: readonly string[],
): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'URL malformada.' };
  }
  if (url.protocol !== 'https:') return { ok: false, reason: 'Solo se permite HTTPS.' };
  if (url.username || url.password) return { ok: false, reason: 'La URL incluye credenciales.' };

  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const literal = classifyIp(host);
  if (literal !== 'invalida' && literal !== 'publica') {
    return { ok: false, reason: `El host apunta a un rango ${literal}.` };
  }
  if (allowedHosts && !allowedHosts.includes(host)) {
    return { ok: false, reason: `Host no permitido: ${host}.` };
  }
  return { ok: true, url };
}
