const C = require('../cube-core.js');
console.log('build...');
const t0 = Date.now();
let last = '';
C.Solver.build((p, label) => {
  if (label !== last) { last = label; }
});
console.log('build done in', ((Date.now()-t0)/1000).toFixed(1), 's');
const I = C.Solver._internals();
const d = I;
console.log('tables:', {
  twistSlice: d.distTwistSlice.length,
  flipSlice: d.distFlipSlice.length,
  spCp: d.distSpCp.length,
  spEp: d.distSpEp.length,
});
// 单步求解
const run = str => { const s = C.solvedState(); C.applyMoves(s, str.trim().split(/\s+/)); return s; };
for (const scr of ['R', "R U R' U'", "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2"]) {
  const s = run(scr);
  const t = Date.now();
  const sol = C.Solver.solve(s);
  const chk = C.cloneState(s); C.applyMoves(chk, sol);
  console.log(`"${scr}" -> ${sol.join(' ')}  (${sol.length} 步, ${Date.now()-t}ms, 还原=${C.isSolved(chk)})`);
}
