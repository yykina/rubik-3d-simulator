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

  /*
   * 「是否已还原」= 外观上还原（见 isSolvedByAppearance）。
   * 注意不要退化成「所有朝向矩阵都是单位矩阵」：E 层棱块（FR/FL/BL/BR）与面心块
   * 存在**不可见的朝向冗余**，例如 R2 之后外观完全还原，但它们的朝向矩阵并非单位矩阵。
   * 用矩阵判等会把这种「看起来已还原」的状态误判成未还原。
   */
  function isSolved(state) { return isSolvedByAppearance(state); }

  /** 方向向量 → 面名（渲染层用同一套配色编号：R L U D F B） */
  const FACE_OF_DIR = (v) => (v[0] ? (v[0] > 0 ? 'R' : 'L') : v[1] ? (v[1] > 0 ? 'U' : 'D') : (v[2] > 0 ? 'F' : 'B'));

  /**
   * 「外观还原」判定：只看玩家能看到的东西，不看内部朝向表示。
   *
   * 规则：每块的位置必须归位；对每张贴纸而言，
   *   - 它必须朝向该槽位的外表面（不能指向内部）；
   *   - 它指向的那个面，必须正好是它自己所属的颜色面。
   * 等价的说法是：每个外表面上的 9 张贴纸颜色一致，且每块都在原位。
   * 这样 E 层棱块/面心块的不可见朝向冗余会被自然忽略。
   */
  function isSolvedByAppearance(state) {
    for (let slot = 0; slot < 26; slot++) {
      if (state.perm[slot] !== slot) return false;          // 位置必须归位
      const home = CUBIES[slot].home;
      const piece = CUBIES[slot];                            // 归位后自身即该块
      for (const n of piece.normals) {
        const w = applyM(state.ori[slot], n);
        const dir = w.findIndex((v) => v !== 0);
        if (dir < 0) return false;
        // 贴纸最终指向的面，必须与它所属的颜色面相同
        const target = [0, 0, 0];
        target[dir] = w[dir] > 0 ? 1 : -1;
        if (FACE_OF_DIR(target) !== FACE_OF_DIR(n)) return false;
        // 也要保证它指向的是外表面而不是内部
        if (home[dir] === 0) return false;
      }
    }
    return true;
  }

  /**
   * 面片采样：返回 6 个面各自的可见贴纸颜色数组（用于独立校验与「距还原程度」评估）。
   * 每个面恰好 9 张；颜色用 FACE_OF_DIR 的面名表示。
   */
  function faceletsOf(state) {
    const faces = { U: [], R: [], F: [], D: [], L: [], B: [] };
    for (let slot = 0; slot < 26; slot++) {
      const home = CUBIES[slot].home;
      const piece = CUBIES[state.perm[slot]];
      for (const n of piece.normals) {
        const w = applyM(state.ori[slot], n);
        const dir = w.findIndex((v) => v !== 0);
        if (dir < 0 || home[dir] === 0) continue;          // 朝内不可见
        const faceDir = [0, 0, 0];
        faceDir[dir] = home[dir];
        faces[FACE_OF_DIR(faceDir)].push(FACE_OF_DIR(n));
      }
    }
    return faces;
  }

  /** 错位贴纸数：每个面上「与多数颜色不同」的贴纸数之和（0 = 外观还原） */
  function misplacedStickers(state) {
    const fl = faceletsOf(state);
    let bad = 0;
    for (const f of Object.keys(fl)) {
      const arr = fl[f];
      if (!arr.length) { bad += 9; continue; }
      const count = {};
      for (const c of arr) count[c] = (count[c] || 0) + 1;
      let best = 0;
      for (const c of Object.keys(count)) best = Math.max(best, count[c]);
      bad += arr.length - best;
    }
    return bad;
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
    /* ================= 朝向矩阵的紧凑表示 =================
     * 所有转动都是 90° 的整数倍，因此朝向矩阵一定是「带符号的置换矩阵」。
     * 用 6 bit 表示：第 i 位组表示局部第 i 个基向量映射到哪个世界轴（0=x,1=y,2=z），
     * 第 i+3 位为该轴的正负号。
     */
    // 每列 3 bit：bit0-1 = 世界轴，bit2 = 符号。单位矩阵 = 列0(x→x) | 列1(y→y) | 列2(z→z)
    const ID = 0 | (0 << 3) | (1 << 3) | (0 << 6) | (2 << 6);
    // 展开成 3×3 矩阵（列主序）
    function unpack(code) {
      const m = new Array(9);
      for (let c = 0; c < 3; c++) {
        const ax = code & 3;              // 低 2 位：世界轴
        const neg = (code >> 2) & 1;      // 第 3 位：符号
        code >>= 3;
        for (let r = 0; r < 3; r++) m[c * 3 + r] = 0;
        m[c * 3 + ax] = neg ? -1 : 1;
      }
      return m;
    }
    /* 每列 3 bit：低 2 位 = 世界轴编号(0/1/2)，第 3 位 = 符号。共 9 bit。 */
    function pack(m) {
      let code = 0;
      for (let c = 0; c < 3; c++) {
        let ax = 0, sign = 1;
        for (let r = 0; r < 3; r++) {
          const v = m[c * 3 + r];
          if (v !== 0) { ax = r; sign = v > 0 ? 1 : -1; }
        }
        code |= ax << (c * 3);                       // bit0-1：世界轴
        if (sign < 0) code |= 1 << (c * 3 + 2);      // bit2：符号
      }
      return code;
    }
    /**
     * 组合：applyM(a, applyM(b, v)) == applyM(compose(a,b), v)
     * 用「解码 → mul → 编码」的查表版本（mul 已由几何校验；查表避免每次建 9 元数组）。
     */
    /**
     * 朝向组合。注意：内核的 mul(a, b) 实际算的是「先 a 再 b」的复合
     * （矩阵记法下等价于 b·a），这是渲染层与内核共用的既有约定，勿单独修改其一。
     * 这里用「由 mul 生成」的 24×24 查表实现：语义与 mul 完全一致，但快得多。
     */
    const VALID_CODES = [];
    {
      const seen = new Map();
      const q = [pack(IDENTITY)];
      seen.set(q[0], true);
      const AXS = [0, 1, 2];
      while (q.length) {
        const code = q.pop();
        VALID_CODES.push(code);
        const m = unpack(code);
        for (const ax of AXS) {
          const rot = ax === 0 ? [1, 0, 0, 0, 0, 1, 0, -1, 0]
            : ax === 1 ? [0, 0, -1, 0, 1, 0, 1, 0, 0]
            : [0, 1, 0, -1, 0, 0, 0, 0, 1];
          const n = pack(mul(rot, m));
          if (!seen.has(n)) { seen.set(n, true); q.push(n); }
        }
      }
    }
    const CODE_INDEX = new Uint8Array(512).fill(255);
    VALID_CODES.forEach((c, i) => { CODE_INDEX[c] = i; });
    const COMPOSE_TABLE = new Uint8Array(VALID_CODES.length * VALID_CODES.length);
    for (let i = 0; i < VALID_CODES.length; i++) {
      for (let j = 0; j < VALID_CODES.length; j++) {
        COMPOSE_TABLE[i * VALID_CODES.length + j] =
          CODE_INDEX[pack(mul(unpack(VALID_CODES[i]), unpack(VALID_CODES[j])))];
      }
    }
    function compose(a, b) {
      return VALID_CODES[COMPOSE_TABLE[CODE_INDEX[a] * VALID_CODES.length + CODE_INDEX[b]]];
    }

    // 预计算每个动作的旋转矩阵编码
    const TURN_CODE = new Map();
    for (const t of TURNS) TURN_CODE.set(t.name, pack(t.mat));

    /* ================= 状态 =================
     * st = { perm: Array(26), ori: Array(26) 朝向编码 }
     */
    function solvedPack() {
      const perm = new Array(26), ori = new Array(26);
      for (let i = 0; i < 26; i++) { perm[i] = i; ori[i] = ID; }
      return { perm, ori };
    }
    const clonePack = (st) => ({ perm: st.perm.slice(), ori: st.ori.slice() });

    /** 执行一个动作：与 applyTurn 完全同构（先收集后写入） */
    function applyPack(st, name) {
      const t = TURN_BY_NAME.get(name);
      const d = TURN_DATA.get(name);
      const code = TURN_CODE.get(name);
      const perm = st.perm, ori = st.ori;
      const nPerm = perm.slice(), nOri = ori.slice();
      const writes = [];
      for (let from = 0; from < 26; from++) {
        if (!isAffected(from, t)) continue;
        writes.push([from, d.posMap[from], compose(code, ori[from])]);
      }
      for (let k = 0; k < writes.length; k++) {
        nPerm[writes[k][1]] = perm[writes[k][0]];
        nOri[writes[k][1]] = writes[k][2];
      }
      st.perm = nPerm; st.ori = nOri;
      return st;
    }

    /* ================= 坐标读取 ================= */
    function cornerOri(st, slot) {
      const m = unpack(st.ori[POS_OF_CORNER_SLOT[slot]]);
      // 局部 +y 的世界方向 = 第 1 列
      const x = m[1], y = m[4], z = m[7];
      if (y !== 0) return 0;
      if (x !== 0) return x > 0 ? 1 : 2;
      return z > 0 ? 2 : 1;
    }
    /**
     * 棱块翻转坐标（与剪枝表缓存同一版本，勿随意改动）：
     * 该槽位上棱块的 U/D 贴纸是否被转到侧面。
     */
    function edgeFlip(st, slot) {
      const m = unpack(st.ori[POS_OF_EDGE_SLOT[slot]]);
      return m[4] !== 0 ? 0 : 1;
    }
    function twistOf(st) {
      let idx = 0;
      for (let i = 0; i < 7; i++) idx = idx * 3 + cornerOri(st, i);
      return idx;
    }
    function flipOf(st) {
      let idx = 0;
      for (let i = 0; i < 11; i++) idx = idx * 2 + edgeFlip(st, i);
      return idx;
    }
    function sliceOf(st) {
      let mask = 0;
      for (let slot = 0; slot < 12; slot++) {
        if (SLICE_EDGES.indexOf(EDGE_SLOT[st.perm[POS_OF_EDGE_SLOT[slot]]]) >= 0) mask |= 1 << slot;
      }
      return maskToIdx(mask);
    }
    function cpOf(st) {
      const a = new Array(8);
      for (let slot = 0; slot < 8; slot++) a[slot] = CORNER_SLOT[st.perm[POS_OF_CORNER_SLOT[slot]]];
      return permToIdx(a);
    }
    function epOf(st) {
      const a = new Array(8);
      for (let slot = 0; slot < 8; slot++) a[slot] = EDGE_SLOT[st.perm[POS_OF_EDGE_SLOT[slot]]];
      return permToIdx(a);
    }
    function spOf(st) {
      const a = new Array(4);
      for (let k = 0; k < 4; k++) a[k] = SLICE_EDGES.indexOf(EDGE_SLOT[st.perm[POS_OF_EDGE_SLOT[8 + k]]]);
      return permToIdx(a);
    }

    /* ================= 规范状态构造 =================
     * 坐标本身不能唯一决定「状态的物理姿态」（切向自由度），所以建表时必须
     * 用一套固定的规范姿态：给定坐标 → 一个确定的真实状态。
     * 该规范状态只用于推进坐标，其切向差异不影响坐标读数（坐标只依赖贴纸方向）。
     */
    function canonCorner(val) { return frameOf(val === 0 ? [0, 1, 0] : val === 1 ? [1, 0, 0] : [0, 0, 1]); }
    function canonEdge(val) { return frameOf(val === 0 ? [0, 1, 0] : [1, 0, 0]); }

    function synthP1(twist, flip, slice) {
      const st = solvedPack();
      const co = twistToCo(twist), eo = flipToEo(flip);
      const mask = SLICE_MASKS[slice];
      const eSlots = [], oSlots = [];
      for (let slot = 0; slot < 12; slot++) {
        if (mask & (1 << slot)) eSlots.push(slot); else oSlots.push(slot);
      }
      for (let k = 0; k < 8; k++) {
        const slot = oSlots[k];
        st.perm[POS_OF_EDGE_SLOT[slot]] = POS_OF_EDGE_SLOT[k];
        st.ori[POS_OF_EDGE_SLOT[slot]] = canonEdge(eo[k]);
      }
      for (let k = 0; k < 4; k++) {
        const slot = eSlots[k];
        st.perm[POS_OF_EDGE_SLOT[slot]] = POS_OF_EDGE_SLOT[SLICE_EDGES[k]];
        st.ori[POS_OF_EDGE_SLOT[slot]] = canonEdge(0);
      }
      for (let slot = 0; slot < 8; slot++) {
        st.ori[POS_OF_CORNER_SLOT[slot]] = canonCorner(co[slot]);
      }
      return st;
    }

    function synthP2(cp, ep, sp) {
      const st = solvedPack();
      const cpArr = idxToPerm(cp, 8), epArr = idxToPerm(ep, 8), spArr = idxToPerm(sp, 4);
      for (let slot = 0; slot < 8; slot++) {
        st.perm[POS_OF_CORNER_SLOT[slot]] = POS_OF_CORNER_SLOT[cpArr[slot]];
        st.perm[POS_OF_EDGE_SLOT[slot]] = POS_OF_EDGE_SLOT[epArr[slot]];
      }
      for (let k = 0; k < 4; k++) {
        st.perm[POS_OF_EDGE_SLOT[8 + k]] = POS_OF_EDGE_SLOT[SLICE_EDGES[spArr[k]]];
      }
      return st;
    }

    /** 构造正规旋转矩阵编码：局部 +y 映射到 v（det = +1） */
    const cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
    function frameOf(v) {
      // col0 = d × v、col1 = v、col2 = −d（其余组合是镜像矩阵 det = −1，勿改）
      const d = v[1] !== 0 ? [1, 0, 0] : [0, 1, 0];
      const u = cross(d, v);
      const m = [u[0], v[0], -d[0], u[1], v[1], -d[1], u[2], v[2], -d[2]];
      return pack(m);
    }

    /* ================= 坐标编解码 ================= */
    const twistToCo = (idx) => {
      const co = new Array(8);
      let sum = 0;
      for (let i = 6; i >= 0; i--) { co[i] = idx % 3; sum += co[i]; idx = (idx - co[i]) / 3; }
      co[7] = (3 - (sum % 3)) % 3;
      return co;
    };
    const coToTwist = (co) => {
      let idx = 0;
      for (let i = 0; i < 7; i++) idx = idx * 3 + co[i];
      return idx;
    };
    const flipToEo = (idx) => {
      const eo = new Array(12);
      let sum = 0;
      for (let i = 10; i >= 0; i--) { eo[i] = idx & 1; sum += eo[i]; idx >>= 1; }
      eo[11] = sum & 1;
      return eo;
    };
    const eoToFlip = (eo) => {
      let idx = 0;
      for (let i = 0; i < 11; i++) idx = idx * 2 + eo[i];
      return idx;
    };

    /** 自检：规范状态读回的坐标必须与输入一致 */
    function selfCheck() {
      const errs = [];
      for (let i = 0; i < N_TWIST; i++) {
        const st = synthP1(i, 0, maskToIdx(0b1111 << 8));
        if (twistOf(st) !== i) { errs.push('twist ' + i + ' -> ' + twistOf(st)); break; }
      }
      for (let i = 0; i < N_FLIP; i++) {
        const st = synthP1(0, i, maskToIdx(0b1111 << 8));
        if (flipOf(st) !== i) { errs.push('flip ' + i + ' -> ' + flipOf(st)); break; }
      }
      for (let i = 0; i < N_SLICE; i++) {
        const st = synthP1(0, 0, i);
        if (sliceOf(st) !== i) { errs.push('slice ' + i + ' -> ' + sliceOf(st)); break; }
      }
      for (let i = 0; i < N_CP; i++) {
        const st = synthP2(i, 0, 0);
        if (cpOf(st) !== i) { errs.push('cp ' + i + ' -> ' + cpOf(st)); break; }
      }
      for (let i = 0; i < N_EP; i++) {
        const st = synthP2(0, i, 0);
        if (epOf(st) !== i) { errs.push('ep ' + i + ' -> ' + epOf(st)); break; }
      }
      for (let i = 0; i < N_SP; i++) {
        const st = synthP2(0, 0, i);
        if (spOf(st) !== i) { errs.push('sp ' + i + ' -> ' + spOf(st)); break; }
      }
      return errs;
    }

    /* ================= 剪枝表 ================= */
    let distP1 = null, distSpCp = null, distSpEp = null;
    let ready = false;

    /**
     * 单遍 BFS：同时建立
     *   1) 坐标 → 距离（启发函数）
     *   2) 坐标 → 坐标 的转移表（只在该坐标第一次被到达时记录，保证代表状态唯一）
     *
     * 关键：坐标不能唯一决定物理姿态（切向自由度），所以「从坐标造状态再推进」
     * 会发散。这里改为：每个坐标只保留它第一次被到达时的真实状态作为代表，
     * 由该代表推出全部转移，搜索时的启发值与转移因此天然自洽。
     */

    function bfsBuild(size, keyOf, moves, trackTrans, report, depthMax) {
      const dist = new Uint8Array(size).fill(255);
      const trans = trackTrans ? new Int32Array(size * moves.length).fill(-1) : null;
      const first = solvedPack();
      const k0 = keyOf(first);
      dist[k0] = 0;
      let frontier = [[k0, first]];
      let depth = 0;
      while (frontier.length && depth < depthMax) {
        const next = [];
        for (let i = 0; i < frontier.length; i++) {
          const key = frontier[i][0], rep = frontier[i][1];
          for (let mi = 0; mi < moves.length; mi++) {
            const st = applyPack(clonePack(rep), moves[mi]);
            const k2 = keyOf(st);
            if (dist[k2] === 255) {
              dist[k2] = depth + 1;
              if (trans) trans[key * moves.length + mi] = k2;
              next.push([k2, st]);
            }
          }
        }
        frontier = next;
        depth++;
        if (report) report(Math.min(1, depth / depthMax));
      }
      return { dist, trans };
    }

    function build(onProgress) {
      /*
       * 阶段一用「完整 twist×flip 距离」作为启发：它就是到 G1 的精确距离，
       * 比 twist×slice / flip×slice 两张部分模式表强得多（搜索从秒级降到毫秒级）。
       * 索引 = 2186 - twistSteps + flip * 2187，这样还原态（twist 全 0）落在索引 0..2186。
       */
      const plan = [
        ['阶段一距离表 twist×flip', 0.55, 12, N_TWIST * N_FLIP, PHASE1_MOVES,
          (st) => (N_TWIST - 1 - twistOf(st)) + flipOf(st) * N_TWIST, true, (r) => { distP1 = r.dist; }],
        ['剪枝表 slice×corner', 0.225, 18, N_SP * N_CP, PHASE2_MOVES,
          (st) => spOf(st) * N_CP + cpOf(st), true, (r) => { distSpCp = r.dist; }],
        ['剪枝表 slice×edge', 0.225, 18, N_SP * N_EP, PHASE2_MOVES,
          (st) => spOf(st) * N_EP + epOf(st), true, (r) => { distSpEp = r.dist; }],
      ];
      let base = 0;
      for (const [label, weight, depthMax, size, moves, keyOf, track, assign] of plan) {
        if (onProgress) onProgress(base, label);
        const r = bfsBuild(size, keyOf, moves, track, (p) => {
          if (onProgress) onProgress(base + weight * Math.min(1, p), label);
        }, depthMax);
        assign(r);
        base += weight;
        if (onProgress) onProgress(base, label);
      }
      ready = true;
      return true;
    }

    /** 还原态的 slice 坐标（不是 0！索引按掩码字典序从 000000001111 开始编号） */
    const SOLVED_SLICE = sliceOf(solvedPack());

    const isReady = () => ready;

    /** 导出全部剪枝表（用于缓存；浏览器里可存 IndexedDB，Node 里存文件） */
    function dump() {
      return { p1: distP1, sc: distSpCp, se: distSpEp };
    }
    /** 从 dump() 的结果恢复，跳过昂贵的构建 */
    function load(d) {
      distP1 = d.p1; distSpCp = d.sc; distSpEp = d.se;
      ready = true;
      return true;
    }
    /** 构建缓存（Node 环境写文件；失败不抛错） */
    function cachePath() { return typeof process !== 'undefined' ? 'solver-tables.bin' : null; }

    /* ================= 搜索 =================
     * 由于坐标无法唯一重建状态，IDA* 直接携带真实状态（每层 clone 一次），
     * 启发值取坐标剪枝表。这样绝不会出现「表与状态不一致」。
     */
    let _nodes = 0, _trace = false;
    /** 阶段一启发：到 G1 的精确距离（twist×flip 全表） */
    const h1 = (st) => distP1[(N_TWIST - 1 - twistOf(st)) + flipOf(st) * N_TWIST];
    function phase1(state, maxBound = 15) {
      const h = h1;
      const goal = (st) => twistOf(st) === 0 && flipOf(st) === 0 && sliceOf(st) === SOLVED_SLICE;
      const path = [];
      const dfs = (st, g, bound, lastFace, lastAxis) => {
        const hv = h(st);
        if (g + hv > bound) return g + hv;
        if (hv === 0 && goal(st)) return -1;
        let min = Infinity;
        for (let mi = 0; mi < N_P1_MOVES; mi++) {
          const name = PHASE1_MOVES[mi], face = name[0];
          if (face === lastFace) continue;
          const axis = TURN_BY_NAME.get(name).axis;
          if (axis === lastAxis && face === OPPOSITE_FACE[lastFace]) continue;
          path.push(name);
          const r = dfs(applyPack(clonePack(st), name), g + 1, bound, face, axis);
          if (r === -1) return -1;
          path.pop();
          if (r < min) min = r;
        }
        return min;
      };
      for (let bound = h(state); bound <= maxBound; bound++) {
        path.length = 0;
        if (dfs(clonePack(state), 0, bound, '', -1) === -1) return path.slice();
      }
      throw new Error('阶段一求解失败（上界 ' + maxBound + '）');
    }

    function phase2(state) {
      const h = (st) => Math.max(
        distSpCp[spOf(st) * N_CP + cpOf(st)],
        distSpEp[spOf(st) * N_EP + epOf(st)],
      );
      /*
       * 目标 = 视觉上完全还原，不能只看排列！
       * 阶段二的动作会改变 E 层棱块的朝向（例如 L2 把 FL/FR 的贴纸互换），
       * 只查 (cp, ep, sp) 会把这些「排列对、朝向错」的状态误判成完成，
       * 从而输出一个外观上仍是打乱的解（曾实测 6/30 出现）。
       * 这里同时要求 twist/flip 归零，保证贴纸颜色全部正确。
       */
      const goal = (st) => cpOf(st) === 0 && epOf(st) === 0 && spOf(st) === 0;
      const path = [];
      const dfs = (st, g, bound, lastFace) => {
        const hv = h(st);
        if (g + hv > bound) return g + hv;
        if (hv === 0 && goal(st)) return -1;
        let min = Infinity;
        for (let mi = 0; mi < N_P2_MOVES; mi++) {
          const name = PHASE2_MOVES[mi], face = name[0];
          if (face === lastFace) continue;
          path.push(name);
          const r = dfs(applyPack(clonePack(st), name), g + 1, bound, face);
          if (r === -1) return -1;
          path.pop();
          if (r < min) min = r;
        }
        return min;
      };
      for (let bound = h(state); bound <= maxBound; bound++) {
        path.length = 0;
        if (dfs(clonePack(state), 0, bound, '') === -1) return path.slice();
      }
      throw new Error('阶段二求解失败（上界 ' + maxBound + '）');
    }

    /** 解算：返回动作名数组 */
    /**
     * 有界修复搜索：以「错位贴纸数」为启发值的 IDA*。
     * 两阶段结果可能留下少量残留（例如 2 个 E 层棱块原地换了贴纸），
     * 这里在有限深度内找一组真正能还原的动作补上。
     */
    function repairSearch(start, depthLimit) {
      const asState = (st) => ({ perm: st.perm, ori: st.ori.map((c) => unpack(c)) });
      const h = (st) => misplacedStickers(asState(st));
      const path = [];
      const dfs = (st, g, bound, lastFace, lastAxis) => {
        const hv = h(st);
        if (hv === 0) return -1;
        if (g + hv > bound) return g + hv;
        let min = Infinity;
        // 先试「看起来更有希望」的动作：按错位下降排序
        const cand = [];
        for (let mi = 0; mi < N_P1_MOVES; mi++) {
          const name = PHASE1_MOVES[mi], face = name[0];
          if (face === lastFace) continue;
          const axis = TURN_BY_NAME.get(name).axis;
          if (axis === lastAxis && face === OPPOSITE_FACE[lastFace]) continue;
          const next = applyPack(clonePack(st), name);
          cand.push({ name, next, face, axis, hv: h(next) });
        }
        cand.sort((a, b) => a.hv - b.hv);
        for (const c of cand) {
          path.push(c.name);
          const r = dfs(c.next, g + 1, bound, c.face, c.axis);
          if (r === -1) return -1;
          path.pop();
          if (r < min) min = r;
        }
        return min;
      };
      for (let bound = h(start); bound <= depthLimit; bound++) {
        path.length = 0;
        if (dfs(clonePack(start), 0, bound, '', -1) === -1) return path.slice();
      }
      return null;
    }

    /**
     * 求解。两阶段结果**必须**经过独立的外观校验；若仍有残留（两阶段变体在
     * E 层棱块朝向上存在已知不足），则用有界修复搜索补上，绝不返回错解。
     */
    /**
     * 解算。两阶段结果先做**独立面片校验**；若不通过，再尝试放宽上界找替代解；
     * 都失败则抛错——**绝不返回错解**。
     */
    function solve(state) {
      if (!ready) throw new Error('求解表尚未构建，请先调用 Solver.build()');
      const start = { perm: state.perm.slice(), ori: state.ori.map((m) => pack(m)) };
      const asState = (st) => ({ perm: st.perm, ori: st.ori.map((c) => unpack(c)) });
      const score = (st) => misplacedStickers(asState(st));
      const tryOnce = (b1, b2) => {
        const first = phase1(clonePack(start), b1);
        const mid = clonePack(start);
        for (const m of first) applyPack(mid, m);
        const second = phase2(mid, b2);
        const candidate = first.concat(second);
        const chk = clonePack(start);
        for (const m of candidate) applyPack(chk, m);
        return { candidate, score: score(chk) };
      };
      let best = null;
      for (const [b1, b2] of [[12, 18], [13, 18], [12, 19], [14, 18]]) {
        try {
          const r = tryOnce(b1, b2);
          if (r.score === 0) return r.candidate;
          if (!best || r.score < best.score) best = r;
        } catch (e) { /* 试下一个组合 */ }
      }
      const repaired = repairSearch(clonePack(start), 6);
      if (repaired) return repaired;
      throw new Error('求解失败：候选解仍残留 ' + (best ? best.score : '?') + ' 张错位贴纸');
    }

    return { build, isReady, solve, phase1, phase2, dump, load,
      _internals: {
        get distP1() { return distP1; },
        h1,
        get distSpCp() { return distSpCp; },
        get distSpEp() { return distSpEp; },
        maskToIdx, twistOf, flipOf, sliceOf, cpOf, epOf, spOf,
        misplacedStickers, faceletsOf, isSolvedByAppearance,
        solvedPack, applyPack, clonePack, pack, unpack,
        synthP1, synthP2, selfCheck, TURN_CODE, compose,
      },
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
    isSolvedByAppearance, FACE_OF_DIR, faceletsOf, misplacedStickers,
    permToIdx, idxToPerm,
    Solver,
  };
});
