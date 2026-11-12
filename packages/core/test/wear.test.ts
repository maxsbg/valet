import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wearDates, costPerWear, daysSince } from '../src/wear';
import type { Outfit } from '../src/model';

const outfits: Outfit[] = [
  { id: 'o1', ownerId: null, itemIds: ['hose', 'shirt'], occasions: [], plans: [
    { id: 'p1', date: '2026-11-05', personId: null },
    { id: 'p2', date: '2026-11-20', personId: null }, // Zukunft: zählt nicht
  ] },
];

test('getragen = Einträge + vergangene Outfit-Planungen, ohne Doppelte', () => {
  const wears = { hose: ['2026-11-01', '2026-11-05'] };
  assert.deepEqual(wearDates('hose', wears, outfits, '2026-11-12'), ['2026-11-01', '2026-11-05']);
  assert.deepEqual(wearDates('shirt', {}, outfits, '2026-11-12'), ['2026-11-05']);
});

test('Kosten pro Tragen', () => {
  const wears = { hose: ['2026-11-01'] };
  assert.equal(costPerWear({ id: 'hose', pricePaid: 90, qty: 1 }, wears, outfits, '2026-11-12'), 45);
  assert.equal(costPerWear({ id: 'neu', pricePaid: 90, qty: 1 }, {}, outfits, '2026-11-12'), null);
});

test('Tage seit', () => {
  assert.equal(daysSince('2026-11-01', '2026-11-12'), 11);
});
