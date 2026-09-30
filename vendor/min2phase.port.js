/*
 * min2phase-solver.js — 成熟的 Kociemba 两阶段求解器（min2phase）适配层
 *
 * 来源：npm 包 `min2phase` 的打包产物中**自包含**的低层求解器部分
 *      （原文：`module.exports.solve = function(c) { ... }`，只依赖 {cp,co,ep,eo} 数组）。
 *      上层包装依赖 kpuzzle/alg 两个外部包，这里不使用，因此只移植低层部分。
 * 许可：MIT（见文件末尾注释）。
 *
 * 本文件提供：
 *   Min2Phase.init()                  —— 首次调用会构建全部剪枝表（约 1~3 秒）
 *   Min2Phase.solve(cp, co, ep, eo)   —— 返回动作字符串，如 "U R2 F' ..."
 *   Min2Phase.toCubie(cubeState)      —— 用本项目的 core 状态转成四组数组
 *
 * 索引约定（与 min2phase 一致，顺序 U R F D L B）：
 *   cp[piece] = 槽位      角块 0..7 = URF UFL ULB UBR DFR DLF DBL DRB
 *   ep[piece] = 槽位      棱块 0..11 = UR UF UL UB DR DF DL DB FR FL BL BR
 *   co[slot]  = 朝向 0/1/2, eo[slot] = 翻转 0/1
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Min2Phase = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ===================== 以下是 min2phase 的低层实现（原样移植） ===================== */
  const IMPL = (function () {
    function createArray(length) { const arr = Array(length); for (let i = 0; i < length; i++) arr[i] = 0; return arr; }
    function bitCount(i) { return (i = (858993459 & (i -= (i >>> 1) & 1431655765)) + ((i >>> 2) & 858993459)) + (i >>> 8) + (i >>> 4) & 15; }
    function get8Parity(idx) { let p = 0; for (let i = 6; i >= 0; i--) { p += idx % (8 - i); idx = ~~(idx / (8 - i)); } return p & 1; }
    function get12Parity(idx) { let p = 0; for (let i = 10; i >= 0; i--) { p += idx % (12 - i); idx = ~~(idx / (12 - i)); } return p & 1; }
    function binarySearch(arr, key) {
      const length = arr.length;
      if (key <= arr[length - 1]) {
        let l = 0, r = length - 1;
        while (l <= r) { const mid = (l + r) >>> 1, val = arr[mid]; if (key > val) l = mid + 1; else { if (!(key < val)) return mid; r = mid - 1; } }
      }
      return 65535;
    }
    const fact = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800, 39916800, 479001600];
    const perm3 = [[11, 10, 9], [10, 11, 9], [11, 9, 10], [9, 11, 10], [10, 9, 11], [9, 10, 11]];
    const ud2std = [0, 1, 2, 4, 7, 9, 10, 11, 13, 16];
    const std2ud = createArray(18);
    const Cnk = (function (length1, length2) {
      const arr = Array(length1);
      for (let i = 0; i < length1; i++) { arr[i] = Array(length2); for (let j = 0; j < length2; j++) arr[i][j] = 0; }
      return arr;
    })(12, 13);
    const move2str = ['U ', 'U2', "U'", 'R ', 'R2', "R'", 'F ', 'F2', "F'", 'D ', 'D2', "D'", 'L ', 'L2', "L'", 'B ', 'B2', "B'"];
    const urfMove = [
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
      [6, 7, 8, 0, 1, 2, 3, 4, 5, 15, 16, 17, 9, 10, 11, 12, 13, 14],
      [3, 4, 5, 6, 7, 8, 0, 1, 2, 12, 13, 14, 15, 16, 17, 9, 10, 11],
      [2, 1, 0, 5, 4, 3, 8, 7, 6, 11, 10, 9, 14, 13, 12, 17, 16, 15],
      [8, 7, 6, 2, 1, 0, 5, 4, 3, 17, 16, 15, 11, 10, 9, 14, 13, 12],
      [5, 4, 3, 8, 7, 6, 2, 1, 0, 14, 13, 12, 17, 16, 15, 11, 10, 9],
    ];
    let i, j, idx2;
    let depth = 0, done = 0;
    for (i = 0; i < 12; i++) { Cnk[i][0] = 1; Cnk[i][i] = 1; Cnk[i][i + 1] = 0; for (j = 1; j < i; j++) Cnk[i][j] = Cnk[i - 1][j - 1] + Cnk[i - 1][j]; }
    for (i = 0; i < 10; i++) std2ud[ud2std[i]] = i;
    const ckmv = Array(19), ckmv2 = Array(11);
    ckmv[18] = Array(18); ckmv2[10] = Array(10);
    for (i = 0; i < 18; i++) { ckmv[i] = Array(18); for (j = 0; j < 18; j++) ckmv[i][j] = ~~(i / 3) == ~~(j / 3) || ~~(i / 3) % 3 == ~~(j / 3) % 3 && i >= j; ckmv[18][i] = false; }
    for (i = 0; i < 10; i++) { ckmv2[i] = Array(10); for (j = 0; j < 10; j++) ckmv2[i][j] = ckmv[ud2std[i]][ud2std[j]]; ckmv2[10][i] = false; }

    function CubieCube() {
      this.cp = [0, 1, 2, 3, 4, 5, 6, 7]; this.co = [0, 0, 0, 0, 0, 0, 0, 0];
      this.ep = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; this.eo = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      this.getFlip = function () { let idx = 0; for (let i = 0; i < 11; i++) idx |= this.eo[i] << i; return idx; };
      this.getFlipSym = function () {
        if (FlipR2S !== 0) return FlipR2S[this.getFlip()];
        for (let k = 0; k < 16; k += 2) { EdgeConjugate(this, SymInv[k], temps); const idx = binarySearch(FlipS2R, temps.getFlip()); if (idx != 65535) return idx << 3 | k >>> 1; }
        return 0;
      };
      this.setFlip = function (idx) {
        this.eo[11] = (function (i) { i ^= i >>> 1; i ^= i >>> 2; i ^= i >>> 4; return 1 & (i ^= i >>> 8); })(idx);
        for (let i = 0; i < 11; i++) { this.eo[i] = 1 & idx; idx >>>= 1; }
      };
      this.getTwist = function () { let idx = 0; for (let i = 0; i < 7; i++) { idx *= 3; idx += this.co[i]; } return idx; };
      this.getTwistSym = function () {
        if (TwistR2S != null) return TwistR2S[this.getTwist()];
        for (let k = 0; k < 16; k += 2) { CornConjugate(this, SymInv[k], temps); const idx = binarySearch(TwistS2R, temps.getTwist()); if (idx != 65535) return idx << 3 | k >>> 1; }
        return 0;
      };
      this.setTwist = function (idx) { let twst = 0; for (let i = 6; i >= 0; i--) { twst += this.co[i] = idx % 3; idx = ~~(idx / 3); } this.co[7] = (15 - twst) % 3; };
      this.getUDSlice = function () { let idx = 0, r = 4; for (let i = 0; i < 12; i++) if (this.ep[i] >= 8) { idx += Cnk[11 - i][r]; r--; } return idx; };
      this.setUDSlice = function (idx) { for (let r = 4, i = 0; i < 12; i++) { if (idx >= Cnk[11 - i][r]) { idx -= Cnk[11 - i][r]; r--; this.ep[i] = 11 - r; } else this.ep[i] = i + r - 4; } };
      this.getMPerm = function () { let m = 1 << this.ep[11], idx = 0; for (let i = 10; i >= 8; --i) { const t = 1 << this.ep[i]; idx += bitCount(m & t - 1) * fact[11 - i]; m |= t; } return idx; };
      this.setMPerm = function (idx) { this.ep[11] = 8; for (let i = 10; i >= 8; i--) { this.ep[i] = idx % (12 - i) + 8; idx = ~~(idx / (12 - i)); for (let j = i + 1; j < 12; j++) if (this.ep[j] >= this.ep[i]) this.ep[j]++; } };
      this.getMid3 = function () {
        let idxA = 0, idxB = 0, mask = 0, r = 3;
        for (let i = 11; i >= 0; i--) if (this.ep[i] >= 9) { idxA += Cnk[i][r--]; const t = 1 << this.ep[i]; idxB += bitCount(mask & t - 1) * fact[2 - r]; mask |= t; }
        return 6 * idxA + idxB;
      };
      this.setMid3 = function (idxA) {
        const edge = perm3[idxA % 6]; idxA = ~~(idxA / 6);
        for (let r = 3, i = 11; i >= 0; i--) { if (idxA >= Cnk[i][r]) { idxA -= Cnk[i][r--]; this.ep[i] = edge[2 - r]; } else this.ep[i] = 8 - i + r; }
      };
      this.getURtoUL = function () { let idxA = 0, idxB = 0, mask = 0, r = 3; for (let i = 11; i >= 0; i--) if (this.ep[i] <= 2) { idxA += Cnk[i][r--]; const t = 1 << this.ep[i]; idxB += bitCount(mask & t - 1) * fact[2 - r]; mask |= t; } return 6 * idxA + idxB; };
      this.getDRtoDL = function () { let idxA = 0, idxB = 0, mask = 0, r = 3; for (let i = 11; i >= 0; i--) if (4 <= this.ep[i] && this.ep[i] <= 6) { idxA += Cnk[i][r--]; const t = 1 << this.ep[i]; idxB += bitCount(mask & t - 1) * fact[2 - r]; mask |= t; } return 6 * idxA + idxB; };
      this.setEdgePerm = function (idx) { this.ep[11] = 0; for (let i = 10; i >= 0; i--) { this.ep[i] = idx % (12 - i); idx = ~~(idx / (12 - i)); for (let j = i + 1; j < 12; j++) if (this.ep[j] >= this.ep[i]) this.ep[j]++; } };
      this.getCPermSym = function () {
        if (EPermR2S != null) { let idx = EPermR2S[get8Perm(this.cp)]; return idx ^= e2c[15 & idx]; }
        for (let k = 0; k < 16; k++) { CornConjugate(this, SymInv[k], temps); const idx = binarySearch(CPermS2R, get8Perm(temps.cp)); if (idx != 65535) return idx << 4 | k; }
        return 0;
      };
      this.getEPermSym = function () {
        if (EPermR2S != null) return EPermR2S[get8Perm(this.ep)];
        for (let k = 0; k < 16; k++) { EdgeConjugate(this, SymInv[k], temps); const idx = binarySearch(EPermS2R, get8Perm(temps.ep)); if (idx != 65535) return idx << 4 | k; }
        return 0;
      };
      this.URFConjugate = function () { CornMult(urf2, this, temps); CornMult(temps, urf1, this); EdgeMult(urf2, this, temps); EdgeMult(temps, urf1, this); };
      this.invCubieCube = function () {
        for (let edge = 0; edge < 12; edge++) temps.ep[this.ep[edge]] = edge;
        for (let edge = 0; edge < 12; edge++) temps.eo[edge] = this.eo[temps.ep[edge]];
        for (let corn = 0; corn < 8; corn++) temps.cp[this.cp[corn]] = corn;
        for (let corn = 0; corn < 8; corn++) { let ori = this.co[temps.cp[corn]]; temps.co[corn] = -ori; if (temps.co[corn] < 0) temps.co[corn] += 3; }
        this.copy(temps);
      };
      this.init = function (cperm, twist, eperm, flip) { set8Perm(this.cp, cperm); this.setTwist(twist); this.setEdgePerm(eperm); this.setFlip(flip); };
      this.copy = function (c) { for (let i = 0; i < 8; i++) { this.cp[i] = c.cp[i]; this.co[i] = c.co[i]; } for (i = 0; i < 12; i++) { this.ep[i] = c.ep[i]; this.eo[i] = c.eo[i]; } };
    }
    const cctemp = new CubieCube(), temps = new CubieCube();

    function set8Perm(arr, idx) {
      let val = 1985229328;
      for (let i = 0; i < 7; i++) { const p = fact[7 - i]; let v = ~~(idx / p); idx %= p; v <<= 2; arr[i] = val >> v & 7; const m = (1 << v) - 1; val = (val & m) + (val >> 4 & ~m); }
      arr[7] = val;
    }
    function get8Perm(arr) {
      let idx = 0, val = 1985229328;
      for (let i = 0; i < 7; i++) { const v = arr[i] << 2; idx = (8 - i) * idx + (val >> v & 7); val -= 286331152 << v; }
      return idx;
    }
    function CornMult(a, b, prod) {
      for (let corn = 0; corn < 8; corn++) {
        prod.cp[corn] = a.cp[b.cp[corn]];
        const oriA = a.co[b.cp[corn]], oriB = b.co[corn]; let ori = oriA;
        ori += oriA < 3 ? oriB : 3 - oriB; ori %= 3; if (oriA < 3 !== oriB < 3) ori += 3;
        prod.co[corn] = ori;
      }
    }
    function EdgeMult(a, b, prod) { for (let ed = 0; ed < 12; ed++) { prod.ep[ed] = a.ep[b.ep[ed]]; prod.eo[ed] = b.eo[ed] ^ a.eo[b.ep[ed]]; } }
    function CornConjugate(a, idx, b) { CornMult(CubeSym[SymInv[idx]], a, cctemp); CornMult(cctemp, CubeSym[idx], b); }
    function EdgeConjugate(a, idx, b) { EdgeMult(CubeSym[SymInv[idx]], a, cctemp); EdgeMult(cctemp, CubeSym[idx], b); }

    const CubeSym = Array(16), moveCube = Array(18), SymInv = Array(16), SymMult = Array(16),
      SymMove = Array(16), Sym8Mult = Array(8), Sym8Move = Array(8), Sym8MultInv = Array(8), SymMoveUD = Array(16),
      FlipS2R = Array(336), TwistS2R = Array(324), CPermS2R = Array(2768), EPermS2R = CPermS2R,
      FlipR2S = Array(2048), TwistR2S = Array(2187), EPermR2S = createArray(40320);
    let FlipR2Sflag = 0;
    for (i = 0; i < 40320; i++) EPermR2S[i] = 0;
    const MtoEPerm = Array(40320), merge = Array(56);
    const e2c = [0, 0, 0, 0, 1, 3, 1, 3, 1, 3, 1, 3, 0, 0, 0, 0];
    const urf1 = new CubieCube(); urf1.init(2531, 1373, 67026819, 1877);
    const urf2 = new CubieCube(); urf2.init(2089, 1906, 322752913, 255);
    const UDSliceMove = Array(495), TwistMove = Array(324), FlipMove = Array(336), UDSliceConj = Array(495),
      UDSliceTwistPrun = Array(160380), UDSliceFlipPrun = Array(166320), TwistFlipPrun = Array(870912),
      Mid3Move = Array(1320), Mid32MPerm = Array(24), CParity = Array(87), CPermMove = Array(2768),
      EPermMove = Array(2768), MPermMove = Array(24), MPermConj = Array(24),
      MCPermPrun = Array(66432), MEPermPrun = Array(66432);
    let urfidx;
    const move = Array(31), corn = Array(20), csym = Array(20), mid3 = Array(20), e1 = Array(20), e2 = Array(20),
      twist = Array(6), tsym = Array(6), flip = Array(6), fsym = Array(6), slice = Array(6),
      corn0 = Array(6), csym0 = Array(6), mid30 = Array(6), e10 = Array(6), e20 = Array(6), prun = Array(6);
    let length1 = 0, maxlength2 = 0, sol = 999, valid1 = 0, valid2 = 0, solution = '';

    function phase1(twist, tsym, flip, fsym, slice, maxl, lm) {
      if (twist == 0 && flip == 0 && slice == 0 && maxl < 5) {
        return maxl == 0 && (function () {
          valid2 = Math.min(valid2, valid1);
          for (let i = valid1; i < length1; i++) {
            const m = move[i];
            corn[i + 1] = CPermMove[corn[i]][SymMove[csym[i]][m]];
            csym[i + 1] = SymMult[15 & corn[i + 1]][csym[i]]; corn[i + 1] >>>= 4;
            mid3[i + 1] = Mid3Move[mid3[i]][m];
          }
          valid1 = length1;
          const mid = Mid32MPerm[mid3[length1] % 24];
          let prun0 = MCPermPrun[24 * corn[length1] + MPermConj[mid][csym[length1]]];
          if (prun0 >= maxlength2) return false;
          for (let i = valid2; i < length1; i++) { e1[i + 1] = Mid3Move[e1[i]][move[i]]; e2[i + 1] = Mid3Move[e2[i]][move[i]]; }
          valid2 = length1;
          const cornx = corn[length1];
          const ex = 4032 * merge[~~(e1[length1] / 6)][~~(e2[length1] / 6)] + 12 * e1[length1] + e2[length1] % 6 * 2
            + (CParity[cornx >>> 3] >>> (7 & cornx) & 1 ^ (function (idx) { let p = 0; for (let i = 2; i >= 0; i--) { p += idx % (4 - i); idx = ~~(idx / (4 - i)); } return p & 1; })(mid));
          let edge = MtoEPerm[ex]; const esym = 15 & edge; edge >>>= 4;
          prun0 = Math.max(MEPermPrun[24 * edge + MPermConj[mid][esym]], prun0);
          if (prun0 >= maxlength2) return false;
          const lm2 = length1 == 0 ? 10 : std2ud[3 * ~~(move[length1 - 1] / 3) + 1];
          for (let i = prun0; i < maxlength2; i++) {
            if (phase2(edge, esym, corn[length1], csym[length1], mid, i, length1, lm2)) {
              sol = length1 + i;
              let sb = ''; let urf = urfidx; urf = (urf + 3) % 6;
              if (urf < 3) {
                for (let s = 0; s < length1; s++) sb += move2str[urfMove[urf][move[s]]] + ' ';
                for (let s = length1; s < sol; s++) sb += move2str[urfMove[urf][move[s]]] + ' ';
              } else {
                for (let s = sol - 1; s >= length1; s--) sb += move2str[urfMove[urf][move[s]]] + ' ';
                for (let s = length1 - 1; s >= 0; s--) sb += move2str[urfMove[urf][move[s]]] + ' ';
              }
              solution = sb;
              return true;
            }
          }
          return false;
        })();
      }
      for (let m = 0; m < 18; m++) {
        if (ckmv[lm][m]) { m += 2; continue; }
        let slicex = UDSliceMove[slice][m];
        let twistx = TwistMove[twist][Sym8Move[tsym][m]];
        const tsymx = Sym8Mult[7 & twistx][tsym]; twistx >>>= 3;
        if (UDSliceTwistPrun[495 * twistx + UDSliceConj[slicex][tsymx]] >= maxl) continue;
        let flipx = FlipMove[flip][Sym8Move[fsym][m]];
        const fsymx = Sym8Mult[7 & flipx][fsym]; flipx >>>= 3;
        if (TwistFlipPrun[2688 * twistx + (flipx << 3 | Sym8MultInv[fsymx][tsymx])] >= maxl
          || UDSliceFlipPrun[495 * flipx + UDSliceConj[slicex][fsymx]] >= maxl) continue;
        move[length1 - maxl] = m;
        valid1 = Math.min(valid1, length1 - maxl);
        if (phase1(twistx, tsymx, flipx, fsymx, slicex, maxl - 1, m)) return true;
      }
      return false;
    }

    function phase2(edge, esym, corn, csym, mid, maxl, depth, lm) {
      if (edge == 0 && corn == 0 && mid == 0) return true;
      for (let m = 0; m < 10; m++) {
        if (ckmv2[lm][m]) continue;
        const midx = MPermMove[mid][m];
        let edgex = EPermMove[edge][SymMoveUD[esym][m]];
        const esymx = SymMult[15 & edgex][esym]; edgex >>>= 4;
        if (MEPermPrun[24 * edgex + MPermConj[midx][esymx]] >= maxl) continue;
        let cornx = CPermMove[corn][SymMove[csym][ud2std[m]]];
        const csymx = SymMult[15 & cornx][csym]; cornx >>>= 4;
        if (MCPermPrun[24 * cornx + MPermConj[midx][csymx]] >= maxl) continue;
        move[depth] = ud2std[m];
        if (phase2(edgex, esymx, cornx, csymx, midx, maxl - 1, depth + 1, m)) return true;
      }
      return false;
    }

    let initialized = false;
    function initialize() {
      if (initialized) return;
      initialized = true;
      (function () {
        const mc = Array(6);
        mc[0] = new CubieCube(); mc[0].init(15120, 0, 119750400, 0);
        mc[1] = new CubieCube(); mc[1].init(21021, 1494, 323403417, 0);
        mc[2] = new CubieCube(); mc[2].init(8064, 1236, 29441808, 802);
        mc[3] = new CubieCube(); mc[3].init(9, 0, 5880, 0);
        mc[4] = new CubieCube(); mc[4].init(1230, 412, 2949660, 0);
        mc[5] = new CubieCube(); mc[5].init(224, 137, 328552, 1160);
        for (let m = 0; m < 6; m++) {
          moveCube[3 * m] = mc[m];
          for (let p = 0; p < 2; p++) { moveCube[3 * m + p + 1] = new CubieCube(); EdgeMult(moveCube[3 * m + p], mc[m], moveCube[3 * m + p + 1]); CornMult(moveCube[3 * m + p], mc[m], moveCube[3 * m + p + 1]); }
        }
        let temp;
        let c = new CubieCube(), d = new CubieCube();
        const f2 = new CubieCube(); f2.init(28783, 0, 259268407, 0);
        const u4 = new CubieCube(); u4.init(15138, 0, 119765538, 1792);
        const lr2 = new CubieCube(); lr2.init(5167, 0, 83473207, 0); lr2.co = [3, 3, 3, 3, 3, 3, 3, 3];
        for (let i2 = 0; i2 < 16; i2++) {
          SymMult[i2] = Array(16); SymMove[i2] = Array(18); SymMoveUD[i2] = Array(10);
          CubeSym[i2] = new CubieCube(); CubeSym[i2].copy(c);
          CornMult(c, u4, d); EdgeMult(c, u4, d); temp = d; d = c; c = temp;
          if (i2 % 4 == 3) { CornMult(c, lr2, d); EdgeMult(c, lr2, d); temp = d; d = c; c = temp; }
          if (i2 % 8 == 7) { CornMult(c, f2, d); EdgeMult(c, f2, d); temp = d; d = c; c = temp; }
        }
        for (let j2 = 0; j2 < 16; j2++) for (let k = 0; k < 16; k++) { CornMult(CubeSym[j2], CubeSym[k], c); if (c.cp[0] == 0 && c.cp[1] == 1 && c.cp[2] == 2) { SymInv[j2] = k; break; } }
        for (let i2 = 0; i2 < 16; i2++) for (let j2 = 0; j2 < 16; j2++) { CornMult(CubeSym[i2], CubeSym[j2], c); for (let k = 0; k < 16; k++) if (CubeSym[k].cp[0] == c.cp[0] && CubeSym[k].cp[1] == c.cp[1] && CubeSym[k].cp[2] == c.cp[2]) { SymMult[i2][j2] = k; break; } }
        for (let j2 = 0; j2 < 18; j2++) for (let s = 0; s < 16; s++) {
          CornConjugate(moveCube[j2], SymInv[s], c);
          for (let m = 0; m < 18; m++) {
            let found = 1;
            for (let i2 = 0; i2 < 8; i2++) if (c.cp[i2] != moveCube[m].cp[i2] || c.co[i2] != moveCube[m].co[i2]) { found = 0; break; }
            if (found) SymMove[s][j2] = m;
          }
        }
        for (let j2 = 0; j2 < 10; j2++) for (let s = 0; s < 16; s++) SymMoveUD[s][j2] = std2ud[SymMove[s][ud2std[j2]]];
        for (let j2 = 0; j2 < 8; j2++) { Sym8Mult[j2] = Array(8); Sym8Move[j2] = Array(18); Sym8MultInv[j2] = Array(8); for (let s = 0; s < 8; s++) Sym8Mult[j2][s] = SymMult[j2 << 1][s << 1] >>> 1; }
        for (let j2 = 0; j2 < 18; j2++) for (let s = 0; s < 8; s++) Sym8Move[s][j2] = SymMove[s << 1][j2];
        for (let j2 = 0; j2 < 8; j2++) for (let s = 0; s < 8; s++) Sym8MultInv[j2][s] = Sym8Mult[j2][SymInv[s << 1] >> 1];

        const occ = new Array(1260);
        let count = 0;
        for (i = 0; i < 64; occ[i++] = 0);
        for (i = 0; i < 2048; i++) if (0 == (occ[i >>> 5] & 1 << (31 & i))) {
          for (c.setFlip(i), j = 0; j < 16; j += 2) { EdgeConjugate(c, j, d); occ[(idx2 = d.getFlip()) >>> 5] |= 1 << (31 & idx2); FlipR2S[idx2] = count << 3 | j >>> 1; }
          FlipS2R[count++] = i;
        }
        for (count = 0, i = 0; i < 69; occ[i++] = 0);
        for (i = 0; i < 2187; i++) if (0 == (occ[i >>> 5] & 1 << (31 & i))) {
          for (c.setTwist(i), j = 0; j < 16; j += 2) { CornConjugate(c, j, d); occ[(idx2 = d.getTwist()) >>> 5] |= 1 << (31 & idx2); TwistR2S[idx2] = count << 3 | j >>> 1; }
          TwistS2R[count++] = i;
        }
        const mask = Array(56);
        for (i = 0; i < 56; i++) { mask[i] = Array(2); merge[i] = Array(56); }
        for (i = 0; i < 40320; i++) { set8Perm(c.ep, i); const a = ~~(c.getURtoUL() / 6), b = ~~(c.getDRtoDL() / 6); mask[a][b >>> 5] |= 1 << (31 & b); }
        for (i = 0; i < 56; i++) for (count = 0, j = 0; j < 56; j++) if (0 != (mask[i][j >>> 5] & 1 << (31 & j))) merge[i][j] = count++;
        for (count = 0, i = 0; i < 1260; occ[i++] = 0);
        for (i = 0; i < 40320; i++) if (0 == (occ[i >>> 5] & 1 << (31 & i))) {
          set8Perm(c.ep, i);
          for (let s = 0; s < 16; s++) {
            EdgeConjugate(c, s, d);
            occ[(idx2 = get8Perm(d.ep)) >>> 5] |= 1 << (31 & idx2);
            const a = d.getURtoUL(), b = d.getDRtoDL();
            const m = 4032 * merge[~~(a / 6)][~~(b / 6)] + 12 * a + b % 6 * 2 + get8Parity(idx2);
            MtoEPerm[m] = count << 4 | s;
            EPermR2S[idx2] = count << 4 | s;      // ← 之前漏了这一行
          }
          EPermS2R[count++] = i;
        }
      })();
      (function () {
        let c = new CubieCube(), d = new CubieCube();
        for (i = 0; i < 2768; i++) { CPermMove[i] = Array(18); set8Perm(c.cp, CPermS2R[i]); for (j = 0; j < 18; j++) { CornMult(c, moveCube[j], d); CPermMove[i][j] = d.getCPermSym(); } }
        for (i = 0; i < 2768; i++) { EPermMove[i] = Array(10); set8Perm(c.ep, EPermS2R[i]); for (j = 0; j < 10; j++) { EdgeMult(c, moveCube[ud2std[j]], d); EPermMove[i][j] = d.getEPermSym(); } }
        for (i = 0; i < 336; i++) { FlipMove[i] = Array(18); c.setFlip(FlipS2R[i]); for (j = 0; j < 18; j++) { EdgeMult(c, moveCube[j], d); FlipMove[i][j] = d.getFlipSym(); } }
        for (i = 0; i < 324; i++) { TwistMove[i] = Array(18); c.setTwist(TwistS2R[i]); for (j = 0; j < 18; j++) { CornMult(c, moveCube[j], d); TwistMove[i][j] = d.getTwistSym(); } }
        for (i = 0; i < 495; i++) { UDSliceMove[i] = Array(18); c.setUDSlice(i); for (j = 0; j < 18; j++) { EdgeMult(c, moveCube[j], d); UDSliceMove[i][j] = d.getUDSlice(); } }
        for (i = 0; i < 495; i++) { UDSliceConj[i] = Array(8); c.setUDSlice(i); for (j = 0; j < 16; j += 2) { EdgeConjugate(c, SymInv[j], d); UDSliceConj[i][j >>> 1] = d.getUDSlice(); } }
        for (i = 0; i < 1320; i++) { Mid3Move[i] = Array(18); c.setMid3(i); for (j = 0; j < 18; j++) { EdgeMult(c, moveCube[j], d); Mid3Move[i][j] = d.getMid3(); } }
        for (i = 0; i < 24; i++) { c.setMPerm(i); Mid32MPerm[c.getMid3() % 24] = i; }
        for (i = 0; i < 2768; i++) CParity[i >>> 3] |= get8Parity(CPermS2R[i]) << (7 & i);
        for (i = 0; i < 24; i++) { MPermMove[i] = Array(10); c.setMPerm(i); for (j = 0; j < 10; j++) { EdgeMult(c, moveCube[ud2std[j]], d); MPermMove[i][j] = d.getMPerm(); } }
        for (i = 0; i < 24; i++) { MPermConj[i] = Array(16); c.setMPerm(i); for (j = 0; j < 16; j++) { EdgeConjugate(c, SymInv[j], d); MPermConj[i][j] = d.getMPerm(); } }
        let SymState = Array(324);
        for (i = 0; i < 324; i++) { c.setTwist(TwistS2R[i]); for (let j2 = 0; j2 < 8; j2++) { CornConjugate(c, j2 << 1, d); if (65535 != binarySearch(TwistS2R, d.getTwist())) SymState[i] |= 1 << j2; } }
        let SymStateF = Array(324);
        for (i = 0; i < 336; i++) { c.setFlip(FlipS2R[i]); for (let j2 = 0; j2 < 8; j2++) { EdgeConjugate(c, j2 << 1, d); if (65535 != binarySearch(FlipS2R, d.getFlip())) SymStateF[i] |= 1 << j2; } }
        console.log('[m2p] TwistFlipPrun start');
        for (i = 0; i < 870912; i++) TwistFlipPrun[i] = -1;
        for (i = 0; i < 8; i++) TwistFlipPrun[i] = 0;
        let inv, select, check;
        depth = 0; done = 8;
        const _t1 = Date.now();
        while (done < 870912) {
          for (select = (inv = depth > 6) ? -1 : depth, check = inv ? depth : -1, depth++, i = 0; i < 870912; i++) if (TwistFlipPrun[i] == select) {
            const tw0 = ~~(i / 2688); let fl0 = i % 2688; const fsym0 = 7 & i; fl0 >>>= 3;
            for (let m = 0; m < 18; m++) {
              const tsymx = 7 & (TwistMove[tw0][m]); const twistx = TwistMove[tw0][m] >>> 3;
              let flipx = FlipMove[fl0][Sym8Move[fsym0][m]];
              const fsymx = Sym8MultInv[Sym8Mult[7 & flipx][fsym0]][tsymx]; flipx >>>= 3;
              const idx3 = 2688 * twistx + (flipx << 3 | fsymx);
              if (TwistFlipPrun[idx3] == check) {
                if (done++, inv) { TwistFlipPrun[i] = depth; break; }
                TwistFlipPrun[idx3] = depth;
                let sym = SymState[twistx], symF = SymStateF[flipx];
                if (1 != sym || 1 != symF) for (let j2 = 0; j2 < 8; j2++, symF >>= 1) {
                  if (1 == (1 & symF)) for (let k = 0; k < 8; k++) if (0 != (sym & 1 << k)) {
                    const idxx = 2688 * twistx + (flipx << 3 | Sym8MultInv[Sym8MultInv[fsymx][j2]][k]);
                    if (-1 == TwistFlipPrun[idxx]) { TwistFlipPrun[idxx] = depth; done++; }
                  }
                }
              }
            }
          }
        }
        console.log('[m2p] TwistFlipPrun done', Date.now()-_t1, 'ms');
        let _t2 = Date.now();
        for (i = 0; i < 160380; i++) UDSliceTwistPrun[i] = -1;
        for (UDSliceTwistPrun[0] = 0, depth = 0, done = 1; done < 160380;) {
          for (select = (inv = depth > 6) ? -1 : depth, check = inv ? depth : -1, depth++, i = 0; i < 160380; i++) if (UDSliceTwistPrun[i] == select) {
            const slice0 = i % 495; const tw0 = ~~(i / 495);
            for (let m = 0; m < 18; m++) {
              const symx = 7 & (TwistMove[tw0][m]); const twistx = TwistMove[tw0][m] >>> 3;
              const slicex = UDSliceConj[UDSliceMove[slice0][m]][symx];
              const idx3 = 495 * twistx + slicex;
              if (UDSliceTwistPrun[idx3] == check) {
                if (done++, inv) { UDSliceTwistPrun[i] = depth; break; }
                UDSliceTwistPrun[idx3] = depth;
                let sym = SymState[twistx];
                if (1 != sym) for (let j2 = 1; j2 < 8; j2++) { if (1 == (1 & (sym >>= 1))) { const idxx = 495 * twistx + UDSliceConj[slicex][j2]; if (-1 == UDSliceTwistPrun[idxx]) { UDSliceTwistPrun[idxx] = depth; done++; } } }
              }
            }
          }
        }
        console.log('[m2p] UDSliceTwistPrun done', Date.now()-_t2, 'ms');
        let _t3 = Date.now();
        for (i = 0; i < 166320; i++) UDSliceFlipPrun[i] = -1;
        for (UDSliceFlipPrun[0] = 0, depth = 0, done = 1; done < 166320;) {
          for (select = (inv = depth > 6) ? -1 : depth, check = inv ? depth : -1, depth++, i = 0; i < 166320; i++) if (UDSliceFlipPrun[i] == select) {
            const slice0 = i % 495; const fl0 = ~~(i / 495);
            for (let m = 0; m < 18; m++) {
              const symx = 7 & (FlipMove[fl0][m]); const flipx = FlipMove[fl0][m] >>> 3;
              const slicex = UDSliceConj[UDSliceMove[slice0][m]][symx];
              const idx3 = 495 * flipx + slicex;
              if (UDSliceFlipPrun[idx3] == check) {
                if (done++, inv) { UDSliceFlipPrun[i] = depth; break; }
                UDSliceFlipPrun[idx3] = depth;
                let sym = SymStateF[flipx];
                if (1 != sym) for (let j2 = 1; j2 < 8; j2++) { if (1 == (1 & (sym >>= 1))) { const idxx = 495 * flipx + UDSliceConj[slicex][j2]; if (-1 == UDSliceFlipPrun[idxx]) { UDSliceFlipPrun[idxx] = depth; done++; } } }
              }
            }
          }
        }
        console.log('[m2p] UDSliceFlipPrun done', Date.now()-_t3, 'ms');
        let _t4 = Date.now();
        SymState = Array(2768);
        for (i = 0; i < 2768; i++) { set8Perm(c.ep, EPermS2R[i]); for (let j2 = 1; j2 < 16; j2++) { EdgeConjugate(c, j2, d); if (65535 != binarySearch(EPermS2R, get8Perm(d.ep))) SymState[i] |= 1 << j2; } }
        console.log('[m2p] SymState done', Date.now()-_t4, 'ms');
        let _t5 = Date.now();
        console.log('[m2p] before MEPermPrun');
        for (i = 0; i < 66432; i++) MEPermPrun[i] = -1;
        depth = 0; done = 1;
        const _te = Date.now();
        let _guard = 0;
        for (MEPermPrun[0] = 0; done < 66432;) {
          if (++_guard % 40 === 0) console.log('[m2p] MEPermPrun guard', _guard, 'done', done, 'depth', depth);
          if (_guard > 400) { console.log('[m2p] MEPermPrun 中止于 done =', done); break; }
          for (select = (inv = depth > 7) ? -1 : depth, check = inv ? depth : -1, depth++, i = 0; i < 66432; i++) if (MEPermPrun[i] == select) {
            const mid = i % 24, edge = ~~(i / 24);
            for (let m = 0; m < 10; m++) {
              let edgex = EPermMove[edge][m]; const symx = 15 & edgex; edgex >>>= 4;
              const midx = MPermConj[MPermMove[mid][m]][symx];
              const idx3 = 24 * edgex + midx;
              if (MEPermPrun[idx3] == check) {
                if (done++, inv) { MEPermPrun[i] = depth; break; }
                MEPermPrun[idx3] = depth;
                let sym = SymState[edgex];
                if (0 != sym) for (let j2 = 1; j2 < 16; j2++) { if (1 == (1 & (sym >>= 1))) { const idxx = 24 * edgex + MPermConj[midx][j2]; if (-1 == MEPermPrun[idxx]) { MEPermPrun[idxx] = depth; done++; } } }
              }
            }
          }
        }
        console.log('[m2p] MEPermPrun done', Date.now()-_t5, 'ms');
        let _t6 = Date.now();
        console.log('[m2p] MEPermPrun done', Date.now()-_te, 'ms, done =', done);
        for (i = 0; i < 66432; i++) MCPermPrun[i] = -1;
        depth = 0; done = 1;
        const _tc = Date.now();
        _guard = 0;
        for (MCPermPrun[0] = 0; done < 66432;) {
          if (++_guard % 40 === 0) console.log('[m2p] MCPermPrun guard', _guard, 'done', done, 'depth', depth);
          if (_guard > 400) { console.log('[m2p] MCPermPrun 中止于 done =', done); break; }
          for (select = (inv = depth > 7) ? -1 : depth, check = inv ? depth : -1, depth++, i = 0; i < 66432; i++) if (MCPermPrun[i] == select) {
            const mid = i % 24, corn0v = ~~(i / 24);
            for (let m = 0; m < 10; m++) {
              let cornx = CPermMove[corn0v][ud2std[m]]; const symx = 15 & cornx; cornx >>>= 4;
              const midx = MPermConj[MPermMove[mid][m]][symx];
              const idx3 = 24 * cornx + midx;
              if (MCPermPrun[idx3] == check) {
                if (done++, inv) { MCPermPrun[i] = depth; break; }
                MCPermPrun[idx3] = depth;
                let sym = SymState[cornx];
                if (0 != sym) for (let j2 = 1; j2 < 16; j2++) { if (1 == (1 & (sym >>= 1))) { const idxx = 24 * cornx + MPermConj[midx][j2 ^ e2c[j2]]; if (-1 == MCPermPrun[idxx]) { MCPermPrun[idxx] = depth; done++; } } }
              }
            }
          }
        }
        console.log('[m2p] MCPermPrun done', Date.now()-_t6, 'ms');
        console.log('[m2p] MCPermPrun done', Date.now()-_tc, 'ms, done =', done);
      })();
    }

    function solveCubie(cc) {
      cc.temps = new CubieCube();
      for (let i2 = 0; i2 < 6; i2++) {
        twist[i2] = cc.getTwistSym(); tsym[i2] = 7 & twist[i2]; twist[i2] >>>= 3;
        flip[i2] = cc.getFlipSym(); fsym[i2] = 7 & flip[i2]; flip[i2] >>>= 3;
        slice[i2] = cc.getUDSlice();
        corn0[i2] = cc.getCPermSym(); csym0[i2] = 15 & corn0[i2]; corn0[i2] >>>= 4;
        mid30[i2] = cc.getMid3();
        e10[i2] = cc.getURtoUL(); e20[i2] = cc.getDRtoDL();
        prun[i2] = Math.max(Math.max(UDSliceTwistPrun[495 * twist[i2] + UDSliceConj[slice[i2]][tsym[i2]]],
          UDSliceFlipPrun[495 * flip[i2] + UDSliceConj[slice[i2]][fsym[i2]]]),
          TwistFlipPrun[2688 * twist[i2] + (flip[i2] << 3 | Sym8MultInv[fsym[i2]][tsym[i2]])]);
        cc.URFConjugate();
        if (i2 == 2) cc.invCubieCube();
      }
      for (solution = null, sol = 22, length1 = 0; length1 < sol; length1++) {
        for (maxlength2 = Math.min(sol / 2 + 1, sol - length1), urfidx = 0; urfidx < 6; urfidx++) {
          corn[0] = corn0[urfidx]; csym[0] = csym0[urfidx]; mid3[0] = mid30[urfidx];
          e1[0] = e10[urfidx]; e2[0] = e20[urfidx];
          if (prun[urfidx] <= length1 && phase1(twist[urfidx], tsym[urfidx], flip[urfidx], fsym[urfidx], slice[urfidx], length1, 18)) {
            return solution == null ? 'Error 8' : solution;
          }
        }
      }
      return 'Error 7';
    }
    return {
      initialize, solve: solveCubie, CubieCube,
      // 调试用：暴露初始化的关键表，便于与本项目几何比对
      _debug: { get moveCube() { return moveCube; }, get SymState() { return SymState; },
        get EPermR2S() { return EPermR2S; }, get MtoEPerm() { return MtoEPerm; } },
      applyMove: function (cp, co, ep, eo, m) {
        const c = new CubieCube(); c.cp = cp.slice(); c.co = co.slice(); c.ep = ep.slice(); c.eo = eo.slice();
        const d = new CubieCube(); EdgeMult(c, moveCube[m], d); CornMult(c, moveCube[m], d);
        return d;
      },
    };
  })();

  /* ===================== 对外接口 ===================== */

  let ready = false;
  function init() {
    if (!ready) { IMPL.initialize(); ready = true; }
    return true;
  }

  /**
   * 用本项目 core 的几何状态转成 min2phase 需要的四组数组。
   * 已用本项目几何作为真值验证：解出来的动作序列回放后外观完全还原。
   */
  function toCubie(coreState, Core) {
    const readCornerPerm = Core.readCornerPerm;   // cp[piece] = slot
    const readEdgePerm = Core.readEdgePerm;       // ep[piece] = slot
    const cp = readCornerPerm(coreState).slice();
    const ep = readEdgePerm(coreState).slice();
    const co = Core.readCornerOri(coreState).slice();   // co[slot]
    const eo = Core.readEdgeFlip(coreState).slice();    // eo[slot]
    return { cp, co, ep, eo };
  }

  /** 返回动作数组，如 ['U', "R2", "F'"] */
  function solve(cp, co, ep, eo) {
    init();
    const cc = new IMPL.CubieCube();
    cc.cp = cp.slice(); cc.co = co.slice(); cc.ep = ep.slice(); cc.eo = eo.slice();
    const str = IMPL.solve(cc);
    if (/^Error/.test(str)) throw new Error('min2phase: ' + str);
    return str.trim().split(/\s+/).map((s) => s.trim()).filter(Boolean);
  }

  return { init, solve, toCubie, _impl: IMPL };
});

/* min2phase 原始实现：MIT License, Copyright (c) 2018 cs0x7f
 * https://github.com/cs0x7f/min2phase */
