import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agoLabel, ownShare, wearTiles, statFontSize, discountPct, shareRows, splitLabel, shortUrl } from '../src/detail';

const TODAY = '2026-11-15';

test('Zuletzt: relative Angaben', () => {
  assert.equal(agoLabel(TODAY, TODAY), 'heute');
  assert.equal(agoLabel('2026-11-14', TODAY), 'gestern');
  assert.equal(agoLabel('2026-11-12', TODAY), 'vor 3 Tagen');
  assert.equal(agoLabel('2026-10-25', TODAY), 'vor 3 Wochen');
  assert.equal(agoLabel('2026-07-15', TODAY), 'vor 4 Monaten');
});

test('Eigener Anteil: allein, gleich geteilt, eigene Beträge, nicht beteiligt; Preis je Stück × Anzahl', () => {
  assert.equal(ownShare(59, 1, null, 'max'), 59);
  assert.equal(ownShare(12.49, 2, null, 'max'), 24.98);
  const half = [{ personId: 'max', amount: null }, { personId: 'paul', amount: null }];
  assert.equal(ownShare(59, 1, half, 'max'), 29.5);
  assert.equal(ownShare(59, 1, [{ personId: 'max', amount: 35 }, { personId: 'paul', amount: 24 }], 'paul'), 24);
  assert.equal(ownShare(59, 1, half, 'lisa'), 59);
  assert.equal(ownShare(null, 1, half, 'max'), null);
});

test('Kacheln: Beispiel aus der Leinwand (7×, 8,43 €, vor 3 Tagen)', () => {
  const days = ['2026-10-12', '2026-10-20', '2026-10-28', '2026-11-01', '2026-11-05', '2026-11-08', '2026-11-12'];
  const t = wearTiles({ days, today: TODAY, share: 59, gift: false });
  assert.deepEqual(t.map((x) => [x.value, x.hint]), [['7×', 'seit 12.10.'], ['8,43 €', 'bei 59,00 €'], ['12.11.', 'vor 3 Tagen']]);
});

test('Kacheln: leere Zustände', () => {
  const none = wearTiles({ days: [], today: TODAY, share: null, gift: false });
  assert.deepEqual(none.map((x) => [x.value, x.hint]), [['0', 'noch nie'], ['–', 'Preis fehlt'], ['–', 'noch nie']]);
  assert.equal(none[1]!.editPrice, true);
  assert.deepEqual(wearTiles({ days: [], today: TODAY, share: 59, gift: false })[1]!.value, '–');
  assert.deepEqual(wearTiles({ days: ['2026-11-01'], today: TODAY, share: null, gift: true })[1], { label: 'Pro Tragen', value: '–', hint: 'Geschenk' });
});

test('Schriftgröße: 22, gemeinsam kleiner, höchstens bis 20', () => {
  assert.equal(statFontSize([40, 60, 50], 80), 22);
  assert.equal(statFontSize([40, 88, 50], 80), 20);
  assert.equal(statFontSize([40, 84, 50], 80), 20.9);
  assert.equal(statFontSize([200], 80), 20);
});

test('Rabatt, Anteile, Kurzform, Adresse', () => {
  assert.equal(discountPct(59, 79), 25);
  assert.equal(discountPct(79, 79), null);
  const rows = shareRows(59, 1, [{ personId: 'max', amount: null }, { personId: 'paul', amount: null }]);
  assert.deepEqual(rows, [{ personId: 'max', amount: 29.5, pct: 50 }, { personId: 'paul', amount: 29.5, pct: 50 }]);
  assert.equal(splitLabel(rows), 'je Hälfte');
  assert.deepEqual(shareRows(59, 1, [{ personId: 'max', amount: null }]), []);
  assert.equal(shortUrl('https://www.cos.com/de/hemd/'), 'cos.com/de/hemd');
});
