const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1400 } })).newPage();
  await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: /Atlas/ }).first().click();
  await p.waitForTimeout(800);
  await p.getByRole('button', { name: /Deflection aur serviceability/ }).first().click();
  await p.waitForTimeout(500);
  const t1 = await p.locator('main').innerText();
  const defl = t1.split('\n').filter(l => /δ = |Double|EI = /.test(l)).join(' | ');
  console.log('DEFLECTION:', defl.slice(0, 500));
  await p.getByRole('button', { name: /Stability: column/ }).first().click();
  await p.waitForTimeout(500);
  const t2 = await p.locator('main').innerText();
  const buck = t2.split('\n').filter(l => /λ = |Pcr|Fix-fix/.test(l)).join(' | ');
  console.log('BUCKLING:', buck.slice(0, 400));
  await b.close();
})();
