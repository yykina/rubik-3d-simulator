const C = require('../cube-core.js');
C.Solver.build(() => {});
const I = C.Solver._internals;
I.buildMoveTables();
const { distTwistSlice: D1, distFlipSlice: D2 } = I;
// 真实坐标读取
const coordsOf = (g) => {
  const co = C.readCornerOri(g), eo = C.readEdgeFlip(g);
  let tw = 0; for (let i = 0; i < 7; i++) tw = tw * 3 + co[i];
  let fl = 0; for (let i = 0; i < 11; i++) fl = fl * 2 + eo[i];
  return { tw, fl, sl: I.maskToIdx(C.readSliceMask(g)) };
};
const r = C.solvedState(); C.applyTurn(r, 'R');
const c = coordsOf(r);
console.log('R 真实坐标', JSON.stringify(c));
// 单步转移是否到 (0,0,0)
for (let mi = 0; mi < 18; mi++) {
  const n = I.moveTables.p1(c.tw, c.fl, c.sl, mi);
  if (n[0] === 0 && n[1] === 0 && n[2] === 0) console.log('  一步到位:', C.PHASE1_MOVES[mi]);
}
// 暴力 BFS：从 R 的坐标出发，逐层用 moveTables.p1 展开，看能否到 (0,0,0)，以及距离表是否一致
const key = (a) => a[0] * 495 + a[2];
const key2 = (a) => a[1] * 495 + a[2];
console.log('D1[R]=', D1[c.tw * 495 + c.sl], 'D2[R]=', D2[c.fl * 495 + c.sl]);
console.log('D1[0]=', D1[0], 'D2[0]=', D2[0]);
// 检查：从 R 出发随机走 6 步，比较 D1 的下降情况
let cur = [c.tw, c.fl, c.sl];
let bad = 0;
for (let step = 0; step < 6; step++) {
  const mi = (Math.random() * 18) | 0;
  const before = Math.max(D1[cur[0] * 495 + cur[2]], D2[cur[1] * 495 + cur[2]]);
  cur = I.moveTables.p1(cur[0], cur[1], cur[2], mi);
  const after = Math.max(D1[cur[0] * 495 + cur[2]], D2[cur[1] * 495 + cur[2]]);
  if (after > before + 1) { bad++; console.log('  距离跳变异常', before, '->', after, C.PHASE1_MOVES[mi]); }
}
console.log('距离单调性检查:', bad === 0 ? '正常' : '异常 ' + bad);
