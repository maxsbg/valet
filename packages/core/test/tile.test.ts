import { test } from 'node:test';
import assert from 'node:assert/strict';
import { glowFor, ownersFor, countLabel, topRightFor, isAway, tileA11yLabel } from '../src/tile';

// ---------- Innenschein: Beispiele aus Spec 3 / Referenz (Farben aus der Referenz-HTML) ----------
const glow = (main: string | null, hl: string | null = null) => glowFor(main, hl).css;

test('Innenschein: farbige Teile → Hauptfarbe 52 %', () => {
  assert.equal(glow('#2a5bb2'), 'rgba(42,91,178,0.52)');   // blaues Tanktop
  assert.equal(glow('#b8a269'), 'rgba(184,162,105,0.52)'); // Asics gelb/silber
  assert.equal(glow('#462b1f'), 'rgba(70,43,31,0.52)');    // braune Loafer
});

test('Innenschein: neutral mit Highlight → Highlight 52 %', () => {
  assert.equal(glow('#bbb4ab', '#3e3c53'), 'rgba(62,60,83,0.52)'); // Cap creme mit Navy
});

test('Innenschein: neutral ohne Highlight → Hauptfarbe 28 %', () => {
  assert.equal(glow('#1a191e'), 'rgba(26,25,30,0.28)');    // schwarze Hose
  assert.equal(glow('#a2a2a2'), 'rgba(162,162,162,0.28)'); // silberne Tasche
  assert.equal(glow('#61605b'), 'rgba(97,96,91,0.28)');    // silberner Sneaker
  assert.equal(glow('#b6ab9c'), 'rgba(182,171,156,0.28)'); // beige Jacke
});

test('Innenschein: neutral und sehr hell (v > 0,85) → #d8d2c8 28 %', () => {
  assert.equal(glow('#e0e2e4'), 'rgba(216,210,200,0.28)'); // weißes Shirt
});

test('Innenschein: ohne (gültige) Hauptfarbe → #d8d2c8 28 %, Highlight allein zählt nicht', () => {
  assert.equal(glow(null), 'rgba(216,210,200,0.28)');
  assert.equal(glow(''), 'rgba(216,210,200,0.28)');
  assert.equal(glow('kein-hex'), 'rgba(216,210,200,0.28)');
  assert.equal(glow(null, '#3e3c53'), 'rgba(216,210,200,0.28)');
});

test('Innenschein: farbig ignoriert Highlight; dunkel (v < 0,20) gilt als neutral', () => {
  assert.equal(glow('#2a5bb2', '#ff0000'), 'rgba(42,91,178,0.52)');
  assert.equal(glow('#30000a', '#3e3c53'), 'rgba(62,60,83,0.52)'); // sehr dunkles Rot: v ≈ 0,19
});

// ---------- Besitzer: alle Zeilen aus Spec 5.4 ----------
const M = 'max', P = 'paul', L = 'lea', J = 'jo';
const show = (owners: string[], me: string) =>
  ownersFor(owners, me).map((o) => ('more' in o ? `+${o.more}` : o.person));

test('Besitzer aus Sicht von Max', () => {
  assert.deepEqual(show([M], M), [M]);                  // nur ich
  assert.deepEqual(show([M, P], M), [P, M]);            // ich + 1, M oben
  assert.deepEqual(show([P, M], M), [P, M]);            // Reihenfolge der Daten egal
  assert.deepEqual(show([M, P, L], M), ['+2', M]);      // ich + 2
  assert.deepEqual(show([P, L, M, J], M), ['+3', M]);   // ich + 3
  assert.deepEqual(show([P], M), [P]);                  // nur eine andere Person
  assert.deepEqual(show([P, L], M), [L, P]);            // ohne mich, 2: erste Person in der Ecke
  assert.deepEqual(show([P, L, J], M), ['+2', P]);      // ohne mich, 3+: N = Rest
  assert.deepEqual(show([], M), []);                    // niemand
});

test('Besitzer aus Sicht von Paul: P liegt oben', () => {
  assert.deepEqual(show([P], P), [P]);
  assert.deepEqual(show([M, P], P), [M, P]);
  assert.deepEqual(show([M, P, L], P), ['+2', P]);
  assert.deepEqual(show([M], P), [M]);
  assert.deepEqual(show([M, L], P), [L, M]);
  assert.deepEqual(show([M, L, J], P), ['+2', M]);
  assert.deepEqual(show([], P), []);
});

test('Besitzer: „+12“, doppelte Einträge, ohne angemeldete Person', () => {
  const twelve = Array.from({ length: 12 }, (_, i) => `p${i}`);
  assert.deepEqual(show([M, ...twelve], M), ['+12', M]);
  assert.deepEqual(show([M, M, P], M), [P, M]);
  assert.deepEqual(ownersFor([P, L], null).map((o) => ('person' in o ? o.person : o.more)), [L, P]);
  assert.deepEqual(ownersFor(null, M), []);
});

// ---------- Anzahl ----------
test('Anzahl-Format: 2×, 12×, 99×, ab 100 99+, unter 2 keine Plakette', () => {
  assert.deepEqual(countLabel(2), { num: '2', sym: '×' });
  assert.deepEqual(countLabel(12), { num: '12', sym: '×' });
  assert.deepEqual(countLabel(99), { num: '99', sym: '×' });
  assert.deepEqual(countLabel(100), { num: '99', sym: '+' });
  assert.deepEqual(countLabel(120), { num: '99', sym: '+' });
  assert.equal(countLabel(1), null);
  assert.equal(countLabel(0), null);
  assert.equal(countLabel(null), null);
});

test('Oben rechts: Kreis allein, Kapsel unter Wendbar', () => {
  assert.equal(topRightFor(false, 1), null);
  assert.deepEqual(topRightFor(true, 1), { reversible: true, count: null });
  assert.equal(topRightFor(false, 2)?.count?.shape, 'circle');
  assert.equal(topRightFor(false, 12)?.count?.shape, 'circle');
  assert.equal(topRightFor(true, 2)?.count?.shape, 'capsule');
  assert.equal(topRightFor(true, 12)?.count?.shape, 'capsule');
  assert.equal(topRightFor(true, 2)?.reversible, true);
});

// ---------- Status ----------
test('Abblenden: alle Status außer Wäsche', () => {
  assert.equal(isAway('wash'), false);
  for (const s of ['repair', 'lent', 'out', 'sold'] as const) assert.equal(isAway(s), true);
  assert.equal(isAway(null), false);
});

test('Kachel-Label in Worten', () => {
  assert.equal(
    tileA11yLabel({ name: 'Cap', status: 'wash', reversible: true, qty: 3, today: { name: 'Paul' }, owners: [{ more: 2 }, { name: 'Max' }] }),
    'Cap, Wäsche, Wendbar, 3 Stück, heute: Paul, 2 weitere, Max',
  );
  assert.equal(tileA11yLabel({ name: 'Hose', qty: 1 }), 'Hose');
  assert.equal(tileA11yLabel({ name: 'Hose', today: {} }), 'Hose, heute getragen');
});
