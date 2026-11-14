// Pruebas de las auditorías externas (DNS, RDAP, WHOIS .mx).
//
// TODAS LAS PRUEBAS DE ESTE ARCHIVO SON SIMULADAS. No sale ni una petición a
// la red: el `fetch` se inyecta en cada caso y el reloj también. Por eso los
// resultados son deterministas y no dependen de que un registro público esté
// disponible, ni consumen su cuota.
//
// Las consultas externas realmente realizadas durante el desarrollo se
// documentan aparte, en docs/plan-dns-rdap.md, con fecha y resultado. No se
// mezclan con este archivo.

import test from 'node:test';
import assert from 'node:assert/strict';

import { auditUrl, combineRisk } from '../lib/analysis/audit.ts';
import { classifyIp, assertSafeOutboundUrl } from '../lib/external/net-guard.ts';
import { validateHostForLookup } from '../lib/external/hostname.ts';
import { lookupDns, DOH_PROVIDERS } from '../lib/external/doh.ts';
import { lookupRdap, hasRdap, rdapServerFor, parseRdapDomain } from '../lib/external/rdap.ts';
import {
  lookupWhoisMx,
  parseWhoisMx,
  parseWhoisDate,
  WHOIS_MX_ENABLED,
} from '../lib/external/whois-mx.ts';
import { interpretDns } from '../lib/external/interpret-dns.ts';
import { interpretRegistration } from '../lib/external/interpret-rdap.ts';
import { TtlCache, RateLimiter } from '../lib/external/cache.ts';
import { runExternalAudit, applyExternalAudit, resetExternalState } from '../lib/external/index.ts';

const NOW = new Date('2026-11-13T12:00:00Z');

/** Dirección pública de verdad. Ojo: 203.0.113.0/24 es rango de documentación
 *  y el guardia la marca como reservada, así que no sirve de fixture «normal». */
const PUBLIC_IP = '93.184.216.34';

// ---------------------------------------------------------------------------
// Dobles de prueba
// ---------------------------------------------------------------------------

const TYPE_CODE = { A: 1, AAAA: 28, NS: 2, MX: 15 };

/** `fetch` falso que responde a DoH según un mapa de registros. */
function fakeDoh(records, { status = 0, calls = [] } = {}) {
  return async (url) => {
    calls.push(url);
    const type = new URL(url).searchParams.get('type');
    const data = records[type] ?? [];
    const body = JSON.stringify({
      Status: status,
      Answer: data.map((value) => ({ name: 'x', type: TYPE_CODE[type], TTL: 300, data: value })),
    });
    return { ok: true, status: 200, text: async () => body };
  };
}

/** `fetch` falso que devuelve un cuerpo y código fijos. */
function fakeHttp(body, { ok = true, status = 200, calls = [] } = {}) {
  return async (url) => {
    calls.push(url);
    return { ok, status, text: async () => body };
  };
}

const failingFetch = async () => {
  throw new Error('red no disponible');
};

/** Encamina DoH al doble DNS y cualquier otra cosa al doble RDAP. */
function routed(records, rdap) {
  return async (url) => {
    const host = new URL(url).hostname;
    if (DOH_PROVIDERS.some((p) => p.host === host)) return fakeDoh(records)(url);
    return fakeHttp(rdap)(url);
  };
}

function rdapBody(overrides = {}) {
  return JSON.stringify({
    objectClassName: 'domain',
    ldhName: 'ejemplo.com',
    status: ['client transfer prohibited'],
    events: [{ eventAction: 'registration', eventDate: '2009-04-12T00:00:00Z' }],
    entities: [
      {
        roles: ['registrar'],
        vcardArray: [
          'vcard',
          [
            ['version', {}, 'text', '4.0'],
            ['fn', {}, 'text', 'Registrador Ejemplo'],
          ],
        ],
      },
    ],
    // Enlace que NO debe seguirse nunca.
    links: [{ rel: 'self', href: 'https://169.254.169.254/latest/meta-data/' }],
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Validación de host: la puerta única
// ---------------------------------------------------------------------------

test('el validador de host rechaza lo que no es un dominio público consultable', () => {
  const rejected = [
    '',
    '   ',
    'localhost',
    'host',
    '127.0.0.1',
    '::1',
    '192.168.1.1',
    'equipo.local',
    'algo.test',
    'sitio.invalid',
    'oculto.onion',
    'ejemplo.com/..%2f',
    'ejemplo.com&type=TXT',
    'ejemplo .com',
    'ejemplo..com',
    'ejemplo.com\u0000',
    'tienda.méxico',
    `${'a'.repeat(250)}.com`,
    null,
    undefined,
    42,
  ];
  for (const value of rejected) {
    const result = validateHostForLookup(value);
    assert.equal(result.ok, false, `debería rechazar ${JSON.stringify(value)}`);
    assert.ok(result.reason.length > 0);
  }
});

test('el validador separa dominio registrable, sufijo público y TLD del bootstrap', () => {
  const com = validateHostForLookup('Pagos.Ejemplo.COM.');
  assert.equal(com.ok, true);
  assert.equal(com.host, 'pagos.ejemplo.com');
  assert.equal(com.registrable, 'ejemplo.com');
  assert.equal(com.publicSuffix, 'com');
  assert.equal(com.tld, 'com');

  // Caso mexicano de dos niveles: el TLD que usa el bootstrap es «mx».
  const comMx = validateHostForLookup('www.tienda.com.mx');
  assert.equal(comMx.ok, true);
  assert.equal(comMx.registrable, 'tienda.com.mx');
  assert.equal(comMx.publicSuffix, 'com.mx');
  assert.equal(comMx.tld, 'mx');

  const mx = validateHostForLookup('banco.mx');
  assert.equal(mx.ok, true);
  assert.equal(mx.registrable, 'banco.mx');
  assert.equal(mx.publicSuffix, 'mx');
  assert.equal(mx.tld, 'mx');
});

// ---------------------------------------------------------------------------
// SSRF y rebinding
// ---------------------------------------------------------------------------

test('la clasificación de IP cubre los rangos que se usan para evadir filtros', () => {
  const cases = [
    ['8.8.8.8', 'publica'],
    [PUBLIC_IP, 'publica'],
    ['127.0.0.1', 'loopback'],
    ['10.1.2.3', 'privada'],
    ['172.20.0.1', 'privada'],
    ['192.168.0.1', 'privada'],
    ['169.254.169.254', 'link-local'],
    ['100.64.0.1', 'reservada'],
    ['203.0.113.10', 'reservada'],
    ['224.0.0.1', 'multicast'],
    ['255.255.255.255', 'reservada'],
    // Ceros a la izquierda: «010.0.0.1» se interpreta como octal en algunas
    // bibliotecas y puede apuntar a otra dirección. Se rechaza de plano.
    ['010.0.0.1', 'invalida'],
    ['::1', 'loopback'],
    ['fe80::1', 'link-local'],
    ['fc00::1', 'privada'],
    ['2001:db8::1', 'reservada'],
    ['2606:4700::1111', 'publica'],
    // IPv4 mapeada y NAT64: hay que desenvolverlas o son una evasión directa.
    ['::ffff:127.0.0.1', 'loopback'],
    ['::ffff:192.168.1.1', 'privada'],
    ['64:ff9b::169.254.169.254', 'link-local'],
    ['no-es-una-ip', 'invalida'],
  ];
  for (const [ip, expected] of cases) {
    assert.equal(classifyIp(ip), expected, `${ip} debería ser ${expected}`);
  }
});

test('la validación de URL de salida bloquea http, credenciales, rangos internos y hosts no autorizados', () => {
  const allowed = ['cloudflare-dns.com'];
  assert.equal(assertSafeOutboundUrl('http://cloudflare-dns.com/dns-query', allowed).ok, false);
  assert.equal(assertSafeOutboundUrl('https://user:pass@cloudflare-dns.com/', allowed).ok, false);
  assert.equal(assertSafeOutboundUrl('https://169.254.169.254/', allowed).ok, false);
  assert.equal(assertSafeOutboundUrl('https://127.0.0.1/', allowed).ok, false);
  assert.equal(assertSafeOutboundUrl('https://atacante.example/', allowed).ok, false);
  assert.equal(assertSafeOutboundUrl('no-es-una-url', allowed).ok, false);
  assert.equal(assertSafeOutboundUrl('https://cloudflare-dns.com/dns-query', allowed).ok, true);
});

test('solo se consultan resolutores DoH de la lista cerrada, por HTTPS', () => {
  assert.ok(DOH_PROVIDERS.length >= 1);
  for (const provider of DOH_PROVIDERS) {
    assert.ok(provider.url.startsWith('https://'), `${provider.name} debe usar HTTPS`);
    assert.equal(new URL(provider.url).hostname, provider.host);
  }
});

// ---------------------------------------------------------------------------
// DNS sobre HTTPS
// ---------------------------------------------------------------------------

test('DNS: una respuesta válida produce hechos citables y nunca contacta al sitio analizado', async () => {
  const calls = [];
  const result = await lookupDns('tienda.com.mx', {
    fetch: fakeDoh(
      { A: [PUBLIC_IP], NS: ['ns1.proveedor.com'], MX: ['10 mail.proveedor.com'] },
      { calls },
    ),
    now: NOW,
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.check, 'dns');
  assert.equal(result.data.exists, true);
  assert.deepEqual(result.data.addresses, [PUBLIC_IP]);
  assert.deepEqual(result.data.nameServers, ['ns1.proveedor.com']);
  assert.deepEqual(result.data.nonPublicAddresses, []);
  assert.equal(result.data.ttlSeconds, 300);
  assert.equal(result.checkedAt, NOW.toISOString());

  // Toda consulta fue a un resolutor autorizado, jamás al dominio sospechoso.
  assert.ok(calls.length > 0);
  for (const url of calls) {
    const host = new URL(url).hostname;
    assert.ok(
      DOH_PROVIDERS.some((p) => p.host === host),
      `consulta inesperada a ${host}`,
    );
    assert.equal(new URL(url).searchParams.get('name'), 'tienda.com.mx');
  }
});

test('DNS: NXDOMAIN se declara como dominio inexistente, no como error', async () => {
  const result = await lookupDns('no-existe.com', {
    fetch: fakeDoh({}, { status: 3 }),
    now: NOW,
  });
  assert.equal(result.status, 'ok');
  assert.equal(result.data.exists, false);
  assert.deepEqual(result.data.addresses, []);
});

test('DNS: una dirección en rango interno queda marcada', async () => {
  const result = await lookupDns('raro.com', {
    fetch: fakeDoh({ A: ['127.0.0.1', PUBLIC_IP] }),
    now: NOW,
  });
  assert.equal(result.status, 'ok');
  assert.equal(result.data.nonPublicAddresses.length, 1);
  assert.equal(result.data.nonPublicAddresses[0].ip, '127.0.0.1');
  assert.equal(result.data.nonPublicAddresses[0].cls, 'loopback');
});

test('DNS: respuestas vacías, inválidas, fallidas o excesivas terminan en error con motivo', async () => {
  const cases = [
    ['cuerpo vacío', { fetch: fakeHttp('') }],
    ['JSON inválido', { fetch: fakeHttp('{no es json') }],
    ['sin campo Status', { fetch: fakeHttp('{"Answer":[]}') }],
    ['Answer con forma incorrecta', { fetch: fakeHttp('{"Status":0,"Answer":[{"type":"A"}]}') }],
    ['código HTTP 500', { fetch: fakeHttp('{}', { ok: false, status: 500 }) }],
    ['fallo de red o tiempo agotado', { fetch: failingFetch }],
    ['respuesta demasiado grande', { fetch: fakeHttp('{"Status":0}'), maxBytes: 3 }],
  ];
  for (const [label, deps] of cases) {
    const result = await lookupDns('ejemplo.com', { ...deps, now: NOW });
    assert.equal(result.status, 'error', `${label} debería dar error`);
    assert.equal(result.data, null);
    assert.ok(result.reason.length > 0, `${label} debe explicar el motivo`);
  }
});

// ---------------------------------------------------------------------------
// RDAP y el hallazgo sobre «.mx»
// ---------------------------------------------------------------------------

test('el bootstrap de IANA no publica RDAP para «mx» ni para otros ccTLD', () => {
  // Hecho verificado contra https://data.iana.org/rdap/dns.json
  // (publicación 2026-10-28T22:00:04Z). No se inventa un servicio que no existe.
  for (const tld of ['mx', 'cl', 'co', 'es', 'us', 'io']) {
    assert.equal(hasRdap(tld), false, `«${tld}» no debería tener RDAP`);
    assert.equal(rdapServerFor(tld), null);
  }
  for (const tld of ['com', 'net', 'org']) {
    assert.equal(hasRdap(tld), true, `«${tld}» sí tiene RDAP`);
    assert.ok(rdapServerFor(tld).startsWith('https://'));
  }
});

test('RDAP: un TLD sin servidor devuelve «no disponible», nunca una fecha inventada', async () => {
  const calls = [];
  const result = await lookupRdap('banco.mx', 'mx', {
    fetch: fakeHttp('{}', { calls }),
    now: NOW,
  });
  assert.equal(result.status, 'no-disponible');
  assert.equal(result.data, null);
  assert.match(result.reason, /no publica un servidor RDAP/i);
  assert.match(result.source, /IANA/);
  // Y no se intentó ninguna conexión.
  assert.equal(calls.length, 0);
});

test('RDAP: una respuesta válida entrega fecha de creación y registrador', async () => {
  const calls = [];
  const result = await lookupRdap('ejemplo.com', 'com', {
    fetch: fakeHttp(rdapBody(), { calls }),
    now: NOW,
  });
  assert.equal(result.status, 'ok');
  assert.equal(result.data.registeredAt, '2009-04-12T00:00:00.000Z');
  assert.equal(result.data.registrar, 'Registrador Ejemplo');
  assert.deepEqual(result.data.statuses, ['client transfer prohibited']);

  // Se consultó el servidor del bootstrap y nunca el `links[].href` de la
  // respuesta, que apuntaba a un rango interno.
  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0]).hostname, new URL(rdapServerFor('com')).hostname);
  assert.ok(!calls.some((url) => url.includes('169.254')));
});

test('RDAP: 404 significa no registrado; 429 y 500 son no verificable', async () => {
  const notFound = await lookupRdap('ejemplo.com', 'com', {
    fetch: fakeHttp('', { ok: false, status: 404 }),
    now: NOW,
  });
  assert.equal(notFound.status, 'ok');
  assert.equal(notFound.data, null);
  assert.match(notFound.reason, /no está registrado/i);

  for (const status of [429, 503, 500]) {
    const result = await lookupRdap('ejemplo.com', 'com', {
      fetch: fakeHttp('', { ok: false, status }),
      now: NOW,
    });
    assert.equal(result.status, 'error', `código ${status}`);
    assert.equal(result.data, null);
    assert.ok(result.reason.length > 0);
  }
});

test('RDAP: cuerpo inválido, vacío o fallo de red no inventan datos', async () => {
  for (const deps of [
    { fetch: fakeHttp('') },
    { fetch: fakeHttp('{roto') },
    { fetch: fakeHttp('"solo un texto"') },
    { fetch: failingFetch },
  ]) {
    const result = await lookupRdap('ejemplo.com', 'com', { ...deps, now: NOW });
    assert.equal(result.status, 'error');
    assert.equal(result.data, null);
  }
});

test('RDAP: una fecha de creación oculta se declara redactada, no «dominio nuevo»', () => {
  const facts = parseRdapDomain(
    {
      events: [{ eventAction: 'last changed', eventDate: '2026-01-01T00:00:00Z' }],
      redacted: [{ name: { type: 'Registration date' } }],
    },
    'ejemplo.com',
  );
  assert.equal(facts.registeredAt, null);
  assert.equal(facts.dateRedacted, true);
});

// ---------------------------------------------------------------------------
// WHOIS .mx: preparado y deshabilitado
// ---------------------------------------------------------------------------

test('el adaptador WHOIS .mx está deshabilitado y no consulta nada', async () => {
  assert.equal(WHOIS_MX_ENABLED, false);
  const result = await lookupWhoisMx('banco.mx', { now: NOW });
  assert.equal(result.check, 'whois');
  assert.equal(result.status, 'deshabilitada');
  assert.equal(result.data, null);
  assert.match(result.reason, /no verificable/i);
  assert.match(result.source, /no realizada/i);
});

test('el analizador WHOIS reconoce fechas en los formatos esperados', () => {
  assert.equal(parseWhoisDate('2010-11-23'), '2010-11-23T00:00:00.000Z');
  assert.equal(parseWhoisDate('2010-11-23 15:04:05'), '2010-11-23T00:00:00.000Z');
  // Orden mexicano día/mes/año, no el estadounidense.
  assert.equal(parseWhoisDate('23/11/2010'), '2010-11-23T00:00:00.000Z');
  assert.equal(parseWhoisDate('noviembre de 2010'), null);
  assert.equal(parseWhoisDate(''), null);
});

test('el analizador WHOIS distingue dominio inexistente, datos y datos redactados', () => {
  assert.equal(parseWhoisMx('El objeto no se encontro.', 'banco.mx').found, false);
  assert.equal(parseWhoisMx('Object_Not_Found', 'banco.mx').found, false);
  assert.equal(parseWhoisMx('No match for domain', 'banco.mx').found, false);

  const parsed = parseWhoisMx(
    [
      'Domain Name: banco.mx',
      'Created On: 2010-11-23',
      'Expiration Date: 2027-11-23',
      'Last Updated On: 25/10/2026',
      'Registrar: Registrador Ejemplo',
      'Domain Status: ACTIVE',
    ].join('\n'),
    'banco.mx',
  );
  assert.equal(parsed.found, true);
  assert.equal(parsed.facts.registeredAt, '2010-11-23T00:00:00.000Z');
  assert.equal(parsed.facts.lastChangedAt, '2026-10-25T00:00:00.000Z');
  assert.equal(parsed.facts.registrar, 'Registrador Ejemplo');
  assert.deepEqual(parsed.facts.statuses, ['ACTIVE']);
  assert.equal(parsed.facts.dateRedacted, false);

  const redacted = parseWhoisMx('Domain Name: banco.mx\nRegistrar: Alguien', 'banco.mx');
  assert.equal(redacted.found, true);
  assert.equal(redacted.facts.registeredAt, null);
  assert.equal(redacted.facts.dateRedacted, true);
});

// ---------------------------------------------------------------------------
// Interpretación: resolver no es ser legítimo
// ---------------------------------------------------------------------------

test('que un dominio resuelva se emite como contexto informativo, no como señal de seguridad', async () => {
  const dns = await lookupDns('tienda.com', { fetch: fakeDoh({ A: [PUBLIC_IP] }), now: NOW });
  const indicators = interpretDns(dns);
  const resolution = indicators.find((item) => item.id === 'dns-resolucion');

  assert.equal(resolution.classification, 'verificado-externo');
  assert.equal(resolution.status, 'verificado');
  assert.equal(resolution.severity, 'informativo');
  assert.match(resolution.limitation, /no reduce el riesgo/i);
  // Ningún indicador de una resolución correcta es «sospechoso».
  assert.equal(indicators.filter((item) => item.status === 'sospechoso').length, 0);
});

test('un dominio inexistente o apuntando a rangos internos sí eleva el riesgo', async () => {
  const missing = interpretDns(
    await lookupDns('no-existe.com', { fetch: fakeDoh({}, { status: 3 }), now: NOW }),
  );
  assert.equal(missing[0].id, 'dns-inexistente');
  assert.equal(missing[0].status, 'sospechoso');
  assert.equal(missing[0].classification, 'verificado-externo');

  const internal = interpretDns(
    await lookupDns('raro.com', { fetch: fakeDoh({ A: ['10.0.0.5'] }), now: NOW }),
  );
  const flagged = internal.find((item) => item.id === 'dns-rango-no-publico');
  assert.equal(flagged.status, 'sospechoso');
  assert.equal(flagged.severity, 'alto');
});

test('un fallo de DNS se clasifica como error (D), no como señal de riesgo', async () => {
  const indicators = interpretDns(await lookupDns('ejemplo.com', { fetch: failingFetch, now: NOW }));
  assert.equal(indicators[0].classification, 'error');
  assert.equal(indicators[0].status, 'error');
});

test('la antigüedad alta es contexto; la antigüedad corta es señal', () => {
  const facts = (registeredAt, registrable = 'ejemplo.com') => ({
    check: 'rdap',
    status: 'ok',
    source: 'rdap.ejemplo (RDAP)',
    checkedAt: NOW.toISOString(),
    data: {
      registrable,
      registeredAt,
      expiresAt: null,
      lastChangedAt: null,
      registrar: 'Registrador Ejemplo',
      statuses: [],
      dateRedacted: false,
    },
  });

  const old = interpretRegistration(facts('2009-04-12T00:00:00Z'), { now: NOW });
  const age = old.find((item) => item.id === 'rdap-antiguedad');
  assert.equal(age.status, 'verificado');
  assert.equal(age.severity, 'informativo');
  assert.match(age.limitation, /no reduce el riesgo/i);

  const recent = interpretRegistration(
    facts('2026-11-05T00:00:00Z', 'oferta-imperdible.com'),
    { now: NOW },
  );
  const fresh = recent.find((item) => item.id === 'rdap-dominio-reciente');
  assert.equal(fresh.status, 'sospechoso');
  assert.equal(fresh.severity, 'alto');
  assert.match(fresh.evidence, /hace 8 d/);
  assert.match(fresh.limitation, /negocio leg/i);

  // Entre 30 y 180 días: señal media, no alta.
  const months = interpretRegistration(facts('2026-09-01T00:00:00Z'), { now: NOW });
  const medium = months.find((item) => item.id === 'rdap-dominio-reciente');
  assert.equal(medium.severity, 'medio');
});

test('datos contradictorios del registro se descartan como error, no se interpretan', () => {
  const future = interpretRegistration(
    {
      check: 'rdap',
      status: 'ok',
      source: 'rdap.ejemplo (RDAP)',
      checkedAt: NOW.toISOString(),
      data: {
        registrable: 'ejemplo.com',
        registeredAt: '2030-01-01T00:00:00Z',
        expiresAt: null,
        lastChangedAt: null,
        registrar: null,
        statuses: [],
        dateRedacted: false,
      },
    },
    { now: NOW },
  );
  const bad = future.find((item) => item.id === 'rdap-fecha-contradictoria');
  assert.equal(bad.classification, 'error');
  assert.equal(bad.status, 'error');
  assert.equal(
    future.some((item) => item.status === 'sospechoso'),
    false,
  );
});

test('un TLD sin RDAP se muestra como no verificable, en la clase pendiente', async () => {
  const result = await lookupRdap('banco.mx', 'mx', { fetch: fakeHttp('{}'), now: NOW });
  const indicators = interpretRegistration(result, { now: NOW });
  assert.equal(indicators[0].classification, 'pendiente-externo');
  assert.equal(indicators[0].status, 'no verificado');
  assert.match(indicators[0].recommendation, /No concluyente/i);
});

// ---------------------------------------------------------------------------
// Caché y límites
// ---------------------------------------------------------------------------

test('la caché vence por tiempo y respeta el tamaño máximo', () => {
  let now = 1000;
  const cache = new TtlCache(100, 2, () => now);
  cache.set('a', 1);
  assert.equal(cache.get('a'), 1);
  now += 101;
  assert.equal(cache.get('a'), null, 'debería haber vencido');

  now = 2000;
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3);
  assert.equal(cache.size, 2, 'no debe crecer sin límite');
});

test('el limitador corta al alcanzar el tope y se recupera al pasar la ventana', () => {
  let now = 0;
  const limiter = new RateLimiter(2, 1000, () => now);
  assert.equal(limiter.tryAcquire('k'), true);
  assert.equal(limiter.tryAcquire('k'), true);
  assert.equal(limiter.tryAcquire('k'), false);
  assert.equal(limiter.remaining('k'), 0);
  assert.equal(limiter.tryAcquire('otra'), true, 'las claves son independientes');
  now += 1001;
  assert.equal(limiter.tryAcquire('k'), true);
});

// ---------------------------------------------------------------------------
// Orquestador
// ---------------------------------------------------------------------------

test('sin el interruptor activado no sale ninguna consulta a la red', async () => {
  resetExternalState();
  let called = false;
  const external = await runExternalAudit('ejemplo.com', {
    fetch: async () => {
      called = true;
      throw new Error('no debería llamarse');
    },
    now: NOW,
  });
  assert.equal(called, false);
  assert.equal(external.dns.status, 'deshabilitada');
  assert.equal(external.registration.status, 'deshabilitada');
  assert.deepEqual(external.resolved, []);
  assert.ok(external.indicators.every((item) => item.classification === 'pendiente-externo'));
});

test('un host no válido no dispara consultas y se explica el motivo', async () => {
  resetExternalState();
  const external = await runExternalAudit('127.0.0.1', {
    force: true,
    fetch: failingFetch,
    now: NOW,
  });
  assert.equal(external.dns, null);
  assert.equal(external.indicators[0].id, 'externo-host-rechazado');
  assert.equal(external.indicators[0].classification, 'pendiente-externo');
});

test('orquestador sobre un dominio .com: DNS y RDAP resuelven sus etiquetas pendientes', async () => {
  resetExternalState();
  const external = await runExternalAudit('ejemplo.com', {
    force: true,
    useCache: false,
    now: NOW,
    fetch: routed({ A: [PUBLIC_IP] }, rdapBody()),
  });
  assert.equal(external.dns.status, 'ok');
  assert.equal(external.registration.status, 'ok');
  assert.equal(external.resolved.length, 3);
  assert.ok(external.resolved.includes('resolución DNS'));
  assert.ok(external.resolved.includes('titularidad RDAP/WHOIS'));
  assert.ok(external.resolved.includes('antigüedad del dominio'));
});

test('orquestador sobre .mx y .com.mx: DNS sí, registro no verificable por falta de RDAP', async () => {
  for (const host of ['banco.mx', 'tienda.com.mx']) {
    resetExternalState();
    const external = await runExternalAudit(host, {
      force: true,
      useCache: false,
      now: NOW,
      fetch: fakeDoh({ A: [PUBLIC_IP] }),
    });
    assert.equal(external.dns.status, 'ok', host);
    assert.equal(external.registration.check, 'whois', `${host} debe caer al adaptador WHOIS`);
    assert.equal(external.registration.status, 'deshabilitada', host);
    assert.deepEqual(external.resolved, ['resolución DNS'], host);
    const pending = external.indicators.filter((i) => i.classification === 'pendiente-externo');
    assert.equal(pending.length, 1, host);
    assert.match(pending[0].evidence, /no verificable/i);
  }
});

test('el límite de solicitudes protege al orquestador', async () => {
  resetExternalState();
  const deps = { force: true, useCache: false, now: NOW, fetch: fakeDoh({ A: [PUBLIC_IP] }) };
  let limited = false;
  for (let i = 0; i < 40; i += 1) {
    const external = await runExternalAudit('ejemplo.com', deps);
    if (external.dns.status === 'error' && /límite/i.test(external.dns.reason ?? '')) {
      limited = true;
      break;
    }
  }
  assert.equal(limited, true, 'debería cortar antes de 40 consultas por minuto');
  resetExternalState();
});

// ---------------------------------------------------------------------------
// Integración con el semáforo: la regla que no se puede romper
// ---------------------------------------------------------------------------

test('resolver en el DNS y tener años de antigüedad NO pone una URL en verde', async () => {
  resetExternalState();
  const audit = auditUrl('https://tienda-desconocida.com/');
  const external = await runExternalAudit('tienda-desconocida.com', {
    force: true,
    useCache: false,
    now: NOW,
    fetch: routed({ A: [PUBLIC_IP] }, rdapBody()),
  });

  const merged = applyExternalAudit(audit, external);
  const risk = combineRisk(merged, { risk: 'bajo' });

  assert.notEqual(risk.light, 'verde', 'ninguna combinación de DNS y RDAP justifica el verde');
  assert.equal(risk.light, 'gris');
  assert.equal(risk.riskLevel, 'no concluyente');
  assert.equal(risk.deterministic.locallyExhaustive, false);
  // Quedan comprobaciones sin hacer y se dicen.
  assert.ok(merged.coverage.pendingExternal.includes('certificado TLS'));
  assert.ok(merged.coverage.pendingExternal.includes('redirecciones y destino final'));
});

test('aunque se resolvieran todas las etiquetas pendientes, una URL sigue sin poder ser verde', () => {
  const audit = auditUrl('https://tienda-desconocida.com/');
  const forced = { ...audit, coverage: { ...audit.coverage, pendingExternal: [] } };
  const risk = combineRisk(forced, { risk: 'bajo' });
  assert.equal(risk.light, 'gris');
  assert.equal(risk.riskLevel, 'no concluyente');
});

test('la evidencia externa sospechosa eleva el riesgo de una URL sin señales locales', async () => {
  resetExternalState();
  const audit = auditUrl('https://oferta-imperdible.com/');
  assert.equal(
    audit.indicators.filter((i) => i.classification === 'determinista' && i.status === 'sospechoso')
      .length,
    0,
    'la URL no tiene señales locales',
  );

  const external = await runExternalAudit('oferta-imperdible.com', {
    force: true,
    useCache: false,
    now: NOW,
    fetch: routed(
      { A: [PUBLIC_IP] },
      rdapBody({ events: [{ eventAction: 'registration', eventDate: '2026-11-05T00:00:00Z' }] }),
    ),
  });

  const merged = applyExternalAudit(audit, external);
  const risk = combineRisk(merged, null);
  assert.equal(risk.riskLevel, 'alto');
  assert.equal(risk.light, 'rojo');
  assert.ok(risk.deterministic.topSignals.some((signal) => /creado hace muy poco/i.test(signal)));
});

test('fusionar evidencia externa no modifica la auditoría original', async () => {
  resetExternalState();
  const audit = auditUrl('https://ejemplo.com/');
  const pendingBefore = [...audit.coverage.pendingExternal];
  const indicatorsBefore = audit.indicators.length;

  const external = await runExternalAudit('ejemplo.com', {
    force: true,
    useCache: false,
    now: NOW,
    fetch: routed({ A: [PUBLIC_IP] }, rdapBody()),
  });
  const merged = applyExternalAudit(audit, external);

  assert.deepEqual(audit.coverage.pendingExternal, pendingBefore, 'no debe mutar la lista original');
  assert.equal(audit.indicators.length, indicatorsBefore);
  assert.ok(merged.indicators.length > indicatorsBefore);
  assert.ok(merged.coverage.pendingExternal.length < pendingBefore.length);

  // Otra auditoría recién creada no debe haber heredado la mutación.
  assert.deepEqual(auditUrl('https://otro.com/').coverage.pendingExternal, pendingBefore);
});

test('toda evidencia externa cita fuente y fecha verificable', async () => {
  resetExternalState();
  const external = await runExternalAudit('ejemplo.com', {
    force: true,
    useCache: false,
    now: NOW,
    fetch: routed({ A: [PUBLIC_IP] }, rdapBody()),
  });
  for (const item of external.indicators) {
    assert.ok(item.source && item.source.length > 0, `${item.id} sin fuente`);
    assert.ok(!Number.isNaN(Date.parse(item.checkedAt)), `${item.id} sin fecha válida`);
    assert.ok(item.limitation.length > 0, `${item.id} sin limitación declarada`);
    assert.ok(
      ['verificado-externo', 'pendiente-externo', 'error'].includes(item.classification),
      `${item.id} con clasificación inesperada: ${item.classification}`,
    );
  }
});
