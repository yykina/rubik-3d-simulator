const C = require('../cube-core.js');
const I = C.Solver._internals();
// 用 Solver 内部函数不方便，直接复刻：验证 co 的编码/解码闭环 + L 的转移
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function frameFrom(v){const d=v[1]!==0?[1,0,0]:[0,1,0];const u=cross(d,v);return [u[0],v[0],d[0],u[1],v[1],d[1],u[2],v[2],d[2]];}
function valFromVec(v){return v[1]!==0?0:(v[0]!==0?(v[0]>0?1:2):(v[2]>0?2:1));}
// 关键检查：把 co 解码成矩阵，再用「与 readCornerOri 相同的方式」读回来，必须是同一个 co
for(let idx=0;idx<2187;idx++){
  const co=[]; let x=idx, s=0;
  for(let i=6;i>=0;i--){co[i]=x%3;s+=co[i];x=(x-co[i])/3;}
  co[7]=(3-(s%3))%3;
  const back=[];
  for(let slot=0;slot<8;slot++){
    const homeY=C.CUBIES[C.POS_OF_CORNER_SLOT[slot]].home[1];
    const val=co[slot];
    const v = val===0?[0,homeY>0?1:-1,0]:(val===1?[homeY>0?1:-1,0,0]:[0,0,homeY>0?-1:1]);
    const m=frameFrom(v);
    back[slot]=valFromVec([m[1],m[4],m[7]]);
  }
  if(back.join('')!==co.join('')){ console.log('编码闭环失败 idx',idx,co.join(''),'->',back.join('')); break; }
}
console.log('编码/解码闭环检查完成');
// L 单步
const t=C.TURN_BY_NAME.get('L'), d=C.TURN_DATA.get('L');
const co0=new Array(8).fill(0), nco=co0.slice();
for(let from=0;from<26;from++){
  const c=C.CUBIES[from];
  if(c.kind!=='corner'||!C.isAffected(from,t)) continue;
  const to=d.posMap[from];
  const fs=C.CORNER_SLOT[from], ts=C.CORNER_SLOT[to];
  const homeYFrom=C.CUBIES[C.POS_OF_CORNER_SLOT[fs]].home[1];
  const v=co0[fs]===0?[0,homeYFrom>0?1:-1,0]:(co0[fs]===1?[homeYFrom>0?1:-1,0,0]:[0,0,homeYFrom>0?-1:1]);
  const m=C.mul(d.mat, frameFrom(v));
  nco[ts]=valFromVec([m[1],m[4],m[7]]);
  console.log('slot',fs,'->',ts,'val',nco[ts]);
}
let tw=0;for(let i=0;i<7;i++)tw=tw*3+nco[i];
console.log('nco',nco.join(''),'twist',tw);
const s=C.solvedState(); C.applyTurn(s,'L');
console.log('real co',C.readCornerOri(s).join(''));
