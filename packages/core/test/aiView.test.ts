import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyEditForm, toEditForm, type EditForm } from '../src/edit';
import { analysisUsable, checkAnalysis } from '../src/ai/analyzeItem';
import { emptyProfile } from '../src/ai/profile';
import {
  analysisNote, analysisSections, batchErrorKind, kiMessage, batchPending, batchSkipped, batchSummary, batchUsed, failedPatch, fitWords, hasProfile, reanalysisChange, storedMeta,
} from '../src/ai/view';

const META = { v: 2, prompt: '2.0', model: 'gemini-3.5-flash-lite', at: '2026-11-19T11:00:00Z' };
const form = (p: Partial<EditForm> = {}): EditForm => ({ ...emptyEditForm({ ownerId: 'max' }), name: 'Teil', ...p });

test('Passform: Jeans „Tapered · Regular · Long · Hoch“', () => {
  const f = form({ category: 'pants', subcategory: 'jeans', fit: { width: 2, length: 2, rise: 2 }, profile: { ...emptyProfile(), leg: 'tapered', silhouette: 'boxy' } });
  assert.deepEqual(fitWords(f), ['Tapered', 'Regular', 'Long', 'Hoch']);
});

test('Passform: Schulter nur, wenn nicht natürlich; Leeres entfällt', () => {
  const p = { ...emptyProfile(), silhouette: 'boxy', shoulder: 'natural' };
  assert.deepEqual(fitWords(form({ category: 'top', subcategory: 'sweater', fit: { width: 3, length: null, rise: null }, profile: p })), ['Boxy', 'Oversized']);
  assert.deepEqual(fitWords(form({ category: 'top', subcategory: 'sweater', profile: { ...p, shoulder: 'dropped' } })), ['Boxy', 'Dropped']);
  assert.deepEqual(fitWords(form({ category: 'shoe', profile: p })), []);
});

test('Blatt: Details/Tragen plus dieselben anwendbaren Profilfelder wie im Editor', () => {
  const base = form({ category: 'top', subcategory: 'sweater', pattern: 'solid', styles: ['classic'], layers: [1, 0], warmth: 2,
    profile: { ...emptyProfile(), sheen: 1, surface: 'fine_knit', formality: [2, 4], leg: 'tapered', silhouette: 'straight' },
    confidence: { category: 10, color: 9, material: 7, surface: 5, shape: 9, style: 8 } });
  const noProfile = analysisSections({ ...base, profile: emptyProfile() });
  assert.deepEqual(noProfile.map((s) => s.title), ['Details', 'Tragen', 'Form', 'Oberfläche', 'Wirkung']);
  assert.ok(noProfile[0]!.rows.some((r) => r.label === 'Stil' && r.value === 'Klassisch'));
  assert.deepEqual(noProfile[1]!.rows.find((r) => r.label === 'Lagen')?.value, 'Basis · Mittellage');
  const emptySurface = noProfile.find((s) => s.key === 'surface')!;
  assert.ok(emptySurface.rows.some((r) => r.label === 'Glanz' && r.value === 'Noch nicht angegeben'));
  assert.ok(!emptySurface.rows.some((r) => r.label === 'Mustergröße'));

  const s = analysisSections({ ...base, analysisBase: { meta: META } });
  assert.deepEqual(s.map((x) => x.title), ['Details', 'Tragen', 'Form', 'Oberfläche', 'Wirkung']);
  const surface = s.find((x) => x.key === 'surface')!;
  assert.equal(surface.weak, true);
  assert.deepEqual(surface.rows, [
    { label: 'Glanz', value: 'matt' }, { label: 'Struktur', value: 'Noch nicht angegeben' },
    { label: 'Optisches Gewicht', value: 'Noch nicht angegeben' }, { label: 'Stoffbild', value: 'Feinstrick' },
    { label: 'Transparenz', value: 'Noch nicht angegeben' },
  ]);
  // Beinverlauf gilt nicht für Oberteile → nie angezeigt
  assert.ok(!s.find((x) => x.key === 'shape')!.rows.some((r) => r.label === 'Beinverlauf'));
  assert.deepEqual(s.find((x) => x.key === 'style')!.rows, [
    { label: 'Auffälligkeit', value: 'Noch nicht angegeben' }, { label: 'Vielseitigkeit', value: 'Noch nicht angegeben' },
    { label: 'Formalität', value: 'Casual bis Business' }, { label: 'Eindruck', value: 'Noch nicht angegeben' },
  ]);
  assert.ok(s.find((x) => x.key === 'shape')!.rows.some((r) => r.label === 'Silhouette'));
});

test('Meta: Hinweiszeile, Profil erkannt, tolerant', () => {
  assert.equal(analysisNote({ meta: META }), 'Analysiert am 19.11.2026 mit gemini-3.5-flash-lite');
  assert.equal(analysisNote({ meta: { v: 1 } }), '');
  assert.equal(hasProfile(null), false);
  assert.equal(storedMeta('x'), null);
});

test('Stapellauf: offen, übersprungen, Fehlversuche, Tageszähler', () => {
  assert.equal(batchPending(null), true);
  assert.equal(batchPending({ meta: META }), false);
  let a: Record<string, unknown> = { vdesc: 'alt' };
  for (let i = 0; i < 3; i++) a = failedPatch(a, '2026-11-19T12:00:00Z').analysis;
  assert.deepEqual(a, { vdesc: 'alt', meta: { failed: { n: 3, at: '2026-11-19T12:00:00Z' } } });
  assert.equal(batchPending(a), false);
  assert.equal(batchSkipped(a), true);
  assert.equal(batchUsed({ day: '2026-11-18', n: 40 }, '2026-11-19'), 0);
  assert.equal(batchUsed({ day: '2026-11-19', n: 40 }, '2026-11-19'), 40);
  assert.equal(batchSummary(1, 0, 0), '1 Teil ergänzt, 0 übersprungen');
  assert.equal(batchSummary(3, 2, 1), '3 Teile ergänzt, 2 fehlgeschlagen, 1 übersprungen');
});

test('Neu analysieren: nur Geändertes, leere Felder gefüllt, Profil ersetzt, failed weg', () => {
  const row = { name: 'Pulli', category: 'top', subcategory: 'sweater', colors: ['navy'], pattern: null, materials: [], ai_pending: [],
    analysis: { vdesc: 'alt', meta: { failed: { n: 2, at: 'x' } } } };
  const f = toEditForm(row);
  const a = checkAnalysis({ category: 'top/sweater', colors: ['red'], pattern: 'solid', profile: { surface: 'fine_knit' }, confidence: { shape: 9 } }, 'gemini');
  const c = reanalysisChange(f, { ...row, materials: [] }, a, '2026-11-19T12:00:00Z');
  assert.equal(c.pattern, 'solid');
  assert.equal('colors' in c, false); // Farbe war gesetzt → bleibt
  assert.equal('name' in c, false);
  const an = c.analysis as Record<string, unknown>;
  assert.equal(an.vdesc, 'alt');
  assert.deepEqual(an.meta, { v: 2, prompt: '2.0', model: 'gemini', at: '2026-11-19T12:00:00Z', source: 'image' });
  assert.equal((an.profile as Record<string, unknown>).surface, 'fine_knit');
  // ohne Namen scheitert der normale Weg → nur das Profil
  const g = reanalysisChange(toEditForm({ ...row, name: '' }), { ...row, materials: [] }, a, '2026-11-19T12:00:00Z');
  assert.deepEqual(Object.keys(g), ['analysis']);
});

test('Prüfung 20.11.2026: Passform nur Wörter (wie Spec), Datum in Ortszeit, Fehlerarten im Stapellauf', () => {
  const jeans = { ...emptyEditForm({ ownerId: 'max' }), category: 'pants', subcategory: 'jeans', fit: { width: 2, length: 1, rise: 1 } };
  assert.deepEqual(fitWords(jeans), ['Regular', 'Regular', 'Normal']);
  assert.deepEqual(fitWords({ ...jeans, fit: { width: 2, length: 2, rise: 2 } }), ['Regular', 'Long', 'Hoch']);
  const at = new Date(2026, 10, 20, 0, 30).toISOString(); // 00:30 Ortszeit
  assert.match(analysisNote({ meta: { v: 2, model: 'm', at } }), /am 20\.11\.2026/);
  assert.equal(batchErrorKind('rate_limited', 429), 'pause');
  assert.equal(batchErrorKind('', null), 'pause'); // kein Netz
  assert.equal(batchErrorKind('AI request failed', 502), 'pause');
  assert.equal(batchErrorKind('', 404), 'fail');
  assert.equal(batchErrorKind('empty_answer', null), 'fail');
  assert.equal(batchErrorKind('model_rejected', 422), 'fail');
});

test('Leere KI-Antwort taugt nicht als Analyse', () => {
  assert.equal(analysisUsable(checkAnalysis({})), false);
  assert.equal(analysisUsable(checkAnalysis('Quatsch')), false);
  assert.equal(analysisUsable(checkAnalysis({ colors: ['navy'] })), true);
  assert.equal(analysisUsable(checkAnalysis({ profile: { sheen: 2 } })), true);
});

test('Blatt: Altmuster an einem Schuh zeigt keine Musterzeilen', () => {
  const shoe = { ...emptyEditForm({ ownerId: 'max' }), category: 'shoe', subcategory: 'sneaker', pattern: 'striped',
    profile: { ...emptyProfile(), pattern_contrast: 4, pattern_scale: 'fine', sheen: 1 }, analysisBase: { meta: { v: 2 } } };
  const rows = analysisSections(shoe).flatMap((s) => s.rows.map((r) => r.label));
  assert.ok(!rows.includes('Musterkontrast') && !rows.includes('Mustergröße'));
  assert.ok(rows.includes('Glanz'));
});

test('Fehlertexte der KI auf Deutsch, abgelaufene Anmeldung pausiert den Stapellauf', () => {
  assert.equal(batchErrorKind('', 401), 'pause');
  assert.equal(batchErrorKind('', 403), 'pause');
  for (const [c, s] of [['rate_limited', 429], ['empty_answer', null], ['', 404], ['', 413], ['AI request failed', 502], ['', null], ['', 401]] as const) {
    const m = kiMessage(c, s);
    assert.ok(m && !/AI request|bucket|rate_limited|empty_answer/.test(m), m);
  }
});

test('Einstellungsfehler der KI pausieren, 4xx bekommt einen eigenen Satz', () => {
  assert.equal(batchErrorKind('config_error', 503), 'pause');
  assert.match(kiMessage('config_error', 503), /eingerichtet/);
  assert.match(kiMessage('', 400), /ungültig/);
});

import { reviewKey, reviewOpen, skipReviewChange, withReview } from '../src/ai/view';
test('KI-Ergebnisse prüfen: offen, Reihenfolge, Überspringen ans Ende', () => {
  const a = withReview({ profile: {} }, { state: 'open', at: '2026-11-20T10:00:00Z' });
  const b = withReview({}, { state: 'open', at: '2026-11-20T11:00:00Z' });
  assert.ok(reviewOpen(a) && !reviewOpen({}) && !reviewOpen(withReview({}, { state: 'done', at: 'x' })));
  assert.ok(reviewKey(a) < reviewKey(b));
  const skipped = skipReviewChange(a, '2026-11-20T12:00:00Z').analysis;
  assert.ok(reviewOpen(skipped) && reviewKey(b) < reviewKey(skipped));
  assert.deepEqual((skipped as { profile: unknown }).profile, {});
});
