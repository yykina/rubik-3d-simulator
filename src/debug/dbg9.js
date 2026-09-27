const C = require('./cube-core.js');
// 复刻构建逻辑，打印 L 的细节
function frameFrom(v){
  const d = v[1]!==0?[1,0,0]:[0,1,0];
  const u=[v[1]*d[2]-v[2]*d[1], v[2]*d[0]-v[0]*d[2], v[0]*d[1]-v[1]*d[0]];
  return [u[0],v[0],d[0], u[1],v[1],d[1], u[2],v[2],d[2]];
}
const upVecOf=(val,homeY)=> val===0?[0,homeY>0?1:-1,0]:(val===1?[homeY>0?1:-1,0,0]:[0,0,homeY>0?-1:1]);
const valFromVec=v=>v[1]!==0?0:(v[0]!==0?(v[0]>0?1:2):(v[2]>0?2:1));
const t=C.TURN_BY_NAME.get('L'), d=C.TURN_DATA.get('L');
const co=new Array(8).fill(0);
console.log('L mat',JSON.stringify(d.mat));
for(let from=0;from<26;from++){
  const c=C.CUBIES[from];
  if(c.kind!=='corner'||!C.isAffected(from,t)) continue;
  const to=d.posMap[from];
  const slotFrom=C.CORNER_SLOT[from], slotTo=C.CORNER_SLOT[to];
  const homeYFrom=C.CUBIES[C.POS_OF_CORNER_SLOT[slotFrom]].home[1];
  const m0=frameFrom(upVecOf(co[slotFrom],homeYFrom));
  const m=C.mul(d.mat,m0);
  console.log('corner slot',slotFrom,'->',slotTo,'v0',JSON.stringify(upVecOf(co[slotFrom],homeYFrom)),'m0',JSON.stringify(m0),'m',JSON.stringify(m),'col1',JSON.stringify([m[1],m[4],m[7]]),'val',valFromVec([m[1],m[4],m[7]]));
}
// 真实几何
const s=C.solvedState(); C.applyTurn(s,'L');
console.log('real co',C.readCornerOri(s).join(''),'real eo',C.readEdgeFlip(s).join(''));
