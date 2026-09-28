const C = require('./load-tables.js')();
const I = C.Solver._internals;
const tw = 0, sl = 494;
const key = tw * 495 + sl;
console.log('key(0,494) =', key, ' dist =', I.distTwistSlice[key]);
console.log('key(2186,494) =', 2186*495+494, ' dist =', I.distTwistSlice[2186*495+494]);
// R 状态
const s = C.solvedState(); C.applyTurn(s, 'R');
const st = { perm: s.perm.slice(), ori: s.ori.map(m => I.pack(m)) };
const twR = I.twistOf(st), slR = I.sliceOf(st);
console.log('R: tw', twR, 'sl', slR, ' key =', twR*495+slR, ' dist =', I.distTwistSlice[twR*495+slR]);
// 直接算 co → twist
const co = C.readCornerOri(s);
let t = 0; for (let i = 0; i < 7; i++) t = t*3 + co[i];
console.log('R 的 co =', co.join(''), ' 直接算 twist =', t, ' I.twistOf 给的 =', twR);
