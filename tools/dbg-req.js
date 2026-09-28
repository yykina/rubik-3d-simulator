const path = require('path');
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const PORT = 5184;
(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, 'serve.js'), String(PORT)], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 500));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('request', r => { if (/cube-core|three|solver/.test(r.url())) console.log('[req]', r.url()); });
  page.on('response', r => { if (/cube-core|three|solver/.test(r.url())) console.log('[res]', r.status(), r.url()); });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('console', m => console.log('[' + m.type() + ']', m.text()));
  await page.goto('http://127.0.0.1:' + PORT + '/', { waitUntil: 'load' });
  await page.waitForTimeout(5000);
  console.log('core =', await page.evaluate(() => typeof window.CubeCore));
  await browser.close(); server.kill(); process.exit(0);
})();
