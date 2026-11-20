import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANALYZE_ITEM_SCHEMA, CATEGORY_PATHS, checkAnalysis, applyAnalysis, parsePath } from '../src/ai/analyzeItem';
import { emptyEditForm, setField } from '../src/edit';

test('Schema: Pfade eindeutig, Pflichtfelder vorhanden', () => {
  assert.equal(new Set(CATEGORY_PATHS).size, CATEGORY_PATHS.length);
  assert.ok(CATEGORY_PATHS.includes('top/shirt/long_sleeve_shirt'));
  for (const k of ANALYZE_ITEM_SCHEMA.required!) assert.ok(ANALYZE_ITEM_SCHEMA.properties![k]);
});

test('Pfad: gültig übernommen, ungültig verworfen', () => {
  assert.deepEqual(parsePath('top/shirt/long_sleeve_shirt'), { category: 'top', subcategory: 'shirt', type: 'long_sleeve_shirt' });
  assert.deepEqual(parsePath('Oberteil › Jeans'), { category: null, subcategory: null, type: null });
  assert.deepEqual(parsePath(42), { category: null, subcategory: null, type: null });
});

test('Prüfung: Unsinn fliegt raus; unpassende Felder fallen beim Zusammenführen mit dem endgültigen Pfad weg', () => {
  const a = checkAnalysis({
    category: 'pants/jeans', name: ' Straight Jeans ', colors: ['blue', 'Lila-Glitzer', 'blue'], pattern: 'solid',
    materials: ['denim', 'elastane'], collar: 'button_down', width: 'regular', length: 'knielang', rise: 'regular', layers: [0], warmth: 2, strap: 'chain',
  });
  assert.deepEqual(a.path, { category: 'pants', subcategory: 'jeans', type: null });
  assert.equal(a.name, 'Straight Jeans');
  assert.deepEqual(a.colors, ['blue']);
  assert.deepEqual(a.materials, [{ name: 'denim' }, { name: 'elastane' }]);
  assert.deepEqual(a.fit, { width: 'regular', length: null, rise: 'regular' }); // unbekannter Begriff fliegt raus
  // checkAnalysis prüft nur Werte; im Formular (Hose) gibt es keinen Kragen, keine Trägerart, keine Lagen
  const f = applyAnalysis({ ...emptyEditForm({ ownerId: 'max' }), aiPending: [] }, a);
  assert.equal(f.collar, null);
  assert.equal(f.strap, null);
  assert.deepEqual(f.fit, { width: 2, length: null, rise: 1 });
  assert.deepEqual(f.layers, []);
  assert.equal(f.warmth, 2);
  for (const k of ['collar', 'strap', 'layers']) assert.ok(!f.aiPending.includes(k), k);
  assert.deepEqual(checkAnalysis({ colors: ['red', 'multicolor'] }).colors, ['multicolor']);
  assert.deepEqual(checkAnalysis(null).path, { category: null, subcategory: null, type: null });
});

test('Übernehmen: nur leere Felder, alles Übernommene ist markiert', () => {
  const a = checkAnalysis({ category: 'top/shirt/long_sleeve_shirt', name: 'Oxford-Hemd', colors: ['white'], collar: 'button_down', styles: ['classic'] });
  const start = setField(emptyEditForm({ ownerId: 'max' }), 'colors', ['light_grey']);
  const f = applyAnalysis({ ...start, aiPending: [] }, a);
  assert.equal(f.category, 'top');
  assert.equal(f.type, 'long_sleeve_shirt');
  assert.equal(f.name, 'Oxford-Hemd');
  assert.deepEqual(f.colors, ['light_grey']); // schon gewählt → bleibt
  assert.equal(f.collar, 'button_down');
  assert.deepEqual([...f.aiPending].sort(), ['category', 'collar', 'name', 'styles']);
});

test('Übernehmen: unbestätigter Foto-Vorschlag wird von der KI ersetzt', () => {
  const a = checkAnalysis({ category: 'shoe/sneaker', colors: ['pink', 'white'] });
  const start = { ...setField(emptyEditForm({ ownerId: 'max' }), 'colors', ['white']), aiPending: ['colors'] };
  const f = applyAnalysis(start, a);
  assert.deepEqual(f.colors, ['pink', 'white']);
  assert.ok(f.aiPending.includes('colors'));
});
