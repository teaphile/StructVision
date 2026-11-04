const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })).newPage();
  await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  const card = p.locator('div').filter({ hasText: /Virtual section knife/ }).first();
  await card.scrollIntoViewIfNeeded();
  const el = p.locator('svg').filter({ has: p.locator('text', { hasText: 'Isolated left segment' }) }).first();
  await el.screenshot({ path: '/home/user/shots/knife-fbd.png' });
  await b.close();
})();
