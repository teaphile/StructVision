const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1200 } })).newPage();
  await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: /Atlas/ }).first().click();
  await p.waitForTimeout(800);
  for (const name of ['Deflection', 'buckling', 'Truss']) {
    await p.getByRole('button', { name: new RegExp(name, 'i') }).first().click();
    await p.waitForTimeout(400);
  }
  const text = await p.locator('main').innerText();
  console.log('undefined/NaN leaks:', (text.match(/undefined|NaN/g) || []).length);
  console.log(text.split('\n').filter(l => /Deflection aur|λ =|Peak axial/.test(l)).slice(0, 8).join('\n'));
  await b.close();
})();
