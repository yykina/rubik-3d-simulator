const C = require('../cube-core.js');
C.Solver.build(() => {});
const I = C.Solver._internals;
I.buildMoveTables();
// 几何坐标读取（与 Solver 内部同名函数应一致）
const s = C.solvedState();
const geoCoords = (st) => {
  const co = C.readCornerOri(st), eo = C.readEdgeFlip(st);
  let tw = 0; for (let i = 0; i < 7; i++) tw = tw * 3 + co[i];
  let fl = 0; for (let i = 0; i < 11; i++) fl = fl * 2 + eo[i];
  return { tw, fl, sl: I.maskToIdx(C.readSliceMask(st)) };
};
let cur = { tw: 0, fl: 0, sl: I.maskToIdx(C.readSliceMask(s)) };
let bad = 0;
const MV = C.PHASE1_MOVES;
for (let step = 0; step < 40; step++) {
  const mi = (Math.random() * 18) | 0, name = MV[mi];
  const g = C.cloneState(s);
  // 用几何推进 40 步中的每一步，需要维护一个真实状态
  bad && 0;
  const geo = geoCoords(s);
  const nx = I.moveTables.p1(geo.tw, geo.fl, geo.sl, mi);
  C.applyTurn(s, name);
  const g2 = geoCoords(s);
  if (nx[0] !== g2.tw || nx[1] !== g2.fl || nx[2] !== g2.sl) {
    if (++bad < 4) console.log('P1 不一致', name, 'geo', JSON.stringify(g2), 'tab', JSON.stringify(nx));
  }
}
console.log('P1 坐标转移一致性:', bad === 0 ? '通过' : bad + ' 处不一致');
// 单步 R 的坐标与启发值
const r = C.solvedState(); C.applyTurn(r, 'R');
const c = geoCoords(r);
const h = Math.max(I.distTwistSlice[c.tw * 495 + c.sl], I.distFlipSlice[c.fl * 495 + c.sl]);
console.log('R 坐标:', JSON.stringify(c), '启发值 h =', h);
console.log('distTwistSlice[tw*495+sl] =', I.distTwistSlice[c.tw * 495 + c.sl], 'distFlipSlice =', I.distFlipSlice[c.fl * 495 + c.sl]);
