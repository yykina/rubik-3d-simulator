const C = require('./load-tables.js')();
const I = C.Solver._internals;
const s = C.solvedState(); C.applyTurn(s, 'R');
const st = { perm: s.perm.slice(), ori: s.ori.map(m => I.pack(m)) };
try {
  const p = C.Solver.phase1(st);
  console.log('phase1 结果:', p.join(' '));
} catch (e) { console.log('phase1 抛错:', e.message); }
