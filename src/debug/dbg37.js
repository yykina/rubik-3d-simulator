const C = require('../cube-core.js');
const I = C.Solver._internals;
const geo = C.solvedState();
const pack = I.solvedPack();
const seq = ['R2', "D'", "U'", "U'", 'D', "F'"];
for (const name of seq) {
  C.applyTurn(geo, name); I.applyPack(pack, name);
  let diff = [];
  for (let i = 0; i < 26; i++) {
    if (geo.perm[i] !== pack.perm[i]) diff.push('perm@' + i);
    const gm = geo.ori[i].join(','), pm = I.unpack(pack.ori[i]).join(',');
    if (gm !== pm) diff.push(`ori@${i}(${C.CUBIES[i].kind},piece ${geo.perm[i]})`);
  }
  console.log(name.padEnd(3), diff.length ? diff.join(' ') : 'ok');
}
