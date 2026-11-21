// Outfit-Zusammenstellung für die Tagesplanung (Spec docs/outfits/VALET_OUTFIT_ZUSAMMENSTELLUNG.md, Stand 20.11.2026).
// Reine Funktionen: Gerüst nach Temperatur, harte Filter, weiche Bewertung, Aufbau Slot für Slot.
// Alle Zahlen kommen aus OutfitConfig (config.ts). Fehlende Werte werden geschätzt und als „geschätzt“ markiert.

import { colorFamily, colorHex, toColorKeys, MULTICOLOR } from '../attributes';
import { colorTrait, hexToOklch, isWearNeutral, matchTraits, type MatchTraits } from '../traits';
import { layersOf } from '../fields';
import { fitScaleOf } from '../categories';
import type { OccasionKey } from '../occasions';
import { DEFAULT_OUTFIT_CONFIG, type OutfitConfig, type RainLevel } from './config';
import { shaftOf, type Range } from '../ai/profile';
import { WADA } from './wadaData';
import { weatherFrom } from '../weather';

// ---------- Eingaben ----------

export type OutfitItem = {
  id: string;
  name?: string | null;
  category: string | null;
  subcategory?: string | null;
  item_type?: string | null;
  colors?: readonly string[] | null;
  pattern?: string | null;
  materials?: readonly ({ name: string } | string)[] | null;
  layers?: readonly number[] | null;
  warmth?: number | null;
  rain?: number | null;
  styles?: readonly string[] | null;
  seasons?: readonly string[] | null;
  status?: string | null;
  fit_width?: number | null;
  profile?: Record<string, unknown> | null;
  /** items.analysis.color_shares ({ colors, shares }) – echte Farbanteile, Details ≤ 10 % zählen nicht für die Farbwirkung */
  color_shares?: unknown;
  last_worn?: string | null;
  /** an diesem Tag für jemand anderen reserviert */
  reservedForOther?: boolean;
};

export type DayContext = {
  tempC: number;
  rain: RainLevel;
  /** Schalter „Regen berücksichtigen“ */
  rainOn: boolean;
  /** Regen nur 30–49 % wahrscheinlich → nur weicher Abzug */
  rainSoft: boolean;
  occasion: OccasionKey;
  /** 1–12 */
  month: number;
  /** ISO-Datum des Tages */
  date: string;
  includeStored: boolean;
  /** Schnee oder Matsch erwartet (Schneefall mit Wahrscheinlichkeit ≥ rainProb.hard); gilt nur mit rainOn */
  snow?: boolean;
};

export type Slot = 'bottom' | 'base' | 'mid' | 'open' | 'outer' | 'shoes';
export const SLOT_LABEL: Record<Slot, string> = { bottom: 'Unterteil', base: 'Basis', mid: 'Mittellage', open: 'Offen darüber', outer: 'Außen', shoes: 'Schuhe' };

// ---------- Hilfen ----------

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const matNames = (m: OutfitItem['materials']): string[] => (m ?? []).map((x) => (typeof x === 'string' ? x : x?.name)).filter((x): x is string => !!x);

/** Saison nach Monat wie in der Statistik: Nov–Feb Winter, Mär–Mai Frühling, Jun–Aug Sommer, Sep–Okt Herbst */
export const seasonOfMonth = (m: number): string => (m >= 11 || m <= 2 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn');

export type Band = 'hot' | 'mild' | 'cool' | 'cold' | 'freezing';
export function bandOf(t: number, cfg: OutfitConfig = DEFAULT_OUTFIT_CONFIG): Band {
  if (t >= cfg.temp.hot) return 'hot';
  if (t >= cfg.temp.mild) return 'mild';
  if (t >= cfg.temp.cool) return 'cool';
  if (t >= cfg.temp.cold) return 'cold';
  return 'freezing';
}

/** Regenstufe aus Stundenwerten (nur Stunden im Zeitraum übergeben) */
export function rainFromHours(hours: readonly { mm: number; prob: number; thunder?: boolean; snowCm?: number }[], cfg: OutfitConfig = DEFAULT_OUTFIT_CONFIG): { level: RainLevel; soft: boolean; snow: boolean } {
  const lvl = (h: { mm: number; thunder?: boolean }): RainLevel => (h.thunder || h.mm >= cfg.rainMm.heavy ? 'heavy' : h.mm >= cfg.rainMm.drizzle ? 'rain' : h.mm > 0 ? 'drizzle' : 'none');
  const order: RainLevel[] = ['none', 'drizzle', 'rain', 'heavy'];
  let hard: RainLevel = 'none', soft: RainLevel = 'none';
  for (const h of hours) {
    const l = lvl(h);
    if (h.prob >= cfg.rainProb.hard && order.indexOf(l) > order.indexOf(hard)) hard = l;
    else if (h.prob >= cfg.rainProb.soft && order.indexOf(l) > order.indexOf(soft)) soft = l;
  }
  const snow = hours.some((h) => (h.snowCm ?? 0) > 0 && h.prob >= cfg.rainProb.hard);
  return { level: hard, soft: order.indexOf(soft) > order.indexOf(hard) && order.indexOf(soft) >= 2, snow };
}

// ---------- Schätzungen für fehlende Werte ----------

// Gleiche Regeln wie in Bearbeiten (weather.ts): Typ + Material + Stichwörter im Namen
const calc = (i: OutfitItem) => weatherFrom({ category: i.category, subcategory: i.subcategory, type: i.item_type, name: i.name,
  materials: matNames(i.materials).map((name) => ({ name, pct: pctOf(i.materials, name) })) });
const pctOf = (m: OutfitItem['materials'], name: string): number | null => {
  const x = (m ?? []).find((p) => typeof p !== 'string' && p?.name === name) as { pct?: unknown } | undefined;
  return typeof x?.pct === 'number' ? x.pct : null;
};
/** Wärme 0–3 und ob geschätzt */
export function warmthOf(i: OutfitItem): { v: number; est: boolean } {
  if (i.warmth != null) return { v: i.warmth, est: false };
  return { v: calc(i).warmth ?? (i.category === 'shorts' ? 0 : i.category === 'outerwear' ? 2 : 1), est: true };
}
/** Regenschutz 0–2 und ob geschätzt */
export function rainOf(i: OutfitItem): { v: number; est: boolean } {
  if (i.rain != null) return { v: i.rain, est: false };
  return { v: calc(i).rain ?? 0, est: true };
}

// ---------- Slots ----------

const ZIP_SUBS = new Set(['sweat_jacket', 'sports_jacket', 'track_jacket']);
const BUTTON_SUBS = new Set(['shirt', 'overshirt', 'cardigan', 'blouse']);
const PULLOVER_SUBS = new Set(['sweater', 'sweatshirt', 'hoodie', 'sweater_vest']);

/** Mögliche Slots eines Teils */
export function slotsOf(i: OutfitItem): Slot[] {
  const c = i.category;
  if (c === 'shoe') return ['shoes'];
  if (c === 'pants' || c === 'shorts' || c === 'skirt') return ['bottom'];
  if (c !== 'top' && c !== 'outerwear') return [];
  const map: Slot[] = ['base', 'mid', 'open', 'outer'];
  const out = layersOf({ category: c, subcategory: i.subcategory ?? null, item_type: i.item_type ?? null, layers: i.layers ?? null }).map((n) => map[n]!).filter(Boolean);
  // Zip- und Knopfteile aus der Oberbekleidung sind nie Basis
  return out.filter((s) => !(s === 'base' && (ZIP_SUBS.has(i.subcategory ?? '') || c === 'outerwear')));
}

/** Gerüst nach Temperatur: Pflicht-Slots + optionale mit Wahrscheinlichkeit */
export function skeleton(t: number, cfg: OutfitConfig = DEFAULT_OUTFIT_CONFIG, rnd: () => number = Math.random): Slot[] {
  const b = bandOf(t, cfg);
  const s: Slot[] = ['bottom', 'base'];
  if (b === 'hot') { if (rnd() < 0.25) s.push('open'); }
  else if (b === 'mild') { const r = rnd(); if (r < 0.3) s.push('mid'); else if (r < 0.55) s.push('open'); }
  else if (b === 'cool') { s.push(rnd() < 0.55 ? 'mid' : 'open'); if (rnd() < 0.4) s.push('outer'); }
  else s.push('mid', 'outer');
  s.push('shoes');
  return s;
}

// ---------- Harte Filter ----------

export function formalityOf(i: OutfitItem): Range {
  return traitsOf(i).formality as Range;
}

const traitCache = new WeakMap<OutfitItem, MatchTraits>();
export function traitsOf(i: OutfitItem): MatchTraits {
  let t = traitCache.get(i);
  if (!t) {
    t = matchTraits({
      category: i.category, subcategory: i.subcategory ?? null, colors: i.colors ?? null, pattern: i.pattern ?? null,
      materials: matNames(i.materials), layers: i.layers ?? null, styles: i.styles ?? null,
      analysis: i.profile || i.color_shares ? { profile: i.profile ?? null, color_shares: i.color_shares ?? null } : null,
    });
    traitCache.set(i, t);
  }
  return t;
}

const overlap = (a: Range, b: Range) => a[0] <= b[1] && b[0] <= a[1];

/** Grund, warum das Teil für diesen Slot heute rausfliegt; null = passt */
export function hardReason(i: OutfitItem, slot: Slot, ctx: DayContext, cfg: OutfitConfig = DEFAULT_OUTFIT_CONFIG): string | null {
  if (i.status === 'stored') { if (!ctx.includeStored) return 'eingelagert'; }
  else if (i.status) return `Status ${i.status}`;
  if (i.reservedForOther) return 'für jemand anderen reserviert';
  // Saison ist keine harte Grenze mehr – ob ein Teil passt, entscheidet die Temperatur (Max 21.11.2026)
  const b = bandOf(ctx.tempC, cfg);
  if (slot !== 'shoes') {
    const w = warmthOf(i).v;
    // Hitze gestaffelt: bis 29 °C mittlere Teile nur abgewertet (weiche Bewertung), ab 30 °C raus; warme immer raus
    if (b === 'hot' && w > cfg.warmthMax.hot && (ctx.tempC >= cfg.temp.veryHot || w > cfg.warmthMax.hotSoft)) return 'zu warm';
    if (b === 'mild' && w > cfg.warmthMax.mild) return 'zu warm';
    if ((b === 'cold' || b === 'freezing') && w === 0) return 'zu dünn';
    if (slot === 'outer' && b === 'cold' && w < cfg.outerWarmthMin.cold) return 'Außenlage zu dünn';
    if (slot === 'outer' && b === 'freezing' && w < cfg.outerWarmthMin.freezing) return 'Außenlage zu dünn';
    if (i.category === 'shorts' && (b === 'cool' || b === 'cold' || b === 'freezing')) return 'Shorts zu kalt';
    if (slot === 'open' && b === 'hot' && i.subcategory !== 'shirt') return 'bei Hitze nur Hemden offen';
  } else {
    // Schuhe hängen mehr am Wetter als an der Temperatur (Max, 21.11.2026): harte Grenzen nur an den Rändern
    const w = warmthOf(i).v;
    if (w === 0 && ctx.tempC < cfg.shoeTemp.openMin) return 'zu kalt für offene Schuhe';
    if (w >= 3 && ctx.tempC > cfg.shoeTemp.linedMax) return 'gefütterte Schuhe zu warm';
  }
  if (ctx.rainOn && ctx.snow) {
    if (slot === 'shoes') {
      const shaft = shaftOf({ category: i.category, sub: i.subcategory ?? null, type: i.item_type ?? null }, (i.profile?.shaft as string | null | undefined) ?? null);
      if (!shaft || !cfg.snow.shoeShafts.includes(shaft) || rainOf(i).v < cfg.snow.shoeRainMin) return 'nicht schneetauglich';
    }
    if (slot === 'outer' && warmthOf(i).v < cfg.snow.outerWarmthMin) return 'Außenlage zu dünn für Schnee';
  }
  if (ctx.rainOn && (ctx.rain === 'rain' || ctx.rain === 'heavy') && (slot === 'outer' || slot === 'shoes')) {
    const need = cfg.rainMin[ctx.rain][slot === 'outer' ? 'outer' : 'shoe'];
    if (rainOf(i).v < need) return 'nicht regenfest genug';
  }
  if (!overlap(formalityOf(i), cfg.occasionFormality[ctx.occasion])) return 'passt nicht zum Anlass';
  return null;
}

/** Lagen-Regel: Basis darf ein Hemd sein, wenn es heiß ist oder ein Pullover darüber liegt; Zip nie */
function baseAllowed(i: OutfitItem, chosen: Partial<Record<Slot, OutfitItem>>, ctx: DayContext, cfg: OutfitConfig): boolean {
  const sub = i.subcategory ?? '';
  if (ZIP_SUBS.has(sub)) return false;
  if (!BUTTON_SUBS.has(sub)) return true;
  if (bandOf(ctx.tempC, cfg) === 'hot') return true;
  const mid = chosen.mid;
  return !!mid && PULLOVER_SUBS.has(mid.subcategory ?? '');
}

// ---------- Weiche Bewertung ----------

export type Parts = { color: number; statement: number; formality: number; proportion: number; surface: number; metal: number; variety: number };
export type Scored = { score: number; parts: Parts; notes: string[] };

const GROUPS: Readonly<Record<string, string>> = {
  black: 'grey', charcoal: 'grey', dark_grey: 'grey', light_grey: 'grey', silver: 'grey', white: 'grey',
  ivory: 'beige', beige: 'beige', sand: 'beige', taupe: 'beige', camel: 'beige',
};
const groupOf = (k: string) => GROUPS[k] ?? colorFamily(k) ?? k;

let wadaLab: { L: number; a: number; b: number }[] | null = null;
function lab(hex: string) { const o = hexToOklch(hex)!; const r = (o.h * Math.PI) / 180; return { L: o.L, a: o.C * Math.cos(r), b: o.C * Math.sin(r) }; }
const dist = (p: { L: number; a: number; b: number }, q: { L: number; a: number; b: number }) => Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);
/** Wada-Farben in der Nähe einer Palettenfarbe */
function wadaNear(key: string): number[] {
  const hex = colorHex(key);
  if (!hex) return [];
  wadaLab ??= WADA.colors.map(lab);
  const p = lab(hex);
  const d = wadaLab.map((q, idx) => ({ idx, d: dist(p, q) })).sort((x, y) => x.d - y.d);
  return d.filter((x, n) => n < 2 && x.d < 0.06).map((x) => x.idx);
}

/** größte Zahl verschiedener Outfit-Farben, die gemeinsam in einer Wada-Kombination vorkommen */
export function wadaMatch(keys: readonly string[]): number {
  const near = new Map(keys.map((k) => [k, new Set(wadaNear(k))]));
  let best = 0;
  for (const combo of WADA.combos) {
    let n = 0;
    for (const k of keys) if (combo.some((c) => near.get(k)!.has(c))) n++;
    if (n > best) best = n;
  }
  return best;
}

function scoreColor(items: readonly OutfitItem[], cfg: OutfitConfig, notes: string[]): number {
  const keys: string[] = [];
  for (const i of items) for (const k of toColorKeys(i.colors ?? []).slice(0, 2)) if (!keys.includes(k)) keys.push(k);
  const colorful = keys.filter((k) => k !== MULTICOLOR && !isWearNeutral(k));
  const accents = new Set(colorful.map((k) => colorFamily(k) ?? k));
  if (keys.includes(MULTICOLOR)) accents.add(MULTICOLOR);
  let s = colorful.length ? 0.8 : 0.85;
  const extra = accents.size - cfg.maxAccents;
  if (extra > 0) { s -= 0.35 * extra; notes.push(`${accents.size} Akzentfarben`); }

  const wm = wadaMatch(keys.filter((k) => k !== MULTICOLOR));
  const hasWada = colorful.length > 0 && wm >= 2;
  if (hasWada) { s += wm >= 3 ? 0.3 : 0.15; notes.push(`Wada-Kombination (${wm} Farben)`); }

  if (cfg.colorClash === 'strong' || cfg.colorClash === 'both') {
    let n = 0;
    for (let a = 0; a < colorful.length; a++) for (let b = a + 1; b < colorful.length; b++) {
      const x = colorTrait(colorful[a]!), y = colorTrait(colorful[b]!);
      if (x && y && x.chroma >= 4 && y.chroma >= 4 && colorFamily(colorful[a]!) !== colorFamily(colorful[b]!) && wadaMatch([colorful[a]!, colorful[b]!]) < 2) n++;
    }
    if (n) { s -= 0.4 * Math.min(n, 2); notes.push('zwei kräftige Farben ohne Wada-Bezug'); }
  }
  if (cfg.colorClash === 'warmcool' || cfg.colorClash === 'both') {
    const temps = new Set(colorful.map((k) => colorTrait(k)?.temperature).filter((t) => t === 'warm' || t === 'cool'));
    if (temps.size === 2) { s -= 0.4; notes.push('warm und kühl gemischt'); }
  }
  // „Fast gleich“: gleiche Gruppe, andere Farbe, kaum Helligkeitsunterschied
  let near = false;
  for (let a = 0; a < keys.length; a++) for (let b = a + 1; b < keys.length; b++) {
    const ka = keys[a]!, kb = keys[b]!;
    if (ka === MULTICOLOR || kb === MULTICOLOR) continue;
    const ta = colorTrait(ka), tb = colorTrait(kb);
    if (!ta || !tb) continue;
    const navyBlack = (ka === 'navy' && kb === 'black') || (ka === 'black' && kb === 'navy');
    if ((groupOf(ka) === groupOf(kb) && Math.abs(ta.L - tb.L) < cfg.nearSameL) || (navyBlack && cfg.navyBlackNearSame)) near = true;
  }
  if (near) { s -= 0.3; notes.push('Farben fast gleich'); }
  return clamp(s);
}

const isLoud = (i: OutfitItem, t: MatchTraits) =>
  !!i.pattern && i.pattern !== 'solid' && (t.presence >= 4 || Number(i.profile?.pattern_contrast ?? 0) >= 4);

export function scoreOutfit(items: readonly OutfitItem[], ctx: DayContext, cfg: OutfitConfig = DEFAULT_OUTFIT_CONFIG): Scored {
  const notes: string[] = [];
  const tr = items.map(traitsOf);
  const color = scoreColor(items, cfg, notes);

  const stm = tr.filter((t) => t.statement).length;
  const loud = items.filter((i, n) => isLoud(i, tr[n]!)).length;
  let statement = 1 - 0.6 * Math.max(0, stm - cfg.maxStatements) - 0.4 * Math.max(0, loud - cfg.maxLoudPatterns);
  if (stm > cfg.maxStatements) notes.push(`${stm} Statement-Teile`);
  if (loud > cfg.maxLoudPatterns) notes.push(`${loud} laute Muster`);
  // Vielseitigkeit 1–2 („sehr/eher speziell“, z. B. goldene Jacke): bei Alltags-Anlässen Abzug, bei Party/Date/Besonderer Anlass/Formell nicht
  if (!cfg.specialOccasions.includes(ctx.occasion)) {
    const special = items.filter((i) => { const v = Number(i.profile?.versatility); return Number.isFinite(v) && v > 0 && v <= cfg.specialMax; });
    if (special.length) { statement -= 0.35 * special.length; notes.push(`${special.length === 1 ? 'Spezielles Teil' : `${special.length} spezielle Teile`} für ${ctx.occasion === 'everyday' ? 'den Alltag' : 'diesen Anlass'}`); }
  }
  statement = clamp(statement);

  const occ = cfg.occasionFormality[ctx.occasion];
  let lo = occ[0], hi = occ[1];
  for (const t of tr) { lo = Math.max(lo, t.formality[0]); hi = Math.min(hi, t.formality[1]); }
  let formality: number;
  if (lo > hi) { formality = 0.2; notes.push('Formalität passt nicht zusammen'); }
  else formality = clamp(1 - 0.25 * Math.abs((lo + hi) / 2 - (occ[0] + occ[1]) / 2));

  let proportion = 1;
  const widthN = (i: OutfitItem | undefined) => {
    if (!i || i.fit_width == null) return null;
    const sc = fitScaleOf(i.category, 'width');
    return sc ? i.fit_width / Math.max(1, sc.keys.length - 1) : null;
  };
  const top = items.find((i) => i.category === 'top');
  const bottom = items.find((i) => i.category === 'pants' || i.category === 'shorts');
  const shoe = items.find((i) => i.category === 'shoe');
  const tw = widthN(top), bw = widthN(bottom);
  if (tw != null && bw != null && tw >= 0.66 && bw >= 0.66) { proportion -= 0.4; notes.push('oben und unten weit'); }
  const sw = shoe ? Number(shoe.profile?.visual_weight ?? NaN) : NaN;
  if (bw != null && !Number.isNaN(sw)) {
    if (sw >= 4 && bw <= 0.25) { proportion -= 0.3; notes.push('klobiger Schuh zu schmaler Hose'); }
    if (sw <= 2 && bw >= 0.75) { proportion -= 0.25; notes.push('zarter Schuh zu weiter Hose'); }
  }
  proportion = clamp(proportion);

  const sheens = items.map((i) => Number(i.profile?.sheen ?? 0));
  const tex = tr.map((t) => t.texture);
  let surface = Math.max(...tex) >= 4 && Math.min(...tex) <= 2 ? 1 : 0.85;
  if (sheens.filter((x) => x >= 4).length > 1) { surface -= 0.5; notes.push('mehrere glänzende Teile'); }
  surface = clamp(surface);

  const metals = new Set(items.map((i) => i.profile?.metal_tone).filter((m) => m === 'gold' || m === 'silver' || m === 'rose_gold'));
  const metal = metals.has('silver') && (metals.has('gold') || metals.has('rose_gold')) ? 0.5 : 1;
  if (metal < 1) notes.push('Gold und Silber gemischt');

  let variety = 0.7;
  const day = Date.parse(ctx.date);
  for (const i of items) {
    if (!i.last_worn) { variety += 0.05; continue; }
    const ago = (day - Date.parse(i.last_worn)) / 864e5;
    if (ago < cfg.recentDays) { variety -= 0.25; notes.push(`${i.name ?? 'Teil'} kürzlich getragen`); }
    else if (ago >= cfg.idleDays) variety += 0.1;
  }
  if (ctx.rainOn && ctx.rainSoft) for (const i of items) {
    if ((i.category === 'shoe' || i.category === 'outerwear') && rainOf(i).v === 0) { variety -= 0.3; notes.push(`${i.name ?? 'Teil'} mag keinen Regen`); }
  }
  if (ctx.rainOn && ctx.rain === 'drizzle') for (const i of items) {
    if ((i.category === 'shoe' || i.category === 'outerwear') && rainOf(i).v === 0) { variety -= 0.2; notes.push(`Niesel: ${i.name ?? 'Teil'} nicht regenfest`); }
  }
  // Hitze unter 30 °C: mittlere Teile erlaubt, aber abgewertet
  if (bandOf(ctx.tempC, cfg) === 'hot') {
    const mid = items.filter((i) => i.category !== 'shoe' && warmthOf(i).v > cfg.warmthMax.hot).length;
    if (mid) { variety -= cfg.hotPenalty * mid; notes.push('etwas warm für die Hitze'); }
  }
  // Schuhe weich nach Temperatur: Stiefel bei Kälte leicht bevorzugt, bei Hitze leicht abgewertet
  const shoeItem = items.find((i) => i.category === 'shoe');
  if (shoeItem) {
    const w = warmthOf(shoeItem).v, b = bandOf(ctx.tempC, cfg);
    if (w >= 2 && (b === 'cold' || b === 'freezing')) variety += 0.1;
    if (w >= 2 && b === 'hot') { variety -= 0.15; notes.push('Stiefel bei Hitze'); }
  }
  variety = clamp(variety);

  const parts: Parts = { color, statement, formality, proportion, surface, metal, variety };
  const w = cfg.weights;
  const sum = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  const score = (Object.keys(parts) as (keyof Parts)[]).reduce((a, k) => a + w[k] * parts[k], 0) / sum * 100;
  return { score: Math.round(score * 10) / 10, parts, notes };
}

// ---------- Aufbau ----------

export type BuiltOutfit = Scored & { slots: Partial<Record<Slot, OutfitItem>>; estimated: number };
export type PoolInfo = { counts: Record<Slot, number>; reasons: Record<string, number> };

/** Kandidaten je Slot nach den harten Filtern (mit Zählung der Gründe) */
export function candidates(pool: readonly OutfitItem[], ctx: DayContext, cfg: OutfitConfig = DEFAULT_OUTFIT_CONFIG): { bySlot: Record<Slot, OutfitItem[]>; info: PoolInfo } {
  const bySlot: Record<Slot, OutfitItem[]> = { bottom: [], base: [], mid: [], open: [], outer: [], shoes: [] };
  const reasons: Record<string, number> = {};
  for (const i of pool) for (const s of slotsOf(i)) {
    const r = hardReason(i, s, ctx, cfg);
    if (r) reasons[r] = (reasons[r] ?? 0) + 1; else bySlot[s].push(i);
  }
  const counts = Object.fromEntries(Object.entries(bySlot).map(([k, v]) => [k, v.length])) as Record<Slot, number>;
  return { bySlot, info: { counts, reasons } };
}

/** Ein Outfit Slot für Slot aufbauen: je Slot zufällig aus den besten k */
export function buildOutfit(bySlot: Record<Slot, OutfitItem[]>, ctx: DayContext, cfg: OutfitConfig = DEFAULT_OUTFIT_CONFIG, rnd: () => number = Math.random): BuiltOutfit | null {
  const order: Slot[] = ['bottom', 'mid', 'base', 'open', 'outer', 'shoes'];
  const want = new Set(skeleton(ctx.tempC, cfg, rnd));
  const chosen: Partial<Record<Slot, OutfitItem>> = {};
  for (const slot of order) {
    if (!want.has(slot)) continue;
    const used = new Set(Object.values(chosen).map((i) => i!.id));
    let list = bySlot[slot].filter((i) => !used.has(i.id));
    if (slot === 'base') list = list.filter((i) => baseAllowed(i, chosen, ctx, cfg));
    if (!list.length) { if (slot === 'mid' || slot === 'open' || slot === 'outer') { if (bandOf(ctx.tempC, cfg) === 'cold' || bandOf(ctx.tempC, cfg) === 'freezing') return null; continue; } return null; }
    const sofar = Object.values(chosen) as OutfitItem[];
    const ranked = list.map((i) => ({ i, s: scoreOutfit([...sofar, i], ctx, cfg).score + rnd() * 2 })).sort((a, b) => b.s - a.s);
    const top = ranked.slice(0, Math.max(1, cfg.topK));
    chosen[slot] = top[Math.floor(rnd() * top.length)]!.i;
  }
  const items = Object.values(chosen) as OutfitItem[];
  const sc = scoreOutfit(items, ctx, cfg);
  const estimated = items.filter((i) => traitsOf(i).partial || i.warmth == null).length;
  return { ...sc, slots: chosen, estimated };
}

/** n verschiedene Outfits würfeln */
export function generateOutfits(pool: readonly OutfitItem[], ctx: DayContext, n: number, cfg: OutfitConfig = DEFAULT_OUTFIT_CONFIG, rnd: () => number = Math.random): { outfits: BuiltOutfit[]; info: PoolInfo } {
  const { bySlot, info } = candidates(pool, ctx, cfg);
  const out: BuiltOutfit[] = [];
  const seen = new Set<string>();
  for (let tries = 0; out.length < n && tries < n * 8; tries++) {
    const o = buildOutfit(bySlot, ctx, cfg, rnd);
    if (!o) continue;
    const key = Object.values(o.slots).map((i) => i!.id).sort().join();
    if (seen.has(key)) continue;
    seen.add(key); out.push(o);
  }
  return { outfits: out, info };
}
