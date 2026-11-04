const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 820, height: 1100 } })).newPage();
  await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: /Mohr/ }).first().click();
  await p.waitForTimeout(500);
  await p.getByRole('button', { name: /Snap to σ₁/ }).click();
  await p.waitForTimeout(700);
  await p.screenshot({ path: '/home/user/shots/mohr-snapped.png' });
  await b.close();
})();
