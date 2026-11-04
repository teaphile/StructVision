const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text()));
  await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: /Frame/ }).first().click();
  await p.waitForTimeout(500);
  const out = [];
  for (const kind of ['Portal frame', 'Multi-storey frame', 'Warren truss', 'Pitched roof truss', 'Hoarding / wall panel']) {
    await p.getByRole('button', { name: kind, exact: true }).click();
    await p.waitForTimeout(200);
    await p.getByRole('button', { name: /Generate this structure/ }).click();
    await p.waitForTimeout(700);
    const stats = await p.locator('[data-testid="canvas-stats"]').textContent();
    const unstable = await p.locator('text=/unstable|mechanism/i').count();
    const det = (await p.locator('text=/Determinacy/i').first().textContent().catch(() => '')) || '';
    out.push({ kind, stats: stats.trim(), unstable, det });
    await p.screenshot({ path: `/home/user/shots/gen-${kind.split(' ')[0]}.png` });
  }
  console.log(JSON.stringify(out, null, 1));
  console.log('ERRORS:', errs.join('\n') || 'none');
  await b.close();
})();
