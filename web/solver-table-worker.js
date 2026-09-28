/*
 * solver-table-worker.js — 在独立 Worker 里构建「一张」剪枝表，然后把缓冲区传回主线程。
 * 三张表相互独立，可以并行构建，把首次构建时间从约 3.5 分钟压到 1 分多钟。
 *
 * 用法：postMessage({ type:'build', table:'p1' | 'sc' | 'se' })
 * 回传：{ type:'built', table, buffer }（Transferable，零拷贝）
 *       { type:'progress', table, pct }
 */
importScripts('cube-core.js');

/** 单独构建某一张表（复用内核里的构建逻辑，按表裁剪参数） */
const BUILDERS = {
  p1: {
    key: (st) => (2187 - 1 - twist(st)) + flip(st) * 2187,
    size: 2187 * 2048,
    moves: null,            // 阶段一用全部 18 个动作
  },
  sc: {
    key: (st) => sp(st) * 40320 + cp(st),
    size: 24 * 40320,
    moves: ['U', 'U2', "U'", 'R2', 'F2', 'D', 'D2', "D'", 'L2', 'B2'],
  },
  se: {
    key: (st) => sp(st) * 40320 + ep(st),
    size: 24 * 40320,
    moves: ['U', 'U2', "U'", 'R2', 'F2', 'D', 'D2', "D'", 'L2', 'B2'],
  },
};

// 内核暴露的坐标读取（与 Solver 内部实现同源）
const I = CubeCore.Solver._internals;
const twist = (st) => I.twistOf(st);
const flip = (st) => I.flipOf(st);
const sp = (st) => I.spOf(st);
const cp = (st) => I.cpOf(st);
const ep = (st) => I.epOf(st);

function buildTable(name) {
  const cfg = BUILDERS[name];
  const moves = cfg.moves || CubeCore.PHASE1_MOVES;
  const dist = new Uint8Array(cfg.size).fill(255);
  const start = I.solvedPack();
  const k0 = cfg.key(start);
  dist[k0] = 0;
  let frontier = [start];
  let depth = 0;
  const depthMax = cfg.moves ? 18 : 12;   // 阶段一深度上限 12，阶段二 18
  while (frontier.length && depth < depthMax) {
    const next = [];
    for (let i = 0; i < frontier.length; i++) {
      const rep = frontier[i];
      for (let mi = 0; mi < moves.length; mi++) {
        const st = I.applyPack(I.clonePack(rep), moves[mi]);
        const k = cfg.key(st);
        if (dist[k] === 255) { dist[k] = depth + 1; next.push(st); }
      }
    }
    frontier = next;
    depth++;
    postMessage({ type: 'progress', table: name, pct: Math.round((depth / depthMax) * 100) });
  }
  return dist;
}

self.onmessage = (ev) => {
  const msg = ev.data || {};
  if (msg.type !== 'build') return;
  try {
    const arr = buildTable(msg.table);
    self.postMessage({ type: 'built', table: msg.table, buffer: arr.buffer }, [arr.buffer]);
  } catch (e) {
    self.postMessage({ type: 'failed', table: msg.table, message: String(e && e.message || e) });
  }
};
