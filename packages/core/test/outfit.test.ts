import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bandOf, generateOutfits, hardReason, rainFromHours, scoreOutfit, seasonOfMonth, skeleton, slotsOf, wadaMatch, type DayContext, type OutfitItem,
} from '../src/outfit/compose';

const day = (o: Partial<DayContext> = {}): DayContext => ({ tempC: 8, rain: 'none', rainOn: true, rainSoft: false, occasion: 'everyday', month: 11, date: '2026-11-21', includeStored: false, ...o });
const it = (o: Partial<OutfitItem> & { id: string }): OutfitItem => ({ category: 'top', subcategory: 't_shirt', colors: ['white'], styles: ['casual'], ...o });

test('Temperaturstufen und Saison', () => {
  assert.equal(bandOf(24), 'hot'); assert.equal(bandOf(17), 'mild'); assert.equal(bandOf(10), 'cool'); assert.equal(bandOf(3), 'cold'); assert.equal(bandOf(2), 'freezing');
  assert.equal(seasonOfMonth(11), 'winter'); assert.equal(seasonOfMonth(9), 'autumn'); assert.equal(seasonOfMonth(4), 'spring');
});

test('Gerüst: kalt immer Mittel- und Außenlage, heiß keine Außenlage', () => {
  assert.deepEqual(skeleton(5, undefined, () => 0.9), ['bottom', 'base', 'mid', 'outer', 'shoes']);
  for (let k = 0; k < 20; k++) assert.ok(!skeleton(28).includes('outer'));
});

test('Regenstufe: schlimmste Stunde ab 50 %, 30–49 % nur weich', () => {
  assert.equal(rainFromHours([{ mm: 0.2, prob: 80 }, { mm: 1, prob: 60 }]).level, 'rain');
  assert.equal(rainFromHours([{ mm: 5, prob: 70 }]).level, 'heavy');
  assert.equal(rainFromHours([{ mm: 0, prob: 0, thunder: true }]).level, 'none');
  assert.deepEqual(rainFromHours([{ mm: 2, prob: 40 }]), { level: 'none', soft: true });
});

test('Harte Filter: Status, Wärme, Shorts, Regen, Anlass', () => {
  assert.equal(hardReason(it({ id: 'a', status: 'wash' }), 'base', day()), 'Status wash');
  assert.equal(hardReason(it({ id: 'a', status: 'stored' }), 'base', day()), 'eingelagert');
  assert.equal(hardReason(it({ id: 'a', status: 'stored' }), 'base', day({ includeStored: true })), null);
  assert.equal(hardReason(it({ id: 'p', category: 'pants', subcategory: 'trousers', warmth: 3 }), 'bottom', day({ tempC: 20, month: 6 })), 'zu warm');
  assert.equal(hardReason(it({ id: 's', category: 'shorts', subcategory: 'bermuda_shorts' }), 'bottom', day({ tempC: 12, month: 5 })), 'Shorts zu kalt');
  assert.equal(hardReason(it({ id: 'j', category: 'outerwear', subcategory: 'blouson', warmth: 2, rain: 0 }), 'outer', day({ rain: 'rain' })), 'nicht regenfest genug');
  assert.equal(hardReason(it({ id: 'j', category: 'outerwear', subcategory: 'blouson', warmth: 2, rain: 0 }), 'outer', day({ rain: 'rain', rainOn: false })), null);
  assert.equal(hardReason(it({ id: 'f', styles: ['formal'] }), 'base', day({ occasion: 'sport' })), 'passt nicht zum Anlass');
  // Hitze gestaffelt (Max 21.11.2026): Jeans (mittel) bei 26 °C erlaubt, ab 30 °C raus; Saison ist keine Grenze mehr
  const jeans = it({ id: 'jn', category: 'pants', subcategory: 'jeans', warmth: 2, seasons: ['autumn', 'winter'] });
  assert.equal(hardReason(jeans, 'bottom', day({ tempC: 26, month: 7 })), null);
  assert.equal(hardReason(jeans, 'bottom', day({ tempC: 31, month: 7 })), 'zu warm');
});

test('Slots: Zip-Jacke nie Basis', () => {
  assert.ok(!slotsOf(it({ id: 'z', category: 'outerwear', subcategory: 'sweat_jacket' })).includes('base'));
  assert.deepEqual(slotsOf(it({ id: 'h', subcategory: 'shirt' })), ['base', 'mid', 'open']);
});

test('Farbe: „fast gleich“ nur in einer Familie, Navy + Schwarz ok', () => {
  const navyBlack = scoreOutfit([it({ id: '1', colors: ['navy'] }), it({ id: '2', category: 'pants', colors: ['black'] })], day());
  assert.ok(!navyBlack.notes.includes('Farben fast gleich'));
  const beiges = scoreOutfit([it({ id: '1', colors: ['beige'] }), it({ id: '2', category: 'pants', colors: ['sand'] })], day());
  assert.ok(beiges.notes.includes('Farben fast gleich'));
});

test('Farbe: zwei kräftige Farben ohne Wada-Bezug geben Abzug', () => {
  const s = scoreOutfit([it({ id: '1', colors: ['magenta'] }), it({ id: '2', category: 'pants', colors: ['light_green'] })], day());
  assert.ok(s.parts.color < 0.8);
  assert.ok(wadaMatch(['navy', 'camel']) >= 0);
});

test('Würfeln liefert vollständige Outfits', () => {
  const pool: OutfitItem[] = [
    it({ id: 't1' }), it({ id: 't2', colors: ['light_grey'] }),
    it({ id: 'm1', subcategory: 'sweater', colors: ['navy'] }),
    it({ id: 'o1', category: 'outerwear', subcategory: 'coat', colors: ['camel'] }),
    it({ id: 'b1', category: 'pants', subcategory: 'jeans', colors: ['blue'] }),
    it({ id: 's1', category: 'shoe', subcategory: 'sneaker', colors: ['white'] }),
  ];
  const { outfits } = generateOutfits(pool, day({ tempC: 5 }), 3);
  assert.ok(outfits.length >= 1);
  for (const o of outfits) for (const s of ['bottom', 'base', 'mid', 'outer', 'shoes'] as const) assert.ok(o.slots[s], s);
});

test('Spezielle Teile (Vielseitigkeit 1–2) nur im Alltag abgewertet', () => {
  const gold = it({ id: 'g', category: 'outerwear', subcategory: 'blouson', colors: ['gold'], profile: { versatility: 1 } });
  const jeans = it({ id: 'j', category: 'pants', subcategory: 'jeans', colors: ['black'] });
  const alltag = scoreOutfit([gold, jeans], day({ occasion: 'everyday' }));
  const party = scoreOutfit([gold, jeans], day({ occasion: 'party' }));
  assert.ok(alltag.parts.statement < party.parts.statement);
  assert.ok(alltag.notes.some((n) => n.startsWith('Spezielles Teil')));
});
