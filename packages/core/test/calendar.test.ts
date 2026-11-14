import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthGrid, monthTitle, shiftMonth } from '../src/calendar';

test('November 2026: beginnt am Sonntag → 6 Montags-Füller, 6 Wochen', () => {
  const g = monthGrid(2026, 10);
  assert.equal(g.length, 6);
  assert.deepEqual(g[0]!.map((d) => d.date), ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
  assert.equal(g[0]![6]!.inMonth, true);
  assert.equal(g[0]![5]!.inMonth, false);
  assert.equal(g[4]![0]!.date, '2026-11-23');
  assert.deepEqual(g[5]!.map((d) => d.inMonth), [true, false, false, false, false, false, false]); // 30.11. ist ein Montag
});

test('Februar 2027 beginnt am Montag und hat genau 4 Wochen', () => {
  const g = monthGrid(2027, 1);
  assert.equal(g.length, 4);
  assert.equal(g[0]![0]!.date, '2027-02-01');
  assert.equal(g[3]![6]!.date, '2027-02-28');
  assert.ok(g.flat().every((d) => d.inMonth));
});

test('Schaltjahr: Februar 2028 hat 29 Tage', () => {
  assert.equal(monthGrid(2028, 1).flat().filter((d) => d.inMonth).length, 29);
});

test('Monate verschieben über Jahresgrenzen, Titel auf Deutsch', () => {
  assert.deepEqual(shiftMonth('2026-11-14', 0), { year: 2026, month: 10 });
  assert.deepEqual(shiftMonth('2026-11-14', 2), { year: 2027, month: 0 });
  assert.deepEqual(shiftMonth('2026-01-31', -1), { year: 2025, month: 11 });
  assert.deepEqual(shiftMonth('2026-11-14', -23), { year: 2024, month: 11 });
  assert.equal(monthTitle(2026, 2), 'März 2026');
});
