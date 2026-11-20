// KI „Teil erkennen“: Prompt, Antwort-Schema und Prüfung der Antwort.
// Die Edge Function `ki` ist nur ein Durchreicher zu Gemini (OpenAI-kompatible Schnittstelle; Bild + Prompt + Schema);
// alles Fachliche liegt hier, damit es mit denselben festen Listen arbeitet wie Bearbeiten und Steckbrief.

import { CATEGORY_TREE, FIT_KEYS, isValidPath, type CategoryPath } from '../categories';
import { COLOR_LIST, COLLAR_LIST, MAX_COLORS, MATERIALS, MULTICOLOR, PATTERNS, STYLES, SEASONS, CLOSURES, LAYERS, WARMTH, RAIN, toMaterialParts, type MaterialPart } from '../attributes';
import { STRAPS } from '../fields';
import { keysOf, toKey, type KeyList } from '../keys';
import { mergeAnalysis } from '../edit';
import { normalizeCategory } from '../import/categorize';
import { legFromName } from './merge';
import { PROFILE_SCHEMA, CONFIDENCE_SCHEMA, aiMeta, checkProfile, checkConfidence, clearInactive, readProfile, type Profile, type Confidence } from './profile';

/**
 * JSON-Schema für „Structured Outputs“ (OpenAI-kompatibel, strict):
 * alle Felder Pflicht, keine Zusatzfelder, „leer“ = null bzw. leere Liste, Zahlen nur über enum.
 */
export type JsonSchema = {
  type: string | string[];
  description?: string;
  enum?: (string | number | null)[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: false;
};

const SEP = '/';
/** Alle gültigen Kategorie-Pfade als Keys: „top/shirt/long_sleeve_shirt“, „top/shirt“, „top“ */
export const CATEGORY_PATHS: readonly string[] = CATEGORY_TREE.flatMap((c) => [
  c.key,
  ...c.subs.flatMap((s) => [c.key + SEP + s.key, ...s.types.map((t) => c.key + SEP + s.key + SEP + t.key)]),
]);
/** Deutsche Labels zu den Pfaden (für die Beschreibung im Schema, damit die KI deutsche Shoptexte zuordnen kann) */
const CATEGORY_PATH_LABELS: string = CATEGORY_TREE.flatMap((c) => [
  `${c.key} = ${c.label}`,
  ...c.subs.flatMap((s) => [`${c.key}${SEP}${s.key} = ${s.label}`, ...s.types.map((t) => `${c.key}${SEP}${s.key}${SEP}${t.key} = ${t.label}`)]),
]).join(', ');
const NECK_LIST: KeyList = COLLAR_LIST;

/** Liste mit Labels für die Beschreibung: „navy = Marineblau, …“ */
const labels = (values: KeyList) => values.map((v) => `${v.key} = ${v.label}`).join(', ');
const str = (values: KeyList, description: string): JsonSchema =>
  ({ type: ['string', 'null'], enum: [...values.map((v) => v.key), null], description: `${description} (${labels(values)})` });
const list = (values: KeyList, description: string): JsonSchema =>
  ({ type: 'array', items: { type: 'string', enum: values.map((v) => v.key) }, description: `${description} (${labels(values)})` });
const steps = (max: number) => Array.from({ length: max + 1 }, (_, i) => i);
const level = (max: number, description: string): JsonSchema => ({ type: ['integer', 'null'], enum: [...steps(max), null], description });
const fitWord = (k: keyof typeof FIT_KEYS, description: string): JsonSchema => ({ type: ['string', 'null'], enum: [...FIT_KEYS[k], null], description });

/** Beschreibung des Kategorie-Felds (auch für „Infos auslesen“) */
export const categoryDescription = (intro: string) => `${intro} Pfad aus Keys, getrennt mit „${SEP}“. Labels: ${CATEGORY_PATH_LABELS}`;

export const ANALYZE_ITEM_PROPS: Record<string, JsonSchema> = {
  category: { type: 'string', enum: [...CATEGORY_PATHS], description: categoryDescription('Immer angeben, mindestens die Oberkategorie; so genau wie sicher erkennbar: Kategorie/Unterkategorie/Typ. Typ bzw. Unterkategorie weglassen, wenn unsicher.') },
  name: { type: 'string', description: 'Kurze Artikelbezeichnung auf Deutsch, ohne Farbe, Marke und Passform-Begriffe (Slim, Oversized …), z. B. „Oxford-Hemd“' },
  brand: { type: ['string', 'null'], description: 'Nur wenn Logo oder Schriftzug lesbar ist, sonst null' },
  colors: list(COLOR_LIST, `1 bis ${MAX_COLORS} Farben, nach Flächenanteil sortiert. Nuance statt Hauptfarbe, wenn eindeutig (z. B. navy). multicolor nur bei mehr als drei Farben.`),
  pattern: str(PATTERNS, 'Muster des Stoffs'),
  materials: list(MATERIALS, 'Höchstens 3 geschätzte Materialien, Hauptmaterial zuerst. Leer, wenn nicht sinnvoll schätzbar.'),
  styles: list(STYLES, 'Passende Stile, höchstens 3'),
  seasons: list(SEASONS, 'Jahreszeiten, in denen man das Teil trägt'),
  collar: str(NECK_LIST, 'Kragen bzw. Ausschnitt, nur bei Oberteil, Kleid und Oberbekleidung'),
  closure: str(CLOSURES, 'Verschluss, nur wenn sichtbar'),
  strap: str(STRAPS, 'Trägerart, nur bei Taschen'),
  width: fitWord('width', 'Passform Weite; nur Oberteil, Hose, Shorts. Oberteil: slim, regular, relaxed, oversized. Hose: skinny, slim, regular, relaxed, wide. Shorts: slim, regular, relaxed, wide'),
  length: fitWord('length', 'Länge; Oberteil: cropped, regular, longline (deutlich verlängert). Hose: cropped (Knöchel frei), regular, long. Shorts: short, mid, long (bis Knie). Kleid/Rock: mini, above_knee, knee, midi, maxi'),
  rise: fitWord('rise', 'Bundhöhe low, regular, high; nur Hose, Shorts, Rock'),
  layers: { type: 'array', items: { type: 'integer', enum: steps(3) }, description: `Mögliche Lagen: ${LAYERS.map((l, i) => `${i} = ${l}`).join('; ')}; nur Oberteil und Oberbekleidung` },
  warmth: level(3, `Wärme: ${WARMTH.map((w, i) => `${i} ${w}`).join(', ')}`),
  rain: level(2, `Regentauglich: ${RAIN.map((r, i) => `${i} ${r}`).join(', ')}`),
  profile: { ...PROFILE_SCHEMA, description: 'Mode-Profil des Teils (Analyse v2): streng nach den Ankern, nur das Teil selbst' },
  confidence: { ...CONFIDENCE_SCHEMA, description: 'Ehrliche Sicherheit je Gruppe, 0–10' },
};

export const ANALYZE_ITEM_SCHEMA: JsonSchema = {
  type: 'object',
  properties: ANALYZE_ITEM_PROPS,
  required: Object.keys(ANALYZE_ITEM_PROPS),
  additionalProperties: false,
};

export const ANALYZE_ITEM_PROMPT = `Du siehst ein Kleidungsstück oder Accessoire (Produktbild oder Handyfoto) und füllst
für die Kleiderschrank-App Valet einen Steckbrief und ein Mode-Profil aus.

1. Bewerte nur das Hauptteil – nicht Person, Hintergrund, andere Teile oder Styling.
2. Nur Werte (Keys) aus den vorgegebenen Listen. Nicht erkennbar oder laut Feldbeschreibung
   nicht für diese Kategorie → null bzw. leere Liste. Material darfst du aus sichtbaren
   Hinweisen schätzen.
3. Skalen 1–5: streng nach den Ankern in der Feldbeschreibung, jedes Teil für sich.
4. Das Profil beschreibt das Teil selbst, nicht eine Person, die es trägt.
5. Konfidenz je Gruppe 0–10 ehrlich: 10 = eindeutig, 5 = halb geraten.
   Bist du dir bei einem Wert sehr unsicher, lieber null.`;

// ---------- Antwort prüfen ----------

export type Analysis = {
  path: CategoryPath;
  name: string | null;
  brand: string | null;
  colors: string[];
  pattern: string | null;
  materials: MaterialPart[];
  styles: string[];
  seasons: string[];
  collar: string | null;
  closure: string | null;
  strap: string | null;
  /** Passform als Begriffe („oversized“); in Stufen der Kategorie umgerechnet wird beim Zusammenführen (fitIndex) */
  fit: { width: string | null; length: string | null; rise: string | null };
  layers: number[];
  warmth: number | null;
  rain: number | null;
  /** KI-Profil (v2), Werte geprüft; nach Kategorie bereinigt wird erst beim Zusammenführen (endgültiger Pfad) */
  profile: Profile;
  confidence: Confidence;
  /** tatsächlich genutztes Modell (Antwort der Edge Function) */
  model: string | null;
};

type Raw = Record<string, unknown>;
const pickStr = (v: unknown, allowed: KeyList): string | null => (typeof v === 'string' && allowed.some((a) => a.key === v) ? v : null);
const pickList = (v: unknown, allowed: KeyList, max = Infinity): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && allowed.some((a) => a.key === x)))].slice(0, max) : [];
const pickLevel = (v: unknown, max: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max ? v : null;
const pickWord = (v: unknown, allowed: readonly string[]): string | null => (typeof v === 'string' && allowed.includes(v) ? v : null);
const text = (v: unknown, max = 80): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/** Kategorie-Pfad „top/shirt/long_sleeve_shirt“ → Pfad aus Keys; ungültig → ohne Kategorie */
export function parsePath(v: unknown): CategoryPath {
  // leere Teile („top//“) gelten als nicht angegeben, nie als leerer Text
  const [category = null, subcategory = null, type = null] = typeof v === 'string' ? v.split(SEP).map((x) => x.trim() || null) : [];
  const p = { category, subcategory, type };
  return isValidPath(p) ? p : { category: null, subcategory: null, type: null };
}

/**
 * Rohantwort der KI → saubere Werte. Ungültiges wird verworfen statt abgelehnt. Ob ein Feld zur Kategorie passt,
 * entscheidet erst das Zusammenführen mit dem endgültigen Pfad (mergeSources: Stufen je Kategorie, dropHidden).
 */
export function checkAnalysis(raw: unknown, model: string | null = null): Analysis {
  const r: Raw = raw && typeof raw === 'object' ? (raw as Raw) : {};
  const path = parsePath(r.category);
  // Steckbrief-Fakten nur nach Werten prüfen, nicht nach dem erkannten Pfad: gefiltert wird mit dem endgültigen Pfad
  // beim Zusammenführen (Stufen in applyFacts, übrige Felder in dropHidden) – sonst ginge z. B. die Bundhöhe verloren,
  // wenn die KI einer feststehenden Kategorie widerspricht.
  let colors = pickList(r.colors, COLOR_LIST, MAX_COLORS);
  if (colors.includes(MULTICOLOR)) colors = [MULTICOLOR];
  const pattern = pickStr(r.pattern, PATTERNS);
  const materials = pickList(r.materials, MATERIALS, 3);
  return {
    path,
    name: text(r.name),
    brand: text(r.brand, 40),
    colors,
    pattern,
    materials: materials.map((name) => ({ name })),
    styles: pickList(r.styles, STYLES, 3),
    seasons: keysOf(SEASONS).filter((s) => pickList(r.seasons, SEASONS).includes(s)),
    collar: pickStr(r.collar, NECK_LIST),
    closure: pickStr(r.closure, CLOSURES),
    strap: pickStr(r.strap, STRAPS),
    fit: { width: pickWord(r.width, FIT_KEYS.width), length: pickWord(r.length, FIT_KEYS.length), rise: pickWord(r.rise, FIT_KEYS.rise) },
    layers: Array.isArray(r.layers) ? [...new Set(r.layers.filter((x) => pickLevel(x, 3) !== null) as number[])].sort() : [],
    warmth: pickLevel(r.warmth, 3),
    rain: pickLevel(r.rain, 2),
    // nur Werte prüfen; nach Kategorie bereinigt wird erst mit dem endgültigen Pfad (mergeSources, profilePatch)
    profile: checkProfile(r.profile),
    confidence: checkConfidence(r.confidence),
    model: typeof model === 'string' && model.trim() ? model.trim().slice(0, 80) : null,
  };
}

/**
 * Taugt die geprüfte Antwort als Analyse? Leere oder kaputte Antworten (kein Objekt, weder Kategorie noch Farbe noch
 * irgendein Profilwert) gelten als Fehlschlag – sonst stünde ein leeres Profil als „analysiert“ (meta.v = 2) da.
 */
export function analysisUsable(a: Analysis): boolean {
  return !!(a.path.category || a.colors.length) || profileFilled(a);
}
/** Hat die Antwort ein Mode-Profil? Ohne gilt das Teil nicht als „analysiert“ (kein meta.v = 2; Stapellauf: Fehlversuch) */
export const profileFilled = (a: Pick<Analysis, 'profile'>): boolean =>
  Object.values(a.profile).some((v) => (Array.isArray(v) ? v.length > 0 : v != null));

// ---------- Ins Formular übernehmen ----------

// applyAnalysis und legFromName liegen in merge.ts (Rangfolge der Quellen, mergeSources)
export { applyAnalysis, legFromName } from './merge';
import { nameTrusted } from './merge';

// ---------- Stapellauf: nur das Profil eines gespeicherten Teils (Spec 8) ----------

export type ProfilePatchRow = {
  category: string | null; subcategory: string | null; pattern: string | null;
  /** items.materials (jsonb, [{ name, pct? }]); reine Namen werden auch gelesen */
  materials: readonly (string | MaterialPart)[] | null;
  analysis: Record<string, unknown> | null; ai_pending: string[] | null;
  /** items.name: Beinverlauf aus dem Namen hat Vorrang (legFromName) */
  name?: string | null;
};

/**
 * Nur analysis eines gespeicherten Teils, Steckbrief und ai_pending bleiben unberührt (kein Name nötig).
 * applies-Filter nach dem GESPEICHERTEN Pfad/Muster/Material; Profil wird komplett ersetzt, Altschlüssel bleiben,
 * meta = { v: 2, prompt, model, at: now } (damit fällt auch meta.failed weg).
 */
export function profilePatch(
  row: ProfilePatchRow,
  a: Pick<Analysis, 'profile' | 'confidence' | 'model'>,
  now: string = new Date().toISOString(),
): { analysis: Record<string, unknown> } {
  const materials = toMaterialParts((row.materials ?? []).map((m) => (typeof m === 'string' ? { name: m } : m))).map((m) => m.name);
  // Kategorie tolerant lesen wie in toEditForm (Altwerte „Hose“ → pants)
  const path = normalizeCategory({ category: row.category || null, subcategory: row.subcategory, name: row.name });
  const ctx = { category: path.category, sub: path.subcategory, pattern: toKey(PATTERNS, row.pattern), materials };
  // a.profile kann aus einer anderen Quelle stammen → Werte noch einmal prüfen
  // Beinverlauf aus dem Namen nur, wenn der Name nicht selbst eine offene Bildschätzung ist
  const trusted = nameTrusted({ aiPending: row.ai_pending ?? [], analysisBase: row.analysis ?? {} });
  const profile = legFromName(clearInactive(readProfile(a.profile), ctx), trusted ? row.name : null, ctx);
  return { analysis: mergeAnalysis(row.analysis, profile, checkConfidence(a.confidence), aiMeta(a.model ?? null, now)) };
}
