/*
 * cube-core.js — 3×3×3 魔方内核（纯 JS，无渲染依赖，Node / 浏览器通用）
 *
 *   1) 几何层：26 个 cubie + 24 种转动的置换/朝向增量
 *   2) 状态层：可执行、可回放的魔方状态与各种坐标读取
 *   3) 求解层：Kociemba 两阶段搜索（IDA* + 剪枝表）
 *
 * 约定（与标准魔方记号一致）：
 *   U 从上方看顺时针，把前面 +z 转到右面 +x  →  绕 +y 轴 -90°
 *   R 从右侧看顺时针，把前面 +z 转到下面 -y  →  绕 +x 轴 +90°
 *   F 从前面看顺时针，把上面 +y 转到左面 -x  →  绕 +z 轴 +90°
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CubeCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ============================================================ 1. 几何层 */

  // 面片顺序沿用 Kociemba 约定：U R F D L B
  const CORNER_POS = [
    [1, 1, 1], [-1, 1, 1], [-1, 1, -1], [1, 1, -1],
    [1, -1, 1], [-1, -1, 1], [-1, -1, -1], [1, -1, -1],
  ];
  const CORNER_NAMES = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'];

  const EDGE_POS = [
    [1, 1, 0], [0, 1, 1], [-1, 1, 0], [0, 1, -1],
    [1, -1, 0], [0, -1, 1], [-1, -1, 0], [0, -1, -1],
    [1, 0, 1], [-1, 0, 1], [-1, 0, -1], [1, 0, -1],
  ];
  const EDGE_NAMES = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'];
  const SLICE_EDGES = [8, 9, 10, 11];   // E 层棱块：FR FL BL BR

  const key3 = (p) => p[0] + ',' + p[1] + ',' + p[2];

  const CUBIES = [];
  for (let y = -1; y <= 1; y++) {
    for (let x = -1; x <= 1; x++) {
      for (let z = -1; z <= 1; z++) {
        if (x === 0 && y === 0 && z === 0) continue;      // 不可见的核心
        const home = [x, y, z];
        const ci = CORNER_POS.findIndex((p) => key3(p) === key3(home));
        const ei = EDGE_POS.findIndex((p) => key3(p) === key3(home));
        const normals = [];
        if (x !== 0) normals.push([x, 0, 0]);
        if (y !== 0) normals.push([0, y, 0]);
        if (z !== 0) normals.push([0, 0, z]);
        CUBIES.push({
          home, normals,
          kind: ci >= 0 ? 'corner' : ei >= 0 ? 'edge' : 'center',
          piece: ci >= 0 ? ci : ei >= 0 ? ei : -1,
        });
      }
    }
  }
  const CUBIE_AT = new Map(CUBIES.map((c, i) => [key3(c.home), i]));

  const CORNER_SLOT = new Array(26).fill(-1);
  const EDGE_SLOT = new Array(26).fill(-1);
  const POS_OF_CORNER_SLOT = new Array(8).fill(-1);
  const POS_OF_EDGE_SLOT = new Array(12).fill(-1);
  CUBIES.forEach((c, i) => {
    if (c.kind === 'corner') { CORNER_SLOT[i] = c.piece; POS_OF_CORNER_SLOT[c.piece] = i; }
    if (c.kind === 'edge') { EDGE_SLOT[i] = c.piece; POS_OF_EDGE_SLOT[c.piece] = i; }
  });

  /* --- 3×3 整数矩阵，列主序：v' = M·v --- */
  const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  function mul(a, b) {
    return [
      a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
      a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
      a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
    ];
  }
  const applyM = (m, v) => [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];

  const FACE_DEF = [
    ['U', 1, 1, -90], ['D', 1, -1, 90],
    ['R', 0, 1, 90], ['L', 0, -1, 90],
    ['F', 2, 1, 90], ['B', 2, -1, 90],
  ];

  function rotMatrix(axis, deg) {
    const r = (deg * Math.PI) / 180;
    const c = Math.round(Math.cos(r)), s = Math.round(Math.sin(r));
    if (axis === 0) return [1, 0, 0, 0, c, s, 0, -s, c];
    if (axis === 1) return [c, 0, -s, 0, 1, 0, s, 0, c];
    return [c, s, 0, -s, c, 0, 0, 0, 1];
  }

  const TURNS = [];
  for (const [name, axis, layer, deg] of FACE_DEF) {
    TURNS.push({ name, axis, layer, deg, mat: rotMatrix(axis, deg), face: name });
    TURNS.push({ name: name + '2', axis, layer, deg: deg * 2, mat: rotMatrix(axis, deg * 2), face: name });
    TURNS.push({ name: name + "'", axis, layer, deg: -deg, mat: rotMatrix(axis, -deg), face: name });
  }
  const TURN_BY_NAME = new Map(TURNS.map((t) => [t.name, t]));
  const TURN_INVERSE = new Map();
  for (const t of TURNS) {
    TURN_INVERSE.set(t.name, t.name.endsWith('2') ? t.name : t.name.endsWith("'") ? t.name[0] : t.name + "'");
  }

  const PHASE1_MOVES = TURNS.map((t) => t.name);
  const PHASE2_MOVES = ['U', 'U2', "U'", 'R2', 'F2', 'D', 'D2', "D'", 'L2', 'B2'];
  const OPPOSITE_FACE = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };

  const TURN_DATA = new Map();
  for (const t of TURNS) {
    const posMap = new Array(26);
    for (let i = 0; i < 26; i++) {
      const c = CUBIES[i];
      posMap[i] = c.home[t.axis] === t.layer ? CUBIE_AT.get(key3(applyM(t.mat, c.home))) : i;
    }
    const coDelta = new Array(8).fill(0);
    const eoDelta = new Array(12).fill(0);
    for (let i = 0; i < 26; i++) {
      const c = CUBIES[i];
      if (c.home[t.axis] !== t.layer) continue;
      const up = [0, c.home[1] > 0 ? 1 : -1, 0];
      const n2 = applyM(t.mat, up);
      if (c.kind === 'corner') { if (n2[1] === 0) coDelta[i] = n2[2] > 0 ? 2 : 1; }
      else if (c.kind === 'edge') { eoDelta[i] = n2[1] === 0 ? 1 : 0; }
    }
    TURN_DATA.set(t.name, { posMap, coDelta, eoDelta, axis: t.axis, layer: t.layer, mat: t.mat });
  }

  function isAffected(pos, turn) { return CUBIES[pos].home[turn.axis] === turn.layer; }

  /* ============================================================ 2. 状态层 */
  /*
   * 状态：perm[pos] = 该位置上的原始 cubie 索引
   *       ori[pos]  = 该 cubie 相对初始朝向的旋转矩阵
   */
  function solvedState() {
    const perm = new Array(26), ori = new Array(26);
    for (let i = 0; i < 26; i++) { perm[i] = i; ori[i] = IDENTITY.slice(); }
    return { perm, ori };
  }
  function cloneState(s) { return { perm: s.perm.slice(), ori: s.ori.map((m) => m.slice()) }; }

  function applyTurn(state, name) {
    const t = TURN_BY_NAME.get(name);
    if (!t) throw new Error('unknown move: ' + name);
    const d = TURN_DATA.get(name);
    const perm = state.perm, ori = state.ori;
    const nextPerm = new Array(26), nextOri = new Array(26);
    for (let i = 0; i < 26; i++) { nextPerm[i] = perm[i]; nextOri[i] = ori[i]; }
    // 关键：先把所有赋值收集起来再统一写入。若边遍历边写，升序遍历会读到已被覆盖的源位置。
    const writes = [];
    for (let from = 0; from < 26; from++) {
      if (!isAffected(from, t)) continue;
      writes.push([d.posMap[from], perm[from], mul(d.mat, ori[from])]);
    }
    for (let k = 0; k < writes.length; k++) {
      nextPerm[writes[k][0]] = writes[k][1];
      nextOri[writes[k][0]] = writes[k][2];
    }
    state.perm = nextPerm;
    state.ori = nextOri;
    return state;
  }
  function applyMoves(state, moves) { for (const m of moves) applyTurn(state, m); return state; }

  function isSolved(state) {
    for (let i = 0; i < 26; i++) {
      if (state.perm[i] !== i) return false;
      const m = state.ori[i];
      for (let k = 0; k < 9; k++) if (m[k] !== IDENTITY[k]) return false;
    }
    return true;
  }

  /* --- 坐标读取 --- */
  function cornerOrientation(mat) {
    const v = applyM(mat, [0, 1, 0]);
    if (v[1] !== 0) return 0;
    if (v[0] !== 0) return v[0] > 0 ? 1 : 2;
    return v[2] > 0 ? 2 : 1;
  }
  function edgeOrientation(mat) { return applyM(mat, [0, 1, 0])[1] !== 0 ? 0 : 1; }

  function readCornerOri(state) {
    const co = new Array(8);
    for (let slot = 0; slot < 8; slot++) co[slot] = cornerOrientation(state.ori[POS_OF_CORNER_SLOT[slot]]);
    return co;
  }
  function readEdgeFlip(state) {
    const eo = new Array(12);
    for (let slot = 0; slot < 12; slot++) eo[slot] = edgeOrientation(state.ori[POS_OF_EDGE_SLOT[slot]]);
    return eo;
  }
  /** p[piece] = slot  →  返回 slot 位置的排列 q[slot] = piece */
  function invertPerm(p) {
    const q = new Array(p.length);
    for (let i = 0; i < p.length; i++) q[p[i]] = i;
    return q;
  }
  /** 角块槽位排列：arr[slot] = 该槽位上的角块编号（0..7） */
  function readCornerSlots(state) {
    const a = new Array(8);
    for (let slot = 0; slot < 8; slot++) a[slot] = CORNER_SLOT[state.perm[POS_OF_CORNER_SLOT[slot]]];
    return a;
  }
  /** 棱块槽位排列：只取前 8 个 U/D 棱块槽位，arr[slot] = 棱块编号（0..7） */
  function readEdgeSlots8(state) {
    const a = new Array(8);
    for (let slot = 0; slot < 8; slot++) a[slot] = EDGE_SLOT[state.perm[POS_OF_EDGE_SLOT[slot]]];
    return a;
  }
  /** E 层槽位排列：arr[slot-8] = 该槽位上的 E 层棱块相对编号（0..3） */
  function readSlicePermArr(state) {
    const a = new Array(4);
    for (let k = 0; k < 4; k++) a[k] = SLICE_EDGES.indexOf(EDGE_SLOT[state.perm[POS_OF_EDGE_SLOT[8 + k]]]);
    return a;
  }

  /** cp[piece] = 该角块当前所在槽位 */
  function readCornerPerm(state) {
    const cp = new Array(8);
    for (let slot = 0; slot < 8; slot++) cp[CORNER_SLOT[state.perm[POS_OF_CORNER_SLOT[slot]]]] = slot;
    return cp;
  }
  /** ep[piece] = 该棱块当前所在槽位（piece 编号 0..11） */
  function readEdgePerm(state) {
    const ep = new Array(12);
    for (let slot = 0; slot < 12; slot++) ep[EDGE_SLOT[state.perm[POS_OF_EDGE_SLOT[slot]]]] = slot;
    return ep;
  }
  /** 阶段二用的棱块坐标：只看前 8 个「非 E 层」槽位，返回 0..40319。
   *  排列语义为 arr[slot] = piece，与 stateFromEdgePerm 保持一致。 */
  function readEdgePermIdx(state) {
    return permToIdx(readEdgeSlots8(state));
  }
  /** 12 位掩码：第 slot 位为 1 表示该槽位上是 E 层棱块 */
  function readSliceMask(state) {
    let mask = 0;
    for (let slot = 0; slot < 12; slot++) {
      if (SLICE_EDGES.indexOf(EDGE_SLOT[state.perm[POS_OF_EDGE_SLOT[slot]]]) >= 0) mask |= 1 << slot;
    }
    return mask;
  }
  /** 阶段一末尾才有定义：E 层 4 个槽位里 E 层棱块的排列（Lehmer 0..23） */
  function readSlicePerm(state) {
    return permToIdx(readSlicePermArr(state));
  }

  /*
   * 由排列构造状态（生成坐标转移表时用）。
   * 参数 p 的语义：p[slot] = 该槽位上的块编号 —— 与 read*Slots* 一致。
   */
  function stateFromCornerPerm(cp) {
    const s = solvedState();
    const perm = s.perm.slice();
    for (let slot = 0; slot < 8; slot++) {
      perm[POS_OF_CORNER_SLOT[slot]] = POS_OF_CORNER_SLOT[cp[slot]];
    }
    s.perm = perm;
    return s;
  }
  function stateFromEdgePerm(ep) {
    const s = solvedState();
    const perm = s.perm.slice();
    for (let slot = 0; slot < 12; slot++) {
      perm[POS_OF_EDGE_SLOT[slot]] = POS_OF_EDGE_SLOT[ep[slot]];
    }
    s.perm = perm;
    return s;
  }

  /* --- 排列 <-> 整数（Lehmer 码） --- */
  const FACT = [1, 1, 2, 6, 24, 120, 720, 5040, 40320];
  function permToIdx(p) {
    const n = p.length;
    let idx = 0;
    for (let i = 0; i < n; i++) {
      let c = 0;
      for (let j = i + 1; j < n; j++) if (p[j] < p[i]) c++;
      idx += c * FACT[n - 1 - i];
    }
    return idx;
  }
  function idxToPerm(idx, n) {
    const avail = [];
    for (let i = 0; i < n; i++) avail.push(i);
    const p = new Array(n);
    for (let i = 0; i < n; i++) {
      const f = FACT[n - 1 - i];
      const k = Math.floor(idx / f);
      p[i] = avail.splice(k, 1)[0];
      idx -= k * f;
    }
    return p;
  }

  /* ============================================================ 3. 求解层 */
  /*
   * Kociemba 两阶段算法。
   *
   * 这里所有剪枝表都用「真实几何状态」做 BFS，而不是从坐标反推状态再查表：
   * 每个 cubie 的朝向直接存成坐标值（角块 0/1/2，棱块 0/1），贴纸方向按
   * 「自身 home 位置向量」作参考轴构造正规旋转矩阵，因此编码/解码严格互逆。
   *
   *   阶段一：化归到 G1 = <U,D,R2,L2,F2,B2>
   *           坐标 twist(2187) × flip(2048) × slice(495)
   *           剪枝表 twist×slice 与 flip×slice
   *   阶段二：只用 10 种动作还原
   *           坐标 cp(40320) × ep(40320) × sp(24)
   *           剪枝表 (sp,cp) 与 (sp,ep)，各 24×40320
   */
  const N_TWIST = 2187, N_FLIP = 2048, N_SLICE = 495;
  const N_CP = 40320, N_EP = 40320, N_SP = 24;
  const N_P1_MOVES = 18, N_P2_MOVES = 10;

  const SLICE_MASKS = [];
  const SLICE_INDEX = new Int16Array(4096).fill(-1);
  for (let m = 0; m < 4096; m++) {
    let bits = 0;
    for (let i = 0; i < 12; i++) if (m & (1 << i)) bits++;
    if (bits === 4) { SLICE_INDEX[m] = SLICE_MASKS.length; SLICE_MASKS.push(m); }
  }
  const maskToIdx = (mask) => SLICE_INDEX[mask];

  const Solver = (function () {
    /* ---------------- 坐标编解码 ---------------- */
    const twistToCo = (idx) => {
      const co = new Array(8);
      let s = 0;
      for (let i = 6; i >= 0; i--) { co[i] = idx % 3; s += co[i]; idx = (idx - co[i]) / 3; }
      co[7] = (3 - (s % 3)) % 3;
      return co;
    };
    const coToTwist = (co) => {
      let idx = 0;
      for (let i = 0; i < 7; i++) idx = idx * 3 + co[i];
      return idx;
    };
    const flipToEo = (idx) => {
      const eo = new Array(12);
      let s = 0;
      for (let i = 10; i >= 0; i--) { eo[i] = idx & 1; s += eo[i]; idx >>= 1; }
      eo[11] = s & 1;
      return eo;
    };
    const eoToFlip = (eo) => {
      let idx = 0;
      for (let i = 0; i < 11; i++) idx = idx * 2 + eo[i];
      return idx;
    };
    const perm8 = (a) => permToIdx(a);

    /* ---------------- 朝向矩阵构造 ---------------- */
    const cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
    /**
     * 构造正规旋转矩阵（列主序，det = +1），使局部 +y 映射到 v。
     * 以该 cubie 的位置向量 p 作参考轴（p 与 v 必不共线），从而保证唯一且可逆。
     */
    function frameOf(v) {
      // 选一个与 v 不平行的参考轴 d，col0 = d × v、col1 = v、col2 = d（det = +1）
      const d = v[1] !== 0 ? [1, 0, 0] : [0, 1, 0];
      const u = cross(d, v);
      return [u[0], v[0], d[0], u[1], v[1], d[1], u[2], v[2], d[2]];
    }
    /*
     * 朝向约定（必须与 readCornerOri / readEdgeFlip 的读数严格对应）：
     *   角块：0 → U/D 贴纸在 U/D 面；1 → 在 +x 面；2 → 在 +z 面
     *   棱块：0 → U/D 贴纸在 U/D 面；1 → 被翻到侧面
     * 每个角块的 U/D 贴纸恰好指向这三个方向之一，因此索引与方向一一对应。
     */
    function cornerUpDir(val) {
      if (val === 0) return [0, 1, 0];
      if (val === 1) return [1, 0, 0];
      return [0, 0, 1];
    }
    function edgeUpDir(val) { return val === 0 ? [0, 1, 0] : [1, 0, 0]; }

    /* ---------------- 打包状态 ----------------
     * st = { perm: Array(26), co: Array(8), eo: Array(12) }
     * perm[slot] = 该槽位上的 cubie 编号；co/eo 以「槽位」为索引。
     */
    function solvedPack() {
      const perm = new Array(26);
      for (let i = 0; i < 26; i++) perm[i] = i;
      return { perm, co: new Array(8).fill(0), eo: new Array(12).fill(0) };
    }
    const clonePack = (st) => ({ perm: st.perm.slice(), co: st.co.slice(), eo: st.eo.slice() });

    /** 由打包状态得到几何状态 */
    function toGeom(st) {
      const ori = new Array(26);
      for (let slot = 0; slot < 8; slot++) {
        ori[POS_OF_CORNER_SLOT[slot]] = frameOf(cornerUpDir(st.co[slot]));
      }
      for (let slot = 0; slot < 12; slot++) {
        ori[POS_OF_EDGE_SLOT[slot]] = frameOf(edgeUpDir(st.eo[slot]));
      }
      for (let i = 0; i < 26; i++) if (!ori[i]) ori[i] = IDENTITY.slice();
      return { perm: st.perm.slice(), ori };
    }
    /** 由几何状态得到打包状态（朝向值直接由贴纸方向反读，保证互逆） */
    function fromGeom(g) {
      const perm = g.perm.slice();
      const co = new Array(8), eo = new Array(12);
      for (let slot = 0; slot < 8; slot++) {
        const v = applyM(g.ori[POS_OF_CORNER_SLOT[slot]], [0, 1, 0]);
        co[slot] = v[1] !== 0 ? 0 : v[0] !== 0 ? (v[0] > 0 ? 1 : 2) : (v[2] > 0 ? 2 : 1);
      }
      for (let slot = 0; slot < 12; slot++) {
        const v = applyM(g.ori[POS_OF_EDGE_SLOT[slot]], [0, 1, 0]);
        eo[slot] = v[1] !== 0 ? 0 : 1;
      }
      return { perm, co, eo };
    }

    /**
     * 对打包状态执行一个动作（不构造完整几何状态，性能敏感）。
     * 排列用 TURN_DATA 的 posMap（纯置换，已验证与几何一致）；
     * 朝向用「解码 → 左乘旋转矩阵 → 重新编码」，与 toGeom/fromGeom 同源。
     */
    function applyPack(st, name) {
      const t = TURN_BY_NAME.get(name);
      const d = TURN_DATA.get(name);
      const perm = st.perm, co = st.co, eo = st.eo;
      const nPerm = perm.slice(), nCo = co.slice(), nEo = eo.slice();
      const writes = [];
      for (let from = 0; from < 26; from++) {
        if (!isAffected(from, t)) continue;
        writes.push([from, d.posMap[from], d.mat]);
      }
      for (let k = 0; k < writes.length; k++) {
        const from = writes[k][0], to = writes[k][1], mat = writes[k][2];
        nPerm[to] = perm[from];
        const c = CUBIES[from];
        if (c.kind === 'corner') {
          const m = mul(mat, frameOf(cornerUpDir(co[CORNER_SLOT[from]])));
          const v = [m[1], m[4], m[7]];
          nCo[CORNER_SLOT[to]] = v[1] !== 0 ? 0 : v[0] !== 0 ? (v[0] > 0 ? 1 : 2) : (v[2] > 0 ? 2 : 1);
        } else if (c.kind === 'edge') {
          const m = mul(mat, frameOf(edgeUpDir(eo[EDGE_SLOT[from]])));
          const v = [m[1], m[4], m[7]];
          nEo[EDGE_SLOT[to]] = v[1] !== 0 ? 0 : 1;
        }
      }
      st.perm = nPerm; st.co = nCo; st.eo = nEo;
      return st;
    }

    /* ---------------- 坐标读取 ---------------- */
    const twistOf = (st) => coToTwist(st.co);
    const flipOf = (st) => eoToFlip(st.eo);
    function sliceOf(st) {
      let mask = 0;
      for (let slot = 0; slot < 12; slot++) {
        if (SLICE_EDGES.indexOf(EDGE_SLOT[st.perm[POS_OF_EDGE_SLOT[slot]]]) >= 0) mask |= 1 << slot;
      }
      return maskToIdx(mask);
    }
    /** 前 8 个 U/D 棱块槽位的排列（Lehmer） */
    function epOf(st) {
      const a = new Array(8);
      for (let slot = 0; slot < 8; slot++) a[slot] = EDGE_SLOT[st.perm[POS_OF_EDGE_SLOT[slot]]];
      return perm8(a);
    }
    function cpOf(st) {
      const a = new Array(8);
      for (let slot = 0; slot < 8; slot++) a[slot] = CORNER_SLOT[st.perm[POS_OF_CORNER_SLOT[slot]]];
      return perm8(a);
    }
    function spOf(st) {
      const a = new Array(4);
      for (let k = 0; k < 4; k++) {
        const piece = EDGE_SLOT[st.perm[POS_OF_EDGE_SLOT[8 + k]]];
        a[k] = SLICE_EDGES.indexOf(piece);
      }
      return permToIdx(a);
    }

    /* ---------------- 由坐标合成打包状态（用于建表） ---------------- */
    /** 阶段一：twist/flip 给朝向，排列取「每个 cubie 在自己的槽位」 */
    function synthP1(twist, flip) {
      const st = solvedPack();
      st.co = twistToCo(twist);
      st.eo = flipToEo(flip);
      return st;
    }
    /** 阶段二：cp/ep/sp 决定排列，朝向全为 0 —— 与 spOf/epOf/cpOf 的编码一致 */
    function synthP2(cp, ep, sp) {
      const st = solvedPack();
      const cpArr = idxToPerm(cp, 8);
      for (let slot = 0; slot < 8; slot++) {
        st.perm[POS_OF_CORNER_SLOT[slot]] = POS_OF_CORNER_SLOT[cpArr[slot]];
      }
      const epArr = idxToPerm(ep, 8);
      for (let slot = 0; slot < 8; slot++) {
        st.perm[POS_OF_EDGE_SLOT[slot]] = POS_OF_EDGE_SLOT[epArr[slot]];
      }
      const spArr = idxToPerm(sp, 4);
      for (let k = 0; k < 4; k++) {
        st.perm[POS_OF_EDGE_SLOT[8 + k]] = POS_OF_EDGE_SLOT[SLICE_EDGES[spArr[k]]];
      }
      return st;
    }

    /* ---------------- 剪枝表 ---------------- */
    let distTwistSlice = null, distFlipSlice = null, distSpCp = null, distSpEp = null;
    let ready = false;

    let countTwistSlice = 0, countFlipSlice = 0;

    function buildDistTwistSlice(report) {
      const size = N_TWIST * N_SLICE;
      const dist = new Uint8Array(size).fill(255);
      dist[0] = 0;                                    // (twist=0, slice=0)
      let frontier = [solvedPack()];
      let depth = 0, visited = 1;
      while (frontier.length) {
        const next = [];
        for (let i = 0; i < frontier.length; i++) {
          const parent = frontier[i];
          for (let mi = 0; mi < N_P1_MOVES; mi++) {
            const st = applyPack(clonePack(parent), PHASE1_MOVES[mi]);
            const key = twistOf(st) * N_SLICE + sliceOf(st);
            if (dist[key] === 255) { dist[key] = depth + 1; next.push(st); visited++; }
          }
        }
        frontier = next; depth++;
        if (report) report(Math.min(1, depth / 12));
      }
      countTwistSlice = visited;
      distTwistSlice = dist;
    }

    function buildDistFlipSlice(report) {
      const size = N_FLIP * N_SLICE;
      const dist = new Uint8Array(size).fill(255);
      dist[0] = 0;
      let frontier = [solvedPack()];
      let depth = 0, visited = 1;
      while (frontier.length) {
        const next = [];
        for (let i = 0; i < frontier.length; i++) {
          const parent = frontier[i];
          for (let mi = 0; mi < N_P1_MOVES; mi++) {
            const st = applyPack(clonePack(parent), PHASE1_MOVES[mi]);
            const key = flipOf(st) * N_SLICE + sliceOf(st);
            if (dist[key] === 255) { dist[key] = depth + 1; next.push(st); visited++; }
          }
        }
        frontier = next; depth++;
        if (report) report(Math.min(1, depth / 12));
      }
      countFlipSlice = visited;
      distFlipSlice = dist;
    }

    /** (sp,cp) 与 (sp,ep) 两个 24×40320 的剪枝表 */
    function buildPhase2Dist(kind, report) {
      const size = N_SP * N_CP;
      const dist = new Uint8Array(size).fill(255);
      dist[0] = 0;
      const keyOf = kind === 'cp'
        ? (st) => spOf(st) * N_CP + cpOf(st)
        : (st) => spOf(st) * N_EP + epOf(st);
      let frontier = [solvedPack()];
      let depth = 0, visited = 1;
      while (frontier.length) {
        const next = [];
        for (let i = 0; i < frontier.length; i++) {
          const parent = frontier[i];
          for (let mi = 0; mi < N_P2_MOVES; mi++) {
            const st = applyPack(clonePack(parent), PHASE2_MOVES[mi]);
            const key = keyOf(st);
            if (dist[key] === 255) { dist[key] = depth + 1; next.push(st); visited++; }
          }
        }
        frontier = next; depth++;
        if (report) report(Math.min(1, depth / 18));
      }
      return { dist, visited };
    }

    /** 构建全部表。onProgress(fraction, label) */
    function build(onProgress) {
      const steps = [
        ['剪枝表 twist×slice', buildDistTwistSlice, 0.28],
        ['剪枝表 flip×slice', buildDistFlipSlice, 0.28],
        ['剪枝表 slice×corner', (r) => { const x = buildPhase2Dist('cp', r); distSpCp = x.dist; }, 0.22],
        ['剪枝表 slice×edge', (r) => { const x = buildPhase2Dist('ep', r); distSpEp = x.dist; }, 0.22],
      ];
      let base = 0;
      for (const [label, fn, weight] of steps) {
        if (onProgress) onProgress(base, label);
        fn((p) => { if (onProgress) onProgress(base + weight * Math.min(1, p), label); });
        base += weight;
        if (onProgress) onProgress(base, label);
      }
      ready = true;
      return true;
    }
    const isReady = () => ready;

    /* ---------------- IDA* ---------------- */
    function phase1(twist, flip, slice) {
      const h = (tw, fl, sl) => Math.max(
        distTwistSlice[tw * N_SLICE + sl],
        distFlipSlice[fl * N_SLICE + sl],
      );
      const path = [];
      const next = (tw, fl, sl, mi) => moveTables.p1(tw, fl, sl, mi);
      const dfs2 = (tw, fl, sl, g, bound, lastFace, lastAxis) => {
        const hv = h(tw, fl, sl);
        if (g + hv > bound) return g + hv;
        if (hv === 0 && tw === 0 && fl === 0 && sl === 0) return -1;
        let min = Infinity;
        for (let mi = 0; mi < N_P1_MOVES; mi++) {
          const name = PHASE1_MOVES[mi], face = name[0];
          if (face === lastFace) continue;
          const axis = TURN_BY_NAME.get(name).axis;
          if (axis === lastAxis && face === OPPOSITE_FACE[lastFace]) continue;
          const n = next(tw, fl, sl, mi);
          path.push(name);
          const r = dfs2(n[0], n[1], n[2], g + 1, bound, face, axis);
          if (r === -1) return -1;
          path.pop();
          if (r < min) min = r;
        }
        return min;
      };
      for (let bound = h(twist, flip, slice); bound <= 12; bound++) {
        path.length = 0;
        const r = dfs2(twist, flip, slice, 0, bound, '', -1);
        if (r === -1) return path.slice();
      }
      throw new Error('阶段一求解失败');
    }

    function phase2(cp, ep, sp) {
      const h = (s, c, e) => Math.max(distSpCp[s * N_CP + c], distSpEp[s * N_EP + e]);
      const path = [];
      const dfs = (c, e, s, g, bound, lastFace) => {
        const hv = h(s, c, e);
        if (g + hv > bound) return g + hv;
        if (hv === 0 && c === 0 && e === 0 && s === 0) return -1;
        let min = Infinity;
        for (let mi = 0; mi < N_P2_MOVES; mi++) {
          const name = PHASE2_MOVES[mi], face = name[0];
          if (face === lastFace) continue;
          const n = moveTables.p2(c, e, s, mi);
          path.push(name);
          const r = dfs(n[0], n[1], n[2], g + 1, bound, face);
          if (r === -1) return -1;
          path.pop();
          if (r < min) min = r;
        }
        return min;
      };
      for (let bound = h(sp, cp, ep); bound <= 18; bound++) {
        path.length = 0;
        const r = dfs(cp, ep, sp, 0, bound, '');
        if (r === -1) return path.slice();
      }
      throw new Error('阶段二求解失败');
    }

    /* ---------------- 搜索用坐标转移表（由几何合成状态推得） ---------------- */
    const moveTables = {
      p1: null, p2: null,
    };
    function buildMoveTables() {
      // 阶段一：twist×flip（slice 由真实几何推进）
      moveTables.p1 = (tw, fl, sl, mi) => {
        const st = synthP1(tw, fl);
        applyPack(st, PHASE1_MOVES[mi]);
        return [twistOf(st), flipOf(st), sliceOf(st)];
      };
      // 阶段二
      const cpMove = new Int32Array(N_CP * N_P2_MOVES);
      for (let idx = 0; idx < N_CP; idx++) {
        for (let mi = 0; mi < N_P2_MOVES; mi++) {
          const st = synthP2(idx, 0, 0);
          applyPack(st, PHASE2_MOVES[mi]);
          cpMove[idx * N_P2_MOVES + mi] = cpOf(st);
        }
      }
      const epMove = new Int32Array(N_EP * N_P2_MOVES);
      for (let idx = 0; idx < N_EP; idx++) {
        for (let mi = 0; mi < N_P2_MOVES; mi++) {
          const st = synthP2(0, idx, 0);
          applyPack(st, PHASE2_MOVES[mi]);
          epMove[idx * N_P2_MOVES + mi] = epOf(st);
        }
      }
      const spMove = new Int32Array(N_SP * N_P2_MOVES);
      for (let idx = 0; idx < N_SP; idx++) {
        for (let mi = 0; mi < N_P2_MOVES; mi++) {
          const st = synthP2(0, 0, idx);
          applyPack(st, PHASE2_MOVES[mi]);
          spMove[idx * N_P2_MOVES + mi] = spOf(st);
        }
      }
      moveTables.p2 = (c, e, s, mi) => [
        cpMove[c * N_P2_MOVES + mi],
        epMove[e * N_P2_MOVES + mi],
        spMove[s * N_P2_MOVES + mi],
      ];
    }

    /** 解算：返回动作名数组 */
    function solve(state) {
      if (!ready) throw new Error('求解表尚未构建，请先调用 Solver.build()');
      buildMoveTables();
      const st = fromGeom(state);
      const first = phase1(twistOf(st), flipOf(st), sliceOf(st));
      const mid = cloneState(state);
      applyMoves(mid, first);
      const m = fromGeom(mid);
      const second = phase2(cpOf(m), epOf(m), spOf(m));
      return first.concat(second);
    }

    return { build, isReady, solve, phase1, phase2,
      _internals: () => ({ distTwistSlice, distFlipSlice, distSpCp, distSpEp, maskToIdx }),
      maskToIdx,
    };
  })();

  return {
    CUBIES, CORNER_POS, CORNER_NAMES, EDGE_POS, EDGE_NAMES, SLICE_EDGES,
    POS_OF_CORNER_SLOT, POS_OF_EDGE_SLOT, CORNER_SLOT, EDGE_SLOT,
    TURNS, TURN_BY_NAME, TURN_INVERSE, PHASE1_MOVES, PHASE2_MOVES, TURN_DATA,
    IDENTITY, mul, applyM, rotMatrix, isAffected,
    solvedState, cloneState, applyTurn, applyMoves, isSolved,
    readCornerOri, readEdgeFlip, readCornerPerm, readEdgePerm, readEdgePermIdx, readSliceMask, readSlicePerm,
    readCornerSlots, readEdgeSlots8, readSlicePermArr, invertPerm,
    permToIdx, idxToPerm,
    Solver,
  };
});
