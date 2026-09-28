/* 从缓存加载剪枝表 */
const fs = require('fs');
const C = require('../cube-core.js');
const FILE = __dirname + '/solver-tables.bin';
const MAGIC = 'CB07';
const N = [2187 * 2048, 24 * 40320, 24 * 40320];
module.exports = function loadTables() {
  const buf = fs.readFileSync(FILE);
  if (buf.subarray(0, 4).toString() !== MAGIC) throw new Error('缓存版本不符，请先运行 build-tables.js');
  let off = 4;
  const parts = N.map((n) => { const a = new Uint8Array(buf.buffer, buf.byteOffset + off, n); off += n; return a; });
  C.Solver.load({ p1: parts[0], sc: parts[1], se: parts[2] });
  return C;
};
