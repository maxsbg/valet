import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORY_TREE, CATEGORY_NAMES, subcategoriesOf, typesOf, isValidPath, categoryLast, pickCategory, fitScalesOf, layoutKind, tileKind, setOrder,
} from '../src/categories';

test('Kategorien: elf Oberkategorien nach Lagen sortiert', () => {
  assert.deepEqual(CATEGORY_NAMES, ['Oberbekleidung', 'Oberteil', 'Kleid', 'Hose', 'Shorts', 'Rock', 'Schuh', 'Kopfbedeckung', 'Tasche', 'Accessoire', 'Schmuck']);
});

test('Namensregeln: kein „&“, Typ wiederholt nicht die Ebene darüber, Namen je Ebene eindeutig', () => {
  for (const c of CATEGORY_TREE) {
    const subs = c.subs.map((s) => s.name);
    assert.equal(new Set(subs).size, subs.length, `doppelte Unterkategorie in ${c.name}`);
    assert.ok(subs.includes('Sonstiges'), `${c.name} ohne Sonstiges`);
    for (const s of c.subs) {
      assert.ok(!s.name.includes('&'));
      assert.notEqual(s.name, c.name);
      for (const t of s.types) { assert.ok(!t.includes('&')); assert.notEqual(t, s.name); }
    }
  }
});

test('Typen sind allein verständlich (Beispiele aus der Spec)', () => {
  assert.deepEqual(typesOf('Oberteil', 'Hemd'), ['Kurzarmhemd', 'Langarmhemd']);
  assert.ok(typesOf('Schuh', 'Sneaker').includes('Low-Top-Sneaker'));
  assert.deepEqual(typesOf('Oberbekleidung', 'Sweatjacke'), ['Zip-Hoodie']);
  assert.deepEqual(typesOf('Oberbekleidung', 'Blouson'), ['Bomberjacke', 'Harrington-Jacke']);
  assert.deepEqual(typesOf('Oberteil', 'Sweatshirt'), []);
  assert.deepEqual(subcategoriesOf('Rock').length, 8);
  // Spec-Stand PR #45/#46: Peacoat statt Caban-Mantel, Beuteltasche entfernt
  assert.deepEqual(typesOf('Oberbekleidung', 'Mantel'), ['Chesterfield-Mantel', 'Peacoat', 'Covert-Mantel', 'Duster-Mantel', 'Carcoat']);
  assert.ok(!typesOf('Tasche', 'Handtasche').includes('Beuteltasche'));
  assert.deepEqual(typesOf('Tasche', 'Handtasche'), ['Shopper', 'Hobo-Bag', 'Bowlingtasche', 'Satchel', 'Baguette-Bag', 'Halbmondtasche', 'Satteltasche', 'Barrel-Bag']);
});

test('Gültige Pfade', () => {
  assert.ok(isValidPath({ category: 'Oberteil', subcategory: 'Hemd', type: 'Kurzarmhemd' }));
  assert.ok(isValidPath({ category: 'Oberteil', subcategory: 'Hemd', type: null }));
  assert.ok(isValidPath({ category: null, subcategory: null, type: null }));
  assert.ok(!isValidPath({ category: 'Oberteil', subcategory: 'Jeans', type: null }));
  assert.ok(!isValidPath({ category: 'Oberteil', subcategory: null, type: 'Kurzarmhemd' }));
  assert.ok(!isValidPath({ category: 'Oberteile', subcategory: null, type: null }));
});

test('Anzeige: nur die letzte gewählte Stufe', () => {
  assert.equal(categoryLast({ category: 'Oberteil', subcategory: 'Hemd', type: 'Kurzarmhemd' }), 'Kurzarmhemd');
  assert.equal(categoryLast({ category: 'Oberteil', subcategory: 'Hemd', type: null }), 'Hemd');
  assert.equal(categoryLast({ category: 'Oberteil' }), 'Oberteil');
  assert.equal(categoryLast({}), '');
});

test('Auswahl: neue Oberkategorie setzt zurück, erneut tippen hebt auf', () => {
  let p = pickCategory({ category: null, subcategory: null, type: null }, 'category', 'Oberteil');
  p = pickCategory(p, 'subcategory', 'Hemd');
  p = pickCategory(p, 'type', 'Langarmhemd');
  assert.deepEqual(p, { category: 'Oberteil', subcategory: 'Hemd', type: 'Langarmhemd' });
  assert.deepEqual(pickCategory(p, 'type', 'Langarmhemd'), { category: 'Oberteil', subcategory: 'Hemd', type: null });
  assert.deepEqual(pickCategory(p, 'subcategory', 'T-Shirt'), { category: 'Oberteil', subcategory: 'T-Shirt', type: null });
  assert.deepEqual(pickCategory(p, 'category', 'Hose'), { category: 'Hose', subcategory: null, type: null });
  assert.deepEqual(pickCategory(p, 'category', 'Oberteil'), { category: null, subcategory: null, type: null });
});

test('Passform je Kategorie', () => {
  assert.deepEqual(fitScalesOf('Oberteil').map((s) => s.key), ['width', 'length']);
  assert.deepEqual(fitScalesOf('Hose').map((s) => s.key), ['width', 'length', 'rise']);
  assert.deepEqual(fitScalesOf('Kleid').map((s) => s.key), ['length']);
  assert.deepEqual(fitScalesOf('Kleid')[0]!.steps, ['Mini', 'über Knie', 'Knie', 'Midi', 'Maxi']);
  assert.deepEqual(fitScalesOf('Rock').map((s) => s.key), ['length', 'rise']);
  assert.deepEqual(fitScalesOf('Schuh'), []);
  assert.equal(fitScalesOf('Hose')[2]!.steps.length, 3);
});

test('Form für Mosaik und Board', () => {
  assert.equal(layoutKind('Oberbekleidung', 'Mantel'), 'mantel');
  assert.equal(layoutKind('Oberbekleidung', 'Blouson'), 'jacke');
  assert.equal(layoutKind('Oberteil', 'Kapuzenpullover'), 'pullover');
  assert.equal(layoutKind('Oberteil', 'Hemd'), 'oberteil');
  assert.equal(layoutKind('Shorts', 'Cargoshorts'), 'shorts');
  assert.equal(layoutKind('Hose', 'Jeans'), 'hose');
  assert.equal(layoutKind('Kopfbedeckung', 'Kappe'), 'kopf');
  assert.equal(layoutKind('Schmuck', 'Uhr'), 'accessoire');
  assert.equal(layoutKind(null), 'accessoire');
});

test('Kachelhöhe: Typ und Länge zählen', () => {
  assert.equal(tileKind('Oberbekleidung', 'Mantel', 'Peacoat'), 'jacke');
  assert.equal(tileKind('Oberbekleidung', 'Mantel', 'Carcoat'), 'mantel');
  assert.equal(tileKind('Oberbekleidung', 'Mantel', null), 'mantel');
  assert.equal(tileKind('Oberbekleidung', 'Weste', 'Steppweste'), 'oberteil');
  assert.equal(tileKind('Oberbekleidung', 'Sonstiges', 'Morgenmantel'), 'mantel');
  assert.equal(tileKind('Hose', 'Pyjama-Hose', null), 'hose');
  assert.equal(tileKind('Hose', 'Pyjama-Hose', 'Schlafshorts'), 'shorts');
  assert.equal(tileKind('Kleid', 'Etuikleid', null, 0), 'jacke');
  assert.equal(tileKind('Kleid', 'Etuikleid', null, 3), 'kleid');
  assert.equal(tileKind('Kleid', 'Playsuit', null), 'jacke');
  assert.equal(tileKind('Kleid', 'Tunika', null, 4), 'kleid');
  assert.equal(tileKind('Rock', 'Meerjungfrau-Rock', null), 'hose');
  assert.equal(tileKind('Rock', 'Bleistiftrock', null, 4), 'hose');
  assert.equal(tileKind('Rock', 'Meerjungfrau-Rock', null, 1), 'rock');
  assert.equal(tileKind('Schuh', 'Stiefel', 'Kniestiefel'), 'tasche');
  assert.equal(tileKind('Schuh', 'Stiefel', 'Chelsea Boot'), 'schuhe');
  assert.equal(tileKind('Accessoire', 'Traditionelle Kleidung', null), 'kleid');
  assert.equal(tileKind('Accessoire', 'Bademode', 'Badehose'), 'shorts');
  assert.equal(tileKind('Accessoire', 'Gürtel', null), 'accessoire');
});

test('Set-Reihenfolge: von oben nach unten am Körper, außen vor innen', () => {
  const items = [
    { id: 'schuh', category: 'Schuh', subcategory: 'Sneaker' },
    { id: 'tasche', category: 'Tasche', subcategory: 'Rucksack' },
    { id: 'shirt', category: 'Oberteil', subcategory: 'T-Shirt' },
    { id: 'hose', category: 'Hose', subcategory: 'Jeans' },
    { id: 'cap', category: 'Kopfbedeckung', subcategory: 'Kappe' },
    { id: 'jacke', category: 'Oberbekleidung', subcategory: 'Blouson' },
    { id: 'hemd', category: 'Oberteil', subcategory: 'Hemd' },
  ];
  assert.deepEqual(setOrder(items).map((i) => i.id), ['cap', 'jacke', 'hemd', 'shirt', 'hose', 'schuh', 'tasche']);
  // Lagen haben Vorrang vor der Unterkategorie
  const anzug = [{ id: 'weste', category: 'Oberbekleidung', subcategory: 'Weste', layers: [1] }, { id: 'blazer', category: 'Oberbekleidung', subcategory: 'Blazer', layers: [3] }];
  assert.deepEqual(setOrder(anzug).map((i) => i.id), ['blazer', 'weste']);
});
