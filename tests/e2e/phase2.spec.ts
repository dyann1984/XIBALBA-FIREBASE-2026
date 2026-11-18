import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const artifacts = path.resolve('artifacts/xibalba-3-phase2');
test.beforeAll(() => fs.mkdirSync(artifacts, { recursive: true }));

test('centro, mesa, evidencia, jaguar y móvil', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.command-strip')).toBeVisible();
  await page.screenshot({path:path.join(artifacts,'command-center.png'),fullPage:true});
  await page.getByRole('button',{name:/Nuevo análisis|New analysis/i}).click();
  await page.locator('#content').fill('Me llamaron del banco: paga de inmediato y deposita a esta cuenta. Visita https://example.com');
  await page.getByRole('button',{name:/Auditar solo en este dispositivo|Analizar contenido/i}).click();
  await expect(page.locator('.investigation')).toBeVisible();
  await expect(page.locator('.agent-status')).toHaveCount(5);
  await expect(page.locator('.timeline')).toBeVisible();
  await page.locator('.timeline summary').click();
  await page.screenshot({path:path.join(artifacts,'mesa-y-evidencias.png'),fullPage:true});
  await page.locator('[data-guardian-state]').screenshot({path:path.join(artifacts,'jaguar.png')});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(artifacts,'analisis-movil.png'),fullPage:true});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const [kind, message] of [
  ['sms','PAGA AHORA O TU CUENTA SERA BLOQUEADA'],
  ['whatsapp','DEPOSITA DINERO DE INMEDIATO'],
  ['correo','VERIFICA TU CUENTA EN example.com'],
]) {
  test(`imagen sintética ${kind}: informa resultado o lectura incompleta`, async ({page}) => {
    await page.goto('/');
    const bytes = await page.evaluate((text) => {
      const canvas = document.createElement('canvas'); canvas.width=1000; canvas.height=300;
      const ctx = canvas.getContext('2d')!; ctx.fillStyle='#fff'; ctx.fillRect(0,0,1000,300);
      ctx.fillStyle='#111'; ctx.font='bold 32px Arial'; ctx.fillText(text, 35, 130);
      return canvas.toDataURL('image/png').split(',')[1];
    }, message);
    await page.getByRole('button',{name:/Nuevo análisis|New analysis/i}).click();
    await page.locator('#photo').setInputFiles({name:`${kind}.png`,mimeType:'image/png',buffer:Buffer.from(bytes,'base64')});
    await page.getByRole('button',{name:/Auditar solo en este dispositivo|Analizar contenido/i}).click();
    await expect(page.locator('.ocr-evidence')).toBeVisible();
    await expect(page.locator('.investigation')).toContainText(/Texto reconocido|Lectura incompleta/);
    await page.screenshot({path:path.join(artifacts,`${kind}.png`),fullPage:true});
  });
}
