const C = require('./load-tables.js')();
const I = C.Solver._internals;
const SOLVED_SLICE = I.sliceOf(I.solvedPack());
const goal = (st) => I.twistOf(st) === 0 && I.flipOf(st) === 0 && I.sliceOf(st) === SOLVED_SLICE;
const h = (st) => Math.max(
  I.distTwistSlice[I.twistOf(st)*495 + I.sliceOf(st)],
  I.distFlipSlice[I.flipOf(st)*495 + I.sliceOf(st)]);
const faces = ['U','D','L','R','F','B'], sufs = ['','2',"'"];
const geo = C.solvedState();
let n255 = 0, nZeroNotGoal = 0, sample = 0;
for (let i = 0; i < 4000; i++) {
  const name = faces[(Math.random()*6)|0] + sufs[(Math.random()*3)|0];
  C.applyTurn(geo, name);
  if (i % 7 !== 0) continue;
  sample++;
  const st = { perm: geo.perm.slice(), ori: geo.ori.map(m => I.pack(m)) };
  const hv = h(st);
  if (hv === 255) n255++;
  if (hv === 0 && !goal(st)) { if (nZeroNotGoal++ < 3) console.log('  h=0 但非目标: tw', I.twistOf(st), 'fl', I.flipOf(st), 'sl', I.sliceOf(st)); }
}
console.log('样本', sample, ' h=255(不可达):', n255, ' h=0 却非目标:', nZeroNotGoal);
