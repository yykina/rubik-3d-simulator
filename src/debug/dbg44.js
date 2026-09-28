const C = require('./load-tables.js')();
const I = C.Solver._internals;
const SOLVED_SLICE = I.sliceOf(I.solvedPack());
const seq = "L' R F' R F' U L2 B' D2 F D' F' R U' D' R' D' R' F' L U D2 U' D2 R".trim().split(/\s+/);
const state = C.solvedState(); C.applyMoves(state, seq);
const start = { perm: state.perm.slice(), ori: state.ori.map((m) => I.pack(m)) };
const first = C.Solver.phase1(start);
console.log('phase1 =', first.join(' '));
// 压缩机推进
const pm = I.clonePack(start);
for (const m of first) I.applyPack(pm, m);
// 几何推进
const gm = C.cloneState(state);
C.applyMoves(gm, first);
const snapped = { perm: gm.perm.slice(), ori: gm.ori.map((m) => I.pack(m)) };
console.log('压缩机 G1:', I.twistOf(pm) === 0 && I.flipOf(pm) === 0 && I.sliceOf(pm) === SOLVED_SLICE);
console.log('几何   G1:', I.twistOf(snapped) === 0 && I.flipOf(snapped) === 0 && I.sliceOf(snapped) === SOLVED_SLICE);
console.log('两者坐标一致:', [I.twistOf(pm), I.flipOf(pm), I.sliceOf(pm), I.cpOf(pm), I.epOf(pm), I.spOf(pm)].join() ===
  [I.twistOf(snapped), I.flipOf(snapped), I.sliceOf(snapped), I.cpOf(snapped), I.epOf(snapped), I.spOf(snapped)].join());
const second = C.Solver.phase2(pm);
console.log('phase2 =', second.join(' '));
const pm2 = I.clonePack(pm); for (const m of second) I.applyPack(pm2, m);
console.log('压缩机解完:', I.twistOf(pm2) === 0 && I.flipOf(pm2) === 0 && I.cpOf(pm2) === 0 && I.epOf(pm2) === 0 && I.spOf(pm2) === 0);
const gm2 = C.cloneState(gm); C.applyMoves(gm2, second);
console.log('几何解完:', C.isSolved(gm2));
