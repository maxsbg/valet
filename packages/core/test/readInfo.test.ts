import { test } from 'node:test';
import assert from 'node:assert/strict';
import { READ_INFO_SCHEMA, checkInfo, applyInfo, infoHint, infoUsable, pagePriceInEuro, readInfoPrompt, readPagePrompt } from '../src/ai/readInfo';
import { emptyEditForm, setField } from '../src/edit';
import { CATEGORY_PATHS } from '../src/ai/analyzeItem';

test('Schema: alle Felder Pflicht, Kategorie darf fehlen', () => {
  assert.deepEqual(READ_INFO_SCHEMA.required, Object.keys(READ_INFO_SCHEMA.properties!));
  assert.ok((READ_INFO_SCHEMA.properties!.category!.enum as unknown[]).includes(null));
  assert.ok(readInfoPrompt('label').includes('Etikett'));
});

test('Prüfung: Etikett mit Prozent und Pflege', () => {
  const i = checkInfo({ category: null, material_parts: [{ name: 'cotton', pct: 98 }, { name: 'elastane', pct: 2 }, { name: 'Glitzer', pct: 5 }],
    care: { wash: 'w30', bleach: 'nobleach', dry: 'kaputt', iron: null, pro: null }, price: 'teuer', purchase_date: '2026-13-45', size: ' M ' });
  assert.deepEqual(i.item.materials, [{ name: 'cotton', pct: 98 }, { name: 'elastane', pct: 2 }]);
  assert.deepEqual(i.care, { wash: { v: 'w30', src: 'etikett' }, bleach: { v: 'nobleach', src: 'etikett' } });
  assert.equal(i.price, null);
  assert.equal(i.purchaseDate, null);
  assert.equal(i.size, 'M');
  assert.equal(i.item.path.category, null);
});

test('Übernehmen: Bestellung in Kauf, Wunschteil-Preis als Listenpreis', () => {
  const i = checkInfo({ shop: 'Zalando', price: 59.95, list_price: 79.99, purchase_date: '2026-11-10', article_no: 'AB-12' });
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

test('Übernehmen: Größe nur aus der festen Liste der Größen-Art', () => {
  const at = (path: string, size: string) => applyInfo(emptyEditForm({ ownerId: 'max' }), checkInfo({ category: path, size }));
  const schuh = CATEGORY_PATHS.find((p) => p.startsWith('shoe'))!;
  const jeans = CATEGORY_PATHS.find((p) => p.startsWith('pants/jeans'))!;
  const shirt = CATEGORY_PATHS.find((p) => p.startsWith('top'))!;
  assert.deepEqual([at(schuh, 'EU 42 1/2').size, at(schuh, 'EU 42 1/2').sizeSystem], ['42,5', 'eu']);
  assert.deepEqual([at(jeans, '32/34').size, at(jeans, '32/34').sizeSystem], ['W32/L34', 'wl']);
  assert.equal(at(shirt, 'xl').size, 'XL');
  assert.equal(at(shirt, '2XL').size, 'XXL');
  assert.ok(at(shirt, 'xl').aiPending.includes('size'));
  assert.equal(at(shirt, 'Größe M (fällt klein aus)').size, null); // kein freier Text
  assert.equal(applyInfo(emptyEditForm({ ownerId: 'max' }), checkInfo({ size: 'm' })).size, 'M'); // ohne Kategorie: Kleidergrößen
});

test('Leitsatz: alle Feldnamen der KI-Schemas sind englisch', () => {
  const names = (s: { properties?: Record<string, unknown> }): string[] =>
    Object.entries(s.properties ?? {}).flatMap(([k, v]) => [k, ...names(v as { properties?: Record<string, unknown>; items?: { properties?: Record<string, unknown> } }), ...names((v as { items?: { properties?: Record<string, unknown> } }).items ?? {})]);
  const all = names(READ_INFO_SCHEMA);
  for (const n of ['brand', 'price', 'list_price', 'purchase_date', 'size', 'article_no', 'material_parts', 'pct', 'care', 'category', 'colors']) assert.ok(all.includes(n), n);
  for (const n of ['marke', 'preis', 'listenpreis', 'kaufdatum', 'groesse', 'artikelnummer', 'materialAnteile', 'prozent', 'pflege']) assert.ok(!all.includes(n), n);
});

test('READ_INFO_SCHEMA: ablesen statt schätzen – ohne Profil, Konfidenz, Stil, Lagen, Wetter; Name darf fehlen', () => {
  const p = READ_INFO_SCHEMA.properties!;
  for (const k of ['profile', 'confidence', 'styles', 'layers', 'warmth', 'rain']) assert.ok(!(k in p), k);
  assert.deepEqual(p.name!.type, ['string', 'null']);
  assert.match(p.colors!.description!, /^Nur die genannte Farbangabe/);
  assert.match(p.colors!.description!, /navy = /);
  assert.ok(JSON.stringify(READ_INFO_SCHEMA).length < 28000);
});

test('checkInfo: kein Profil aus Infos, nur echte Kalendertage', () => {
  const i = checkInfo({ kind: 'shop', profile: { sheen_min: 3 }, styles: ['casual'], purchase_date: '2026-02-30' });
  assert.deepEqual(i.item.styles, []);
  assert.equal(i.item.profile.sheen, null);
  assert.equal(i.purchaseDate, null);
  assert.equal(checkInfo({ purchase_date: '2024-02-29' }).purchaseDate, '2024-02-29');
});

test('Leere Info erkennen, Seiten-Prompt bleibt unter der Grenze der Edge Function', () => {
  assert.equal(infoUsable(checkInfo({})), false);
  assert.equal(infoUsable(checkInfo({ size: 'M' })), true);
  const big = 'x'.repeat(5000);
  const p = readPagePrompt({ name: big, brand: big, price: 1, currency: big, sku: big, color: big, material: big, description: big, shop: big });
  assert.ok(p.length < 4000, String(p.length));
});

test('Etikett ohne übernehmbare Angaben gilt als leer; Einheitsgröße wird erkannt', () => {
  assert.equal(infoUsable(checkInfo({ kind: 'label', category: 'top/shirt', colors: ['red'] })), false);
  assert.equal(infoUsable(checkInfo({ kind: 'shop', category: 'top/shirt' })), true);
  assert.equal(infoUsable(checkInfo({ category: 'top/shirt' }), 'label'), false);
  assert.equal(checkInfo({ size: 'Einheitsgröße' }).size, 'One Size');
  assert.equal(checkInfo({ size: 'W32 / L34 (Regular)' }).size, 'W32 / L34 (Regular)');
});

test('Bestellung mit mehreren Artikeln: Hinweis auf das gesuchte Teil im Prompt; Preise nur in Euro', () => {
  assert.match(readInfoPrompt('order', infoHint({ name: 'Oxford-Hemd', brand: 'COS', colors: ['white'] })), /Gesucht ist dieses Teil: Oxford-Hemd · COS · Weiß/);
  assert.match(readInfoPrompt(null), /den ersten bzw\. den hervorgehobenen/);
  const i = checkInfo({ price: 59, list_price: 79 });
  assert.equal(pagePriceInEuro(i, { currency: 'USD' }).price, null);
  assert.equal(pagePriceInEuro(i, { currency: 'EUR' }).price, 59);
  assert.equal(pagePriceInEuro(i, {}).price, 59);
});
