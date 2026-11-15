import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buyDayLabel, buyDayHint, buyDayQuick, priceTrend, wishFacts, wishOwners, buyDefaults, buyError, deDate } from '../src/wish';

test('Datum und Kauftag', () => {
  assert.equal(deDate('2026-09-02T10:00:00+00'), '02.09.2026');
  assert.equal(buyDayLabel('2026-11-21'), 'Sa 21.11.2026');
  assert.equal(buyDayHint('2026-11-15', '2026-11-15'), 'heute');
  assert.equal(buyDayHint('2026-11-16', '2026-11-15'), 'morgen');
  assert.equal(buyDayHint('2026-11-21', '2026-11-15'), 'in 6 Tagen');
  assert.equal(buyDayHint('2026-11-12', '2026-11-15'), 'vor 3 Tagen');
});

test('Schnellwahl Kauftag: Samstag ist der nächste, am Samstag eine Woche später', () => {
  // 15.11.2026 ist ein Sonntag
  assert.deepEqual(buyDayQuick('2026-11-15').map((q) => q.day), ['2026-11-15', '2026-11-16', '2026-11-21', '2026-11-22']);
  assert.equal(buyDayQuick('2026-11-21')[2]!.day, '2026-11-28');
  assert.equal(buyDayQuick('2026-11-30')[1]!.day, '2026-12-01');
});

test('Preisänderung seit dem Merken', () => {
  assert.deepEqual(priceTrend(100, 79), { pct: 21, down: true });
  assert.deepEqual(priceTrend(79, 89), { pct: 13, down: false });
  assert.equal(priceTrend(79, 79), null);
  assert.equal(priceTrend(null, 79), null);
  assert.equal(priceTrend(1000, 999), null);
});

test('Kauf-Angaben: leere fehlen, Reihenfolge wie Spec 5', () => {
  const f = wishFacts({ list_price: 79, wish_price: 79, shop: 'COS', article_no: null, created_at: '2026-09-02T08:00:00Z', buy_on: '2026-11-21' });
  assert.deepEqual(f.map(([k]) => k), ['Shop', 'Gemerkt am', 'Kauftag geplant', 'Preis beim Merken']);
  assert.equal(f[2]![1], 'Sa 21.11.2026');
  assert.equal(f[3]![1], '79,00 €');
});

test('Besitzer und Vorbelegung „Gekauft“', () => {
  assert.deepEqual(wishOwners(['a'], 'b'), ['a']);
  assert.deepEqual(wishOwners([], 'b'), ['b']);
  assert.deepEqual(buyDefaults({ ownerIds: [], listOwner: null, me: 'me', price: 79, today: '2026-11-15' }), { price: 79, date: '2026-11-15', owners: ['me'] });
  assert.deepEqual(buyDefaults({ ownerIds: null, listOwner: 'paul', me: 'me', price: null, today: '2026-11-15' }).owners, ['paul']);
});

test('„Gekauft“ prüfen', () => {
  const ok = { price: '79,00', priceValue: 79, date: '2026-11-15', owners: ['me'] };
  assert.equal(buyError(ok, '2026-11-15'), null);
  assert.equal(buyError({ ...ok, price: '', priceValue: null }, '2026-11-15'), null);
  assert.match(buyError({ ...ok, price: 'abc', priceValue: null }, '2026-11-15')!, /keine Zahl/);
  assert.match(buyError({ ...ok, date: '2026-11-16' }, '2026-11-15')!, /Zukunft/);
  assert.match(buyError({ ...ok, date: null }, '2026-11-15')!, /Kaufdatum/);
  assert.match(buyError({ ...ok, owners: [] }, '2026-11-15')!, /gehört/);
});
