import test from 'node:test';
import assert from 'node:assert/strict';
import { auditCoordinated } from '../lib/analysis/coordinator.ts';

test('eventos reflejan ejecución secuencial y duración real sin reproducir entrada', () => {
  const events = [];
  const result = auditCoordinated({kind:'message',text:'Deposita dinero de inmediato en https://example.com para evitar el bloqueo',onEvent: event => events.push(event)});
  assert.equal(events[0].agent, 'guardian');
  assert.equal(events[0].phase, 'started');
  assert.equal(events.at(-1).agent, 'guardian');
  assert.equal(events.at(-1).phase, 'completed');
  for (const event of events.filter(e => e.phase === 'completed')) assert.ok(Number.isFinite(event.elapsedMs) && event.elapsedMs >= 0);
  assert.ok(events.some(e => e.agent === 'vucub' && e.phase === 'completed'));
  assert.ok(events.some(e => e.agent === 'hun' && e.phase === 'completed'));
  assert.ok(result.executed.includes('vucub'));
  assert.doesNotMatch(JSON.stringify(events), /example\.com|Deposita/);
});

test('cada agente seleccionado queda "en cola" antes de iniciar su propio catálogo', () => {
  const events = [];
  auditCoordinated({kind:'message',text:'Deposita dinero de inmediato en https://example.com para evitar el bloqueo',onEvent: event => events.push(event)});
  const queued = events.filter(e => e.phase === 'queued').map(e => e.agent);
  assert.ok(queued.length > 0, 'debe encolar al menos a un agente además de EL GUARDIÁN');
  assert.ok(!queued.includes('guardian'), 'EL GUARDIÁN ya se anuncia con su propio started, no se encola');
  for (const agent of queued) {
    const queuedIndex = events.findIndex(e => e.agent === agent && e.phase === 'queued');
    const startedIndex = events.findIndex(e => e.agent === agent && e.phase === 'started');
    assert.ok(startedIndex > queuedIndex, `${agent} debe iniciar después de quedar en cola`);
  }
});

test('un observador de eventos defectuoso no altera el resultado', () => {
  const input = {kind:'message', text:'Paga de inmediato o tu cuenta será bloqueada.'};
  const a = auditCoordinated(input);
  const b = auditCoordinated({...input, onEvent: () => { throw new Error('observador'); }});
  assert.deepEqual(a.attributed.map(item => item.id), b.attributed.map(item => item.id));
});
