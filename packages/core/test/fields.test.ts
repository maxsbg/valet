import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  showField, fieldsFor, necklineOf, sizeKindOf, sizeSystemsFor, effectiveSizeSystem, sizeOptions, allowsCustomSize,
  parseWL, formatWL, normalizeWL, WAISTS, INSEAMS, SHOE_SIZES, NECKLINES, OUTER_COLLARS, FIELD_RULES,
} from '../src/fields';
import { CATEGORY_NAMES, subcategoriesOf } from '../src/categories';
import { COLLARS } from '../src/attributes';
import { toEditForm, emptyEditForm, pickWL, pickSizeSystem, isCustomSize, editChange, type EditForm } from '../src/edit';

test('Hose: keine Lagen, kein Kragen, kein Verschluss; Passform, Wetter, Pflege ja', () => {
  for (const k of ['layers', 'neckline', 'closure', 'strap'] as const) assert.equal(showField(k, 'Hose', 'Jeans'), false, k);
  for (const k of ['pattern', 'reversible', 'size', 'fit', 'weather', 'care'] as const) assert.equal(showField(k, 'Hose', 'Jeans'), true, k);
  assert.deepEqual(fieldsFor('Hose', 'Jeans'), ['category', 'seasons', 'colors', 'material', 'style', 'pattern', 'reversible', 'size', 'fit', 'weather', 'care']);
});

test('Tabelle 8a: Stichproben je Kategorie', () => {
  assert.deepEqual(fieldsFor('Schmuck', 'Halskette'), ['category', 'seasons', 'colors', 'material', 'style']);
  assert.ok(showField('size', 'Schmuck', 'Ring'));
  assert.deepEqual(fieldsFor('Tasche', 'Rucksack').slice(5), ['pattern', 'reversible', 'closure', 'strap']);
  assert.deepEqual(fieldsFor('Schuh', 'Sneaker').slice(5), ['size', 'weather', 'closure']);
  assert.deepEqual(fieldsFor('Kleid', null).slice(5), ['pattern', 'reversible', 'size', 'fit', 'weather', 'neckline', 'care']);
  assert.deepEqual(fieldsFor('Oberbekleidung', 'Parka').slice(5), ['pattern', 'reversible', 'size', 'layers', 'weather', 'neckline', 'closure', 'care']);
  assert.deepEqual(fieldsFor('Kopfbedeckung', 'Kappe').slice(5), ['pattern', 'reversible', 'size', 'weather', 'care']);
});

test('Unterkategorie-Listen: Verschluss nur Hemd/Bluse/Polohemd/Body, Accessoire Pflege/Wetter nur Textiles', () => {
  assert.ok(showField('closure', 'Oberteil', 'Hemd'));
  assert.ok(!showField('closure', 'Oberteil', 'T-Shirt'));
  assert.ok(!showField('closure', 'Oberteil', null));
  assert.ok(showField('closure', 'Accessoire', 'Gürtel'));
  assert.ok(!showField('closure', 'Accessoire', 'Schal'));
  assert.ok(showField('care', 'Accessoire', 'Socke'));
  assert.ok(!showField('care', 'Accessoire', 'Brille'));
  assert.ok(showField('weather', 'Accessoire', 'Schal'));
  assert.ok(!showField('weather', 'Accessoire', 'Gürtel'));
});

test('Listen in der Tabelle nennen nur echte Kategorien und Unterkategorien', () => {
  for (const rules of Object.values(FIELD_RULES)) {
    for (const [cat, r] of Object.entries(rules)) {
      assert.ok(CATEGORY_NAMES.includes(cat), cat);
      if (Array.isArray(r)) for (const sub of r) assert.ok(subcategoriesOf(cat).includes(sub), `${cat} › ${sub}`);
    }
  }
});

test('Ohne Kategorie: alles außer Trägerart', () => {
  assert.ok(showField('layers', null));
  assert.ok(!showField('strap', null));
});

test('Ausschnitt oder Kragen nach Unterkategorie', () => {
  assert.deepEqual(necklineOf('Oberteil', 'Hemd'), { label: 'Kragen', options: COLLARS });
  assert.deepEqual(necklineOf('Oberteil', 'Bluse')?.label, 'Kragen');
  assert.deepEqual(necklineOf('Oberteil', 'T-Shirt'), { label: 'Ausschnitt', options: NECKLINES });
  assert.deepEqual(necklineOf('Oberteil', 'Polohemd')?.label, 'Ausschnitt');
  assert.deepEqual(necklineOf('Kleid', null)?.label, 'Ausschnitt');
  assert.deepEqual(necklineOf('Oberbekleidung', 'Blazer'), { label: 'Kragen', options: OUTER_COLLARS });
  assert.ok(OUTER_COLLARS.includes('Kapuze'));
  assert.equal(necklineOf('Hose', 'Jeans'), null);
});

test('Größen-Art je Kategorie', () => {
  assert.equal(sizeKindOf('Hose', 'Jeans'), 'pants');
  assert.equal(sizeKindOf('Hose', 'Shorts'), 'waist');
  assert.equal(sizeKindOf('Hose', 'Pyjama-Hose'), 'waist');
  assert.equal(sizeKindOf('Schuh', 'Sneaker'), 'shoe');
  assert.equal(sizeKindOf('Kopfbedeckung', 'Kappe'), 'cap');
  assert.equal(sizeKindOf('Kopfbedeckung', 'Hut'), 'clothes');
  assert.equal(sizeKindOf('Schmuck', 'Ring'), 'ring');
  assert.equal(sizeKindOf('Schmuck', 'Uhr'), null);
  assert.equal(sizeKindOf('Tasche', 'Rucksack'), null);
  assert.deepEqual(sizeSystemsFor('pants'), ['wl', 'letters']);
  assert.equal(effectiveSizeSystem('pants', null), 'wl');
  assert.equal(effectiveSizeSystem('pants', 'numbers'), 'wl');
  assert.equal(effectiveSizeSystem('clothes', null), null);
  assert.deepEqual(sizeOptions('pants', 'wl'), []);
  assert.ok(sizeOptions('pants', 'letters').includes('M'));
  assert.ok(!allowsCustomSize('pants') && allowsCustomSize('cap'));
  assert.equal(SHOE_SIZES[0], '35');
  assert.equal(SHOE_SIZES[1], '35,5');
  assert.equal(SHOE_SIZES.at(-1), '48');
});

test('W/L: Bereiche, Lesen, Schreiben', () => {
  assert.deepEqual([WAISTS[0], WAISTS.at(-1), INSEAMS[0], INSEAMS.at(-1)], [26, 40, 28, 36]);
  assert.deepEqual(parseWL('W28/L32'), { w: 28, l: 32 });
  assert.deepEqual(parseWL('w 30 / l 34'), { w: 30, l: 34 });
  assert.deepEqual(parseWL('30/32'), { w: 30, l: 32 });
  assert.deepEqual(parseWL('31x32'), { w: 31, l: 32 });
  assert.deepEqual(parseWL('W30 L34'), { w: 30, l: 34 });
  assert.deepEqual(parseWL('W30'), { w: 30, l: null });
  for (const x of ['L', 'M', '50', '', null, 'W99/L32']) assert.equal(parseWL(x), null, String(x));
  assert.equal(formatWL({ w: 28, l: 32 }), 'W28/L32');
  assert.equal(formatWL({ w: 30, l: null }), 'W30');
  assert.equal(formatWL({ w: null, l: 32 }), 'L32');
  assert.equal(formatWL({ w: null, l: null }), null);
  assert.equal(normalizeWL('28 / 32'), 'W28/L32');
});

const hose = (p: Partial<EditForm> = {}): EditForm => ({ ...emptyEditForm(), name: 'Jeans', category: 'Hose', subcategory: 'Jeans', ...p });

test('Laden: Hosen-Freitext → W/L, Buchstaben bleiben, Unpassendes bleibt stehen', () => {
  const a = toEditForm({ name: 'X', category: 'Hose', subcategory: 'Stoffhose', size: 'W 28 / L 32', size_system: null });
  assert.deepEqual([a.sizeSystem, a.size], ['wl', 'W28/L32']);
  const b = toEditForm({ name: 'X', category: 'Hose', subcategory: 'Jeans', size: 'L', size_system: 'letters' });
  assert.deepEqual([b.sizeSystem, b.size], ['letters', 'L']);
  const c = toEditForm({ name: 'X', category: 'Hose', subcategory: 'Jeans', size: '50', size_system: 'numbers' });
  assert.deepEqual([c.sizeSystem, c.size], ['wl', '50']);
  assert.ok(isCustomSize(c));
  const d = toEditForm({ name: 'X', category: 'Oberteil', subcategory: 'Hemd', size: 'M', size_system: 'letters' });
  assert.deepEqual([d.sizeSystem, d.size], ['letters', 'M']);
});

test('W/L antippen: Bund und Länge, erneut tippen hebt auf; Shorts nur Bund', () => {
  let f = pickWL(hose(), 'w', 30);
  assert.equal(f.size, 'W30');
  f = pickWL(f, 'l', 32);
  assert.deepEqual([f.sizeSystem, f.size], ['wl', 'W30/L32']);
  assert.equal(pickWL(f, 'w', 30).size, 'L32');
  assert.equal(pickWL(f, 'w', 31).size, 'W31/L32');
  const s = pickWL(pickWL(hose({ subcategory: 'Shorts' }), 'w', 32), 'l', 32);
  assert.equal(s.size, 'W32');
});

test('Hose: Systemwechsel W/L ↔ Buchstaben, erneut tippen ändert nichts', () => {
  const f = hose({ sizeSystem: 'wl', size: 'W30/L32' });
  assert.equal(pickSizeSystem(f, 'wl'), f);
  const g = pickSizeSystem(f, 'letters');
  assert.deepEqual([g.sizeSystem, g.size], ['letters', null]);
  assert.equal(pickSizeSystem(hose({ sizeSystem: null }), 'wl').sizeSystem, null); // schon W/L (Standard)
});

test('Speichern: W/L als leeres System, ausgeblendete Werte bleiben erhalten', () => {
  const r = editChange(hose({ sizeSystem: 'wl', size: 'W30/L32', layers: [0], standalone: true, collar: 'Rundhals', closure: 'Knöpfe' }));
  assert.ok('change' in r);
  assert.deepEqual([r.change.size_system, r.change.size], [null, 'W30/L32']);
  assert.deepEqual([r.change.layers, r.change.standalone, r.change.collar, r.change.closure], [[0], true, 'Rundhals', 'Knöpfe']);
});
