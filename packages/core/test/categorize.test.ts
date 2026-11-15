import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categorizeLegacy, parseLegacyMaterial, parseLegacyColors } from '../src/import/categorize';

const cat = (category: string, name: string, desc = '', brand = '') => {
  const r = categorizeLegacy({ category, name, desc, brand });
  return [r.category, r.subcategory, r.type, r.sure];
};

test('Altdaten: eindeutige Fälle', () => {
  assert.deepEqual(cat('schuhe', 'CB BLACK PENNY LOAFER'), ['Schuh', 'Halbschuh', 'Loafer', true]);
  assert.deepEqual(cat('oberteil', 'Brando Fitted T-Shirt'), ['Oberteil', 'T-Shirt', null, true]);
  assert.deepEqual(cat('oberteil', "'BASEMENT' RIB HENLEY LONGSLEEVE"), ['Oberteil', 'Langarmshirt', 'Henley-Langarmshirt', true]);
  assert.deepEqual(cat('mantel', 'Beiger Trenchcoat'), ['Oberbekleidung', 'Trenchcoat', null, true]);
  assert.deepEqual(cat('mantel', '109 - Maxi Coat'), ['Oberbekleidung', 'Mantel', null, true]);
  assert.deepEqual(cat('shorts', 'AVEL SHORTS', 'Weite Bermuda-Shorts'), ['Hose', 'Shorts', 'Bermudashorts', true]);
  assert.deepEqual(cat('tasche', 'Debossed Weekender Bag'), ['Tasche', 'Reisetasche', 'Weekender', true]);
  assert.deepEqual(cat('accessoire', 'PRX Powermatic 80', 'Rundes Uhrengehäuse'), ['Schmuck', 'Uhr', null, true]);
  assert.deepEqual(cat('accessoire', '05', 'Quadratische Sonnenbrille'), ['Accessoire', 'Brille', 'Sonnenbrille', true]);
  assert.deepEqual(cat('accessoire', 'MLB NY Cap'), ['Kopfbedeckung', 'Kappe', null, true]);
});

test('Altdaten: Entscheidungen vom 15.11.2026 (Bomber, Zip-Hoodie, Asics, Birkenstock Boston)', () => {
  assert.deepEqual(cat('jacke', 'Exquisite Bomber Jacket Brown'), ['Oberbekleidung', 'Blouson', 'Bomberjacke', true]);
  assert.deepEqual(cat('pullover', "'SEOUL' KNIT HOODIE", 'Kurzer, cropped Zip-Hoodie mit Kapuze'), ['Oberbekleidung', 'Sweatjacke', 'Zip-Hoodie', true]);
  assert.deepEqual(cat('schuhe', 'Gel-1130', 'Retro-Laufschuh, Low-Top'), ['Schuh', 'Sportschuh', 'Laufschuh', true]);
  assert.deepEqual(cat('schuhe', 'GT-2160', 'Sneaker mit Schnürung'), ['Schuh', 'Sportschuh', 'Laufschuh', true]);
  assert.deepEqual(cat('schuhe', 'Boston', '', 'Birkenstock'), ['Schuh', 'Clog', null, true]);
});

test('Altdaten: Flanell → Hemd + Material Flanell; Röcke mit Länge', () => {
  const r = categorizeLegacy({ category: 'oberteil', name: 'VINTAGE FLANNEL', desc: 'Hemd, Kentkragen' });
  assert.deepEqual([r.category, r.subcategory, r.material], ['Oberteil', 'Hemd', 'Flanell']);
  const s = categorizeLegacy({ category: 'sonstiges', name: 'Schwarzer Midirock' });
  assert.deepEqual([s.category, s.fitLength], ['Rock', 3]);
});

test('Altdaten: unklar → nur sichere Oberkategorie, sure = false', () => {
  assert.deepEqual(cat('jacke', 'Guardian Coat', 'Kurze Jacke, Schalkragen'), ['Oberbekleidung', null, null, false]);
  assert.deepEqual(cat('tasche', 'Buckle Bag'), ['Tasche', null, null, false]);
  assert.deepEqual(cat('accessoire', 'Irgendwas'), [null, null, null, false]);
});

test('Material: Mischangaben zerlegen, Synonyme, ohne Doppelte', () => {
  assert.deepEqual(parseLegacyMaterial('Wolle und Leder'), ['Wolle', 'Leder']);
  assert.deepEqual(parseLegacyMaterial('Polyester / Kunstleder (Mix)'), ['Polyester', 'Kunstleder']);
  assert.deepEqual(parseLegacyMaterial('Mischgewebe (Polyester/Wolle vermutet)'), ['Polyester', 'Wolle']);
  assert.deepEqual(parseLegacyMaterial('Wollmischung'), ['Wolle']);
  assert.deepEqual(parseLegacyMaterial('Lackleder'), ['Leder']);
  assert.deepEqual(parseLegacyMaterial('Strick'), []);
  assert.deepEqual(parseLegacyMaterial(''), []);
});

test('Farben: alte Namen → Palette, Grau nach Foto-Helligkeit', () => {
  assert.deepEqual(parseLegacyColors('Schwarz/Weiß'), { colors: ['Schwarz', 'Weiß'], unclear: [] });
  assert.deepEqual(parseLegacyColors('Creme/Navy').colors, ['Elfenbein', 'Marineblau']);
  assert.deepEqual(parseLegacyColors('Grau', '#c6c6c7').colors, ['Hellgrau']);
  assert.deepEqual(parseLegacyColors('Grau', '#383838').colors, ['Dunkelgrau']);
  assert.deepEqual(parseLegacyColors('Grau'), { colors: [], unclear: ['Grau'] });
});
