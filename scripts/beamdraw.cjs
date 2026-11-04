const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })).newPage();
  await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  const strip = p.locator('.blueprint').first();
  await strip.screenshot({ path: '/home/user/shots/beam-model-new.png' });
  await b.close();
})();
