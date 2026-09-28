const C = require('../cube-core.js');
// 闭环检查：co/flip 索引 → 矩阵 → 索引
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function frameFrom(v){const d=v[1]!==0?[1,0,0]:[0,1,0];const u=cross(d,v);return [u[0],v[0],d[0],u[1],v[1],d[1],u[2],v[2],d[2]];}
const valFromVec=v=>v[1]!==0?0:(v[0]!==0?(v[0]>0?1:2):(v[2]>0?2:1));
const flipFromVec=v=>v[1]!==0?0:1;
let ok=true;
for(let i=0;i<8;i++){
  const home=C.CUBIES[C.POS_OF_CORNER_SLOT[i]].home;
  for(let val=0;val<3;val++){
    const ax=val===0?1:val===1?0:2;
    const v=[0,0,0]; v[ax]=home[ax]>=0?1:-1;
    const back=valFromVec([frameFrom(v)[1],frameFrom(v)[4],frameFrom(v)[7]]);
    if(back!==val){ console.log('corner 闭环失败',i,val,back); ok=false; }
  }
}
for(let i=0;i<12;i++){
  const home=C.CUBIES[C.POS_OF_EDGE_SLOT[i]].home;
  for(const val of [0,1]){
    const v = val===0?[0,home[1]>=0?1:-1,0]:[home[0]>=0?1:-1,0,0];
    const back=flipFromVec([frameFrom(v)[1],frameFrom(v)[4],frameFrom(v)[7]]);
    if(back!==val){ console.log('edge 闭环失败',i,val,back); ok=false; }
  }
}
console.log('闭环检查', ok?'通过':'失败');
