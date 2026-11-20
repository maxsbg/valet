import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAnalysis, profileFilled } from '../src/ai/analyzeItem';
import { checkInfo, infoUsable } from '../src/ai/readInfo';
import { mergeSources, applyAnalysis, applyInfo, infoContext, confirmedContext, analysisSource, infoSource, DESCRIPTION_MAX, type SourceInfo } from '../src/ai/merge';
import { confirmAi, confirmAllAi, dropImageSuggestions, editChange, emptyEditForm, setCare, setCategory, setField, setName, toEditForm, type EditRow } from '../src/edit';

const NOW = '2026-11-19T11:00:00.000Z';
const blank = () => ({ ...emptyEditForm({ ownerId: 'max' }), aiPending: [] as string[] });
const image = () => checkAnalysis({
  category: 'top/shirt', name: 'Rippshirt', colors: ['navy'], materials: ['polyester'], width: 'regular', length: 'regular',
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
  // Name „Slim …“ (von der Seite) → Weite Slim statt Bildschätzung Regular; Länge bleibt aus dem Bild
  assert.deepEqual(f.fit, { width: 0, length: 1, rise: null });
  // nennt die Seite selbst eine Weite, gilt die
  const g = mergeSources(blank(), { image: image(), infos: [{ from: 'page', info: page({ width: 'relaxed' }) }] }, NOW);
  assert.equal(g.fit.width, 2);
});

test('Rangfolge: bestätigter Nutzerwert schlägt alles', () => {
  let start = setField(blank(), 'materials', [{ name: 'linen', pct: 100 }]);
  start = setField(start, 'name', 'Mein Shirt');
  start = setField(start, 'fit', { width: 3, length: null, rise: null });
  const f = mergeSources(start, { image: image(), infos: [{ from: 'label', info: label() }, { from: 'page', info: page() }] }, NOW);
  assert.deepEqual(f.materials, [{ name: 'linen', pct: 100 }]);
  assert.equal(f.name, 'Mein Shirt');
  assert.deepEqual(f.fit, { width: 3, length: null, rise: null });
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
  const shot = checkInfo({ kind: 'shop', category: null, width: 'relaxed' });
  assert.equal(shot.item.fit.width, 'relaxed');
  const f = mergeSources({ ...blank(), name: 'Slim Jeans', category: 'pants', subcategory: 'jeans' }, { infos: [{ from: 'screenshot', info: shot }] });
  assert.equal(f.fit.width, 3); // Hose: Relaxed = Stufe 3
  // ohne Info gewinnt der Name über das Bild
  const g = applyAnalysis({ ...blank(), name: 'Slim Jeans', category: 'pants', subcategory: 'jeans' }, checkAnalysis({ category: 'pants/jeans', width: 'regular', colors: ['blue'] }), NOW);
  assert.equal(g.fit.width, 1); // Hose: Slim = Stufe 1
});

test('Zweiter Schritt bei „Neues Teil“: nur das Bild, keine zurückgedrehten Eingaben, bestätigte Größe bleibt', () => {
  const shop = checkInfo({ kind: 'shop', brand: 'Zara', category: 'top/shirt' });
  const step1 = mergeSources(blank(), { infos: [{ from: 'screenshot', info: shop }] });
  const edited = setField(setField(step1, 'brand', ''), 'size', 'L');
  const step2 = mergeSources(edited, { image: checkAnalysis({ category: 'shoe/sneaker', colors: ['white'], profile: { sheen: 1 } }), used: ['screenshot'] }, NOW);
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
  assert.ok(ctx.includes('Weite Regular'));
  assert.ok(!/slim/i.test(ctx.split('\n').find((l) => l.startsWith('Passform')) ?? ''));
});

// ---------- Prüfung 20.11.2026, Runde 2 ----------

test('Pflege je Gruppe: vom Nutzer gesetzte Gruppen ersetzt kein Etikett, offene Vorschläge nur gleich- oder höherrangig', () => {
  const own = { ...blank(), care: { wash: { v: 'w30', src: 'hand' as const } } };
  const a = applyInfo(own, checkInfo({ kind: 'label', care: { dry: 'nodry' } }));
  assert.equal(a.care.dry?.v, 'nodry');
  const b = applyInfo(a, checkInfo({ kind: 'label', care: { wash: 'w60' } }));
  assert.equal(b.care.wash?.v, 'w30');
  // offener Etikett-Vorschlag: Shop ersetzt ihn nicht, ein neues Etikett schon
  const c = applyInfo(a, checkInfo({ kind: 'shop', care: { dry: 'drylow' } }));
  assert.equal(c.care.dry?.v, 'nodry');
  const d = applyInfo(a, checkInfo({ kind: 'label', care: { dry: 'drylow' } }));
  assert.equal(d.care.dry?.v, 'drylow');
  // geschätzte Pflege ersetzt jedes Etikett
  const e = applyInfo({ ...blank(), care: { wash: { v: 'w30', src: 'geschaetzt' as const } } }, checkInfo({ kind: 'label', care: { wash: 'w40' } }));
  assert.equal(e.care.wash?.v, 'w40');
});

test('Etikett ohne Shop, Preis, Kaufdatum (auch bei Wunschteilen)', () => {
  const lab = checkInfo({ kind: 'label', price: 29.99, list_price: 39.99, shop: 'H&M', purchase_date: '2026-11-01', article_no: '0815', size: 'M' });
  const f = applyInfo({ ...blank(), category: 'top', subcategory: 'shirt' }, lab);
  assert.equal(f.price, ''); assert.equal(f.listPrice, ''); assert.equal(f.shop, ''); assert.equal(f.purchaseDate, null);
  assert.equal(f.articleNo, '0815'); assert.equal(f.size, 'M');
  const w = applyInfo({ ...emptyEditForm({ ownerId: 'max', wish: { wishlistId: 'l1' } }), aiPending: [] }, lab);
  assert.equal(w.listPrice, '');
});

test('Zwei Schritte wie bei „Neues Teil“: Passform einer Info ohne Kategorie übersteht den Bild-Schritt und steht im Kontext', () => {
  const shot = checkInfo({ kind: 'shop', category: null, width: 'oversized' });
  const infos: SourceInfo[] = [{ from: 'screenshot', info: shot }];
  assert.match(infoContext(infos), /Passform: Weite Oversized/);
  const step1 = mergeSources(blank(), { infos });
  assert.equal(step1.fit.width, null); // noch keine Kategorie
  const step2 = mergeSources(step1, { image: checkAnalysis({ category: 'top/t_shirt', width: 'regular', colors: ['white'], profile: { sheen: 1 } }), late: infos }, NOW);
  assert.equal(step2.fit.width, 3);
  assert.equal(step2.aiMeta?.source, 'image+screenshot');
  // vom Nutzer in der Zwischenzeit gesetzte Passform bleibt
  const own = setField({ ...step1, category: 'top', subcategory: 't_shirt' }, 'fit', { width: 1, length: null, rise: null });
  assert.equal(mergeSources(own, { image: checkAnalysis({ category: 'top/t_shirt', width: 'regular' }), late: infos }, NOW).fit.width, 1);
});

test('Gespeichert wird nur die Herkunft noch offener Felder', () => {
  const a = applyInfo(blank(), checkInfo({ kind: 'shop', colors: ['red'], brand: 'COS' }));
  const ok = confirmAi(a, 'colors');
  const r = editChange({ ...ok, name: 'Teil' }, { isNew: true });
  assert.ok('change' in r);
  const src = (r.change.analysis as { src?: Record<string, string> }).src ?? {};
  assert.equal(src.colors, undefined); assert.equal(src.brand, 'screenshot');
  const none = editChange({ ...confirmAi(ok, 'brand'), name: 'Teil' }, { isNew: true });
  assert.ok('change' in none && !('src' in (none.change.analysis as object)));
});

test('Kategorie: genauerer Pfad derselben Richtung verfeinert, gröbere Angabe verdrängt ihn nicht', () => {
  const shop = checkInfo({ kind: 'shop', category: 'top' });
  const f = mergeSources(blank(), { image: checkAnalysis({ category: 'top/shirt/long_sleeve_shirt', colors: ['white'] }), infos: [{ from: 'page', info: shop }] }, NOW);
  assert.deepEqual([f.category, f.subcategory, f.type], ['top', 'shirt', 'long_sleeve_shirt']);
  // zwei Schritte: erst Shop „Schuh“, dann Bild „Sneaker“
  const s1 = applyInfo(blank(), checkInfo({ kind: 'shop', category: 'shoe' }));
  const s2 = applyAnalysis(s1, checkAnalysis({ category: 'shoe/sneaker', colors: ['white'] }), NOW);
  assert.deepEqual([s2.category, s2.subcategory], ['shoe', 'sneaker']);
  assert.equal((s2.analysisBase.src as Record<string, string>).category, 'screenshot');
  // echter Widerspruch geht nach Rang
  const s3 = applyAnalysis(s1, checkAnalysis({ category: 'top/shirt', colors: ['white'] }), NOW);
  assert.equal(s3.category, 'shoe');
});

test('Versteckte Felder: offene KI-Werte, die es für den endgültigen Pfad nicht gibt, fallen weg', () => {
  const shop = checkInfo({ kind: 'shop', category: 'pants/jeans' });
  const img = checkAnalysis({ category: 'top/shirt', collar: 'button_down', layers: [0, 1], closure: 'buttons', colors: ['blue'] });
  const f = mergeSources(blank(), { image: img, infos: [{ from: 'page', info: shop }] }, NOW);
  assert.equal(f.category, 'pants');
  assert.equal(f.collar, null); assert.deepEqual(f.layers, []); assert.equal(f.closure, null);
  for (const k of ['collar', 'layers', 'closure']) assert.ok(!f.aiPending.includes(k), k);
  // Ausschnitt aus einer Info ohne Kategorie bleibt, wenn das Formular schon ein T-Shirt ist
  const tee = applyInfo({ ...blank(), category: 'top', subcategory: 't_shirt' }, checkInfo({ kind: 'shop', collar: 'crew_neck' }));
  assert.equal(tee.collar, 'crew_neck');
});

test('Größe einer Info ohne Kategorie wird nach dem Bild mit dem endgültigen Pfad abgeglichen', () => {
  const order = checkInfo({ kind: 'order', size: '42' });
  const infos: SourceInfo[] = [{ from: 'screenshot', info: order }];
  const s1 = mergeSources(blank(), { infos });
  assert.equal(s1.size, null);
  const s2 = mergeSources(s1, { image: checkAnalysis({ category: 'shoe/sneaker', colors: ['white'] }), late: infos }, NOW);
  assert.equal(s2.size, '42'); assert.ok(s2.aiPending.includes('size'));
});

// ---------- Prüfung 20.11.2026, Runde 3 ----------

test('Begriffe im KI-erzeugten Namen zählen nicht als eigene Quelle', () => {
  const f = applyAnalysis(blank(), checkAnalysis({ category: 'top/sweater', name: 'Oversized Hoodie', width: 'regular', length: 'regular', colors: ['grey'] }), NOW);
  assert.deepEqual([f.fit.width, f.fit.length], [1, 1]);
  const jeans = applyAnalysis(blank(), checkAnalysis({ category: 'pants/jeans', name: 'Straight Leg Jeans', colors: ['blue'], profile: { leg: 'tapered' } }), NOW);
  assert.equal(jeans.profile.leg, 'tapered');
  // Name vom Shop dagegen schon
  const shop = mergeSources(blank(), { image: checkAnalysis({ category: 'pants/jeans', width: 'regular', colors: ['blue'], profile: { leg: 'tapered' } }),
    infos: [{ from: 'page', info: checkInfo({ name: 'Straight Leg Jeans', category: 'pants/jeans' }) }] }, NOW);
  assert.equal(shop.profile.leg, 'straight');
});

test('Kategorie-Herkunft je Ebene: Shop „Oberteil“ bestätigt nicht die Unterkategorie aus dem Bild', () => {
  const a = mergeSources(blank(), { image: checkAnalysis({ category: 'top/shirt', colors: ['white'] }), infos: [{ from: 'page', info: checkInfo({ category: 'top' }) }] }, NOW);
  assert.equal(a.subcategory, 'shirt');
  const b = applyAnalysis(a, checkAnalysis({ category: 'top/sweater', colors: ['white'] }), NOW);
  assert.deepEqual([b.category, b.subcategory], ['top', 'sweater']);
  assert.equal((b.analysisBase.src as Record<string, string>).category, 'page');
  // nennt der Shop die Unterkategorie selbst, bleibt sie
  const c = mergeSources(blank(), { infos: [{ from: 'page', info: checkInfo({ category: 'top/shirt' }) }] });
  assert.equal(applyAnalysis(c, checkAnalysis({ category: 'top/sweater', colors: ['white'] }), NOW).subcategory, 'shirt');
});

test('Offene Markierungen ohne Wert verschwinden (Größe nach Kategoriewechsel, Pflege bei Schuhen)', () => {
  const lab = applyInfo(blank(), checkInfo({ kind: 'label', size: 'M', care: { wash: 'w30' } }));
  assert.ok(lab.aiPending.includes('size') && lab.aiPending.includes('care'));
  const shoe = applyAnalysis(lab, checkAnalysis({ category: 'shoe/sneaker', colors: ['white'] }), NOW);
  assert.equal(shoe.size, null);
  assert.ok(!shoe.aiPending.includes('size'));
  assert.ok(!shoe.aiPending.includes('care'));
});

test('„Alle übernehmen“: Vorschläge gelten danach als bestätigt', () => {
  const f = confirmAllAi(applyAnalysis(blank(), checkAnalysis({ category: 'top/shirt', name: 'Oxford-Hemd', colors: ['white'] }), NOW));
  assert.deepEqual(f.aiPending, []);
  const again = applyAnalysis(f, checkAnalysis({ category: 'top/shirt', name: 'Hemd', colors: ['blue'] }), NOW);
  assert.equal(again.name, 'Oxford-Hemd'); assert.deepEqual(again.colors, ['white']);
});

// ---------- Prüfung 20.11.2026, Runde 4 ----------

test('Kategorie je Ebene: Shop-Unterkategorie bleibt nach Verfeinern durch das Bild und „Neu analysieren“', () => {
  const s1 = applyInfo(blank(), checkInfo({ category: 'top/shirt' }), 'page');
  const s2 = applyAnalysis(s1, checkAnalysis({ category: 'top/shirt/long_sleeve_shirt', colors: ['white'] }), NOW);
  assert.deepEqual([s2.subcategory, s2.type], ['shirt', 'long_sleeve_shirt']);
  const src = s2.analysisBase.src as Record<string, string>;
  assert.equal(src['category.sub'], 'page'); assert.equal(src['category.type'], 'image');
  const s3 = applyAnalysis(s2, checkAnalysis({ category: 'top/sweater', colors: ['white'] }), NOW);
  assert.equal(s3.subcategory, 'shirt');
  // der Typ (nur vom Bild) darf sich durch ein neues Bild ändern
  const s4 = applyAnalysis(s2, checkAnalysis({ category: 'top/shirt/short_sleeve_shirt', colors: ['white'] }), NOW);
  assert.equal(s4.type, 'short_sleeve_shirt');
});

test('Kategorie: echter Wechsel setzt die Herkunft aller Ebenen neu', () => {
  const a = mergeSources(blank(), { image: checkAnalysis({ category: 'top/shirt', colors: ['white'] }), infos: [{ from: 'page', info: checkInfo({ category: 'top' }) }] }, NOW);
  const b = applyInfo(a, checkInfo({ kind: 'shop', category: 'outerwear/biker_jacket' }));
  assert.equal(b.category, 'outerwear');
  const c = applyAnalysis(b, checkAnalysis({ category: 'outerwear/trucker_jacket', colors: ['black'] }), NOW);
  assert.equal(c.subcategory, 'biker_jacket');
});

test('Bearbeiten: Name ersetzt keine offene Shop-Stufe, vermerkt Herkunft „name“', () => {
  const shop = applyInfo({ ...blank(), category: 'pants', subcategory: 'jeans' }, checkInfo({ kind: 'shop', category: 'pants/jeans', width: 'wide' }));
  const f = setName(shop, 'High Waist Slim Jeans');
  assert.equal(f.fit.width, 4);
  assert.equal(f.fit.rise, 2);
  const src = f.analysisBase.src as Record<string, string>;
  assert.equal(src['fit.width'], 'screenshot'); assert.equal(src['fit.rise'], 'name');
});

// ---------- Prüfung 20.11.2026, Runde 5 ----------

test('Infos auf einen neueren Stand angewendet: Profil und Bildvorschläge bleiben', () => {
  const img = applyAnalysis(blank(), checkAnalysis({ category: 'top/sweater', colors: ['navy'], profile: { sheen: 2 } }), NOW);
  const f = applyInfo(img, checkInfo({ kind: 'label', material_parts: [{ name: 'wool', pct: 100 }] }));
  assert.equal(f.profile.sheen, 2); assert.equal(f.aiMeta?.v, 2); assert.deepEqual(f.colors, ['navy']);
  assert.equal(f.materials[0]!.name, 'wool');
});

test('Kategoriewechsel in Bearbeiten räumt offene KI-Werte in versteckten Feldern weg', () => {
  const f = applyAnalysis(blank(), checkAnalysis({ colors: ['blue'], layers: [1] }), NOW);
  assert.deepEqual(f.layers, [1]);
  const bag = setCategory(f, { category: 'bag', subcategory: null, type: null });
  assert.deepEqual(bag.layers, []); assert.ok(!bag.aiPending.includes('layers'));
  // bestätigte Werte bleiben gespeichert
  const own = setCategory(setField(blank(), 'layers', [1]), { category: 'bag', subcategory: null, type: null });
  assert.deepEqual(own.layers, [1]);
});

test('Pflege: neue Gruppe zu bestätigter Pflege wird einzeln markiert, die bestätigten bleiben bestätigt', () => {
  const own = { ...blank(), care: { wash: { v: 'w30', src: 'etikett' as const } } };
  const f = applyInfo(own, checkInfo({ kind: 'label', care: { dry: 'nodry' } }));
  assert.ok(!f.aiPending.includes('care'));
  assert.ok(f.aiPending.includes('care.dry'));
  assert.equal(f.care.wash?.v, 'w30'); assert.equal(f.care.dry?.v, 'nodry');
  // ein späteres Etikett darf die offene Gruppe ersetzen, nicht die bestätigte
  const g = applyInfo(f, checkInfo({ kind: 'label', care: { dry: 'drylow', wash: 'w60' } }));
  assert.equal(g.care.dry?.v, 'drylow'); assert.equal(g.care.wash?.v, 'w30');
  const r = editChange({ ...g, name: 'Teil' }, { isNew: true });
  assert.ok('change' in r);
  assert.equal(((r.change.analysis as { src: Record<string, string> }).src)['care.dry'], 'label');
});

// ---------- Prüfung 20.11.2026, Runde 6 ----------

test('Antwort ohne Mode-Profil: Fakten ja, aber kein „analysiert“ (meta bleibt)', () => {
  const a = checkAnalysis({ category: 'top', colors: ['navy'] });
  assert.equal(profileFilled(a), false);
  const f = applyAnalysis(blank(), a, NOW);
  assert.deepEqual(f.colors, ['navy']);
  assert.equal(f.aiMeta, blank().aiMeta);
});

test('Kategoriewechsel verwirft offene Längen-Stufe mit anderer Bedeutung (kurz–lang ↔ Mini–Maxi)', () => {
  const img = applyAnalysis(blank(), checkAnalysis({ category: 'top/t_shirt', length: 'longline', width: 'regular', colors: ['white'], profile: { sheen: 1 } }), NOW);
  const dress = applyInfo(img, checkInfo({ kind: 'shop', category: 'dress' }));
  assert.equal(dress.category, 'dress');
  assert.equal(dress.fit.length, null);
});

test('Name ändern: Stufen aus einem früheren Namen fallen weg; Kategorie danach schlägt aus dem Namen vor', () => {
  const tee = setName({ ...blank(), category: 'top', subcategory: 't_shirt' }, 'Oversized Tee');
  assert.deepEqual([tee.fit.width, tee.fit.length], [3, 2]);
  const relaxed = setName(tee, 'Relaxed Tee');
  assert.deepEqual([relaxed.fit.width, relaxed.fit.length], [2, null]);
  const plain = setName(relaxed, 'Tee');
  assert.equal(plain.fit.width, null); assert.ok(!plain.aiPending.includes('fit'));
  const chino = setCategory(setName(blank(), 'Slim Fit Chino'), { category: 'pants', subcategory: 'trousers', type: null });
  assert.equal(chino.fit.width, 1); assert.ok(chino.aiPending.includes('fit'));
});

test('Pflege: gleicher Wert aus ranghöherer Quelle stuft die Herkunft hoch', () => {
  const s = applyInfo(blank(), checkInfo({ kind: 'shop', care: { wash: 'w30' } }));
  const l = applyInfo(s, checkInfo({ kind: 'label', care: { wash: 'w30' } }));
  assert.equal((l.analysisBase.src as Record<string, string>)['care.wash'], 'label');
  const p = applyInfo(l, checkInfo({ kind: 'shop', care: { wash: 'w40' } }), 'page');
  assert.equal(p.care.wash?.v, 'w30');
});

// ---------- Prüfung 20.11.2026, Runde 7 ----------

test('Infos mit gewählter Art prüfen: Shop-Angaben sind brauchbar, auch wenn die KI „Etikett“ meint', () => {
  const i = checkInfo({ kind: 'label', name: 'Oxford Shirt', colors: ['white'], price: 49.95, category: 'top/shirt' });
  assert.equal(infoUsable(i), false);
  assert.equal(infoUsable({ ...i, kind: 'shop' }), true);
});

test('Bearbeiten speichert analysis nur, wenn sich daran etwas geändert hat', () => {
  const img = confirmAllAi(applyAnalysis(setField(blank(), 'name', 'Hemd'), checkAnalysis({ category: 'top/shirt', colors: ['white'], profile: { sheen: 2 } }), NOW));
  const n = editChange(img, { isNew: true });
  assert.ok('change' in n && 'analysis' in n.change);
  // gespeichert und neu geladen → nur Notiz geändert: analysis bleibt unangetastet
  const loaded = toEditForm({ ...n.change, owner_ids: [], is_wish: false } as unknown as EditRow);
  const r = editChange(setField(loaded, 'notes', 'neu'));
  assert.ok('change' in r && !('analysis' in r.change), JSON.stringify('change' in r ? r.change.analysis : null));
});

test('Pflege ändern bestätigt nur die geänderte Gruppe', () => {
  const lab = applyInfo(blank(), checkInfo({ kind: 'label', care: { dry: 'nodry', iron: 'iron1' } }));
  assert.ok(lab.aiPending.includes('care'));
  const f = setCare(lab, { ...lab.care, dry: { v: 'drylow', src: 'hand' } });
  assert.ok(!f.aiPending.includes('care'));
  assert.ok(f.aiPending.includes('care.iron')); assert.ok(!f.aiPending.includes('care.dry'));
});

test('Foto gewechselt: Vorschläge aus dem alten Foto fallen weg, Shop-Werte und Bestätigtes bleiben', () => {
  const shop = applyInfo(blank(), checkInfo({ kind: 'shop', brand: 'COS' }));
  const img = applyAnalysis(setField(shop, 'notes', 'x'), checkAnalysis({ category: 'top/shirt', colors: ['white'], collar: 'button_down', profile: { sheen: 1 } }), NOW);
  const f = dropImageSuggestions(img);
  assert.equal(f.brand, 'COS'); assert.deepEqual(f.colors, []); assert.equal(f.collar, null); assert.equal(f.category, null);
  assert.equal(f.aiMeta, null); assert.equal(f.profile.sheen, null);
});

// ---------- Prüfung 20.11.2026, Runde 8 ----------

test('Fotowechsel: Pflege und Kategorie-Ebenen aus Shop/Etikett bleiben, nur Bild-Anteile fallen weg', () => {
  const shop = applyInfo(blank(), checkInfo({ kind: 'shop', category: 'top', care: { wash: 'w30' } }), 'page');
  const img = applyAnalysis(shop, checkAnalysis({ category: 'top/shirt/long_sleeve_shirt', colors: ['white'], profile: { sheen: 1 } }), NOW);
  const f = dropImageSuggestions(img);
  assert.equal(f.care.wash?.v, 'w30'); assert.ok(f.aiPending.includes('care'));
  assert.deepEqual([f.category, f.subcategory, f.type], ['top', null, null]);
  assert.deepEqual(f.colors, []);
});

test('Speichern ohne Änderung schreibt analysis nicht – auch bei Teilen ohne Profil oder mit offenen Vorschlägen', () => {
  const none = toEditForm({ name: 'Hemd', category: 'top', subcategory: 'shirt', analysis: null, owner_ids: [], is_wish: false } as unknown as EditRow);
  const r1 = editChange(setField(none, 'notes', 'x'));
  assert.ok('change' in r1 && !('analysis' in r1.change));
  const legacy = toEditForm({ name: 'Hemd', category: 'top', subcategory: 'shirt', analysis: { vdesc: 'alt' }, owner_ids: [], is_wish: false } as unknown as EditRow);
  const r2 = editChange(setField(legacy, 'notes', 'x'));
  assert.ok('change' in r2 && !('analysis' in r2.change));
  // v2-Teil mit offenen Vorschlägen: gespeichert, neu geladen, unverändert gespeichert → keine analysis
  const img = applyAnalysis(setField(blank(), 'name', 'Hemd'), checkAnalysis({ category: 'top/shirt', colors: ['white'], profile: { sheen: 2 } }), NOW);
  const n = editChange(img, { isNew: true });
  assert.ok('change' in n);
  const loaded = toEditForm({ ...n.change, owner_ids: [], is_wish: false } as unknown as EditRow);
  const r3 = editChange(setField(loaded, 'notes', 'x'));
  assert.ok('change' in r3 && !('analysis' in r3.change));
});

test('Leere Pfad-Teile der KI gelten als nicht angegeben', () => {
  assert.deepEqual(checkAnalysis({ category: 'top//' }).path, { category: 'top', subcategory: null, type: null });
});
