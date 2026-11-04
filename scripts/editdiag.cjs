const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = [];
  p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: /Frame/ }).first().click();
  await p.waitForTimeout(800);
  const stats = () => p.locator('[data-testid=canvas-stats]').textContent();
  const svg = p.locator('svg[viewBox^="0 0 1200"]').first();

  // --- add two joints with the Joint tool
  await p.getByRole('button', { name: 'Joint', exact: true }).click();
  let box = await svg.boundingBox();
  await p.mouse.click(box.x + box.width * 0.42, box.y + box.height * 0.5);
  await p.waitForTimeout(350);
  box = await svg.boundingBox();
  await p.mouse.click(box.x + box.width * 0.62, box.y + box.height * 0.28);
  await p.waitForTimeout(400);
  console.log('after 2 joint taps:', (await stats()).trim());
  const nodeInfo = await p.locator('[data-node-id]').evaluateAll((els) =>
    els.map((e) => ({ id: e.getAttribute('data-node-id'), cx: e.querySelector('rect,circle')?.getAttribute('x') || e.querySelector('circle')?.getAttribute('cx') }))
  );
  console.log('joint widgets:', nodeInfo.length);

  // --- connect them with the Member tool
  await p.getByRole('button', { name: 'Member', exact: true }).click();
  const nodes = p.locator('[data-node-id]');
  const n1 = await nodes.nth(4).boundingBox();
  const n2 = await nodes.nth(5).boundingBox();
  await p.mouse.click(n1.x + n1.width / 2, n1.y + n1.height / 2);
  await p.waitForTimeout(250);
  await p.mouse.click(n2.x + n2.width / 2, n2.y + n2.height / 2);
  await p.waitForTimeout(500);
  console.log('after member:', (await stats()).trim());

  // --- select one, drag it, then check it actually moved
  await p.getByRole('button', { name: 'Select', exact: true }).click();
  const target = p.locator('[data-node-id]').nth(5);
  const before = await target.boundingBox();
  await p.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await p.mouse.down();
  await p.mouse.move(before.x + before.width / 2 + 22, before.y + before.height / 2 + 14, { steps: 8 });
  await p.mouse.up();
  await p.waitForTimeout(400);
  const after = await p.locator('[data-node-id]').nth(5).boundingBox();
  const moved = Math.abs(after.x - before.x) + Math.abs(after.y - before.y);
  console.log('drag delta px:', Math.round(moved));

  // --- erase the added member
  await p.getByRole('button', { name: 'Erase', exact: true }).click();
  const hits = p.locator('[data-member-hit]');
  console.log('member hit targets:', await hits.count());
  console.log('ERR', errs);
  await b.close();
})();
