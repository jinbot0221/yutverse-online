const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const { createGame } = await import('../packages/engine/src/index.ts');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 667, height: 375 }]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      const state = createGame(2);
      state.phase = 'move'; state.throws = 0; state.result = { name: '도', steps: 1, extra: false };
      state.players[0].slots = [{ id: 'boost', remaining: 0 }, { id: 'boost', remaining: 1 }, { id: 'boost', remaining: 1 }];
      await page.addInitScript(s => { localStorage.setItem('yutverse.offline', 'true'); localStorage.setItem('yutverse.game', JSON.stringify(s)); }, state);
      await page.goto(process.env.YUTVERSE_URL || 'http://localhost:5173');
      await page.getByRole('button', { name: '싱글플레이', exact: true }).click();
      await page.getByRole('button', { name: /나의 증강/ }).click();
      const cards = page.locator('.inventory .card');
      assert.equal(await cards.count(), 3);
      await cards.nth(2).getByRole('button', { name: '사용하기', exact: true }).click();
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('yutverse.game')).players[0].slots[2].remaining === 0);
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('yutverse.game')).players[0].slots.map(s => s.remaining)), [0, 1, 0]);
      assert.equal(await cards.nth(1).getByRole('button', { name: '사용하기', exact: true }).isEnabled(), true);
      await cards.nth(1).locator('summary').click();
      await cards.nth(1).getByText('언제·어떻게', { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: `/tmp/yutverse-browser/help-duplicates-${viewport.width}.png` });
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS: repeated normal cards spend the clicked copy, with usable independent copies and readable help in portrait and landscape.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
