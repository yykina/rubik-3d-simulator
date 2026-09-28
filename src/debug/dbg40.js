const C = require('../cube-core.js');
const I = C.Solver._internals;
// 1) 编解码往返：全部 24 种旋转
const seen = new Set(); const stack = [C.IDENTITY.slice()]; seen.add(C.IDENTITY.join(','));
const rot = (ax) => ax === 0 ? [1,0,0,0,0,1,0,-1,0] : ax === 1 ? [0,0,-1,0,1,0,1,0,0] : [0,1,0,-1,0,0,0,0,1];
while (stack.length) {
  const m = stack.pop();
  for (let ax = 0; ax < 3; ax++) {
    const n = C.mul(rot(ax), m); const k = n.join(',');
    if (!seen.has(k)) { seen.add(k); stack.push(n); }
  }
}
let bad = 0;
for (const k of seen) {
  const m = k.split(',').map(Number);
  if (I.unpack(I.pack(m)).join(',') !== k) bad++;
}
console.log('旋转编解码往返:', bad === 0 ? `通过 (${seen.size} 个)` : '失败 ' + bad);
// 2) compose 与 mul 同构
let bad2 = 0;
const arr = [...seen].map(k => k.split(',').map(Number));
for (let i = 0; i < arr.length; i++) for (let j = 0; j < arr.length; j++) {
  const viaMul = C.mul(arr[i], arr[j]).join(',');
  const viaCompose = I.unpack(I.compose(I.pack(arr[i]), I.pack(arr[j]))).join(',');
  if (viaMul !== viaCompose) { if (bad2++ < 2) console.log('compose 不一致', viaMul, viaCompose); }
}
console.log('compose vs mul:', bad2 === 0 ? `通过 (${arr.length * arr.length} 组)` : '失败 ' + bad2);
// 3) applyPack vs 几何
const geo = C.solvedState(); const pack = I.solvedPack();
const faces = ['U','D','L','R','F','B'], sufs = ['','2',"'"], rnd = n => (Math.random()*n)|0;
const snap = x => [I.twistOf(x), I.flipOf(x), I.sliceOf(x), I.cpOf(x), I.epOf(x), I.spOf(x)];
let bad3 = 0;
for (let i = 0; i < 300; i++) {
  const name = faces[rnd(6)] + sufs[rnd(3)];
  C.applyTurn(geo, name); I.applyPack(pack, name);
  const a = { perm: geo.perm.slice(), ori: geo.ori.map(m => I.pack(m)) };
  if (snap(a).join() !== snap(pack).join()) bad3++;
}
console.log('applyPack vs 几何:', bad3 === 0 ? '300 步一致 ✅' : '不一致 ' + bad3);
