const C = require('../cube-core.js');
C.Solver.build(()=>{});
const I = C.Solver._internals();
const N_SLICE=495, N_P1=18, N_CP=40320, N_EP=40320, N_P2=10;
const coordsOf=s=>{const co=C.readCornerOri(s),eo=C.readEdgeFlip(s);let tw=0;for(let i=0;i<7;i++)tw=tw*3+co[i];let fl=0;for(let i=0;i<11;i++)fl=fl*2+eo[i];return{tw,fl,sl:I.maskToIdx(C.readSliceMask(s))};};
// 阶段一
let s=C.solvedState(), bad=0;
for(let step=0; step<60; step++){
  const mi=Math.floor(Math.random()*18), name=C.PHASE1_MOVES[mi];
  const c0=coordsOf(s);
  const s2=C.cloneState(s); C.applyTurn(s2,name);
  const g=coordsOf(s2);
  const t={tw:I.twistMove[c0.tw*N_P1+mi],fl:I.flipMove[c0.fl*N_P1+mi],sl:I.sliceMove[c0.sl*N_P1+mi]};
  if(g.tw!==t.tw||g.fl!==t.fl||g.sl!==t.sl){bad++;if(bad<3)console.log('P1 mismatch',name,JSON.stringify(g),JSON.stringify(t));}
  s.perm=s2.perm;s.ori=s2.ori;
}
console.log('阶段一表一致性:', 60-bad+'/60');
// 阶段二（在 G1 内游走）
let s2=C.solvedState(), bad2=0;
for(let step=0; step<60; step++){
  const mi=Math.floor(Math.random()*10), name=C.PHASE2_MOVES[mi];
  const cpA=C.permToIdx(C.readCornerPerm(s2)), epA=C.readEdgePermIdx(s2), spA=C.readSlicePerm(s2);
  const c=C.cloneState(s2); C.applyTurn(c,name);
  const cpB=C.permToIdx(C.readCornerPerm(c)), epB=C.readEdgePermIdx(c), spB=C.readSlicePerm(c);
  const t={cp:I.cpMove[cpA*N_P2+mi],ep:I.epMove[epA*N_P2+mi],sp:I.spMove[spA*N_P2+mi]};
  if(t.cp!==cpB||t.ep!==epB||t.sp!==spB){bad2++;if(bad2<3)console.log('P2 mismatch',name,JSON.stringify({cpB,epB,spB}),JSON.stringify(t));}
  s2=c;
}
console.log('阶段二表一致性:', 60-bad2+'/60');
