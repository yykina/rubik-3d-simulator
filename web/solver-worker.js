/*
 * solver-worker.js — 在 Worker 里构建/加载 Kociemba 剪枝表并求解。
 * 表用 IndexedDB 缓存（约 6.1 MB），第一次访问需要现场构建（较慢），之后秒级加载。
 */
importScripts('cube-core.js');

const MAGIC = 'CB06';
const N = [2187 * 2048, 24 * 40320, 24 * 40320];
const TOTAL = N.reduce((a, b) => a + b, 0);
const DB_NAME = 'rubik-solver';
const STORE = 'tables';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function idbGet(key) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const r = tx.objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => reject(r.error);
  }));
}
function idbPut(key, val) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  }));
}
function applyDump(d) { CubeCore.Solver.load({ p1: d[0], sc: d[1], se: d[2] }); }
function currentDump() { const d = CubeCore.Solver.dump(); return [d.p1, d.sc, d.se]; }

async function ensureTables() {
  try {
    const rec = await idbGet(MAGIC);
    if (rec && rec.total === TOTAL) {
      postMessage({ type: 'progress', label: '从本地缓存加载求解表', pct: 100 });
      applyDump([new Uint8Array(rec.p1), new Uint8Array(rec.sc), new Uint8Array(rec.se)]);
      postMessage({ type: 'ready', cached: true });
      return;
    }
  } catch (e) { /* 缓存不可用则现场构建 */ }
  postMessage({ type: 'progress', label: '构建求解表（首次需要几分钟）', pct: 0 });
  await new Promise((resolve) => setTimeout(resolve, 50));
  CubeCore.Solver.build((p, label) => {
    postMessage({ type: 'progress', label, pct: Math.round(p * 100) });
  });
  postMessage({ type: 'ready', cached: false });
  // 后台写缓存，不阻塞求解
  try {
    const d = currentDump();
    await idbPut(MAGIC, { total: TOTAL, p1: d[0].slice(), sc: d[1].slice(), se: d[2].slice() });
  } catch (e) { /* 忽略缓存写入失败 */ }
}

let readyPromise = ensureTables();

self.onmessage = async (ev) => {
  const msg = ev.data || {};
  if (msg.type === 'solve') {
    try {
      await readyPromise;
      const st = { perm: msg.perm, ori: msg.ori.map((m) => CubeCore.Solver._internals.pack(m)) };
      const t0 = Date.now();
      const moves = CubeCore.Solver.solve(st);
      postMessage({ type: 'solution', id: msg.id, moves, ms: Date.now() - t0 });
    } catch (e) {
      postMessage({ type: 'error', id: msg.id, message: String(e && e.message || e) });
    }
  }
};
