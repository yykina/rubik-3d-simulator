const path = require('path');
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const PORT = 5183;
(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, 'serve.js'), String(PORT)], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 500));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('console', m => console.log('[' + m.type() + ']', m.text()));
  await page.goto('http://127.0.0.1:' + PORT + '/mini.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  console.log('mini =', JSON.stringify(await page.evaluate(() => window.__mini)));
  await browser.close(); server.kill(); process.exit(0);
})();
