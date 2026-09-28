const C = require('../cube-core.js');
const t0 = Date.now();
C.Solver.build(() => {});
console.log('build:', ((Date.now()-t0)/1000).toFixed(1), 's');
const I = C.Solver._internals;
// 手工检查单步 R：启发值与目标判定
const s = C.solvedState(); C.applyTurn(s, 'R');
const st = { perm: s.perm.slice(), ori: s.ori.map((m) => I.pack(m)) };
console.log('R: twist=', I.twistOf(st), 'flip=', I.flipOf(st), 'slice=', I.sliceOf(st));
console.log('  h=', Math.max(
  I.distTwistSlice[I.twistOf(st) * 495 + I.sliceOf(st)],
  I.distFlipSlice[I.flipOf(st) * 495 + I.sliceOf(st)]));
const s2 = C.cloneState(s); I.applyPack(st, 'R');
console.log("走 R 之后: twist=", I.twistOf(st), "flip=", I.flipOf(st), "slice=", I.sliceOf(st));
console.log('  goal?', I.twistOf(st) === 0 && I.flipOf(st) === 0 && I.sliceOf(st) === 0);
