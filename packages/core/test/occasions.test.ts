import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OCCASIONS, normalizeOccasions, occasionSlots } from '../src/occasions';

test('feste Liste: 13 Anlässe, Café statt Kaffee', () => {
  assert.equal(OCCASIONS.length, 13);
  assert.ok(OCCASIONS.some((o) => o.label === 'Café' && o.key === 'cafe'));
});

test('alte Anlässe werden umbenannt, Unbekanntes fällt weg', () => {
  assert.deepEqual(normalizeOccasions(['Uni', 'Arbeit', 'Eigener', 'campus']), ['campus', 'office']);
  // deutsche Labels (vor Migration 0014) werden ebenfalls zu Keys
  assert.deepEqual(normalizeOccasions(['Büro', 'Abend/Ausgehen', 'party']), ['office', 'party']);
  assert.deepEqual(normalizeOccasions(null), []);
});

test('Plaketten: eins, zwei, ab drei „+N“', () => {
  assert.deepEqual(occasionSlots([]), []);
  assert.deepEqual(occasionSlots(['date']), [{ icon: 'occDate', label: 'Date' }]);
  assert.deepEqual(occasionSlots(['campus', 'office']), [{ icon: 'occCampus', label: 'Campus' }, { icon: 'occBuero', label: 'Büro' }]);
  assert.deepEqual(occasionSlots(['office', 'campus', 'everyday', 'cafe']), [{ icon: 'occBuero', label: 'Büro' }, { more: 3 }]);
});
