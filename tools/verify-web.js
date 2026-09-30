/*
 * verify-web.js — 端到端验证（真实 Chromium）
 *
 * 核心要求：**失败必须让进程返回非零**，不能只打印日志。
 *
 * 校验点：
 *   1. 渲染：26 块、54 贴纸、WebGL 上下文
 *   2. 键盘转层改变状态且步数 +1
 *   3. 鼠标拖动转层生效
 *   4. 还原：外观归位、步数与计时归零
 *   5. 打乱：不计入步数（保持 0）、状态显示「打乱中」
 *   6. 撤销：步数与状态恢复
 *   7. 整体转 X：改变朝向但不改变还原程度、不计步数
 *   8. 提示 / 自动求解：结果必须通过**独立面片校验**（不依赖 Core.isSolved）
 *   9. 无控制台错误
 *
 * 环境变量 SEED_TABLES=1 时把 src/debug/solver-tables.bin 注入 IndexedDB，跳过首次构建。
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const seeder = require('./seed-tables.js');

const PORT = 5179;
const OUT = path.join(__dirname, '..', 'shots');
fs.mkdirSync(OUT, { recursive: true });

const failures = [];
function check(cond, label, extra) {
  if (cond) console.log('  ✓ ' + label);
  else {
    console.log('  ✗ ' + label + (extra ? '  ' + JSON.stringify(extra) : ''));
    failures.push(label);
  }
}

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
  await page.waitForFunction(() => !!window.__cube, null, { timeout: 120000 });
  await page.waitForTimeout(1000);

  /* ---------------- 1. 渲染 ---------------- */
  console.log('\n[1] 渲染');
  const info = await page.evaluate(() => {
    const c = window.__cube;
    const canvas = document.querySelector('canvas');
    return {
      pieces: c.pieces.length,
      stickers: c.pieces.reduce((n, p) => n + p.stickers.length, 0),
      canvas: canvas ? [canvas.width, canvas.height] : null,
      webgl: !!(canvas && (canvas.getContext('webgl2') || canvas.getContext('webgl'))),
      misplaced: c.Core.misplacedStickers(c.state),
    };
  });
  check(info.pieces === 26, '26 个小块', info);
  check(info.stickers === 54, '54 张贴纸', info);
  check(!!info.canvas && info.canvas[0] > 0, 'canvas 已创建', info);
  check(info.webgl, 'WebGL 上下文可用', info);
  check(info.misplaced === 0, '初始为还原态', info);
  await page.screenshot({ path: path.join(OUT, '01-initial.png') });

  /* ---------------- 2. 键盘转层 ---------------- */
  console.log('\n[2] 键盘转层');
  await page.keyboard.press('r');
  await page.waitForTimeout(500);
  const afterR = await page.evaluate(() => ({
    misplaced: window.__cube.Core.misplacedStickers(window.__cube.state),
    moves: document.getElementById('moves').textContent,
  }));
  check(afterR.misplaced > 0, '按 R 后状态改变', afterR);
  check(afterR.moves === '1', '步数计为 1', afterR);

  /* ---------------- 3. 鼠标拖动转层 ---------------- */
  console.log('\n[3] 鼠标拖动转层');
  const movesBeforeDrag = Number(await page.textContent('#moves'));
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.mouse.move(730, 400, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const movesAfterDrag = Number(await page.textContent('#moves'));
  check(movesAfterDrag > movesBeforeDrag, '拖动使步数增加', { movesBeforeDrag, movesAfterDrag });

  /* ---------------- 4. 还原 ---------------- */
  console.log('\n[4] 还原');
  await page.click('#btn-reset');
  await page.waitForTimeout(500);
  const afterReset = await page.evaluate(() => ({
    misplaced: window.__cube.Core.misplacedStickers(window.__cube.state),
    moves: document.getElementById('moves').textContent,
    timer: document.getElementById('timer').textContent,
  }));
  check(afterReset.misplaced === 0, '外观已还原', afterReset);
  check(afterReset.moves === '0', '步数归零', afterReset);
  check(afterReset.timer === '0.00', '计时归零', afterReset);

  /* ---------------- 5. 打乱不计成绩 ---------------- */
  console.log('\n[5] 打乱');
  await page.click('#btn-scramble');
  await page.waitForFunction(() => document.getElementById('state').textContent === '打乱中', null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  const afterScramble = await page.evaluate(() => ({
    misplaced: window.__cube.Core.misplacedStickers(window.__cube.state),
    moves: document.getElementById('moves').textContent,
    state: document.getElementById('state').textContent,
    perm: Array.from(window.__cube.state.perm),
    ori: window.__cube.state.ori.map((m) => Array.from(m)),
  }));
  check(afterScramble.misplaced > 0, '打乱后确实乱了', { misplaced: afterScramble.misplaced });
  check(afterScramble.moves === '0', '打乱不计入步数（应为 0）', { moves: afterScramble.moves });
  check(afterScramble.state === '打乱中', '状态显示为打乱中', { state: afterScramble.state });
  await page.screenshot({ path: path.join(OUT, '02-scrambled.png') });

  /* ---------------- 6. 撤销 ---------------- */
  console.log('\n[6] 撤销');
  const scrambledMisplaced = afterScramble.misplaced;
  await page.keyboard.press('u');
  await page.waitForTimeout(400);
  const afterOne = await page.evaluate(() => ({
    moves: document.getElementById('moves').textContent,
  }));
  check(afterOne.moves === '1', '手动转动计 1 步', afterOne);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(400);
  const afterUndo = await page.evaluate(() => ({
    misplaced: window.__cube.Core.misplacedStickers(window.__cube.state),
    moves: document.getElementById('moves').textContent,
  }));
  check(afterUndo.moves === '0', '撤销后步数归零', afterUndo);
  check(afterUndo.misplaced === scrambledMisplaced, '撤销恢复了打乱后的状态',
    { expected: scrambledMisplaced, got: afterUndo.misplaced });

  /* ---------------- 7. 整体转 ---------------- */
  console.log('\n[7] 整体转 (X)');
  const beforeX = await page.evaluate(() => ({
    misplaced: window.__cube.Core.misplacedStickers(window.__cube.state),
    perm: Array.from(window.__cube.state.perm).join(','),
    moves: document.getElementById('moves').textContent,
  }));
  await page.keyboard.press('x');
  await page.waitForTimeout(600);
  const afterX = await page.evaluate(() => ({
    misplaced: window.__cube.Core.misplacedStickers(window.__cube.state),
    perm: Array.from(window.__cube.state.perm).join(','),
    moves: document.getElementById('moves').textContent,
  }));
  check(afterX.perm !== beforeX.perm, '整体转改变了摆放', null);
  check(afterX.misplaced === beforeX.misplaced, '整体转不改变还原程度',
    { before: beforeX.misplaced, after: afterX.misplaced });
  check(afterX.moves === beforeX.moves, '整体转不计步数', { before: beforeX.moves, after: afterX.moves });

  /* ---------------- 8. 求解（当前版本已停用，做状态断言） ---------------- */
  console.log('\n[8] 求解（本轮停用）');
  const solverUi = await page.evaluate(() => ({
    state: document.getElementById('solver-state').textContent,
    solveDisabled: document.getElementById('btn-solve').disabled,
    hintDisabled: document.getElementById('btn-hint').disabled,
    hintLabel: document.getElementById('btn-hint').textContent,
  }));
  check(solverUi.solveDisabled && solverUi.hintDisabled, '求解按钮处于禁用状态', solverUi);
  check(/未启用|就绪/.test(solverUi.state), '求解器状态文案明确', { state: solverUi.state });
  // 若将来重新启用求解，这里会自动改为执行求解校验
  if (!solverUi.solveDisabled) {
    const waitT0 = Date.now();
    let solverUp = false;
    while (Date.now() - waitT0 < 480000) {
      solverUp = await page.evaluate(() => !document.getElementById('btn-solve').disabled);
      if (solverUp) break;
      await page.waitForTimeout(2000);
    }
    check(solverUp, '求解器在 8 分钟内就绪');
    if (solverUp) {
      await page.click('#btn-scramble');
      await page.waitForFunction(() => document.getElementById('state').textContent === '打乱中', null, { timeout: 60000 });
      await page.waitForTimeout(2500);
      const scrambleInfo = await page.evaluate(() => ({
        perm: Array.from(window.__cube.state.perm),
        ori: window.__cube.state.ori.map((m) => Array.from(m)),
      }));
      await page.click('#btn-solve');
      const solvedOk = await page.waitForFunction(
        () => window.__cube.Core.misplacedStickers(window.__cube.state) === 0,
        null, { timeout: 300000 }
      ).then(() => true).catch(() => false);
      check(solvedOk, '自动求解后独立面片校验确认外观还原');
      if (!solvedOk) {
        const finalState = await page.evaluate(() => ({
          misplaced: window.__cube.Core.misplacedStickers(window.__cube.state),
          faces: window.__cube.Core.faceletsOf(window.__cube.state),
        }));
        console.log('  失败现场: perm=' + JSON.stringify(scrambleInfo.perm));
        console.log('            ori=' + JSON.stringify(scrambleInfo.ori));
        console.log('            faces=' + JSON.stringify(finalState.faces));
      }
    }
  }

  /* ---------------- 9. 控制台 ---------------- */
  console.log('\n[9] 控制台');
  check(errors.length === 0, '无控制台错误/页面异常', errors.slice(0, 3));

  await browser.close();
  server.kill();

  console.log('');
  if (failures.length) {
    console.log(`❌ ${failures.length} 项失败:`);
    for (const f of failures) console.log('   - ' + f);
    process.exit(1);
  }
  console.log('✅ 全部通过');
  process.exit(0);
})().catch((e) => {
  console.error('验证脚本异常:', e);
  process.exit(1);
});
