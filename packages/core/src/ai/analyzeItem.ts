// KI „Teil erkennen“: Prompt, Antwort-Schema und Prüfung der Antwort.
// Die Edge Function `ki` ist nur ein Durchreicher zu einem OpenAI-kompatiblen Anbieter (Standard Mistral) (Bild + Prompt + Schema);
// alles Fachliche liegt hier, damit es mit denselben festen Listen arbeitet wie Bearbeiten und Steckbrief.

import { CATEGORY_TREE, isValidPath, fitScalesOf, type CategoryPath } from '../categories';
import { COLORS, MAX_COLORS, MATERIALS, PATTERNS, STYLES, SEASONS, COLLARS, CLOSURES, LAYERS, WARMTH, RAIN, type MaterialPart } from '../attributes';
import { fieldsFor, NECKLINES, OUTER_COLLARS, STRAPS } from '../fields';
import { setField, setCategory, type EditForm } from '../edit';

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

const SEP = ' › ';
/** Alle gültigen Kategorie-Pfade als Text: „Oberteil › Hemd › Langarmhemd“, „Oberteil › Hemd“, „Oberteil“ */
export const CATEGORY_PATHS: readonly string[] = CATEGORY_TREE.flatMap((c) => [
  c.name,
  ...c.subs.flatMap((s) => [c.name + SEP + s.name, ...s.types.map((t) => c.name + SEP + s.name + SEP + t)]),
]);
const COLOR_NAMES = COLORS.flatMap((c) => [c.name, ...c.nuances.map((n) => n.name)]);
const NECK_NAMES = [...new Set<string>([...COLLARS, ...NECKLINES, ...OUTER_COLLARS])];

const str = (values: readonly string[], description: string): JsonSchema => ({ type: ['string', 'null'], enum: [...values, null], description });
const list = (values: readonly string[], description: string): JsonSchema => ({ type: 'array', items: { type: 'string', enum: [...values] }, description });
const steps = (max: number) => Array.from({ length: max + 1 }, (_, i) => i);
const level = (max: number, description: string): JsonSchema => ({ type: ['integer', 'null'], enum: [...steps(max), null], description });

export const ANALYZE_ITEM_PROPS: Record<string, JsonSchema> = {
  kategorie: { type: 'string', enum: [...CATEGORY_PATHS], description: 'So genau wie sicher erkennbar: Kategorie › Unterkategorie › Typ. Typ weglassen, wenn unsicher.' },
  name: { type: 'string', description: 'Kurze Artikelbezeichnung auf Deutsch, ohne Farbe und ohne Marke, z. B. „Oxford-Hemd“' },
  marke: { type: ['string', 'null'], description: 'Nur wenn Logo oder Schriftzug lesbar ist, sonst null' },
  farben: list(COLOR_NAMES, `1 bis ${MAX_COLORS} Farben, nach Flächenanteil sortiert. Nuance statt Hauptfarbe, wenn eindeutig (z. B. Marineblau). „Bunt“ nur bei mehr als drei Farben.`),
  muster: str(PATTERNS, 'Muster des Stoffs'),
  material: list(MATERIALS, 'Höchstens 3 geschätzte Materialien, Hauptmaterial zuerst. Leer, wenn nicht sinnvoll schätzbar.'),
  stil: list(STYLES, 'Passende Stile, höchstens 3'),
  saison: list(SEASONS, 'Jahreszeiten, in denen man das Teil trägt'),
  kragen: str(NECK_NAMES, 'Kragen bzw. Ausschnitt, nur bei Oberteil, Kleid und Oberbekleidung'),
  verschluss: str(CLOSURES, 'Verschluss, nur wenn sichtbar'),
  traeger: str(STRAPS, 'Trägerart, nur bei Taschen'),
  weite: level(4, 'Passform Weite 0 schmal … 2 normal … 4 weit; nur Oberteil, Hose, Shorts'),
  laenge: level(4, 'Länge 0 kurz … 4 lang (bei Kleid/Rock: 0 Mini, 1 über Knie, 2 Knie, 3 Midi, 4 Maxi)'),
  bund: level(2, 'Bundhöhe 0 tief, 1 normal, 2 hoch; nur Hose, Shorts, Rock'),
  lagen: { type: 'array', items: { type: 'integer', enum: steps(3) }, description: `Mögliche Lagen: ${LAYERS.map((l, i) => `${i} ${l}`).join(', ')}; nur Oberteil und Oberbekleidung` },
  waerme: level(3, `Wärme: ${WARMTH.map((w, i) => `${i} ${w}`).join(', ')}`),
  regen: level(2, `Regentauglich: ${RAIN.map((r, i) => `${i} ${r}`).join(', ')}`),
};

export const ANALYZE_ITEM_SCHEMA: JsonSchema = {
  type: 'object',
  properties: ANALYZE_ITEM_PROPS,
  required: Object.keys(ANALYZE_ITEM_PROPS),
  additionalProperties: false,
};

export const ANALYZE_ITEM_PROMPT = `Du siehst ein Kleidungsstück oder Accessoire (Produktbild oder Handyfoto).
Fülle den Steckbrief nur mit Werten aus den vorgegebenen Listen.
Erkenne nur, was im Bild sichtbar ist. Bei Unsicherheit null bzw. leere Liste statt raten – außer beim Material, das darfst du schätzen.
Bewerte nur das Hauptteil im Bild, nicht Person, Hintergrund oder andere Teile.`;

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
  fit: { width: number | null; length: number | null; rise: number | null };
  layers: number[];
  warmth: number | null;
  rain: number | null;
};

type Raw = Record<string, unknown>;
const pickStr = (v: unknown, allowed: readonly string[]): string | null => (typeof v === 'string' && allowed.includes(v) ? v : null);
const pickList = (v: unknown, allowed: readonly string[], max = Infinity): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && allowed.includes(x)))].slice(0, max) : [];
const pickLevel = (v: unknown, max: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max ? v : null;
const text = (v: unknown, max = 80): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/** Kategorie-Text → Pfad; ungültig → ohne Kategorie */
export function parsePath(v: unknown): CategoryPath {
  const [category = null, subcategory = null, type = null] = typeof v === 'string' ? v.split(SEP) : [];
  const p = { category, subcategory, type };
  return isValidPath(p) ? p : { category: null, subcategory: null, type: null };
}

/**
 * Rohantwort der KI → saubere Werte. Ungültiges wird verworfen statt abgelehnt,
 * Felder, die es für die erkannte Kategorie nicht gibt, bleiben leer (fieldsFor / fitScalesOf).
 */
export function checkAnalysis(raw: unknown): Analysis {
  const r: Raw = raw && typeof raw === 'object' ? (raw as Raw) : {};
  const path = parsePath(r.kategorie);
  const f = fieldsFor(path.category, path.subcategory);
  const scales = new Set(fitScalesOf(path.category).map((s) => s.key));
  const neck = f.neckline?.options ?? [];
  let colors = pickList(r.farben, COLOR_NAMES, MAX_COLORS);
  if (colors.includes('Bunt')) colors = ['Bunt'];
  return {
    path,
    name: text(r.name),
    brand: text(r.marke, 40),
    colors,
    pattern: f.pattern ? pickStr(r.muster, PATTERNS) : null,
    materials: pickList(r.material, MATERIALS, 3).map((name) => ({ name })),
    styles: pickList(r.stil, STYLES, 3),
    seasons: SEASONS.filter((s) => pickList(r.saison, SEASONS).includes(s)),
    collar: pickStr(r.kragen, neck),
    closure: f.closure ? pickStr(r.verschluss, CLOSURES) : null,
    strap: f.strap ? pickStr(r.traeger, STRAPS) : null,
    fit: {
      width: scales.has('width') ? pickLevel(r.weite, 4) : null,
      length: scales.has('length') ? pickLevel(r.laenge, 4) : null,
      rise: scales.has('rise') ? pickLevel(r.bund, 2) : null,
    },
    layers: f.layers && Array.isArray(r.lagen) ? [...new Set(r.lagen.filter((x) => pickLevel(x, 3) !== null) as number[])].sort() : [],
    warmth: f.weather ? pickLevel(r.waerme, 3) : null,
    rain: f.weather ? pickLevel(r.regen, 2) : null,
  };
}

// ---------- Ins Formular übernehmen ----------

/**
 * Vorschläge nur in leere oder noch unbestätigte Felder schreiben; jedes übernommene Feld kommt in `aiPending`
 * (wird beim Ändern oder Bestätigen wieder entfernt, siehe setField / confirmAi).
 */
export function applyAnalysis(form: EditForm, a: Analysis): EditForm {
  let f = form;
  const marked: string[] = [];
  // Noch nicht bestätigte Vorschläge (z. B. Farbe aus dem Foto) gelten als leer und dürfen ersetzt werden
  const open = new Set(form.aiPending);
  const put = <K extends keyof EditForm>(k: K, v: EditForm[K], empty: boolean, has: boolean) => {
    if (!(empty || open.has(k)) || !has) return;
    f = setField(f, k, v);
    marked.push(k);
  };
  if ((!f.category || open.has('category')) && a.path.category) {
    f = setCategory(f, a.path);
    marked.push('category');
  }
  put('name', a.name ?? '', !f.name.trim(), !!a.name);
  put('brand', a.brand ?? '', !f.brand.trim(), !!a.brand);
  put('colors', a.colors, f.colors.length === 0, a.colors.length > 0);
  put('pattern', a.pattern, f.pattern == null, a.pattern != null);
  put('materials', a.materials, f.materials.length === 0, a.materials.length > 0);
  put('styles', a.styles, f.styles.length === 0, a.styles.length > 0);
  put('seasons', a.seasons, f.seasons.length === 0, a.seasons.length > 0);
  put('collar', a.collar, f.collar == null, a.collar != null);
  put('closure', a.closure, f.closure == null, a.closure != null);
  put('strap', a.strap, f.strap == null, a.strap != null);
  const fitEmpty = f.fit.width == null && f.fit.length == null && f.fit.rise == null;
  put('fit', a.fit, fitEmpty, a.fit.width != null || a.fit.length != null || a.fit.rise != null);
  put('layers', a.layers, f.layers.length === 0, a.layers.length > 0);
  put('warmth', a.warmth, f.warmth == null, a.warmth != null);
  put('rain', a.rain, f.rain == null, a.rain != null);
  return { ...f, aiPending: [...new Set([...f.aiPending, ...marked])] };
}
