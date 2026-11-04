const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
  await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: /Atlas/ }).first().click();
  await p.waitForTimeout(800);
  await p.getByRole('button', { name: /reciprocity/i }).first().click();
  await p.waitForTimeout(700);
  const t = await p.getByText(/µm/).allTextContents();
  console.log(JSON.stringify(t.slice(0, 8)));
  const box = await p.getByRole('button', { name: /reciprocity/i }).first().boundingBox();
  await p.screenshot({ path: '/home/user/shots/atlas-reciprocity.png', clip: { x: box.x - 8, y: box.y - 8, width: 1420, height: 430 } });
  await b.close();
})();
