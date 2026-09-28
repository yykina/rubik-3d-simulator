const C = require('./load-tables.js')();
const I = C.Solver._internals;
const S = I.solvedPack();
console.log('还原态 key(D1) =', I.twistOf(S)*495 + I.sliceOf(S));
// 从还原态走一步 R，看 key 与表中距离
for (const m of ['R','U','F']) {
  const st = I.applyPack(I.clonePack(S), m);
  const k1 = I.twistOf(st)*495 + I.sliceOf(st), k2 = I.flipOf(st)*495 + I.sliceOf(st);
  console.log(`${m}: D1 key=${k1} dist=${I.distTwistSlice[k1]} | D2 key=${k2} dist=${I.distFlipSlice[k2]}`);
}
// 反向：谁的距离是 1？枚举所有 key 找 dist===1 的，解码回状态看是否正确
let found = [];
for (let tw = 0; tw < 2187 && found.length < 3; tw++) {
  for (let sl = 0; sl < 495; sl++) {
    if (I.distTwistSlice[tw*495+sl] === 1) { found.push([tw, sl]); if (found.length>=3) break; }
  }
}
console.log('dist===1 的 (twist,slice) 样本:', JSON.stringify(found));
for (const [tw, sl] of found) {
  console.log(`   tw=${tw} sl=${sl} → 该状态离还原态是否真的 1 步？`);
}
