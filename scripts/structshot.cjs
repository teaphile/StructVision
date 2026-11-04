const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  const errs = [];
  p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: /Frame/ }).first().click();
  await p.waitForTimeout(900);
  const info = await p.evaluate(() => {
    const svg = document.querySelector('svg[viewBox^="0 0 1200"]');
    const r = svg.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), vb: svg.getAttribute('viewBox') };
  });
  console.log(JSON.stringify(info));
  await p.screenshot({ path: '/home/user/shots/structure-latest.png' });
  const shot = await p.locator('svg[viewBox^="0 0 1200"]').first().screenshot({ path: '/home/user/shots/structure-canvas.png' });
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'none');
  await b.close();
})();
