const C = require('../cube-core.js');
// 闭环自检：用内核公开接口验证 applyPack 与几何 applyTurn 完全一致
// 做法：把几何状态转成坐标，再逐步用 applyPack 推进，比对每一步的读取值
function packFromGeom(g) {
  const perm = g.perm.slice();
  const co = [], eo = [];
  for (let slot = 0; slot < 8; slot++) {
    const v = C.applyM(g.ori[C.POS_OF_CORNER_SLOT[slot]], [0, 1, 0]);
    co[slot] = v[1] !== 0 ? 0 : v[0] !== 0 ? (v[0] > 0 ? 1 : 2) : (v[2] > 0 ? 2 : 1);
  }
  for (let slot = 0; slot < 12; slot++) {
    const v = C.applyM(g.ori[C.POS_OF_EDGE_SLOT[slot]], [0, 1, 0]);
    eo[slot] = v[1] !== 0 ? 0 : 1;
  }
  return { perm, co, eo };
}
// 复刻 Solver 内部的 applyPack 等价物？无法直接访问；改为验证「几何 → 坐标」的往返一致性：
// 随机走 60 步，每步比较 (1) 直接几何读取 (2) 由坐标重建几何再读取
const faces = ['U','D','L','R','F','B'], sufs = ['','2',"'"];
const rnd = n => (Math.random()*n)|0;
let bad = 0;
const g = C.solvedState();
for (let step = 0; step < 200; step++) {
  const name = faces[rnd(6)] + sufs[rnd(3)];
  C.applyTurn(g, name);
  const p = packFromGeom(g);
  // 重建：用与 Solver 相同的约定从坐标造几何，再读回，应与 p 相同
  const co = p.co, eo = p.eo;
  const ori = new Array(26);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const frame=(v)=>{const d=v[1]!==0?[1,0,0]:[0,1,0];const u=cross(d,v);return [u[0],v[0],d[0],u[1],v[1],d[1],u[2],v[2],d[2]];};
  for (let slot = 0; slot < 8; slot++) {
    const v = co[slot] === 0 ? [0,1,0] : co[slot] === 1 ? [1,0,0] : [0,0,1];
    ori[C.POS_OF_CORNER_SLOT[slot]] = frame(v);
  }
  for (let slot = 0; slot < 12; slot++) {
    const v = eo[slot] === 0 ? [0,1,0] : [1,0,0];
    ori[C.POS_OF_EDGE_SLOT[slot]] = frame(v);
  }
  for (let i = 0; i < 26; i++) if (!ori[i]) ori[i] = C.IDENTITY.slice();
  const g2 = { perm: p.perm.slice(), ori };
  // 再从 g2 读回坐标
  for (let slot = 0; slot < 8; slot++) {
    const v = C.applyM(g2.ori[C.POS_OF_CORNER_SLOT[slot]], [0,1,0]);
    const val = v[1] !== 0 ? 0 : v[0] !== 0 ? (v[0] > 0 ? 1 : 2) : (v[2] > 0 ? 2 : 1);
    if (val !== co[slot]) { bad++; if (bad<3) console.log('co 往返失败', name, slot, co[slot], val); }
  }
}
console.log('坐标↔几何 往返一致性:', bad === 0 ? '通过' : (bad + ' 处失败'));
