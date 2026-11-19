// Vom Code berechnete Farb- und Matching-Merkmale (KI-Analyse v2, Spec Abschnitt 5).
// Reine Funktionen: Farbwirkung aus den HEX-Werten der Palette (OKLCH), Matching-Merkmale aus Steckbrief + Profil,
// Plausibilitätsprüfung der KI-Farbe gegen die Foto-Farben (5.3).

import { COLORS, MULTICOLOR, colorFamily, colorHex, toColorKeys, toStyleKeys } from './attributes';
import { activeProfile, readProfile, type Range } from './ai/profile';

// ---------- OKLCH ----------

export type Oklch = { L: number; C: number; h: number };

const lin = (u: number) => (u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4);

/** sRGB-HEX (#rrggbb oder #rgb) → OKLCH (L 0–1, C, h in Grad 0–360); ungültig → null */
export function hexToOklch(hex: string | null | undefined): Oklch | null {
  if (!hex) return null;
  let s = hex.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map((x) => x + x).join('');
  if (!/^[0-9a-f]{6}$/i.test(s)) return null;
  const r = lin(parseInt(s.slice(0, 2), 16) / 255), g = lin(parseInt(s.slice(2, 4), 16) / 255), b = lin(parseInt(s.slice(4, 6), 16) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const q = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * q;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * q;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * q;
  const C = Math.hypot(A, B);
  const h = C < 1e-6 ? 0 : (Math.atan2(B, A) * 180 / Math.PI + 360) % 360;
  return { L, C, h };
}

// ---------- Eine Palettenfarbe ----------

export type Temperature = 'warm' | 'cool' | 'neutral';
export type ColorTrait = Oklch & {
  neutral: boolean;
  temperature: Temperature;
  lightness: number;
  chroma: number;
  override: boolean;
  /** Mode-Neutrale (siehe WEAR_NEUTRALS) */
  wearNeutral: boolean;
};

/** Neutral unter dieser Buntheit (OKLCH-Chroma) */
export const NEUTRAL_CHROMA = 0.035;

/**
 * Korrekturen nach Augenmaß (nur temperature), von Max am 19.11.2026 anhand von farb-merkmale.html bestätigt.
 * olive: h ≈ 121° knapp über der Grenze, wirkt warm. pink/rose/magenta: Blaustich, nach Farbtypenlehre kühl (Altrosa bleibt warm).
 * Bewusst KEIN Override für burgundy: bleibt rechnerisch warm.
 */
export const COLOR_TRAIT_OVERRIDES: Readonly<Record<string, { temperature: Temperature }>> = {
  olive: { temperature: 'warm' },
  pink: { temperature: 'cool' },
  rose: { temperature: 'cool' },
  magenta: { temperature: 'cool' },
};

/**
 * Mode-Neutrale (entschieden 19.11.2026): Farben, die sich in der Kleidung wie Neutrale kombinieren lassen,
 * auch wenn sie rechnerisch farbig sind (Beige, Camel, Khaki, Braun, Olivgrün, Marineblau). Die Temperatur
 * bleibt trotzdem unverändert berechnet. Im späteren Matching sollen wearNeutral-Farben KEINE Temperatur-Konflikte
 * auslösen (z. B. Camel zu Marineblau ist kein warm/kühl-Bruch).
 */
export const WEAR_NEUTRALS: readonly string[] = [
  'beige', 'camel', 'khaki', 'brown', 'olive', 'navy', 'ivory', 'taupe', 'white', 'light_grey', 'dark_grey', 'black', 'silver',
];
const WEAR_NEUTRAL_SET = new Set(WEAR_NEUTRALS);
/** true, wenn die Farbe (Key oder Label) eine Mode-Neutrale ist; Bunt und Unbekanntes → false */
export const isWearNeutral = (color: string): boolean => { const k = toColorKeys([color])[0]; return !!k && WEAR_NEUTRAL_SET.has(k); };

const step = (v: number, limits: readonly number[]) => { let i = 0; while (i < limits.length && v >= limits[i]!) i++; return i + 1; };
/** L < 0,35 → 1 · < 0,50 → 2 · < 0,65 → 3 · < 0,80 → 4 · sonst 5 */
export const lightnessStep = (L: number) => step(L, [0.35, 0.5, 0.65, 0.8]);
/** C < 0,035 → 1 · < 0,075 → 2 · < 0,11 → 3 · < 0,145 → 4 · sonst 5 */
export const chromaStep = (C: number) => step(C, [0.035, 0.075, 0.11, 0.145]);
const tempOfHue = (h: number): Temperature => (h < 115 || h >= 330 ? 'warm' : 'cool');

/** Merkmale einer Palettenfarbe (Key); „Bunt“ und Unbekanntes → null */
export function colorTrait(key: string): ColorTrait | null {
  const o = hexToOklch(colorHex(key));
  if (!o) return null;
  const neutral = o.C < NEUTRAL_CHROMA;
  const ov = neutral ? undefined : COLOR_TRAIT_OVERRIDES[key];
  return { ...o, neutral, temperature: neutral ? 'neutral' : ov?.temperature ?? tempOfHue(o.h), lightness: lightnessStep(o.L), chroma: chromaStep(o.C), override: !!ov, wearNeutral: WEAR_NEUTRAL_SET.has(key) };
}

/** „Bunt“ (mixed) zählt als Helligkeit 3, Chroma 5; allein (nur „Bunt“) Kontrast 4 (entschieden 19.11.2026) */
export const MULTICOLOR_TRAIT = { temperature: 'mixed', lightness: 3, chroma: 5, contrast: 4 } as const;

// ---------- Farbwirkung eines Teils ----------

export type ColorTraits = {
  temperature: 'warm' | 'cool' | 'neutral' | 'mixed';
  lightness: number;
  chroma: number;
  contrast: number;
  distribution: 'solid' | 'tonal' | 'neutral_contrast' | 'multicolor';
  /** Alle Farben des Teils sind Mode-Neutrale (WEAR_NEUTRALS); Bunt → false */
  allWearNeutral: boolean;
};

const WEIGHTS: Readonly<Record<number, readonly number[]>> = { 1: [1], 2: [0.7, 0.3], 3: [0.6, 0.3, 0.1] };
const contrastStep = (dL: number) => step(dL, [0.15, 0.3, 0.45, 0.6]);

/** Farbwirkung aus den Steckbrief-Farben (Rang 1 zuerst, Keys oder tolerant Labels); ohne Farben → null */
export function colorTraits(colors: readonly string[] | null | undefined): ColorTraits | null {
  const keys = toColorKeys(colors ?? []).slice(0, 3);
  if (!keys.length) return null;
  const w = WEIGHTS[keys.length]!;
  const traits = keys.map((k) => (k === MULTICOLOR ? null : colorTrait(k)));

  let lightness = 0, chroma = 0, warm = false, cool = false;
  keys.forEach((k, i) => {
    const t = traits[i];
    const lv = t ? t.lightness : MULTICOLOR_TRAIT.lightness, cv = t ? t.chroma : MULTICOLOR_TRAIT.chroma;
    lightness += lv * w[i]!; chroma += cv * w[i]!;
    if (!t) { if (k === MULTICOLOR) warm = cool = true; }
    else if (t.temperature === 'warm') warm = true;
    else if (t.temperature === 'cool') cool = true;
  });
  const temperature = warm && cool ? 'mixed' : warm ? 'warm' : cool ? 'cool' : 'neutral';

  // Kontrast: größtes ΔL zwischen zwei messbaren Farben („Bunt“ hat keinen Wert); eine Farbe → 1; nur „Bunt“ → fest 4
  const Ls = traits.filter((t): t is ColorTrait => !!t).map((t) => t.L);
  const onlyMulticolor = keys.length === 1 && keys[0] === MULTICOLOR;
  const contrast = onlyMulticolor ? MULTICOLOR_TRAIT.contrast : Ls.length < 2 ? 1 : contrastStep(Math.max(...Ls) - Math.min(...Ls));

  let distribution: ColorTraits['distribution'];
  if (keys.includes(MULTICOLOR)) distribution = 'multicolor';
  else if (keys.length === 1) distribution = 'solid';
  else if (traits.every((t) => t!.neutral) && contrast >= 4) distribution = 'neutral_contrast';
  else {
    let tonal = true;
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
      const same = colorFamily(keys[i]!) === colorFamily(keys[j]!);
      if (!same && Math.abs(traits[i]!.L - traits[j]!.L) >= 0.15) tonal = false;
    }
    distribution = tonal ? 'tonal' : 'multicolor';
  }
  const allWearNeutral = traits.every((t) => !!t && t.wearNeutral);
  return { temperature, lightness: Math.round(lightness), chroma: Math.round(chroma), contrast, distribution, allWearNeutral };
}

// ---------- Matching-Merkmale ----------

/** Ersatz für die Formalität, wenn kein Profil da ist (Stil-Key → Bereich 1–5); deckt alle STYLES ab */
export const STYLE_FORMALITY: Readonly<Record<string, Range>> = {
  comfy: [1, 2], sporty: [1, 2], athleisure: [1, 2], kidcore: [1, 2],
  casual: [1, 3], boho: [1, 3], street: [1, 3],
  trendy: [2, 3], artsy: [2, 3], other: [2, 3],
  modern: [2, 4], classic: [2, 4], minimal: [2, 4], feminine: [2, 4],
  business_casual: [3, 4],
  luxury: [3, 5],
  formal: [4, 5], festive: [4, 5],
};
/** Ohne Profil und ohne Stil */
export const DEFAULT_FORMALITY: Range = [2, 3];

export type MatchItem = {
  category: string | null;
  subcategory: string | null;
  colors: readonly string[] | null;
  pattern: string | null;
  materials: readonly string[] | null;
  layers: readonly number[] | null;
  /** Weite/Länge/Bund – für das Matching (Silhouette) vorgesehen, hier noch nicht ausgewertet */
  fit?: { width: number | null; length: number | null; rise: number | null } | null;
  styles: readonly string[] | null;
  /** items.analysis (Profil unter analysis.profile) */
  analysis: Record<string, unknown> | null;
};

export type MatchTraits = {
  color: ColorTraits | null;
  formality: Range;
  presence: number;
  weight: number;
  texture: number;
  layerRole: 'base' | 'mid' | 'outer' | null;
  statement: boolean;
  /** true, wenn mindestens ein Profil-Wert ersetzt wurde */
  partial: boolean;
};

/** Merkmale fürs Matching aus Steckbrief + gespeichertem Profil (nur Felder, die für die Kategorie gelten) */
export function matchTraits(item: MatchItem): MatchTraits {
  const profile = readProfile(item.analysis?.profile);
  const p = activeProfile(profile, { category: item.category, sub: item.subcategory, pattern: item.pattern, materials: item.materials ?? [] });
  const color = colorTraits(item.colors);
  const colorKeys = toColorKeys(item.colors ?? []);
  let partial = false;

  let formality: Range;
  if (p.formality) formality = p.formality;
  else {
    partial = true;
    const ranges = toStyleKeys(item.styles ?? []).map((s) => STYLE_FORMALITY[s]).filter((r): r is Range => !!r);
    formality = ranges.length ? [Math.min(...ranges.map((r) => r[0])), Math.max(...ranges.map((r) => r[1]))] : DEFAULT_FORMALITY;
  }

  let presence: number;
  if (p.presence != null) presence = p.presence;
  else {
    partial = true;
    presence = Math.max(
      item.pattern && item.pattern !== 'solid' ? 3 : 2,
      color?.chroma === 5 ? 4 : 2,
      colorKeys.includes(MULTICOLOR) ? 4 : 2,
    );
  }

  const weight = p.visual_weight ?? 3, texture = p.texture_intensity ?? 3;
  if (p.visual_weight == null || p.texture_intensity == null) partial = true;

  const layers = (item.layers ?? []).filter((n) => Number.isInteger(n) && n >= 0 && n <= 3);
  const top = layers.length ? Math.max(...layers) : null;
  const layerRole = top == null ? null : top === 0 ? 'base' : top === 3 ? 'outer' : 'mid';

  const statement = presence >= 4 || (p.pattern_contrast ?? 0) >= 4;
  return { color, formality, presence, weight, texture, layerRole, statement, partial };
}

// ---------- Plausibilität der KI-Farbe (5.3) ----------

/** Foto-Farben aus item_images.colors: h = HEX, s = Anteil 0–1 */
export type PhotoColor = { h: string; s: number };
/** Abweichung des Farbtons, ab der „Farbe prüfen“ erscheint */
export const COLOR_CHECK_DEG = 60;

const hueDiff = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/** Ab dieser Sättigungsstufe von Rang 1 meldet ein rein neutrales Foto „Farbe prüfen“ */
export const COLOR_CHECK_MIN_CHROMA = 3;

/**
 * true = „Farbe prüfen“ zeigen. Rang 1 muss farbig sein, dann:
 * a) der vorherrschende farbige Foto-Farbton (größter Anteil unter den nicht neutralen Foto-Farben) weicht um mehr als 60° ab, oder
 * b) das Foto hat nur neutrale Farben (mindestens eine gültige) und Rang 1 hat Sättigung ≥ 3 (z. B. KI „Rot“, Foto grau).
 * Neutrale Foto-Farben ohne farbigen Rang 1 → kein Hinweis. Ändert nie Werte.
 */
export function colorCheck(colors: readonly string[] | null | undefined, photoColors: readonly PhotoColor[] | null | undefined): boolean {
  const first = toColorKeys(colors ?? [])[0];
  if (!first || first === MULTICOLOR) return false;
  const t = colorTrait(first);
  if (!t || t.neutral) return false;
  let best: { h: number; s: number } | null = null;
  let neutralSeen = false;
  for (const pc of Array.isArray(photoColors) ? photoColors : []) {
    const o = hexToOklch(pc?.h);
    const s = typeof pc?.s === 'number' && pc.s > 0 ? pc.s : 0;
    if (!o || !s) continue;
    if (o.C < NEUTRAL_CHROMA) { neutralSeen = true; continue; }
    if (!best || s > best.s) best = { h: o.h, s };
  }
  if (!best) return neutralSeen && t.chroma >= COLOR_CHECK_MIN_CHROMA;
  return hueDiff(t.h, best.h) > COLOR_CHECK_DEG;
}

/** Alle Palettenfarben (Haupt- und Nuancen) in Palettenreihenfolge, für farb-merkmale.html */
export const paletteKeys = (): string[] => COLORS.flatMap((c) => [c.key, ...c.nuances.map((n) => n.key)]);
