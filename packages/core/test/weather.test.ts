import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weatherFrom, applyWeather, weatherNote } from '../src/weather';
import { emptyEditForm, setCategory, setField } from '../src/edit';

const w = (category: string, subcategory: string | null, type: string | null, mats: string[], name = '') =>
  weatherFrom({ category, subcategory, type, materials: mats.map((name) => ({ name, pct: null })), name });

test('Wärme: Grundwert + Material + Stichwort', () => {
  assert.equal(w('headwear', 'cap', null, ['cotton']).warmth, 0);
  assert.equal(w('headwear', 'cap', null, ['wool']).warmth, 1);
  assert.equal(w('shorts', 'suit_shorts', null, ['cotton']).warmth, 0);
  assert.equal(w('pants', 'trousers', null, ['wool']).warmth, 2);
  assert.equal(w('outerwear', 'blouson', null, ['leather']).warmth, 2);
  assert.equal(w('outerwear', 'blouson', null, ['leather'], 'Lined Leather Jacket').warmth, 3);
});

test('Schuhe: nur nach Art, Material verschiebt nichts', () => {
  assert.equal(w('shoe', 'sports_shoe', 'running_shoe', ['mesh']).warmth, 1);
  assert.equal(w('shoe', 'sandal', 'trekking_sandal', []).warmth, 0);
  assert.equal(w('shoe', 'slide', 'mule', ['leather']).warmth, 1);
  assert.equal(w('shoe', 'clog', null, ['suede']).warmth, 1);
  assert.equal(w('shoe', 'slip_on', 'espadrille', []).warmth, 0);
  assert.equal(w('shoe', 'boot', 'lace_up_boot', ['leather']).warmth, 2);
  assert.equal(w('shoe', 'boot', 'sheepskin_boot', ['suede']).warmth, 3);
  assert.equal(w('shoe', 'boot', 'chelsea_boot', ['leather'], 'Chelsea Boot gefüttert').warmth, 3);
  assert.equal(w('shoe', 'sports_shoe', 'running_shoe', []).warmthSure, true);
});

test('Regen: Material nur bei Außenlage und Schuhen, Trenchcoat und Gabardine mittel', () => {
  assert.equal(w('pants', 'trousers', null, ['polyester']).rain, 0);
  assert.equal(w('outerwear', 'sports_jacket', 'track_jacket', ['polyester']).rain, 1);
  assert.equal(w('shoe', 'sports_shoe', 'running_shoe', ['mesh']).rain, 0);
  assert.equal(w('outerwear', 'trench_coat', null, ['cotton']).rain, 1);
  assert.equal(w('outerwear', 'overshirt', null, ['cotton'], 'Gabardine Overshirt').rain, 1);
  assert.equal(w('pants', 'trousers', null, ['cotton'], 'Wasserdicht Hose').rain, 2);
});

test('applyWeather: ersetzt Bildschätzung, nie bestätigte Werte', () => {
  let f = setCategory({ ...emptyEditForm({ ownerId: 'max' }) }, { category: 'top', subcategory: 't_shirt', type: null });
  f = { ...f, warmth: 2, aiPending: ['warmth'] };
  f = setField(f, 'materials', [{ name: 'cotton', pct: null }]);
  assert.equal(f.warmth, 1);
  assert.ok(f.aiPending.includes('warmth'));
  assert.equal((f.analysisBase.src as Record<string, string>).warmth, 'material');
  assert.match(weatherNote(f) ?? '', /Wärme/);
  // bestätigt bleibt
  const c = setField({ ...f, warmth: 3, aiPending: [] }, 'materials', [{ name: 'linen', pct: null }]);
  assert.equal(c.warmth, 3);
  // Material weg → berechneter Wert verschwindet
  const g = setField(f, 'materials', []);
  assert.equal(g.warmth, null);
  assert.ok(!g.aiPending.includes('warmth'));
  assert.equal(applyWeather(g), g);
});
