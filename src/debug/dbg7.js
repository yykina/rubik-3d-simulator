const C = require('./cube-core.js');
C.Solver.build(()=>{});
const I = C.Solver._internals();
const N_P1=18, N_P2=10, N_SLICE=495;
const coordsOf=s=>{const co=C.readCornerOri(s),eo=C.readEdgeFlip(s);let tw=0;for(let i=0;i<7;i++)tw=tw*3+co[i];let fl=0;for(let i=0;i<11;i++)fl=fl*2+eo[i];return{tw,fl,sl:I.maskToIdx(C.readSliceMask(s))};};
let s=C.solvedState(), bad=0, N=300;
for(let step=0; step<N; step++){
  const mi=(Math.random()*18)|0, name=C.PHASE1_MOVES[mi];
  const c0=coordsOf(s);
  const s2=C.cloneState(s); C.applyTurn(s2,name);
  const g=coordsOf(s2);
  const t={tw:I.twistMove[c0.tw*N_P1+mi],fl:I.flipMove[c0.fl*N_P1+mi],sl:I.sliceMove[c0.sl*N_P1+mi]};
  if(g.tw!==t.tw||g.fl!==t.fl||g.sl!==t.sl){ if(++bad<4) console.log('P1 mismatch',name,JSON.stringify({g,t})); }
  s=s2;
}
console.log('阶段一表一致性:', (N-bad)+'/'+N);
// 阶段二：统一用「槽位排列」（stateFrom*Perm 的语义）
let s2=C.solvedState(), bad2=0;
for(let step=0; step<N; step++){
  const mi=(Math.random()*10)|0, name=C.PHASE2_MOVES[mi];
  const cpA=C.permToIdx(C.readCornerSlots(s2)), epA=C.permToIdx(C.readEdgeSlots8(s2)), spA=C.readSlicePerm(s2);
  const c=C.cloneState(s2); C.applyTurn(c,name);
  const cpB=C.permToIdx(C.readCornerSlots(c)), epB=C.permToIdx(C.readEdgeSlots8(c)), spB=C.readSlicePerm(c);
  const t={cp:I.cpMove[cpA*N_P2+mi],ep:I.epMove[epA*N_P2+mi],sp:I.spMove[spA*N_P2+mi]};
  if(t.cp!==cpB||t.ep!==epB||t.sp!==spB){ if(++bad2<4) console.log('P2 mismatch',name,JSON.stringify({cpB,epB,spB,t})); }
  s2=c;
}
console.log('阶段二表一致性:', (N-bad2)+'/'+N);
