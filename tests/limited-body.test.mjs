import test from 'node:test';
import assert from 'node:assert/strict';
import { readLimitedBody } from '../lib/security/limited-body.ts';

test('admite un cuerpo UTF-8 dentro del límite de bytes', async () => {
  const req = new Request('http://localhost', { method: 'POST', body: 'á' });
  assert.equal(await readLimitedBody(req, 2), 'á');
});
test('rechaza por bytes aunque la longitud en caracteres sea menor', async () => {
  const req = new Request('http://localhost', { method: 'POST', body: 'áá' });
  assert.equal(await readLimitedBody(req, 3), null);
});
test('rechaza longitud declarada excesiva o inválida', async () => {
  for (const length of ['1025', 'invalid']) {
    const req = new Request('http://localhost', { method: 'POST', headers: { 'content-length': length }, body: 'x' });
    assert.equal(await readLimitedBody(req, 1024), null);
  }
});
test('rechaza un flujo que supera el límite sin longitud declarada', async () => {
  let cancelled = false;
  const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(4)); c.enqueue(new Uint8Array(4)); }, cancel() { cancelled = true; } });
  const req = new Request('http://localhost', { method: 'POST', body: stream, duplex: 'half' });
  assert.equal(await readLimitedBody(req, 6), null);
  assert.equal(cancelled, true);
});
