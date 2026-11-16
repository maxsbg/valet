import { test } from 'node:test';
import assert from 'node:assert/strict';
import { READ_INFO_SCHEMA, checkInfo, applyInfo, readInfoPrompt } from '../src/ai/readInfo';
import { emptyEditForm, setField } from '../src/edit';

test('Schema: alle Felder Pflicht, Kategorie darf fehlen', () => {
  assert.deepEqual(READ_INFO_SCHEMA.required, Object.keys(READ_INFO_SCHEMA.properties!));
  assert.ok((READ_INFO_SCHEMA.properties!.kategorie!.enum as unknown[]).includes(null));
  assert.ok(readInfoPrompt('label').includes('Etikett'));
});

test('Prüfung: Etikett mit Prozent und Pflege', () => {
  const i = checkInfo({ kategorie: null, materialAnteile: [{ name: 'Baumwolle', prozent: 98 }, { name: 'Elasthan', prozent: 2 }, { name: 'Glitzer', prozent: 5 }],
    pflege: { wash: 'w30', bleach: 'nobleach', dry: 'kaputt', iron: null, pro: null }, preis: 'teuer', kaufdatum: '2026-13-45', groesse: ' M ' });
  assert.deepEqual(i.item.materials, [{ name: 'Baumwolle', pct: 98 }, { name: 'Elasthan', pct: 2 }]);
  assert.deepEqual(i.care, { wash: { v: 'w30', src: 'etikett' }, bleach: { v: 'nobleach', src: 'etikett' } });
  assert.equal(i.price, null);
  assert.equal(i.purchaseDate, null);
  assert.equal(i.size, 'M');
  assert.equal(i.item.path.category, null);
});

test('Übernehmen: Bestellung in Kauf, Wunschteil-Preis als Listenpreis', () => {
  const i = checkInfo({ shop: 'Zalando', preis: 59.95, listenpreis: 79.99, kaufdatum: '2026-11-10', artikelnummer: 'AB-12' });
  const f = applyInfo(setField(emptyEditForm({ ownerId: 'max' }), 'shop', 'COS'), i);
  assert.equal(f.shop, 'COS'); // schon eingetragen → bleibt
  assert.equal(f.price, '59,95');
  assert.equal(f.listPrice, '79,99');
  assert.equal(f.purchaseDate, '2026-11-10');
  assert.ok(['price', 'listPrice', 'purchaseDate', 'articleNo'].every((k) => f.aiPending.includes(k)));
  const w = applyInfo(emptyEditForm({ ownerId: 'max', wish: { wishlistId: null } }), i);
  assert.equal(w.listPrice, '59,95');
  assert.equal(w.price, '');
  assert.equal(w.purchaseDate, null);
});
