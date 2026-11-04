const { chromium } = require('playwright');
const fs = require('fs');

const MODULES = ['beam', 'structure', 'ild', 'section', 'mohr', 'buckling', 'guide'];
const SIZES = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1100 },
  { name: 'laptop', width: 1440, height: 900 },
];

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const outDir = '/home/user/shots';
  fs.mkdirSync(outDir, { recursive: true });
  const errors = [];

  for (const size of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`[${size.name}] console: ${m.text()}`);
    });
    page.on('pageerror', (e) => errors.push(`[${size.name}] pageerror: ${e.message}`));
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);

    for (const mod of MODULES) {
      // click module tab by accessible name
      const labels = {
        beam: 'Beam',
        structure: 'Frame',
        ild: 'ILD',
        section: 'Section',
        mohr: 'Mohr',
        buckling: 'Column',
        guide: 'Guide',
      };
      try {
        await page.getByRole('button', { name: new RegExp(`\\b${labels[mod]}\\b`) }).first().click({ timeout: 4000 });
      } catch (e) {
        errors.push(`[${size.name}] nav ${mod} failed: ${e.message.split('\n')[0]}`);
      }
      await page.waitForTimeout(1100);
      await page.screenshot({ path: `${outDir}/${size.name}-${mod}.png`, fullPage: mod === 'guide' || mod === 'beam' });
      // horizontal overflow check
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 3) errors.push(`[${size.name}] ${mod}: horizontal overflow ${overflow}px`);
    }
    await ctx.close();
  }

  fs.writeFileSync('/home/user/shots/report.json', JSON.stringify(errors, null, 2));
  console.log(errors.length ? errors.join('\n') : 'NO ERRORS');
  await browser.close();
})();
