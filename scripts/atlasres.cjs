const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 820, height: 1180 }]]) {
    const p = await (await b.newContext({ viewport: vp, reducedMotion: 'reduce' })).newPage();
    const errs = [];
    p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: /Atlas/ }).first().click();
    await p.waitForTimeout(900);
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const cardW = await p.locator('button:has-text("Determinacy")').first().boundingBox();
    console.log(name, JSON.stringify({ overflowPx: overflow, cardFits: cardW ? cardW.width <= vp.width : null, errs: errs.length }));
    await p.screenshot({ path: `/home/user/shots/${name}-atlas.png`, fullPage: false });
  }
  await b.close();
})();
