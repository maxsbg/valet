import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weatherFrom, applyWeather, weatherNote } from '../src/weather';
import { emptyEditForm, setCategory, setField } from '../src/edit';

const w = (category: string, subcategory: string | null, type: string | null, mats: string[], name = '') =>
  weatherFrom({ category, subcategory, type, materials: mats.map((name) => ({ name, pct: null })), name });

test('Wärme: Grundwert + Material + Stichwort', () => {
  assert.equal(w('headwear', 'cap', null, ['cotton']).warmth, 0);
  assert.equal(w('headwear', 'cap', null, ['wool']).warmth, 1);
  assert.equal(w('shorts', 'suit_shorts', null, ['cotton']).warmth, 0);
  assert.equal(w('pants', 'trousers', null, ['wool']).warmth, 1); // Anzugwolle = leicht (Max 21.11.2026)
  assert.equal(w('pants', 'trousers', 'suit_trousers', ['flannel']).warmth, 2);
  assert.equal(w('pants', 'trousers', null, ['wool'], 'Winter Wool Trousers').warmth, 2);
  assert.equal(w('outerwear', 'blazer', null, ['wool']).warmth, 1);
  assert.equal(w('top', 'sweater', null, ['wool']).warmth, 3);
  assert.equal(w('outerwear', 'blouson', null, ['leather']).warmth, 2);
  assert.equal(w('outerwear', 'blouson', null, ['leather'], 'Lined Leather Jacket').warmth, 3);
});

test('Schuhe: nur nach Art, Material verschiebt nichts', () => {
  assert.equal(w('shoe', 'sports_shoe', 'running_shoe', ['mesh']).warmth, 1);
  assert.equal(w('shoe', 'sandal', 'trekking_sandal', []).warmth, 0);
  assert.equal(w('shoe', 'slide', 'mule', ['leather']).warmth, 1);
  assert.equal(w('shoe', 'clog', null, ['suede']).warmth, 1);
  assert.equal(w('shoe', 'slip_on', 'espadrille', []).warmth, 0);
  assert.equal(w('shoe', 'boot', 'lace_up_boot', ['leather']).warmth, 2);
  assert.equal(w('shoe', 'boot', 'sheepskin_boot', ['suede']).warmth, 3);
  assert.equal(w('shoe', 'boot', 'chelsea_boot', ['leather'], 'Chelsea Boot gefüttert').warmth, 3);
  assert.equal(w('shoe', 'sports_shoe', 'running_shoe', []).warmthSure, true);
});

test('Regen: Material nur bei Außenlage und Schuhen, Trenchcoat und Gabardine mittel', () => {
  assert.equal(w('pants', 'trousers', null, ['polyester']).rain, 0);
  assert.equal(w('outerwear', 'sports_jacket', 'track_jacket', ['polyester']).rain, 1);
  assert.equal(w('shoe', 'sports_shoe', 'running_shoe', ['mesh']).rain, 0);
  assert.equal(w('outerwear', 'trench_coat', null, ['cotton']).rain, 1);
  assert.equal(w('outerwear', 'overshirt', null, ['cotton'], 'Gabardine Overshirt').rain, 1);
  assert.equal(w('pants', 'trousers', null, ['cotton'], 'Wasserdicht Hose').rain, 2);
});

test('applyWeather: ersetzt Bildschätzung, nie bestätigte Werte', () => {
  let f = setCategory({ ...emptyEditForm({ ownerId: 'max' }) }, { category: 'top', subcategory: 't_shirt', type: null });
  f = { ...f, warmth: 2, aiPending: ['warmth'] };
  f = setField(f, 'materials', [{ name: 'cotton', pct: null }]);
  assert.equal(f.warmth, 1);
  assert.ok(f.aiPending.includes('warmth'));
  assert.equal((f.analysisBase.src as Record<string, string>).warmth, 'material');
  assert.match(weatherNote(f) ?? '', /Wärme/);
  // bestätigt bleibt
  const c = setField({ ...f, warmth: 3, aiPending: [] }, 'materials', [{ name: 'linen', pct: null }]);
  assert.equal(c.warmth, 3);
  // Material weg → berechneter Wert verschwindet
  const g = setField(f, 'materials', []);
  assert.equal(g.warmth, null);
  assert.ok(!g.aiPending.includes('warmth'));
  assert.equal(applyWeather(g), g);
});

import { applyRules, applyProfileRules } from '../src/ruleForm';
import { emptyProfile, emptyConfidence } from '../src/ai/profile';

test('Regeln: Saison aus Wärme, Verschluss aus Typ, KI darf sicher widersprechen', () => {
  let f = setCategory({ ...emptyEditForm({ ownerId: 'max' }) }, { category: 'top', subcategory: 'polo', type: 'short_sleeve_polo' });
  f = setField(f, 'materials', [{ name: 'cotton', pct: null }]);
  assert.deepEqual(f.seasons, ['spring', 'summer', 'autumn', 'winter']); // Polo leicht = Basisteil ganzjährig
  assert.equal(f.closure, 'buttons');
  assert.equal(f.collar, 'polo_collar');
  assert.equal(f.care.wash?.v, 'w30');
  assert.equal(f.care.wash?.src, 'geschaetzt');
  // KI sieht sicher einen Zipper → bleibt
  const ki = { ...f, closure: 'zipper', confidence: { ...emptyConfidence(), shape: 9 }, analysisBase: { src: {} } };
  assert.equal(applyRules(ki).closure, 'zipper');
  // KI unsicher → Regel
  assert.equal(applyRules({ ...ki, confidence: { ...emptyConfidence(), shape: 5 } }).closure, 'buttons');
  // selbst gesetzt bleibt
  const own = setField(f, 'closure', 'snaps');
  assert.equal(applyRules(own).closure, 'snaps');
  // Name zählt nur, wenn vertraut
  const zipName = setField(f, 'name', 'Zip Polo');
  assert.equal(applyRules({ ...zipName, closure: null, aiPending: zipName.aiPending.filter((k) => k !== 'closure') }).closure, 'zipper');
  const kiName = { ...zipName, closure: null, aiPending: ['name'], analysisBase: { src: { name: 'image' } } };
  assert.equal(applyRules(kiName).closure, 'buttons');
});

test('Regeln: Profil – Formalitäts-Rahmen, Barrel senkt, Vielseitigkeit gerechnet', () => {
  let f = setCategory({ ...emptyEditForm({ ownerId: 'max' }) }, { category: 'pants', subcategory: 'trousers', type: 'suit_trousers' });
  f = { ...f, name: 'Barrel Suit Trousers', colors: ['black'], pattern: 'solid', profile: { ...emptyProfile(), formality: [5, 5], presence: 2 } };
  const p = applyProfileRules(f).profile;
  assert.deepEqual(p.formality, [4, 4]);
  assert.equal(p.versatility, 4);
});

import { setProfileField } from '../src/ruleForm';
import * as Rules from '../src/rules';

test('Half-/Quarter-Zip und Gürtel-Typen', () => {
  const hz = setCategory({ ...emptyEditForm({ ownerId: 'max' }) }, { category: 'top', subcategory: 'sweater', type: 'half_zip_sweater' });
  assert.equal(hz.closure, 'zipper');
  assert.equal(hz.collar, 'stand_collar');
  const plain = setCategory({ ...emptyEditForm({ ownerId: 'max' }) }, { category: 'top', subcategory: 'sweater', type: null });
  assert.equal(plain.closure, 'none');
  const named = Rules.collarFrom({ category: 'top', subcategory: 'sweatshirt', type: null, materials: [], name: 'Quarter Zip Sweat' });
  assert.equal(named?.v, 'stand_collar');
  const western = Rules.versatilityFrom({ colors: ['black'], pattern: 'solid', presence: 3, formality: [1, 2], type: 'western_belt' });
  const leather = Rules.versatilityFrom({ colors: ['black'], pattern: 'solid', presence: 3, formality: [1, 2], type: 'leather_belt' });
  assert.equal((leather?.v ?? 0) - (western?.v ?? 0), 1);
  assert.deepEqual(Rules.formalityFrame({ category: 'accessory', subcategory: 'belt', type: 'leather_belt', materials: [], name: '' })?.v, [1, 4]);
});

test('Eigene Profilwerte bleiben bei Regeln und neuer Analyse', () => {
  let f = setCategory({ ...emptyEditForm({ ownerId: 'max' }) }, { category: 'accessory', subcategory: 'belt', type: 'leather_belt' });
  f = { ...f, colors: ['black'], profile: { ...emptyProfile(), formality: [2, 3] } };
  f = setProfileField(f, 'formality', [3, 5]);
  assert.deepEqual(applyProfileRules(f).profile.formality, [3, 5]); // über dem Rahmen, aber selbst gesetzt
  const cleared = setProfileField(f, 'formality', null);
  assert.deepEqual(cleared.analysisBase.own, []);
});

import { materialShares } from '../src/weather';

test('Material-Anteile: Prozent, sonst nach Reihenfolge, Elasthan 3 %', () => {
  const s = (ps: { name: string; pct?: number | null }[]) => materialShares(ps).map((x) => Math.round(x.share * 100));
  assert.deepEqual(s([{ name: 'cotton' }, { name: 'wool' }]), [80, 20]);
  assert.deepEqual(s([{ name: 'cotton' }, { name: 'wool' }, { name: 'nylon' }]), [70, 20, 10]);
  assert.deepEqual(s([{ name: 'cotton' }, { name: 'elastane' }]), [97, 3]);
  assert.deepEqual(s([{ name: 'cotton', pct: 95 }, { name: 'wool', pct: 5 }]), [95, 5]);
  assert.deepEqual(s([{ name: 'cotton', pct: 60 }, { name: 'wool' }, { name: 'nylon' }]), [60, 32, 8]);
  assert.deepEqual(s([{ name: 'elastane' }]), [100]);
  // 5 % Wolle ändern die Wärme nicht
  assert.equal(w('top', 't_shirt', null, []).warmth, weatherFrom({ category: 'top', subcategory: 't_shirt', type: null, materials: [{ name: 'cotton', pct: 95 }, { name: 'wool', pct: 5 }], name: '' }).warmth);
});

import { confirmAi, confirmAllAi, acceptedKeys } from '../src/edit';

test('Übernommene KI-Werte darf die Regel korrigieren, selbst eingetragene nicht', () => {
  let f = setCategory({ ...emptyEditForm({ ownerId: 'max' }) }, { category: 'pants', subcategory: 'sweatpants', type: null });
  // KI schlug Regen mittel vor, Max hat übernommen
  f = { ...f, rain: 1, aiPending: ['rain'], analysisBase: { src: { rain: 'image' } } };
  const acc = confirmAllAi(f);
  assert.deepEqual(acceptedKeys(acc), ['rain']);
  const g = setField(acc, 'materials', [{ name: 'cotton', pct: null }]);
  assert.equal(g.rain, 0); // Regel: Hose nie Regenschutz aus Material
  assert.ok(g.aiPending.includes('rain')); // wieder offen
  // selbst eingetragen bleibt
  const own = setField(confirmAi(f, 'rain'), 'rain', 1);
  assert.deepEqual(acceptedKeys(own), []);
  assert.equal(setField(own, 'materials', [{ name: 'cotton', pct: null }]).rain, 1);
});

import { seasonsFrom } from '../src/rules';
test('Saison: Ausnahmen je Kategorie', () => {
  assert.deepEqual(seasonsFrom('shoe', 'sneaker', 1), ['spring', 'summer', 'autumn', 'winter']);
  assert.deepEqual(seasonsFrom('shoe', 'sandal', 0), ['spring', 'summer']);
  assert.deepEqual(seasonsFrom('shoe', 'boot', 2), ['spring', 'autumn', 'winter']);
  assert.deepEqual(seasonsFrom('headwear', 'cap', 0), ['spring', 'summer', 'autumn', 'winter']);
  assert.deepEqual(seasonsFrom('headwear', 'beanie_cap', 2), ['autumn', 'winter']);
  assert.deepEqual(seasonsFrom('pants', 'jeans', 2), ['spring', 'summer', 'autumn', 'winter']);
  assert.deepEqual(seasonsFrom('outerwear', 'coat', 3), ['spring', 'autumn', 'winter']);
  assert.deepEqual(seasonsFrom('top', 'tank_top', 0), ['spring', 'summer']);
  assert.deepEqual(seasonsFrom('accessory', 'swimwear', 0), ['summer']);
});

test('Sohle, Trägerart, Krawatte', () => {
  assert.equal(Rules.soleFrom({ category: 'shoe', subcategory: 'sneaker', type: 'chunky_sneaker', materials: [], name: '' }), 'chunky');
  assert.equal(Rules.strapFrom({ category: 'bag', subcategory: 'backpack', type: null, materials: [], name: '' })?.v, 'backpack_straps');
  assert.equal(Rules.strapFrom({ category: 'bag', subcategory: 'belt_bag', type: null, materials: [], name: '' }), null);
  assert.deepEqual(Rules.formalityFrame({ category: 'accessory', subcategory: 'suit_accessory', type: 'tie', materials: [], name: '' })?.v, [3, 5]);
  const bag = setCategory({ ...emptyEditForm({ ownerId: 'max' }) }, { category: 'bag', subcategory: 'handbag', type: 'shopper' });
  assert.equal(bag.strap, 'handles');
});

import { colorTraits, sharesFor, mainColors } from '../src/traits';
import { checkAnalysis } from '../src/ai/analyzeItem';

test('Farbanteile: Details zählen nicht, echte Gewichte', () => {
  const a = checkAnalysis({ category: 'outerwear', colors: ['black', 'red'], color_shares: [95, 5] });
  assert.deepEqual(a.colorShares, [95, 5]);
  assert.deepEqual(checkAnalysis({ colors: ['black', 'red'], color_shares: [60] }).colorShares, []);
  const shares = sharesFor(['black', 'red'], { colors: ['black', 'red'], shares: [95, 5] });
  assert.deepEqual(shares, [95, 5]);
  assert.equal(sharesFor(['black', 'blue'], { colors: ['black', 'red'], shares: [95, 5] }), null); // Farben geändert
  assert.deepEqual(mainColors(['black', 'red'], shares), ['black']);
  const withLogo = colorTraits(['black', 'red'], shares)!, fixed = colorTraits(['black', 'red'])!;
  assert.equal(withLogo.distribution, 'solid');
  assert.equal(withLogo.temperature, 'neutral');
  assert.ok(withLogo.chroma <= fixed.chroma);
  // Vielseitigkeit: rotes Logo zählt nicht als Akzentfarbe
  const v1 = Rules.versatilityFrom({ colors: ['black', 'red'], pattern: 'solid', presence: 2, formality: [1, 3], shares: [95, 5] })!.v;
  const v2 = Rules.versatilityFrom({ colors: ['black', 'red'], pattern: 'solid', presence: 2, formality: [1, 3] })!.v;
  assert.ok(v1 > v2);
});

import { sharesMissing, checkColorShares, sharesChange } from '../src/ai/colorShares';

test('Farbanteile nachtragen: nur mehrfarbig, mit Profil, ohne gültige Anteile', () => {
  const prof = { meta: { v: 2 }, profile: { formality: [1, 2] } };
  assert.equal(sharesMissing(['black', 'red'], prof), true);
  assert.equal(sharesMissing(['black'], prof), false);
  assert.equal(sharesMissing(['black', 'red'], null), false); // ohne Profil: „Profile ergänzen“
  assert.deepEqual(checkColorShares({ color_shares: [90, 15] }, ['black', 'red']), [85, 15]);
  assert.equal(checkColorShares({ color_shares: [100] }, ['black', 'red']), null);
  const done = sharesChange(prof, ['black', 'red'], [90, 10]).analysis;
  assert.equal(sharesMissing(['black', 'red'], done), false);
  assert.deepEqual(done.profile, prof.profile);
});
