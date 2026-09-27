const C = require('./cube-core.js');
C.Solver.build(()=>{});
const I = C.Solver._internals();
const N_P2=10, N_P1=18;
// 统一：cpMove/epMove 的表输入 = stateFrom*Perm 的语义
// stateFromCornerPerm(p): p[slot]=piece  → 索引 = permToIdx(readCornerSlots)
// stateFromEdgePerm(p):   p[slot]=piece(绝对编号 0..11) → 表索引应该是 permToIdx(readEdgePerm) 的逆
let s=C.solvedState(), bad=0, N=200;
for(let step=0; step<N; step++){
  const mi=(Math.random()*10)|0, name=C.PHASE2_MOVES[mi];
  const cpA=C.permToIdx(C.readCornerSlots(s));
  const epA=C.permToIdx(C.readEdgePerm(s));   // 绝对编号语义
  const c=C.cloneState(s); C.applyTurn(c,name);
  const cpB=C.permToIdx(C.readCornerSlots(c));
  const epB=C.permToIdx(C.readEdgePerm(c));
  const t={cp:I.cpMove[cpA*N_P2+mi],ep:I.epMove[epA*N_P2+mi]};
  if(t.cp!==cpB||t.ep!==epB){ if(++bad<3) console.log('P2',name,'cpB',cpB,'t.cp',t.cp,'epB',epB,'t.ep',t.ep); }
  s=c;
}
console.log('阶段二(cp/ep, 绝对编号语义):', (N-bad)+'/'+N);
// 阶段一 twist 单独详查
const s2=C.solvedState(); C.applyTurn(s2,'D');
const co=C.readCornerOri(s2);
let tw=0;for(let i=0;i<7;i++)tw=tw*3+co[i];
console.log('D co=',co.join(''),'geo twist=',tw,'tab=',I.twistMove[C.PHASE1_MOVES.indexOf('D')]);
