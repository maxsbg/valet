// Einstellungen der Outfit-Zusammenstellung an EINER Stelle (Spec docs/outfits/VALET_OUTFIT_ZUSAMMENSTELLUNG.md).
// Neutrales Grundprofil. Ein späteres Stilprofil (laut/leise usw.) ändert nur diese Werte, nicht die Regeln.

import type { OccasionKey } from '../occasions';

import type { Range } from '../ai/profile';

export type RainLevel = 'none' | 'drizzle' | 'rain' | 'heavy';
export type ColorClashRule = 'strong' | 'warmcool' | 'both' | 'off';

export type OutfitConfig = {
  /** Gewichte der weichen Bewertung (Summe egal, wird normiert) */
  weights: { color: number; statement: number; formality: number; proportion: number; surface: number; metal: number; variety: number };
  /** Temperaturstufen (gefühlt, °C, untere Grenzen) */
  temp: { veryHot: number; hot: number; mild: number; cool: number; cold: number; freezing: number };
  /** Höchste Wärme je Stufe (0 sehr leicht … 3 warm); unter `cold` fliegt „sehr leicht“ raus */
  /** hot: ohne Abzug erlaubt; hotSoft: bis 29 °C noch erlaubt (mit Abzug `hotPenalty` je Teil), ab `temp.veryHot` raus */
  warmthMax: { hot: number; hotSoft: number; mild: number };
  hotPenalty: number;
  /** Außenlage: Mindest-Wärme bei 3–9 ° bzw. unter 3 ° */
  outerWarmthMin: { cold: number; freezing: number };
  /** Schuhe (°C): Zehen offen nicht darunter, gefüttert nicht darüber */
  shoeTemp: { openMin: number; linedMax: number };
  /** Regen: Mindest-Regenschutz (0 schlecht · 1 mittel · 2 gut) für Außenlage/Schuhe */
  rainMin: Record<Exclude<RainLevel, 'none' | 'drizzle'>, { outer: number; shoe: number }>;
  /** Regen-Grenzen (mm/h) und Wahrscheinlichkeiten (%) */
  rainMm: { drizzle: number; heavy: number };
  rainProb: { hard: number; soft: number };
  /** Formalität je Anlass (1 Freizeit … 5 sehr formell) */
  occasionFormality: Record<OccasionKey, Range>;
  /** Zeitraum je Anlass (Stunden; Ende > 24 = Folgetag) */
  occasionHours: Record<OccasionKey, Range>;
  /** Anlässe, bei denen „Regen berücksichtigen“ standardmäßig aus ist */
  rainOffByDefault: readonly OccasionKey[];
  /** Farbregeln */
  colorClash: ColorClashRule;
  maxAccents: number;
  /** „Fast gleich“: Helligkeitsunterschied (OKLCH L), unter dem zwei Farben einer Familie sich beißen */
  nearSameL: number;
  /** Navy + Schwarz als „fast gleich“ werten (Max, 20.11.2026: nein) */
  navyBlackNearSame: boolean;
  /** Statement-Teile und laute Muster */
  maxStatements: number;
  maxLoudPatterns: number;
  /** Spezielle Teile (Vielseitigkeit ≤ specialMax) bei Alltags-Anlässen abwerten (Max, 21.11.2026) */
  specialMax: number;
  specialOccasions: readonly OccasionKey[];
  /** Auswahl: zufällig aus den besten k je Slot */
  topK: number;
  /** Vielfalt: Tage */
  recentDays: number;
  idleDays: number;
};

export const DEFAULT_OUTFIT_CONFIG: OutfitConfig = {
  weights: { color: 35, statement: 20, formality: 10, proportion: 10, surface: 5, metal: 5, variety: 15 },
  temp: { veryHot: 30, hot: 24, mild: 17, cool: 10, cold: 3, freezing: -99 },
  warmthMax: { hot: 1, hotSoft: 2, mild: 2 }, hotPenalty: 0.15,
  outerWarmthMin: { cold: 2, freezing: 3 },
  shoeTemp: { openMin: 12, linedMax: 15 },
  rainMin: { rain: { outer: 1, shoe: 1 }, heavy: { outer: 2, shoe: 1 } },
  rainMm: { drizzle: 0.5, heavy: 4 },
  rainProb: { hard: 50, soft: 30 },
  occasionFormality: {
    everyday: [1, 3], campus: [1, 3], office: [3, 4], cafe: [2, 3], date: [2, 4], party: [2, 4], formal: [4, 5],
    special_occasion: [3, 5], sport: [1, 1], vacation: [1, 3], beach: [1, 2], loungewear: [1, 1], other: [1, 4],
  },
  occasionHours: {
    everyday: [8, 20], campus: [8, 19], office: [7, 19], cafe: [10, 19], date: [18, 24], party: [20, 27], formal: [16, 24],
    special_occasion: [12, 24], sport: [17, 21], vacation: [9, 22], beach: [10, 19], loungewear: [8, 22], other: [8, 22],
  },
  rainOffByDefault: ['loungewear'],
  colorClash: 'strong',
  maxAccents: 2,
  nearSameL: 0.09,
  navyBlackNearSame: false,
  maxStatements: 1,
  maxLoudPatterns: 1,
  specialMax: 2,
  specialOccasions: ['party', 'date', 'special_occasion', 'formal'],
  topK: 4,
  recentDays: 7,
  idleDays: 30,
};
