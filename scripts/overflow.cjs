const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: /Guide/ }).first().click();
  await p.waitForTimeout(900);
  const res = await p.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const bad = [];
    document.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 2 && r.width > 20) {
        bad.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 70), right: Math.round(r.right), w: Math.round(r.width), text: (el.textContent || '').slice(0, 40) });
      }
    });
    return { vw, bad: bad.slice(0, 14) };
  });
  console.log(JSON.stringify(res, null, 1));
  await b.close();
})();
