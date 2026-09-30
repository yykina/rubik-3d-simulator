/* 求解器正确性验证：独立面片检查 + 计时（不依赖 isSolved） */
const fs = require('fs'); const path = require('path');
const C = require('../src/cube-core.js');
const N = [2187 * 2048, 24 * 40320, 24 * 40320];
const buf = fs.readFileSync(path.join(__dirname, '..', 'src', 'debug', 'solver-tables.bin'));
let off = 4;
const parts = N.map((n) => { const a = new Uint8Array(buf.buffer, buf.byteOffset + off, n); off += n; return a; });
C.Solver.load({ p1: parts[0], sc: parts[1], se: parts[2] });

const faces = ['U','D','L','R','F','B'], sufs = ['','2',"'"], rnd = (n) => (Math.random()*n)|0;
let good = 0, total = 0, sumLen = 0, worst = 0, repaired = 0;
for (let i = 0; i < 40; i++) {
  const ms = []; let last = '';
  while (ms.length < 25) { const f = faces[rnd(6)]; if (f === last) continue; last = f; ms.push(f + sufs[rnd(3)]); }
  const st = C.solvedState(); C.applyMoves(st, ms);
  const t0 = Date.now();
  let sol;
  try { sol = C.Solver.solve(st); } catch (e) { console.log('抛错:', e.message, ms.join(' ')); continue; }
  const dt = Date.now() - t0; worst = Math.max(worst, dt);
  const chk = C.cloneState(st); C.applyMoves(chk, sol);
  const bad = C.misplacedStickers(chk);
  total++;
  if (bad === 0) { good++; sumLen += sol.length; } else { console.log('✗ 仍有', bad, '张错位贴纸:', ms.join(' ')); }
  if (sol.length > 24) repaired++;
}
console.log(`独立面片校验: ${good}/${total} 正确，平均 ${(sumLen/good).toFixed(1)} 步，最坏 ${worst}ms`);
