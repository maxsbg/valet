import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ownersFor, countLabel, topRightFor, isAway, tileA11yLabel } from '../src/tile';

// ---------- Besitzer: alle Zeilen aus Spec 5.4 ----------
const M = 'max', P = 'paul', L = 'lea', J = 'jo';
const show = (owners: string[], me: string) =>
  ownersFor(owners, me).map((o) => ('more' in o ? `+${o.more}` : o.person));

test('Besitzer aus Sicht von Max', () => {
  assert.deepEqual(show([M], M), []);                   // nur ich: keine Plakette
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
  assert.deepEqual(show([P], P), []);
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
  assert.deepEqual(show([M], P), [M]);                  // fremdes Teil bleibt sichtbar
  assert.deepEqual(ownersFor([M], null).map((o) => ('person' in o ? o.person : o.more)), [M]); // ohne Anmeldung
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
  assert.deepEqual(topRightFor(true, 1), { reversible: true, back: false, set: false, count: null });
  assert.equal(topRightFor(false, 2)?.count?.shape, 'circle');
  assert.equal(topRightFor(false, 12)?.count?.shape, 'circle');
  assert.equal(topRightFor(true, 2)?.count?.shape, 'capsule');
  assert.equal(topRightFor(true, 12)?.count?.shape, 'capsule');
  assert.equal(topRightFor(true, 2)?.reversible, true);
});

test('Oben rechts: Set links neben Wendbar, Anzahl als Kapsel darunter', () => {
  assert.deepEqual(topRightFor(false, 1, true), { reversible: false, back: false, set: true, count: null });
  assert.deepEqual(topRightFor(true, 1, true), { reversible: true, back: false, set: true, count: null });
  assert.equal(topRightFor(false, 2, true)?.count?.shape, 'capsule');
  assert.equal(topRightFor(true, 3, true)?.count?.shape, 'capsule');
  assert.equal(topRightFor(false, 2, false)?.count?.shape, 'circle');
});

test('Oben rechts: Rückseite am Platz von Wendbar, nie beides', () => {
  assert.deepEqual(topRightFor(false, 1, false, true), { reversible: false, back: true, set: false, count: null });
  assert.equal(topRightFor(true, 1, false, true)?.back, false);
  assert.equal(topRightFor(false, 2, false, true)?.count?.shape, 'capsule');
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

// ---------- Wunschliste ----------
import { wishWait, priceLabel, WISH_WAIT } from '../src/tile';
const on = { ...WISH_WAIT, enabled: true };
const at = (s: string) => new Date(s);

test('Bedenkzeit: vorerst ausgeschaltet → keine Plakette', () => {
  assert.equal(WISH_WAIT.enabled, false);
  assert.equal(wishWait('2026-11-14T10:00:00', at('2026-11-14T12:00:00')), null);
});

test('Bedenkzeit: Resttage, Fortschritt, Warnung', () => {
  assert.deepEqual(wishWait('2026-11-14T10:00:00', at('2026-11-14T23:00:00'), on), { left: 14, progress: 1, warn: false });
  assert.deepEqual(wishWait('2026-11-14T10:00:00', at('2026-11-21T08:00:00'), on), { left: 7, progress: 0.5, warn: false });
  assert.equal(wishWait('2026-11-14T10:00:00', at('2026-11-25T08:00:00'), on)!.warn, true); // 3 Tage
  assert.equal(wishWait('2026-11-14T10:00:00', at('2026-11-24T08:00:00'), on)!.warn, false); // 4 Tage
});

test('Bedenkzeit: vorbei oder ohne Datum → Plakette verschwindet', () => {
  assert.equal(wishWait('2026-11-14T10:00:00', at('2026-11-28T08:00:00'), on), null);
  assert.equal(wishWait('2026-01-01', at('2026-11-28T08:00:00'), on), null);
  assert.equal(wishWait(null, at('2026-11-28T08:00:00'), on), null);
  assert.equal(wishWait('kein Datum', at('2026-11-28T08:00:00'), on), null);
});

test('Preis: ganze Euro mit Tausenderpunkt', () => {
  assert.equal(priceLabel(9), '9');
  assert.equal(priceLabel(89.5), '90');
  assert.equal(priceLabel(249), '249');
  assert.equal(priceLabel(1249.99), '1.250');
  assert.equal(priceLabel(null), null);
  assert.equal(priceLabel(0), null);
});
