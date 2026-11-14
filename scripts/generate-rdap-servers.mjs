// Genera lib/external/rdap-servers.generated.ts a partir del bootstrap oficial
// vendorizado en data/rdap-bootstrap.json.
//
// Se genera en lugar de importar el JSON en tiempo de ejecución: así no hay
// lectura de disco en el servidor, no dependemos de atributos de importación
// (`with { type: 'json' }`) ni de resolveJsonModule, y el mapa queda
// verificable en el control de versiones.
//
// Uso: node scripts/generate-rdap-servers.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'data', 'rdap-bootstrap.json');
const target = join(root, 'lib', 'external', 'rdap-servers.generated.ts');

const file = JSON.parse(readFileSync(source, 'utf8'));
if (!Array.isArray(file.services)) throw new Error('El bootstrap no tiene «services».');

const entries = new Map();
let httpOnly = 0;

for (const [tlds, urls] of file.services) {
  const https = urls.find((url) => String(url).toLowerCase().startsWith('https://'));
  if (!https) {
    httpOnly += tlds.length;
    continue;
  }
  const base = https.endsWith('/') ? https : `${https}/`;
  for (const tld of tlds) {
    const key = String(tld).toLowerCase();
    if (!/^[a-z0-9-]+$/.test(key)) continue; // solo etiquetas LDH
    if (!entries.has(key)) entries.set(key, base);
  }
}

const sorted = [...entries.entries()].sort(([a], [b]) => a.localeCompare(b));
const lines = sorted.map(([tld, url]) => `  ['${tld}', '${url}'],`).join('\n');

const output = `// ARCHIVO GENERADO. No editar a mano.
// Origen: data/rdap-bootstrap.json (bootstrap oficial de IANA).
// Regenerar con: node scripts/generate-rdap-servers.mjs
//
// Publicación del bootstrap: ${file.publication}
// TLD con servidor RDAP por HTTPS: ${sorted.length}
// TLD descartados por publicar solo http://: ${httpOnly}
//
// Nota verificada: «mx» NO aparece en el bootstrap de IANA, por lo que los
// dominios mexicanos no admiten consulta RDAP. Véase docs/plan-dns-rdap.md.

export const RDAP_BOOTSTRAP_PUBLICATION = '${file.publication}';

export const RDAP_SERVERS: ReadonlyMap<string, string> = new Map([
${lines}
]);
`;

writeFileSync(target, output, 'utf8');
console.log(`Generado ${target}`);
console.log(`  TLD con RDAP HTTPS: ${sorted.length}`);
console.log(`  TLD solo http://  : ${httpOnly}`);
console.log(`  mx presente       : ${entries.has('mx')}`);
for (const tld of ['com', 'net', 'org', 'mx', 'cl', 'co', 'es', 'us', 'io']) {
  console.log(`  ${tld.padEnd(4)} -> ${entries.get(tld) ?? '(sin RDAP)'}`);
}
