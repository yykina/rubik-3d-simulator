/*
 * solver-worker.js — 只负责「构建 / 读取剪枝表」，把三张表的 ArrayBuffer 回传主线程。
 *
 * 为什么不在 Worker 里求解：求解在主线程已验证可用（与 Node 同一份实现、同一条路径），
 * 把「表加载 + 求解」都塞进 Worker 会多出一层难以排查的状态边界。
 * 求解本身是毫秒级（最坏约 2 秒），放主线程完全可以接受。
 *
 * 消息：
 *   主线程 → Worker : { type:'init' }
 *   Worker → 主线程 : { type:'progress', label, pct }
 *                     { type:'tables', cached, p1, sc, se }   （ArrayBuffer，零拷贝）
 *                     { type:'failed', message }
 */
importScripts('cube-core.js');

const MAGIC = 'CB09';
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
const valid = (rec) => !!rec && rec.total === TOTAL
  && rec.p1 && rec.p1.byteLength === N[0]
  && rec.sc && rec.sc.byteLength === N[1]
  && rec.se && rec.se.byteLength === N[2];

/** 并行构建三张表（每张一个子 Worker） */
function buildParallel() {
  return new Promise((resolve, reject) => {
    const parts = {};
    const perTable = { p1: 0, sc: 0, se: 0 };
    const done = { p1: false, sc: false, se: false };
    let settled = false;
    for (const name of ['p1', 'sc', 'se']) {
      const w = new Worker('solver-table-worker.js');
      w.onmessage = (ev) => {
        const m = ev.data || {};
        if (m.type === 'progress') {
          perTable[m.table] = m.pct;
          const avg = (perTable.p1 + perTable.sc + perTable.se) / 3;
          postMessage({ type: 'progress', label: '并行构建求解表（首次较慢）', pct: Math.round(avg) });
        } else if (m.type === 'built') {
          parts[m.table] = new Uint8Array(m.buffer);
          done[m.table] = true;
          w.terminate();
          if (done.p1 && done.sc && done.se && !settled) { settled = true; resolve(parts); }
        } else if (m.type === 'failed') {
          if (!settled) { settled = true; reject(new Error(m.message)); }
        }
      };
      w.onerror = () => { if (!settled) { settled = true; reject(new Error('表构建 Worker 出错')); } };
      w.postMessage({ type: 'build', table: name });
    }
  });
}

self.onmessage = async (ev) => {
  const msg = ev.data || {};
  if (msg.type !== 'init') return;
  try {
    // 1) 优先使用本地缓存
    try {
      const rec = await idbGet(MAGIC);
      if (valid(rec)) {
        postMessage({ type: 'progress', label: '从本地缓存加载求解表', pct: 100 });
        const p1 = rec.p1.slice(), sc = rec.sc.slice(), se = rec.se.slice();
        postMessage({ type: 'tables', cached: true, p1: p1.buffer, sc: sc.buffer, se: se.buffer },
          [p1.buffer, sc.buffer, se.buffer]);
        return;
      }
    } catch (e) { /* 缓存不可用则重建 */ }

    // 2) 现场并行构建
    postMessage({ type: 'progress', label: '准备构建求解表', pct: 0 });
    const parts = await buildParallel();

    // 3) 回传（零拷贝）
    const p1 = parts.p1.slice(), sc = parts.sc.slice(), se = parts.se.slice();
    postMessage({ type: 'tables', cached: false, p1: p1.buffer, sc: sc.buffer, se: se.buffer },
      [p1.buffer, sc.buffer, se.buffer]);

    // 4) 后台写缓存，不影响使用
    try { await idbPut(MAGIC, { total: TOTAL, p1: parts.p1.slice(), sc: parts.sc.slice(), se: parts.se.slice() }); }
    catch (e) { /* 忽略 */ }
  } catch (e) {
    postMessage({ type: 'failed', message: String(e && e.message || e) });
  }
};
