import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORY_TREE, CATEGORY_KEYS, subcategoriesOf, typesOf, isValidPath, categoryLast, pickCategory, fitScalesOf, layoutKind, tileKind, setOrder,
} from '../src/categories';

test('Kategorien: elf Oberkategorien nach Lagen sortiert', () => {
  assert.deepEqual(CATEGORY_KEYS, ['outerwear', 'top', 'dress', 'pants', 'shorts', 'skirt', 'shoe', 'headwear', 'bag', 'accessory', 'jewelry']);
});

test('Namensregeln: kein „&“, Typ wiederholt nicht die Ebene darüber, Namen je Ebene eindeutig', () => {
  for (const c of CATEGORY_TREE) {
    const subs = c.subs.map((s) => s.key);
    assert.equal(new Set(subs).size, subs.length, `doppelte Unterkategorie in ${c.label}`);
    assert.equal(new Set(c.subs.map((s) => s.label)).size, subs.length, `doppeltes Label in ${c.label}`);
    assert.ok(c.subs.some((s) => s.key === 'other' && s.label === 'Sonstiges'), `${c.label} ohne Sonstiges`);
    for (const s of c.subs) {
      assert.ok(!s.label.includes('&'));
      assert.notEqual(s.label, c.label);
      for (const t of s.types) { assert.ok(!t.label.includes('&')); assert.notEqual(t.label, s.label); }
    }
  }
});

test('Typen sind allein verständlich (Beispiele aus der Spec)', () => {
  assert.deepEqual(typesOf('top', 'shirt'), ['short_sleeve_shirt', 'long_sleeve_shirt']);
  assert.ok(typesOf('shoe', 'sneaker').includes('low_top_sneaker'));
  assert.deepEqual(typesOf('outerwear', 'sweat_jacket'), ['zip_hoodie']);
  assert.deepEqual(typesOf('outerwear', 'blouson'), ['bomber_jacket', 'harrington_jacket']);
  assert.deepEqual(typesOf('top', 'sweatshirt'), ['half_zip_sweatshirt']); // Max 21.11.2026
  assert.deepEqual(subcategoriesOf('skirt').length, 8);
  // Spec-Stand PR #45/#46: Peacoat statt Caban-Mantel, Beuteltasche entfernt
  assert.deepEqual(typesOf('outerwear', 'coat'), ['chesterfield_coat', 'peacoat', 'covert_coat', 'duster_coat', 'car_coat']);
  assert.ok(!typesOf('bag', 'handbag').includes('Beuteltasche'));
  assert.deepEqual(typesOf('bag', 'handbag'), ['shopper', 'hobo_bag', 'bowling_bag', 'satchel', 'baguette_bag', 'half_moon_bag', 'saddle_bag', 'barrel_bag']);
});

test('Gültige Pfade', () => {
  assert.ok(isValidPath({ category: 'top', subcategory: 'shirt', type: 'short_sleeve_shirt' }));
  assert.ok(isValidPath({ category: 'top', subcategory: 'shirt', type: null }));
  assert.ok(isValidPath({ category: null, subcategory: null, type: null }));
  assert.ok(!isValidPath({ category: 'top', subcategory: 'jeans', type: null }));
  assert.ok(!isValidPath({ category: 'top', subcategory: null, type: 'short_sleeve_shirt' }));
  assert.ok(!isValidPath({ category: 'Oberteile', subcategory: null, type: null }));
});

test('Anzeige: nur die letzte gewählte Stufe', () => {
  assert.equal(categoryLast({ category: 'top', subcategory: 'shirt', type: 'short_sleeve_shirt' }), 'Kurzarmhemd');
  assert.equal(categoryLast({ category: 'top', subcategory: 'shirt', type: null }), 'Hemd');
  assert.equal(categoryLast({ category: 'top' }), 'Oberteil');
  assert.equal(categoryLast({}), '');
});

test('Auswahl: neue Oberkategorie setzt zurück, erneut tippen hebt auf', () => {
  let p = pickCategory({ category: null, subcategory: null, type: null }, 'category', 'top');
  p = pickCategory(p, 'subcategory', 'shirt');
  p = pickCategory(p, 'type', 'long_sleeve_shirt');
  assert.deepEqual(p, { category: 'top', subcategory: 'shirt', type: 'long_sleeve_shirt' });
  assert.deepEqual(pickCategory(p, 'type', 'long_sleeve_shirt'), { category: 'top', subcategory: 'shirt', type: null });
  assert.deepEqual(pickCategory(p, 'subcategory', 't_shirt'), { category: 'top', subcategory: 't_shirt', type: null });
  assert.deepEqual(pickCategory(p, 'category', 'pants'), { category: 'pants', subcategory: null, type: null });
  assert.deepEqual(pickCategory(p, 'category', 'top'), { category: null, subcategory: null, type: null });
});

test('Passform je Kategorie', () => {
  assert.deepEqual(fitScalesOf('top').map((s) => s.key), ['width', 'length']);
  assert.deepEqual(fitScalesOf('pants').map((s) => s.key), ['width', 'length', 'rise']);
  assert.deepEqual(fitScalesOf('dress').map((s) => s.key), ['length']);
  assert.deepEqual(fitScalesOf('dress')[0]!.steps, ['Mini', 'über Knie', 'Knie', 'Midi', 'Maxi']);
  assert.deepEqual(fitScalesOf('skirt').map((s) => s.key), ['length', 'rise']);
  assert.deepEqual(fitScalesOf('shoe'), []);
  assert.equal(fitScalesOf('pants')[2]!.steps.length, 3);
});

test('Form für Mosaik und Board', () => {
  assert.equal(layoutKind('outerwear', 'coat'), 'coat');
  assert.equal(layoutKind('outerwear', 'blouson'), 'jacket');
  assert.equal(layoutKind('top', 'hoodie'), 'sweater');
  assert.equal(layoutKind('top', 'shirt'), 'top');
  assert.equal(layoutKind('shorts', 'cargo_shorts'), 'shorts');
  assert.equal(layoutKind('pants', 'jeans'), 'pants');
  assert.equal(layoutKind('headwear', 'cap'), 'headwear');
  assert.equal(layoutKind('jewelry', 'watch'), 'accessory');
  assert.equal(layoutKind(null), 'accessory');
});

test('Kachelhöhe: Typ und Länge zählen', () => {
  assert.equal(tileKind('outerwear', 'coat', 'peacoat'), 'jacket');
  assert.equal(tileKind('outerwear', 'coat', 'car_coat'), 'coat');
  assert.equal(tileKind('outerwear', 'coat', null), 'coat');
  assert.equal(tileKind('outerwear', 'vest', 'puffer_vest'), 'top');
  assert.equal(tileKind('outerwear', 'other', 'robe'), 'coat');
  assert.equal(tileKind('pants', 'pajama_pants', null), 'pants');
  assert.equal(tileKind('pants', 'pajama_pants', 'sleep_shorts'), 'shorts');
  assert.equal(tileKind('dress', 'sheath_dress', null, 0), 'jacket');
  assert.equal(tileKind('dress', 'sheath_dress', null, 3), 'dress');
  assert.equal(tileKind('dress', 'playsuit', null), 'jacket');
  assert.equal(tileKind('dress', 'tunic', null, 4), 'dress');
  assert.equal(tileKind('skirt', 'mermaid_skirt', null), 'pants');
  assert.equal(tileKind('skirt', 'pencil_skirt', null, 4), 'pants');
  assert.equal(tileKind('skirt', 'mermaid_skirt', null, 1), 'skirt');
  assert.equal(tileKind('shoe', 'boot', 'knee_boot'), 'bag');
  assert.equal(tileKind('shoe', 'boot', 'chelsea_boot'), 'shoe');
  assert.equal(tileKind('accessory', 'traditional_clothing', null), 'dress');
  assert.equal(tileKind('accessory', 'swimwear', 'swim_briefs'), 'shorts');
  assert.equal(tileKind('accessory', 'belt', null), 'accessory');
});

test('Set-Reihenfolge: von oben nach unten am Körper, außen vor innen', () => {
  const items = [
    { id: 'schuh', category: 'shoe', subcategory: 'sneaker' },
    { id: 'bag', category: 'bag', subcategory: 'backpack' },
    { id: 'shirt', category: 'top', subcategory: 't_shirt' },
    { id: 'pants', category: 'pants', subcategory: 'jeans' },
    { id: 'cap', category: 'headwear', subcategory: 'cap' },
    { id: 'jacket', category: 'outerwear', subcategory: 'blouson' },
    { id: 'hemd', category: 'top', subcategory: 'shirt' },
  ];
  assert.deepEqual(setOrder(items).map((i) => i.id), ['cap', 'jacket', 'hemd', 'shirt', 'pants', 'schuh', 'bag']);
  // Lagen haben Vorrang vor der Unterkategorie
  const anzug = [{ id: 'weste', category: 'outerwear', subcategory: 'vest', layers: [1] }, { id: 'blazer', category: 'outerwear', subcategory: 'blazer', layers: [3] }];
  assert.deepEqual(setOrder(anzug).map((i) => i.id), ['blazer', 'weste']);
});
