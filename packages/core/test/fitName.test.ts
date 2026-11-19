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

test('Analyse: Begriff im Namen schlägt die Foto-Schätzung', () => {
  const a = checkAnalysis({ category: 'top/shirt', name: 'Slim Ribbed Shirt', width: 2, length: 2 });
  const f = applyAnalysis({ ...emptyEditForm({ ownerId: 'max' }), aiPending: [] }, a);
  assert.deepEqual(f.fit, { width: 0, length: 2, rise: null });
  assert.ok(f.aiPending.includes('fit'));
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
  const a = checkAnalysis({ category: 'pants/jeans', name: 'High Waist Wide Leg Jeans', width: 2, rise: 1, profile: { leg: 'straight' } });
  const f = applyAnalysis({ ...emptyEditForm({ ownerId: 'max' }), aiPending: [] }, a);
  assert.deepEqual(f.fit, { width: 4, length: null, rise: 2 });
  const t = applyAnalysis({ ...emptyEditForm({ ownerId: 'max' }), aiPending: [] }, checkAnalysis({ category: 'pants/trousers/chino', name: 'Tapered Chino', profile: { leg: 'straight' } }));
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
