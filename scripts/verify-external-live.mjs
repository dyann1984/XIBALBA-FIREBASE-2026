// VERIFICACIÓN REAL de las auditorías externas. Hace consultas de red.
//
// Qué es y qué no es
// ------------------
// Esto NO es parte de `npm test`. La suite automatizada es íntegramente
// simulada. Este script es la comprobación controlada y autorizada contra
// registros públicos, para confirmar que los adaptadores funcionan de verdad
// contra las respuestas reales, que son más sucias que cualquier doble.
//
// Se ejecuta a mano:  node scripts/verify-external-live.mjs
//
// Garantías que el propio script comprueba
// ----------------------------------------
//   · Se registra CADA URL de salida y se verifica que todas apuntan a un
//     resolutor DoH autorizado o a un servidor RDAP del bootstrap de IANA.
//     Si alguna petición fuera al dominio analizado, el script falla.
//   · Solo se consultan dominios públicos de referencia. Ningún dato personal.
//   · No habilita nada: pasa `force: true` solo en este proceso. El
//     interruptor XIBALBA_EXTERNAL_AUDITS sigue apagado para la aplicación.

import { runExternalAudit, resetExternalState } from '../lib/external/index.ts';
import { DOH_PROVIDERS } from '../lib/external/doh.ts';
import { rdapServerFor } from '../lib/external/rdap.ts';
import { validateHostForLookup } from '../lib/external/hostname.ts';

const outbound = [];

/** Envuelve `fetch` para registrar cada destino real. */
const recordingFetch = async (url, init) => {
  outbound.push(url);
  return fetch(url, init);
};

/** Hosts a los que es legítimo conectar. */
const ALLOWED_HOSTS = new Set([
  ...DOH_PROVIDERS.map((p) => p.host),
  ...['com', 'net', 'org', 'mx', 'io']
    .map((tld) => rdapServerFor(tld))
    .filter(Boolean)
    .map((base) => new URL(base).hostname),
]);

/** Dominios públicos de referencia. Ninguno es de una persona. */
const REFERENCE = [
  { host: 'example.com', expect: 'RDAP disponible (.com), dominio reservado por IANA' },
  { host: 'iana.org', expect: 'RDAP disponible (.org)' },
  { host: 'nic.mx', expect: 'sin RDAP: .mx cae al adaptador WHOIS deshabilitado' },
  { host: 'www.unam.mx', expect: 'sin RDAP, subdominio: debe reducirse a unam.mx' },
  { host: 'banxico.org.mx', expect: 'sufijo de dos niveles org.mx, TLD mx, sin RDAP' },
  {
    host: 'dominio-inexistente-para-prueba-xibalba-9f3a.com',
    expect: 'NXDOMAIN: debe declararse inexistente, no error',
  },
];

/** Entradas que deben rechazarse sin generar una sola petición. */
const MUST_REJECT = [
  'localhost',
  '127.0.0.1',
  '169.254.169.254',
  'metadata.google.internal',
  'example.com&type=TXT',
  'example.com/../admin',
  'ejemplo..com',
  '::ffff:127.0.0.1',
  'equipo.local',
];

function line(char = '-') {
  console.log(char.repeat(78));
}

let failures = 0;
function check(condition, message) {
  if (condition) {
    console.log(`   OK   ${message}`);
  } else {
    console.log(`   FALLO ${message}`);
    failures += 1;
  }
}

async function main() {
  console.log('VERIFICACION REAL DE AUDITORIAS EXTERNAS');
  console.log(`Fecha: ${new Date().toISOString()}`);
  console.log(`Resolutores autorizados: ${[...ALLOWED_HOSTS].join(', ')}`);
  line('=');

  // --- 1. Rechazos: no deben generar ninguna petición ----------------------
  console.log('\n1. ENTRADAS QUE DEBEN RECHAZARSE SIN CONSULTAR NADA\n');
  for (const host of MUST_REJECT) {
    const before = outbound.length;
    resetExternalState();
    const result = await runExternalAudit(host, { force: true, fetch: recordingFetch, useCache: false });
    const rejected = result.dns === null && result.indicators[0]?.id === 'externo-host-rechazado';
    const silent = outbound.length === before;
    check(rejected && silent, `«${host}» rechazado${silent ? ' y sin peticiones' : ' PERO GENERO TRAFICO'}`);
    if (rejected) console.log(`        motivo: ${result.indicators[0].evidence}`);
  }

  // --- 2. Dominios de referencia ------------------------------------------
  console.log('\n');
  line('=');
  console.log('\n2. DOMINIOS PUBLICOS DE REFERENCIA\n');

  for (const { host, expect } of REFERENCE) {
    resetExternalState();
    const parsed = validateHostForLookup(host);
    console.log(`\n>> ${host}`);
    console.log(`   esperado: ${expect}`);
    if (parsed.ok) {
      console.log(`   registrable: ${parsed.registrable} | sufijo: ${parsed.publicSuffix} | TLD: ${parsed.tld}`);
    }

    const started = Date.now();
    const result = await runExternalAudit(host, {
      force: true,
      fetch: recordingFetch,
      useCache: false,
      timeoutMs: 6000,
    });
    const ms = Date.now() - started;

    console.log(`   DNS      : ${result.dns?.status} | fuente: ${result.dns?.source}`);
    if (result.dns?.reason) console.log(`              motivo: ${result.dns.reason}`);
    if (result.dns?.data) {
      console.log(`              existe=${result.dns.data.exists} direcciones=${result.dns.data.addresses.length} ttl=${result.dns.data.ttlSeconds}`);
      console.log(`              NS: ${result.dns.data.nameServers.slice(0, 3).join(', ') || '(ninguno)'}`);
      if (result.dns.data.nonPublicAddresses.length) {
        console.log(`              NO PUBLICAS: ${JSON.stringify(result.dns.data.nonPublicAddresses)}`);
      }
    }
    console.log(`   Registro : ${result.registration?.check}/${result.registration?.status} | fuente: ${result.registration?.source}`);
    if (result.registration?.reason) console.log(`              motivo: ${result.registration.reason}`);
    if (result.registration?.data) {
      const d = result.registration.data;
      console.log(`              creado=${d.registeredAt} vence=${d.expiresAt} registrador=${d.registrar}`);
      console.log(`              estados: ${d.statuses.join(', ') || '(ninguno)'} redactado=${d.dateRedacted}`);
    }
    console.log(`   Resueltas: ${result.resolved.join(', ') || '(ninguna)'}`);
    console.log(`   Evidencia (${result.indicators.length}):`);
    for (const item of result.indicators) {
      console.log(`     [${item.classification}/${item.status}/${item.severity}] ${item.indicator}`);
      console.log(`        ${item.evidence}`);
      console.log(`        fuente: ${item.source} · ${item.checkedAt}`);
    }
    console.log(`   (${ms} ms)`);

    // Toda evidencia debe citar fuente y fecha.
    const cited = result.indicators.every((i) => i.source && !Number.isNaN(Date.parse(i.checkedAt)));
    check(cited, `${host}: toda la evidencia cita fuente y fecha`);
  }

  // --- 3. Tiempo de espera ------------------------------------------------
  console.log('\n');
  line('=');
  console.log('\n3. TIEMPO DE ESPERA AGOTADO (timeout de 1 ms)\n');
  resetExternalState();
  const timedOut = await runExternalAudit('example.com', {
    force: true,
    fetch: recordingFetch,
    useCache: false,
    timeoutMs: 1,
  });
  console.log(`   DNS: ${timedOut.dns?.status} — ${timedOut.dns?.reason ?? ''}`);
  console.log(`   Registro: ${timedOut.registration?.status} — ${timedOut.registration?.reason ?? ''}`);
  check(timedOut.dns?.status === 'error', 'un timeout se declara error, no resultado');
  check(
    timedOut.indicators.every((i) => i.status !== 'sospechoso'),
    'un timeout no se convierte en senal de riesgo',
  );
  check(timedOut.resolved.length === 0, 'un timeout no marca comprobaciones como resueltas');

  // --- 4. Auditoría del tráfico generado ----------------------------------
  console.log('\n');
  line('=');
  console.log('\n4. AUDITORIA DEL TRAFICO DE SALIDA\n');
  const hosts = new Map();
  for (const url of outbound) {
    const host = new URL(url).hostname;
    hosts.set(host, (hosts.get(host) ?? 0) + 1);
  }
  for (const [host, count] of [...hosts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${String(count).padStart(4)}  ${host}`);
  }
  const strays = [...hosts.keys()].filter((host) => !ALLOWED_HOSTS.has(host));
  check(strays.length === 0, `ninguna peticion fuera de la lista autorizada${strays.length ? `: ${strays.join(', ')}` : ''}`);

  const analyzed = REFERENCE.map((r) => r.host).concat('nic.mx', 'unam.mx', 'banxico.org.mx');
  const contacted = [...hosts.keys()].filter((host) => analyzed.some((d) => host === d || host.endsWith(`.${d}`)));
  check(contacted.length === 0, `NUNCA se contacto el dominio analizado${contacted.length ? `: ${contacted.join(', ')}` : ''}`);
  check(
    outbound.every((url) => url.startsWith('https://')),
    'todas las peticiones por HTTPS',
  );

  console.log('\n');
  line('=');
  console.log(`\nRESULTADO: ${failures === 0 ? 'TODAS LAS COMPROBACIONES EN VERDE' : `${failures} FALLO(S)`}`);
  console.log(`Peticiones de salida totales: ${outbound.length}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error('El script fallo:', error);
  process.exitCode = 1;
});
