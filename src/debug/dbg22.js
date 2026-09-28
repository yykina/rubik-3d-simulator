const C = require('../cube-core.js');
const I = C.Solver._internals;
// 候选规范姿态：用「槽位位置向量」作参考轴构造角块/棱块朝向矩阵
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function mkFrame(v, p){
  // col1 = v，col2 = 与 v 垂直的位置分量，col0 = col1 × col2
  const q = [p[0], p[1], p[2]];
  // 取 p 中与 v 不平行的分量组合作为 col2
  let d;
  if (v[0] !== 0) d = [0, q[1], q[2]];
  else if (v[1] !== 0) d = [q[0], 0, q[2]];
  else d = [q[0], q[1], 0];
  if (d[0]===0&&d[1]===0&&d[2]===0) d = v[0]!==0?[0,1,0]:[1,0,0];
  const n = Math.hypot(...d); d = d.map(x=>x/n);
  const u = cross(v, d);
  const m=[u[0],v[0],d[0], u[1],v[1],d[1], u[2],v[2],d[2]];
  const det=m[0]*(m[4]*m[8]-m[5]*m[7])-m[3]*(m[1]*m[8]-m[2]*m[7])+m[6]*(m[1]*m[5]-m[2]*m[4]);
  return det>0?m:[ -u[0],v[0],d[0], -u[1],v[1],d[1], -u[2],v[2],d[2]];
}
function cornerDir(val){ return val===0?[0,1,0]:val===1?[1,0,0]:[0,0,1]; }
function edgeDir(val){ return val===0?[0,1,0]:[1,0,0]; }
const readCo=(ori)=>{const a=[];for(let s=0;s<8;s++){const v=C.applyM(ori[C.POS_OF_CORNER_SLOT[s]],[0,1,0]);
  a.push(v[1]!==0?0:(v[0]!==0?(v[0]>0?1:2):(v[2]>0?2:1)));}return a;};
const readEo=(ori)=>{const a=[];for(let s=0;s<12;s++){const v=C.applyM(ori[C.POS_OF_EDGE_SLOT[s]],[0,1,0]);a.push(v[1]!==0?0:1);}return a;};
const coToTwist=(co)=>{let z=0;for(let i=0;i<7;i++)z=z*3+co[i];return z;};
const eoToFlip=(eo)=>{let z=0;for(let i=0;i<11;i++)z=z*2+eo[i];return z;};

// 从规范姿态出发，走 300 步随机，比较「规范推进」与「真实推进」
const faces=['U','D','L','R','F','B'],sufs=['','2',"'"],rnd=n=>(Math.random()*n)|0;
const geo=C.solvedState();
let canonOri=new Array(26), canonPerm=[...Array(26).keys()];
for(let i=0;i<26;i++){
  const c=C.CUBIES[i];
  if(c.kind==='corner') canonOri[i]=mkFrame(cornerDir(0), c.home);
  else if(c.kind==='edge') canonOri[i]=mkFrame(edgeDir(0), c.home);
  else canonOri[i]=C.IDENTITY.slice();
}
let bad=0;
for(let step=0;step<300;step++){
  const name=faces[rnd(6)]+sufs[rnd(3)];
  C.applyTurn(geo,name); C.applyTurn({perm:canonPerm,ori:canonOri},name);
  const aCo=readCo(geo.ori), bCo=readCo(canonOri);
  const aEo=readEo(geo.ori), bEo=readEo(canonOri);
  if(coToTwist(aCo)!==coToTwist(bCo)||eoToFlip(aEo)!==eoToFlip(bEo)){
    bad++;
    if(bad<3) console.log('步',step,name,'geo co',aCo.join(''),'canon',bCo.join(''),'| eo',aEo.join(''),bEo.join(''));
  }
}
console.log('位置向量参考轴方案:', bad===0?'300 步一致 ✅':'不一致 '+bad+' ❌');
