const C = require('./cube-core.js');
const P1 = C.PHASE1_MOVES;
// 用几何方法为少量随机状态做「≤6 步」BFS 求到 G1，再和坐标表 IDA* 的结果对照
const geoKey = s => {
  const co=C.readCornerOri(s).join(''), eo=C.readEdgeFlip(s).join(''), m=C.readSliceMask(s);
  return co+'|'+eo+'|'+m;
};
const inG1 = s => { const co=C.readCornerOri(s); return co.every(v=>v===0) && C.readEdgeFlip(s).every(v=>v===0) && C.readSliceMask(s)===0b111100000000; };
function bfsG1(start, maxDepth){
  let layer=[{s:start,path:[]}];
  const seen=new Set([geoKey(start)]);
  for(let d=0; d<=maxDepth; d++){
    const next=[];
    for(const node of layer){
      if(inG1(node.s)) return node.path;
      if(d===maxDepth) continue;
      for(const name of P1){
        if(node.path.length && name[0]===node.path[node.path.length-1][0]) continue;
        const s2=C.cloneState(node.s); C.applyTurn(s2,name);
        const k=geoKey(s2); if(seen.has(k)) continue; seen.add(k);
        next.push({s:s2,path:node.path.concat(name)});
      }
    }
    console.log('   BFS depth',d,'layer',layer.length,'next',next.length);
    layer=next;
  }
  return null;
}
const faces=['U','D','L','R','F','B'],sufs=['','2',"'"];
const rnd=n=>Math.floor(Math.random()*n);
// 只打乱 4 步，保证阶段一解 ≤4
for(let t=0;t<2;t++){
  const s=C.solvedState();
  const ms=[]; for(let i=0;i<4;i++) ms.push(faces[rnd(6)]+sufs[rnd(3)]);
  C.applyMoves(s,ms);
  console.log('scramble',ms.join(' '));
  const sol=bfsG1(s,5);
  console.log('  几何 BFS 阶段一:', sol? sol.join(' '):'未找到');
}
