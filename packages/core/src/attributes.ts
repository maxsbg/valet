// Feste Listen für Steckbrief und Bearbeiten (Spec Abschnitte 4, 7, 8; Werte aus der Leinwand „Valet – Teil-Detailseite“)

import { KEY_LISTS, label, pickKeys, toKey, toKeys, type KeyList } from './keys';

// ---------- Farben ----------

// Gespeichert werden Keys (items.colors, seit 19.11.2026); Labels aus docs/keys/key-zuordnung.json.
export type ColorDef = { key: string; label: string; hex: string; nuances: readonly { key: string; label: string; hex: string }[] };
/** Alle Farben (Haupt- und Nuancen) in der Reihenfolge der Palette, mit deutschem Label */
export const COLOR_LIST: KeyList = KEY_LISTS.colors;
export const colorLabel = (key: string | null | undefined): string => label(COLOR_LIST, key);
const c = (key: string, hex: string, nuances: [string, string][] = []): ColorDef => ({
  key, label: colorLabel(key), hex, nuances: nuances.map(([k, h]) => ({ key: k, label: colorLabel(k), hex: h })),
});

/** Eigenständige Farben (Hauptfarben, Türkis, Neutral, Sonder) mit ihren Nuancen. „Bunt“ hat keinen festen Wert (Verlauf). */
export const COLORS: readonly ColorDef[] = [
  c('yellow', '#e8c547', [['light_yellow', '#f3e38f'], ['mustard', '#c99a1e']]),
  c('orange', '#e8822e', [['coral', '#ef7f62'], ['terracotta', '#b8573a']]),
  c('red', '#c0392b', [['burgundy', '#7e1f2e'], ['maroon', '#6e2b26']]),
  c('pink', '#e07aa0', [['rose', '#f2b6c6'], ['dusty_rose', '#c99098'], ['magenta', '#c2187a']]),
  c('green', '#4f8a4a', [['mint', '#a8dcc0'], ['light_green', '#8cc56b'], ['olive', '#6b7a3c'], ['khaki', '#9a9461'], ['dark_green', '#2f5a37'], ['moss', '#5c6420'], ['sage', '#9aab8a']]),
  c('blue', '#3567b0', [['sky_blue', '#8ec3e8'], ['navy', '#1f2f55'], ['petrol', '#1f6b72'], ['cyan', '#39c2d7']]),
  c('turquoise', '#2ba5a5'),
  c('purple', '#7d55b0', [['lavender', '#c3b5e6'], ['lilac', '#b892c8'], ['violet', '#5b2d8e'], ['mauve', '#90627c']]),
  c('white', '#ffffff'), c('ivory', '#efe6d2'), c('beige', '#d9c7a7'), c('sand', '#c9b38c'), c('taupe', '#8f8172'), c('camel', '#b98a55'), c('brown', '#6b4a33', [['caramel', '#94501f'], ['chocolate', '#4a2c21']]),
  c('light_grey', '#c4c4c4'), c('dark_grey', '#555555'), c('charcoal', '#36393d'), c('black', '#1c1c1c'),
  c('gold', '#cfa94a'), c('silver', '#b9bec4'), c('bronze', '#a86b3c'), c('multicolor', ''),
];
export const MULTICOLOR = 'multicolor';
export const MULTICOLOR_STOPS = ['#e8c547', '#e8822e', '#c0392b', '#7d55b0', '#3567b0', '#4f8a4a'] as const;
export const MAX_COLORS = 3;

const HEX: Record<string, string> = {};
const FAMILY: Record<string, string> = {};
for (const m of COLORS) { HEX[m.key] = m.hex; FAMILY[m.key] = m.key; for (const n of m.nuances) { HEX[n.key] = n.hex; FAMILY[n.key] = m.key; } }

export const colorHex = (key: string): string | null => HEX[key] || null;
export const isColor = (key: unknown): key is string => typeof key === 'string' && key in HEX;
/** Hauptfarbe zu einer Nuance (oder sich selbst) */
export const colorFamily = (key: string): string | null => FAMILY[key] ?? null;
export const nuancesOf = (main: string) => COLORS.find((x) => x.key === main)?.nuances ?? [];

/** Ziffernfarbe im Farbkreis: dunkel auf hellen, weiß auf dunklen Farben */
export function rankInk(hex: string | null): '#2a1a1d' | '#ffffff' {
  if (!hex || hex[0] !== '#') return '#ffffff';
  const v = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255);
  return 0.2126 * v[0]! + 0.7152 * v[1]! + 0.0722 * v[2]! > 0.55 ? '#2a1a1d' : '#ffffff';
}

/** Zustand der Farbauswahl: gewählte Farben (Rang = Reihenfolge) und die gerade aufgeklappte Hauptfarbe */
export type ColorPick = { colors: string[]; open: string | null; full: boolean };

const famIndex = (colors: string[], main: string) => colors.findIndex((x) => FAMILY[x] === main);

/**
 * Hauptfarbe antippen (Spec 7, Farben 2–4):
 * neu → angehängt und aufgeklappt; Nuance gewählt → zurück zur Hauptfarbe; Hauptfarbe gewählt → abgewählt.
 * Ist sie gewählt, aber nicht aufgeklappt, klappt der erste Tipp nur auf.
 */
export function tapMainColor(p: ColorPick, main: string): ColorPick {
  const hasNu = nuancesOf(main).length > 0;
  const i = famIndex(p.colors, main);
  const colors = p.colors.slice();
  if (i < 0) {
    if (colors.length >= MAX_COLORS) return { ...p, full: true };
    colors.push(main);
    return { colors, open: hasNu ? main : null, full: false };
  }
  if (colors[i] !== main) { colors[i] = main; return { colors, open: main, full: false }; }
  if (p.open === main || !hasNu) { colors.splice(i, 1); return { colors, open: p.open === main ? null : p.open, full: false }; }
  return { ...p, open: main, full: false };
}

/** Nuance antippen: ersetzt die Hauptfarbe auf demselben Rang; erneut → zurück zur Hauptfarbe. */
export function tapNuance(p: ColorPick, nuance: string): ColorPick {
  const main = FAMILY[nuance];
  if (!main) return p;
  const i = famIndex(p.colors, main);
  const colors = p.colors.slice();
  if (i >= 0) colors[i] = colors[i] === nuance ? main : nuance;
  else { if (colors.length >= MAX_COLORS) return { ...p, full: true }; colors.push(nuance); }
  return { colors, open: main, full: false };
}

/** Alte Farbnamen (freier Text, „Schwarz/Weiß“) → neue Palette (Label). Unbekannt → null. */
export const LEGACY_COLORS: Readonly<Record<string, string>> = {
  schwarz: 'Schwarz', weiß: 'Weiß', weiss: 'Weiß', braun: 'Braun', beige: 'Beige', blau: 'Blau', hellgrau: 'Hellgrau', silber: 'Silber',
  anthrazit: 'Anthrazit', sand: 'Sand', dunkelgrau: 'Dunkelgrau', gelb: 'Gelb', denim: 'Blau', creme: 'Elfenbein', burgunder: 'Burgunderrot', maroon: 'Maroon', maron: 'Maroon', karamell: 'Karamell', caramel: 'Karamell', rot: 'Rot',
  rosa: 'Rosa', gold: 'Gold', camel: 'Camel', orange: 'Orange', navy: 'Marineblau', oliv: 'Olivgrün', hellblau: 'Himmelblau', grün: 'Grün',
  pink: 'Pink', lila: 'Lila', türkis: 'Türkis', khaki: 'Khaki', taupe: 'Taupe', bronze: 'Bronze', elfenbein: 'Elfenbein',
};
/** Farbe lesen: Key, Label oder alter Farbname → Key */
export const toColorKey = (v: unknown): string | null =>
  toKey(COLOR_LIST, v) ?? (typeof v === 'string' ? toKey(COLOR_LIST, v.trim().toLowerCase(), LEGACY_COLORS) : null);
/** Farbliste lesen (Rang bleibt, Unbekanntes fällt weg) */
export const toColorKeys = (values: unknown): string[] => {
  const out: string[] = [];
  for (const v of Array.isArray(values) ? values : []) { const k = toColorKey(v); if (k && !out.includes(k)) out.push(k); }
  return out;
};

// ---------- Weitere Listen ----------

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASONS = KEY_LISTS.seasons as readonly { key: Season; label: string }[];
export const SEASON_KEYS: readonly Season[] = SEASONS.map((s) => s.key);
export const seasonLabel = (key: string | null | undefined): string => label(SEASONS, key);
/** Saisons lesen: Keys oder Labels; alte Saison „Übergang“ → Frühling + Herbst (entschieden 15.11.2026) */
export function migrateSeasons(old: readonly string[] | null | undefined): Season[] {
  const out = new Set<string>();
  for (const s of old ?? []) {
    if (s === 'Übergang') { out.add('spring'); out.add('autumn'); }
    else { const k = toKey(SEASONS, s); if (k) out.add(k); }
  }
  return SEASON_KEYS.filter((s) => out.has(s));
}

/**
 * Material (Reihenfolge der Liste: Pflanzenfasern, Tierfasern, Zellulosefasern, Kunstfasern, Stoffarten,
 * Leder/Fell/Füllung, Sonstiges). Gespeichert: items.materials = [{ name: Key, pct }].
 */
export const MATERIALS: KeyList = KEY_LISTS.materials;
export const materialLabel = (key: string | null | undefined): string => label(MATERIALS, key);
export type MaterialPart = { name: string; pct?: number | null };
/** Material-Liste lesen: Name als Key oder Label; Unbekanntes und Doppelte fallen weg, Prozent bleiben */
export function toMaterialParts(list: unknown): MaterialPart[] {
  const out: MaterialPart[] = [];
  for (const m of Array.isArray(list) ? list : []) {
    const name = toKey(MATERIALS, (m as MaterialPart | null)?.name);
    if (!name || out.some((x) => x.name === name)) continue;
    const pct = (m as MaterialPart).pct;
    out.push(pct == null ? { name } : { name, pct });
  }
  return out;
}

export const PATTERNS: KeyList = KEY_LISTS.patterns;
export const patternLabel = (key: string | null | undefined): string => label(PATTERNS, key);

export const STYLES: KeyList = KEY_LISTS.styles;
export const styleLabel = (key: string | null | undefined): string => label(STYLES, key);
/** Alte Stile → neue Liste („Schick“ wird je Teil entschieden, Vorgabe Klassisch) */
export const LEGACY_STYLES: Readonly<Record<string, string>> = { Casual: 'Lässig', Streetwear: 'Street', Business: 'Business Casual', Sport: 'Sportlich', Schick: 'Klassisch' };
/** Stile lesen: Key, Label oder alter Stil → Key */
export const toStyleKeys = (values: unknown): string[] => toKeys(STYLES, values, LEGACY_STYLES);

/** Kragen und Ausschnitte (eine Liste, Teillisten je Kategorie in fields.ts) */
export const COLLAR_LIST: KeyList = KEY_LISTS.collars;
export const collarLabel = (key: string | null | undefined): string => label(COLLAR_LIST, key);
/** Kragen bei Hemd und Bluse */
export const COLLARS: KeyList = pickKeys(COLLAR_LIST, ['classic_collar', 'button_down', 'stand_collar', 'lapel_collar', 'no_collar']);
export const CLOSURES: KeyList = KEY_LISTS.closures;
export const closureLabel = (key: string | null | undefined): string => label(CLOSURES, key);

// ---------- Größe ----------

/** wl = Hosengröße Bundweite/Länge (in der DB als leeres size_system gespeichert, Standard bei Hosen) */
export const SIZE_SYSTEMS = { letters: 'Buchstaben', numbers: 'Zahlen', wl: 'W/L' } as const;
export type SizeSystem = keyof typeof SIZE_SYSTEMS;
export const ONE_SIZE = 'One Size';
export const SIZES: Readonly<Record<'letters' | 'numbers', readonly string[]>> = {
  letters: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL', ONE_SIZE],
  numbers: ['44', '46', '48', '50', '52', '54', '56', '58', '60', ONE_SIZE],
};
/** Doppelgrößen (zweite Reihe unter den Buchstaben, gespeichert mit System „letters“) */
export const LETTER_DOUBLES = ['XS/S', 'S/M', 'M/L', 'L/XL', 'XL/XXL'] as const;
export const COLLAR_SIZES = ['37', '38', '39', '40', '41', '42', '43', '44', '45', '46'] as const;
/** Kragenweite nur für Unterkategorie Hemd (Spec 8) */
export const hasCollarSize = (subcategory: string | null | undefined) => subcategory === 'shirt';
/** Größen-System aus einer alten Größenangabe erkennen (nur eindeutige Fälle) */
export function sizeSystemOf(size: string | null | undefined): SizeSystem | null {
  const s = (size ?? '').trim();
  if ((SIZES.letters.includes(s) && s !== ONE_SIZE) || (LETTER_DOUBLES as readonly string[]).includes(s)) return 'letters';
  if (SIZES.numbers.includes(s) && s !== ONE_SIZE) return 'numbers';
  return null;
}

// ---------- Tragen ----------

export const LAYERS = ['Unterlage', 'Mitte, zu', 'Mitte, offen', 'Außen'] as const;
/** Alte Lage (basis / zu / offen) → Stufe */
export const LEGACY_LAYERS: Readonly<Record<string, number>> = { basis: 0, zu: 1, offen: 2 };
export const WARMTH = ['sehr leicht', 'leicht', 'mittel', 'warm'] as const;
export const RAIN = ['schlecht', 'mittel', 'gut'] as const;

// ---------- Pflege ----------

export type CareGroup = 'wash' | 'bleach' | 'dry' | 'iron' | 'pro';
export type CareSource = 'etikett' | 'geschaetzt' | 'hand';
export type CareValue = { v: string; src: CareSource };
export type Care = Partial<Record<CareGroup, CareValue>>;
/** Gruppen in fester Reihenfolge; je Option: Symbol-Schlüssel, kurze Beschriftung, Screenreader-Text */
export const CARE: readonly { key: CareGroup; label: string; options: readonly { id: string; short: string }[] }[] = [
  { key: 'wash', label: 'Waschen', options: [{ id: 'w30', short: '30 °C' }, { id: 'w40', short: '40 °C' }, { id: 'w60', short: '60 °C' }, { id: 'w95', short: '95 °C' }, { id: 'hand', short: 'Hand' }, { id: 'nowash', short: 'nicht' }] },
  { key: 'bleach', label: 'Bleichen', options: [{ id: 'bleach', short: 'erlaubt' }, { id: 'nochlor', short: 'ohne Chlor' }, { id: 'nobleach', short: 'nicht' }] },
  { key: 'dry', label: 'Trocknen', options: [{ id: 'drylow', short: 'niedrig' }, { id: 'drynorm', short: 'normal' }, { id: 'nodry', short: 'nicht' }, { id: 'line', short: 'Leine' }, { id: 'flat', short: 'liegend' }] },
  { key: 'iron', label: 'Bügeln', options: [{ id: 'iron1', short: '1 Punkt' }, { id: 'iron2', short: '2 Punkte' }, { id: 'iron3', short: '3 Punkte' }, { id: 'noiron', short: 'nicht' }] },
  { key: 'pro', label: 'Professionell', options: [{ id: 'prof', short: 'P' }, { id: 'profF', short: 'F' }, { id: 'profW', short: 'W nass' }, { id: 'noprof', short: 'nicht' }] },
];
export const careLabel = (g: CareGroup, id: string): string => {
  const grp = CARE.find((x) => x.key === g);
  const o = grp?.options.find((x) => x.id === id);
  return grp && o ? `${grp.label}: ${o.short}` : '';
};
/** Pflege in Anzeige-Reihenfolge (nur gesetzte Gruppen) */
export const careList = (care: Care | null | undefined) =>
  CARE.flatMap((g) => (care?.[g.key] ? [{ group: g.key, ...care[g.key]! }] : []));
/** Geschätzten Wert bestätigen (wird normal gefüllt) */
export const confirmCare = (care: Care, g: CareGroup): Care => (care[g] ? { ...care, [g]: { ...care[g]!, src: 'hand' } } : care);
/** Ein Etikett ersetzt jede Schätzung */
export const careFromLabel = (found: Partial<Record<CareGroup, string>>): Care =>
  Object.fromEntries(Object.entries(found).filter(([, v]) => !!v).map(([k, v]) => [k, { v: v!, src: 'etikett' as const }]));

/** Nächstliegende Farbe der Palette (Key, Haupt- oder Nuance, ohne „Bunt“) zu einem Hex-Wert – Vorschlag aus dem Foto */
export function nearestColor(hex: string | null | undefined): string | null {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const rgb = (h: string) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  const [r, g, b] = rgb(hex);
  let best: string | null = null, dist = Infinity;
  for (const [key, h] of Object.entries(HEX)) {
    if (!h) continue;
    const [r2, g2, b2] = rgb(h);
    // gewichtete Distanz (Rot/Blau weniger empfindlich als Grün)
    const d = 2 * (r! - r2!) ** 2 + 4 * (g! - g2!) ** 2 + 3 * (b! - b2!) ** 2;
    if (d < dist) { dist = d; best = key; }
  }
  return best;
}
