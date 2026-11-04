const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  const errs = [];
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: /Atlas/ }).first().click();
  await p.waitForTimeout(900);
  const cards = await p.locator('button:has-text("Ds")').count();
  const live = await p.getByText(/live now/i).count();
  await p.screenshot({ path: '/home/user/shots/atlas.png' });
  // search
  await p.getByPlaceholder(/Type the exam topic/).fill('mohr');
  await p.waitForTimeout(400);
  const afterSearch = await p.getByText(/topics · every value/).textContent();
  await p.screenshot({ path: '/home/user/shots/atlas-search.png' });
  console.log(JSON.stringify({ errs, afterSearch }, null, 1));
  await b.close();
})();
