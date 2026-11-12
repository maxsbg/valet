import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, qtyOf, totalPaid, convert } from '../src/money';

test('parseAmount liest deutsche Schreibweise', () => {
  assert.equal(parseAmount('1.234,56 €'), 1234.56);
  assert.equal(parseAmount('54,9'), 54.9);
  assert.equal(parseAmount('49.90'), 49.9);
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('abc'), null);
});

test('Menge ist mindestens 1', () => {
  assert.equal(qtyOf({ qty: 0 }), 1);
  assert.equal(qtyOf({ qty: null }), 1);
  assert.equal(qtyOf({ qty: 2 }), 2);
});

test('Gesamtpreis = Stückpreis × Menge', () => {
  assert.equal(totalPaid({ pricePaid: 24.98, qty: 2 }), 49.96);
  assert.equal(totalPaid({ pricePaid: null, qty: 3 }), 0);
});

test('Umrechnung GBP→EUR wie im Bestand (587,95 × 1,18)', () => {
  assert.equal(convert(587.95, 1.18), 693.78);
});
