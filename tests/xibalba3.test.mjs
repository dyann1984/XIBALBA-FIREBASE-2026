import test from 'node:test';
import assert from 'node:assert/strict';
import { auditCoordinated } from '../lib/analysis/coordinator.ts';
import { recognizeImageText } from '../lib/analysis/images.ts';

test('la mesa registra módulos realmente ejecutados y atribuye señales', () => {
  const result = auditCoordinated({kind:'message', text:'Paga de inmediato o tu cuenta será bloqueada. Deposita dinero a esta cuenta.'});
  assert.ok(result.executed.includes('ixbalanque'));
  assert.ok(result.executed.includes('vucub'));
  assert.ok(result.executed.includes('guardian'));
  assert.ok(result.attributed.some(item => item.agents.some(agent => result.executed.includes(agent))));
});

test('una imagen sin OCR mantiene una comprobación pendiente', () => {
  const result = auditCoordinated({kind:'message', text:'', images:[{name:'captura.png',mimeType:'image/png',size:123}]});
  assert.ok(result.executed.includes('vucub'));
  assert.ok(result.selection.agents.includes('vucub'));
  assert.ok(result.audit.coverage.pendingExternal.includes('reconocimiento de texto en la imagen'));
});

test('OCR sin API nativa informa que no está disponible', async () => {
  assert.equal((await recognizeImageText([])).status, 'unavailable');
});

test('el texto reconocido por OCR en una imagen activa la detección de frases sospechosas', () => {
  // Simula lo que Dashboard.tsx envía al coordinador: el texto escrito por la
  // persona más el fragmento OCR, con el mismo prefijo explícito que usa la
  // interfaz para marcarlo como reconocimiento automático, no como cita.
  const ocrExcerpt = 'BBVA: detectamos actividad sospechosa en tu cuenta. Envianos el codigo de verificacion ahora.';
  const text = `[Texto reconocido automáticamente en la imagen; puede contener errores]\n${ocrExcerpt}`;
  const result = auditCoordinated({
    kind: 'message',
    text,
    images: [{ name: 'captura.png', mimeType: 'image/png', size: 123 }],
  });
  const ids = result.attributed.map((item) => item.id);
  assert.ok(ids.includes('amenaza-cuenta'), 'debe detectar la amenaza de bloqueo leída por OCR');
  assert.ok(ids.includes('solicitud-credenciales'), 'debe detectar la solicitud de código leída por OCR');
  assert.ok(result.executed.includes('vucub'), 'VUCUB CAMÉ debe ejecutar los metadatos de la imagen');
});
