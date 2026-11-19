import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLORS, colorHex, colorFamily, tapMainColor, tapNuance, rankInk, migrateSeasons, MATERIALS, PATTERNS, CLOSURES, sizeSystemOf, hasCollarSize,
  careList, confirmCare, careFromLabel, careLabel, nearestColor, type ColorPick,
} from '../src/attributes';
import { keysOf } from '../src/keys';

const empty: ColorPick = { colors: [], open: null, full: false };

test('Farben: Hauptfarben mit Nuancen, Hex nachschlagbar', () => {
  assert.equal(COLORS.length, 23);
  assert.equal(colorHex('olive'), '#6b7a3c');
  assert.equal(colorFamily('olive'), 'green');
  assert.equal(colorFamily('black'), 'black');
  assert.equal(colorHex('Unbekannt'), null);
});

test('Farben: Hauptfarbe tippen → gewählt und aufgeklappt', () => {
  const p = tapMainColor(empty, 'green');
  assert.deepEqual(p, { colors: ['green'], open: 'green', full: false });
  // ohne Nuancen: nicht aufgeklappt
  assert.deepEqual(tapMainColor(empty, 'black'), { colors: ['black'], open: null, full: false });
});

test('Farben: Nuance ersetzt Hauptfarbe auf demselben Rang; erneut → zurück', () => {
  let p = tapMainColor(empty, 'black');
  p = tapMainColor(p, 'green');
  p = tapNuance(p, 'olive');
  assert.deepEqual(p.colors, ['black', 'olive']);
  assert.deepEqual(tapNuance(p, 'olive').colors, ['black', 'green']);
  // Hauptfarbe tippen, während Nuance gewählt → zurück zur Hauptfarbe
  assert.deepEqual(tapMainColor(p, 'green').colors, ['black', 'green']);
});

test('Farben: Hauptfarbe nochmal → abgewählt', () => {
  let p = tapMainColor(empty, 'green');
  p = tapMainColor(p, 'green');
  assert.deepEqual(p, { colors: [], open: null, full: false });
  // gewählt, aber zugeklappt: erster Tipp klappt nur auf
  const q = { colors: ['green'], open: null, full: false };
  assert.deepEqual(tapMainColor(q, 'green'), { colors: ['green'], open: 'green', full: false });
});

test('Farben: höchstens 3, die vierte meldet „voll“', () => {
  let p = empty;
  for (const c of ['black', 'white', 'red']) p = tapMainColor(p, c);
  const q = tapMainColor(p, 'blue');
  assert.equal(q.full, true);
  assert.deepEqual(q.colors, ['black', 'white', 'red']);
  // Abwählen geht weiter
  assert.deepEqual(tapMainColor(q, 'white').colors, ['black', 'red']);
});

test('Rang-Ziffer: dunkel auf hellen, weiß auf dunklen Farben', () => {
  assert.equal(rankInk('#ffffff'), '#2a1a1d');
  assert.equal(rankInk('#efe6d2'), '#2a1a1d');
  assert.equal(rankInk('#1c1c1c'), '#ffffff');
  assert.equal(rankInk('#3567b0'), '#ffffff');
});

test('Saison: Übergang → Frühling + Herbst, Reihenfolge fest', () => {
  assert.deepEqual(migrateSeasons(['winter', 'Übergang']), ['spring', 'autumn', 'winter']);
  assert.deepEqual(migrateSeasons(['summer']), ['summer']);
  assert.deepEqual(migrateSeasons(null), []);
});

test('Listen: Flanell, Lammfell, Zopfmuster, Rippstrick ergänzt', () => {
  assert.ok(keysOf(MATERIALS).includes('flannel') && keysOf(MATERIALS).includes('shearling'));
  assert.ok(keysOf(PATTERNS).includes('cable_knit') && keysOf(PATTERNS).includes('rib_knit'));
});

test('Verschluss: Schnalle ergänzt (vor „ohne“)', () => {
  assert.deepEqual(keysOf(CLOSURES), ['buttons', 'zipper', 'snaps', 'laces', 'velcro', 'buckle', 'none']);
});

test('Größe: System erkennen, Kragenweite nur bei Hemd', () => {
  assert.equal(sizeSystemOf('M'), 'letters');
  assert.equal(sizeSystemOf('50'), 'numbers');
  assert.equal(sizeSystemOf('W30/L32'), null);
  assert.equal(sizeSystemOf('One Size'), null);
  assert.ok(hasCollarSize('shirt'));
  assert.ok(!hasCollarSize('blouse'));
});

test('Pflege: Reihenfolge, Bestätigen, Etikett ersetzt Schätzung', () => {
  const care = { iron: { v: 'iron2', src: 'geschaetzt' as const }, wash: { v: 'w30', src: 'geschaetzt' as const } };
  assert.deepEqual(careList(care).map((c) => c.group), ['wash', 'iron']);
  assert.equal(confirmCare(care, 'wash').wash!.src, 'hand');
  assert.deepEqual(careFromLabel({ wash: 'w40' }), { wash: { v: 'w40', src: 'etikett' } });
  assert.equal(careLabel('iron', 'iron2'), 'Bügeln: 2 Punkte');
});

test('Farbvorschlag aus dem Foto: nächstliegende Palettenfarbe', () => {
  assert.equal(nearestColor('#1a1a1a'), 'black');
  assert.equal(nearestColor('#f4f4f6'), 'white');
  assert.equal(nearestColor('#1f2f50'), 'navy');
  assert.equal(nearestColor('#6b7a3d'), 'olive');
  assert.equal(nearestColor(null), null);
});
