import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sharesOf, spendStats, wearStats, closetStats, type StatItem } from '../src/stats';

const base: StatItem = { id: 'x', ownerId: 'max', category: 'hose', brand: 'Nike', qty: 1, pricePaid: 100, listPrice: 150, payers: null, purchaseDate: '2025-03-01', status: null, soldPrice: null, isWish: false, createdAt: '2025-03-01T10:00:00Z' };
const item = (p: Partial<StatItem>): StatItem => ({ ...base, ...p });

test('Anteile: ohne Zahler zahlt der Besitzer, sonst gleich oder nach Betrag', () => {
  assert.deepEqual(sharesOf(item({})), { max: 100 });
  assert.deepEqual(sharesOf(item({ payers: [{ personId: 'max', amount: null }, { personId: 'paul', amount: null }] })), { max: 50, paul: 50 });
  assert.deepEqual(sharesOf(item({ payers: [{ personId: 'max', amount: 70 }, { personId: 'paul', amount: 30 }] })), { max: 70, paul: 30 });
});

test('Ausgaben: Anteil je Person, gespart, Marken zusammengefasst', () => {
  const items = [
    item({ id: 'a' }),
    item({ id: 'b', brand: 'NIKE ', ownerId: 'paul', payers: [{ personId: 'max', amount: null }, { personId: 'paul', amount: null }] }),
    item({ id: 'c', isWish: true, pricePaid: 500 }),
  ];
  const all = spendStats(items, null, ['max', 'paul']);
  assert.equal(all.total, 200);
  assert.equal(all.saved, 100);
  assert.equal(all.brands.length, 1);
  assert.deepEqual(all.byPerson, [{ key: 'max', value: 150 }, { key: 'paul', value: 50 }]);
  const max = spendStats(items, 'max', ['max', 'paul']);
  assert.equal(max.total, 150);
});

test('Getragen: Kosten pro Tragen und Outfit-Planungen zählen mit', () => {
  const items = [item({ id: 'a' }), item({ id: 'b', pricePaid: 20 })];
  const r = wearStats(items, null, { a: ['2026-11-01', '2026-11-02'] }, [{ id: 'o', ownerId: null, itemIds: ['a', 'b'], occasions: [], plans: [{ id: 'p', date: '2026-11-03', personId: null }, { id: 'q', date: '2026-12-24', personId: null }] }], '2026-11-13');
  assert.equal(r.total, 4);
  assert.equal(r.favorites[0]!.item.id, 'a');
  assert.equal(r.best[0]!.item.id, 'b');
  assert.equal(r.best[0]!.cpw, 20);
});

test('Getragen: Zeitraum, Nutzung, Outfits, Kombinationen, Saison', () => {
  const items = [
    item({ id: 'a', category: 'hose' }), item({ id: 'b', category: 'oberteil', pricePaid: 20 }),
    item({ id: 'c', category: 'jacke', seasons: ['Sommer'] }), item({ id: 'd', category: 'hose', status: 'stored' }),
  ];
  const o = { id: 'o', ownerId: null, itemIds: ['a', 'b'], occasions: [], plans: [{ id: 'p', date: '2026-11-10', personId: null }, { id: 'q', date: '2026-11-12', personId: null }] };
  const r = wearStats(items, null, { a: ['2026-01-05'] }, [o], '2026-11-13', '30');
  assert.equal(r.total, 4); // a und b je 2× im Zeitraum (Januar zählt nicht)
  assert.equal(r.start, '2026-01-05');
  assert.deepEqual([r.usage.worn, r.usage.total], [2, 3]); // eingelagert zählt nicht mit
  assert.equal(r.outfits[0]!.n, 2);
  assert.equal(r.pairs[0]!.n, 2);
  assert.equal(r.days['2026-11-10'], 2);
  assert.equal(r.season, 'Winter');
  assert.ok(!r.idle.some((x) => x.item.id === 'c')); // Sommerteil im Winter nicht anmahnen
  assert.equal(wearStats(items, null, { a: ['2026-01-05'] }, [o], '2026-11-13', 'all').favorites[0]!.w.length, 3);
});

test('Bestand: aussortierte Teile zählen nicht in Kategorien', () => {
  const r = closetStats([item({ id: 'a', qty: 2 }), item({ id: 'b', status: 'out' }), item({ id: 'c', isWish: true })], null);
  assert.equal(r.pieces, 3);
  assert.deepEqual(r.categories, [{ key: 'hose', value: 2 }]);
  assert.equal(r.wishes, 1);
});

test('Geschenke: zählen nicht als „ohne Preis“, eigene Anzahl', () => {
  const r = spendStats([item({ id: 'g', pricePaid: null, isGift: true }), item({ id: 'x', pricePaid: null })], null);
  assert.equal(r.missing, 1);
  assert.equal(r.gifts, 1);
});
