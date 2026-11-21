// Kategorie → Unterkategorie → Typ (VALET_DETAILSEITE_SPEC.md, Abschnitt 8, Stand 15.11.2026)
// Reihenfolge nach Lagen: von außen/oben nach unten, Accessoires und Schmuck am Ende (Max, 15.11.2026).
// Shorts sind seit 15.11.2026 eine eigene Kategorie (vorher Hose › Shorts, Typen → Unterkategorien).
// Namensregeln: immer Einzahl, jeder Typ allein verständlich, kein „&“, Typ = nur Form.
// Gespeichert werden englische Keys (items.category / subcategory / item_type, seit 19.11.2026),
// die deutschen Labels stehen in docs/keys/key-zuordnung.json. `other` = „Sonstiges“, eindeutig innerhalb der Elternebene.

import { KEY_LISTS, label, toKey, type KeyCategoryNode, type KeyList } from './keys';
import { layersOf } from './fields';

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

/**
 * Skala je Kategorie: `keys` = englische Begriffe (KI, Namen, Umrechnen), `steps` = Anzeige. Gespeichert wird der
 * Index (items.fit_width/fit_length/fit_rise). Begriffe statt „schmal … weit“ seit 20.11.2026 (Max), Migration 0016.
 */
export type FitScale = { key: 'width' | 'length' | 'rise'; label: string; keys: readonly string[]; steps: readonly string[] };
const scale = (key: FitScale['key'], label: string, pairs: string): FitScale => {
  const list = pairs.split(' · ').map((p) => { const i = p.indexOf(' '); return [p.slice(0, i), p.slice(i + 1)] as const; });
  return { key, label, keys: list.map(([k]) => k), steps: list.map(([, l]) => l) };
};
const TOP_WIDTH = scale('width', 'Weite', 'slim Slim · regular Regular · relaxed Relaxed · oversized Oversized');
const PANTS_WIDTH = scale('width', 'Weite', 'skinny Skinny · slim Slim · regular Regular · relaxed Relaxed · wide Wide');
const SHORTS_WIDTH = scale('width', 'Weite', 'slim Slim · regular Regular · relaxed Relaxed · wide Wide');
const TOP_LENGTH = scale('length', 'Länge', 'cropped Cropped · regular Regular · longline Longline');
// Hosenlänge (Max, 21.11.2026): „Long“ → „Stacked“ (Long heißt in Shops längere Größe), neu „Ankle“; Migration 0018 rechnet um
const PANTS_LENGTH_FIT = scale('length', 'Länge', 'cropped Cropped · ankle Ankle · regular Regular · stacked Stacked');
const SHORTS_LENGTH = scale('length', 'Länge', 'short Short · mid Mid · long Long');
const DRESS_LENGTH = scale('length', 'Länge', 'mini Mini · above_knee über Knie · knee Knie · midi Midi · maxi Maxi');
const RISE = scale('rise', 'Bund', 'low tief · regular normal · high hoch');

/** Skalen je Kategorie; alle anderen Kategorien haben keine Passform-Zeile. */
export const FIT_SCALES: Readonly<Record<string, readonly FitScale[]>> = {
  top: [TOP_WIDTH, TOP_LENGTH],
  pants: [PANTS_WIDTH, PANTS_LENGTH_FIT, RISE],
  shorts: [SHORTS_WIDTH, SHORTS_LENGTH, RISE],
  dress: [DRESS_LENGTH],
  skirt: [DRESS_LENGTH, RISE],
};
export const fitScalesOf = (c: string | null | undefined): readonly FitScale[] => (c && FIT_SCALES[c]) || [];
export const fitScaleOf = (c: string | null | undefined, k: FitScale['key']): FitScale | undefined => fitScalesOf(c).find((sc) => sc.key === k);

/** Alle Begriffe je Skala (für das KI-Schema), Reihenfolge wie in den Skalen */
export const FIT_KEYS: Readonly<Record<FitScale['key'], readonly string[]>> = {
  width: [...new Set([...PANTS_WIDTH.keys, ...TOP_WIDTH.keys])],
  length: [...new Set([...TOP_LENGTH.keys, ...PANTS_LENGTH_FIT.keys, ...SHORTS_LENGTH.keys, ...DRESS_LENGTH.keys])],
  rise: RISE.keys,
};
/** Gibt es einen Begriff in der Skala nicht, gilt der nächstliegende (Oberteil „wide“ = Oversized, Shorts „regular“ = Mid) */
const FIT_ALIAS: Readonly<Record<string, readonly string[]>> = {
  skinny: ['slim'], oversized: ['wide'], wide: ['oversized'], baggy: ['wide', 'oversized'],
  cropped: ['short'], short: ['cropped'], longline: ['long', 'stacked'], long: ['longline', 'stacked'], stacked: ['long', 'longline'], ankle: ['cropped', 'short'], regular: ['mid'], mid: ['regular'],
};
/** Begriff → Index in der Skala der Kategorie; passt nichts → null (z. B. „cropped“ bei Kleidern) */
export function fitIndex(category: string | null | undefined, k: FitScale['key'], word: unknown): number | null {
  const sc = fitScaleOf(category, k);
  if (!sc || typeof word !== 'string') return null;
  for (const w of [word, ...(FIT_ALIAS[word] ?? [])]) { const i = sc.keys.indexOf(w); if (i >= 0) return i; }
  return null;
}
/** Index → Begriff der Kategorie */
export const fitKey = (category: string | null | undefined, k: FitScale['key'], i: number | null | undefined): string | null =>
  i == null ? null : fitScaleOf(category, k)?.keys[i] ?? null;
/** Stufen beim Kategoriewechsel über den Begriff umrechnen (Oberteil Relaxed → Hose Relaxed); passt nichts → null */
export function convertFit<T extends Partial<Record<FitScale['key'], number | null>>>(from: string | null | undefined, to: string | null | undefined, fit: T): T {
  const out = { ...fit };
  // ohne Skala vorher (noch keine Kategorie) oder nachher (Feld versteckt, Wert bleibt gespeichert) bleibt die Stufe
  for (const k of ['width', 'length', 'rise'] as const) if (out[k] != null && fitScaleOf(from, k) && fitScaleOf(to, k)) (out as Record<string, number | null>)[k] = fitIndex(to, k, fitKey(from, k, out[k]));
  return out;
}
/** Anzeige eines Begriffs (erste Skala, die ihn kennt): „oversized“ → „Oversized“ */
export function fitWordLabel(k: FitScale['key'], word: string): string {
  for (const scales of Object.values(FIT_SCALES)) for (const sc of scales) if (sc.key === k && sc.keys.includes(word)) return sc.steps[sc.keys.indexOf(word)]!;
  return word;
}

/** Shop-Begriffe → Begriffe der Skalen (für die KI und das Auslesen). Tapered, Bootcut, Flared entfallen (Beinverlauf). */
export const FIT_TERMS: Readonly<Record<string, Partial<Record<FitScale['key'], string>>>> = {
  skinny: { width: 'skinny' }, slim: { width: 'slim' }, regular: { width: 'regular' }, relaxed: { width: 'relaxed' },
  oversized: { width: 'oversized', length: 'longline' }, boxy: { width: 'oversized', length: 'cropped' },
  cropped: { length: 'cropped' }, longline: { length: 'longline' }, baggy: { width: 'wide' }, 'high waist': { rise: 'high' }, 'low rise': { rise: 'low' },
};

// ---------- Darstellung im Mosaik und auf dem Outfit-Board ----------

/**
 * Grobe Form für Kachelhöhe, Platzhalter-Silhouette und Board-Anordnung
 * (entspricht den alten Kategorien des alten Valet, plus Kleid/Rock/Kopf).
 */
export type LayoutKind = 'coat' | 'jacket' | 'sweater' | 'top' | 'sport' | 'dress' | 'pants' | 'shorts' | 'skirt' | 'shoe' | 'bag' | 'headwear' | 'accessory';

export function layoutKind(category: string | null | undefined, subcategory?: string | null): LayoutKind {
  switch (category) {
    case 'top':
      if (subcategory === 'sweatshirt' || subcategory === 'hoodie' || subcategory === 'sweater' || subcategory === 'sweater_vest') return 'sweater';
      return subcategory === 'sports_top' ? 'sport' : 'top';
    case 'dress': return 'dress';
    case 'pants': return subcategory === 'pajama_pants' ? 'shorts' : 'pants';
    case 'shorts': return 'shorts';
    case 'skirt': return 'skirt';
    case 'outerwear':
      return subcategory === 'coat' || subcategory === 'trench_coat' || subcategory === 'parka' ? 'coat' : 'jacket';
    case 'shoe': return 'shoe';
    case 'bag': return 'bag';
    case 'headwear': return 'headwear';
    default: return 'accessory';
  }
}

/**
 * Kachelhöhe im Mosaik (Max, 17.11.2026) – eigene Regel, das Outfit-Board nutzt weiter `layoutKind`.
 * Liefert eine Form, deren Seitenverhältnis die Kachel bekommt. Neben der Unterkategorie zählen Typ
 * und bei Kleid/Rock die Länge aus der Passform (0 Mini, 1 über Knie, 2 Knie, 3 Midi, 4 Maxi).
 */
const TILE_BY_TYPE: Readonly<Record<string, LayoutKind>> = {
  // kurz geschnittene Mäntel wie Jacken (Carcoat bleibt Mantel: meist oberschenkellang)
  peacoat: 'jacket',
  // lange Teile
  robe: 'coat', nightgown: 'dress', knee_boot: 'bag', over_knee_boot: 'bag', rain_boot: 'bag',
  // Accessoires, die eigentlich Kleidung sind
  undershirt: 'top', swimsuit: 'top', boxer_shorts: 'shorts', swim_shorts: 'shorts', swim_briefs: 'shorts',
  sleep_shorts: 'shorts',
};
const TILE_BY_SUB: Readonly<Record<string, LayoutKind>> = {
  vest: 'top', bolero: 'top', playsuit: 'jacket', tunic: 'jacket', mermaid_skirt: 'pants',
  pajama_pants: 'pants', traditional_clothing: 'dress',
};

export function tileKind(category: string | null | undefined, subcategory?: string | null, type?: string | null, fitLength?: number | null): LayoutKind {
  if (type && TILE_BY_TYPE[type]) return TILE_BY_TYPE[type]!;
  if (category === 'dress' && fitLength != null) return fitLength <= 1 ? 'jacket' : 'dress';
  if (category === 'skirt' && fitLength != null) return fitLength >= 4 ? 'pants' : 'skirt';
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
 * „Außen“ kommt aus den Lagen des Teils (0 Basis … 3 Außen; ohne eigene die Vorgabe der Unterkategorie), sonst aus OUTER_FIRST.
 */
export function setOrder<T extends { category: string | null; subcategory?: string | null; layers?: readonly number[] | null }>(items: readonly T[]): T[] {
  const body = (i: T) => BODY_ORDER[i.category ?? ''] ?? 6;
  const outer = (a: T, b: T) => {
    const la = layersOf(a), lb = layersOf(b);
    if (la.length && lb.length) return Math.max(...lb) - Math.max(...la);
    return (OUTER_FIRST[a.subcategory ?? ''] ?? 9) - (OUTER_FIRST[b.subcategory ?? ''] ?? 9);
  };
  return items.map((it, k) => ({ it, k })).sort((a, b) => body(a.it) - body(b.it) || outer(a.it, b.it) || a.k - b.k).map((x) => x.it);
}
