const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const email = `limit-check-${Date.now()}@example.com`;
  let userId;
  let token;
  try {
    await page.goto('http://127.0.0.1:5174');
    await page.getByRole('button', { name: 'Admin', exact: true }).click();
    await page.getByPlaceholder('Your Name').fill('admin');
    await page.getByPlaceholder('Email address').fill('adminurl@gmail.com');
    await page.getByPlaceholder('Password', { exact: true }).fill('adminurl123');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL('**/#/admin/**');
    token = await page.evaluate(() => localStorage.getItem('token'));
    await page.goto('http://127.0.0.1:5174/#/admin/users');
    await page.getByRole('button', { name: 'Add User', exact: true }).click();
    await page.getByLabel('Password', { exact: true }).fill('test-password-123');
    await page.getByLabel('Maximum emails per upload').fill('2');
    await page.getByPlaceholder('Username', { exact: true }).fill('Limit check');
    await page.getByPlaceholder('Email', { exact: true }).fill(email);
    await page.getByRole('button', { name: 'Add User', exact: true }).last().click();
    const row = page.getByRole('row').filter({ hasText: email });
    await row.getByText('2 emails', { exact: true }).waitFor();
    await row.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByLabel('Maximum emails per upload').fill('3');
    await page.screenshot({ path: '.codex-ui-check/admin-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '.codex-ui-check/admin-mobile.png', fullPage: true });
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await row.getByText('3 emails', { exact: true }).waitFor();
    const users = await (await page.request.get('http://127.0.0.1:5000/admin/users', { headers: { Authorization: `Bearer ${token}` } })).json();
    userId = users.find(u => u.email === email).id;
    await page.evaluate(() => localStorage.clear());
    await page.goto('http://127.0.0.1:5174/#/login');
    await page.reload();
    await page.getByRole('button', { name: 'User', exact: true }).click();
    await page.getByPlaceholder('Your Name').fill('Limit check');
    await page.getByPlaceholder('Email address').fill(email);
    await page.getByPlaceholder('Password', { exact: true }).fill('test-password-123');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByText('Maximum emails per upload: 3').waitFor();
    await page.locator('#file-upload').setInputFiles({ name: 'too-many.csv', mimeType: 'text/csv', buffer: Buffer.from('a@gmail.com\nb@gmail.com\nc@gmail.com\nd@gmail.com') });
    await page.getByRole('button', { name: 'Start Validation Job(s)', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Your limit is 3 emails. This file contains 4.' }).waitFor();
    await page.screenshot({ path: '.codex-ui-check/upload-mobile.png', fullPage: true });
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('PASS: admin login, create/edit limit, mobile forms, new-user login, oversized upload rejected; no browser errors.');
  } finally {
    if (userId && token) await page.request.post(`http://127.0.0.1:5000/admin/users/${userId}/delete`, { headers: { Authorization: `Bearer ${token}` }, data: {} });
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
