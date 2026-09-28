const C = require('./load-tables.js')();
const I = C.Solver._internals;
const seq = "L' R F' R F' U L2 B' D2 F D' F' R U' D' R' D' R' F' L U D2 U' D2 R".trim().split(/\s+/);
const geo = C.solvedState();
const pack = I.solvedPack();
const snap = (x) => [I.twistOf(x), I.flipOf(x), I.sliceOf(x), I.cpOf(x), I.epOf(x), I.spOf(x)];
for (let i = 0; i < seq.length; i++) {
  C.applyTurn(geo, seq[i]); I.applyPack(pack, seq[i]);
  const a = { perm: geo.perm.slice(), ori: geo.ori.map((m) => I.pack(m)) };
  const ca = snap(a), cb = snap(pack);
  if (ca.join(',') !== cb.join(',')) {
    console.log(`第 ${i} 步 ${seq[i]} 分叉`);
    console.log('  geo ', ca.join(','));
    console.log('  pack', cb.join(','));
    // 找出第一个不同的位置
    for (let k = 0; k < 26; k++) {
      if (geo.perm[k] !== pack.perm[k]) console.log('   perm 差异 @', k, C.CUBIES[k].home, geo.perm[k], pack.perm[k]);
      const gm = geo.ori[k].join(','), pm = I.unpack(pack.ori[k]).join(',');
      if (gm !== pm) console.log('   ori 差异 @', k, C.CUBIES[k].kind, C.CUBIES[k].home, gm, pm);
    }
    break;
  }
}
console.log('对比结束');
