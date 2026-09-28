const C = require('../cube-core.js');
const t0 = Date.now();
C.Solver.build(() => {});
console.log('build:', ((Date.now()-t0)/1000).toFixed(1), 's');
const run = (str) => { const s = C.solvedState(); C.applyMoves(s, str.trim().split(/\s+/)); return s; };
for (const scr of ['R', "R U", "R U R' U'"]) {
  const s = run(scr);
  const t = Date.now();
  try {
    const sol = C.Solver.solve(s);
    const chk = C.cloneState(s); C.applyMoves(chk, sol);
    console.log(`"${scr}" -> ${sol.join(' ')} (${sol.length} 步, ${Date.now()-t}ms, 还原=${C.isSolved(chk)})`);
  } catch (e) { console.log(`"${scr}" 失败: ${e.message} (${Date.now()-t}ms)`); }
}
