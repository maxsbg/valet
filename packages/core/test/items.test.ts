import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sideOf, sideColor, isGone, isAvailable } from '../src/items';

const hoodie = { reversible: true, mainSide: 'a' as const, images: { a: 'imgA', b: 'imgB' }, color: 'Hellgrau', altColor: 'Braun' };

test('Wendeteil: Seite B nur mit Bild', () => {
  assert.equal(sideOf(hoodie, 'b'), 'b');
  assert.equal(sideColor(hoodie, 'b'), 'Braun');
  assert.equal(sideOf({ ...hoodie, images: { a: 'imgA' } }, 'b'), 'a');
});

test('Status', () => {
  assert.equal(isGone({ status: 'sold' }), true);
  assert.equal(isGone({ status: 'wash' }), false);
  assert.equal(isAvailable({ status: null }), true);
  assert.equal(isAvailable({ status: 'lent' }), false);
});
