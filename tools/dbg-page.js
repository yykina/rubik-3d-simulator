/* 页面加载诊断：打印控制台/网络错误 */
const path = require('path');
const { chromium } = require('playwright');
const { spawn } = require('child_process');

const PORT = 5181;
(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, 'serve.js'), String(PORT)], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 500));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', (m) => console.log('[' + m.type() + ']', m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('requestfailed', (r) => console.log('[requestfailed]', r.url(), r.failure() && r.failure().errorText));
  await page.goto('http://127.0.0.1:' + PORT + '/', { waitUntil: 'domcontentloaded' });
  const early = await page.evaluate(() => ({ core: typeof window.CubeCore, readyState: document.readyState }));
  console.log('DOMContentLoaded 时:', JSON.stringify(early));
  await page.waitForTimeout(8000);
  console.log('typeof __cube =', await page.evaluate(() => typeof window.__cube));
  console.log('typeof CubeCore =', await page.evaluate(() => typeof window.CubeCore));
  console.log('canvas count =', await page.evaluate(() => document.querySelectorAll('canvas').length));
  await browser.close();
  server.kill();
  process.exit(0);
})();
