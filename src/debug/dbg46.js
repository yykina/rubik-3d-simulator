const C = require('./load-tables.js')();
const I = C.Solver._internals;
const seq = "L' R F' R F' U L2 B' D2 F D' F' R U' D' R' D' R' F' L U D2 U' D2 R".trim().split(/\s+/);
const state = C.solvedState(); C.applyMoves(state, seq);
const start = { perm: state.perm.slice(), ori: state.ori.map((m) => I.pack(m)) };
const first = C.Solver.phase1(start);
const pm = I.clonePack(start); for (const m of first) I.applyPack(pm, m);
const second = C.Solver.phase2(pm);
const sol = first.concat(second);
const chk = C.cloneState(state); C.applyMoves(chk, sol);
console.log('isSolved =', C.isSolved(chk));
// 用几何坐标判断
const gg = C.solvedState();
console.log('几何目标判定: twist', I.twistOf({perm:chk.perm.slice(),ori:chk.ori.map(m=>I.pack(m))}),
  'cp', I.cpOf({perm:chk.perm.slice(),ori:chk.ori.map(m=>I.pack(m))}),
  'ep', I.epOf({perm:chk.perm.slice(),ori:chk.ori.map(m=>I.pack(m))}),
  'sp', I.spOf({perm:chk.perm.slice(),ori:chk.ori.map(m=>I.pack(m))}));
// 哪些块没归位
for (let i = 0; i < 26; i++) {
  const okPerm = chk.perm[i] === i;
  const okOri = chk.ori[i].join(',') === C.IDENTITY.join(',');
  if (!okPerm || !okOri) console.log('  未归位 @', i, C.CUBIES[i].kind, C.CUBIES[i].home, 'perm', chk.perm[i], 'ori', JSON.stringify(chk.ori[i]), okPerm ? '' : '(位置)', okOri ? '' : '(朝向)');
}
