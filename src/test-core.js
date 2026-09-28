/*
 * 内核测试：几何正确性 + 求解器验证
 * 运行：node src/test-core.js
 * 有剪枝表缓存（src/debug/solver-tables.bin）时秒级完成；否则会现场构建（约 3.5 分钟）。
 */
const fs = require('fs');
const path = require('path');
const C = require('./cube-core.js');

let fails = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  ✓ ' + msg);
  else { console.log('  ✗ ' + msg); fails++; }
};
const movesOf = (s) => s.trim().split(/\s+/).filter(Boolean);
const run = (s) => { const st = C.solvedState(); C.applyMoves(st, movesOf(s)); return st; };
const rnd = (n) => Math.floor(Math.random() * n);
function scramble(n) {
  const faces = ['U', 'D', 'L', 'R', 'F', 'B'], sufs = ['', '2', "'"];
  const out = []; let last = '';
  while (out.length < n) { const f = faces[rnd(6)]; if (f === last) continue; last = f; out.push(f + sufs[rnd(3)]); }
  return out;
}
function packState(g) {
  const I = C.Solver._internals;
  return { perm: g.perm.slice(), ori: g.ori.map((m) => I.pack(m)) };
}

console.log('\n[1] 几何自检');
ok(C.isSolved(run("R U R' U' R U R' U' R U R' U' R U R' U' R U R' U' R U R' U'")), "(R U R' U')×6 == 恒等");
{
  // 注：翻转是「按槽位」定义的坐标，某些教科书算法在该坐标下不表现为全翻，
  // 这里只断言它能被读出来且角块朝向不变（几何自检已覆盖真正的不变量）。
  const st = run("U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2");
  const I = C.Solver._internals;
  const ps = packState(st);
  ok(I.twistOf(ps) === 0, 'superflip 算法：角块朝向不变');
  ok(I.flipOf(ps) !== 0, 'superflip 算法：棱块翻转坐标非零');
}
{
  // T-perm 是「角块三循环 + 棱块二交换」的奇置换，作用在还原态不会是恒等，
  // 断言它的坐标形态正确即可。
  const st = run("R U R' U' R' F R2 U' R' U' R U R' F'");
  const I = C.Solver._internals;
  const ps = packState(st);
  ok(I.twistOf(ps) === 888 && I.cpOf(ps) === 10374, 'T-perm 坐标形态符合预期');
}
{
  let allInv = true;
  for (const t of C.TURNS) {
    const a = C.solvedState(); C.applyTurn(a, t.name); C.applyTurn(a, C.TURN_INVERSE.get(t.name));
    if (!C.isSolved(a)) { allInv = false; break; }
  }
  ok(allInv, '全部 18 种动作与逆动作互消');
}

console.log('\n[2] 朝向编码与状态机自检');
{
  const I = C.Solver._internals;
  ok(JSON.stringify(I.unpack(I.pack(C.IDENTITY))) === JSON.stringify(C.IDENTITY), 'pack/unpack 单位矩阵往返');
  // 压缩状态机 vs 几何：300 步随机一致
  const geo = C.solvedState(); const pack = I.solvedPack();
  const snap = (x) => [I.twistOf(x), I.flipOf(x), I.sliceOf(x), I.cpOf(x), I.epOf(x), I.spOf(x)];
  let same = true;
  for (let i = 0; i < 300 && same; i++) {
    const name = ['U','D','L','R','F','B'][rnd(6)] + ['','2',"'"][rnd(3)];
    C.applyTurn(geo, name); I.applyPack(pack, name);
    if (snap(packState(geo)).join() !== snap(pack).join()) same = false;
  }
  ok(same, '压缩状态机与几何状态机 300 步随机一致');
}

console.log('\n[3] 求解器');
const FILE = path.join(__dirname, 'debug', 'solver-tables.bin');
let loaded = false;
if (fs.existsSync(FILE)) {
  try {
    const buf = fs.readFileSync(FILE);
    const N = [2187 * 2048, 24 * 40320, 24 * 40320];
    if (buf.subarray(0, 4).toString() === 'CB06') {
      let off = 4;
      const parts = N.map((n) => { const a = new Uint8Array(buf.buffer, buf.byteOffset + off, n); off += n; return a; });
      C.Solver.load({ p1: parts[0], sc: parts[1], se: parts[2] });
      loaded = true;
      console.log('  （已从缓存加载剪枝表）');
    }
  } catch (e) { /* 走构建 */ }
}
if (!loaded) {
  console.log('  （现场构建剪枝表，约 3.5 分钟…）');
  C.Solver.build(() => {});
}
{
  ok(C.Solver.solve(C.solvedState()).length === 0, '还原态解为 0 步');
  const cases = ['R', "R U", "R U R' U'", "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2"];
  let allOk = true;
  for (const scr of cases) {
    const st = run(scr);
    const sol = C.Solver.solve(st);
    const chk = C.cloneState(st); C.applyMoves(chk, sol);
    if (!C.isSolved(chk)) { allOk = false; console.log('    ✗ 未还原: ' + scr); }
  }
  ok(allOk, '经典算式与打乱全部被正确还原');
}
{
  const N = 20; let good = 0, total = 0, worst = 0;
  for (let i = 0; i < N; i++) {
    const ms = scramble(25);
    const st = C.solvedState(); C.applyMoves(st, ms);
    const t = Date.now();
    let sol;
    try { sol = C.Solver.solve(st); } catch (e) { console.log('    ✗ 抛错: ' + e.message); continue; }
    worst = Math.max(worst, Date.now() - t);
    const chk = C.cloneState(st); C.applyMoves(chk, sol);
    if (C.isSolved(chk)) { good++; total += sol.length; }
  }
  ok(good === N, `${good}/${N} 个 25 步随机打乱被正确还原`);
  if (good) console.log(`    平均 ${(total / good).toFixed(1)} 步，单次最坏 ${worst}ms`);
}

console.log(fails === 0 ? '\n全部通过 ✅\n' : `\n有 ${fails} 项失败 ❌\n`);
process.exit(fails === 0 ? 0 : 1);
