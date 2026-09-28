const C = require('../cube-core.js');
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const frameOf=(v)=>{const d=v[1]!==0?[1,0,0]:[0,1,0];const u=cross(d,v);return [u[0],v[0],-d[0],u[1],v[1],-d[1],u[2],v[2],-d[2]];};
const cUD=(val)=>val===0?[0,1,0]:val===1?[1,0,0]:[0,0,1];
const eUD=(val)=>val===0?[0,1,0]:[1,0,0];
function applyPackGeom(ori, perm, name, co, eo){
  const t=C.TURN_BY_NAME.get(name), d=C.TURN_DATA.get(name);
  const nPerm=perm.slice(), nOri=ori.slice();
  const writes=[];
  for(let from=0;from<26;from++){ if(!C.isAffected(from,t)) continue; writes.push([from,d.posMap[from],d.mat]); }
  for(const [from,to,mat] of writes){
    nPerm[to]=perm[from];
    nOri[to]=C.mul(mat, ori[from]);
  }
  return {perm:nPerm, ori:nOri};
}
// 场景：连续两步，逐步比较 co
const moves=['R','U'];
let ori=new Array(26); for(let i=0;i<26;i++) ori[i]=C.IDENTITY.slice();
let perm=[...Array(26).keys()];
let co=new Array(8).fill(0), eo=new Array(12).fill(0);
const readCo=(ori)=>{const a=[];for(let s=0;s<8;s++){const v=C.applyM(ori[C.POS_OF_CORNER_SLOT[s]],[0,1,0]);
  a.push(v[1]!==0?0:(v[0]!==0?(v[0]>0?1:2):(v[2]>0?2:1)));}return a;};
// 真实几何
const geo=C.solvedState();
for(const name of moves){
  C.applyTurn(geo,name);
  // pack 版本：用 co 合成 frame 再乘
  const t=C.TURN_BY_NAME.get(name), d=C.TURN_DATA.get(name);
  const nco=co.slice(), neo=eo.slice(), nperm=perm.slice();
  const writes=[];
  for(let from=0;from<26;from++){ if(!C.isAffected(from,t)) continue; writes.push([from,d.posMap[from],d.mat]); }
  for(const [from,to,mat] of writes){
    nperm[to]=perm[from];
    const c=C.CUBIES[from];
    if(c.kind==='corner'){
      const m=C.mul(mat, frameOf(cUD(co[C.CORNER_SLOT[from]])));
      const v=[m[1],m[4],m[7]];
      nco[C.CORNER_SLOT[to]]=v[1]!==0?0:(v[0]!==0?(v[0]>0?1:2):(v[2]>0?2:1));
    } else if(c.kind==='edge'){
      const m=C.mul(mat, frameOf(eUD(eo[C.EDGE_SLOT[from]])));
      const v=[m[1],m[4],m[7]];
      neo[C.EDGE_SLOT[to]]=v[1]!==0?0:1;
    }
  }
  co=nco; eo=neo; perm=nperm;
  const geoCo=readCo(geo.ori);
  console.log(name,'几何 co=',geoCo.join(''),' pack co=',co.join(''), geoCo.join('')===co.join('')?'':'  <<< 不一致');
}

console.log('\n--- 详细对比 U 之后 ---');
const t=C.TURN_BY_NAME.get('U'), d=C.TURN_DATA.get('U');
for(const [from,to,mat] of (()=>{const w=[];for(let f=0;f<26;f++){if(!C.isAffected(f,t))continue;w.push([f,d.posMap[f],d.mat]);}return w;})()){
  const c=C.CUBIES[from];
  if(c.kind!=='corner') continue;
  const geoFrom = geo.ori[from];               // 但 geo 已经被推进过，这里只能看最终态
  console.log('from slot',C.CORNER_SLOT[from],'-> to slot',C.CORNER_SLOT[to],'piece home',JSON.stringify(c.home));
}
console.log('几何 co:', readCo(geo.ori).join(''), ' 矩阵:');
for(let s=0;s<8;s++) console.log('  slot',s, C.CORNER_NAMES[C.CORNER_SLOT[geo.perm[C.POS_OF_CORNER_SLOT[s]]]], JSON.stringify(geo.ori[C.POS_OF_CORNER_SLOT[s]]));
