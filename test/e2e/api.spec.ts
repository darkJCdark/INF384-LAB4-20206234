import { test, expect } from '@playwright/test';

test('el navegador muestra el saldo de un usuario semilla', async ({ page }) => {
  await page.goto('/saldo/carla');
  const cuerpo = JSON.parse(await page.locator('body').innerText());
  expect(cuerpo.usuario).toBe('carla');
  expect(typeof cuerpo.saldo).toBe('number');
});

test('una transferencia pasa por la URL publica', async ({ page }) => {
  const r = await page.request.post('/transferir', {
    data: { origen: 'elena', destino: 'ana', monto: 0.01 },
  });
  expect(r.status()).toBe(200);
  const cuerpo = await r.json();
  expect(cuerpo).toMatchObject({ origen: 'elena', destino: 'ana', monto: 0.01 });
  expect(typeof cuerpo.id).toBe('number');
});
