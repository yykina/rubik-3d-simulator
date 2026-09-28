const C = require('../cube-core.js');
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const frameOf=(v)=>{const d=v[1]!==0?[1,0,0]:[0,1,0];const u=cross(d,v);return [u[0],v[0],-d[0],u[1],v[1],-d[1],u[2],v[2],-d[2]];};
const cUD=(val)=>val===0?[0,1,0]:val===1?[1,0,0]:[0,0,1];
const eUD=(val)=>val===0?[0,1,0]:[1,0,0];

/** 打包状态 → 几何状态（与内核 toGeom 相同约定） */
function toGeom(pack){
  const ori=new Array(26);
  for(let s=0;s<8;s++) ori[C.POS_OF_CORNER_SLOT[s]]=frameOf(cUD(pack.co[s]));
  for(let s=0;s<12;s++) ori[C.POS_OF_EDGE_SLOT[s]]=frameOf(eUD(pack.eo[s]));
  for(let k=0;k<26;k++) if(!ori[k]) ori[k]=C.IDENTITY.slice();
  return {perm:pack.perm.slice(),ori};
}
/** 几何状态 → 打包状态 */
function fromGeom(g){
  const perm=g.perm.slice(), co=new Array(8), eo=new Array(12);
  for(let s=0;s<8;s++){const v=C.applyM(g.ori[C.POS_OF_CORNER_SLOT[s]],[0,1,0]);
    co[s]=v[1]!==0?0:(v[0]!==0?(v[0]>0?1:2):(v[2]>0?2:1));}
  for(let s=0;s<12;s++){const v=C.applyM(g.ori[C.POS_OF_EDGE_SLOT[s]],[0,1,0]); eo[s]=v[1]!==0?0:1;}
  return {perm,co,eo};
}
function applyPack(st,name){
  const t=C.TURN_BY_NAME.get(name), d=C.TURN_DATA.get(name);
  const nPerm=st.perm.slice(), nCo=st.co.slice(), nEo=st.eo.slice();
  const writes=[];
  for(let from=0;from<26;from++){ if(!C.isAffected(from,t)) continue; writes.push([from,d.posMap[from],d.mat]); }
  for(const [from,to,mat] of writes){
    nPerm[to]=st.perm[from];
    const c=C.CUBIES[from];
    if(c.kind==='corner'){const m=C.mul(mat,frameOf(cUD(st.co[C.CORNER_SLOT[from]])));const v=[m[1],m[4],m[7]];
      nCo[C.CORNER_SLOT[to]]=v[1]!==0?0:(v[0]!==0?(v[0]>0?1:2):(v[2]>0?2:1));}
    else if(c.kind==='edge'){const m=C.mul(mat,frameOf(eUD(st.eo[C.EDGE_SLOT[from]])));const v=[m[1],m[4],m[7]];
      nEo[C.EDGE_SLOT[to]]=v[1]!==0?0:1;}
  }
  st.perm=nPerm; st.co=nCo; st.eo=nEo;
}
const coordsOf=(g)=>{const p=fromGeom(g);let tw=0;for(let i=0;i<7;i++)tw=tw*3+p.co[i];let fl=0;for(let i=0;i<11;i++)fl=fl*2+p.eo[i];
  let mask=0;for(let s=0;s<12;s++) if(C.SLICE_EDGES.includes(C.EDGE_SLOT[g.perm[C.POS_OF_EDGE_SLOT[s]]])) mask|=1<<s;
  return {tw,fl,mask};};
const geo=C.solvedState();
const pack={perm:[...Array(26).keys()],co:new Array(8).fill(0),eo:new Array(12).fill(0)};
const faces=['U','D','L','R','F','B'],sufs=['','2',"'"];
let bad=0;
for(let i=0;i<200;i++){
  const name=faces[(Math.random()*6)|0]+sufs[(Math.random()*3)|0];
  C.applyTurn(geo,name); applyPack(pack,name);
  const a=coordsOf(geo), b=coordsOf(toGeom(pack));
  if(a.tw!==b.tw||a.fl!==b.fl||a.mask!==b.mask){
    if(++bad<3) console.log('第',i,'步',name,'geo',JSON.stringify(a),'pack',JSON.stringify(b));
  }
}
console.log('applyPack vs 几何:', bad===0?'200 步完全一致':'不一致 '+bad+' 次');
