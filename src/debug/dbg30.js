const C = require('./load-tables.js')();
const I = C.Solver._internals;
const S = I.solvedPack();
const SOLVED_SLICE = I.sliceOf(S);
console.log('还原态: twist', I.twistOf(S), 'flip', I.flipOf(S), 'slice', SOLVED_SLICE);
const s = C.solvedState(); C.applyTurn(s, 'R');
const st = { perm: s.perm.slice(), ori: s.ori.map(m => I.pack(m)) };
const tw = I.twistOf(st), fl = I.flipOf(st), sl = I.sliceOf(st);
console.log('R: tw', tw, 'fl', fl, 'sl', sl);
console.log('  D1 =', I.distTwistSlice[tw*495+sl], ' D2 =', I.distFlipSlice[fl*495+sl]);
// 一步解后的坐标
const one = I.applyPack(I.clonePack(st), 'R');
console.log('R 之后: tw', I.twistOf(one), 'fl', I.flipOf(one), 'sl', I.sliceOf(one));
console.log('  D1 =', I.distTwistSlice[I.twistOf(one)*495+I.sliceOf(one)], ' D2 =', I.distFlipSlice[I.flipOf(one)*495+I.sliceOf(one)]);
// 表的分布
const hist = new Map();
for (let i = 0; i < I.distTwistSlice.length; i++) { const v = I.distTwistSlice[i]; hist.set(v, (hist.get(v)||0)+1); }
console.log('distTwistSlice 分布(前几项):', [...hist.entries()].sort((a,b)=>a[0]-b[0]).slice(0,6));
