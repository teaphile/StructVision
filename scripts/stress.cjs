// Rapid input stress test: hammer every numeric input & slider on each module,
// then confirm the app still renders (no boundary, no console errors).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text()));
  await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });

  const nav = ['Beam', 'Frame', 'ILD', 'Section', 'Mohr', 'Column', 'Atlas', 'Guide'];
  const report = [];
  for (const n of nav) {
    await p.getByRole('button', { name: n }).first().click();
    await p.waitForTimeout(400);
    // move every range slider to both extremes
    const ranges = await p.locator('input[type=range]').all();
    for (const r of ranges) {
      const min = await r.getAttribute('min');
      const max = await r.getAttribute('max');
      if (min !== null) await r.fill(min).catch(() => {});
      if (max !== null) await r.fill(max).catch(() => {});
    }
    // type nonsense into number inputs
    const nums = await p.locator('input[type=number]').all();
    for (const inp of nums.slice(0, 8)) {
      await inp.fill('0').catch(() => {});
      await inp.fill('9999').catch(() => {});
      await inp.fill('-50').catch(() => {});
    }
    await p.waitForTimeout(500);
    const boundary = await p.locator('text=This screen hit an error').count();
    const rootHasContent = await p.evaluate(() => (document.getElementById('root')?.innerText || '').length > 200);
    report.push({ module: n, sliders: ranges.length, numbers: nums.length, boundary, rootHasContent });
  }
  console.log(JSON.stringify(report, null, 1));
  console.log('ERRORS:', errs.slice(0, 8).join('\n') || 'none');
  await b.close();
})();
