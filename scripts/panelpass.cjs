// Visual pass over the three panels still owed a screenshot: Section, Buckling, Structure.
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));

  await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });

  const nav = async (re, name) => {
    await p.getByRole('button', { name: re }).first().click();
    await p.waitForTimeout(700);
    await p.screenshot({ path: `/home/user/shots/panel-${name}.png` });
  };

  await nav(/Section/i, 'section');
  // capture just the drawing area of the section lab
  const secSvg = await p.locator('svg[viewBox^="0 0 2"]').first().count();
  console.log('section hero svgs:', secSvg);

  await nav(/Column|Buckling/i, 'buckling');
  await nav(/Frame|Structure/i, 'structure');
  await nav(/Atlas/i, 'atlas');

  // overflow probe on each panel: any element wider than its parent's content box
  const wide = await p.evaluate(() => {
    const bad = [];
    document.querySelectorAll('main *, .scroll-x').forEach((el) => {
      if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX === 'visible') {
        const r = el.getBoundingClientRect();
        if (r.width < window.innerWidth) bad.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 40), over: el.scrollWidth - el.clientWidth });
      }
    });
    return bad.slice(0, 8);
  });
  console.log('overflowing:', JSON.stringify(wide));
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'none');
  await b.close();
})();
