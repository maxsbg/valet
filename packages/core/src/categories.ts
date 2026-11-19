// Kategorie → Unterkategorie → Typ (VALET_DETAILSEITE_SPEC.md, Abschnitt 8, Stand 15.11.2026)
// Reihenfolge nach Lagen: von außen/oben nach unten, Accessoires und Schmuck am Ende (Max, 15.11.2026).
// Shorts sind seit 15.11.2026 eine eigene Kategorie (vorher Hose › Shorts, Typen → Unterkategorien).
// Namensregeln: immer Einzahl, jeder Typ allein verständlich, kein „&“, Typ = nur Form.
// Gespeichert werden englische Keys (items.category / subcategory / item_type, seit 19.11.2026),
// die deutschen Labels stehen in docs/keys/key-zuordnung.json. `other` = „Sonstiges“, eindeutig innerhalb der Elternebene.

import { KEY_LISTS, label, toKey, type KeyCategoryNode, type KeyList } from './keys';

export type CategoryNode = KeyCategoryNode;

export const CATEGORY_TREE: readonly CategoryNode[] = KEY_LISTS.categories;

export type CategoryName = string;
/** Oberkategorien als Liste (Key + Label) */
export const CATEGORY_LIST: KeyList = CATEGORY_TREE.map(({ key, label }) => ({ key, label }));
/** Keys der Oberkategorien in fester Reihenfolge */
export const CATEGORY_KEYS: readonly string[] = CATEGORY_TREE.map((c) => c.key);

const node = (c: string | null | undefined) => CATEGORY_TREE.find((x) => x.key === c);
const subNode = (c: string | null | undefined, s: string | null | undefined) => node(c)?.subs.find((x) => x.key === s);

export const isCategory = (c: unknown): c is string => typeof c === 'string' && CATEGORY_KEYS.includes(c);
/** Unterkategorien einer Kategorie (Key + Label) */
export const subListOf = (c: string | null | undefined): KeyList => node(c)?.subs ?? [];
/** Typen einer Unterkategorie (Key + Label) */
export const typeListOf = (c: string | null | undefined, s: string | null | undefined): KeyList => subNode(c, s)?.types ?? [];
/** Keys der Unterkategorien */
export const subcategoriesOf = (c: string | null | undefined): string[] => subListOf(c).map((x) => x.key);
/** Keys der Typen */
export const typesOf = (c: string | null | undefined, s: string | null | undefined): string[] => typeListOf(c, s).map((x) => x.key);

/** Deutsche Labels je Ebene (unbekannt → der Wert selbst) */
export const categoryName = (c: string | null | undefined): string => label(CATEGORY_LIST, c);
export const subcategoryName = (c: string | null | undefined, s: string | null | undefined): string => (s ? label(subListOf(c), s) : '');
export const typeName = (c: string | null | undefined, s: string | null | undefined, t: string | null | undefined): string => (t ? label(typeListOf(c, s), t) : '');

/** Kategorie-Pfad eines Teils (Keys) */
export type CategoryPath = { category: string | null; subcategory: string | null; type: string | null };

/** Gültiger Pfad? Typ nur, wenn es die Unterkategorie gibt und der Typ zu ihr gehört. */
export function isValidPath(p: CategoryPath): boolean {
  if (!p.category) return !p.subcategory && !p.type;
  if (!isCategory(p.category)) return false;
  if (!p.subcategory) return !p.type;
  if (!subcategoriesOf(p.category).includes(p.subcategory)) return false;
  return !p.type || typesOf(p.category, p.subcategory).includes(p.type);
}

/**
 * Pfad aus Keys oder deutschen Labels → Keys (tolerantes Lesen). Unbekannte Kategorie → null;
 * unbekannte Unterkategorie bzw. Typ fallen weg.
 */
export function pathToKeys(p: { category?: string | null; subcategory?: string | null; type?: string | null }): CategoryPath {
  const category = toKey(CATEGORY_LIST, p.category);
  if (!category) return { category: null, subcategory: null, type: null };
  const subcategory = toKey(subListOf(category), p.subcategory);
  const type = subcategory ? toKey(typeListOf(category, subcategory), p.type) : null;
  return { category, subcategory, type };
}

/** Anzeige: nur die letzte gewählte Stufe als Label (Spec 4). */
export const categoryLast = (p: Partial<CategoryPath>): string =>
  typeName(p.category, p.subcategory, p.type) || subcategoryName(p.category, p.subcategory) || (p.category ? categoryName(p.category) : '');

/** Auswahl im Formular (Spec 7): neue Oberkategorie setzt Unterkategorie und Typ zurück, erneut tippen hebt auf. */
export function pickCategory(p: CategoryPath, level: 'category' | 'subcategory' | 'type', key: string): CategoryPath {
  if (level === 'category') return p.category === key ? { category: null, subcategory: null, type: null } : { category: key, subcategory: null, type: null };
  if (level === 'subcategory') return { ...p, subcategory: p.subcategory === key ? null : key, type: null };
  return { ...p, type: p.type === key ? null : key };
}

// ---------- Passform je Kategorie (Stufen-Index) ----------

export type FitScale = { key: 'width' | 'length' | 'rise'; label: string; steps: readonly string[] };
const WIDTH: FitScale = { key: 'width', label: 'Weite', steps: ['schmal', 'eher schmal', 'normal', 'eher weit', 'weit'] };
const LENGTH: FitScale = { key: 'length', label: 'Länge', steps: ['kurz', 'eher kurz', 'normal', 'eher lang', 'lang'] };
const DRESS_LENGTH: FitScale = { key: 'length', label: 'Länge', steps: ['Mini', 'über Knie', 'Knie', 'Midi', 'Maxi'] };
const RISE: FitScale = { key: 'rise', label: 'Bund', steps: ['tief', 'normal', 'hoch'] };

/** Skalen je Kategorie; alle anderen Kategorien haben keine Passform-Zeile. */
export const FIT_SCALES: Readonly<Record<string, readonly FitScale[]>> = {
  top: [WIDTH, LENGTH],
  pants: [WIDTH, LENGTH, RISE],
  shorts: [WIDTH, LENGTH, RISE],
  dress: [DRESS_LENGTH],
  skirt: [DRESS_LENGTH, RISE],
};
export const fitScalesOf = (c: string | null | undefined): readonly FitScale[] => (c && FIT_SCALES[c]) || [];

/** Shop-Begriffe → Stufen (für die KI und das Auslesen). Tapered, Bootcut, Flared entfallen. */
export const FIT_TERMS: Readonly<Record<string, Partial<Record<FitScale['key'], number>>>> = {
  slim: { width: 0 }, relaxed: { width: 3 }, oversized: { width: 4, length: 4 }, boxy: { width: 4, length: 0 },
  cropped: { length: 0 }, baggy: { width: 4 }, 'high waist': { rise: 2 }, 'low rise': { rise: 0 },
};

// ---------- Darstellung im Mosaik und auf dem Outfit-Board ----------

/**
 * Grobe Form für Kachelhöhe, Platzhalter-Silhouette und Board-Anordnung
 * (entspricht den alten Kategorien des alten Valet, plus Kleid/Rock/Kopf).
 */
export type LayoutKind = 'mantel' | 'jacke' | 'pullover' | 'oberteil' | 'sport' | 'kleid' | 'hose' | 'shorts' | 'rock' | 'schuhe' | 'tasche' | 'kopf' | 'accessoire';

export function layoutKind(category: string | null | undefined, subcategory?: string | null): LayoutKind {
  switch (category) {
    case 'top':
      if (subcategory === 'sweatshirt' || subcategory === 'hoodie' || subcategory === 'sweater' || subcategory === 'sweater_vest') return 'pullover';
      return subcategory === 'sports_top' ? 'sport' : 'oberteil';
    case 'dress': return 'kleid';
    case 'pants': return subcategory === 'pajama_pants' ? 'shorts' : 'hose';
    case 'shorts': return 'shorts';
    case 'skirt': return 'rock';
    case 'outerwear':
      return subcategory === 'coat' || subcategory === 'trench_coat' || subcategory === 'parka' ? 'mantel' : 'jacke';
    case 'shoe': return 'schuhe';
    case 'bag': return 'tasche';
    case 'headwear': return 'kopf';
    default: return 'accessoire';
  }
}

/**
 * Kachelhöhe im Mosaik (Max, 17.11.2026) – eigene Regel, das Outfit-Board nutzt weiter `layoutKind`.
 * Liefert eine Form, deren Seitenverhältnis die Kachel bekommt. Neben der Unterkategorie zählen Typ
 * und bei Kleid/Rock die Länge aus der Passform (0 Mini, 1 über Knie, 2 Knie, 3 Midi, 4 Maxi).
 */
const TILE_BY_TYPE: Readonly<Record<string, LayoutKind>> = {
  // kurz geschnittene Mäntel wie Jacken (Carcoat bleibt Mantel: meist oberschenkellang)
  peacoat: 'jacke',
  // lange Teile
  robe: 'mantel', nightgown: 'kleid', knee_boot: 'tasche', over_knee_boot: 'tasche', rain_boot: 'tasche',
  // Accessoires, die eigentlich Kleidung sind
  undershirt: 'oberteil', swimsuit: 'oberteil', boxer_shorts: 'shorts', swim_shorts: 'shorts', swim_briefs: 'shorts',
  sleep_shorts: 'shorts',
};
const TILE_BY_SUB: Readonly<Record<string, LayoutKind>> = {
  vest: 'oberteil', bolero: 'oberteil', playsuit: 'jacke', tunic: 'jacke', mermaid_skirt: 'hose',
  pajama_pants: 'hose', traditional_clothing: 'kleid',
};

export function tileKind(category: string | null | undefined, subcategory?: string | null, type?: string | null, fitLength?: number | null): LayoutKind {
  if (type && TILE_BY_TYPE[type]) return TILE_BY_TYPE[type]!;
  if (category === 'dress' && fitLength != null) return fitLength <= 1 ? 'jacke' : 'kleid';
  if (category === 'skirt' && fitLength != null) return fitLength >= 4 ? 'hose' : 'rock';
  if (subcategory && TILE_BY_SUB[subcategory]) return TILE_BY_SUB[subcategory]!;
  return layoutKind(category, subcategory);
}

/** Kategorien, die im Outfit „nebenbei“ laufen (keine Hauptlage). */
export const SIDE_CATEGORIES: ReadonlySet<string> = new Set(['bag', 'headwear', 'jewelry', 'accessory']);

// ---------- Reihenfolge am Körper (Set-Karte, Spec 3) ----------

/** Kopf → Oberbekleidung → Oberteil/Kleid → Hose/Rock → Schuhe → Taschen, Schmuck, Sonstiges */
const BODY_ORDER: Record<string, number> = { headwear: 0, outerwear: 1, top: 2, dress: 2, pants: 3, shorts: 3, skirt: 3, shoe: 4, bag: 5, jewelry: 5, accessory: 5 };
/** Lagen innerhalb einer Kategorie: außen vor innen (kleiner = weiter außen) */
const OUTER_FIRST: Record<string, number> = {
  coat: 0, trench_coat: 0, parka: 0, puffer_jacket: 1, shearling_jacket: 1, biker_jacket: 1, field_jacket: 1, sports_jacket: 1, blouson: 1, varsity_jacket: 1,
  coach_jacket: 1, trucker_jacket: 1, overshirt: 2, blazer: 2, sweat_jacket: 3, cardigan: 3, vest: 4, bolero: 4,
  hoodie: 0, sweatshirt: 0, sweater: 0, sweater_vest: 1, shirt: 2, blouse: 2, polo: 3, long_sleeve: 3, t_shirt: 4, sports_top: 4,
  sleeveless_shirt: 5, tank_top: 5, strapless_top: 5, crop_top: 5, bodysuit: 6,
};

/**
 * Sortiert Set-Teile von oben nach unten am Körper; bei gleicher Stelle außen vor innen.
 * „Außen“ kommt aus den Lagen des Teils (0 Unterlage … 3 Außen), sonst aus der Unterkategorie.
 */
export function setOrder<T extends { category: string | null; subcategory?: string | null; layers?: readonly number[] | null }>(items: readonly T[]): T[] {
  const body = (i: T) => BODY_ORDER[i.category ?? ''] ?? 6;
  const outer = (a: T, b: T) => {
    if (a.layers?.length && b.layers?.length) return Math.max(...b.layers) - Math.max(...a.layers);
    return (OUTER_FIRST[a.subcategory ?? ''] ?? 9) - (OUTER_FIRST[b.subcategory ?? ''] ?? 9);
  };
  return items.map((it, k) => ({ it, k })).sort((a, b) => body(a.it) - body(b.it) || outer(a.it, b.it) || a.k - b.k).map((x) => x.it);
}
