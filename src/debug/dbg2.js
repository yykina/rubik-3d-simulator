const C = require('./cube-core.js');
// ---- 纯几何 IDA*（不使用任何坐标表） ----
const P1 = C.PHASE1_MOVES;
function geoCoords(s){
  const co=C.readCornerOri(s), eo=C.readEdgeFlip(s);
  let tw=0; for(let i=0;i<7;i++) tw=tw*3+co[i];
  let fl=0; for(let i=0;i<11;i++) fl=fl*2+eo[i];
  return {tw,fl,mask:C.readSliceMask(s)};
}
function inG1(s){const c=geoCoords(s);return c.tw===0&&c.fl===0&&c.mask===0b1111_0000_0000;}
function geoPhase1(state, maxDepth=10){
  const path=[];
  let nodes=0;
  function dfs(s,g,bound,lastFace,lastAxis){
    nodes++;
    if(g>0 && inG1(s)) return -1;
    if(g>=bound) return Infinity;
    let min=Infinity;
    for(const name of P1){
      const f=name[0]; if(f===lastFace) continue;
      const ax=C.TURN_BY_NAME.get(name).axis;
      if(ax===lastAxis && f===({U:'D',D:'U',R:'L',L:'R',F:'B',B:'F'})[lastFace]) continue;
      const s2=C.cloneState(s); C.applyTurn(s2,name);
      path.push(name);
      const r=dfs(s2,g+1,bound,f,ax);
      if(r===-1) return -1;
      path.pop();
      if(r<min) min=r;
    }
    return min;
  }
  for(let b=0;b<=maxDepth;b++){
    path.length=0;
    if(dfs(state,0,b,'',-1)===-1) return {sol:path.slice(),nodes};
  }
  return {sol:null,nodes};
}
const faces=['U','D','L','R','F','B'],sufs=['','2',"'"];
const rnd=n=>Math.floor(Math.random()*n);
function scr(n){const o=[];let last='';while(o.length<n){const f=faces[rnd(6)];if(f===last)continue;last=f;o.push(f+sufs[rnd(3)]);}return o;}
for(let t=0;t<3;t++){
  const s=C.solvedState(); const ms=scr(15); C.applyMoves(s,ms);
  const r=geoPhase1(s,8);
  console.log(`试 ${t}: 几何阶段一 ${r.sol? r.sol.join(' '):'未找到(≤8)'}  nodes=${r.nodes}`);
  if(r.sol){ const c=C.cloneState(s); C.applyMoves(c,r.sol); console.log('   到 G1 了吗:', inG1(c)); }
}
