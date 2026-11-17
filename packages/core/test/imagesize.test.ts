import { test } from 'node:test';
import assert from 'node:assert/strict';
import { largestImages, sizeLabel } from '../src/tile';

test('sizeLabel: ganze Pixel ohne Tausenderpunkt', () => {
  assert.deepEqual(sizeLabel({ w: 1200, h: 1600 }), { w: '1200', h: '1600' });
  assert.deepEqual(sizeLabel({ w: 799.6, h: 1000.2 }), { w: '800', h: '1000' });
  assert.equal(sizeLabel(null), null);
  assert.equal(sizeLabel({ w: 0, h: 100 }), null);
});

test('largestImages: größtes Bild nach Pixelzahl', () => {
  assert.deepEqual([...largestImages({ a: { w: 400, h: 500 }, b: { w: 2000, h: 2500 }, c: null })], ['b']);
  // Gleichstand an der Spitze → beide
  assert.deepEqual([...largestImages({ a: { w: 1000, h: 1000 }, b: { w: 1000, h: 1000 }, c: { w: 10, h: 10 } })].sort(), ['a', 'b']);
  // alle gleich groß oder nur eins bekannt → keins hervorheben
  assert.equal(largestImages({ a: { w: 800, h: 800 }, b: { w: 800, h: 800 } }).size, 0);
  assert.equal(largestImages({ a: { w: 800, h: 800 }, b: undefined }).size, 0);
});
