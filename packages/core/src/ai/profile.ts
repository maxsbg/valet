// KI-Profil eines Teils (Analyse v2, docs/ki/analyse-v2/VALET_ANALYSE_V2_SPEC.html, Abschnitte 3–4 und 6.2).
// Eine Quelle für alles: aus PROFILE_FIELDS entstehen Schema, Prüfung, Typen und deutsche Labels.
// Leitsatz (19.11.2026): englische Keys, deutsche Labels nur in der Oberfläche.

import type { JsonSchema } from './analyzeItem';

export const PROFILE_PROMPT_VERSION = '2.0';

/** Worauf ein Feld schaut: Kategorie-Pfad + Steckbrief-Werte (alles Keys), von denen es abhängt */
export type Ctx = { category: string | null; sub: string | null; pattern: string | null; materials: readonly string[] };
export type Applies = (c: Ctx) => boolean;
export type Group = 'surface' | 'shape' | 'style';
export type Opt = { readonly key: string; readonly label: string };

type Base = { key: string; label: string; group: Group; applies: Applies; only: string; hint: string };
export type ProfileField =
  | (Base & { kind: 'scale' })
  | (Base & { kind: 'range' })
  | (Base & { kind: 'enum'; values: readonly Opt[] })
  | (Base & { kind: 'list'; values: readonly Opt[]; max: number });

// ---------- Bedingungen ----------

const CLOTHING = ['outerwear', 'top', 'dress', 'pants', 'shorts', 'skirt'];
const UPPER = ['outerwear', 'top', 'dress'];
const is = (cats: readonly string[]): Applies => (c) => cats.includes(c.category ?? '');
const all: Applies = () => true;
const clothing = is(CLOTHING);
const upper = is(UPPER);
const shapeCats = is([...UPPER, 'skirt']);
const legCats = is(['pants', 'shorts']);
const shoe = is(['shoe']);
const bag = is(['bag']);
const notJewelry: Applies = (c) => c.category !== 'jewelry';
const structured: Applies = (c) => clothing(c) || shoe(c) || bag(c);
const patterned: Applies = (c) => c.pattern != null && c.pattern !== 'solid';
const denim: Applies = (c) => c.materials.includes('denim');
const metal: Applies = (c) =>
  ['outerwear', 'shoe', 'bag', 'jewelry'].includes(c.category ?? '') || (c.category === 'accessory' && c.sub === 'belt');

// ---------- Werte ----------

const o = (pairs: string): readonly Opt[] =>
  pairs.split(' · ').map((p) => { const i = p.indexOf(' '); return { key: p.slice(0, i), label: p.slice(i + 1) }; });

export const SURFACES = o('smooth Glatt · fine_knit Feinstrick · chunky_knit Grobstrick · ribbed Gerippt · quilted Gesteppt · fuzzy Flauschig · brushed Angeraut · grainy Genarbt · technical Funktionsstoff');
export const OPACITIES = o('opaque Blickdicht · semi_sheer Leicht durchscheinend · sheer Durchsichtig');
export const PATTERN_SCALES = o('fine Fein · medium Mittel · large Groß');
export const DENIM_WASHES = o('raw Raw · dark Dunkel · mid Mittel · light Hell · black Schwarz · distressed Used');
export const METAL_TONES = o('none Keiner · silver Silber · gold Gold · rose_gold Roségold · black Schwarz · mixed Gemischt');
export const SILHOUETTES = o('straight Gerade · fitted Tailliert · a_line A-Linie · boxy Kastig · cocoon Kokon');
export const SHOULDERS = o('natural Natürlich · structured Gepolstert · dropped Überschnitten · raglan Raglan · sleeveless Ärmellos · off_shoulder Schulterfrei');
export const LEGS = o('straight Gerade · tapered Zulaufend · flared Ausgestellt · barrel Bogen');
export const TOES = o('round Rund · almond Mandel · pointed Spitz · square Eckig · open Offen');
export const SHAFTS = o('low Halbschuh · ankle Knöchel · mid Wade · high Knie und höher');
export const SOLES = o('slim Schmal · regular Normal · chunky Klobig · platform Plateau');
export const HEELS = o('none Kein Absatz · low Niedrig · mid Mittel · high Hoch');
export const BAG_SIZES = o('mini Mini · small Klein · medium Mittel · large Groß');
export const EFFECTS = o('clean Clean · rugged Robust · soft Weich · sharp Streng · playful Verspielt · bold Markant');

// ---------- Feldtabelle (Reihenfolge = Schema und Oberfläche) ----------

const ALL = 'alle Teile';
export const PROFILE_FIELDS: readonly ProfileField[] = [
  { key: 'sheen', kind: 'scale', label: 'Glanz', group: 'surface', applies: all, only: ALL,
    hint: '1 matt (Baumwoll-Sweat) · 3 leichter Schimmer (glattes Leder, Satin-Futter) · 5 stark glänzend (Lack, Pailletten)' },
  { key: 'texture_intensity', kind: 'scale', label: 'Struktur', group: 'surface', applies: all, only: ALL,
    hint: '1 glatt (Popeline) · 3 erkennbar (Piqué, Feinrippe) · 5 sehr stark (Zopfstrick, Teddy)' },
  { key: 'visual_weight', kind: 'scale', label: 'Optisches Gewicht', group: 'surface', applies: all, only: ALL,
    hint: '1 sehr leicht (Chiffon-Top) · 3 mittel (Sweatshirt) · 5 sehr schwer (Daunenparka, Chunky Boot)' },
  { key: 'pattern_contrast', kind: 'scale', label: 'Musterkontrast', group: 'surface', applies: patterned, only: 'gemusterte Teile (nicht Unifarben)',
    hint: '1 Ton in Ton · 3 deutlich · 5 sehr stark (Schwarz-Weiß-Hahnentritt)' },
  { key: 'structure', kind: 'scale', label: 'Formstabilität', group: 'shape', applies: structured, only: 'Kleidung, Schuhe, Taschen',
    hint: '1 fließend (Seidenbluse) · 3 mittel (Oxford-Hemd) · 5 sehr formstabil (Wollmantel, Ledertasche)' },
  { key: 'presence', kind: 'scale', label: 'Auffälligkeit', group: 'style', applies: all, only: ALL,
    hint: '1 unauffällig (graues T-Shirt) · 3 mittel (Karo-Hemd) · 5 sehr dominant (Leopard-Mantel, Neon)' },
  { key: 'versatility', kind: 'scale', label: 'Vielseitigkeit', group: 'style', applies: all, only: ALL,
    hint: '1 sehr speziell (Kostüm-Teil) · 3 mittel · 5 passt in viele Stile (weißes Hemd)' },
  { key: 'formality', kind: 'range', label: 'Formalität', group: 'style', applies: all, only: ALL,
    hint: 'Bereich, in dem das Teil passt: 1 Freizeit/Sport · 2 Casual · 3 Smart Casual · 4 Business/elegant · 5 sehr formell. Beispiele: weißer Sneaker 1–3, Oxford-Hemd 2–4' },
  { key: 'surface', kind: 'enum', label: 'Oberfläche', group: 'surface', applies: notJewelry, only: 'alle außer Schmuck', values: SURFACES,
    hint: 'sichtbare Oberfläche, nicht die Faser' },
  { key: 'opacity', kind: 'enum', label: 'Transparenz', group: 'surface', applies: clothing, only: 'Kleidung', values: OPACITIES, hint: 'wie blickdicht der Stoff ist' },
  { key: 'pattern_scale', kind: 'enum', label: 'Mustergröße', group: 'surface', applies: patterned, only: 'gemusterte Teile (nicht Unifarben)', values: PATTERN_SCALES, hint: 'Größe des Musters' },
  { key: 'denim_wash', kind: 'enum', label: 'Waschung', group: 'surface', applies: denim, only: 'Teile aus Denim', values: DENIM_WASHES, hint: 'Waschung des Denims' },
  { key: 'metal_tone', kind: 'enum', label: 'Metallton', group: 'surface', applies: metal, only: 'Oberbekleidung, Schuhe, Taschen, Gürtel, Schmuck', values: METAL_TONES,
    hint: 'Farbe sichtbarer Metallteile (Reißverschluss, Schnalle, Beschläge, Schmuck)' },
  { key: 'silhouette', kind: 'enum', label: 'Form', group: 'shape', applies: shapeCats, only: 'Oberbekleidung, Oberteil, Kleid, Rock', values: SILHOUETTES,
    hint: 'Grundform des Teils, nicht die Weite und nicht am Körper' },
  { key: 'shoulder', kind: 'enum', label: 'Schulter', group: 'shape', applies: upper, only: 'Oberbekleidung, Oberteil, Kleid', values: SHOULDERS, hint: 'Schulterpartie' },
  { key: 'leg', kind: 'enum', label: 'Beinverlauf', group: 'shape', applies: legCats, only: 'Hose, Shorts', values: LEGS, hint: 'Verlauf vom Knie zum Saum, nicht die Weite' },
  { key: 'toe', kind: 'enum', label: 'Schuhspitze', group: 'shape', applies: shoe, only: 'Schuhe', values: TOES, hint: 'Form der Schuhspitze' },
  { key: 'shaft', kind: 'enum', label: 'Schafthöhe', group: 'shape', applies: shoe, only: 'Schuhe', values: SHAFTS, hint: 'Höhe des Schafts' },
  { key: 'sole', kind: 'enum', label: 'Sohle', group: 'shape', applies: shoe, only: 'Schuhe', values: SOLES, hint: 'Dicke und Form der Sohle' },
  { key: 'heel', kind: 'enum', label: 'Absatz', group: 'shape', applies: shoe, only: 'Schuhe', values: HEELS, hint: 'none kein Absatz · low unter 3 cm · mid 3–7 cm · high über 7 cm' },
  { key: 'bag_size', kind: 'enum', label: 'Taschengröße', group: 'shape', applies: bag, only: 'Taschen', values: BAG_SIZES, hint: 'Größe der Tasche' },
  { key: 'effects', kind: 'list', label: 'Wirkung', group: 'style', applies: all, only: ALL, values: EFFECTS, max: 2,
    hint: 'höchstens 2 Begriffe, nur wenn sie klar zutreffen' },
];

// ---------- Typen ----------

export type Range = readonly [number, number];
export type ProfileValue = number | Range | string | string[] | null;
/** Listen: [] statt null; sonst null = unbekannt. Enum-/Listenwerte sind Keys aus PROFILE_FIELDS. */
export type Profile = {
  sheen: number | null; texture_intensity: number | null; visual_weight: number | null; pattern_contrast: number | null;
  structure: number | null; presence: number | null; versatility: number | null; formality: Range | null;
  surface: string | null; opacity: string | null; pattern_scale: string | null; denim_wash: string | null; metal_tone: string | null;
  silhouette: string | null; shoulder: string | null; leg: string | null; toe: string | null; shaft: string | null;
  sole: string | null; heel: string | null; bag_size: string | null; effects: string[];
};
export type ProfileKey = keyof Profile;
export const CONFIDENCE_GROUPS = ['category', 'color', 'material', 'surface', 'shape', 'style'] as const;
export type ConfidenceGroup = (typeof CONFIDENCE_GROUPS)[number];
/** 0–10 je Gruppe (nur Anzeige und Eval, nie Matching) */
export type Confidence = Record<ConfidenceGroup, number | null>;

export const emptyProfile = (): Profile =>
  Object.fromEntries(PROFILE_FIELDS.map((f) => [f.key, f.kind === 'list' ? [] : null])) as unknown as Profile;
export const emptyConfidence = (): Confidence => Object.fromEntries(CONFIDENCE_GROUPS.map((g) => [g, null])) as Confidence;

// ---------- Schema ----------

const SCALE = [1, 2, 3, 4, 5];
const scaleSchema = (description: string): JsonSchema => ({ type: ['integer', 'null'], enum: [...SCALE, null], description });
const describe = (f: ProfileField) => (f.only === ALL ? f.hint : `${f.hint}. Nur für ${f.only}, sonst null${f.kind === 'list' ? ' bzw. leere Liste' : ''}.`);

/** Properties des Unterobjekts „profil“ (Bereich → <key>_min / <key>_max) */
export function profileProps(): Record<string, JsonSchema> {
  const props: Record<string, JsonSchema> = {};
  for (const f of PROFILE_FIELDS) {
    const d = describe(f);
    if (f.kind === 'scale') props[f.key] = scaleSchema(d);
    else if (f.kind === 'range') { props[`${f.key}_min`] = scaleSchema(`${f.label} von: ${d}`); props[`${f.key}_max`] = scaleSchema(`${f.label} bis (≥ von): ${d}`); }
    else if (f.kind === 'enum') props[f.key] = { type: ['string', 'null'], enum: [...f.values.map((v) => v.key), null], description: `${d} (${f.values.map((v) => `${v.key} = ${v.label}`).join(', ')})` };
    else props[f.key] = { type: 'array', items: { type: 'string', enum: f.values.map((v) => v.key) }, description: `${d} (${f.values.map((v) => `${v.key} = ${v.label}`).join(', ')})` };
  }
  return props;
}

const CONF_TEXT: Record<ConfidenceGroup, string> = {
  category: 'Kategorie', color: 'Farben', material: 'Material', surface: 'Oberfläche', shape: 'Form', style: 'Wirkung/Formalität',
};
export function confidenceProps(): Record<string, JsonSchema> {
  const steps = Array.from({ length: 11 }, (_, i) => i);
  return Object.fromEntries(CONFIDENCE_GROUPS.map((g) => [g, { type: ['integer', 'null'], enum: [...steps, null], description: `Sicherheit ${CONF_TEXT[g]}: 10 eindeutig, 5 halb geraten, 0 unbekannt` }]));
}

const object = (properties: Record<string, JsonSchema>): JsonSchema => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
export const PROFILE_SCHEMA = object(profileProps());
export const CONFIDENCE_SCHEMA = object(confidenceProps());

// ---------- Prüfung ----------

type Raw = Record<string, unknown>;
const scale = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5 ? v : null);
const keyOf = (v: unknown, values: readonly Opt[]): string | null => (typeof v === 'string' && values.some((x) => x.key === v) ? v : null);

/** Nur Werteprüfung (unabhängig von der Kategorie): Ungültiges → null bzw. [] */
export function checkProfile(raw: unknown): Profile {
  const r: Raw = raw && typeof raw === 'object' ? (raw as Raw) : {};
  const p = emptyProfile() as Record<string, ProfileValue>;
  for (const f of PROFILE_FIELDS) {
    if (f.kind === 'scale') p[f.key] = scale(r[f.key]);
    else if (f.kind === 'range') {
      const lo = scale(r[`${f.key}_min`]), hi = scale(r[`${f.key}_max`]);
      p[f.key] = lo != null && hi != null ? (lo <= hi ? [lo, hi] : null) : lo != null ? [lo, lo] : hi != null ? [hi, hi] : null;
    } else if (f.kind === 'enum') p[f.key] = keyOf(r[f.key], f.values);
    else {
      const v = r[f.key];
      p[f.key] = Array.isArray(v) ? [...new Set(v.map((x) => keyOf(x, f.values)).filter((x): x is string => x != null))].slice(0, f.max) : [];
    }
  }
  return p as unknown as Profile;
}

export function checkConfidence(raw: unknown): Confidence {
  const r: Raw = raw && typeof raw === 'object' ? (raw as Raw) : {};
  const ok = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10 ? v : null);
  return Object.fromEntries(CONFIDENCE_GROUPS.map((g) => [g, ok(r[g])])) as Confidence;
}

/** Felder, deren Bedingung nicht gilt, auf null/[] setzen (Prüfung der KI-Antwort) */
export function clearInactive(p: Profile, c: Ctx): Profile {
  const out = { ...p } as Record<string, ProfileValue>;
  for (const f of PROFILE_FIELDS) if (!f.applies(c)) out[f.key] = f.kind === 'list' ? [] : null;
  return out as unknown as Profile;
}

/** Nur Felder, die für die aktuelle Kategorie gelten (Anzeige, Matching). Gespeicherte Werte bleiben. */
export function activeProfile(p: Profile, c: Ctx): Partial<Profile> {
  return Object.fromEntries(PROFILE_FIELDS.filter((f) => f.applies(c)).map((f) => [f.key, p[f.key as ProfileKey]])) as Partial<Profile>;
}

// ---------- Labels ----------

export const profileField = (key: string): ProfileField | undefined => PROFILE_FIELDS.find((f) => f.key === key);

/** Anzeige eines Werts: „Feinstrick“, „2–4“, „3 von 5“, „Clean, Weich“; leer → '' */
export function profileLabel(key: string, value: unknown): string {
  const f = profileField(key);
  if (!f || value == null) return '';
  if (f.kind === 'scale') return typeof value === 'number' ? `${value} von 5` : '';
  if (f.kind === 'range') return Array.isArray(value) ? (value[0] === value[1] ? `${value[0]}` : `${value[0]}–${value[1]}`) : '';
  const name = (k: unknown) => f.values.find((v) => v.key === k)?.label ?? '';
  if (f.kind === 'enum') return name(value);
  return Array.isArray(value) ? value.map(name).filter(Boolean).join(', ') : '';
}
