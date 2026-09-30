/*
 * 内核测试：几何、编码、状态机、还原判定。
 * 运行：node src/test-core.js
 *
 * 注意：求解器搜索目前不可靠（见 STATUS.md），因此这里**不**把「求解成功」当作通过条件，
 * 只验证不依赖求解器的核心不变量。求解器相关验证见 tools/verify-solver-core.js。
 */
const C = require('./cube-core.js');

let fails = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  ✓ ' + msg);
  else { console.log('  ✗ ' + msg); fails++; }
};
const movesOf = (s) => s.trim().split(/\s+/).filter(Boolean);
const run = (s) => { const st = C.solvedState(); C.applyMoves(st, movesOf(s)); return st; };
const rnd = (n) => Math.floor(Math.random() * n);
const I = C.Solver._internals;
const scramble = (n) => {
  const faces = ['U', 'D', 'L', 'R', 'F', 'B'], sufs = ['', '2', "'"];
  const out = []; let last = '';
  while (out.length < n) { const f = faces[rnd(6)]; if (f === last) continue; last = f; out.push(f + sufs[rnd(3)]); }
  return out;
};

console.log('\n[1] 几何与转动记号');
ok(C.isSolved(run("R U R' U' R U R' U' R U R' U' R U R' U' R U R' U' R U R' U'")), "(R U R' U')×6 == 恒等");
{
  let allInv = true;
  for (const t of C.TURNS) {
    const a = C.solvedState();
    C.applyTurn(a, t.name);
    C.applyTurn(a, C.TURN_INVERSE.get(t.name));
    if (!C.isSolved(a)) { allInv = false; break; }
  }
  ok(allInv, '全部 18 种动作与逆动作互消');
}
{
  const st = C.solvedState();
  const seq = movesOf("R U R' U' F2 L D' B2");
  C.applyMoves(st, seq);
  for (const m of seq.slice().reverse()) C.applyTurn(st, C.TURN_INVERSE.get(m));
  ok(C.isSolved(st), '任意打乱逆序回放回到还原');
}

console.log('\n[2] 还原判定（外观口径）');
ok(C.isSolved(C.solvedState()), '还原态判定为已还原');
ok(C.misplacedStickers(C.solvedState()) === 0, '还原态错位贴纸数 = 0');
{
  const r = run('R');
  ok(!C.isSolved(r), '单步 R 判定为未还原');
  ok(C.misplacedStickers(r) > 0, '单步 R 错位贴纸数 > 0');
}
{
  // R2 之后右层棱块可见地翻转（前绿变后蓝），必须判定为未还原
  const r2 = run('R2');
  ok(!C.isSolved(r2), 'R2 判定为未还原（可见的贴纸错位）');
}
{
  // 两个口径必须一致：isSolved 与「每面 9 张同色」
  let consistent = true;
  for (let t = 0; t < 400; t++) {
    const st = C.solvedState();
    C.applyMoves(st, scramble(rnd(22)));
    const fl = C.faceletsOf(st);
    const byFace = Object.keys(fl).every((f) => fl[f].length === 9 && fl[f].every((c) => c === fl[f][0]));
    if (C.isSolved(st) !== byFace) { consistent = false; break; }
  }
  ok(consistent, 'isSolved 与「每面 9 张同色」在 400 个随机状态下一致');
}

console.log('\n[3] 编码与状态机');
ok(JSON.stringify(I.unpack(I.pack(C.IDENTITY))) === JSON.stringify(C.IDENTITY), 'pack/unpack 单位矩阵往返');
{
  // 24 种旋转的编解码往返
  const seen = new Set([C.IDENTITY.join(',')]);
  const stack = [C.IDENTITY.slice()];
  const rots = [
    [1, 0, 0, 0, 0, 1, 0, -1, 0],
    [0, 0, -1, 0, 1, 0, 1, 0, 0],
    [0, 1, 0, -1, 0, 0, 0, 0, 1],
  ];
  while (stack.length) {
    const m = stack.pop();
    for (const r of rots) {
      const n = C.mul(r, m), k = n.join(',');
      if (!seen.has(k)) { seen.add(k); stack.push(n); }
    }
  }
  let roundTrip = true;
  for (const k of seen) {
    const m = k.split(',').map(Number);
    if (I.unpack(I.pack(m)).join(',') !== k) roundTrip = false;
  }
  ok(seen.size === 24 && roundTrip, '24 种旋转编码往返一致');
}
{
  // 压缩状态机 vs 几何状态机
  const g = C.solvedState();
  const p = I.solvedPack();
  let same = true;
  for (let i = 0; i < 300 && same; i++) {
    const mv = ['U', 'D', 'L', 'R', 'F', 'B'][rnd(6)] + ['', '2', "'"][rnd(3)];
    C.applyTurn(g, mv);
    I.applyPack(p, mv);
    const ps = { perm: p.perm, ori: p.ori.map((c) => I.unpack(c)) };
    if (C.misplacedStickers(g) !== C.misplacedStickers(ps)) same = false;
    if (C.isSolved(g) !== C.isSolved(ps)) same = false;
  }
  ok(same, '压缩状态机与几何状态机 300 步一致');
}

console.log(fails === 0 ? '\n全部通过 ✅\n' : `\n有 ${fails} 项失败 ❌\n`);
process.exit(fails === 0 ? 0 : 1);
