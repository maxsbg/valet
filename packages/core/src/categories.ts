// Kategorie → Unterkategorie → Typ (VALET_DETAILSEITE_SPEC.md, Abschnitt 8, Stand 15.11.2026)
// Reihenfolge nach Lagen: von außen/oben nach unten, Accessoires und Schmuck am Ende (Max, 15.11.2026).
// Shorts sind seit 15.11.2026 eine eigene Kategorie (vorher Hose › Shorts, Typen → Unterkategorien).
// Namensregeln: immer Einzahl, jeder Typ allein verständlich, kein „&“, Typ = nur Form.
// Gespeichert werden die Namen selbst (items.category / subcategory / item_type).

export type CategoryNode = { name: string; subs: { name: string; types: string[] }[] };

/** Kurzschreibweise: "Name (Typ, Typ)" */
const sub = (s: string) => {
  const m = /^(.+?) \((.+)\)$/.exec(s);
  return m ? { name: m[1]!, types: m[2]!.split(', ') } : { name: s, types: [] };
};
const cat = (name: string, subs: string[]): CategoryNode => ({ name, subs: subs.map(sub) });

export const CATEGORY_TREE: readonly CategoryNode[] = [
  cat('Oberbekleidung', ['Mantel (Chesterfield-Mantel, Peacoat, Covert-Mantel, Duster-Mantel, Carcoat)', 'Trenchcoat', 'Parka', 'Steppjacke',
    'Blazer (Einreihiger Blazer, Zweireihiger Blazer)', 'Weste (Anzugweste, Steppweste, Strickweste)', 'Strickjacke', 'Sweatjacke (Zip-Hoodie)',
    'Hemdjacke', 'Shearlingjacke', 'Blouson (Bomberjacke, Harrington-Jacke)', 'Collegejacke', 'Coachjacke', 'Truckerjacke', 'Bikerjacke', 'Feldjacke',
    'Sportjacke (Anorak, Regenjacke, Windbreaker, Trainingsjacke, Thermojacke)', 'Bolero', 'Sonstiges (Poncho, Cape, Morgenmantel)']),
  cat('Oberteil', ['T-Shirt (Henley-T-Shirt)', 'Langarmshirt (Henley-Langarmshirt)', 'Ärmelloses Shirt', 'Trägertop', 'Trägerloses Top', 'Crop Top',
    'Polohemd (Kurzarm-Polohemd, Langarm-Polohemd)', 'Hemd (Kurzarmhemd, Langarmhemd)', 'Bluse (Kurzarmbluse, Langarmbluse, Ärmellose Bluse)',
    'Sweatshirt', 'Kapuzenpullover', 'Pullover', 'Pullunder', 'Sporttop (Trikot, Funktionsshirt, Sport-BH)', 'Body',
    'Pyjama-Oberteil (Pyjama-Shirt, Nachthemd)', 'Sonstiges']),
  cat('Kleid', ['T-Shirt-Kleid', 'Hemdkleid', 'Etuikleid', 'A-Linien-Kleid', 'Wickelkleid', 'Bodycon-Kleid', 'Shiftkleid', 'Slipdress', 'Skaterkleid',
    'Stufenkleid', 'Tunika', 'Mantelkleid', 'Jumpsuit', 'Playsuit', 'Sonstiges']),
  cat('Hose', ['Jeans', 'Stoffhose (Chino, Anzughose, Bundfaltenhose)', 'Cargohose', 'Jogginghose (Trainingshose)', 'Leggings', 'Latzhose',
    'Pyjama-Hose (Schlafshorts)', 'Sonstiges']),
  cat('Shorts', ['Sportshorts', 'Cargoshorts', 'Bermudashorts', 'Anzugshorts', 'Sonstiges']),
  cat('Rock', ['A-Linien-Rock', 'Bleistiftrock', 'Wickelrock', 'Plisseerock', 'Stufenrock', 'Tellerrock', 'Meerjungfrau-Rock', 'Sonstiges']),
  cat('Schuh', ['Sneaker (Low-Top-Sneaker, Mid-Top-Sneaker, High-Top-Sneaker, Chunky Sneaker, Plateau-Sneaker)',
    'Sportschuh (Laufschuh, Fußballschuh, Hallenschuh, Basketballschuh, Tennisschuh, Trainingsschuh)',
    'Halbschuh (Oxford-Schuh, Derby-Schuh, Monkstrap-Schuh, Loafer, Wholecut-Schuh, Bootsschuh, Mokassin)', 'Slip-On (Espadrille, Slipper)',
    'Stiefel (Chelsea Boot, Desert Boot, Schnürboot, Westernstiefel, Gummistiefel, Lammfellstiefel, Kniestiefel, Overknee-Stiefel)',
    'Wanderschuh (Wanderstiefel, Wanderhalbschuh, Trailrunning-Schuh)', 'Sandale (Trekkingsandale, Riemchensandale, Gladiatorensandale)',
    'Pantolette (Badelatsche, Flip-Flop, Mule)', 'Hausschuh', 'Clog', 'Flacher Schuh (Ballerina, Mary-Jane-Schuh, Slingback)',
    'High Heel (Pumps, Stiletto, Blockabsatzschuh, Keilabsatzschuh, Plateau-Heel, Sandalette, Mule Heel)', 'Sonstiges']),
  cat('Kopfbedeckung', ['Kappe (Baseball-Cap, Flat-Brim-Cap, Trucker-Cap, 5-Panel-Cap, Dad Cap)', 'Hut (Fedora, Bucket Hat, Sonnenhut, Panamahut)',
    'Mütze (Beanie, Baskenmütze, Schiebermütze)', 'Hijab', 'Sonstiges']),
  cat('Tasche', ['Handtasche (Shopper, Hobo-Bag, Bowlingtasche, Satchel, Baguette-Bag, Halbmondtasche, Satteltasche, Barrel-Bag)',
    'Clutch (Minaudière)', 'Rucksack', 'Bauchtasche', 'Stoffbeutel (Jutebeutel, Turnbeutel)', 'Reisetasche (Weekender, Duffel-Bag, Sporttasche)',
    'Arbeitstasche (Aktentasche, Laptoptasche)', 'Koffer', 'Sonstiges']),
  cat('Accessoire', ['Unterwäsche (Boxershorts, Slip, Unterhemd, BH, Thermowäsche)', 'Socke (Sneakersocke, Sportsocke, Stutzen, Kniestrumpf)',
    'Strumpfhose', 'Bademode (Badeshorts, Badehose, Bikini, Badeanzug)', 'Gürtel', 'Schal (Strickschal, Loop-Schal, Halstuch, Bandana)',
    'Anzug-Accessoire (Krawatte, Fliege, Einstecktuch, Manschettenknopf)', 'Handschuh (Fingerhandschuh, Fäustling, Sporthandschuh, Torwarthandschuh)',
    'Brille (Sehbrille, Sonnenbrille)', 'Haarschmuck', 'Geldbörse', 'Handyhülle', 'Traditionelle Kleidung', 'Stulpe', 'Sonstiges']),
  cat('Schmuck', ['Ohrring', 'Halskette', 'Armband', 'Ring', 'Brosche', 'Uhr', 'Sonstiges']),
];

export type CategoryName = string;
export const CATEGORY_NAMES: readonly string[] = CATEGORY_TREE.map((c) => c.name);

export const isCategory = (c: unknown): c is string => typeof c === 'string' && CATEGORY_NAMES.includes(c);
export const subcategoriesOf = (c: string | null | undefined): string[] =>
  CATEGORY_TREE.find((x) => x.name === c)?.subs.map((s) => s.name) ?? [];
export const typesOf = (c: string | null | undefined, s: string | null | undefined): string[] =>
  CATEGORY_TREE.find((x) => x.name === c)?.subs.find((x) => x.name === s)?.types ?? [];

/** Kategorie-Pfad eines Teils */
export type CategoryPath = { category: string | null; subcategory: string | null; type: string | null };

/** Gültiger Pfad? Typ nur, wenn es die Unterkategorie gibt und der Typ zu ihr gehört. */
export function isValidPath(p: CategoryPath): boolean {
  if (!p.category) return !p.subcategory && !p.type;
  if (!isCategory(p.category)) return false;
  if (!p.subcategory) return !p.type;
  if (!subcategoriesOf(p.category).includes(p.subcategory)) return false;
  return !p.type || typesOf(p.category, p.subcategory).includes(p.type);
}

/** Anzeige: nur die letzte gewählte Stufe (Spec 4). */
export const categoryLast = (p: Partial<CategoryPath>): string => p.type || p.subcategory || p.category || '';

/** Auswahl im Formular (Spec 7): neue Oberkategorie setzt Unterkategorie und Typ zurück, erneut tippen hebt auf. */
export function pickCategory(p: CategoryPath, level: 'category' | 'subcategory' | 'type', name: string): CategoryPath {
  if (level === 'category') return p.category === name ? { category: null, subcategory: null, type: null } : { category: name, subcategory: null, type: null };
  if (level === 'subcategory') return { ...p, subcategory: p.subcategory === name ? null : name, type: null };
  return { ...p, type: p.type === name ? null : name };
}

// ---------- Passform je Kategorie (Stufen-Index) ----------

export type FitScale = { key: 'width' | 'length' | 'rise'; label: string; steps: readonly string[] };
const WIDTH: FitScale = { key: 'width', label: 'Weite', steps: ['schmal', 'eher schmal', 'normal', 'eher weit', 'weit'] };
const LENGTH: FitScale = { key: 'length', label: 'Länge', steps: ['kurz', 'eher kurz', 'normal', 'eher lang', 'lang'] };
const DRESS_LENGTH: FitScale = { key: 'length', label: 'Länge', steps: ['Mini', 'über Knie', 'Knie', 'Midi', 'Maxi'] };
const RISE: FitScale = { key: 'rise', label: 'Bund', steps: ['tief', 'normal', 'hoch'] };

/** Skalen je Kategorie; alle anderen Kategorien haben keine Passform-Zeile. */
export const FIT_SCALES: Readonly<Record<string, readonly FitScale[]>> = {
  Oberteil: [WIDTH, LENGTH],
  Hose: [WIDTH, LENGTH, RISE],
  Shorts: [WIDTH, LENGTH, RISE],
  Kleid: [DRESS_LENGTH],
  Rock: [DRESS_LENGTH, RISE],
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
    case 'Oberteil':
      if (subcategory === 'Sweatshirt' || subcategory === 'Kapuzenpullover' || subcategory === 'Pullover' || subcategory === 'Pullunder') return 'pullover';
      return subcategory === 'Sporttop' ? 'sport' : 'oberteil';
    case 'Kleid': return 'kleid';
    case 'Hose': return subcategory === 'Pyjama-Hose' ? 'shorts' : 'hose';
    case 'Shorts': return 'shorts';
    case 'Rock': return 'rock';
    case 'Oberbekleidung':
      return subcategory === 'Mantel' || subcategory === 'Trenchcoat' || subcategory === 'Parka' ? 'mantel' : 'jacke';
    case 'Schuh': return 'schuhe';
    case 'Tasche': return 'tasche';
    case 'Kopfbedeckung': return 'kopf';
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
  Peacoat: 'jacke',
  // lange Teile
  Morgenmantel: 'mantel', Nachthemd: 'kleid', Kniestiefel: 'tasche', 'Overknee-Stiefel': 'tasche', Gummistiefel: 'tasche',
  // Accessoires, die eigentlich Kleidung sind
  Unterhemd: 'oberteil', Badeanzug: 'oberteil', Boxershorts: 'shorts', Badeshorts: 'shorts', Badehose: 'shorts',
  Schlafshorts: 'shorts',
};
const TILE_BY_SUB: Readonly<Record<string, LayoutKind>> = {
  Weste: 'oberteil', Bolero: 'oberteil', Playsuit: 'jacke', Tunika: 'jacke', 'Meerjungfrau-Rock': 'hose',
  'Pyjama-Hose': 'hose', 'Traditionelle Kleidung': 'kleid',
};

export function tileKind(category: string | null | undefined, subcategory?: string | null, type?: string | null, fitLength?: number | null): LayoutKind {
  if (type && TILE_BY_TYPE[type]) return TILE_BY_TYPE[type]!;
  if (category === 'Kleid' && fitLength != null) return fitLength <= 1 ? 'jacke' : 'kleid';
  if (category === 'Rock' && fitLength != null) return fitLength >= 4 ? 'hose' : 'rock';
  if (subcategory && TILE_BY_SUB[subcategory]) return TILE_BY_SUB[subcategory]!;
  return layoutKind(category, subcategory);
}

/** Kategorien, die im Outfit „nebenbei“ laufen (keine Hauptlage). */
export const SIDE_CATEGORIES: ReadonlySet<string> = new Set(['Tasche', 'Kopfbedeckung', 'Schmuck', 'Accessoire']);

// ---------- Reihenfolge am Körper (Set-Karte, Spec 3) ----------

/** Kopf → Oberbekleidung → Oberteil/Kleid → Hose/Rock → Schuhe → Taschen, Schmuck, Sonstiges */
const BODY_ORDER: Record<string, number> = { Kopfbedeckung: 0, Oberbekleidung: 1, Oberteil: 2, Kleid: 2, Hose: 3, Shorts: 3, Rock: 3, Schuh: 4, Tasche: 5, Schmuck: 5, Accessoire: 5 };
/** Lagen innerhalb einer Kategorie: außen vor innen (kleiner = weiter außen) */
const OUTER_FIRST: Record<string, number> = {
  Mantel: 0, Trenchcoat: 0, Parka: 0, Steppjacke: 1, Shearlingjacke: 1, Bikerjacke: 1, Feldjacke: 1, Sportjacke: 1, Blouson: 1, Collegejacke: 1,
  Coachjacke: 1, Truckerjacke: 1, Hemdjacke: 2, Blazer: 2, Sweatjacke: 3, Strickjacke: 3, Weste: 4, Bolero: 4,
  Kapuzenpullover: 0, Sweatshirt: 0, Pullover: 0, Pullunder: 1, Hemd: 2, Bluse: 2, Polohemd: 3, Langarmshirt: 3, 'T-Shirt': 4, Sporttop: 4,
  'Ärmelloses Shirt': 5, Trägertop: 5, 'Trägerloses Top': 5, 'Crop Top': 5, Body: 6,
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
