const fs = require('fs'); const C = require('../cube-core.js');
const N = [2187*495, 2048*495, 24*40320, 24*40320];
const buf = fs.readFileSync(__dirname + '/solver-tables.bin');
let off = 0; const parts = N.map(n => { const a = new Uint8Array(buf.buffer, buf.byteOffset+off, n); off += n; return a; });
C.Solver.load({ tw: parts[0], fl: parts[1], sc: parts[2], se: parts[3] });
const I = C.Solver._internals;
// 阶段一目标：twist==0 && flip==0 && slice==494
const solvedSlice = I.sliceOf(I.solvedPack());
console.log('SOLVED_SLICE =', solvedSlice);
// R 状态：真实走 18 个动作，看目标实际需要几步
const s = C.solvedState(); C.applyTurn(s, 'R');
const st = { perm: s.perm.slice(), ori: s.ori.map(m => I.pack(m)) };
const isGoal = (x) => I.twistOf(x) === 0 && I.flipOf(x) === 0 && I.sliceOf(x) === solvedSlice;
console.log('R 状态本身是目标吗?', isGoal(st), ' h =', Math.max(I.distTwistSlice[I.twistOf(st)*495+I.sliceOf(st)], I.distFlipSlice[I.flipOf(st)*495+I.sliceOf(st)]));
let oneMove = false;
for (const m of C.PHASE1_MOVES) {
  const c = I.applyPack(I.clonePack(st), m);
  if (isGoal(c)) { console.log('  一步到目标:', m, ' 表 h =', Math.max(I.distTwistSlice[I.twistOf(c)*495+I.sliceOf(c)], I.distFlipSlice[I.flipOf(c)*495+I.sliceOf(c)])); oneMove = true; }
}
console.log('  存在一步解?', oneMove);
