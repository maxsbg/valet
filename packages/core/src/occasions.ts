// Anlässe für Outfits – feste Liste (entschieden 14.11.2026, ersetzt die alten freien Anlässe).
// Gespeichert wird der Key (outfits.occasions text[], seit 19.11.2026), das Label nur in der Oberfläche;
// das Symbol hängt am Schlüssel `icon` (Symbol-Pool SYMBOLS in @valet/ui).

import { label, toKey, toKeys } from './keys';

export const OCCASIONS = [
  { key: 'everyday', label: 'Alltag', icon: 'occAlltag' },
  { key: 'office', label: 'Büro', icon: 'occBuero' },
  { key: 'date', label: 'Date', icon: 'occDate' },
  { key: 'formal', label: 'Formell', icon: 'occFormell' },
  { key: 'vacation', label: 'Urlaub', icon: 'occUrlaub' },
  { key: 'loungewear', label: 'Loungewear', icon: 'occLounge' },
  { key: 'party', label: 'Party', icon: 'occParty' },
  { key: 'sport', label: 'Sport', icon: 'occSport' },
  { key: 'special_occasion', label: 'Besonderer Anlass', icon: 'occBesonders' },
  { key: 'campus', label: 'Campus', icon: 'occCampus' },
  { key: 'beach', label: 'Strand', icon: 'occStrand' },
  { key: 'cafe', label: 'Café', icon: 'occCafe' },
  { key: 'other', label: 'Sonstiges', icon: 'occSonst' },
] as const;

export type Occasion = (typeof OCCASIONS)[number];
export type OccasionKey = Occasion['key'];
export type OccasionLabel = Occasion['label'];
export type OccasionIcon = Occasion['icon'];

/**
 * Alte Anlässe aus dem alten Valet → neue Keys (nur beim Lesen; gespeichert wird erst beim nächsten Ändern).
 * „Abend/Ausgehen“ → Party ist vorläufig (Max fragen, ob Party oder Date). Gleiche Altwerte wie Migration 0014.
 */
export const LEGACY_OCCASIONS: Record<string, OccasionKey> = {
  Uni: 'campus',
  Arbeit: 'office',
  'Training/Sport': 'sport',
  Training: 'sport',
  'Abend/Ausgehen': 'party',
  Abend: 'party',
  Ausgehen: 'party',
};

const byKey = new Map<string, Occasion>(OCCASIONS.map((o) => [o.key, o]));

/** Anlass zu einem Key (oder deutschem Label bzw. Altwert) */
export const occasionOf = (value: string): Occasion | undefined => byKey.get(toKey(OCCASIONS, value, LEGACY_OCCASIONS) ?? '');
/** Deutscher Anzeigename eines Anlasses */
export const occasionLabel = (key: string): string => label(OCCASIONS, key);

/**
 * Anlässe eines Outfits auf die feste Liste bringen (Keys): Labels und alte Namen umrechnen, Unbekanntes weglassen,
 * doppelte entfernen, Reihenfolge wie gespeichert.
 */
export function normalizeOccasions(list: readonly string[] | null | undefined): OccasionKey[] {
  return toKeys(OCCASIONS, list ?? [], LEGACY_OCCASIONS) as OccasionKey[];
}

/** Plaketten oben links auf der Outfit-Karte: erster Anlass in der Ecke, dann der zweite bzw. „+N“ (wie die Monogramme) */
export type OccasionSlot = { icon: OccasionIcon; label: OccasionLabel } | { more: number };

export function occasionSlots(list: readonly string[]): OccasionSlot[] {
  const occ = normalizeOccasions(list).map((k) => byKey.get(k)!);
  if (!occ.length) return [];
  const first = { icon: occ[0]!.icon, label: occ[0]!.label };
  if (occ.length === 1) return [first];
  if (occ.length === 2) return [first, { icon: occ[1]!.icon, label: occ[1]!.label }];
  return [first, { more: occ.length - 1 }];
}
