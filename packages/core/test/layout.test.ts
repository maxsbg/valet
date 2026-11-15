import { test } from 'node:test';
import assert from 'node:assert/strict';
import { balanceRows, greedyRows, splitRows } from '../src/layout';
import { formatPrice, equalSplit, splitGap } from '../src/money';

test('Umbruch: passt alles in eine Zeile, bleibt es eine', () => {
  assert.deepEqual(balanceRows([60, 60, 60], 300, 8), [3]);
});
test('Umbruch: 5 → 3 + 2 statt 4 + 1', () => {
  const w = [70, 70, 70, 70, 70];
  assert.deepEqual(greedyRows(w, 310, 8), [4, 1]);
  assert.deepEqual(balanceRows(w, 310, 8), [3, 2]);
});
test('Umbruch: 6 → 3 + 3', () => {
  assert.deepEqual(balanceRows([70, 70, 70, 70, 70, 70], 310, 8), [3, 3]);
});
test('Umbruch: passt die gleiche Verteilung nicht, normaler Umbruch', () => {
  // erste Zeile mit 2 breiten Kapseln + 1 schmal passt nicht → greedy
  const w = [150, 150, 40, 40, 40];
  assert.deepEqual(greedyRows(w, 310, 8), [2, 3]);
  assert.deepEqual(balanceRows(w, 310, 8), [2, 3]);
  assert.deepEqual(splitRows(['a', 'b', 'c', 'd', 'e'], [3, 2]), [['a', 'b', 'c'], ['d', 'e']]);
});

test('Preise: unter 100 € mit Cent, ab 100 € ganze Euro mit Tausenderpunkt', () => {
  assert.equal(formatPrice(8.43), '8,43 €');
  assert.equal(formatPrice(59), '59,00 €');
  assert.equal(formatPrice(99.99), '99,99 €');
  assert.equal(formatPrice(143), '143 €');
  assert.equal(formatPrice(4643), '4.643 €');
  assert.equal(formatPrice(null), '–');
});

test('Aufteilung: gleiche Anteile auf Cent, Summenprüfung', () => {
  assert.deepEqual(equalSplit(59, 2), [29.5, 29.5]);
  assert.deepEqual(equalSplit(10, 3), [3.34, 3.33, 3.33]);
  assert.equal(splitGap(59, [35, 24]), 0);
  assert.equal(splitGap(59, [35, 20]), 4);
  assert.equal(splitGap(59, [35, 30]), -6);
});
