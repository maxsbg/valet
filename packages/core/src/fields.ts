// Welche Felder je Kategorie (VALET_DETAILSEITE_SPEC.md, Abschnitt 8a) – eine Quelle für Bearbeiten, Ansicht und KI-Prompt.
// Nicht gezeigte Felder bleiben in der Datenbank erhalten, sie werden nur ausgeblendet.

import { CATEGORY_NAMES } from './categories';
import { COLLARS, ONE_SIZE, SIZES, type SizeSystem } from './attributes';

/** Felder, die von der Kategorie abhängen (immer gezeigt: Kategorie, Saison, Farben, Material, Stil) */
export type FieldKey = 'pattern' | 'reversible' | 'size' | 'fit' | 'layers' | 'weather' | 'neckline' | 'closure' | 'strap' | 'care';
export const ALWAYS_FIELDS = ['category', 'seasons', 'colors', 'material', 'style'] as const;

/** true = ganze Kategorie, Liste = nur diese Unterkategorien, fehlt = nicht gezeigt */
type Rule = Partial<Record<string, true | readonly string[]>>;
const except = (...cats: string[]): Rule => Object.fromEntries(CATEGORY_NAMES.filter((c) => !cats.includes(c)).map((c) => [c, true as const]));

/** Pflege bei Accessoire nur für Textiles */
const ACC_CARE = ['Unterwäsche', 'Socke', 'Strumpfhose', 'Bademode', 'Schal', 'Anzug-Accessoire', 'Handschuh', 'Traditionelle Kleidung', 'Stulpe'] as const;
/** Wetter bei Accessoire nur für diese */
const ACC_WEATHER = ['Schal', 'Handschuh', 'Socke', 'Strumpfhose', 'Stulpe', 'Bademode'] as const;

/** Tabelle aus Spec 8a */
export const FIELD_RULES: Readonly<Record<FieldKey, Rule>> = {
  pattern: except('Schuh', 'Schmuck'),
  reversible: except('Schuh', 'Schmuck'),
  size: { ...except('Tasche', 'Schmuck'), Schmuck: ['Ring'] },
  fit: { Oberteil: true, Kleid: true, Hose: true, Rock: true },
  layers: { Oberteil: true, Oberbekleidung: true },
  weather: { ...except('Tasche', 'Schmuck', 'Accessoire'), Accessoire: ACC_WEATHER },
  neckline: { Oberteil: true, Kleid: true, Oberbekleidung: true },
  closure: { Oberteil: ['Hemd', 'Bluse', 'Polohemd', 'Body'], Oberbekleidung: true, Schuh: true, Tasche: true, Accessoire: ['Gürtel', 'Handschuh'] },
  strap: { Tasche: true },
  care: { ...except('Schuh', 'Tasche', 'Schmuck', 'Accessoire'), Accessoire: ACC_CARE },
};

/**
 * Feld für diese Kategorie zeigen?
 * Ohne Kategorie (neues Teil) wird alles gezeigt außer der Trägerart. Bei einer Liste von Unterkategorien
 * erscheint das Feld erst, wenn eine passende Unterkategorie gewählt ist.
 */
export function showField(key: FieldKey, category: string | null | undefined, subcategory?: string | null): boolean {
  if (!category) return key !== 'strap';
  const r = FIELD_RULES[key][category];
  if (r === true) return true;
  if (!r) return false;
  return !!subcategory && r.includes(subcategory);
}

/** Alle Felder, die für diese Kategorie gezeigt werden (Reihenfolge wie im Steckbrief) – auch für den KI-Prompt */
export function fieldsFor(category: string | null | undefined, subcategory?: string | null): string[] {
  const keys: FieldKey[] = ['pattern', 'reversible', 'size', 'fit', 'layers', 'weather', 'neckline', 'closure', 'strap', 'care'];
  return [...ALWAYS_FIELDS, ...keys.filter((k) => showField(k, category, subcategory))];
}

// ---------- Ausschnitt / Kragen ----------

export const NECKLINES = ['Rundhals', 'V-Ausschnitt', 'Knopfleiste', 'Polokragen', 'Rollkragen', 'Stehkragen', 'Kapuze'] as const;
export const OUTER_COLLARS = [...COLLARS, 'Kapuze'] as const;

/**
 * Eine Zeile, Name und Werte nach Unterkategorie (gespeichert in items.collar):
 * Hemd, Bluse → „Kragen“; übrige Oberteile und Kleid → „Ausschnitt“; Oberbekleidung → „Kragen“ + Kapuze.
 * Ohne Kategorie: „Kragen“ wie bisher.
 */
export function necklineOf(category: string | null | undefined, subcategory?: string | null): { label: 'Kragen' | 'Ausschnitt'; options: readonly string[] } | null {
  if (!showField('neckline', category, subcategory)) return null;
  if (!category) return { label: 'Kragen', options: COLLARS };
  if (category === 'Oberbekleidung') return { label: 'Kragen', options: OUTER_COLLARS };
  if (category === 'Oberteil' && (subcategory === 'Hemd' || subcategory === 'Bluse')) return { label: 'Kragen', options: COLLARS };
  return { label: 'Ausschnitt', options: NECKLINES };
}

// ---------- Größe je Kategorie ----------

/**
 * clothes = Buchstaben/Zahlen (bisher); pants = W/L oder Buchstaben; waist = nur Bundweite (Shorts, Pyjama-Hose) oder Buchstaben;
 * shoe = EU; cap = Kappe (Verstellbar/Fitted); ring = Ringgröße.
 */
export type SizeKind = 'clothes' | 'pants' | 'waist' | 'shoe' | 'cap' | 'ring';

export function sizeKindOf(category: string | null | undefined, subcategory?: string | null): SizeKind | null {
  if (!showField('size', category, subcategory)) return null;
  switch (category) {
    case 'Hose': return subcategory === 'Shorts' || subcategory === 'Pyjama-Hose' ? 'waist' : 'pants';
    case 'Schuh': return 'shoe';
    case 'Kopfbedeckung': return subcategory === 'Kappe' ? 'cap' : 'clothes';
    case 'Schmuck': return 'ring';
    default: return 'clothes';
  }
}

export const WAISTS: readonly number[] = Array.from({ length: 15 }, (_, i) => 26 + i); // W26–W40
export const INSEAMS: readonly number[] = Array.from({ length: 9 }, (_, i) => 28 + i); // L28–L36
export const SHOE_SIZES: readonly string[] = Array.from({ length: 27 }, (_, i) => { const n = 35 + i / 2; return Number.isInteger(n) ? String(n) : `${Math.floor(n)},5`; });
export const CAP_SIZES = ['Verstellbar', 'Fitted'] as const;
export const RING_SIZES: readonly string[] = Array.from({ length: 19 }, (_, i) => String(48 + i)); // 48–66

/** Wählbare Systeme je Größen-Art (leer = kein System-Wähler); das erste ist der Standard */
export function sizeSystemsFor(kind: SizeKind | null): SizeSystem[] {
  if (kind === 'clothes') return ['letters', 'numbers'];
  if (kind === 'pants' || kind === 'waist') return ['wl', 'letters'];
  return [];
}

/** System, das gerade gilt: bei Hosen ist W/L Standard */
export function effectiveSizeSystem(kind: SizeKind | null, system: SizeSystem | null): SizeSystem | null {
  const list = sizeSystemsFor(kind);
  if (system && list.includes(system)) return system;
  return kind === 'pants' || kind === 'waist' ? 'wl' : null;
}

/** Größen zum Antippen (W/L hat eigene Reihen → leer) */
export function sizeOptions(kind: SizeKind | null, system: SizeSystem | null): readonly string[] {
  switch (kind) {
    case 'shoe': return SHOE_SIZES;
    case 'cap': return CAP_SIZES;
    case 'ring': return RING_SIZES;
    case 'pants': case 'waist': return effectiveSizeSystem(kind, system) === 'letters' ? SIZES.letters : [];
    case 'clothes': return system === 'letters' || system === 'numbers' ? SIZES[system] : [ONE_SIZE];
    default: return [];
  }
}

/** Freie Angabe erlaubt? Bei Hosen nicht mehr (Spec 7: kein Freitext). */
export const allowsCustomSize = (kind: SizeKind | null) => kind != null && kind !== 'pants' && kind !== 'waist';

// ---------- Hosengröße W/L ----------

export type WL = { w: number | null; l: number | null };

/**
 * Freitext → Bundweite/Länge. Erkennt „W28/L32“, „W 28 / L 32“, „28/32“, „28x32“, „W30 L34“, „W30“.
 * Alles andere (z. B. „L“, „50“) → null.
 */
export function parseWL(size: string | null | undefined): WL | null {
  const s = (size ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (!s) return null;
  let m = /^W ?(\d{2})(?: ?[/X×]? ?L ?(\d{2}))?$/.exec(s);
  if (!m) m = /^(\d{2}) ?[/X×] ?(\d{2})$/.exec(s);
  if (!m) return null;
  const w = Number(m[1]), l = m[2] ? Number(m[2]) : null;
  if (w < 20 || w > 50 || (l != null && (l < 24 || l > 40))) return null;
  return { w, l };
}

/** Bundweite/Länge → Text für items.size („W28/L32“, nur Bund „W30“, nur Länge „L32“) */
export function formatWL(v: WL): string | null {
  if (v.w == null && v.l == null) return null;
  return [v.w != null ? `W${v.w}` : null, v.l != null ? `L${v.l}` : null].filter(Boolean).join('/');
}

/** Hosengröße im W/L-Format vereinheitlichen; passt sie nicht, bleibt sie unverändert (→ Liste für Max). */
export const normalizeWL = (size: string | null | undefined): string | null => {
  const p = parseWL(size);
  return p ? formatWL(p) : null;
};
