const C = require('../cube-core.js');
console.log('build start');
const t0=Date.now();
C.Solver.build(()=>{});
console.log('build done', Date.now()-t0, 'ms');
function rnd(n){return Math.floor(Math.random()*n);}
const faces=['U','D','L','R','F','B'],sufs=['','2',"'"];
function scr(n){const o=[];let last='';while(o.length<n){const f=faces[rnd(6)];if(f===last)continue;last=f;o.push(f+sufs[rnd(3)]);}return o;}
const s=C.solvedState();
const ms=scr(25);
console.log('scramble:', ms.join(' '));
C.applyMoves(s,ms);
console.log('co',C.readCornerOri(s).join(''),'eo',C.readEdgeFlip(s).join(''),'mask',C.readSliceMask(s).toString(2).padStart(12,'0'));
console.log('slicePerm', C.readSlicePerm(s), 'cp', C.readCornerPerm(s).join(''), 'ep', C.readEdgePerm(s).join(','));
try{
  const sol=C.Solver.solve(s);
  console.log('solution:',sol.join(' '));
  const chk=C.cloneState(s); C.applyMoves(chk,sol);
  console.log('solved?',C.isSolved(chk));
}catch(e){console.log('solve error:',e.message);}
