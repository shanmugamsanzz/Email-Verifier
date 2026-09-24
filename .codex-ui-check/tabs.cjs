const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext();
    const first = await context.newPage();
    const second = await context.newPage();
    const errors = [];
    let secondApiCalls = 0;
    for (const page of [first, second]) page.on('pageerror', e => errors.push(e.message));
    second.on('request', req => { if (req.url().includes(':5000/')) secondApiCalls++; });
    await first.goto('http://127.0.0.1:5174');
    await first.getByRole('button', { name: 'Admin', exact: true }).waitFor();
    await second.goto('http://127.0.0.1:5174');
    await second.getByRole('heading', { name: 'Already open in another tab' }).waitFor();
    await second.getByRole('button', { name: 'Try Again' }).click();
    await second.getByRole('heading', { name: 'Already open in another tab' }).waitFor();
    assert.equal(secondApiCalls, 0, 'Blocked tab must not run auth or job requests');
    await first.reload();
    await first.getByRole('button', { name: 'Admin', exact: true }).waitFor();
    await second.setViewportSize({ width: 390, height: 844 });
    await second.screenshot({ path: '.codex-ui-check/blocked-tab-mobile.png', fullPage: true });
    await first.close();
    await second.getByRole('button', { name: 'Try Again' }).click();
    await second.getByRole('button', { name: 'Admin', exact: true }).waitFor();
    await second.close();
    const raceA = await context.newPage();
    const raceB = await context.newPage();
    await Promise.all([raceA.goto('http://127.0.0.1:5174'), raceB.goto('http://127.0.0.1:5174')]);
    await Promise.all([raceA, raceB].map(page => page.waitForFunction(() =>
      document.body.textContent.includes('Already open in another tab') || document.body.textContent.includes('Choose your role'))));
    const blocked = await Promise.all([raceA, raceB].map(page => page.getByRole('heading', { name: 'Already open in another tab' }).count()));
    assert.equal(blocked.reduce((a, b) => a + b, 0), 1);
    assert.deepEqual(errors, []);
    console.log('PASS: duplicate blocked, retry while occupied, owner refresh, close/reclaim, concurrent tab race, no API activity from blocked tab.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
