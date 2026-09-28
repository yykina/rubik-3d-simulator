const C = require('../cube-core.js');
let t0 = Date.now();
C.Solver.build(() => {});
console.log('build:', ((Date.now()-t0)/1000).toFixed(1), 's');
const I = C.Solver._internals;
const cnt = (a) => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== 255) n++; return n; };
console.log('填充:', {
  twSlice: cnt(I.distTwistSlice), flSlice: cnt(I.distFlipSlice),
  spCp: cnt(I.distSpCp), spEp: cnt(I.distSpEp),
});
const run = (str) => { const s = C.solvedState(); C.applyMoves(s, str.trim().split(/\s+/)); return s; };
for (const scr of ['R', "R U R' U'", "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2"]) {
  const s = run(scr);
  const t = Date.now();
  try {
    const sol = C.Solver.solve(s);
    const chk = C.cloneState(s); C.applyMoves(chk, sol);
    console.log(`"${scr}"\n   -> ${sol.join(' ')}  (${sol.length} 步, ${Date.now()-t}ms, 还原=${C.isSolved(chk)})`);
  } catch (e) { console.log(`"${scr}" 失败: ${e.message} (${Date.now()-t}ms)`); }
}
