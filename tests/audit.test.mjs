import test from 'node:test';
import assert from 'node:assert/strict';
import { auditUrl, trafficLight } from '../lib/analysis/audit.ts';
import { parseAssessment, validateInput } from '../lib/analysis/guardian.ts';

test('traffic light does not interpret missing results as safety', () => {
 assert.deepEqual(['bajo','medio','alto',null,'desconocido'].map(trafficLight), ['verde','amarillo','rojo','gris','gris']);
});
test('public suffixes and reserved test domain are not prefixes', () => {
 const evidence = url => auditUrl(url).indicators[0].evidence;
 assert.match(evidence('https://example.test/oferta'), /terminación: \.test \(reservada para pruebas\)/);
 assert.match(evidence('https://shop.example.co.uk'), /dominio registrable: example\.co\.uk; terminación: \.co\.uk/);
 assert.match(evidence('https://x.github.io'), /dominio registrable: x\.github\.io; terminación: \.github\.io/);
});
test('punycode and URLs impersonating brands are flagged, never visited', () => {
 assert.ok(auditUrl('https://xn--pple-43d.example').indicators.some(x => x.indicator === 'Nombre internacionalizado' && x.status === 'sospechoso'));
 assert.ok(auditUrl('https://paypal.example.com').indicators.some(x => x.indicator === 'Posible marca en el host'));
 assert.ok(auditUrl('http://127.0.0.1/').indicators.some(x => x.status === 'no verificado'));
 for (const url of ['file:///etc/passwd','https://name:pass@example.com']) assert.throws(() => validateInput('url', url));
});
test('incomplete AI responses fail closed', () => {
 for (const response of ['{}', '{"risk":"bajo","summary":"","evidence":[],"recommendations":[]}', '{"risk":"alto","summary":"x","evidence":[],"recommendations":["y"]}']) assert.throws(() => parseAssessment(response));
});
