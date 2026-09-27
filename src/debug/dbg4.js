const C = require('./cube-core.js');
C.Solver.build(()=>{});
const I = C.Solver._internals();
const N_SLICE=495, N_P1=18, N_CP=40320, N_EP=40320, N_SP=24, N_P2=10;
function coordsOf(s){
  const co=C.readCornerOri(s), eo=C.readEdgeFlip(s);
  let tw=0; for(let i=0;i<7;i++) tw=tw*3+co[i];
  let fl=0; for(let i=0;i<11;i++) fl=fl*2+eo[i];
  return {tw,fl,sl:I.maskToIdx(C.readSliceMask(s))};
}
// 1) 检查从一个真实状态出发，几何坐标 vs 表坐标是否一致
const s=C.solvedState();
let bad=0, checked=0;
for(let step=0; step<40; step++){
  const c0=coordsOf(s);
  const name=C.PHASE1_MOVES[Math.floor(Math.random()*18)];
  const s2=C.cloneState(s); C.applyTurn(s2,name);
  const cGeo=coordsOf(s2);
  const cTab={tw:I.twistMove[c0.tw*N_P1+C.PHASE1_MOVES.indexOf(name)], fl:I.flipMove[c0.fl*N_P1+C.PHASE1_MOVES.indexOf(name)], sl:I.sliceMove[c0.sl*N_P1+C.PHASE1_MOVES.indexOf(name)]};
  checked++;
  if(cGeo.tw!==cTab.tw||cGeo.fl!==cTab.fl||cGeo.sl!==cTab.sl){
    bad++;
    if(bad<4) console.log(`不一致 move=${name} geo=${JSON.stringify(cGeo)} tab=${JSON.stringify(cTab)}`);
  }
  s.perm=s2.perm; s.ori=s2.ori;
}
console.log(`阶段一坐标表一致性: ${checked-bad}/${checked}`);

// 2) 检查阶段二坐标表
let s2=C.solvedState();
let bad2=0, checked2=0;
for(let step=0; step<40; step++){
  // 先把状态推进到 G1：随机执行 10 次阶段二动作即可保持在 G1
  const name=C.PHASE2_MOVES[Math.floor(Math.random()*10)];
  const before=C.cloneState(s2);
  C.applyTurn(s2,name);
  checked2++;
  const cpA=C.permToIdx(C.readCornerPerm(before)), epA=C.permToIdx(C.readEdgePerm(before)), spA=C.readSlicePerm(before);
  const mi=C.PHASE2_MOVES.indexOf(name);
  const cpB=C.permToIdx(C.readCornerPerm(s2)), epB=C.permToIdx(C.readEdgePerm(s2)), spB=C.readSlicePerm(s2);
  const t={cp:I.cpMove[cpA*N_P2+mi], ep:I.epMove[epA*N_P2+mi], sp:I.spMove[spA*N_P2+mi]};
  if(t.cp!==cpB||t.ep!==epB||t.sp!==spB){
    bad2++;
    if(bad2<4) console.log(`阶段二不一致 move=${name} geo={cp:${cpB},ep:${epB},sp:${spB}} tab=${JSON.stringify(t)}`);
  }
}
console.log(`阶段二坐标表一致性: ${checked2-bad2}/${checked2}`);

// 3) 已还原状态的坐标
const sol=C.solvedState();
console.log('solved coords:', JSON.stringify(coordsOf(sol)), 'cp', C.permToIdx(C.readCornerPerm(sol)), 'ep', C.permToIdx(C.readEdgePerm(sol)), 'sp', C.readSlicePerm(sol));
