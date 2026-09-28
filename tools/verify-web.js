/* 用真实 Chromium 打开页面：检查控制台错误、渲染像素、核心交互，并输出截图 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const seeder = require('./seed-tables.js');

const PORT = 5179;
const OUT = path.join(__dirname, '..', 'shots');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, 'serve.js'), String(PORT)], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 600));

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  if (process.env.SEED_TABLES) await ctx.addInitScript(seeder());
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__cube, { timeout: 120000 });
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

  // 等待求解器就绪（并行构建较慢），然后验证「提示 / 自动求解」
  try {
    // 显式轮询等待求解表就绪（并行构建首次约 2~3 分钟）
    const waitT0 = Date.now();
    let solverUp = false;
    while (Date.now() - waitT0 < 480000) {
      solverUp = await page.evaluate(() => !document.getElementById('btn-solve').disabled);
      if (solverUp) break;
      if ((Date.now() - waitT0) % 30000 < 16000) {
        const t = await page.evaluate(() => document.getElementById('toast-text').textContent);
        console.log(`  [${((Date.now() - waitT0) / 1000) | 0}s] ${t}`);
      }
      await page.waitForTimeout(2000);
    }
    if (!solverUp) throw new Error('求解表在 8 分钟内未就绪');
    console.log('求解器已就绪:', await page.textContent('#solver-state'), `（等待 ${((Date.now() - waitT0) / 1000) | 0}s）`);

    // 打乱并等它真正完成（步数稳定在 25）
    await page.click('#btn-scramble');
    await page.waitForFunction(() => document.getElementById('moves').textContent === '25', { timeout: 60000 });
    await page.waitForTimeout(400);
    console.log('打乱完成，步数:', await page.textContent('#moves'));

    const t0 = Date.now();
    await page.click('#btn-hint');
    await page.waitForFunction(() => document.getElementById('solution').classList.contains('show'), { timeout: 120000 });
    const hint = (await page.textContent('#solution') || '').trim();
    const toks = hint.split(/\s+/).filter(Boolean);
    console.log(`提示耗时 ${Date.now() - t0}ms，首个建议: ${toks[0]}，整段 ${toks.length} 步`);
    await page.screenshot({ path: path.join(OUT, '04-hint.png') });

    // 自动求解：等它播放完并且状态回到「已还原」
    const t1 = Date.now();
    await page.click('#btn-solve');
    await page.waitForFunction(() => window.__cube.Core.isSolved(window.__cube.state), { timeout: 180000 });
    console.log(`自动求解完成，用时 ${Date.now() - t1}ms，累计步数:`, await page.textContent('#moves'));
    await page.screenshot({ path: path.join(OUT, '05-solved.png') });
  } catch (e) {
    console.log('求解器验证未完成:', String(e).split('\n').slice(0, 3).join(' | '));
    console.log('  当时状态:', JSON.stringify(await page.evaluate(() => ({
      solver: document.getElementById('solver-state').textContent,
      toast: document.getElementById('toast-text').textContent,
      toastShown: document.getElementById('toast').classList.contains('show'),
      solveBtn: document.getElementById('btn-solve').disabled,
    }))));
  }

  console.log('控制台错误:', errors.length ? JSON.stringify(errors.slice(0, 5), null, 1) : '无');
  await browser.close();
  server.kill();
  process.exit(0);
})().catch((e) => { console.error('验证脚本失败:', e); process.exit(1); });
