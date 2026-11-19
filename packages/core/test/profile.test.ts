import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANALYZE_ITEM_SCHEMA, checkAnalysis } from '../src/ai/analyzeItem';
import {
  PROFILE_FIELDS, PROFILE_SCHEMA, CONFIDENCE_SCHEMA, checkProfile, checkConfidence, clearInactive, activeProfile,
  emptyProfile, profileLabel, type Ctx, type Profile,
} from '../src/ai/profile';

const ctx = (category: string | null, extra: Partial<Ctx> = {}): Ctx => ({ category, sub: null, pattern: 'Unifarben', materials: [], ...extra });

test('Schema: jedes Feld im Profil, Pflicht, mit null; Bereich als _min/_max', () => {
  const props = PROFILE_SCHEMA.properties!;
  for (const f of PROFILE_FIELDS) {
    const keys = f.kind === 'range' ? [`${f.key}_min`, `${f.key}_max`] : [f.key];
    for (const k of keys) {
      assert.ok(props[k], k);
      assert.ok(PROFILE_SCHEMA.required!.includes(k), k);
      if (f.kind !== 'list') assert.ok(props[k]!.enum!.includes(null), k);
    }
  }
  assert.equal(Object.keys(props).length, PROFILE_FIELDS.length + 1); // formality → 2 Props
  assert.equal(PROFILE_SCHEMA.additionalProperties, false);
  assert.equal(CONFIDENCE_SCHEMA.required!.length, 6);
  assert.ok(ANALYZE_ITEM_SCHEMA.required!.includes('profil') && ANALYZE_ITEM_SCHEMA.required!.includes('konfidenz'));
});

test('Schema bleibt unter der Grenze der Edge Function (60 000 Zeichen)', () => {
  assert.ok(JSON.stringify(ANALYZE_ITEM_SCHEMA).length < 60_000, String(JSON.stringify(ANALYZE_ITEM_SCHEMA).length));
});

test('Leitsatz: englische Keys, deutsche Labels, alles eindeutig', () => {
  const fieldKeys = PROFILE_FIELDS.map((f) => f.key);
  assert.equal(new Set(fieldKeys).size, fieldKeys.length);
  assert.deepEqual(new Set(fieldKeys), new Set(Object.keys(emptyProfile()))); // Typ Profile passt zur Tabelle
  for (const f of PROFILE_FIELDS) {
    assert.match(f.key, /^[a-z][a-z_]*$/);
    assert.ok(f.label.trim(), f.key);
    if (f.kind === 'enum' || f.kind === 'list') {
      const keys = f.values.map((v) => v.key);
      assert.equal(new Set(keys).size, keys.length, f.key);
      for (const v of f.values) { assert.match(v.key, /^[a-z][a-z_]*$/, `${f.key}.${v.key}`); assert.ok(v.label.trim(), `${f.key}.${v.key}`); }
    }
  }
});

test('checkProfile: ungültige Werte → null', () => {
  const p = checkProfile({ sheen: 0, texture_intensity: 6, visual_weight: 2.5, presence: '3', structure: 4, surface: 'glitter', opacity: 'opaque' });
  assert.equal(p.sheen, null); assert.equal(p.texture_intensity, null); assert.equal(p.visual_weight, null); assert.equal(p.presence, null);
  assert.equal(p.structure, 4); assert.equal(p.surface, null); assert.equal(p.opacity, 'opaque');
  assert.deepEqual(checkProfile(null), emptyProfile());
});

test('checkProfile: Bereich und Liste', () => {
  assert.deepEqual(checkProfile({ formality_min: 2, formality_max: 4 }).formality, [2, 4]);
  assert.equal(checkProfile({ formality_min: 4, formality_max: 2 }).formality, null);
  assert.deepEqual(checkProfile({ formality_min: 3, formality_max: null }).formality, [3, 3]);
  assert.deepEqual(checkProfile({ formality_max: 5 }).formality, [5, 5]);
  assert.deepEqual(checkProfile({ effects: ['clean', 'clean', 'nope', 'soft', 'bold', 'sharp'] }).effects, ['clean', 'soft']);
  assert.deepEqual(checkProfile({ effects: 'clean' }).effects, []);
});

test('checkConfidence: nur ganze Zahlen 0–10', () => {
  const c = checkConfidence({ category: 10, color: 11, material: 0.5, surface: 0, shape: -1 });
  assert.deepEqual(c, { category: 10, color: null, material: null, surface: 0, shape: null, style: null });
});

test('Bedingungen: unpassende Felder werden geleert', () => {
  const full = checkProfile({ leg: 'tapered', toe: 'round', pattern_scale: 'large', pattern_contrast: 4, denim_wash: 'dark', surface: 'smooth', metal_tone: 'gold', shoulder: 'natural' });
  const shoe = clearInactive(full, ctx('Schuh'));
  assert.equal(shoe.leg, null); assert.equal(shoe.toe, 'round'); assert.equal(shoe.shoulder, null); assert.equal(shoe.metal_tone, 'gold');
  const plain = clearInactive(full, ctx('Hose'));
  assert.equal(plain.pattern_scale, null); assert.equal(plain.pattern_contrast, null); assert.equal(plain.denim_wash, null); assert.equal(plain.leg, 'tapered');
  assert.equal(clearInactive(full, ctx('Hose', { materials: ['Denim'] })).denim_wash, 'dark');
  assert.equal(clearInactive(full, ctx('Hose', { pattern: 'Kariert' })).pattern_scale, 'large');
  assert.equal(clearInactive(full, ctx('Schmuck')).surface, null);
  assert.equal(clearInactive(full, ctx('Accessoire', { sub: 'Gürtel' })).metal_tone, 'gold');
  assert.equal(clearInactive(full, ctx('Accessoire', { sub: 'Schal' })).metal_tone, null);
});

test('activeProfile: Kategoriewechsel blendet aus, Werte bleiben gespeichert', () => {
  const p: Profile = { ...emptyProfile(), leg: 'tapered' };
  assert.equal('leg' in activeProfile(p, ctx('Schuh')), false);
  assert.equal(activeProfile(p, ctx('Hose')).leg, 'tapered');
  assert.equal(p.leg, 'tapered');
});

test('checkAnalysis: Profil nach erkannter Kategorie bereinigt, Modell übernommen', () => {
  const a = checkAnalysis({
    kategorie: 'Hose › Jeans', muster: 'Unifarben', material: ['Denim'],
    profil: { leg: 'tapered', toe: 'round', denim_wash: 'dark', pattern_scale: 'fine', formality_min: 1, formality_max: 3, surface: 'smooth' },
    konfidenz: { category: 9 },
  }, 'gemini-3.5-flash-lite');
  assert.equal(a.profile.leg, 'tapered'); assert.equal(a.profile.toe, null);
  assert.equal(a.profile.denim_wash, 'dark'); assert.equal(a.profile.pattern_scale, null);
  assert.deepEqual(a.profile.formality, [1, 3]);
  assert.equal(a.confidence.category, 9);
  assert.equal(a.model, 'gemini-3.5-flash-lite');
  assert.deepEqual(checkAnalysis({}).profile, emptyProfile());
  assert.equal(checkAnalysis({}).model, null);
});

test('profileLabel: deutsche Anzeige', () => {
  assert.equal(profileLabel('surface', 'fine_knit'), 'Feinstrick');
  assert.equal(profileLabel('formality', [2, 4]), '2–4');
  assert.equal(profileLabel('formality', [3, 3]), '3');
  assert.equal(profileLabel('sheen', 2), '2 von 5');
  assert.equal(profileLabel('effects', ['clean', 'soft']), 'Clean, Weich');
  assert.equal(profileLabel('surface', null), '');
  assert.equal(profileLabel('unbekannt', 1), '');
});
