/*
 * 拟合 内核状态 → cubejs 内部数组 的完整映射。
 * 已知：cubejs 需把 R/F/B 换成它们的逆动作（见 TO_CUBEJS_MOVE）。
 * 目标：验证「cp/ep = 内核读者 + 方向映射」与「co/eo = 按 (块,槽位) 的朝向表」是否能精确成立。
 */
const C = require('../src/cube-core.js');
const Cube = require('../vendor/cubejs/index.js');

const NAME = ['U','U2',"U'",'R','R2',"R'",'F','F2',"F'",'D','D2',"D'",'L','L2',"L'",'B','B2',"B'"];
const TO_CUBEJS = { U:'U', 'U2':'U2', "U'":"U'", R:"R'", R2:'R2', "R'":'R',
  F:"F'", F2:'F2', "F'":'F', D:'D', D2:'D2', "D'":"D'", L:'L', L2:'L2', "L'":"L'", B:'B', B2:'B2', "B'":"B'" };
const inv = (a) => { const b = new Array(a.length); for (let i = 0; i < a.length; i++) b[a[i]] = i; return b; };
const runs = (seq) => { const st = C.solvedState(); C.applyMoves(st, seq); return st; };
const refOf = (seq) => { const c = new Cube(); c.move(seq.map((m) => TO_CUBEJS[m]).join(' ')); return c; };

/** 生成样本：深度 1~3 的随机序列 */
const samples = [];
for (const m of NAME) samples.push({ seq: [m] });
for (let i = 0; i < 400; i++) {
  const len = 2 + (i % 2);
  const seq = []; let last = '';
  while (seq.length < len) { const m = NAME[(Math.random() * 18) | 0]; if (m[0] === last) continue; last = m[0]; seq.push(m); }
  samples.push({ seq });
}
for (const s of samples) { s.st = runs(s.seq); s.ref = refOf(s.seq).toJSON(); }

// 1) cp / ep 用哪个读者？
const cpCands = { pieceToSlot: (st) => C.readCornerPerm(st).slice(), slotToPiece: (st) => inv(C.readCornerPerm(st)) };
const epCands = { pieceToSlot: (st) => C.readEdgePerm(st).slice(), slotToPiece: (st) => inv(C.readEdgePerm(st)) };
for (const [cn, cf] of Object.entries(cpCands)) {
  let ok = 0; for (const s of samples) if (cf(s.st).join(',') === s.ref.cp.join(',')) ok++;
  console.log(`cp[${cn}]: ${ok}/${samples.length}`);
}
for (const [en, ef] of Object.entries(epCands)) {
  let ok = 0; for (const s of samples) if (ef(s.st).join(',') === s.ref.ep.join(',')) ok++;
  console.log(`ep[${en}]: ${ok}/${samples.length}`);
}

/* 2) 用「块 + 槽位 + 内核朝向值」为键拟合 co/eo */
function fit(kind) {
  const n = kind === 'co' ? 8 : 12;
  const table = new Map(); const conflict = new Set();
  for (const s of samples) {
    const perm = kind === 'co' ? C.readCornerPerm(s.st) : C.readEdgePerm(s.st);   // perm[piece]=slot
    const ori = kind === 'co' ? C.readCornerOri(s.st) : C.readEdgeFlip(s.st);     // ori[slot]
    const refPerm = kind === 'co' ? s.ref.cp : s.ref.ep;                          // refPerm[slot]=piece
    for (let slot = 0; slot < n; slot++) {
      const piece = refPerm[slot];
      const coreSlot = perm[piece];
      const key = `${piece},${coreSlot},${ori[coreSlot]}`;
      const val = kind === 'co' ? s.ref.co[slot] : s.ref.eo[slot];
      if (table.has(key) && table.get(key) !== val) conflict.add(key);
      else table.set(key, val);
    }
  }
  return { table, conflict, n };
}
for (const kind of ['co', 'eo']) {
  const { table, conflict, n } = fit(kind);
  console.log(`${kind}: 键 ${table.size}（上界 ${kind === 'co' ? 8 * 8 * 3 : 12 * 12 * 2}），冲突 ${conflict.size}`);
  if (conflict.size) console.log('   冲突示例', [...conflict].slice(0, 4));
}

/* 3) 若 co 无冲突，直接用它做换算并整体验证 */
function makeConv() {
  const co = fit('co'), eo = fit('eo');
  if (co.conflict.size || eo.conflict.size) return null;
  return function convert(st) {
    const cpP = C.readCornerPerm(st), epP = C.readEdgePerm(st);
    const coS = C.readCornerOri(st), eoS = C.readEdgeFlip(st);
    const cp = inv(cpP), ep = inv(epP);
    const co = new Array(8), eo = new Array(12);
    for (let slot = 0; slot < 8; slot++) {
      const piece = cp[slot];
      co[slot] = co.table.get(`${piece},${cpP[piece]},${coS[cpP[piece]]}`);
    }
    for (let slot = 0; slot < 12; slot++) {
      const piece = ep[slot];
      eo[slot] = eo.table.get(`${piece},${epP[piece]},${eoS[epP[piece]]}`);
    }
    return { cp, co, ep, eo };
  };
}
const conv = makeConv();
if (!conv) { console.log('\n存在冲突 → 不能只靠 (块,槽位,朝向) 换算'); process.exit(0); }
let ok = 0;
for (const s of samples) {
  const c = conv(s.st);
  if (c.cp.join() === s.ref.cp.join() && c.co.join() === s.ref.co.join()
    && c.ep.join() === s.ref.ep.join() && c.eo.join() === s.ref.eo.join()) ok++;
}
console.log(`\n换算精确匹配: ${ok}/${samples.length}`);
