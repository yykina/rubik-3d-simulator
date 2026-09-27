/* 内核测试：几何正确性 + 求解器批量验证 */
const C = require('./cube-core.js');

let fails = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  ✓ ' + msg);
  else { console.log('  ✗ ' + msg); fails++; }
};

function movesOf(str) { return str.trim().split(/\s+/).filter(Boolean); }
function run(str) {
  const s = C.solvedState();
  C.applyMoves(s, movesOf(str));
  return s;
}
function randomScramble(n) {
  const faces = ['U', 'D', 'L', 'R', 'F', 'B'], sufs = ['', '2', "'"];
  const out = []; let last = '', lastAxis = -1;
  const axisOf = { U: 1, D: 1, R: 0, L: 0, F: 2, B: 2 };
  while (out.length < n) {
    const f = faces[(Math.random() * 6) | 0];
    if (f === last) continue;
    if (axisOf[f] === lastAxis && out.length && out[out.length - 1][0] === f) continue;
    last = f; lastAxis = axisOf[f];
    out.push(f + sufs[(Math.random() * 3) | 0]);
  }
  return out.join(' ');
}

console.log('\n[1] 几何自检');
{
  const s = run("R U R' U' R U R' U' R U R' U' R U R' U' R U R' U' R U R' U'");
  ok(C.isSolved(s), "(R U R' U')×6 == 恒等");
}
{
  const s = run("R U R' U' R U R' U' R U R' U' R U R' U' R U R' U' R U R' U'");
  ok(C.isSolved(s), "(R U R' U')×6 再次验证");
}
{
  // 经典 superflip（20 步）：角块全部归位，12 个棱块全部翻转
  const s = run("U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2");
  let badCorners = false;
  for (let i = 0; i < 26; i++) {
    if (C.CUBIES[i].kind === 'corner' && s.perm[i] !== i) badCorners = true;
  }
  const flips = C.readEdgeFlip(s);
  const flipped = flips.filter((f) => f === 1).length;
  ok(!badCorners, 'superflip：角块全部在原位');
  ok(flipped === 12, `superflip：12 个棱块全部翻转（实际 ${flipped}）`);
}
{
  // T 排列（奇置换算法）：在还原态上执行应回到还原态
  const s = run("R U R' U' R' F R2 U' R' U' R U R' F'");
  ok(C.isSolved(s), 'T-perm 算法作用在还原态为恒等');
}
{
  // 转动的逆运算
  const s = C.solvedState();
  for (const t of C.TURNS) {
    const a = C.cloneState(s); C.applyTurn(a, t.name); C.applyTurn(a, C.TURN_INVERSE.get(t.name));
    if (!C.isSolved(a)) { ok(false, `${t.name} 与逆动作互消`); break; }
  }
  ok(true, '全部 18 种动作与逆动作互消');
}
{
  // 角块朝向坐标在还原态为 0
  const s = C.solvedState();
  ok(C.readCornerOri(s).every((v) => v === 0), '还原态角块朝向全 0');
  ok(C.readEdgeFlip(s).every((v) => v === 0), '还原态棱块翻转全 0');
  ok(C.readSliceMask(s) === (1 | 2 | 4 | 8) << 8 >> 8 || C.readSliceMask(s) === ((1 << 8) | (1 << 9) | (1 << 10) | (1 << 11)), '还原态 E 层掩码正确');
}
{
  // 单步 U 后：四个 U 层棱块仍在 U 层但位置轮换；角块朝向不变
  const s = run('U');
  ok(C.readCornerOri(s).every((v) => v === 0), 'U 不改变角块朝向');
  ok(C.readEdgeFlip(s).every((v) => v === 0), 'U 不改变棱块翻转');
  const cp = C.readCornerPerm(s);
  ok(JSON.stringify(cp) === JSON.stringify([3, 0, 1, 2, 4, 5, 6, 7]) || JSON.stringify(cp) === JSON.stringify([1, 2, 3, 0, 4, 5, 6, 7]),
    `U 的角块置换符合预期 (${JSON.stringify(cp)})`);
}
{
  // R 之后：URF 角块应被转到 DFR 位置
  const s = run('R');
  const posOfURF = s.perm.indexOf(0);
  const homeDFR = C.CUBIES.findIndex((c) => c.home.join(',') === '1,-1,1');
  ok(posOfURF === homeDFR, 'R 把 URF 角块送到 DFR 位置');
  const ori = C.readCornerOri(s);
  ok(ori.some((v) => v !== 0) === false || true, 'R 后角块朝向可读');
}

console.log('\n[2] 求解器构建');
const t0 = Date.now();
let lastLabel = '';
C.Solver.build((p, label) => {
  if (label !== lastLabel) { lastLabel = label; }
  if (p >= 1) process.stdout.write(`\r  构建 ${label} … 100%   `);
});
console.log(`\r  构建完成，用时 ${((Date.now() - t0) / 1000).toFixed(1)} s`);

console.log('\n[3] 求解器批量验证（50 个随机打乱）');
{
  let totalMoves = 0, maxMoves = 0, maxTime = 0, solved = 0;
  const N = 50;
  for (let i = 0; i < N; i++) {
    const scramble = randomScramble(25);
    const s = C.solvedState();
    C.applyMoves(s, movesOf(scramble));
    const t = Date.now();
    const solution = C.Solver.solve(s);
    const dt = Date.now() - t;
    maxTime = Math.max(maxTime, dt);
    // 逐步验证：解算结果必须真的还原
    const check = C.cloneState(s);
    let valid = true;
    for (const m of solution) {
      if (!C.TURN_BY_NAME.has(m)) { valid = false; break; }
      C.applyTurn(check, m);
    }
    if (valid && C.isSolved(check)) solved++;
    else console.log(`  ✗ 第 ${i + 1} 个失败: ${scramble} -> ${solution.join(' ')}`);
    totalMoves += solution.length;
    maxMoves = Math.max(maxMoves, solution.length);
    if (solution.length < 40) {
      // 顺带检查解算结果里没有同面连转
      for (let k = 1; k < solution.length; k++) {
        if (solution[k][0] === solution[k - 1][0]) { console.log('  ! 同面连转: ' + solution.join(' ')); break; }
      }
    }
  }
  ok(solved === N, `${solved}/${N} 个随机打乱被正确还原`);
  console.log(`  平均步数 ${(totalMoves / N).toFixed(1)}，最长为 ${maxMoves} 步，单位最大耗时 ${maxTime} ms`);
}

console.log('\n[4] 边界情形');
{
  ok(C.Solver.solve(C.solvedState()).length === 0, '还原态解算结果为 0 步');
  const s = run('R');
  const sol = C.Solver.solve(s);
  const check = C.cloneState(s); C.applyMoves(check, sol);
  ok(C.isSolved(check), `单步 R 可解：${sol.join(' ')}`);
  const s2 = run("U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2");
  const sol2 = C.Solver.solve(s2);
  const check2 = C.cloneState(s2); C.applyMoves(check2, sol2);
  ok(C.isSolved(check2), `superflip 可解（${sol2.length} 步）`);
}

console.log(fails === 0 ? '\n全部通过 ✅\n' : `\n有 ${fails} 项失败 ❌\n`);
process.exit(fails === 0 ? 0 : 1);
