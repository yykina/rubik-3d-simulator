const C = require('./load-tables.js')();
const I = C.Solver._internals;
// 同一初始还原态，分别用几何 applyTurn 和压缩 applyPack 走 200 步，逐坐标比较
const geo = C.solvedState();
const pack = I.solvedPack();
const faces = ['U','D','L','R','F','B'], sufs = ['','2',"'"];
const rnd = (n) => (Math.random()*n)|0;
const packFromGeom = (g) => ({ perm: g.perm.slice(), ori: g.ori.map((m) => I.pack(m)) });
let bad = 0;
for (let step = 0; step < 200; step++) {
  const name = faces[rnd(6)] + sufs[rnd(3)];
  C.applyTurn(geo, name);
  I.applyPack(pack, name);
  const a = packFromGeom(geo), b = pack;
  const ca = [I.twistOf(a), I.flipOf(a), I.sliceOf(a), I.cpOf(a), I.epOf(a), I.spOf(a)];
  const cb = [I.twistOf(b), I.flipOf(b), I.sliceOf(b), I.cpOf(b), I.epOf(b), I.spOf(b)];
  if (ca.join() !== cb.join()) {
    if (++bad < 4) console.log('步', step, name, 'geo', ca.join(','), 'pack', cb.join(','));
  }
}
console.log('applyPack vs 几何:', bad === 0 ? '200 步一致 ✅' : bad + ' 处不一致 ❌');
