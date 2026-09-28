const C = require('./load-tables.js')();
const I = C.Solver._internals;
const cnt = (a) => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] === 255) n++; return n; };
console.log('未访问条目:', { twSlice: cnt(I.distTwistSlice), flSlice: cnt(I.distFlipSlice) });
const faces = ['U','D','L','R','F','B'], sufs = ['','2',"'"];
function scramble(n) {
  const out = []; let last = '';
  while (out.length < n) { const f = faces[(Math.random()*6)|0]; if (f === last) continue; last = f; out.push(f + sufs[(Math.random()*3)|0]); }
  return out;
}
let ok = 0, totalMoves = 0, maxMoves = 0, maxMs = 0, N = 30;
for (let i = 0; i < N; i++) {
  const ms = scramble(25);
  const s = C.solvedState(); C.applyMoves(s, ms);
  const t = Date.now();
  let sol;
  try { sol = C.Solver.solve(s); } catch (e) { console.log(`#${i} 抛错: ${e.message}  scramble=${ms.join(' ')}`); continue; }
  const dt = Date.now() - t;
  maxMs = Math.max(maxMs, dt); maxMoves = Math.max(maxMoves, sol.length); totalMoves += sol.length;
  const chk = C.cloneState(s); C.applyMoves(chk, sol);
  if (C.isSolved(chk)) ok++; else console.log(`#${i} 解不正确: ${sol.join(' ')}`);
}
console.log(`${ok}/${N} 正确还原；平均 ${(totalMoves/N).toFixed(1)} 步，最长 ${maxMoves} 步，单次最大 ${maxMs}ms`);
