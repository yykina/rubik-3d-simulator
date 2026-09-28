const C = require('../cube-core.js');
const I = C.Solver._internals;
console.log('规范状态自检:', I.selfCheck().length === 0 ? '通过' : I.selfCheck());
// 坐标转移表：canonical 前进 vs 真实几何
const coordsOf = (st) => ({ tw: I.twistOf(st), fl: I.flipOf(st), sl: I.sliceOf(st) });
const packFromGeom = (g) => ({ perm: g.perm.slice(), ori: g.ori.map((m) => I.pack(m)) });
function p1Table(st, mi) {
  const c = coordsOf(st);
  const s2 = I.synthP1(c.tw, c.fl, c.sl);
  I.applyPack(s2, C.PHASE1_MOVES[mi]);
  return coordsOf(s2);
}
const faces = ['U','D','L','R','F','B'], sufs = ['','2',"'"];
const rnd = (n) => (Math.random()*n)|0;
const geo = C.solvedState();
let bad = 0, N = 300;
for (let step = 0; step < N; step++) {
  const name = faces[rnd(6)] + sufs[rnd(3)];
  C.applyTurn(geo, name);
  const pack = packFromGeom(geo);
  // 对每个动作比较「真实几何推进」与「规范状态推进」
  for (let mi = 0; mi < 18; mi++) {
    const realNext = (() => { const p2 = { perm: pack.perm.slice(), ori: pack.ori.slice() }; I.applyPack(p2, C.PHASE1_MOVES[mi]); return coordsOf(p2); })();
    const tabNext = p1Table(pack, mi);
    if (realNext.tw !== tabNext.tw || realNext.fl !== tabNext.fl || realNext.sl !== tabNext.sl) {
      if (++bad < 4) console.log('步', step, name, C.PHASE1_MOVES[mi], 'real', JSON.stringify(realNext), 'canon', JSON.stringify(tabNext));
    }
  }
}
console.log('阶段一坐标转移（规范 vs 真实）:', bad === 0 ? '300×18 全部一致' : bad + ' 处不一致');
