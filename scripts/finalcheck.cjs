const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = [];
  p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  const title = await p.title();
  const h = await p.locator('header, nav').first().isVisible();
  console.log(JSON.stringify({ title, chromeVisible: h, errs }));
  await b.close();
})();
