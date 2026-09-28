const C = require('./load-tables.js')();
const I = C.Solver._internals;
const cnt = (a) => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] === 255) n++; return n; };
let mx1=0,un=0; for(let i=0;i<I.distP1.length;i++){const v=I.distP1[i]; if(v===255)un++; else if(v>mx1)mx1=v;} console.log('阶段一表: 未访问',un,'最大距离',mx1);
const faces = ['U','D','L','R','F','B'], sufs = ['','2',"'"];
function scramble(n) { const out = []; let last=''; while (out.length < n) { const f = faces[(Math.random()*6)|0]; if (f===last) continue; last=f; out.push(f+sufs[(Math.random()*3)|0]); } return out; }
let ok = 0, tm = 0, mx = 0, mms = 0, N = 50, worst = 0;
for (let i = 0; i < N; i++) {
  const ms = scramble(25);
  const s = C.solvedState(); C.applyMoves(s, ms);
  const t = Date.now();
  let sol;
  try { sol = C.Solver.solve(s); } catch (e) { console.log('抛错', e.message); continue; }
  const dt = Date.now() - t; mms = Math.max(mms, dt); mx = Math.max(mx, sol.length); tm += sol.length;
  worst = Math.max(worst, dt);
  const chk = C.cloneState(s); C.applyMoves(chk, sol);
  if (C.isSolved(chk)) ok++; else console.log('解不对:', ms.join(' '));
}
console.log(`${ok}/${N} 正确；平均 ${(tm/N).toFixed(1)} 步，最长 ${mx} 步，单次最大 ${mms}ms`);
