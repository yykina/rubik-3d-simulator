/*
 * dbg39.js — 精确定位 applyPack 与 applyTurn 的分歧
 * 关键：必须在「动作执行前」取来源位置的矩阵，我之前的脚本取的是执行后的。
 */
const C = require('../cube-core.js');
const I = C.Solver._internals;

const geo = C.solvedState();
const pack = I.solvedPack();
C.applyTurn(geo, 'R2'); I.applyPack(pack, 'R2');

const name = "D'";
const before = { perm: geo.perm.slice(), ori: geo.ori.map((m) => m.slice()) };
C.applyTurn(geo, name);
I.applyPack(pack, name);

const d = C.TURN_DATA.get(name);
const src = {};
for (let from = 0; from < 26; from++) if (C.isAffected(from, C.TURN_BY_NAME.get(name))) src[d.posMap[from]] = from;

let bad = 0;
for (const to of [0, 3, 6]) {
  const from = src[to];
  const srcMat = before.ori[from];
  const expectByMul = C.mul(d.mat, srcMat);
  const byCompose = I.unpack(I.compose(I.pack(d.mat), I.pack(srcMat)));
  const actual = geo.ori[to];
  const p = I.unpack(pack.ori[to]);
  const okMul = expectByMul.join(',') === actual.join(',');
  const okComp = byCompose.join(',') === actual.join(',');
  const okPack = p.join(',') === actual.join(',');
  console.log(`to=${to} from=${from}`);
  console.log(`   srcMat(前)      ${JSON.stringify(srcMat)}`);
  console.log(`   mul(d.mat,src)  ${JSON.stringify(expectByMul)}  ==旁路实际? ${okMul}`);
  console.log(`   compose解码     ${JSON.stringify(byCompose)}  ==旁路实际? ${okComp}`);
  console.log(`   applyPack结果   ${JSON.stringify(p)}  ==旁路实际? ${okPack}`);
  if (!okMul || !okComp || !okPack) bad++;
}
console.log(bad === 0 ? '本步完全一致' : `本步有 ${bad} 处不一致`);
