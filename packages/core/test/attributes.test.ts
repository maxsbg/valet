import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLORS, colorHex, colorFamily, tapMainColor, tapNuance, rankInk, migrateSeasons, MATERIALS, PATTERNS, CLOSURES, sizeSystemOf, hasCollarSize,
  careList, confirmCare, careFromLabel, careLabel, nearestColor, type ColorPick,
} from '../src/attributes';

const empty: ColorPick = { colors: [], open: null, full: false };

test('Farben: Hauptfarben mit Nuancen, Hex nachschlagbar', () => {
  assert.equal(COLORS.length, 21);
  assert.equal(colorHex('Olivgrün'), '#6b7a3c');
  assert.equal(colorFamily('Olivgrün'), 'Grün');
  assert.equal(colorFamily('Schwarz'), 'Schwarz');
  assert.equal(colorHex('Unbekannt'), null);
});

test('Farben: Hauptfarbe tippen → gewählt und aufgeklappt', () => {
  const p = tapMainColor(empty, 'Grün');
  assert.deepEqual(p, { colors: ['Grün'], open: 'Grün', full: false });
  // ohne Nuancen: nicht aufgeklappt
  assert.deepEqual(tapMainColor(empty, 'Schwarz'), { colors: ['Schwarz'], open: null, full: false });
});

test('Farben: Nuance ersetzt Hauptfarbe auf demselben Rang; erneut → zurück', () => {
  let p = tapMainColor(empty, 'Schwarz');
  p = tapMainColor(p, 'Grün');
  p = tapNuance(p, 'Olivgrün');
  assert.deepEqual(p.colors, ['Schwarz', 'Olivgrün']);
  assert.deepEqual(tapNuance(p, 'Olivgrün').colors, ['Schwarz', 'Grün']);
  // Hauptfarbe tippen, während Nuance gewählt → zurück zur Hauptfarbe
  assert.deepEqual(tapMainColor(p, 'Grün').colors, ['Schwarz', 'Grün']);
});

test('Farben: Hauptfarbe nochmal → abgewählt', () => {
  let p = tapMainColor(empty, 'Grün');
  p = tapMainColor(p, 'Grün');
  assert.deepEqual(p, { colors: [], open: null, full: false });
  // gewählt, aber zugeklappt: erster Tipp klappt nur auf
  const q = { colors: ['Grün'], open: null, full: false };
  assert.deepEqual(tapMainColor(q, 'Grün'), { colors: ['Grün'], open: 'Grün', full: false });
});

test('Farben: höchstens 3, die vierte meldet „voll“', () => {
  let p = empty;
  for (const c of ['Schwarz', 'Weiß', 'Rot']) p = tapMainColor(p, c);
  const q = tapMainColor(p, 'Blau');
  assert.equal(q.full, true);
  assert.deepEqual(q.colors, ['Schwarz', 'Weiß', 'Rot']);
  // Abwählen geht weiter
  assert.deepEqual(tapMainColor(q, 'Weiß').colors, ['Schwarz', 'Rot']);
});

test('Rang-Ziffer: dunkel auf hellen, weiß auf dunklen Farben', () => {
  assert.equal(rankInk('#ffffff'), '#2a1a1d');
  assert.equal(rankInk('#efe6d2'), '#2a1a1d');
  assert.equal(rankInk('#1c1c1c'), '#ffffff');
  assert.equal(rankInk('#3567b0'), '#ffffff');
});

test('Saison: Übergang → Frühling + Herbst, Reihenfolge fest', () => {
  assert.deepEqual(migrateSeasons(['Winter', 'Übergang']), ['Frühling', 'Herbst', 'Winter']);
  assert.deepEqual(migrateSeasons(['Sommer']), ['Sommer']);
  assert.deepEqual(migrateSeasons(null), []);
});

test('Listen: Flanell, Lammfell, Zopfmuster, Rippstrick ergänzt', () => {
  assert.ok(MATERIALS.includes('Flanell') && MATERIALS.includes('Lammfell'));
  assert.ok(PATTERNS.includes('Zopfmuster') && PATTERNS.includes('Rippstrick'));
});

test('Verschluss: Schnalle ergänzt (vor „ohne“)', () => {
  assert.deepEqual(CLOSURES, ['Knöpfe', 'Reißverschluss', 'Druckknöpfe', 'Schnürung', 'Klett', 'Schnalle', 'ohne']);
});

test('Größe: System erkennen, Kragenweite nur bei Hemd', () => {
  assert.equal(sizeSystemOf('M'), 'letters');
  assert.equal(sizeSystemOf('50'), 'numbers');
  assert.equal(sizeSystemOf('W30/L32'), null);
  assert.equal(sizeSystemOf('One Size'), null);
  assert.ok(hasCollarSize('Hemd'));
  assert.ok(!hasCollarSize('Bluse'));
});

test('Pflege: Reihenfolge, Bestätigen, Etikett ersetzt Schätzung', () => {
  const care = { iron: { v: 'iron2', src: 'geschaetzt' as const }, wash: { v: 'w30', src: 'geschaetzt' as const } };
  assert.deepEqual(careList(care).map((c) => c.group), ['wash', 'iron']);
  assert.equal(confirmCare(care, 'wash').wash!.src, 'hand');
  assert.deepEqual(careFromLabel({ wash: 'w40' }), { wash: { v: 'w40', src: 'etikett' } });
  assert.equal(careLabel('iron', 'iron2'), 'Bügeln: 2 Punkte');
});

test('Farbvorschlag aus dem Foto: nächstliegende Palettenfarbe', () => {
  assert.equal(nearestColor('#1a1a1a'), 'Schwarz');
  assert.equal(nearestColor('#f4f4f6'), 'Weiß');
  assert.equal(nearestColor('#1f2f50'), 'Marineblau');
  assert.equal(nearestColor('#6b7a3d'), 'Olivgrün');
  assert.equal(nearestColor(null), null);
});
