import test from 'node:test';
import assert from 'node:assert/strict';

import {
  describeImageRejection,
  MAX_RAW_IMAGE_BYTES,
  resolveImageMimeType,
} from '../lib/analysis/images.ts';
import { auditPhones, extractPhoneNumbers, maskPhone } from '../lib/analysis/phone.ts';
import { correlateIncidents, detectCampaigns } from '../lib/analysis/correlation.ts';
import { buildReportData, formatReportMarkdown } from '../lib/analysis/report.ts';
import { auditCoordinated } from '../lib/analysis/coordinator.ts';
import { combineRisk } from '../lib/analysis/risk.ts';
import { localizeIndicator } from '../lib/i18n/evidence.ts';

test('resolveImageMimeType resuelve JPEG, PNG, WebP y extensiones móviles sin MIME', () => {
  assert.equal(resolveImageMimeType({ name: 'foto.jpg', type: 'image/jpeg' }), 'image/jpeg');
  assert.equal(resolveImageMimeType({ name: 'captura.webp', type: 'image/webp' }), 'image/webp');
  assert.equal(resolveImageMimeType({ name: 'movil.PNG', type: '' }), 'image/png');
  assert.equal(resolveImageMimeType({ name: 'captura.webp', type: 'application/octet-stream' }), 'image/webp');
});

test('describeImageRejection admite WebP hasta 20 MB en bruto y traduce mensajes a EN/ES', () => {
  assert.equal(
    describeImageRejection({ name: 'ok.webp', type: 'image/webp', size: 6 * 1024 * 1024 }, 'es'),
    null,
  );
  const esErr = describeImageRejection({ name: 'doc.pdf', type: 'application/pdf', size: 100 }, 'es');
  const enErr = describeImageRejection({ name: 'doc.pdf', type: 'application/pdf', size: 100 }, 'en');
  assert.match(esErr ?? '', /no es JPEG, PNG ni WebP/i);
  assert.match(enErr ?? '', /is not JPEG, PNG, or WebP/i);

  const huge = describeImageRejection(
    { name: 'gigante.jpg', type: 'image/jpeg', size: MAX_RAW_IMAGE_BYTES + 1 },
    'en',
  );
  assert.match(huge ?? '', /exceeds/i);
});

test('extractPhoneNumbers ignora CLABEs de 18 dígitos y tarjetas de 16 dígitos', () => {
  const text = 'CLABE 002180000000000004 y tarjeta 4111 1111 1111 1111';
  assert.equal(extractPhoneNumbers(text).length, 0);
});

test('auditPhones detecta señales sospechosas y enmascara números', () => {
  const text =
    'BBVA informa bloqueo de cuenta. Llama de inmediato al +52 55 1234 5678 o al 9001234567.';
  const res = auditPhones(text);
  assert.equal(res.matches.length, 2);
  assert.ok(res.indicators.some((i) => i.id === 'tel-tarificacion-especial'));
  assert.ok(res.indicators.some((i) => i.id === 'tel-multiples'));
  assert.ok(res.indicators.some((i) => i.id === 'tel-contacto-en-suplantacion'));
  for (const ind of res.indicators) {
    assert.equal(ind.evidence.includes('1234 5678'), false);
    assert.equal(ind.evidence.includes('9001234567'), false);
  }
  assert.match(maskPhone('+52 55 1234 5678'), /\+52 •••• ••78/);
});

test('los indicadores de teléfono se traducen al inglés sin fallback', () => {
  const text = 'BBVA aviso urgente: llama al +52 55 1234 5678 o al +34 612 345 678 en https://example.com';
  const { indicators } = auditPhones(text);
  for (const ind of indicators) {
    const loc = localizeIndicator(ind, 'en');
    assert.equal(loc.fallback, false, `Falta traducción EN para: ${ind.indicator} / ${ind.evidence}`);
  }
});

test('correlateIncidents y detectCampaigns identifican incidentes y campañas relacionadas', () => {
  const campaigns = detectCampaigns(['suplantacion-institucion', 'solicitud-codigo-otp']);
  assert.equal(campaigns.length, 1);
  assert.equal(campaigns[0].id, 'camp-suplantacion-bancaria');

  const history = [
    {
      id: 'h1',
      at: '2026-11-18T10:00:00.000Z',
      kind: 'message',
      light: 'rojo',
      riskLevel: 'alto',
      confidence: 'alta',
      agents: ['ixbalanque', 'hun'],
      signals: 2,
      topSignals: ['Suplantación'],
      checksRun: 10,
      checksTotal: 15,
      preview: 'Mensaje previo',
      source: null,
      hadAttachments: false,
      domains: ['login-falso.example.com'],
      phonePrefixes: ['+52-55'],
      signalIds: ['suplantacion-institucion'],
    },
  ];
  const corr = correlateIncidents(
    {
      domains: ['login-falso.example.com'],
      phonePrefixes: ['+52-55'],
      signalIds: ['solicitud-codigo-otp'],
    },
    history,
  );
  assert.equal(corr.relatedEntries.length, 1);
  assert.ok(corr.campaigns.some((c) => c.id === 'camp-suplantacion-bancaria'));
});

test('buildReportData y formatReportMarkdown generan reportes enmascarados en ES y EN', () => {
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
  const reportEn = buildReportData(result, corr, 'en');
  const mdEn = formatReportMarkdown(reportEn);
  assert.match(mdEn, /XIBALBÁ 2\.0 — Fraud Investigation Report/);
  assert.equal(mdEn.includes('9876 5432'), false);
});
