import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toEditForm, emptyEditForm, setField, confirmAi, toggleMaterial, materialRank, pickSizeSystem, isCustomSize, pickFit, togglePayer,
  splitView, qtyHint, editChange, totalOf, type EditForm,
} from '../src/edit';

const base = (p: Partial<EditForm> = {}): EditForm => ({ ...emptyEditForm({ ownerId: 'max' }), name: 'Hemd', ...p });

test('Laden: Zahler fehlen → Besitzer; eigene Beträge erkannt', () => {
  const f = toEditForm({ name: 'X', owner_ids: ['max', 'paul'], price_paid: 59, payers: null });
  assert.deepEqual(f.payers, ['max', 'paul']);
  assert.equal(f.splitMode, 'equal');
  assert.equal(f.price, '59,00');
  const g = toEditForm({ name: 'X', price_paid: 59, payers: [{ person_id: 'max', amount: 35 }, { person_id: 'paul', amount: 24 }] });
  assert.equal(g.splitMode, 'custom');
  assert.deepEqual(g.amounts, { max: '35,00', paul: '24,00' });
});

test('KI-Markierung verschwindet beim Ändern oder Bestätigen', () => {
  let f = base({ aiPending: ['colors', 'care.wash', 'name'] });
  f = setField(f, 'care', {});
  assert.deepEqual(f.aiPending, ['colors', 'name']);
  assert.deepEqual(confirmAi(f, 'colors').aiPending, ['name']);
});

test('Material: Rang nach Reihenfolge, abwählen rückt nach', () => {
  let m = toggleMaterial([], 'Flanell');
  m = toggleMaterial(m, 'Baumwolle');
  assert.equal(materialRank(m, 'Baumwolle'), 2);
  m = toggleMaterial(m, 'Flanell');
  assert.equal(materialRank(m, 'Baumwolle'), 1);
});

test('Größe: Systemwechsel setzt die Größe zurück, One Size bleibt; eigene Angabe erkannt', () => {
  const f = base({ sizeSystem: 'letters', size: 'M' });
  assert.deepEqual([pickSizeSystem(f, 'numbers').sizeSystem, pickSizeSystem(f, 'numbers').size], ['numbers', null]);
  assert.equal(pickSizeSystem(base({ sizeSystem: 'letters', size: 'One Size' }), 'numbers').size, 'One Size');
  assert.ok(isCustomSize({ size: 'W30/L32' }));
  assert.ok(!isCustomSize({ size: '50' }));
});

test('Passform: Strich antippen setzt, erneut hebt auf', () => {
  let f = pickFit(base(), 'width', 3);
  assert.equal(f.fit.width, 3);
  f = pickFit(f, 'width', 3);
  assert.equal(f.fit.width, null);
});

test('Zahler: mindestens einer bleibt', () => {
  const f = base({ payers: ['max'] });
  assert.deepEqual(togglePayer(f, 'max').payers, ['max']);
  assert.deepEqual(togglePayer(f, 'paul').payers, ['max', 'paul']);
});

test('Aufteilung gleich: halbe-halbe vom Gesamtbetrag (Preis × Anzahl)', () => {
  const v = splitView(base({ price: '59,00', payers: ['max', 'paul'] }))!;
  assert.deepEqual(v.rows.map((r) => [r.amount, r.pct]), [[29.5, 50], [29.5, 50]]);
  assert.equal(v.warn, false);
  assert.equal(totalOf({ price: '24,98', qty: 2 }), 49.96);
});

test('Aufteilung eigene Beträge: Summenprüfung', () => {
  const f = base({ price: '59,00', payers: ['max', 'paul'], splitMode: 'custom', amounts: { max: '35', paul: '24' } });
  assert.equal(splitView(f)!.hint, 'Summe passt: 59,00 €.');
  const g = { ...f, amounts: { max: '35', paul: '20' } };
  assert.equal(splitView(g)!.hint, 'Es fehlen noch 4,00 €.');
  assert.ok(splitView(g)!.warn);
  assert.equal(splitView(base({ payers: ['max'] })), null);
});

test('Anzahl-Hinweis: Preis gilt je Stück', () => {
  assert.equal(qtyHint({ price: '12,49', qty: 1 }), null);
  assert.match(qtyHint({ price: '12,49', qty: 2 })!, /je Stück, zusammen 24,98 €.*„2ד/);
});

test('Speichern: Pflicht Name, Kategorie-Pfad gültig, Zahlen geprüft', () => {
  assert.deepEqual(editChange(base({ name: ' ' })), { error: 'Bitte einen Namen eingeben.' });
  assert.deepEqual(editChange(base({ category: 'Oberteil', subcategory: 'Jeans' })), { error: 'Kategorie ist unvollständig.' });
  assert.deepEqual(editChange(base({ price: 'abc' })), { error: 'Bezahlt ist keine gültige Zahl.' });
});

test('Speichern: Spiegel, Passform nur passend zur Kategorie, Farben B nur bei Wendbar', () => {
  const r = editChange(base({
    category: 'Schuh', subcategory: 'Sneaker', colors: ['Weiß', 'Schwarz'], colorsB: ['Rot'], materials: [{ name: 'Leder' }],
    styles: ['Street'], fit: { width: 2, length: 2, rise: 1 }, price: '120', qty: 2,
  }));
  assert.ok('change' in r);
  const c = r.change;
  assert.equal(c.color, 'Weiß/Schwarz');
  assert.equal(c.material, 'Leder');
  assert.equal(c.style, 'Street');
  assert.deepEqual([c.fit_width, c.fit_length, c.fit_rise], [null, null, null]);
  assert.deepEqual(c.colors_b, []);
  assert.equal(c.price_paid, 120);
  assert.equal(c.qty, 2);
  const h = editChange(base({ category: 'Hose', fit: { width: 3, length: 2, rise: 2 } }));
  assert.ok('change' in h && h.change.fit_rise === 2);
});

test('Speichern: Geschenk ohne Preis und Zahler', () => {
  const r = editChange(base({ gift: true, giftFrom: 'Oma', giftValue: '79', price: '59', payers: ['max', 'paul'] }));
  assert.ok('change' in r);
  assert.deepEqual([r.change.is_gift, r.change.gift_from, r.change.gift_value, r.change.price_paid, r.change.payers], [true, 'Oma', 79, null, null]);
});

test('Speichern: Aufteilung – unstimmige Summe blockiert, sonst Beträge', () => {
  const f = base({ price: '59', payers: ['max', 'paul'], splitMode: 'custom', amounts: { max: '35', paul: '20' } });
  assert.deepEqual(editChange(f), { error: 'Aufteilung: Es fehlen noch 4,00 €.' });
  const ok = editChange({ ...f, amounts: { max: '35', paul: '24' } });
  assert.ok('change' in ok);
  assert.deepEqual(ok.change.payers, [{ person_id: 'max', amount: 35 }, { person_id: 'paul', amount: 24 }]);
  const eq = editChange({ ...f, splitMode: 'equal' });
  assert.ok('change' in eq);
  assert.deepEqual(eq.change.payers, [{ person_id: 'max', amount: null }, { person_id: 'paul', amount: null }]);
});

test('Speichern: Wunschteil – Preis = Listenpreis, beim Anlegen „Preis beim Merken“', () => {
  const f = { ...emptyEditForm({ wish: { wishlistId: 'L1' } }), name: 'Mantel', listPrice: '249', wishTag: 'grail' as const, buyOn: '2026-12-01' };
  const r = editChange(f, { isNew: true });
  assert.ok('change' in r);
  assert.deepEqual([r.change.is_wish, r.change.list_price, r.change.wish_price, r.change.wishlist_id, r.change.wish_tag, r.change.buy_on],
    [true, 249, 249, 'L1', 'grail', '2026-12-01']);
  assert.equal('price_paid' in r.change, false);
  assert.equal('owner_ids' in r.change, false);
});
