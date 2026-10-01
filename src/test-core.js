/*
 * 内核测试：几何、编码、状态机、还原判定。
 * 运行：node src/test-core.js
 *
 * 本脚本验证不依赖求解器的核心不变量；cubejs 求解回放见 tools/verify-cubejs.js。
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

console.log('\n[1b] 与 Kociemba 官方表比对（防止转动方向再次退化）');
{
  /*
   * 这两个表来自 Kociemba 官方实现
   * https://github.com/hkociemba/RubiksCube-OptimalSolver/blob/master/cubie.py
   * 顺序 URFDLB。**不要**用「自洽性」测试替代它：
   * 曾经六个面转角全部写反（move('U') 等于标准 U'），
   * 而逆动作互消、(R U R' U')×6 这类自洽性检查在整体取逆后依然成立，
   * 因此长期没能发现，直到与官方表比对才暴露。
   */
  const STD_CP = { U: [3,0,1,2,4,5,6,7], R: [4,1,2,0,7,5,6,3], F: [1,5,2,3,0,4,6,7],
    D: [0,1,2,3,5,6,7,4], L: [0,2,6,3,4,1,5,7], B: [0,1,3,7,4,5,2,6] };
  const STD_EP = { U: [3,0,1,2,4,5,6,7,8,9,10,11], R: [8,1,2,3,11,5,6,7,4,9,10,0],
    F: [0,9,2,3,4,8,6,7,1,5,10,11], D: [0,1,2,3,5,6,7,4,8,9,10,11],
    L: [0,1,10,3,4,5,9,7,8,2,6,11], B: [0,1,2,11,4,5,6,10,8,9,3,7] };
  const inv = (a) => { const b = new Array(a.length); for (let i = 0; i < a.length; i++) b[a[i]] = i; return b; };
  for (const m of ['U', 'R', 'F', 'D', 'L', 'B']) {
    const st = C.solvedState(); C.applyTurn(st, m);
    const cp = inv(C.readCornerPerm(st)).join(',');
    const ep = inv(C.readEdgePerm(st)).join(',');
    ok(cp === STD_CP[m].join(','), `${m} 的角块置换与 Kociemba 官方表一致`);
    ok(ep === STD_EP[m].join(','), `${m} 的棱块置换与 Kociemba 官方表一致`);
  }
  // 多步组合也要一致
  const seq = ['R', 'U', "F'", 'L', 'D', 'B2'];
  const st = C.solvedState(); C.applyMoves(st, seq);
  let ref = { cp: [0,1,2,3,4,5,6,7], ep: [0,1,2,3,4,5,6,7,8,9,10,11] };
  const MOVE_PERM = { U: STD_CP.U, R: STD_CP.R, F: STD_CP.F, D: STD_CP.D, L: STD_CP.L, B: STD_CP.B };
  const MOVE_PERM_E = { U: STD_EP.U, R: STD_EP.R, F: STD_EP.F, D: STD_EP.D, L: STD_EP.L, B: STD_EP.B };
  // 组合规则：先 a 后 b 的置换 = a[b[i]]（与内核 applyTurn 的语义一致）
  const compose = (a, b) => a.map((_, i) => a[b[i]]);
  for (const raw of seq) {
    const reps = raw.endsWith('2') ? [raw[0], raw[0]] : [raw];
    for (const mv of reps) {
      let cp = MOVE_PERM[mv[0]].slice(), ep = MOVE_PERM_E[mv[0]].slice();
      if (mv.endsWith("'")) {
        // 逆置换
        const icp = inv(cp), iep = inv(ep);
        cp = icp; ep = iep;
      }
      ref = { cp: compose(ref.cp, cp), ep: compose(ref.ep, ep) };
    }
  }
  ok(inv(C.readCornerPerm(st)).join(',') === ref.cp.join(','), '多步组合的角块置换与官方表一致');
  ok(inv(C.readEdgePerm(st)).join(',') === ref.ep.join(','), '多步组合的棱块置换与官方表一致');
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
  let appearance = true;
  for (const k of seen) {
    const rot = k.split(',').map(Number);
    const rotate = (st) => {
      const out = C.solvedState();
      for (let from = 0; from < 26; from++) {
        const target = C.applyM(rot, C.CUBIES[from].home);
        const to = C.CUBIES.findIndex((c) => c.home.join(',') === target.join(','));
        out.perm[to] = st.perm[from];
        out.ori[to] = C.mul(rot, st.ori[from]);
      }
      return out;
    };
    const solved = rotate(C.solvedState());
    const scrambled = rotate(run("R U F2"));
    if (!C.isSolved(solved) || C.misplacedStickers(solved) !== 0 || C.isSolved(scrambled)) appearance = false;
  }
  ok(appearance, '全部 24 种整体朝向下，还原态与打乱态判定正确');
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
