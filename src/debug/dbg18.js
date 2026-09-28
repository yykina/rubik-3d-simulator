const C = require('../cube-core.js');
C.Solver.build(() => {});
const I = C.Solver._internals;
I.buildMoveTables();
const r = C.solvedState(); C.applyTurn(r, 'R');
const co = C.readCornerOri(r), eo = C.readEdgeFlip(r);
let tw = 0; for (let i = 0; i < 7; i++) tw = tw * 3 + co[i];
let fl = 0; for (let i = 0; i < 11; i++) fl = fl * 2 + eo[i];
const sl = I.maskToIdx(C.readSliceMask(r));
console.log('R 坐标:', tw, fl, sl);
console.log('还原态 slice mask:', C.readSliceMask(C.solvedState()).toString(2).padStart(12,'0'), '=> idx', I.maskToIdx(C.readSliceMask(C.solvedState())));
for (let mi = 0; mi < 18; mi++) {
  const n = I.moveTables.p1(tw, fl, sl, mi);
  const isGoal = n[0] === 0 && n[1] === 0 && n[2] === 0;
  console.log(`  ${C.PHASE1_MOVES[mi].padEnd(3)} -> ${JSON.stringify(n)}  D1=${I.distTwistSlice[n[0]*495+n[2]]} D2=${I.distFlipSlice[n[1]*495+n[2]]}${isGoal ? '   <<< 到达 G1' : ''}`);
}
