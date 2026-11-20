import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toEditForm, emptyEditForm, setField, confirmAi, toggleMaterial, materialRank, pickSizeSystem, setCategory, pickFit, togglePayer,
  splitView, qtyHint, editChange, totalOf, type EditForm,
} from '../src/edit';

const base = (p: Partial<EditForm> = {}): EditForm => ({ ...emptyEditForm({ ownerId: 'max' }), name: 'shirt', ...p });

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
  let m = toggleMaterial([], 'flannel');
  m = toggleMaterial(m, 'cotton');
  assert.equal(materialRank(m, 'cotton'), 2);
  m = toggleMaterial(m, 'flannel');
  assert.equal(materialRank(m, 'cotton'), 1);
});

test('Größe: Systemwechsel setzt die Größe zurück, One Size bleibt', () => {
  const f = base({ sizeSystem: 'letters', size: 'M' });
  assert.deepEqual([pickSizeSystem(f, 'numbers').sizeSystem, pickSizeSystem(f, 'numbers').size], ['numbers', null]);
  assert.equal(pickSizeSystem(base({ sizeSystem: 'letters', size: 'One Size' }), 'numbers').size, 'One Size');
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
  assert.deepEqual(editChange(base({ category: 'top', subcategory: 'jeans' })), { error: 'Kategorie ist unvollständig.' });
  assert.deepEqual(editChange(base({ price: 'abc' })), { error: 'Bezahlt ist keine gültige Zahl.' });
});

test('Speichern: Spiegel, Passform nur passend zur Kategorie, Farben B nur bei Wendbar', () => {
  const r = editChange(base({
    category: 'shoe', subcategory: 'sneaker', colors: ['white', 'black'], colorsB: ['red'], materials: [{ name: 'leather' }],
    styles: ['street'], fit: { width: 2, length: 2, rise: 1 }, price: '120', qty: 2,
  }));
  assert.ok('change' in r);
  const c = r.change;
  assert.equal(c.color, 'Weiß/Schwarz');
  // Spiegel der alten Freitext-Felder: deutsches Label
  assert.equal(c.material, 'Leder');
  assert.equal(c.style, 'Street');
  assert.deepEqual(c.colors, ['white', 'black']);
  // Spec 8a: Passform wird beim Schuh nicht gezeigt, gespeicherte Werte bleiben aber erhalten
  assert.deepEqual([c.fit_width, c.fit_length, c.fit_rise], [2, 2, 1]);
  assert.deepEqual(c.colors_b, []);
  assert.equal(c.price_paid, 120);
  assert.equal(c.qty, 2);
  const h = editChange(base({ category: 'pants', fit: { width: 3, length: 2, rise: 2 } }));
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
  const f = { ...emptyEditForm({ wish: { wishlistId: 'L1' } }), name: 'coat', listPrice: '249', wishTag: 'grail' as const, buyOn: '2026-12-01' };
  const r = editChange(f, { isNew: true });
  assert.ok('change' in r);
  assert.deepEqual([r.change.is_wish, r.change.list_price, r.change.wish_price, r.change.wishlist_id, r.change.wish_tag, r.change.buy_on],
    [true, 249, 249, 'L1', 'grail', '2026-12-01']);
  assert.equal('price_paid' in r.change, false);
  assert.equal('owner_ids' in r.change, false);
});

test('Speichern: Wunschteil ohne Liste geht nicht', () => {
  const f = { ...emptyEditForm({ wish: { wishlistId: null } }), name: 'coat' };
  assert.deepEqual(editChange(f, { isNew: true }), { error: 'Bitte eine Liste wählen.' });
});

test('Speichern: ohne Kategorie leerer Text (Spalte ist not null)', () => {
  const r = editChange(base());
  assert.ok('change' in r);
  assert.deepEqual([r.change.category, r.change.subcategory, r.change.item_type], ['', null, null]);
  assert.equal(toEditForm({ name: 'X', category: '' }).category, null);
});

test('Größe beim Laden: Schuh → EU, Jeans W/L, Kappe „7 3/8 (58,7 cm)“ → Fitted 7 3/8', () => {
  assert.equal(toEditForm({ name: 'S', category: 'shoe', subcategory: 'sneaker', size: '44', size_system: 'numbers' }).sizeSystem, 'eu');
  assert.equal(toEditForm({ name: 'J', category: 'pants', subcategory: 'jeans', size: 'W30/L34' }).sizeSystem, 'wl');
  assert.equal(toEditForm({ name: 'J', category: 'pants', subcategory: 'jeans', size: 'L', size_system: 'letters' }).sizeSystem, 'letters');
  const cap = toEditForm({ name: 'C', category: 'headwear', subcategory: 'cap', size: '7 3/8 (58,7 cm)' });
  assert.deepEqual([cap.sizeSystem, cap.size], ['cap', '7 3/8']);
  assert.equal(toEditForm({ name: 'C', category: 'headwear', subcategory: 'cap', size: 'One Size' }).size, 'Verstellbar');
});

test('Kategorie-Wechsel: Größen-System passt sich an', () => {
  const f = setCategory(base({ category: 'top', sizeSystem: 'letters', size: 'M' }), { category: 'pants', subcategory: 'jeans', type: null });
  assert.deepEqual([f.sizeSystem, f.size], ['letters', 'M']);
  const e = setCategory(base({ category: 'top', sizeSystem: 'numbers', size: '50' }), { category: 'pants', subcategory: 'jeans', type: null });
  assert.deepEqual([e.sizeSystem, e.size], ['wl', null]);
  const h = setCategory(base({ category: 'top', sizeSystem: 'letters', size: 'M' }), { category: 'shoe', subcategory: 'sneaker', type: null });
  assert.deepEqual([h.sizeSystem, h.size], ['eu', null]);
  const b = setCategory(base({ category: 'pants', sizeSystem: 'letters', size: 'L' }), { category: 'top', subcategory: null, type: null });
  assert.deepEqual([b.sizeSystem, b.size], ['letters', 'L']);
  const g = setCategory(base({ category: 'top', sizeSystem: 'letters', size: 'M' }), { category: 'outerwear', subcategory: null, type: null });
  assert.deepEqual([g.sizeSystem, g.size], ['letters', 'M']);
});

test('Laden ist tolerant: deutsche Labels und Altwerte werden zu Keys, Unbekanntes fällt weg', () => {
  const f = toEditForm({
    name: 'Alt', category: 'Oberteil', subcategory: 'Hemd', item_type: 'Langarmhemd', seasons: ['Winter', 'Übergang'],
    colors: ['Marineblau', 'Weiß', 'Unbekannt'], colors_b: ['navy'], pattern: 'Kariert', pattern_b: 'plaid',
    materials: [{ name: 'Baumwolle', pct: 80 }, { name: 'elastane', pct: 20 }, { name: 'Quatsch' }],
    styles: ['Casual', 'classic'], collar: 'Button-down', closure: 'Knöpfe', strap: 'Kette',
  });
  assert.deepEqual([f.category, f.subcategory, f.type], ['top', 'shirt', 'long_sleeve_shirt']);
  assert.deepEqual(f.seasons, ['spring', 'autumn', 'winter']);
  assert.deepEqual(f.colors, ['navy', 'white']);
  assert.deepEqual(f.colorsB, ['navy']);
  assert.deepEqual([f.pattern, f.patternB], ['plaid', 'plaid']);
  assert.deepEqual(f.materials, [{ name: 'cotton', pct: 80 }, { name: 'elastane', pct: 20 }]);
  assert.deepEqual(f.styles, ['casual', 'classic']);
  assert.deepEqual([f.collar, f.closure, f.strap], ['button_down', 'buttons', 'chain']);
  // Neue Daten bleiben unverändert
  const g = toEditForm({ name: 'Neu', category: 'top', subcategory: 'shirt', colors: ['navy'], styles: ['street'] });
  assert.deepEqual([g.category, g.subcategory, g.colors, g.styles], ['top', 'shirt', ['navy'], ['street']]);
});

// ---------- KI-Profil (Analyse v2, Spec 6.4–6.6, 8, 13) ----------

import { applyAnalysis, checkAnalysis, profilePatch } from '../src/ai/analyzeItem';
import { activeProfile, emptyConfidence, emptyProfile, PROFILE_PROMPT_VERSION } from '../src/ai/profile';
import { mergeAnalysis } from '../src/edit';

const NOW = '2026-11-19T11:00:00.000Z';
const OLD = { vdesc: 'Blauer Pullover', matInfo: { main: 'Wolle' }, extra: [1, 2] };
const jeansAnalysis = () => checkAnalysis({
  category: 'pants/jeans', name: 'Jeans', colors: ['blue'], materials: ['denim'],
  profile: { leg: 'tapered', denim_wash: 'dark', sheen: 2, formality_min: 1, formality_max: 3, effects: ['rugged'] },
  confidence: { category: 10, color: 9, material: 7, surface: 8, shape: 9, style: 8 },
}, 'gemini-3.5-flash-lite');

test('Laden: items.analysis → Profil, Konfidenz, Altdaten gemerkt; fehlt → leeres Profil', () => {
  const f = toEditForm({ name: 'X', analysis: { ...OLD, profile: { sheen: 2, formality: [2, 4], surface: 'fine_knit', toe: 'Quatsch', effects: ['soft', 'soft'] }, confidence: { color: 9, style: 11 } } });
  assert.equal(f.profile.sheen, 2);
  assert.deepEqual(f.profile.formality, [2, 4]);
  assert.equal(f.profile.surface, 'fine_knit');
  assert.equal(f.profile.toe, null);
  assert.deepEqual(f.profile.effects, ['soft']);
  assert.equal(f.confidence.color, 9);
  assert.equal(f.confidence.style, null);
  assert.equal(f.aiMeta, null);
  assert.deepEqual(f.analysisBase.vdesc, OLD.vdesc);
  const g = toEditForm({ name: 'X', analysis: null });
  assert.deepEqual(g.profile, emptyProfile());
  assert.deepEqual(g.confidence, emptyConfidence());
  assert.deepEqual(g.analysisBase, {});
  assert.deepEqual(emptyEditForm().analysisBase, {});
});

test('Formular: applyAnalysis ersetzt das Profil komplett, ohne profile.*-Markierung, bestätigte Felder bleiben', () => {
  const start: EditForm = {
    ...base({ name: 'Meine Jeans', colors: ['black'], profile: { ...emptyProfile(), toe: 'round', sheen: 5 }, aiPending: [] }),
  };
  const f = applyAnalysis(start, jeansAnalysis(), NOW);
  assert.equal(f.name, 'Meine Jeans'); // bestätigt → bleibt
  assert.deepEqual(f.colors, ['black']);
  assert.deepEqual(f.profile, jeansAnalysis().profile); // komplett ersetzt: toe weg, sheen 2
  assert.equal(f.profile.toe, null);
  assert.equal(f.profile.sheen, 2);
  assert.equal(f.confidence.category, 10);
  assert.deepEqual(f.aiMeta, { v: 2, prompt: PROFILE_PROMPT_VERSION, model: 'gemini-3.5-flash-lite', at: NOW, source: 'image' });
  assert.ok(!f.aiPending.some((k) => k === 'profile' || k.startsWith('profile.') || k === 'confidence'));
  assert.ok(f.aiPending.includes('category') && !f.aiPending.includes('name'));
});

test('Speichern: mergeAnalysis behält Altdaten, ersetzt profile/confidence, meta nur nach neuer Analyse', () => {
  const stored = { ...OLD, profile: { sheen: 4 }, confidence: { color: 3 }, meta: { v: 2, prompt: '2.0', model: 'alt', at: '2026-11-01T00:00:00Z' } };
  const p = { ...emptyProfile(), sheen: 1 };
  const kept = mergeAnalysis(stored, p, emptyConfidence(), null);
  assert.deepEqual(kept.vdesc, OLD.vdesc); assert.deepEqual(kept.matInfo, OLD.matInfo); assert.deepEqual(kept.extra, OLD.extra);
  assert.deepEqual(kept.profile, p);
  assert.deepEqual(kept.confidence, emptyConfidence());
  assert.deepEqual(kept.meta, stored.meta); // keine neue Analyse → meta unverändert
  const meta = { v: 2 as const, prompt: '2.0', model: 'neu', at: NOW, source: 'image' as const };
  assert.deepEqual(mergeAnalysis(stored, p, emptyConfidence(), meta).meta, meta);
  assert.deepEqual(mergeAnalysis(null, p, emptyConfidence(), null), { profile: p, confidence: emptyConfidence() });

  // Ganzer Weg: Laden → Analyse → editChange
  const f = toEditForm({ name: 'Jeans', category: 'pants', subcategory: 'jeans', analysis: stored });
  const unchanged = editChange(f);
  assert.ok('change' in unchanged);
  const a1 = (unchanged as { change: Record<string, unknown> }).change.analysis as Record<string, unknown>;
  assert.deepEqual(a1.meta, stored.meta); assert.equal(a1.vdesc, OLD.vdesc);
  const r = editChange(applyAnalysis(f, jeansAnalysis(), NOW));
  assert.ok('change' in r);
  const a2 = r.change.analysis as Record<string, unknown>;
  assert.equal(a2.vdesc, OLD.vdesc);
  assert.equal((a2.meta as { v: number }).v, 2);
  assert.equal((a2.meta as { model: string }).model, 'gemini-3.5-flash-lite');
  assert.equal((a2.profile as { leg: string }).leg, 'tapered');
  // Neues Teil: profile/confidence/meta + Herkunft der vorgeschlagenen Werte (src)
  const n = editChange(applyAnalysis({ ...emptyEditForm({ ownerId: 'max' }), aiPending: [] }, jeansAnalysis(), NOW), { isNew: true });
  assert.ok('change' in n);
  assert.deepEqual(Object.keys(n.change.analysis as object).sort(), ['confidence', 'meta', 'profile', 'src']);
  assert.equal((n.change.analysis as { src: Record<string, string> }).src.colors, 'image');
});

test('Stapellauf: profilePatch läuft ohne Name, ersetzt das Profil, behält Altschlüssel, löscht meta.failed', () => {
  const row = {
    category: 'pants', subcategory: 'jeans', pattern: 'solid', materials: [{ name: 'denim', pct: 98 }, { name: 'elastane' }],
    analysis: { ...OLD, profile: { toe: 'round' }, meta: { failed: { n: 2, at: '2026-11-18T00:00:00Z' } } }, ai_pending: ['colors'],
  };
  const a = { ...jeansAnalysis(), profile: { ...jeansAnalysis().profile, pattern_scale: 'large', toe: 'pointed' } };
  const patch = profilePatch(row, a, NOW);
  assert.deepEqual(Object.keys(patch), ['analysis']); // Steckbrief, Name und ai_pending unberührt
  const an = patch.analysis as Record<string, any>;
  assert.equal(an.vdesc, OLD.vdesc); assert.deepEqual(an.extra, OLD.extra);
  assert.equal(an.profile.leg, 'tapered');
  assert.equal(an.profile.denim_wash, 'dark'); // gespeichertes Material Denim
  assert.equal(an.profile.pattern_scale, null); // gespeichertes Muster Unifarben
  assert.equal(an.profile.toe, null); // Hose, kein Schuh
  assert.deepEqual(an.meta, { v: 2, prompt: PROFILE_PROMPT_VERSION, model: 'gemini-3.5-flash-lite', at: NOW, source: 'image' });
  assert.equal(an.confidence.color, 9);
  // ohne Kategorie und ohne Altdaten
  const bare = profilePatch({ category: null, subcategory: null, pattern: null, materials: null, analysis: null, ai_pending: null }, a, NOW);
  assert.equal((bare.analysis as Record<string, any>).meta.v, 2);
});

test('Kategoriewechsel: Hose → Schuh blendet leg in activeProfile aus, zurück ist es wieder da', () => {
  const jeans = applyAnalysis({ ...base(), aiPending: [] }, jeansAnalysis(), NOW);
  const ctx = (f: EditForm) => ({ category: f.category, sub: f.subcategory, pattern: f.pattern, materials: f.materials.map((m) => m.name) });
  assert.equal(activeProfile(jeans.profile, ctx(jeans)).leg, 'tapered');
  const shoe = setCategory(jeans, { category: 'shoe', subcategory: 'sneaker', type: null });
  assert.ok(!('leg' in activeProfile(shoe.profile, ctx(shoe))));
  assert.equal(shoe.profile.leg, 'tapered'); // gespeichert bleibt es
  const back = setCategory(shoe, { category: 'pants', subcategory: 'jeans', type: null });
  assert.equal(activeProfile(back.profile, ctx(back)).leg, 'tapered');
  const r = editChange(shoe);
  assert.ok('change' in r);
  assert.equal(((r.change.analysis as Record<string, any>).profile).leg, 'tapered');
});
