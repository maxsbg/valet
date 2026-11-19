// Innenschein der Kacheln (Schrank, Wunschliste, Teil-Detail, Bearbeiten) – plattformunabhängig.
// Verbindlich: docs/design/kachel/VALET_SCHEIN_REGELN.md (entschieden mit Max am 16.11.2026).
import { itemTile } from '@valet/ui';
import { colorHex, nearestColor, MULTICOLOR, MULTICOLOR_STOPS } from './attributes';

/** Neutralfarben (Keys) – nie Akzent. Reihenfolge = Rangliste, wenn ein Teil NUR Neutralfarben hat (oben gewinnt). */
export const GLOW_NEUTRAL_RANK: readonly string[] = ['silver', 'taupe', 'beige', 'dark_grey', 'light_grey', 'ivory', 'black', 'white'];

/** Farbige Farben nach Wahrnehmung als Schein auf der weißen Kachel (oben = stärker). Gilt, wenn Rang 1 neutral ist. */
export const GLOW_COLOR_RANK: readonly string[] = [
  'multicolor', 'magenta', 'red', 'violet', 'burgundy', 'maroon', 'purple', 'blue', 'orange', 'terracotta', 'coral', 'mustard', 'pink',
  'green', 'navy', 'yellow', 'light_green', 'bronze', 'dark_green', 'gold', 'olive', 'cyan', 'turquoise', 'petrol', 'caramel', 'brown',
  'camel', 'lilac', 'khaki', 'light_yellow', 'dusty_rose', 'sky_blue', 'lavender', 'rose', 'mint',
];

const NEUTRAL = new Set(GLOW_NEUTRAL_RANK);
export const isNeutralColor = (name: string) => NEUTRAL.has(name);

const rankIn = (list: readonly string[]) => (a: string, b: string) => {
  const ia = list.indexOf(a), ib = list.indexOf(b);
  return (ia < 0 ? list.length : ia) - (ib < 0 ? list.length : ib);
};

/** Bekannte Palettenfarbe (inkl. „Bunt“)? */
const known = (n: string) => n === MULTICOLOR || !!colorHex(n);

/**
 * Welche Palettenfarbe bestimmt den Schein?
 * 1. Rang 1 farbig → Rang 1.
 * 2. Rang 1 neutral, aber farbige Farben dabei → die farbige mit dem besten Platz in GLOW_COLOR_RANK.
 * 3. Nur Neutralfarben → die mit dem besten Platz in GLOW_NEUTRAL_RANK.
 * Ohne Steckbrief-Farben: nächste Palettenfarbe zur Foto-Farbe; sonst null.
 */
export function glowColorName(colors: readonly string[] | null | undefined, photoHex?: string | null): string | null {
  let list = (colors ?? []).filter(known);
  if (!list.length) { const n = nearestColor(photoHex); list = n ? [n] : []; }
  if (!list.length) return null;
  const first = list[0]!;
  if (!isNeutralColor(first)) return first;
  const colored = list.filter((c) => !isNeutralColor(c));
  if (colored.length) return colored.sort(rankIn(GLOW_COLOR_RANK))[0]!;
  return list.slice().sort(rankIn(GLOW_NEUTRAL_RANK))[0]!;
}

export type Rgb = [number, number, number];
export type Glow =
  | { kind: 'solid'; name: string | null; rgb: Rgb; alpha: number; css: string }
  /** Bunt: Farbkreis nur am Rand (Ebene unter dem Foto). `css` = Ersatz, wo die Ebene nicht geht. */
  | { kind: 'bunt'; name: string; stops: readonly string[]; alpha: number; css: string };

const toRgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const rgba = (c: Rgb, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/** Schein eines Teils aus seinen Steckbrief-Farben (Rang-Reihenfolge), notfalls aus der Foto-Farbe. */
export function glowFor(colors: readonly string[] | null | undefined, photoHex?: string | null): Glow {
  const g = itemTile.glow;
  const name = glowColorName(colors, photoHex);
  const fallback = toRgb(g.fallback);
  if (name === MULTICOLOR) return { kind: 'bunt', name, stops: MULTICOLOR_STOPS, alpha: g.alpha, css: rgba(fallback, g.alpha) };
  const hex = name ? colorHex(name) : null;
  // Weiß würde auf der weißen Kachel verschwinden → heller Ersatzton
  const rgb = !hex || hex.toLowerCase() === '#ffffff' ? fallback : toRgb(hex);
  return { kind: 'solid', name, rgb, alpha: g.alpha, css: rgba(rgb, g.alpha) };
}

/** box-shadow für den Schein (Bunt: keiner – dort zeichnet die Ebene). */
export const glowShadow = (glow: Glow, blur: number, spread: number) =>
  glow.kind === 'bunt' ? 'none' : `inset 0 0 ${blur}px ${spread}px ${glow.css}`;
