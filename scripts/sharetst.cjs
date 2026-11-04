const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  // change the beam so the URL must encode state
  await p.getByRole('button', { name: /Share/ }).first().click();
  await p.waitForTimeout(500);
  const url = await p.evaluate(() => navigator.clipboard.readText().catch(() => 'clipboard-blocked'));
  console.log('URL:', url.slice(0, 160), '…len', url.length);
  const hash = url.includes('#') ? url.split('#')[1] : '';
  console.log('hashLen', hash.length, 'prefix', hash.slice(0, 40));
  const p2 = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errs = [];
  p2.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p2.goto(url, { waitUntil: 'networkidle' });
  await p2.waitForTimeout(1200);
  const stats = await p2.locator('[data-testid=canvas-stats]').first().textContent().catch(() => 'n/a');
  console.log('restored canvas:', stats);
  console.log('ERRORS:', errs.length ? errs.join(' | ') : 'none');
  await b.close();
})();
