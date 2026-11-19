import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categorizeLegacy, parseLegacyMaterial, parseLegacyColors, normalizeCategory } from '../src/import/categorize';

const cat = (category: string, name: string, desc = '', brand = '') => {
  const r = categorizeLegacy({ category, name, desc, brand });
  return [r.category, r.subcategory, r.type, r.sure];
};

test('Altdaten: eindeutige Fälle', () => {
  assert.deepEqual(cat('schuhe', 'CB BLACK PENNY LOAFER'), ['shoe', 'dress_shoe', 'loafer', true]);
  assert.deepEqual(cat('oberteil', 'Brando Fitted T-Shirt'), ['top', 't_shirt', null, true]);
  assert.deepEqual(cat('oberteil', "'BASEMENT' RIB HENLEY LONGSLEEVE"), ['top', 'long_sleeve', 'henley_long_sleeve', true]);
  assert.deepEqual(cat('mantel', 'Beiger Trenchcoat'), ['outerwear', 'trench_coat', null, true]);
  assert.deepEqual(cat('mantel', '109 - Maxi Coat'), ['outerwear', 'coat', null, true]);
  assert.deepEqual(cat('jacke', 'Navy Peacoat'), ['outerwear', 'coat', 'peacoat', true]);
  assert.deepEqual(cat('shorts', 'AVEL SHORTS', 'Weite Bermuda-Shorts'), ['shorts', 'bermuda_shorts', null, true]);
  assert.deepEqual(cat('tasche', 'Debossed Weekender Bag'), ['bag', 'travel_bag', 'weekender', true]);
  assert.deepEqual(cat('accessoire', 'PRX Powermatic 80', 'Rundes Uhrengehäuse'), ['jewelry', 'watch', null, true]);
  assert.deepEqual(cat('accessoire', '05', 'Quadratische Sonnenbrille'), ['accessory', 'glasses', 'sunglasses', true]);
  assert.deepEqual(cat('accessoire', 'MLB NY Cap'), ['headwear', 'cap', null, true]);
});

test('Altdaten: Entscheidungen vom 15.11.2026 (Bomber, Zip-Hoodie, Asics, Birkenstock Boston)', () => {
  assert.deepEqual(cat('jacke', 'Exquisite Bomber Jacket Brown'), ['outerwear', 'blouson', 'bomber_jacket', true]);
  assert.deepEqual(cat('pullover', "'SEOUL' KNIT HOODIE", 'Kurzer, cropped Zip-Hoodie mit Kapuze'), ['outerwear', 'sweat_jacket', 'zip_hoodie', true]);
  assert.deepEqual(cat('schuhe', 'Gel-1130', 'Retro-Laufschuh, Low-Top'), ['shoe', 'sports_shoe', 'running_shoe', true]);
  assert.deepEqual(cat('schuhe', 'GT-2160', 'Sneaker mit Schnürung'), ['shoe', 'sports_shoe', 'running_shoe', true]);
  assert.deepEqual(cat('schuhe', 'Boston', '', 'Birkenstock'), ['shoe', 'clog', null, true]);
});

test('Altdaten: Flanell → Hemd + Material Flanell; Röcke mit Länge', () => {
  const r = categorizeLegacy({ category: 'oberteil', name: 'VINTAGE FLANNEL', desc: 'Hemd, Kentkragen' });
  assert.deepEqual([r.category, r.subcategory, r.material], ['top', 'shirt', 'flannel']);
  const s = categorizeLegacy({ category: 'sonstiges', name: 'Schwarzer Midirock' });
  assert.deepEqual([s.category, s.fitLength], ['skirt', 3]);
});

test('Altdaten: unklar → nur sichere Oberkategorie, sure = false', () => {
  assert.deepEqual(cat('jacke', 'Guardian Coat', 'Kurze Jacke, Schalkragen'), ['outerwear', null, null, false]);
  assert.deepEqual(cat('tasche', 'Buckle Bag'), ['bag', null, null, false]);
  assert.deepEqual(cat('accessoire', 'Irgendwas'), [null, null, null, false]);
});

test('Material: Mischangaben zerlegen, Synonyme, ohne Doppelte', () => {
  assert.deepEqual(parseLegacyMaterial('Wolle und Leder'), ['wool', 'leather']);
  assert.deepEqual(parseLegacyMaterial('Polyester / Kunstleder (Mix)'), ['polyester', 'faux_leather']);
  assert.deepEqual(parseLegacyMaterial('Mischgewebe (Polyester/Wolle vermutet)'), ['polyester', 'wool']);
  assert.deepEqual(parseLegacyMaterial('Wollmischung'), ['wool']);
  assert.deepEqual(parseLegacyMaterial('Lackleder'), ['leather']);
  assert.deepEqual(parseLegacyMaterial('Strick'), []);
  assert.deepEqual(parseLegacyMaterial(''), []);
});

test('Farben: alte Namen → Palette, Grau nach Foto-Helligkeit', () => {
  assert.deepEqual(parseLegacyColors('Schwarz/Weiß'), { colors: ['black', 'white'], unclear: [] });
  assert.deepEqual(parseLegacyColors('Creme/Navy').colors, ['ivory', 'navy']);
  assert.deepEqual(parseLegacyColors('Grau', '#c6c6c7').colors, ['light_grey']);
  assert.deepEqual(parseLegacyColors('Grau', '#383838').colors, ['dark_grey']);
  assert.deepEqual(parseLegacyColors('Grau'), { colors: [], unclear: ['Grau'] });
});

test('normalizeCategory: Hose › Shorts › Typ → Shorts › Typ', () => {
  // Altdaten vor Migration 0009 (deutsche Namen)
  assert.deepEqual(normalizeCategory({ category: 'Hose', subcategory: 'Shorts', item_type: 'Cargoshorts' }), { category: 'shorts', subcategory: 'cargo_shorts', type: null });
  assert.deepEqual(normalizeCategory({ category: 'Hose', subcategory: 'Shorts', item_type: null }), { category: 'shorts', subcategory: null, type: null });
  assert.deepEqual(normalizeCategory({ category: 'pants', subcategory: 'jeans', item_type: null }), { category: 'pants', subcategory: 'jeans', type: null });
});

test('normalizeCategory: Keys bleiben, deutsche Labels und alte IDs werden zu Keys', () => {
  assert.deepEqual(normalizeCategory({ category: 'top', subcategory: 'shirt', item_type: 'long_sleeve_shirt' }), { category: 'top', subcategory: 'shirt', type: 'long_sleeve_shirt' });
  assert.deepEqual(normalizeCategory({ category: 'Oberteil', subcategory: 'Hemd', item_type: 'Langarmhemd' }), { category: 'top', subcategory: 'shirt', type: 'long_sleeve_shirt' });
  assert.deepEqual(normalizeCategory({ category: 'Oberteil', subcategory: 'Sonstiges' }), { category: 'top', subcategory: 'other', type: null });
  assert.deepEqual(normalizeCategory({ category: 'oberteil', name: 'Basic T-Shirt' }), { category: 'top', subcategory: 't_shirt', type: null });
  assert.deepEqual(normalizeCategory({ category: '' }), { category: null, subcategory: null, type: null });
});
