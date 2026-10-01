/*
 * A 路线验收：内核状态 → 官方面片串 → cubejs 求解 → 内核几何回放 → 0 错位贴纸
 * 这是唯一有意义的验收标准。
 */
const C = require('../src/cube-core.js');
const Cube = require('../vendor/cubejs/index.js');

const parse = (s) => String(s || '').trim().split(/\s+/).filter(Boolean);
const faces = ['U', 'D', 'L', 'R', 'F', 'B'], sufs = ['', '2', "'"], rnd = (n) => (Math.random() * n) | 0;

Cube.initSolver();
const cases = [['R'], ['R2'], ['F2', 'D'], ['R', 'U', "R'", "U'"]];
for (let i = 0; i < 16; i++) {
  const ms = []; let last = '';
  while (ms.length < 25) { const f = faces[rnd(6)]; if (f === last) continue; last = f; ms.push(f + sufs[rnd(3)]); }
  cases.push(ms);
}
let ok = 0, bad = 0, worst = 0, total = 0, len = 0;
for (const seq of cases) {
  const st = C.solvedState(); C.applyMoves(st, seq);
  const str = C.faceletString(st);
  const t = Date.now();
  let sol;
  try { sol = parse(Cube.fromString(str).solve()); } catch (e) { bad++; console.log('✗ 求解异常', e.message); continue; }
  const ms = Date.now() - t; worst = Math.max(worst, ms); total += ms; len += sol.length;
  const chk = C.cloneState(st); C.applyMoves(chk, sol);
  const m = C.misplacedStickers(chk);
  if (m === 0) ok++; else { bad++; console.log('✗ 未还原（残留 ' + m + ' 张）:', seq.join(' '), '→', sol.join(' ')); }
}
console.log(`\nA 路线验收：${ok}/${cases.length} 正确，失败 ${bad}，平均 ${(total / cases.length).toFixed(0)}ms，最坏 ${worst}ms，平均解长 ${(len / cases.length).toFixed(1)} 步`);
