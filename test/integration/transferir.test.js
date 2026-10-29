const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { handler } = require('../../src/handler');

let contador = 0;

beforeEach(() => {
  contador += 1;
  process.env.DB_PATH = path.join(os.tmpdir(), `wallet-${process.pid}-${Date.now()}-${contador}.db`);
});

async function llamar(metodo, ruta, cuerpo) {
  const r = await handler({
    rawPath: ruta,
    requestContext: { http: { method: metodo } },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  return { status: r.statusCode, cuerpo: JSON.parse(r.body) };
}

test('ana transfiere 100 a beto y los saldos reflejan el movimiento', async () => {
  const r = await llamar('POST', '/transferir', { origen: 'ana', destino: 'beto', monto: 100 });
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.saldoOrigen, 900);
  assert.deepEqual((await llamar('GET', '/saldo/ana')).cuerpo, { usuario: 'ana', saldo: 900 });
  assert.deepEqual((await llamar('GET', '/saldo/beto')).cuerpo, { usuario: 'beto', saldo: 600 });
});

test('el historial de ana registra la transferencia', async () => {
  await llamar('POST', '/transferir', { origen: 'ana', destino: 'beto', monto: 100 });
  const r = await llamar('GET', '/historial/ana');
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.length, 1);
  assert.equal(r.cuerpo[0].destino, 'beto');
  assert.equal(r.cuerpo[0].monto, 100);
});

test('ana no puede transferir mas que su saldo y no cambian los saldos', async () => {
  const r = await llamar('POST', '/transferir', { origen: 'ana', destino: 'carla', monto: 1050 });
  assert.equal(r.status, 400);
  assert.equal(r.cuerpo.error, 'saldo insuficiente');
  assert.equal((await llamar('GET', '/saldo/ana')).cuerpo.saldo, 1000);
  assert.equal((await llamar('GET', '/saldo/carla')).cuerpo.saldo, 750);
});

test('diego transfiere todo su saldo a elena y despues no puede transferir', async () => {
  const r = await llamar('POST', '/transferir', { origen: 'diego', destino: 'elena', monto: 300 });
  assert.equal(r.status, 200);
  assert.equal((await llamar('GET', '/saldo/elena')).cuerpo.saldo, 1500);
  const sinSaldo = await llamar('POST', '/transferir', { origen: 'diego', destino: 'ana', monto: 0.01 });
  assert.equal(sinSaldo.status, 400);
});

test('el historial de elena muestra solo la transferencia de diego', async () => {
  await llamar('POST', '/transferir', { origen: 'diego', destino: 'elena', monto: 300 });
  const r = await llamar('GET', '/historial/elena');
  assert.equal(r.cuerpo.length, 1);
  assert.equal(r.cuerpo[0].origen, 'diego');
});

test('transferir al mismo usuario es 422', async () => {
  const r = await llamar('POST', '/transferir', { origen: 'beto', destino: 'beto', monto: 1 });
  assert.equal(r.status, 422);
});

test('transferir a un usuario inexistente es 400', async () => {
  const r = await llamar('POST', '/transferir', { origen: 'beto', destino: 'zoe', monto: 1 });
  assert.equal(r.status, 400);
});

test('un cuerpo que no es JSON es 400', async () => {
  const r = await handler({
    rawPath: '/transferir',
    requestContext: { http: { method: 'POST' } },
    body: 'monto=1',
  });
  assert.equal(r.statusCode, 400);
});
