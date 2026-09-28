const fs = require('fs');
const C = require('../cube-core.js');
const FILE = __dirname + '/solver-tables.bin';
const N = [2187*495, 2048*495, 24*40320, 24*40320];
function loadCache() {
  const buf = fs.readFileSync(FILE);
  let off = 0; const parts = N.map(n => { const a = new Uint8Array(buf.buffer, buf.byteOffset+off, n); off += n; return a; });
  C.Solver.load({ tw: parts[0], fl: parts[1], sc: parts[2], se: parts[3] });
}
if (!fs.existsSync(FILE)) { console.log('无缓存，先构建…'); const t=Date.now(); C.Solver.build(()=>{});
  const d=C.Solver.dump(); const total=N.reduce((a,b)=>a+b,0); const out=Buffer.alloc(total); let off=0;
  for (const a of [d.tw,d.fl,d.sc,d.se]) { Buffer.from(a.buffer,a.byteOffset,a.length).copy(out,off); off+=a.length; }
  fs.writeFileSync(FILE,out); console.log('构建完成', ((Date.now()-t)/1000).toFixed(1),'s'); }
loadCache();
console.log('缓存已加载');
const I = C.Solver._internals;
const solved = I.solvedPack();
console.log('还原态 key: twist', I.twistOf(solved), 'slice', I.sliceOf(solved));
console.log('distTwistSlice[还原态 key] =', I.distTwistSlice[I.twistOf(solved)*495 + I.sliceOf(solved)]);
console.log('distFlipSlice[还原态 key] =', I.distFlipSlice[I.flipOf(solved)*495 + I.sliceOf(solved)]);
const s = C.solvedState(); C.applyTurn(s,'R');
const st = { perm: s.perm.slice(), ori: s.ori.map(m=>I.pack(m)) };
const tw=I.twistOf(st), fl=I.flipOf(st), sl=I.sliceOf(st);
console.log('R: tw',tw,'fl',fl,'sl',sl,'h=',Math.max(I.distTwistSlice[tw*495+sl], I.distFlipSlice[fl*495+sl]));
// 统计表里 255 的个数
const cnt255 = (a) => { let n=0; for (let i=0;i<a.length;i++) if (a[i]===255) n++; return n; };
console.log('未访问条目:', { tw: cnt255(I.distTwistSlice), fl: cnt255(I.distFlipSlice), sc: cnt255(I.distSpCp), se: cnt255(I.distSpEp) });
console.log('最大距离:', { tw: Math.max(...I.distTwistSlice.slice(0,100000)), fl: Math.max(...I.distFlipSlice.slice(0,100000)) });
