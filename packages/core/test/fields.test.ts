import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fieldsFor, parseWL, composeWL, capSize, pantsWaistOnly, matchSize, sizeSystemOn, sizeChoices, sizeText, SHOE_SIZES, SHOE_THIRDS, SHOE_ALL,
  PANTS_WAIST, PANTS_LENGTH, GLOVE_SIZES, BELT_SIZES, HAT_SIZES, BRACELET_SIZES, NECKLACE_SIZES, WATCH_SIZES, SOCK_SIZES,
} from '../src/fields';
import { SIZES } from '../src/attributes';

test('Felder je Kategorie (Spec 8a)', () => {
  const schuh = fieldsFor('shoe', 'sneaker');
  assert.deepEqual([schuh.pattern, schuh.reversible, schuh.size, schuh.care, schuh.closure, schuh.weather], [false, false, 'shoe', false, true, true]);
  const tasche = fieldsFor('bag', 'backpack');
  assert.deepEqual([tasche.size, tasche.weather, tasche.strap, tasche.care], [null, false, true, false]);
  assert.equal(fieldsFor('jewelry', 'earring').size, null);
  assert.equal(fieldsFor('jewelry', 'ring').size, 'ring');
  assert.equal(fieldsFor('headwear', 'cap').size, 'cap');
  assert.equal(fieldsFor('headwear', 'beanie_cap').size, 'letters');
  assert.equal(fieldsFor('pants', 'jeans').size, 'pants');
  assert.ok(fieldsFor('top', 't_shirt').layers && fieldsFor('outerwear', 'blouson').layers);
  assert.ok(fieldsFor('dress', null).layers); // Kleider haben Lagen seit 20.11.2026
  assert.ok(!fieldsFor('pants', null).layers);
});

test('Ausschnitt oder Kragen nach Unterkategorie', () => {
  assert.equal(fieldsFor('top', 'shirt').neckline!.label, 'Kragen');
  assert.equal(fieldsFor('top', 'blouse').neckline!.label, 'Kragen');
  assert.equal(fieldsFor('top', 't_shirt').neckline!.label, 'Ausschnitt');
  assert.equal(fieldsFor('dress', 'wrap_dress').neckline!.label, 'Ausschnitt');
  const outer = fieldsFor('outerwear', 'blouson').neckline!;
  assert.equal(outer.label, 'Kragen');
  assert.ok(outer.options.some((o) => o.key === 'hood' && o.label === 'Kapuze'));
  assert.equal(fieldsFor('pants', 'jeans').neckline, null);
});

test('Verschluss, Pflege und Wetter nur wo sinnvoll', () => {
  assert.ok(fieldsFor('top', 'shirt').closure);
  assert.ok(!fieldsFor('top', 't_shirt').closure);
  assert.ok(fieldsFor('accessory', 'belt').closure && !fieldsFor('accessory', 'glasses').closure);
  assert.ok(fieldsFor('accessory', 'scarf').care && !fieldsFor('accessory', 'glasses').care);
  assert.ok(fieldsFor('accessory', 'glove').weather && !fieldsFor('accessory', 'belt').weather);
});

test('Hosengröße W/L', () => {
  assert.deepEqual(parseWL('W32/L32'), { w: 'W32', l: 'L32' });
  assert.deepEqual(parseWL('W30'), { w: 'W30', l: null });
  assert.deepEqual(parseWL('M'), { w: null, l: null });
  assert.equal(composeWL('W32', 'L34'), 'W32/L34');
  assert.equal(composeWL('W32', null), 'W32');
  assert.ok(pantsWaistOnly('shorts') && pantsWaistOnly('pants', 'pajama_pants') && !pantsWaistOnly('pants', 'jeans'));
  assert.equal(PANTS_WAIST[0], 'W24'); assert.equal(PANTS_WAIST.at(-1), 'W44');
  assert.equal(PANTS_LENGTH[0], 'L26'); assert.equal(PANTS_LENGTH.at(-1), 'L38');
});

test('Schuh EU und Kappe', () => {
  assert.equal(SHOE_SIZES[0], '35'); assert.equal(SHOE_SIZES[1], '35,5'); assert.equal(SHOE_SIZES.at(-1), '50');
  assert.deepEqual(SHOE_THIRDS.slice(0, 4), ['35', '35 ⅓', '35 ⅔', '36']);
  assert.deepEqual(SHOE_ALL.slice(0, 5), ['35', '35 ⅓', '35,5', '35 ⅔', '36']); // numerisch sortiert
  assert.equal(capSize('7 3/8 (58,7 cm)'), '7 3/8');
  assert.equal(capSize('7'), '7');
  assert.equal(capSize('One Size'), 'Verstellbar');
  assert.equal(capSize(''), null);
});

test('Neue Größenarten je Unterkategorie', () => {
  const size = (c: string, s: string) => fieldsFor(c, s).size;
  assert.equal(size('accessory', 'glove'), 'glove');
  assert.equal(size('accessory', 'belt'), 'belt');
  assert.equal(size('accessory', 'sock'), 'sock');
  assert.equal(size('accessory', 'tights'), 'sock');
  assert.equal(size('accessory', 'underwear'), 'underwear');
  assert.equal(size('accessory', 'swimwear'), 'clothing');
  assert.equal(size('headwear', 'hat'), 'hat');
  assert.equal(size('headwear', 'hijab'), 'letters');
  assert.equal(size('headwear', 'other'), 'letters');
  assert.equal(size('jewelry', 'bracelet'), 'bracelet');
  assert.equal(size('jewelry', 'necklace'), 'necklace');
  assert.equal(size('jewelry', 'watch'), 'watch');
  for (const sub of ['glasses', 'wallet', 'phone_case', 'hair_accessory', 'suit_accessory', 'scarf']) assert.equal(size('accessory', sub), null, sub);
});

test('Größenlisten', () => {
  assert.deepEqual([GLOVE_SIZES[0], GLOVE_SIZES[5], GLOVE_SIZES.at(-1)], ['5', '7,5', '12']);
  assert.deepEqual([BELT_SIZES[0], BELT_SIZES.at(-1), BELT_SIZES.length], ['70 cm', '130 cm', 13]);
  assert.deepEqual([HAT_SIZES[0], HAT_SIZES.at(-1)], ['53 cm', '62 cm']);
  assert.ok(BRACELET_SIZES.includes('19,5 cm') && BRACELET_SIZES.at(-1) === '24 cm');
  assert.equal(NECKLACE_SIZES.length, 11);
  assert.deepEqual([WATCH_SIZES[0], WATCH_SIZES.at(-1)], ['26 mm', '50 mm']);
  assert.ok(SOCK_SIZES.includes('39–42') && SOCK_SIZES.includes('40–42'));
  assert.deepEqual(SIZES.letters.slice(7, 10), ['3XL', '4XL', '5XL']);
  assert.deepEqual(sizeChoices('pants', 'pants', 'trousers').map((c) => c.system), ['wl', 'letters', 'numbers']);
  assert.deepEqual(sizeChoices('pants', 'pants', 'jeans').map((c) => c.system), ['wl', 'letters']);
  assert.deepEqual(sizeChoices('underwear').map((c) => c.values.at(-1)), ['One Size', '9']);
  assert.ok(sizeChoices('glove').find((c) => c.system === 'letters')!.doubles);
});

test('matchSize für alle Arten', () => {
  const m = (k: Parameters<typeof matchSize>[0], raw: string, c?: string, s?: string) => matchSize(k, raw, c, s);
  for (const raw of ['S/M', 'S-M', 'SM', 's–m']) assert.deepEqual(m('clothing', raw), { system: 'letters', size: 'S/M' }, raw);
  assert.deepEqual(m('clothing', 'XXXXL'), { system: 'letters', size: '4XL' });
  for (const raw of ['42 2/3', '42⅔', '42.67', 'EU 42 2/3']) assert.deepEqual(m('shoe', raw), { system: 'eu', size: '42 ⅔' }, raw);
  assert.deepEqual(m('shoe', '43 1/3'), { system: 'eu', size: '43 ⅓' });
  assert.deepEqual(m('shoe', '49,5'), { system: 'eu', size: '49,5' });
  assert.equal(m('shoe', '52'), null);
  assert.deepEqual(m('sock', '39-42'), { system: 'sock', size: '39–42' });
  assert.deepEqual(m('sock', 'L'), { system: 'letters', size: 'L' });
  assert.equal(m('sock', '39-41'), null);
  assert.deepEqual(m('belt', '95cm'), { system: 'belt', size: '95 cm' });
  assert.deepEqual(m('belt', '95'), { system: 'belt', size: '95 cm' });
  assert.equal(m('belt', '97 cm'), null);
  assert.deepEqual(m('hat', '58 cm'), { system: 'hat', size: '58 cm' });
  assert.deepEqual(m('bracelet', '19.5cm'), { system: 'bracelet', size: '19,5 cm' });
  assert.deepEqual(m('necklace', '45cm'), { system: 'necklace', size: '45 cm' });
  assert.deepEqual(m('watch', '40mm'), { system: 'watch', size: '40 mm' });
  assert.equal(m('watch', '40 cm'), null);
  assert.deepEqual(m('glove', '8.5'), { system: 'glove', size: '8,5' });
  assert.deepEqual(m('glove', 'M/L'), { system: 'letters', size: 'M/L' });
  assert.deepEqual(m('cap', 'L-XL'), { system: 'flexfit', size: 'L/XL' });
  assert.deepEqual(m('cap', '7 3/8'), { system: 'cap', size: '7 3/8' });
  assert.deepEqual(m('underwear', '5'), { system: 'numbers', size: '5' });
  assert.deepEqual(m('letters', 'one size'), { system: 'letters', size: 'One Size' });
  assert.equal(m('letters', '58'), null);
  assert.deepEqual(m('pants', '50', 'pants', 'trousers'), { system: 'numbers', size: '50' });
  assert.deepEqual(m('pants', '32/34', 'pants', 'jeans'), { system: 'wl', size: 'W32/L34' });
  assert.deepEqual(m('pants', '32/34', 'shorts', 'cargo_shorts'), { system: 'wl', size: 'W32' });
  assert.equal(m('pants', 'XL/XXXL'), null);
});

test('sizeSystemOn mit Altdaten', () => {
  assert.equal(sizeSystemOn('glove', 'letters', 'M'), 'letters');
  assert.equal(sizeSystemOn('glove', null, '8,5'), 'glove');
  assert.equal(sizeSystemOn('glove', 'numbers', '50'), null); // unbekannt → nichts raten
  assert.equal(sizeSystemOn('glove', null, null), 'glove'); // neu: Standard
  assert.equal(sizeSystemOn('hat', 'numbers', '58'), null);
  assert.equal(sizeSystemOn('hat', null, 'L'), 'letters');
  assert.equal(sizeSystemOn('belt', 'belt', '95 cm'), 'belt');
  assert.equal(sizeSystemOn('sock', null, '39–42'), 'sock');
  assert.equal(sizeSystemOn('underwear', null, null), null);
  assert.equal(sizeSystemOn('underwear', 'numbers', '5'), 'numbers');
  assert.equal(sizeSystemOn('watch', null, null), 'watch');
  assert.equal(sizeSystemOn('cap', null, 'S/M'), 'flexfit');
  assert.equal(sizeSystemOn('cap', 'cap', '7'), 'cap');
  assert.equal(sizeSystemOn('pants', 'numbers', '50'), 'numbers');
  assert.equal(sizeSystemOn('pants', null, 'S/M'), 'letters');
  assert.equal(sizeSystemOn('clothing', null, 'M/L'), 'letters');
  assert.equal(sizeSystemOn('letters', 'numbers', '58'), 'letters');
});

test('Größe in der Ansicht mit Einheit', () => {
  assert.equal(sizeText('belt', '95 cm'), 'Länge 95 cm');
  assert.equal(sizeText('hat', '58 cm'), 'Kopfumfang 58 cm');
  assert.equal(sizeText('watch', '40 mm'), 'Gehäuse-Ø 40 mm');
  assert.equal(sizeText('letters', 'M'), 'M');
  assert.equal(sizeText(null, null), null);
});

import { defaultLayers, layersOf } from '../src/fields';
import { setCategory } from '../src/edit';

test('Lagen-Vorgabe je Unterkategorie (Max, 20.11.2026)', () => {
  assert.deepEqual(defaultLayers('top', 't_shirt'), [0]);
  assert.deepEqual(defaultLayers('top', 'shirt'), [0, 1, 2]);
  assert.deepEqual(defaultLayers('top', 'hoodie'), [1]);
  assert.deepEqual(defaultLayers('outerwear', 'coat'), [3]);
  // Jacken-Einteilung (Max, 21.11.2026)
  assert.deepEqual(defaultLayers('outerwear', 'sports_jacket', 'track_jacket'), [1, 2]);
  assert.deepEqual(defaultLayers('outerwear', 'sports_jacket', 'rain_jacket'), [3]);
  assert.deepEqual(defaultLayers('outerwear', 'sports_jacket', 'windbreaker'), [2, 3]);
  assert.deepEqual(defaultLayers('outerwear', 'blouson', 'bomber_jacket'), [2, 3]);
  assert.deepEqual(defaultLayers('outerwear', 'biker_jacket'), [3]);
  assert.deepEqual(defaultLayers('outerwear', 'blazer'), [2]);
  assert.deepEqual(defaultLayers('outerwear', 'vest', 'puffer_vest'), [3]);
  assert.deepEqual(defaultLayers('outerwear', 'vest', 'suit_vest'), [1]);
  assert.deepEqual(defaultLayers('dress', 'slip_dress'), [0]);
  assert.deepEqual(defaultLayers('pants', 'jeans'), []);
  assert.deepEqual(layersOf({ category: 'top', subcategory: 'sweater', layers: [] }), [1]);
  assert.deepEqual(layersOf({ category: 'top', subcategory: 'sweater', layers: [0, 1] }), [0, 1]);
});

test('Lagen in Bearbeiten: Vorgabe beim Laden und beim Kategoriewechsel, eigene Wahl bleibt', async () => {
  const { toEditForm, emptyEditForm, setField } = await import('../src/edit');
  assert.deepEqual(toEditForm({ name: 'X', category: 'top', subcategory: 'hoodie', layers: null }).layers, [1]);
  assert.deepEqual(toEditForm({ name: 'X', category: 'top', subcategory: 'hoodie', layers: [0, 1] }).layers, [0, 1]);
  const tee = setCategory({ ...emptyEditForm({ ownerId: 'max' }), aiPending: [] }, { category: 'top', subcategory: 't_shirt', type: null });
  assert.deepEqual(tee.layers, [0]);
  assert.deepEqual(setCategory(tee, { category: 'outerwear', subcategory: 'coat', type: null }).layers, [3]);
  const own = setField(tee, 'layers', [0, 2]);
  assert.deepEqual(setCategory(own, { category: 'top', subcategory: 'shirt', type: null }).layers, [0, 2]);
});
