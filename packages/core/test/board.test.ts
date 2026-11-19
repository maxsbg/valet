import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoLayout, boardLayout, baseZ, isCap, topRank } from '../src/board';

const it = (id: string, category: string, name = '') => ({ id, category, name });

test('Cap wird erkannt, Mütze nicht', () => {
  assert.equal(isCap(it('c', 'accessory', 'New Era Cap')), true);
  assert.equal(isCap(it('m', 'accessory', 'Beanie')), false);
  assert.equal(isCap(it('s', 'shoe', 'Cap Sneaker')), false);
});

test('Lagen: Mantel hinten, Pullover vorne', () => {
  assert.equal(topRank(it('a', 'coat')), 0);
  assert.equal(topRank(it('b', 'top', 'T-Shirt')), 4);
  assert.ok(baseZ(it('p', 'sweater')) > baseZ(it('t', 'top', 'T-Shirt')));
  assert.ok(baseZ(it('m', 'coat')) < baseZ(it('j', 'jacket')));
});

test('Oberteil oben, Hose Mitte, Schuhe unten', () => {
  const L = autoLayout([it('t', 'top'), it('h', 'pants'), it('s', 'shoe')]);
  assert.ok(L.t!.y < L.h!.y && L.h!.y < L.s!.y);
});

test('alles bleibt innerhalb der Fläche, gespeicherte Lage hat Vorrang', () => {
  const its = [it('t', 'top'), it('j', 'jacket'), it('h', 'pants'), it('s', 'shoe'), it('c', 'accessory', 'Cap'), it('b', 'bag'), it('g', 'accessory', 'Gürtel')];
  for (const p of boardLayout(its)) {
    assert.ok(p.left >= 0 && p.top >= 0 && p.left + p.width <= 100.001 && p.top + p.height <= 100.001, p.item.id);
  }
  const [t] = boardLayout([it('t', 'top')], { t: { x: 0.5, y: 0.3, z: 999 } });
  assert.equal(t!.z, 999);
  assert.equal(Math.round(t!.left + t!.width / 2), 50);
});
