const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text()));
  await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  const info = await p.evaluate(() => {
    const svgs = [...document.querySelectorAll('svg')].map((s) => {
      const r = s.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), vb: s.getAttribute('viewBox'), kids: s.children.length, top: Math.round(r.top) };
    });
    return { count: svgs.length, svgs: svgs.slice(0, 14), scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth };
  });
  console.log(JSON.stringify(info, null, 1));
  console.log('ERRORS:', errs.join('\n') || 'none');
  await p.screenshot({ path: '/home/user/shots/dbg-phone-top.png' });
  await p.evaluate(() => window.scrollTo(0, 520));
  await p.waitForTimeout(300);
  await p.screenshot({ path: '/home/user/shots/dbg-phone-mid.png' });
  await b.close();
})();
