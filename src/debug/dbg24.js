const C = require('../cube-core.js');
const t0 = Date.now();
C.Solver.build(() => {});
console.log('build:', ((Date.now()-t0)/1000).toFixed(1), 's');
const run = (str) => { const s = C.solvedState(); C.applyMoves(s, str.trim().split(/\s+/)); return s; };
const cases = ['R', "R U", "R U R' U'", "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2"];
for (const scr of cases) {
  const s = run(scr);
  const t = Date.now();
  try {
    const sol = C.Solver.solve(s);
    const chk = C.cloneState(s); C.applyMoves(chk, sol);
    console.log(`"${scr}"\n   -> ${sol.join(' ')}  (${sol.length} 步, ${Date.now()-t}ms, 还原=${C.isSolved(chk)})`);
  } catch (e) { console.log(`"${scr}" 失败: ${e.message}`); }
}
