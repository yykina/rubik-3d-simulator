/* 构建求解器剪枝表并写入缓存（带版本头，编码变更后自动失效） */
const fs = require('fs');
const C = require('../cube-core.js');
const FILE = __dirname + '/solver-tables.bin';
const MAGIC = 'CB07';
const N = [2187 * 2048, 24 * 40320, 24 * 40320];   // p1, spCp, spEp
const TOTAL = N.reduce((a, b) => a + b, 0);
if (fs.existsSync(FILE)) {
  const buf = fs.readFileSync(FILE);
  if (buf.subarray(0, 4).toString() === MAGIC) { console.log('缓存有效，跳过构建'); process.exit(0); }
  console.log('缓存版本不符，重建');
}
const t0 = Date.now();
let last = '';
C.Solver.build((p, label) => {
  if (label !== last) { last = label; console.log('  ' + label + ' …'); }
});
const d = C.Solver.dump();
const out = Buffer.alloc(4 + TOTAL);
out.write(MAGIC, 0);
let off = 4;
for (const a of [d.p1, d.sc, d.se]) { Buffer.from(a.buffer, a.byteOffset, a.length).copy(out, off); off += a.length; }
fs.writeFileSync(FILE, out);
console.log('构建完成', ((Date.now() - t0) / 1000).toFixed(1), 's, 缓存', ((4 + TOTAL) / 1048576).toFixed(1), 'MB');
