const fs = require('fs');
const C = require('../cube-core.js');
const FILE = __dirname + '/solver-tables.bin';
let t0 = Date.now();
if (fs.existsSync(FILE)) {
  const buf = fs.readFileSync(FILE);
  // 4 张表首尾相接
  const N = [2187 * 495, 2048 * 495, 24 * 40320, 24 * 40320];
  let off = 0;
  const parts = N.map((n) => { const a = new Uint8Array(buf.buffer, buf.byteOffset + off, n); off += n; return a; });
  C.Solver.load({ tw: parts[0], fl: parts[1], sc: parts[2], se: parts[3] });
  console.log('从缓存加载:', ((Date.now() - t0) / 1000).toFixed(2), 's');
} else {
  C.Solver.build(() => {});
  const d = C.Solver.dump();
  const total = d.tw.length + d.fl.length + d.sc.length + d.se.length;
  const out = Buffer.alloc(total);
  let off = 0;
  for (const a of [d.tw, d.fl, d.sc, d.se]) { Buffer.from(a.buffer, a.byteOffset, a.length).copy(out, off); off += a.length; }
  fs.writeFileSync(FILE, out);
  console.log('构建并写入缓存:', ((Date.now() - t0) / 1000).toFixed(1), 's,', (total / 1048576).toFixed(1), 'MB');
}
const run = (str) => { const s = C.solvedState(); C.applyMoves(s, str.trim().split(/\s+/)); return s; };
for (const scr of ['R', "R U"]) {
  const s = run(scr);
  const t = Date.now();
  try {
    const sol = C.Solver.solve(s);
    const chk = C.cloneState(s); C.applyMoves(chk, sol);
    console.log(`"${scr}" -> ${sol.join(' ')} (${sol.length} 步, ${Date.now() - t}ms, 还原=${C.isSolved(chk)})`);
  } catch (e) { console.log(`"${scr}" 失败: ${e.message} (${Date.now() - t}ms)`); }
}
