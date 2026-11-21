import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitFromName, nameFitFor } from '../src/fitName';
import { checkAnalysis, applyAnalysis, profilePatch } from '../src/ai/analyzeItem';
import { emptyEditForm, setField, setCategory, setName, confirmAi } from '../src/edit';

test('Name → Passform: Shop-Begriffe, ganze Wörter, Schreibweisen', () => {
  assert.deepEqual(fitFromName('Slim Ribbed Shirt'), { fit: { width: 'slim' } });
  assert.deepEqual(fitFromName('Oversized Hoodie'), { fit: { width: 'oversized', length: 'longline' } });
  assert.deepEqual(fitFromName('Cropped Tee'), { fit: { length: 'cropped' } });
  assert.deepEqual(fitFromName('High Waist Wide Leg Jeans'), { fit: { rise: 'high', width: 'wide' } });
  assert.deepEqual(fitFromName('Tapered Chino'), { fit: {}, leg: 'tapered' });
  assert.deepEqual(fitFromName('Straight Leg Jeans'), { fit: {}, leg: 'straight' });
  assert.deepEqual(fitFromName('SLIM FIT Hemd').fit, { width: 'slim' });
  assert.deepEqual(fitFromName('Oversize Tee').fit, { width: 'oversized', length: 'longline' });
  assert.deepEqual(fitFromName('Over-Sized Tee').fit, { width: 'oversized', length: 'longline' });
  assert.deepEqual(fitFromName('wide-leg trousers').fit, { width: 'wide' });
  // nur ganze Wörter
  assert.deepEqual(fitFromName('Slimline Bag'), { fit: {} });
  assert.deepEqual(fitFromName(''), { fit: {} });
  assert.deepEqual(fitFromName(null), { fit: {} });
});

test('Name → Passform: nur Stufen der Kategorie, Kleidlänge bleibt unberührt', () => {
  assert.deepEqual(nameFitFor('top', { width: 'oversized', length: 'longline', rise: 'high' }), { width: 3, length: 2 });
  assert.deepEqual(nameFitFor('dress', { width: 'oversized', length: 'longline' }), {});
  assert.deepEqual(nameFitFor('skirt', { rise: 'high', length: 'cropped' }), { rise: 2 });
  assert.deepEqual(nameFitFor('shoe', { width: 'slim' }), {});
});

const shirt = () => setCategory({ ...emptyEditForm({ ownerId: 'max' }), aiPending: [] }, { category: 'top', subcategory: 'shirt', type: null });

test('Analyse: Begriff im Namen schlägt die Foto-Schätzung (Name vom Nutzer oder Shop, nicht von der KI selbst)', () => {
  const a = checkAnalysis({ category: 'top/shirt', width: 'regular', length: 'regular' });
  const f = applyAnalysis(setField({ ...emptyEditForm({ ownerId: 'max' }), aiPending: [] }, 'name', 'Slim Ribbed Shirt'), a);
  assert.deepEqual(f.fit, { width: 0, length: 1, rise: null });
  assert.ok(f.aiPending.includes('fit'));
  // denselben Namen nur von der KI vorgeschlagen: zählt nicht (Prüfung 20.11.2026)
  const k = applyAnalysis({ ...emptyEditForm({ ownerId: 'max' }), aiPending: [] }, checkAnalysis({ category: 'top/shirt', name: 'Slim Ribbed Shirt', width: 'regular', length: 'regular' }));
  assert.deepEqual(k.fit, { width: 1, length: 1, rise: null });
  // eigener Name, KI schätzt nichts zur Passform
  const g = applyAnalysis(setField(shirt(), 'name', 'Oversized Hoodie'), checkAnalysis({ category: 'top/shirt' }));
  assert.deepEqual(g.fit, { width: 3, length: 2, rise: null });
  assert.ok(g.aiPending.includes('fit'));
});

test('Analyse: unbestätigte Passform wird ersetzt, bestätigte bleibt', () => {
  const pending = { ...setField(shirt(), 'name', 'Cropped Tee'), fit: { width: 2, length: 1, rise: null }, aiPending: ['fit'] };
  assert.deepEqual(applyAnalysis(pending, checkAnalysis({ category: 'top/shirt', width: 'slim', length: 'longline' })).fit, { width: 0, length: 0, rise: null });
  const confirmed = { ...pending, aiPending: [] };
  const f = applyAnalysis(confirmed, checkAnalysis({ category: 'top/shirt', width: 'slim', length: 'longline' }));
  assert.deepEqual(f.fit, { width: 2, length: 1, rise: null });
  assert.ok(!f.aiPending.includes('fit'));
});

test('Analyse: Hose mit Bund, Weite und Beinverlauf aus dem Namen', () => {
  const a = checkAnalysis({ category: 'pants/jeans', width: 'regular', rise: 'regular', profile: { leg: 'straight' } });
  const named = (n: string) => setField({ ...emptyEditForm({ ownerId: 'max' }), aiPending: [] }, 'name', n);
  const f = applyAnalysis(named('High Waist Wide Leg Jeans'), a);
  assert.deepEqual(f.fit, { width: 4, length: null, rise: 2 });
  const t = applyAnalysis(named('Tapered Chino'), checkAnalysis({ category: 'pants/trousers/chino', profile: { leg: 'straight' } }));
  assert.equal(t.profile.leg, 'tapered');
  // Oberteil hat keinen Beinverlauf
  const s = applyAnalysis(shirt(), checkAnalysis({ category: 'top/shirt', name: 'Tapered Shirt' }));
  assert.equal(s.profile.leg, null);
});

test('Stapellauf: Beinverlauf aus dem gespeicherten Namen', () => {
  const row = { category: 'pants', subcategory: 'trousers', pattern: null, materials: [], analysis: null, ai_pending: [], name: 'Tapered Chino' };
  const a = checkAnalysis({ category: 'pants/trousers/chino', profile: { leg: 'straight' } });
  const p = profilePatch(row, a).analysis.profile as { leg: string | null };
  assert.equal(p.leg, 'tapered');
  const q = profilePatch({ ...row, name: 'Chino' }, a).analysis.profile as { leg: string | null };
  assert.equal(q.leg, 'straight');
});

test('Bearbeiten: Name schlägt Passform nur vor, bestätigte bleibt', () => {
  const f = setName(shirt(), 'Slim Ribbed Shirt');
  assert.deepEqual(f.fit, { width: 0, length: null, rise: null });
  assert.deepEqual(f.aiPending.filter((k) => k !== 'closure'), ['fit']); // Verschluss aus dem Typ (Regel)
  // bestätigen, dann Name ändern: Passform bleibt
  const ok = confirmAi(f, 'fit');
  const g = setName(ok, 'Oversized Shirt');
  assert.deepEqual(g.fit, ok.fit);
  assert.deepEqual(g.aiPending.filter((k) => k !== 'closure'), []);
  // selbst gewählte Passform bleibt ebenfalls
  const own = setField(shirt(), 'fit', { width: 2, length: 1, rise: null });
  assert.deepEqual(setName(own, 'Cropped Tee').fit, { width: 2, length: 1, rise: null });
  // ohne Begriff: nichts vorgeschlagen
  assert.deepEqual(setName(shirt(), 'Ribbed Shirt').aiPending.filter((k) => k !== 'closure'), []);
});

test('Weitere Shop-Schreibweisen (Prüfung 20.11.2026)', () => {
  assert.deepEqual(fitFromName('Skinny Jeans').fit, { width: 'skinny' });
  assert.deepEqual(fitFromName('Slimfit Hemd').fit, { width: 'slim' });
  assert.deepEqual(fitFromName('High Rise Jeans').fit, { rise: 'high' });
  assert.deepEqual(fitFromName('Highwaist Jeans').fit, { rise: 'high' });
  assert.deepEqual(fitFromName('Loose Fit Jeans').fit, { width: 'relaxed' });
  assert.equal(fitFromName('Bootcut Jeans').leg, 'flared');
  assert.equal(fitFromName('Flared Jeans').leg, 'flared');
  assert.equal(fitFromName('Straight Fit Jeans').leg, 'straight');
});

test('profilePatch liest Altkategorie tolerant, Name nur, wenn er keine offene Bildschätzung ist', () => {
  const a = checkAnalysis({ category: 'pants/jeans', profile: { leg: 'tapered' } });
  const own = profilePatch({ category: 'Hose', subcategory: null, pattern: null, materials: [], analysis: null, ai_pending: [], name: 'Straight Leg Jeans' }, a);
  assert.equal((own.analysis.profile as { leg: string }).leg, 'straight');
  const aiName = profilePatch({ category: 'pants', subcategory: 'jeans', pattern: null, materials: [], analysis: null, ai_pending: ['name'], name: 'Straight Leg Jeans' }, a);
  assert.equal((aiName.analysis.profile as { leg: string }).leg, 'tapered');
});

import { convertFit, fitIndex, FIT_SCALES } from '../src/categories';

test('Passform-Begriffe: Skalen je Kategorie, Ersatzbegriffe, Umrechnen beim Kategoriewechsel', () => {
  assert.deepEqual(FIT_SCALES.top!.map((sc) => sc.steps), [['Slim', 'Regular', 'Relaxed', 'Oversized'], ['Cropped', 'Regular', 'Longline']]);
  assert.deepEqual(FIT_SCALES.pants![0]!.steps, ['Skinny', 'Slim', 'Regular', 'Relaxed', 'Wide']);
  assert.deepEqual(FIT_SCALES.shorts!.map((sc) => sc.steps).slice(0, 2), [['Slim', 'Regular', 'Relaxed', 'Wide'], ['Short', 'Mid', 'Long']]);
  assert.equal(fitIndex('top', 'width', 'wide'), 3); // Oversized
  assert.equal(fitIndex('top', 'width', 'skinny'), 0); // Slim
  assert.equal(fitIndex('shorts', 'length', 'regular'), 1); // Mid
  assert.equal(fitIndex('dress', 'length', 'cropped'), null);
  // Oberteil Relaxed → Hose Relaxed, Oberteil Oversized → Hose Wide, Longline → Stacked (Hosenlänge seit 21.11.2026: Cropped · Ankle · Regular · Stacked)
  assert.deepEqual(FIT_SCALES.pants![1]!.steps, ['Cropped', 'Ankle', 'Regular', 'Stacked']);
  assert.deepEqual(convertFit('top', 'pants', { width: 2, length: 2, rise: null }), { width: 3, length: 3, rise: null });
  assert.equal(fitIndex('pants', 'length', 'long'), 3); // alte KI-Antwort „long“ → Stacked
  assert.deepEqual(convertFit('top', 'pants', { width: 3, length: null, rise: null }), { width: 4, length: null, rise: null });
  // Hose Skinny → Oberteil Slim; Bund gibt es beim Oberteil nicht → bleibt versteckt gespeichert
  assert.deepEqual(convertFit('pants', 'top', { width: 0, length: 0, rise: 2 }), { width: 0, length: 0, rise: 2 });
  // Länge Cropped gibt es beim Kleid nicht → leer; Weite hat das Kleid nicht → bleibt
  assert.deepEqual(convertFit('top', 'dress', { width: 1, length: 0, rise: null }), { width: 1, length: null, rise: null });
  // ohne Kategorie vorher bleibt alles
  assert.deepEqual(convertFit(null, 'top', { width: 3, length: null, rise: null }), { width: 3, length: null, rise: null });
});

import { legFromName } from '../src/ai/merge';
import { emptyProfile } from '../src/ai/profile';
test('Saum aus dem Namen (Max, 21.11.2026)', () => {
  assert.equal(fitFromName('OPEN LEG JOGGER').hem, 'open');
  assert.equal(fitFromName('Cuffed Sweatpants').hem, 'cuffed');
  assert.equal(fitFromName('Chino mit Umschlag').hem, 'turn_up');
  const ctx = { category: 'pants', sub: 'sweatpants', pattern: null, materials: [] };
  assert.equal(legFromName(emptyProfile(), 'OPEN LEG JOGGER', ctx).hem, 'open');
  assert.equal(legFromName(emptyProfile(), 'OPEN LEG SHORTS', { ...ctx, category: 'shorts' }).hem, null); // nur Hosen
});
