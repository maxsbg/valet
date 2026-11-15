// Feste Listen für Steckbrief und Bearbeiten (Spec Abschnitte 4, 7, 8; Werte aus der Leinwand „Valet – Teil-Detailseite“)

// ---------- Farben ----------

export type ColorDef = { name: string; hex: string; nuances: readonly { name: string; hex: string }[] };
const c = (name: string, hex: string, nuances: [string, string][] = []): ColorDef => ({ name, hex, nuances: nuances.map(([n, h]) => ({ name: n, hex: h })) });

/** Eigenständige Farben (Hauptfarben, Türkis, Neutral, Sonder) mit ihren Nuancen. „Bunt“ hat keinen festen Wert (Verlauf). */
export const COLORS: readonly ColorDef[] = [
  c('Gelb', '#e8c547', [['Hellgelb', '#f3e38f'], ['Senfgelb', '#c99a1e']]),
  c('Orange', '#e8822e', [['Koralle', '#ef7f62'], ['Terrakotta', '#b8573a']]),
  c('Rot', '#c0392b', [['Burgunderrot', '#7e1f2e']]),
  c('Pink', '#e07aa0', [['Rosa', '#f2b6c6'], ['Altrosa', '#c99098'], ['Magenta', '#c2187a']]),
  c('Grün', '#4f8a4a', [['Mint', '#a8dcc0'], ['Hellgrün', '#8cc56b'], ['Olivgrün', '#6b7a3c'], ['Khaki', '#9a9461'], ['Dunkelgrün', '#2f5a37']]),
  c('Blau', '#3567b0', [['Himmelblau', '#8ec3e8'], ['Marineblau', '#1f2f55'], ['Petrol', '#1f6b72'], ['Cyan', '#39c2d7']]),
  c('Türkis', '#2ba5a5'),
  c('Lila', '#7d55b0', [['Lavendel', '#c3b5e6'], ['Flieder', '#b892c8'], ['Violett', '#5b2d8e']]),
  c('Weiß', '#ffffff'), c('Elfenbein', '#efe6d2'), c('Beige', '#d9c7a7'), c('Taupe', '#8f8172'), c('Camel', '#b98a55'), c('Braun', '#6b4a33'),
  c('Hellgrau', '#c4c4c4'), c('Dunkelgrau', '#555555'), c('Schwarz', '#1c1c1c'),
  c('Gold', '#cfa94a'), c('Silber', '#b9bec4'), c('Bronze', '#a86b3c'), c('Bunt', ''),
];
export const MULTICOLOR = 'Bunt';
export const MULTICOLOR_STOPS = ['#e8c547', '#e8822e', '#c0392b', '#7d55b0', '#3567b0', '#4f8a4a'] as const;
export const MAX_COLORS = 3;

const HEX: Record<string, string> = {};
const FAMILY: Record<string, string> = {};
for (const m of COLORS) { HEX[m.name] = m.hex; FAMILY[m.name] = m.name; for (const n of m.nuances) { HEX[n.name] = n.hex; FAMILY[n.name] = m.name; } }

export const colorHex = (name: string): string | null => HEX[name] || null;
export const isColor = (name: unknown): name is string => typeof name === 'string' && name in HEX;
/** Hauptfarbe zu einer Nuance (oder sich selbst) */
export const colorFamily = (name: string): string | null => FAMILY[name] ?? null;
export const nuancesOf = (main: string) => COLORS.find((x) => x.name === main)?.nuances ?? [];

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

/** Alte Farbnamen (freier Text, „Schwarz/Weiß“) → neue Palette. Unbekannt → null. */
export const LEGACY_COLORS: Readonly<Record<string, string>> = {
  schwarz: 'Schwarz', weiß: 'Weiß', weiss: 'Weiß', braun: 'Braun', beige: 'Beige', blau: 'Blau', hellgrau: 'Hellgrau', silber: 'Silber',
  anthrazit: 'Dunkelgrau', dunkelgrau: 'Dunkelgrau', gelb: 'Gelb', denim: 'Blau', creme: 'Elfenbein', burgunder: 'Burgunderrot', rot: 'Rot',
  rosa: 'Rosa', gold: 'Gold', camel: 'Camel', orange: 'Orange', navy: 'Marineblau', oliv: 'Olivgrün', hellblau: 'Himmelblau', grün: 'Grün',
  pink: 'Pink', lila: 'Lila', türkis: 'Türkis', khaki: 'Khaki', taupe: 'Taupe', bronze: 'Bronze', elfenbein: 'Elfenbein',
};

// ---------- Weitere Listen ----------

export const SEASONS = ['Frühling', 'Sommer', 'Herbst', 'Winter'] as const;
export type Season = (typeof SEASONS)[number];
/** Alte Saison „Übergang“ → Frühling + Herbst (entschieden 15.11.2026) */
export function migrateSeasons(old: readonly string[] | null | undefined): Season[] {
  const out = new Set<Season>();
  for (const s of old ?? []) {
    if (s === 'Übergang') { out.add('Frühling'); out.add('Herbst'); }
    else if ((SEASONS as readonly string[]).includes(s)) out.add(s as Season);
  }
  return SEASONS.filter((s) => out.has(s));
}

export const MATERIALS = ['Baumwolle', 'Polyester', 'Nylon', 'Denim', 'Leder', 'Kunstleder', 'Wolle', 'Merinowolle', 'Elasthan', 'Leinen', 'Acryl', 'Seide',
  'Viskose', 'Tweed', 'Samt', 'Chiffon', 'Wildleder', 'Cord', 'Spitze', 'Pelz', 'Daunen', 'Fleece', 'Mesh', 'Lyocell', 'Metall', 'Kunststoff/Gummi',
  'Cupro', 'Kaschmir', 'Mohair', 'Angora', 'Alpaka', 'Flanell', 'Lammfell', 'Andere Materialien'] as const;
export type MaterialPart = { name: string; pct?: number | null };

export const PATTERNS = ['Unifarben', 'Gestreift', 'Grafisch', 'Gepunktet', 'Animalmuster', 'Blumenmuster', 'Tropisch', 'Paisley', 'Argyle', 'Camouflage',
  'Colorblocking', 'Allover-Print', 'Schachbrettmuster', 'Kariert', 'Vichy-Karo', 'Hahnentritt', 'Fischgrätmuster', 'Chevron-Muster', 'Tweed', 'Abstrakt',
  'Tie-Dye', 'Geometrisch', 'Spitze', 'Zopfmuster', 'Rippstrick', 'Andere Muster'] as const;

export const STYLES = ['Bequem', 'Lässig', 'Business Casual', 'Formell', 'Modern', 'Klassisch', 'Minimalistisch', 'Boho', 'Luxus', 'Sportlich', 'Athleisure',
  'Trendig', 'Kidcore', 'Künstlerisch', 'Festlich', 'Feminin', 'Street', 'Sonstiges'] as const;
/** Alte Stile → neue Liste („Schick“ wird je Teil entschieden, Vorgabe Klassisch) */
export const LEGACY_STYLES: Readonly<Record<string, string>> = { Casual: 'Lässig', Streetwear: 'Street', Business: 'Business Casual', Sport: 'Sportlich', Schick: 'Klassisch' };

export const COLLARS = ['Klassischer Kragen', 'Button-down', 'Stehkragen', 'Reverskragen', 'ohne Kragen'] as const;
export const CLOSURES = ['Knöpfe', 'Reißverschluss', 'Druckknöpfe', 'Schnürung', 'Klett', 'Schnalle', 'ohne'] as const;

// ---------- Größe ----------

export const SIZE_SYSTEMS = { letters: 'Buchstaben', numbers: 'Zahlen' } as const;
export type SizeSystem = keyof typeof SIZE_SYSTEMS;
export const ONE_SIZE = 'One Size';
export const SIZES: Readonly<Record<SizeSystem, readonly string[]>> = {
  letters: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', ONE_SIZE],
  numbers: ['44', '46', '48', '50', '52', '54', '56', '58', '60', ONE_SIZE],
};
export const COLLAR_SIZES = ['37', '38', '39', '40', '41', '42', '43', '44', '45', '46'] as const;
/** Kragenweite nur für Unterkategorie Hemd (Spec 8) */
export const hasCollarSize = (subcategory: string | null | undefined) => subcategory === 'Hemd';
/** Größen-System aus einer alten Größenangabe erkennen (nur eindeutige Fälle) */
export function sizeSystemOf(size: string | null | undefined): SizeSystem | null {
  const s = (size ?? '').trim();
  if (SIZES.letters.includes(s) && s !== ONE_SIZE) return 'letters';
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

/** Nächstliegende Farbe der Palette (Haupt- oder Nuance, ohne „Bunt“) zu einem Hex-Wert – Vorschlag aus dem Foto */
export function nearestColor(hex: string | null | undefined): string | null {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const rgb = (h: string) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  const [r, g, b] = rgb(hex);
  let best: string | null = null, dist = Infinity;
  for (const [name, h] of Object.entries(HEX)) {
    if (!h) continue;
    const [r2, g2, b2] = rgb(h);
    // gewichtete Distanz (Rot/Blau weniger empfindlich als Grün)
    const d = 2 * (r! - r2!) ** 2 + 4 * (g! - g2!) ** 2 + 3 * (b! - b2!) ** 2;
    if (d < dist) { dist = d; best = name; }
  }
  return best;
}
