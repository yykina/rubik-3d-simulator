const C = require('../cube-core.js');
const I = C.Solver._internals;
const geo = C.solvedState();
const pack = I.solvedPack();
const faces = ['U','D','L','R','F','B'], sufs = ['','2',"'"], rnd = (n) => (Math.random()*n)|0;
const snap = (x) => [I.twistOf(x), I.flipOf(x), I.sliceOf(x), I.cpOf(x), I.epOf(x), I.spOf(x)];
for (let i = 0; i < 60; i++) {
  const name = faces[rnd(6)] + sufs[rnd(3)];
  C.applyTurn(geo, name); I.applyPack(pack, name);
  // 把两个状态都归一化成 packed 再比较坐标
  const a = { perm: geo.perm.slice(), ori: geo.ori.map((m) => I.pack(m)) };
  const ca = snap(a), cb = snap(pack);
  console.log(i, name.padEnd(3), ca.join(',') === cb.join(',') ? 'ok' : ('MISMATCH geo=' + ca.join(',') + ' pack=' + cb.join(',')));
  if (ca.join(',') !== cb.join(',')) break;
}
