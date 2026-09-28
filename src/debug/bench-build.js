/* 分别计时三张表的构建，找出瓶颈 */
const C = require('../cube-core.js');
const I = C.Solver._internals;
// 手工构建单表以便分别计时（复用 solver-table-worker 的逻辑）
const MOVES2 = ['U','U2',"U'",'R2','F2','D','D2',"D'",'L2','B2'];
function build(name) {
  const cfg = name === 'p1'
    ? { key: (st) => (2186 - I.twistOf(st)) + I.flipOf(st) * 2187, size: 2187 * 2048, moves: C.PHASE1_MOVES, depthMax: 12 }
    : name === 'sc'
      ? { key: (st) => I.spOf(st) * 40320 + I.cpOf(st), size: 24 * 40320, moves: MOVES2, depthMax: 18 }
      : { key: (st) => I.spOf(st) * 40320 + I.epOf(st), size: 24 * 40320, moves: MOVES2, depthMax: 18 };
  const dist = new Uint8Array(cfg.size).fill(255);
  const start = I.solvedPack();
  dist[cfg.key(start)] = 0;
  let frontier = [start], depth = 0, visited = 1;
  const t0 = Date.now();
  while (frontier.length && depth < cfg.depthMax) {
    const next = [];
    for (const rep of frontier) {
      for (const mv of cfg.moves) {
        const st = I.applyPack(I.clonePack(rep), mv);
        const k = cfg.key(st);
        if (dist[k] === 255) { dist[k] = depth + 1; next.push(st); visited++; }
      }
    }
    frontier = next; depth++;
    console.log(`  ${name} depth ${depth} frontier ${frontier.length} visited ${visited} (${((Date.now()-t0)/1000).toFixed(1)}s)`);
  }
  return Date.now() - t0;
}
for (const name of (process.argv[2] ? [process.argv[2]] : ['p1', 'sc', 'se'])) {
  console.log('构建', name, '…');
  console.log('  => 用时', (build(name) / 1000).toFixed(1), 's');
}
