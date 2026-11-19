import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyEditForm, toEditForm, type EditForm } from '../src/edit';
import { checkAnalysis } from '../src/ai/analyzeItem';
import { emptyProfile } from '../src/ai/profile';
import {
  analysisNote, analysisSections, batchPending, batchSkipped, batchSummary, batchUsed, failedPatch, fitWords, hasProfile, reanalysisChange, storedMeta,
} from '../src/ai/view';

const META = { v: 2, prompt: '2.0', model: 'gemini-3.5-flash-lite', at: '2026-11-19T11:00:00Z' };
const form = (p: Partial<EditForm> = {}): EditForm => ({ ...emptyEditForm({ ownerId: 'max' }), name: 'Teil', ...p });

test('Passform: Jeans „Zulaufend · Normal · Lang · Hoch“', () => {
  const f = form({ category: 'pants', subcategory: 'jeans', fit: { width: 2, length: 4, rise: 2 }, profile: { ...emptyProfile(), leg: 'tapered', silhouette: 'boxy' } });
  assert.deepEqual(fitWords(f), ['Zulaufend', 'Normal', 'Lang', 'Hoch']);
});

test('Passform: Schulter nur, wenn nicht natürlich; Leeres entfällt', () => {
  const p = { ...emptyProfile(), silhouette: 'boxy', shoulder: 'natural' };
  assert.deepEqual(fitWords(form({ category: 'top', subcategory: 'sweater', fit: { width: 3, length: null, rise: null }, profile: p })), ['Kastig', 'Eher weit']);
  assert.deepEqual(fitWords(form({ category: 'top', subcategory: 'sweater', profile: { ...p, shoulder: 'dropped' } })), ['Kastig', 'Überschnitten']);
  assert.deepEqual(fitWords(form({ category: 'shoe', profile: p })), []);
});

test('Blatt: Details/Tragen aus dem Steckbrief, Profil nur mit meta.v 2', () => {
  const base = form({ category: 'top', subcategory: 'sweater', pattern: 'solid', styles: ['classic'], layers: [1, 0], warmth: 2,
    profile: { ...emptyProfile(), sheen: 1, surface: 'fine_knit', formality: [2, 4], leg: 'tapered', silhouette: 'straight' },
    confidence: { category: 10, color: 9, material: 7, surface: 5, shape: 9, style: 8 } });
  const noProfile = analysisSections(base);
  assert.deepEqual(noProfile.map((s) => s.title), ['Details', 'Tragen']);
  assert.ok(noProfile[0]!.rows.some((r) => r.label === 'Stil' && r.value === 'Klassisch'));
  assert.deepEqual(noProfile[1]!.rows.find((r) => r.label === 'Lagen')?.value, 'Unterlage · Mitte, zu');

  const s = analysisSections({ ...base, analysisBase: { meta: META } });
  assert.deepEqual(s.map((x) => x.title), ['Details', 'Tragen', 'Form', 'Oberfläche', 'Wirkung']);
  const surface = s.find((x) => x.key === 'surface')!;
  assert.equal(surface.weak, true);
  assert.deepEqual(surface.rows, [{ label: 'Glanz', value: '1 von 5' }, { label: 'Oberfläche', value: 'Feinstrick' }]);
  // Beinverlauf gilt nicht für Oberteile → nie angezeigt
  assert.ok(!s.find((x) => x.key === 'shape')!.rows.some((r) => r.label === 'Beinverlauf'));
  assert.deepEqual(s.find((x) => x.key === 'style')!.rows, [{ label: 'Formalität', value: '2–4' }]);
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
  assert.equal(batchSummary(1, 0), '1 Teil ergänzt, 0 übersprungen');
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
  assert.deepEqual(an.meta, { v: 2, prompt: '2.0', model: 'gemini', at: '2026-11-19T12:00:00Z' });
  assert.equal((an.profile as Record<string, unknown>).surface, 'fine_knit');
  // ohne Namen scheitert der normale Weg → nur das Profil
  const g = reanalysisChange(toEditForm({ ...row, name: '' }), { ...row, materials: [] }, a, '2026-11-19T12:00:00Z');
  assert.deepEqual(Object.keys(g), ['analysis']);
});
