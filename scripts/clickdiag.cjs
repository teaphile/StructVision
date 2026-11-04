const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const logs = [];
  p.on('console', (m) => logs.push(m.text()));
  await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: /Frame/ }).first().click();
  await p.waitForTimeout(700);
  await p.getByRole('button', { name: 'Joint', exact: true }).click();
  const svg = p.locator('svg[viewBox^="0 0 1200"]').first();
  const box = await svg.boundingBox();
  await p.mouse.click(box.x + box.width * 0.42, box.y + box.height * 0.5);
  await p.waitForTimeout(400);
  console.log(logs.join('\n'));
  console.log('stats:', (await p.locator('[data-testid=canvas-stats]').textContent()).trim());
  await b.close();
})();
