const C = require('../cube-core.js');
const t0 = Date.now();
let lastPct = -1, lastLabel = '';
C.Solver.build((p, label) => {
  const pct = Math.floor(p * 100);
  if (label !== lastLabel) { lastLabel = label; lastPct = -1; }
  if (pct >= lastPct + 10) { lastPct = pct; console.log(`  ${label} ${pct}%  (${((Date.now()-t0)/1000).toFixed(1)}s)`); }
});
console.log('build 总耗时:', ((Date.now()-t0)/1000).toFixed(1), 's');
const I = C.Solver._internals;
const cnt = (a) => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== 255) n++; return n; };
console.log('填充:', { twSlice: cnt(I.distTwistSlice), flSlice: cnt(I.distFlipSlice), spCp: cnt(I.distSpCp), spEp: cnt(I.distSpEp) });
