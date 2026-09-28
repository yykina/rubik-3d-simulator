const C = require('../cube-core.js');
const I = C.Solver._internals;
const geo = C.solvedState();
const pack = I.solvedPack();
C.applyTurn(geo, "R'"); I.applyPack(pack, "R'");
for (let slot = 0; slot < 8; slot++) {
  const pos = C.POS_OF_CORNER_SLOT[slot];
  const gm = geo.ori[pos];
  const pm = I.unpack(pack.ori[pos]);
  const same = gm.join(',') === pm.join(',');
  console.log('slot', slot, 'piece', C.CORNER_NAMES[C.CORNER_SLOT[geo.perm[pos]]],
    'geo', JSON.stringify(gm), 'pack', JSON.stringify(pm), same ? '' : '  <<<');
}
