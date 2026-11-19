import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEY_LISTS, label, toKey, type KeyList } from '../src/keys';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORY_TREE, CATEGORY_LIST, pathToKeys, categoryLast } from '../src/categories';
import {
  COLORS, COLOR_LIST, MATERIALS, PATTERNS, STYLES, SEASONS, COLLAR_LIST, COLLARS, CLOSURES, migrateSeasons, toColorKeys, toMaterialParts, toStyleKeys,
  colorLabel, materialLabel, patternLabel, styleLabel, seasonLabel, collarLabel, closureLabel,
} from '../src/attributes';
import { NECKLINES, OUTER_COLLARS, STRAPS, strapLabel } from '../src/fields';
import { OCCASIONS, occasionLabel, normalizeOccasions } from '../src/occasions';
import { GLOW_COLOR_RANK, GLOW_NEUTRAL_RANK } from '../src/glow';

test('toKey akzeptiert Schlüssel, Label und Altwert und verwirft Unbekanntes', () => {
  const list: KeyList = [{ key: 'navy', label: 'Marineblau' }];
  assert.equal(toKey(list, 'navy'), 'navy');
  assert.equal(toKey(list, 'Marineblau'), 'navy');
  assert.equal(toKey(list, 'marine', { marine: 'navy' }), 'navy');
  assert.equal(toKey(list, 'unbekannt'), null);
  assert.equal(toKey(list, null), null);
  assert.equal(label(list, 'navy'), 'Marineblau');
});

test('Zuordnungsdatei enthält Listen aus Einträgen mit Schlüssel und Label', () => {
  const lists = KEY_LISTS as unknown as Record<string, unknown>;
  for (const [name, values] of Object.entries(lists)) {
    if (name === 'categories') continue;
    assert.ok(Array.isArray(values), `${name} ist eine Liste`);
    for (const value of values as { key?: unknown; label?: unknown }[]) {
      assert.equal(typeof value.key, 'string', `${name} hat key`);
      assert.equal(typeof value.label, 'string', `${name} hat label`);
    }
  }
});

// ---------- Listen im Code = docs/keys/key-zuordnung.json (gleiche Keys, Labels, Reihenfolge) ----------

const here = path.dirname(fileURLToPath(import.meta.url));
const json = JSON.parse(fs.readFileSync(path.join(here, '../../../docs/keys/key-zuordnung.json'), 'utf8')) as Record<string, unknown>;
const pairs = (list: readonly { key: string; label: string }[]) => list.map(({ key, label }) => ({ key, label }));

test('Kategorie-Baum im Code = JSON (Kategorie → Unterkategorie → Typ)', () => {
  const tree = CATEGORY_TREE.map((c) => ({ key: c.key, label: c.label, subs: c.subs.map((s) => ({ key: s.key, label: s.label, types: pairs(s.types) })) }));
  assert.deepEqual(tree, json.categories);
  assert.deepEqual(pairs(CATEGORY_LIST), (json.categories as { key: string; label: string }[]).map(({ key, label }) => ({ key, label })));
});

test('Flache Listen im Code = JSON', () => {
  // Farben: Hauptfarbe, dann ihre Nuancen (Reihenfolge der Palette)
  const palette = COLORS.flatMap((c) => [{ key: c.key, label: c.label }, ...pairs(c.nuances)]);
  assert.deepEqual(palette, json.colors);
  assert.deepEqual(pairs(COLOR_LIST), json.colors);
  assert.deepEqual(pairs(MATERIALS), json.materials);
  assert.deepEqual(pairs(PATTERNS), json.patterns);
  assert.deepEqual(pairs(STYLES), json.styles);
  assert.deepEqual(pairs(SEASONS), json.seasons);
  assert.deepEqual(pairs(CLOSURES), json.closures);
  assert.deepEqual(pairs(STRAPS), json.straps);
  assert.deepEqual(pairs(OCCASIONS), json.occasions);
  // Kragen = COLLARS + NECKLINES + OUTER_COLLARS (ohne Doppelte), alle aus der Liste
  assert.deepEqual(pairs(COLLAR_LIST), json.collars);
  const union = [...new Set([...COLLARS, ...NECKLINES, ...OUTER_COLLARS].map((c) => c.key))].sort();
  assert.deepEqual(union, (json.collars as { key: string }[]).map((c) => c.key).sort());
});

test('Keys sind englisch (klein, Unterstrich), Schein-Ranglisten nutzen nur Farb-Keys', () => {
  const lists = Object.entries(json).filter(([k]) => k !== 'categories') as [string, { key: string }[]][];
  for (const [name, list] of lists) for (const e of list) assert.match(e.key, /^[a-z][a-z0-9_]*$/, `${name}: ${e.key}`);
  const colorKeys = new Set(COLOR_LIST.map((c) => c.key));
  for (const k of [...GLOW_COLOR_RANK, ...GLOW_NEUTRAL_RANK]) assert.ok(colorKeys.has(k), k);
});

test('Labels je Liste', () => {
  assert.equal(colorLabel('navy'), 'Marineblau');
  assert.equal(materialLabel('cotton'), 'Baumwolle');
  assert.equal(patternLabel('solid'), 'Unifarben');
  assert.equal(styleLabel('business_casual'), 'Business Casual');
  assert.equal(seasonLabel('winter'), 'Winter');
  assert.equal(collarLabel('hood'), 'Kapuze');
  assert.equal(closureLabel('none'), 'ohne');
  assert.equal(strapLabel('chain'), 'Kette');
  assert.equal(occasionLabel('everyday'), 'Alltag');
  assert.equal(categoryLast({ category: 'accessory', subcategory: 'other' }), 'Sonstiges');
  assert.equal(label(MATERIALS, null), '');
});

test('toKey: Key, Label, Altwert und Unbekanntes in allen Listen', () => {
  assert.equal(toKey(PATTERNS, 'solid'), 'solid');
  assert.equal(toKey(PATTERNS, 'Unifarben'), 'solid');
  assert.equal(toKey(PATTERNS, 'unifarben'), null);
  assert.equal(toKey(CLOSURES, undefined), null);
  assert.deepEqual(toColorKeys(['Marineblau', 'navy', 'schwarz', 'Glitzer']), ['navy', 'black']);
  assert.deepEqual(toStyleKeys(['Casual', 'Lässig', 'street', 'Quatsch']), ['casual', 'street']);
  assert.deepEqual(toMaterialParts([{ name: 'Baumwolle', pct: 98 }, { name: 'elastane', pct: 2 }, { name: 'Glitzer' }]), [{ name: 'cotton', pct: 98 }, { name: 'elastane', pct: 2 }]);
  assert.deepEqual(migrateSeasons(['Winter', 'spring', 'Unsinn']), ['spring', 'winter']);
  assert.deepEqual(normalizeOccasions(['Alltag', 'office', 'Uni', 'Kino']), ['everyday', 'office', 'campus']);
  assert.deepEqual(pathToKeys({ category: 'Schuh', subcategory: 'Stiefel', type: 'Chelsea Boot' }), { category: 'shoe', subcategory: 'boot', type: 'chelsea_boot' });
  assert.deepEqual(pathToKeys({ category: 'shoe', subcategory: 'boot', type: 'Unbekannt' }), { category: 'shoe', subcategory: 'boot', type: null });
  assert.deepEqual(pathToKeys({ category: 'Fantasie' }), { category: null, subcategory: null, type: null });
});
