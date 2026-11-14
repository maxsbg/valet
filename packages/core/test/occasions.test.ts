import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OCCASIONS, normalizeOccasions, occasionSlots } from '../src/occasions';

test('feste Liste: 13 Anlässe, Café statt Kaffee', () => {
  assert.equal(OCCASIONS.length, 13);
  assert.ok(OCCASIONS.some((o) => o.label === 'Café'));
});

test('alte Anlässe werden umbenannt, Unbekanntes fällt weg', () => {
  assert.deepEqual(normalizeOccasions(['Uni', 'Arbeit', 'Eigener', 'Campus']), ['Campus', 'Büro']);
  assert.deepEqual(normalizeOccasions(null), []);
});

test('Plaketten: eins, zwei, ab drei „+N“', () => {
  assert.deepEqual(occasionSlots([]), []);
  assert.deepEqual(occasionSlots(['Date']), [{ icon: 'occDate', label: 'Date' }]);
  assert.deepEqual(occasionSlots(['Campus', 'Büro']), [{ icon: 'occCampus', label: 'Campus' }, { icon: 'occBuero', label: 'Büro' }]);
  assert.deepEqual(occasionSlots(['Büro', 'Campus', 'Alltag', 'Café']), [{ icon: 'occBuero', label: 'Büro' }, { more: 3 }]);
});
