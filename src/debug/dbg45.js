const C = require('./load-tables.js')();
const I = C.Solver._internals;
const SOLVED_SLICE = I.sliceOf(I.solvedPack());
const seq = "L' R F' R F' U L2 B' D2 F D' F' R U' D' R' D' R' F' L U D2 U' D2 R".trim().split(/\s+/);
const state = C.solvedState(); C.applyMoves(state, seq);
const start = { perm: state.perm.slice(), ori: state.ori.map((m) => I.pack(m)) };
const first = C.Solver.phase1(start);
const pm = I.clonePack(start); for (const m of first) I.applyPack(pm, m);
const second = C.Solver.phase2(pm);
// 从同一个 G1 状态出发，两个机器同步走 phase2
const gm = C.cloneState(state); C.applyMoves(gm, first);
const pmc = I.clonePack(pm);
const snap = (x) => [I.twistOf(x), I.flipOf(x), I.sliceOf(x), I.cpOf(x), I.epOf(x), I.spOf(x)];
for (let i = 0; i < second.length; i++) {
  C.applyTurn(gm, second[i]); I.applyPack(pmc, second[i]);
  const a = { perm: gm.perm.slice(), ori: gm.ori.map((m) => I.pack(m)) };
  const ca = snap(a), cb = snap(pmc);
  if (ca.join(',') !== cb.join(',')) {
    console.log(`分叉于 phase2 第 ${i} 步 ${second[i]}`);
    console.log('  geo ', ca.join(','));
    console.log('  pack', cb.join(','));
    for (let k = 0; k < 26; k++) {
      if (gm.perm[k] !== pmc.perm[k]) console.log('   perm @', k, C.CUBIES[k].home, gm.perm[k], pmc.perm[k]);
      const g = gm.ori[k].join(','), p = I.unpack(pmc.ori[k]).join(',');
      if (g !== p) console.log('   ori @', k, C.CUBIES[k].kind, C.CUBIES[k].home, g, p);
    }
    break;
  }
  if (i === second.length - 1) console.log('phase2 全程两机器一致');
}
