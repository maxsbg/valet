import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAnalysis } from '../src/ai/analyzeItem';
import { checkInfo } from '../src/ai/readInfo';
import { mergeSources, applyAnalysis, applyInfo, infoContext, confirmedContext, analysisSource, infoSource, DESCRIPTION_MAX, type SourceInfo } from '../src/ai/merge';
import { emptyEditForm, setField } from '../src/edit';

const NOW = '2026-11-19T11:00:00.000Z';
const blank = () => ({ ...emptyEditForm({ ownerId: 'max' }), aiPending: [] as string[] });
const image = () => checkAnalysis({
  category: 'top/shirt', name: 'Rippshirt', colors: ['navy'], materials: ['polyester'], width: 2, length: 2,
  profile: { sheen: 2, texture_intensity: 3, surface: 'rib_knit' }, confidence: { color: 8, material: 4 },
}, 'gemini-3.5-flash-lite');
const page = (extra: Record<string, unknown> = {}) => checkInfo({
  name: 'Slim Ribbed Shirt', category: 'top/shirt', colors: ['black'], shop: 'COS', price: 45,
  material_parts: [{ name: 'cotton', pct: 95 }, { name: 'elastane', pct: 5 }], ...extra,
});
const label = () => checkInfo({ kind: 'label', material_parts: [{ name: 'cotton', pct: 92 }, { name: 'elastane', pct: 8 }], size: 'M' });

test('Fehler: Info nach der Bildanalyse ersetzt NIE profile, confidence, aiMeta', () => {
  const a = applyAnalysis(blank(), image(), NOW);
  assert.equal(a.profile.sheen, 2);
  const b = applyInfo(a, page());
  assert.deepEqual(b.profile, a.profile);
  assert.deepEqual(b.confidence, a.confidence);
  assert.deepEqual(b.aiMeta, a.aiMeta);
  // Etikett ebenso
  assert.deepEqual(applyInfo(a, label()).profile, a.profile);
  // ohne vorherige Analyse bleibt das geladene Profil (aiMeta null → gespeichertes meta bleibt)
  const c = applyInfo(blank(), page());
  assert.deepEqual(c.profile, blank().profile);
  assert.equal(c.aiMeta, null);
});

test('Rangfolge: Shop-Material schlägt Bild-Material, egal in welcher Reihenfolge', () => {
  const infos: SourceInfo[] = [{ from: 'page', info: page() }];
  const f = mergeSources(blank(), { image: image(), infos }, NOW);
  assert.deepEqual(f.materials, [{ name: 'cotton', pct: 95 }, { name: 'elastane', pct: 5 }]);
  assert.deepEqual(f.colors, ['black']);
  assert.equal(f.name, 'Slim Ribbed Shirt');
  assert.equal(f.profile.sheen, 2); // Profil aus dem Bild
  assert.ok(f.aiPending.includes('materials'));
  // neuer Ablauf: erst Info anzeigen, dann Bild + Info zusammen
  const first = applyInfo(blank(), page(), 'page');
  assert.deepEqual(mergeSources(first, { image: image(), infos }, NOW).materials, f.materials);
  // alter Ablauf (Bild, dann Info) kommt zum selben Steckbrief
  assert.deepEqual(applyInfo(applyAnalysis(blank(), image(), NOW), page(), 'page').materials, f.materials);
});

test('Rangfolge: Etikett schlägt Shop, Begriffe im Namen schlagen das Bild, Shop-Stufen den Namen', () => {
  const f = mergeSources(blank(), { image: image(), infos: [{ from: 'label', info: label() }, { from: 'page', info: page() }] }, NOW);
  assert.deepEqual(f.materials, [{ name: 'cotton', pct: 92 }, { name: 'elastane', pct: 8 }]);
  assert.equal(f.shop, 'COS');
  assert.equal(f.size, 'M');
  // Name „Slim …“ (von der Seite) → Weite 0 statt Bildschätzung 2; Länge bleibt aus dem Bild
  assert.deepEqual(f.fit, { width: 0, length: 2, rise: null });
  // nennt die Seite selbst eine Weite, gilt die
  const g = mergeSources(blank(), { image: image(), infos: [{ from: 'page', info: page({ width: 3 }) }] }, NOW);
  assert.equal(g.fit.width, 3);
});

test('Rangfolge: bestätigter Nutzerwert schlägt alles', () => {
  let start = setField(blank(), 'materials', [{ name: 'linen', pct: 100 }]);
  start = setField(start, 'name', 'Mein Shirt');
  start = setField(start, 'fit', { width: 4, length: null, rise: null });
  const f = mergeSources(start, { image: image(), infos: [{ from: 'label', info: label() }, { from: 'page', info: page() }] }, NOW);
  assert.deepEqual(f.materials, [{ name: 'linen', pct: 100 }]);
  assert.equal(f.name, 'Mein Shirt');
  assert.deepEqual(f.fit, { width: 4, length: null, rise: null });
  for (const k of ['materials', 'name', 'fit']) assert.ok(!f.aiPending.includes(k));
  assert.deepEqual(f.colors, ['black']); // leeres Feld wird trotzdem gefüllt
});

test('meta.source: Bild allein oder mit der ranghöchsten Info', () => {
  assert.equal(applyAnalysis(blank(), image(), NOW).aiMeta?.source, 'image');
  assert.equal(mergeSources(blank(), { image: image(), infos: [{ from: 'page', info: page() }] }, NOW).aiMeta?.source, 'image+page');
  assert.equal(analysisSource([{ from: 'screenshot' }]), 'image+screenshot');
  assert.equal(analysisSource([{ from: 'page' }, { from: 'label' }]), 'image+label');
  assert.equal(infoSource(label()), 'label');
  assert.equal(infoSource(page()), 'screenshot');
  assert.equal(infoSource(label(), true), 'page');
  assert.equal(checkInfo({ kind: 'quatsch' }).kind, null);
});

test('Kontext für den Prompt: Fakten der Seite, Beschreibung gekürzt', () => {
  const text = infoContext([{ from: 'page', info: page() }], 'Schmal geschnittenes Rippshirt. ' + 'x'.repeat(3000));
  assert.match(text, /^Angaben des Shops, verlässlicher als das Foto:/);
  assert.match(text, /Kategorie: Oberteil › .*\(top\/shirt\)/);
  assert.match(text, /Material: 95 % Baumwolle \(cotton\), 5 % Elasthan \(elastane\)/);
  assert.match(text, /Farben: Schwarz \(black\)/);
  assert.match(text, /Passform: slim/);
  const desc = text.split('\n').find((l) => l.startsWith('Beschreibung: '))!;
  assert.equal(desc.length, 'Beschreibung: '.length + DESCRIPTION_MAX);
  assert.match(infoContext([{ from: 'label', info: label() }]), /^Angaben vom Etikett, verlässlicher als das Foto:/);
  assert.equal(infoContext([{ from: 'page', info: checkInfo({}) }]), '');
});

test('Neu analysieren: nur bestätigte Werte als Kontext', () => {
  let f = setField(blank(), 'materials', [{ name: 'wool', pct: 100 }]);
  f = { ...f, colors: ['navy'], aiPending: ['colors'] }; // Farbe nur vorgeschlagen
  const text = confirmedContext(f);
  assert.match(text, /^Vom Nutzer bestätigte Angaben/);
  assert.match(text, /Material: 100 % Wolle/);
  assert.doesNotMatch(text, /Farben/);
  assert.equal(confirmedContext(blank()), '');
});

// ---------- Prüfung 20.11.2026: Rangfolge über mehrere Aufrufe, Etikett-Felder, endgültige Kategorie ----------

test('Rangfolge über Aufrufe: „Neu analysieren“ ersetzt offene Etikett-Werte nicht (Herkunft in analysis.src)', () => {
  const withLabel = applyInfo(blank(), checkInfo({ kind: 'label', material_parts: [{ name: 'wool', pct: 80 }, { name: 'nylon', pct: 20 }], size: 'M' }));
  assert.ok(withLabel.aiPending.includes('materials'));
  assert.equal((withLabel.analysisBase.src as Record<string, string>).materials, 'label');
  const again = applyAnalysis(withLabel, checkAnalysis({ category: 'top/sweater', materials: ['cotton'], colors: ['navy'] }), NOW);
  assert.deepEqual(again.materials, [{ name: 'wool', pct: 80 }, { name: 'nylon', pct: 20 }]);
  assert.deepEqual(again.colors, ['navy']);
  // später ausgelesener Shop (Rang 2) ersetzt das offene Etikett (Rang 3) nicht, wohl aber ein neues Etikett
  const shop = applyInfo(again, checkInfo({ kind: 'shop', material_parts: [{ name: 'cotton', pct: 100 }], size: 'L' }));
  assert.equal(shop.materials[0]!.name, 'wool');
  const label2 = applyInfo(again, checkInfo({ kind: 'label', material_parts: [{ name: 'cashmere', pct: 100 }] }));
  assert.equal(label2.materials[0]!.name, 'cashmere');
});

test('Etikett liefert nur Marke, Material, Größe, Pflege, Artikelnummer – nie Farbe, Saison, Stil, Name', () => {
  const lab = checkInfo({ kind: 'label', name: 'Etikett', colors: ['white'], seasons: ['summer'], styles: ['casual'], brand: 'COS', material_parts: [{ name: 'wool', pct: 100 }] });
  const f = mergeSources(blank(), { image: checkAnalysis({ category: 'top/sweater', name: 'Strickpullover', colors: ['navy'], seasons: ['autumn', 'winter'] }), infos: [{ from: 'label', info: lab }] }, NOW);
  assert.equal(f.name, 'Strickpullover');
  assert.deepEqual(f.colors, ['navy']);
  assert.deepEqual(f.seasons, ['autumn', 'winter']);
  assert.equal(f.brand, 'COS');
  assert.equal(f.materials[0]!.name, 'wool');
  assert.ok(!infoContext([{ from: 'label', info: lab }]).includes('Weiß'));
});

test('Profil wird mit der endgültigen Kategorie bereinigt (Shop sagt Jeans, Bild sagt T-Shirt)', () => {
  const img = checkAnalysis({ category: 'top/t_shirt', colors: ['blue'], profile: { leg: 'tapered', denim_wash: 'dark', silhouette: 'boxy' } });
  assert.equal(img.profile.leg, 'tapered'); // checkAnalysis prüft nur Werte
  const shop = checkInfo({ kind: 'shop', category: 'pants/jeans', material_parts: [{ name: 'denim', pct: 100 }] });
  const f = mergeSources(blank(), { image: img, infos: [{ from: 'screenshot', info: shop }] }, NOW);
  assert.equal(f.category, 'pants');
  assert.equal(f.profile.leg, 'tapered');
  assert.equal(f.profile.denim_wash, 'dark');
  assert.equal(f.profile.silhouette, null);
  // ungültiger Pfad im Bild: Profil bleibt für die feststehende Kategorie erhalten
  const fixed = { ...blank(), category: 'pants', subcategory: 'jeans' };
  const g = applyAnalysis(fixed, checkAnalysis({ category: 'quatsch', colors: ['blue'], profile: { leg: 'straight', opacity: 'opaque' } }), NOW);
  assert.equal(g.profile.leg, 'straight'); assert.equal(g.profile.opacity, 'opaque');
});

test('Passform aus einer Info ohne Kategorie bleibt und schlägt die Begriffe im Namen', () => {
  const shot = checkInfo({ kind: 'shop', category: null, width: 3 });
  assert.equal(shot.item.fit.width, 3);
  const f = mergeSources({ ...blank(), name: 'Slim Jeans', category: 'pants', subcategory: 'jeans' }, { infos: [{ from: 'screenshot', info: shot }] });
  assert.equal(f.fit.width, 3);
  // ohne Info gewinnt der Name über das Bild
  const g = applyAnalysis({ ...blank(), name: 'Slim Jeans', category: 'pants', subcategory: 'jeans' }, checkAnalysis({ category: 'pants/jeans', width: 2, colors: ['blue'] }), NOW);
  assert.equal(g.fit.width, 0);
});

test('Zweiter Schritt bei „Neues Teil“: nur das Bild, keine zurückgedrehten Eingaben, bestätigte Größe bleibt', () => {
  const shop = checkInfo({ kind: 'shop', brand: 'Zara', category: 'top/shirt' });
  const step1 = mergeSources(blank(), { infos: [{ from: 'screenshot', info: shop }] });
  const edited = setField(setField(step1, 'brand', ''), 'size', 'L');
  const step2 = mergeSources(edited, { image: checkAnalysis({ category: 'shoe/sneaker', colors: ['white'] }), used: ['screenshot'] }, NOW);
  assert.equal(step2.brand, '');
  assert.equal(step2.category, 'top'); // Shop-Kategorie (Rang 2) schlägt das Bild
  assert.equal(step2.size, 'L');
  assert.equal(step2.aiMeta?.source, 'image+screenshot');
  // ohne Info: Bild-Kategorie darf die bestätigte Größe nicht leeren
  const own = setField({ ...blank(), category: null }, 'size', 'L');
  const h = applyAnalysis(own, checkAnalysis({ category: 'shoe/sneaker', colors: ['white'] }), NOW);
  assert.equal(h.category, 'shoe'); assert.equal(h.size, 'L');
});

test('Neu analysieren: bestätigte Passform verdrängt widersprechende Begriffe im Namen aus dem Kontext', () => {
  const f = { ...blank(), name: 'Slim Jeans', category: 'pants', subcategory: 'jeans', fit: { width: 2, length: null, rise: null } };
  const ctx = confirmedContext(f);
  assert.ok(ctx.includes('Weite normal'));
  assert.ok(!/slim/i.test(ctx.split('\n').find((l) => l.startsWith('Passform')) ?? ''));
});
