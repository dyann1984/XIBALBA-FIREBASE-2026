import test from 'node:test';
import assert from 'node:assert/strict';

import { auditCoordinated } from '../lib/analysis/coordinator.ts';
import { combineRisk } from '../lib/analysis/risk.ts';
import { correlateIncidents } from '../lib/analysis/correlation.ts';
import { buildReportData } from '../lib/analysis/report.ts';
import { buildReportPdf } from '../lib/analysis/pdf.ts';

function toAsciiString(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

test('buildReportPdf genera un PDF valido que enmascara datos sensibles', async () => {
  const coordinated = auditCoordinated({
    kind: 'message',
    text: 'BBVA bloqueo: entra a https://example.com y llama al +52 55 9876 5432',
  });
  const risk = combineRisk(coordinated.audit, null);
  const result = {
    audit: coordinated.audit,
    risk,
    assessment: null,
    source: null,
    aiError: null,
    selection: coordinated.selection,
    attributed: coordinated.attributed,
    contributing: coordinated.contributing,
  };
  const corr = correlateIncidents({}, []);
  const report = buildReportData(result, corr, 'es');

  const bytes = await buildReportPdf(report);
  assert.ok(bytes instanceof Uint8Array);
  assert.ok(bytes.length > 500, 'el PDF generado no debe estar vacio');

  assert.match(toAsciiString(bytes), /^%PDF-1\./);
  assert.match(toAsciiString(bytes), /%%EOF\s*$/);

  const full = toAsciiString(bytes);
  assert.equal(full.includes('9876 5432'), false, 'el numero de telefono completo no debe aparecer en el PDF');
});

test('buildReportPdf produce contenido en ingles cuando el reporte esta en ingles', async () => {
  const coordinated = auditCoordinated({ kind: 'message', text: 'Hola, como estas? Nos vemos manana.' });
  const risk = combineRisk(coordinated.audit, null);
  const result = {
    audit: coordinated.audit,
    risk,
    assessment: null,
    source: null,
    aiError: null,
    selection: coordinated.selection,
    attributed: coordinated.attributed,
    contributing: coordinated.contributing,
  };
  const corr = correlateIncidents({}, []);
  const report = buildReportData(result, corr, 'en');
  const bytes = await buildReportPdf(report);
  assert.ok(bytes.length > 500);
});
