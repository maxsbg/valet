import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertLegacy, type LegacyExport } from '../src/import/legacy';

// Kleiner Ausschnitt im Format des echten Exports (gekürzt)
const src: LegacyExport = {
  people: [
    { id: 'pMax', data: { name: 'Max', color: 'Rosa', order: ['iHose', 'geloescht', 'iShirt'], prefs: { caps: 'oft' }, washAsk: '2026-11-09' } },
    { id: 'pPaul', data: { name: 'Paul', color: 'Rot' } },
  ],
  wishlists: [{ id: 'w1', data: { name: 'acessories', ownerId: 'pMax' } }],
  items: [
    { id: 'iHose', data: {
      name: "'DERA' SELVEDGE DENIM PANTS", category: 'hose', color: 'Denim', ownerId: 'pMax', pricePaid: 90, qty: 1,
      purchaseDate: '2026-05-19', imageId: 'blobHose', hexes: [{ h: '#191c23', s: 0.99 }], wears: ['2026-11-06', '2026-11-06'],
      reservations: [{ id: 'oinoobqut', from: '2026-11-11', to: '2026-11-11', outfitId: 'o1', personId: 'pMax' }],
      vdesc: 'Weite Hose', trimV5: true, tile: 'auto',
    } },
    { id: 'iShirt', data: {
      name: 'Hoodie', category: 'pullover', ownerId: 'pMax', reversible: true, mainSide: 'a', imageId: 'blobA', altImageId: 'blobB',
      status: 'wash', statusAt: '2026-11-07', payers: [{ id: 'pMax', amount: null }, { id: 'pPaul', amount: null }],
      dupOf: 'gibtsnicht', origCurrency: 'GBP', origPaid: 68, fxRate: 1.16, fxEstimated: true, pricePaid: 78.88,
    } },
    { id: 'iWunsch', data: { name: 'k', category: 'oberteil', ownerId: null, wish: true, listId: 'w1', imageId: 'blobK' } },
  ],
  outfits: [{ id: 'o1', data: {
    itemIds: ['iHose', 'iShirt', 'weg'], occasions: ['Uni'], occAuto: false, ownerId: null,
    layout: { iHose: { x: 0.48, y: 0.63, z: 108 } },
    plans: [{ id: 'inoobqut', date: '2026-11-11', personId: 'pMax', createdAt: 1794346142891 }],
  } }],
  daily: [
    { id: '2026-11-12_all', data: { itemIds: ['iHose'], dir: 'Farbkombination Wada #296', wada: 296, src: 'all' } },
    { id: '2026-11-09_pMax', data: { itemIds: ['iShirt'], reason: 'Test' } },
  ],
  cutoutFeedback: [{ id: 'c1', data: { itemId: 'iShirt', model: 'rmbg14-q8-1', gpu: true, note: 'hängt am Ärmel', side: 'a' } }],
};

let n = 0;
const ids = () => `id${++n}`;
const r = convertLegacy(src, 'W', ids);

test('alle Datensätze werden übernommen', () => {
  assert.equal(r.persons.length, 2);
  assert.equal(r.wishlists.length, 1);
  assert.equal(r.items.length, 3);
  assert.equal(r.outfits.length, 1);
  assert.equal(r.dailySuggestions.length, 2);
  assert.equal(r.cutoutFeedback.length, 1);
});

const item = (legacy: string) => r.items.find((i) => i.legacy_id === legacy)!;
const person = (legacy: string) => r.persons.find((p) => p.legacy_id === legacy)!;

test('Verweise werden auf neue IDs übersetzt', () => {
  assert.equal(item('iHose').owner_id, person('pMax').id);
  assert.equal(item('iWunsch').owner_id, null);
  assert.equal(item('iWunsch').wishlist_id, r.wishlists[0]!.id);
  assert.deepEqual(item('iShirt').payers, [
    { person_id: person('pMax').id, amount: null },
    { person_id: person('pPaul').id, amount: null },
  ]);
});

test('Reihenfolge ohne gelöschte Teile', () => {
  assert.deepEqual(person('pMax').item_order, [item('iHose').id, item('iShirt').id]);
  assert.ok(r.warnings.some((w) => w.includes('gelöschte Teile')));
});

test('Bilder je Seite inkl. Farben', () => {
  const shirtImgs = r.itemImages.filter((i) => i.item_id === item('iShirt').id);
  assert.deepEqual(shirtImgs.map((i) => i.side), ['a', 'b']);
  assert.equal(r.imageJobs.length, 4);
  assert.deepEqual(r.itemImages.find((i) => i.legacy_id === 'blobHose')!.colors, [{ h: '#191c23', s: 0.99 }]);
});

test('Getragen ohne Doppelte, interne Merker fallen weg, Analyse bleibt', () => {
  assert.equal(r.wears.length, 1);
  const a = item('iHose').analysis as Record<string, unknown>;
  assert.equal(a.vdesc, 'Weite Hose');
  assert.equal('trimV5' in a, false);
  assert.equal(r.warnings.some((w) => w.includes('unbekannte Felder')), false);
});

test('Fehlende Dublette wird entfernt und gemeldet', () => {
  assert.equal(item('iShirt').dup_of, null);
  assert.ok(r.warnings.some((w) => w.includes('Dublette')));
});

test('Outfit: fehlende Teile raus, Layout und Planung übernommen', () => {
  assert.equal(r.outfitItems.length, 2);
  const hose = r.outfitItems.find((o) => o.item_id === item('iHose').id)!;
  assert.equal(hose.x, 0.48);
  assert.equal(hose.z, 108);
  assert.equal(r.outfitPlans[0]!.plan_date, '2026-11-11');
});

test('Reservierung wird mit der Planung verknüpft', () => {
  assert.equal(r.reservations.length, 1);
  assert.equal(r.reservations[0]!.plan_id, r.outfitPlans[0]!.id);
});

test('Tagesvorschläge: "all" = für alle, sonst Person', () => {
  const all = r.dailySuggestions.find((d) => d.for_date === '2026-11-12')!;
  assert.equal(all.person_id, null);
  assert.equal(all.wada, 296);
  const max = r.dailySuggestions.find((d) => d.for_date === '2026-11-09')!;
  assert.equal(max.person_id, person('pMax').id);
});

test('Status und Fremdwährung', () => {
  assert.equal(item('iShirt').status, 'wash');
  assert.equal(item('iShirt').orig_currency, 'GBP');
  assert.equal(item('iShirt').fx_rate, 1.16);
});
