const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text()));
  await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);

  // 1) Beam: add a UDL then move the knife, check reactions update
  const before = await p.locator('text=/Σ Ry reactions/').first().isVisible();
  await p.getByRole('button', { name: 'UDL', exact: true }).click();
  await p.waitForTimeout(700);
  const udlRow = await p.locator('text=/LOAD|UDL/').count();

  // 2) Canvas editor: add node, then a member
  await p.getByRole('button', { name: /Frame/ }).first().click();
  await p.waitForTimeout(600);
  const nodesBefore = await p.locator('[data-testid="canvas-stats"]').textContent();
  await p.getByRole('button', { name: /^Joint$/ }).click();
  const canvas = p.locator('svg').filter({ hasNot: p.locator('text=StructVision') }).first();
  // click inside the canvas editor svg (the one with the grid)
  const svgBox = await p.locator('div.blueprint svg').first().boundingBox();
  await p.mouse.click(svgBox.x + svgBox.width * 0.8, svgBox.y + svgBox.height * 0.25);
  await p.waitForTimeout(500);
  const nodesAfter = await p.locator('[data-testid="canvas-stats"]').textContent();

  // 3) Add member between two existing joints: choose node A then B
  await p.getByRole('button', { name: /^Member$/ }).click();
  await p.waitForTimeout(200);
  const membersBefore = nodesAfter;
  const nodeGs = p.locator('[data-node-id]');
  // aim at the joint disc itself - a joint's <g> also contains its support glyph, so the
  // group's bounding-box centre can sit well below the node.
  // joints 1 and 2 (B and C on the default portal) are NOT already joined, unlike A-C.
  const n1 = await p.locator('[data-hit]').nth(1).boundingBox();
  const n3 = await p.locator('[data-hit]').nth(2).boundingBox();
  await p.mouse.click(n1.x + n1.width / 2, n1.y + n1.height / 2);
  await p.waitForTimeout(250);
  await p.mouse.click(n3.x + n3.width / 2, n3.y + n3.height / 2);
  await p.waitForTimeout(600);
  const membersAfter = await p.locator('[data-testid="canvas-stats"]').textContent();

  // 4) Section lab: switch catalogue, check precision table renders
  await p.getByRole('button', { name: /Section/ }).first().click();
  await p.waitForTimeout(500);
  await p.locator('select').first().selectOption({ index: 2 });
  await p.waitForTimeout(600);
  const precision = await p.locator('text=/Precision check/').first().isVisible();
  const errPct = await p.locator('text=/%$/').count();

  // 5) Mohr: click a preset and a snap button
  await p.getByRole('button', { name: /Mohr/ }).first().click();
  await p.waitForTimeout(400);
  await p.getByRole('button', { name: /Pure shear/ }).click();
  await p.waitForTimeout(400);
  await p.getByRole('button', { name: /Snap to σ₁/ }).click();
  await p.waitForTimeout(400);

  // 6) Guide: lecture next button
  await p.getByRole('button', { name: /Guide/ }).first().click();
  await p.waitForTimeout(400);
  await p.getByRole('button', { name: /30-min lecture script/ }).click();
  await p.waitForTimeout(300);
  await p.getByRole('button', { name: /Next ▶/ }).click();
  await p.waitForTimeout(300);

  console.log(JSON.stringify({ before, udlRow, nodesBefore, nodesAfter, membersBefore, membersAfter, precision, errPct }, null, 1));
  console.log('ERRORS:', errs.join('\n') || 'none');
  await p.screenshot({ path: '/home/user/shots/interact-end.png' });
  await b.close();
})();
