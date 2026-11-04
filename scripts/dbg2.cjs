const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: 'UDL', exact: true }).click();
  await p.waitForTimeout(700);
  await p.getByRole('button', { name: /Frame/ }).first().click();
  await p.waitForTimeout(900);
  console.log('stats?', await p.locator('[data-testid="canvas-stats"]').count());
  console.log('body text head:', (await p.locator('body').textContent()).slice(0, 300));
  await p.screenshot({ path: '/home/user/shots/dbg2.png' });
  await b.close();
})();
