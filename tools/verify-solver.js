/* 只验证求解器路径：等待就绪 → 打乱 → 提示 → 自动求解 */
const path = require('path');
const { chromium } = require('playwright');
const { spawn } = require('child_process');

const PORT = 5188;
(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, 'serve.js'), String(PORT)], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 500));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto('http://127.0.0.1:' + PORT + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__cube, null, { timeout: 120000 });

  // 轮询求解器状态
  const t0 = Date.now();
  let ready = false;
  while (Date.now() - t0 < 420000) {
    ready = await page.evaluate(() => !document.getElementById('btn-solve').disabled);
    if (ready) break;
    const info = await page.evaluate(() => ({
      s: document.getElementById('solver-state').textContent,
      t: document.getElementById('toast-text').textContent,
    }));
    if ((Date.now() - t0) % 30000 < 2000) console.log(`t=${((Date.now() - t0) / 1000) | 0}s`, JSON.stringify(info));
    await page.waitForTimeout(2000);
  }
  console.log('就绪:', ready, '用时', (((Date.now() - t0) / 1000) | 0) + 's');
  if (!ready) { await browser.close(); server.kill(); process.exit(1); }

  await page.click('#btn-scramble');
  await page.waitForFunction(() => document.getElementById('moves').textContent === '25', null, { timeout: 60000 });
  console.log('打乱完成');
  const t1 = Date.now();
  await page.click('#btn-hint');
  await page.waitForFunction(() => document.getElementById('solution').classList.contains('show'), null, { timeout: 120000 });
  const hint = (await page.textContent('#solution') || '').trim();
  console.log(`提示完成 ${Date.now() - t1}ms，建议 ${hint.split(/\s+/).length} 步，首步 ${hint.split(/\s+/)[0]}`);

  const t2 = Date.now();
  await page.click('#btn-solve');
  await page.waitForFunction(() => window.__cube.Core.isSolved(window.__cube.state), null, { timeout: 240000 });
  console.log(`自动求解完成 ${Date.now() - t2}ms，步数 ${await page.textContent('#moves')}`);
  await page.screenshot({ path: path.join(__dirname, '..', 'shots', '06-solver.png') });
  await browser.close();
  server.kill();
  process.exit(0);
})().catch((e) => { console.error('失败:', String(e).split('\n')[0]); process.exit(1); });
