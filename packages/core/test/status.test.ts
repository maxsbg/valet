import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATUS_LIST, statusChange, statusCard, statusError, shortDate, lentDue, statusKey, statusDb, type StatusInfo } from '../src/status';

const TODAY = '2026-11-15';
const none: StatusInfo = { status: null, status_at: null, status_where: null, status_until: null, lent_person_id: null, lent_to: null, sold_price: null, sold_date: null };

test('Sieben Status, Reihenfolge und „…“ nur bei Zusatzangaben', () => {
  assert.deepEqual(STATUS_LIST.map((s) => s.label), ['Im Schrank', 'Wäsche', 'Reparatur', 'Verliehen', 'Eingelagert', 'Aussortiert', 'Verkauft']);
  assert.deepEqual(STATUS_LIST.filter((s) => s.details).map((s) => s.key), ['repair', 'lent', 'stored', 'sold']);
  assert.equal(statusKey(null), 'closet');
  assert.equal(statusDb('closet'), null);
});

test('Änderung: Im Schrank leert alles', () => {
  assert.deepEqual(statusChange('closet', { status_where: 'Keller', sold_price: 5 }, TODAY), none);
});

test('Änderung: Verliehen an Person oder freien Namen, Seit = heute als Vorgabe', () => {
  const a = statusChange('lent', { lent_person_id: 'p1', lent_to: 'Lisa', status_until: '2026-11-20' }, TODAY);
  assert.deepEqual([a.status, a.status_at, a.lent_person_id, a.lent_to, a.status_until], ['lent', TODAY, 'p1', null, '2026-11-20']);
  const b = statusChange('lent', { lent_to: '  Lisa ' }, TODAY);
  assert.equal(b.lent_to, 'Lisa');
});

test('Änderung: Verkauft mit Erlös, Datum, Ort; fremde Angaben werden geleert', () => {
  const s = statusChange('sold', { sold_price: 30, status_where: 'Vinted', status_until: '2026-12-01' }, TODAY);
  assert.deepEqual([s.sold_price, s.sold_date, s.status_where, s.status_until], [30, TODAY, 'Vinted', null]);
  assert.equal(statusChange('wash', { status_where: 'Keller' }, TODAY).status_where, null);
});

test('Prüfung', () => {
  assert.equal(statusError('lent', { status_at: '2026-11-10', status_until: '2026-11-01' }), '„Zurück bis“ liegt vor „Seit“.');
  assert.equal(statusError('lent', { status_at: '2026-11-10', status_until: '2026-11-20' }), null);
});

test('Datum kurz: im laufenden Jahr ohne Jahreszahl', () => {
  assert.equal(shortDate('2026-10-12', TODAY), '12.10.');
  assert.equal(shortDate('2025-03-01', TODAY), '1.3.2025');
});

test('Karte: im Schrank keine Karte', () => {
  assert.equal(statusCard(none, TODAY), null);
});

test('Karte: Verliehen an Paul, seit, zurück bis, Schnellaktion „Zurück“', () => {
  const c = statusCard({ ...none, status: 'lent', status_at: '2026-11-03', status_until: '2026-11-20', lent_person_id: 'p' }, TODAY, () => 'Paul')!;
  assert.equal(c.title, 'Verliehen an Paul');
  assert.deepEqual(c.details, ['seit 3.11.', 'zurück bis 20.11.']);
  assert.equal(c.warn, null);
  assert.deepEqual(c.action, { label: 'Zurück', to: 'closet' });
});

test('Karte: Rückgabe fällig → Hinweis', () => {
  const lent = { ...none, status: 'lent' as const, status_at: '2026-11-01' };
  assert.equal(statusCard({ ...lent, status_until: TODAY }, TODAY)!.warn, 'Rückgabe heute fällig');
  assert.equal(statusCard({ ...lent, status_until: '2026-11-14' }, TODAY)!.warn, 'Rückgabe seit gestern fällig');
  assert.equal(statusCard({ ...lent, status_until: '2026-11-10' }, TODAY)!.warn, 'Rückgabe seit 5 Tagen fällig');
  assert.ok(lentDue({ status: 'lent', status_until: TODAY }, TODAY));
  assert.ok(!lentDue({ status: 'lent', status_until: '2026-11-16' }, TODAY));
});

test('Karte: weitere Status', () => {
  assert.deepEqual(statusCard({ ...none, status: 'repair', status_at: '2026-11-10', status_where: 'Änderungsschneiderei' }, TODAY)!.details, ['seit 10.11.', 'bei Änderungsschneiderei']);
  assert.equal(statusCard({ ...none, status: 'stored', status_where: 'Keller' }, TODAY)!.title, 'Eingelagert · Keller');
  assert.deepEqual(statusCard({ ...none, status: 'out' }, TODAY)!.action, { label: 'Verkauft', to: 'sheet:sold' });
  const sold = statusCard({ ...none, status: 'sold', sold_price: 30, sold_date: '2026-11-02', status_where: 'Vinted' }, TODAY)!;
  assert.equal(sold.title, 'Verkauft für 30,00 €');
  assert.deepEqual(sold.details, ['am 2.11.', 'Vinted']);
  assert.deepEqual(sold.action, { label: 'Doch nicht', to: 'out' });
});
