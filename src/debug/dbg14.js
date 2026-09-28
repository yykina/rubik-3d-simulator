const C = require('../cube-core.js');
let t0 = Date.now();
C.Solver.build(() => {});
console.log('build:', ((Date.now()-t0)/1000).toFixed(1), 's');
const d = C.Solver._internals;
console.log('tables:', {
  twistSlice: d.distTwistSlice.length, flipSlice: d.distFlipSlice.length,
  spCp: d.distSpCp.length, spEp: d.distSpEp.length,
});
// 统计已填充的条目数（255 = 未访问）
const cnt = (a) => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== 255) n++; return n; };
console.log('填充条目:', {
  twistSlice: cnt(d.distTwistSlice), flipSlice: cnt(d.distFlipSlice),
  spCp: cnt(d.distSpCp), spEp: cnt(d.distSpEp),
});
// 求解单个 R
const s = C.solvedState(); C.applyMoves(s, ['R']);
console.log('R 之后 isSolved?', C.isSolved(s));
try {
  const sol = C.Solver.solve(s);
  console.log('R 的解:', sol.join(' '));
} catch (e) { console.log('求解失败:', e.message); }
