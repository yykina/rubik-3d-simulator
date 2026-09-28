const C = require('../cube-core.js');
const I = C.Solver._internals;
const geo = C.solvedState();
const pack = I.solvedPack();
for (const name of ['R2', "D'"]) { C.applyTurn(geo, name); I.applyPack(pack, name); }
const d = C.TURN_DATA.get("D'");
console.log("D' mat =", JSON.stringify(d.mat), ' 编码 =', I.pack(d.mat));
for (const i of [0, 3, 6]) {
  console.log('位置', i, C.CUBIES[i].kind, 'geo', JSON.stringify(geo.ori[i]), 'pack', JSON.stringify(I.unpack(pack.ori[i])));
}
// 手工：从来源位置用 compose 推
const srcMap = {};
for (let from = 0; from < 26; from++) if (C.isAffected(from, C.TURN_BY_NAME.get("D'"))) srcMap[d.posMap[from]] = from;
for (const i of [0, 3, 6]) {
  const from = srcMap[i];
  if (from === undefined) { console.log('位置', i, '不受影响'); continue; }
  const src = geo.ori[from];
  console.log('位置', i, '来源', from, '来源 geo', JSON.stringify(src), '来源编码', I.pack(src),
    ' compose =', I.compose(I.pack(d.mat), I.pack(src)), ' unpack =', JSON.stringify(I.unpack(I.compose(I.pack(d.mat), I.pack(src)))));
}
