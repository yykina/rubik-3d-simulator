/* 用真实 Chromium 打开页面：检查控制台错误、渲染像素、核心交互，并输出截图 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { spawn } = require('child_process');

const PORT = 5179;
const OUT = path.join(__dirname, '..', 'shots');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, 'serve.js'), String(PORT)], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 600));

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__cube, { timeout: 30000 });
  await page.waitForTimeout(1200);          // 等首帧与 CDN 模块

  const info = await page.evaluate(() => {
    const c = window.__cube;
    const canvas = document.querySelector('canvas');
    return {
      pieces: c.pieces.length,
      stickers: c.pieces.reduce((n, p) => n + p.stickers.length, 0),
      canvas: canvas ? [canvas.width, canvas.height] : null,
      solved: c.Core.isSolved(c.state),
      hasWorker: typeof Worker !== 'undefined',
      solverState: document.getElementById('solver-state').textContent,
    };
  });
  console.log('页面信息:', JSON.stringify(info));

  await page.screenshot({ path: path.join(OUT, '01-initial.png') });

  // 交互：键盘转 R，检查逻辑状态变化与步数
  await page.keyboard.press('r');
  await page.waitForTimeout(500);
  const afterR = await page.evaluate(() => ({
    solved: window.__cube.Core.isSolved(window.__cube.state),
    moves: document.getElementById('moves').textContent,
    perm: Array.from(window.__cube.state.perm).join(','),
  }));
  console.log('按 R 之后:', JSON.stringify({ solved: afterR.solved, moves: afterR.moves }));

  // 打乱
  await page.click('#btn-scramble');
  await page.waitForTimeout(2500);
  const afterScramble = await page.evaluate(() => ({
    solved: window.__cube.Core.isSolved(window.__cube.state),
    moves: document.getElementById('moves').textContent,
    timer: document.getElementById('timer').textContent,
    state: document.getElementById('state').textContent,
  }));
  console.log('打乱之后:', JSON.stringify(afterScramble));
  await page.screenshot({ path: path.join(OUT, '02-scrambled.png') });

  // 鼠标拖动转层：在魔方中心偏右下拖动
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.mouse.move(720, 400, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const afterDrag = await page.evaluate(() => document.getElementById('moves').textContent);
  console.log('拖动后步数:', afterDrag);

  // 撤销
  await page.click('#btn-undo');
  await page.waitForTimeout(400);
  // 还原
  await page.click('#btn-reset');
  await page.waitForTimeout(300);
  const afterReset = await page.evaluate(() => ({
    solved: window.__cube.Core.isSolved(window.__cube.state),
    moves: document.getElementById('moves').textContent,
  }));
  console.log('还原之后:', JSON.stringify(afterReset));
  await page.screenshot({ path: path.join(OUT, '03-reset.png') });

  console.log('控制台错误:', errors.length ? JSON.stringify(errors.slice(0, 5), null, 1) : '无');
  await browser.close();
  server.kill();
  process.exit(0);
})().catch((e) => { console.error('验证脚本失败:', e); process.exit(1); });
