import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitFromName, nameFitFor } from '../src/fitName';
import { checkAnalysis, applyAnalysis, profilePatch } from '../src/ai/analyzeItem';
import { emptyEditForm, setField, setCategory, setName, confirmAi } from '../src/edit';

test('Name → Passform: Shop-Begriffe, ganze Wörter, Schreibweisen', () => {
  assert.deepEqual(fitFromName('Slim Ribbed Shirt'), { fit: { width: 0 } });
  assert.deepEqual(fitFromName('Oversized Hoodie'), { fit: { width: 4, length: 4 } });
  assert.deepEqual(fitFromName('Cropped Tee'), { fit: { length: 0 } });
  assert.deepEqual(fitFromName('High Waist Wide Leg Jeans'), { fit: { rise: 2, width: 4 } });
  assert.deepEqual(fitFromName('Tapered Chino'), { fit: {}, leg: 'tapered' });
  assert.deepEqual(fitFromName('Straight Leg Jeans'), { fit: {}, leg: 'straight' });
  assert.deepEqual(fitFromName('SLIM FIT Hemd').fit, { width: 0 });
  assert.deepEqual(fitFromName('Oversize Tee').fit, { width: 4, length: 4 });
  assert.deepEqual(fitFromName('Over-Sized Tee').fit, { width: 4, length: 4 });
  assert.deepEqual(fitFromName('wide-leg trousers').fit, { width: 4 });
  // nur ganze Wörter
  assert.deepEqual(fitFromName('Slimline Bag'), { fit: {} });
  assert.deepEqual(fitFromName(''), { fit: {} });
  assert.deepEqual(fitFromName(null), { fit: {} });
});

test('Name → Passform: nur Stufen der Kategorie, Kleidlänge bleibt unberührt', () => {
  assert.deepEqual(nameFitFor('top', { width: 4, length: 4, rise: 2 }), { width: 4, length: 4 });
  assert.deepEqual(nameFitFor('dress', { width: 4, length: 4 }), {});
  assert.deepEqual(nameFitFor('skirt', { rise: 2, length: 0 }), { rise: 2 });
  assert.deepEqual(nameFitFor('shoe', { width: 0 }), {});
});

const shirt = () => setCategory({ ...emptyEditForm({ ownerId: 'max' }), aiPending: [] }, { category: 'top', subcategory: 'shirt', type: null });

test('Analyse: Begriff im Namen schlägt die Foto-Schätzung (Name vom Nutzer oder Shop, nicht von der KI selbst)', () => {
  const a = checkAnalysis({ category: 'top/shirt', width: 2, length: 2 });
  const f = applyAnalysis(setField({ ...emptyEditForm({ ownerId: 'max' }), aiPending: [] }, 'name', 'Slim Ribbed Shirt'), a);
  assert.deepEqual(f.fit, { width: 0, length: 2, rise: null });
  assert.ok(f.aiPending.includes('fit'));
  // denselben Namen nur von der KI vorgeschlagen: zählt nicht (Prüfung 20.11.2026)
  const k = applyAnalysis({ ...emptyEditForm({ ownerId: 'max' }), aiPending: [] }, checkAnalysis({ category: 'top/shirt', name: 'Slim Ribbed Shirt', width: 2, length: 2 }));
  assert.deepEqual(k.fit, { width: 2, length: 2, rise: null });
  // eigener Name, KI schätzt nichts zur Passform
  const g = applyAnalysis(setField(shirt(), 'name', 'Oversized Hoodie'), checkAnalysis({ category: 'top/shirt' }));
  assert.deepEqual(g.fit, { width: 4, length: 4, rise: null });
  assert.ok(g.aiPending.includes('fit'));
});

test('Analyse: unbestätigte Passform wird ersetzt, bestätigte bleibt', () => {
  const pending = { ...setField(shirt(), 'name', 'Cropped Tee'), fit: { width: 2, length: 3, rise: null }, aiPending: ['fit'] };
  assert.deepEqual(applyAnalysis(pending, checkAnalysis({ category: 'top/shirt', width: 1, length: 4 })).fit, { width: 1, length: 0, rise: null });
  const confirmed = { ...pending, aiPending: [] };
  const f = applyAnalysis(confirmed, checkAnalysis({ category: 'top/shirt', width: 1, length: 4 }));
  assert.deepEqual(f.fit, { width: 2, length: 3, rise: null });
  assert.ok(!f.aiPending.includes('fit'));
});

test('Analyse: Hose mit Bund, Weite und Beinverlauf aus dem Namen', () => {
  const a = checkAnalysis({ category: 'pants/jeans', width: 2, rise: 1, profile: { leg: 'straight' } });
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
  assert.deepEqual(f.aiPending, ['fit']);
  // bestätigen, dann Name ändern: Passform bleibt
  const ok = confirmAi(f, 'fit');
  const g = setName(ok, 'Oversized Shirt');
  assert.deepEqual(g.fit, ok.fit);
  assert.deepEqual(g.aiPending, []);
  // selbst gewählte Passform bleibt ebenfalls
  const own = setField(shirt(), 'fit', { width: 2, length: 2, rise: null });
  assert.deepEqual(setName(own, 'Cropped Tee').fit, { width: 2, length: 2, rise: null });
  // ohne Begriff: nichts vorgeschlagen
  assert.deepEqual(setName(shirt(), 'Ribbed Shirt').aiPending, []);
});

test('Weitere Shop-Schreibweisen (Prüfung 20.11.2026)', () => {
  assert.deepEqual(fitFromName('Skinny Jeans').fit, { width: 0 });
  assert.deepEqual(fitFromName('Slimfit Hemd').fit, { width: 0 });
  assert.deepEqual(fitFromName('High Rise Jeans').fit, { rise: 2 });
  assert.deepEqual(fitFromName('Highwaist Jeans').fit, { rise: 2 });
  assert.deepEqual(fitFromName('Loose Fit Jeans').fit, { width: 3 });
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
