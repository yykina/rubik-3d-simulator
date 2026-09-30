/* 把 src/debug/solver-tables.bin 注入页面 IndexedDB，免去每次重新构建（仅用于本地验证） */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'src', 'debug', 'solver-tables.bin');

module.exports = function tableSeeder() {
  const buf = fs.readFileSync(FILE);
  const b64 = buf.toString('base64');
  return `(() => {
    const B64 = ${JSON.stringify(b64)};
    const bin = atob(B64);
    const all = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) all[i] = bin.charCodeAt(i);
    const N = [2187 * 2048, 24 * 40320, 24 * 40320];
    let off = 4;
    const parts = N.map((n) => { const a = all.slice(off, off + n); off += n; return a; });
    const req = indexedDB.open('rubik-solver', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('tables');
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('tables', 'readwrite');
      tx.objectStore('tables').put({ total: N.reduce((a, b) => a + b, 0), p1: parts[0], sc: parts[1], se: parts[2] }, 'CB08');
      tx.oncomplete = () => { window.__seeded = true; };
    };
  })();`;
};
