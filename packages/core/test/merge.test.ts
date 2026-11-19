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
