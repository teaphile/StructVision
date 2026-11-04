const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 1500 } })).newPage();
  const errs = [];
  p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: /ILD/ }).first().click();
  await p.waitForTimeout(300);
  const cb = p.locator('input[type=checkbox]').filter({ hasNot: p.locator('[disabled]') });
  // toggle Müller-Breslau via its label
  await p.getByText(/Müller-Breslau/i).first().click();
  await p.waitForTimeout(600);
  await p.screenshot({ path: '/home/user/shots/ild-muller.png', fullPage: false });
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'none');
  await b.close();
})();
