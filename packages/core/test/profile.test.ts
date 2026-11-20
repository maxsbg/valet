import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANALYZE_ITEM_SCHEMA, checkAnalysis } from '../src/ai/analyzeItem';
import { applyAnalysis } from '../src/ai/merge';
import { emptyEditForm } from '../src/edit';
import {
  PROFILE_FIELDS, PROFILE_SCHEMA, CONFIDENCE_SCHEMA, checkProfile, checkConfidence, clearInactive, activeProfile,
  SCALE_WORDS, emptyProfile, profileLabel, readProfile, type Ctx, type Profile,
} from '../src/ai/profile';

const ctx = (category: string | null, extra: Partial<Ctx> = {}): Ctx => ({ category, sub: null, pattern: 'solid', materials: [], ...extra });

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
  assert.ok(ANALYZE_ITEM_SCHEMA.required!.includes('profile') && ANALYZE_ITEM_SCHEMA.required!.includes('confidence'));
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
  const shoe = clearInactive(full, ctx('shoe'));
  assert.equal(shoe.leg, null); assert.equal(shoe.toe, 'round'); assert.equal(shoe.shoulder, null); assert.equal(shoe.metal_tone, 'gold');
  const plain = clearInactive(full, ctx('pants'));
  assert.equal(plain.pattern_scale, null); assert.equal(plain.pattern_contrast, null); assert.equal(plain.denim_wash, null); assert.equal(plain.leg, 'tapered');
  assert.equal(clearInactive(full, ctx('pants', { materials: ['denim'] })).denim_wash, 'dark');
  assert.equal(clearInactive(full, ctx('pants', { pattern: 'plaid' })).pattern_scale, 'large');
  assert.equal(clearInactive(full, ctx('jewelry')).surface, null);
  assert.equal(clearInactive(full, ctx('accessory', { sub: 'belt' })).metal_tone, 'gold');
  assert.equal(clearInactive(full, ctx('accessory', { sub: 'scarf' })).metal_tone, null);
});

test('activeProfile: Kategoriewechsel blendet aus, Werte bleiben gespeichert', () => {
  const p: Profile = { ...emptyProfile(), leg: 'tapered' };
  assert.equal('leg' in activeProfile(p, ctx('shoe')), false);
  assert.equal(activeProfile(p, ctx('pants')).leg, 'tapered');
  assert.equal(p.leg, 'tapered');
});

test('checkAnalysis: Profil nur geprüft (bereinigt wird beim Zusammenführen), Modell übernommen', () => {
  const a = checkAnalysis({
    category: 'pants/jeans', pattern: 'solid', materials: ['denim'],
    profile: { leg: 'tapered', toe: 'round', denim_wash: 'dark', pattern_scale: 'fine', formality_min: 1, formality_max: 3, surface: 'smooth' },
    confidence: { category: 9 },
  }, 'gemini-3.5-flash-lite');
  assert.equal(a.profile.leg, 'tapered'); assert.equal(a.profile.toe, 'round');
  assert.equal(a.profile.denim_wash, 'dark'); assert.equal(a.profile.pattern_scale, 'fine');
  // mit dem endgültigen Pfad (hier gleich dem erkannten) bereinigt
  const f = applyAnalysis({ ...emptyEditForm({ ownerId: 'max' }), aiPending: [] }, a, '2026-11-20T10:00:00Z');
  assert.equal(f.profile.leg, 'tapered'); assert.equal(f.profile.toe, null); assert.equal(f.profile.pattern_scale, null);
  assert.deepEqual(a.profile.formality, [1, 3]);
  assert.equal(a.confidence.category, 9);
  assert.equal(a.model, 'gemini-3.5-flash-lite');
  assert.deepEqual(checkAnalysis({}).profile, emptyProfile());
  assert.equal(checkAnalysis({}).model, null);
});

test('Skalen-Wörter: jede Skala und Formalität mit 5 Stufen', () => {
  for (const f of PROFILE_FIELDS.filter((x) => x.kind === 'scale' || x.kind === 'range')) {
    assert.equal(SCALE_WORDS[f.key as keyof typeof SCALE_WORDS]?.length, 5, f.key);
  }
});

test('profileLabel: deutsche Anzeige', () => {
  assert.equal(profileLabel('surface', 'fine_knit'), 'Feinstrick');
  assert.equal(profileLabel('formality', [1, 2]), 'Freizeit bis Casual');
  assert.equal(profileLabel('formality', [3, 3]), 'Smart Casual');
  assert.equal(profileLabel('formality', [2, 4]), 'Casual bis Business');
  assert.equal(profileLabel('sheen', 2), 'leicht matt');
  assert.equal(profileLabel('sheen', 9), '');
  assert.equal(profileLabel('texture_intensity', 5), 'sehr stark strukturiert');
  assert.equal(profileLabel('visual_weight', 3), 'mittel');
  assert.equal(profileLabel('pattern_contrast', 1), 'Ton in Ton');
  assert.equal(profileLabel('structure', 4), 'formstabil');
  assert.equal(profileLabel('presence', 1), 'sehr zurückhaltend');
  assert.equal(profileLabel('versatility', 5), 'sehr vielseitig');
  assert.equal(profileLabel('effects', ['clean', 'soft']), 'Clean, Weich');
  assert.equal(profileLabel('surface', null), '');
  assert.equal(profileLabel('unbekannt', 1), '');
});

test('readProfile: gespeichertes Profil mit Bereich [von, bis], tolerant', () => {
  const p = readProfile({ formality: [2, 4], presence: 3, surface: 'fine_knit', effects: ['clean', 'x'] });
  assert.deepEqual(p.formality, [2, 4]);
  assert.equal(p.presence, 3); assert.equal(p.surface, 'fine_knit'); assert.deepEqual(p.effects, ['clean']);
  assert.equal(readProfile({ formality: [4, 2] }).formality, null);
  assert.deepEqual(readProfile(null), emptyProfile());
  assert.deepEqual(readProfile('kaputt'), emptyProfile());
});

test('Typ Profile und Feldtabelle decken sich (zur Übersetzungszeit geprüft)', () => {
  // fehlt ein Key in der Tabelle oder im Typ, schlägt der Typecheck fehl
  const keys: Record<keyof Profile, true> = {
    sheen: true, texture_intensity: true, visual_weight: true, pattern_contrast: true, structure: true, presence: true, versatility: true,
    formality: true, surface: true, opacity: true, pattern_scale: true, denim_wash: true, metal_tone: true, silhouette: true, shoulder: true,
    leg: true, toe: true, shaft: true, sole: true, heel: true, bag_size: true, effects: true,
  };
  assert.deepEqual(PROFILE_FIELDS.map((f) => f.key).sort(), Object.keys(keys).sort());
});

test('Labels nach Spec 3.2 (Absatz, Schulter)', () => {
  assert.equal(profileLabel('heel', 'low'), 'unter 3 cm');
  assert.equal(profileLabel('heel', 'none'), 'Keiner');
  assert.equal(profileLabel('shoulder', 'sleeveless'), 'Ärmellos/Träger');
});

test('Waschung auch bei Jeans ohne Material Denim (Max, 20.11.2026)', () => {
  const p = { ...emptyProfile(), denim_wash: 'dark' };
  assert.equal(clearInactive(p, { category: 'pants', sub: 'jeans', pattern: null, materials: ['cotton'] }).denim_wash, 'dark');
  assert.equal(clearInactive(p, { category: 'pants', sub: 'chinos', pattern: null, materials: ['cotton'] }).denim_wash, null);
});
