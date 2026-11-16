import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANALYZE_ITEM_SCHEMA, CATEGORY_PATHS, checkAnalysis, applyAnalysis, parsePath } from '../src/ai/analyzeItem';
import { emptyEditForm, setField } from '../src/edit';

test('Schema: Pfade eindeutig, Pflichtfelder vorhanden', () => {
  assert.equal(new Set(CATEGORY_PATHS).size, CATEGORY_PATHS.length);
  assert.ok(CATEGORY_PATHS.includes('Oberteil › Hemd › Langarmhemd'));
  for (const k of ANALYZE_ITEM_SCHEMA.required!) assert.ok(ANALYZE_ITEM_SCHEMA.properties![k]);
});

test('Pfad: gültig übernommen, ungültig verworfen', () => {
  assert.deepEqual(parsePath('Oberteil › Hemd › Langarmhemd'), { category: 'Oberteil', subcategory: 'Hemd', type: 'Langarmhemd' });
  assert.deepEqual(parsePath('Oberteil › Jeans'), { category: null, subcategory: null, type: null });
  assert.deepEqual(parsePath(42), { category: null, subcategory: null, type: null });
});

test('Prüfung: Unsinn fliegt raus, unpassende Felder bleiben leer', () => {
  const a = checkAnalysis({
    kategorie: 'Hose › Jeans', name: ' Straight Jeans ', farben: ['Blau', 'Lila-Glitzer', 'Blau'], muster: 'Unifarben',
    material: ['Denim', 'Elasthan'], kragen: 'Button-down', weite: 2, laenge: 9, bund: 1, lagen: [0], waerme: 2, traeger: 'Kette',
  });
  assert.deepEqual(a.path, { category: 'Hose', subcategory: 'Jeans', type: null });
  assert.equal(a.name, 'Straight Jeans');
  assert.deepEqual(a.colors, ['Blau']);
  assert.deepEqual(a.materials, [{ name: 'Denim' }, { name: 'Elasthan' }]);
  assert.equal(a.collar, null); // Hose hat keinen Kragen
  assert.equal(a.strap, null);
  assert.deepEqual(a.fit, { width: 2, length: null, rise: 1 });
  assert.deepEqual(a.layers, []);
  assert.equal(a.warmth, 2);
  assert.deepEqual(checkAnalysis({ farben: ['Rot', 'Bunt'] }).colors, ['Bunt']);
  assert.deepEqual(checkAnalysis(null).path, { category: null, subcategory: null, type: null });
});

test('Übernehmen: nur leere Felder, alles Übernommene ist markiert', () => {
  const a = checkAnalysis({ kategorie: 'Oberteil › Hemd › Langarmhemd', name: 'Oxford-Hemd', farben: ['Weiß'], kragen: 'Button-down', stil: ['Klassisch'] });
  const start = setField(emptyEditForm({ ownerId: 'max' }), 'colors', ['Hellgrau']);
  const f = applyAnalysis({ ...start, aiPending: [] }, a);
  assert.equal(f.category, 'Oberteil');
  assert.equal(f.type, 'Langarmhemd');
  assert.equal(f.name, 'Oxford-Hemd');
  assert.deepEqual(f.colors, ['Hellgrau']); // schon gewählt → bleibt
  assert.equal(f.collar, 'Button-down');
  assert.deepEqual([...f.aiPending].sort(), ['category', 'collar', 'name', 'styles']);
});

test('Übernehmen: unbestätigter Foto-Vorschlag wird von der KI ersetzt', () => {
  const a = checkAnalysis({ kategorie: 'Schuh › Sneaker', farben: ['Pink', 'Weiß'] });
  const start = { ...setField(emptyEditForm({ ownerId: 'max' }), 'colors', ['Weiß']), aiPending: ['colors'] };
  const f = applyAnalysis(start, a);
  assert.deepEqual(f.colors, ['Pink', 'Weiß']);
  assert.ok(f.aiPending.includes('colors'));
});
