import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fieldsFor, parseWL, composeWL, capSize, pantsWaistOnly, SHOE_SIZES, PANTS_WAIST, PANTS_LENGTH } from '../src/fields';

test('Felder je Kategorie (Spec 8a)', () => {
  const schuh = fieldsFor('Schuh', 'Sneaker');
  assert.deepEqual([schuh.pattern, schuh.reversible, schuh.size, schuh.care, schuh.closure, schuh.weather], [false, false, 'shoe', false, true, true]);
  const tasche = fieldsFor('Tasche', 'Rucksack');
  assert.deepEqual([tasche.size, tasche.weather, tasche.strap, tasche.care], [null, false, true, false]);
  assert.equal(fieldsFor('Schmuck', 'Uhr').size, null);
  assert.equal(fieldsFor('Schmuck', 'Ring').size, 'ring');
  assert.equal(fieldsFor('Kopfbedeckung', 'Kappe').size, 'cap');
  assert.equal(fieldsFor('Kopfbedeckung', 'Mütze').size, 'clothing');
  assert.equal(fieldsFor('Hose', 'Jeans').size, 'pants');
  assert.ok(fieldsFor('Oberteil', 'T-Shirt').layers && fieldsFor('Oberbekleidung', 'Blouson').layers);
  assert.ok(!fieldsFor('Kleid', null).layers);
});

test('Ausschnitt oder Kragen nach Unterkategorie', () => {
  assert.equal(fieldsFor('Oberteil', 'Hemd').neckline!.label, 'Kragen');
  assert.equal(fieldsFor('Oberteil', 'Bluse').neckline!.label, 'Kragen');
  assert.equal(fieldsFor('Oberteil', 'T-Shirt').neckline!.label, 'Ausschnitt');
  assert.equal(fieldsFor('Kleid', 'Wickelkleid').neckline!.label, 'Ausschnitt');
  const outer = fieldsFor('Oberbekleidung', 'Blouson').neckline!;
  assert.equal(outer.label, 'Kragen');
  assert.ok(outer.options.includes('Kapuze'));
  assert.equal(fieldsFor('Hose', 'Jeans').neckline, null);
});

test('Verschluss, Pflege und Wetter nur wo sinnvoll', () => {
  assert.ok(fieldsFor('Oberteil', 'Hemd').closure);
  assert.ok(!fieldsFor('Oberteil', 'T-Shirt').closure);
  assert.ok(fieldsFor('Accessoire', 'Gürtel').closure && !fieldsFor('Accessoire', 'Brille').closure);
  assert.ok(fieldsFor('Accessoire', 'Schal').care && !fieldsFor('Accessoire', 'Brille').care);
  assert.ok(fieldsFor('Accessoire', 'Handschuh').weather && !fieldsFor('Accessoire', 'Gürtel').weather);
});

test('Hosengröße W/L', () => {
  assert.deepEqual(parseWL('W32/L32'), { w: 'W32', l: 'L32' });
  assert.deepEqual(parseWL('W30'), { w: 'W30', l: null });
  assert.deepEqual(parseWL('M'), { w: null, l: null });
  assert.equal(composeWL('W32', 'L34'), 'W32/L34');
  assert.equal(composeWL('W32', null), 'W32');
  assert.ok(pantsWaistOnly('Shorts') && !pantsWaistOnly('Jeans'));
  assert.equal(PANTS_WAIST[0], 'W26'); assert.equal(PANTS_WAIST.at(-1), 'W40');
  assert.equal(PANTS_LENGTH[0], 'L28'); assert.equal(PANTS_LENGTH.at(-1), 'L36');
});

test('Schuh EU und Kappe', () => {
  assert.equal(SHOE_SIZES[0], '35'); assert.equal(SHOE_SIZES[1], '35,5'); assert.equal(SHOE_SIZES.at(-1), '48');
  assert.equal(capSize('7 3/8 (58,7 cm)'), '7 3/8');
  assert.equal(capSize('7'), '7');
  assert.equal(capSize('One Size'), 'Verstellbar');
  assert.equal(capSize(''), null);
});
