// Anlässe für Outfits – feste Liste (entschieden 14.11.2026, ersetzt die alten freien Anlässe).
// Gespeichert wird der Name (outfits.occasions text[]), das Symbol hängt am Schlüssel `icon` (Symbol-Pool SYMBOLS in @valet/ui).

export const OCCASIONS = [
  { label: 'Alltag', icon: 'occAlltag' },
  { label: 'Büro', icon: 'occBuero' },
  { label: 'Date', icon: 'occDate' },
  { label: 'Formell', icon: 'occFormell' },
  { label: 'Urlaub', icon: 'occUrlaub' },
  { label: 'Loungewear', icon: 'occLounge' },
  { label: 'Party', icon: 'occParty' },
  { label: 'Sport', icon: 'occSport' },
  { label: 'Besonderer Anlass', icon: 'occBesonders' },
  { label: 'Campus', icon: 'occCampus' },
  { label: 'Strand', icon: 'occStrand' },
  { label: 'Café', icon: 'occCafe' },
  { label: 'Sonstiges', icon: 'occSonst' },
] as const;

export type Occasion = (typeof OCCASIONS)[number];
export type OccasionLabel = Occasion['label'];
export type OccasionIcon = Occasion['icon'];

/**
 * Alte Anlässe aus dem alten Valet → neue Namen (nur beim Lesen; gespeichert wird erst beim nächsten Ändern).
 * „Abend/Ausgehen“ → Party ist vorläufig (Max fragen, ob Party oder Date).
 */
export const LEGACY_OCCASIONS: Record<string, OccasionLabel> = {
  Uni: 'Campus',
  Arbeit: 'Büro',
  'Training/Sport': 'Sport',
  'Abend/Ausgehen': 'Party',
};

const byLabel = new Map<string, Occasion>(OCCASIONS.map((o) => [o.label, o]));

export const occasionOf = (label: string): Occasion | undefined => byLabel.get(label);

/**
 * Anlässe eines Outfits auf die feste Liste bringen: alte Namen umbenennen, Unbekanntes weglassen,
 * doppelte entfernen, Reihenfolge wie gespeichert.
 */
export function normalizeOccasions(list: readonly string[] | null | undefined): OccasionLabel[] {
  const out: OccasionLabel[] = [];
  for (const raw of list ?? []) {
    const name = LEGACY_OCCASIONS[raw] ?? raw;
    const o = byLabel.get(name);
    if (o && !out.includes(o.label)) out.push(o.label);
  }
  return out;
}

/** Plaketten oben links auf der Outfit-Karte: erster Anlass in der Ecke, dann der zweite bzw. „+N“ (wie die Monogramme) */
export type OccasionSlot = { icon: OccasionIcon; label: OccasionLabel } | { more: number };

export function occasionSlots(list: readonly string[]): OccasionSlot[] {
  const occ = normalizeOccasions(list).map((l) => byLabel.get(l)!);
  if (!occ.length) return [];
  const first = { icon: occ[0]!.icon, label: occ[0]!.label };
  if (occ.length === 1) return [first];
  if (occ.length === 2) return [first, { icon: occ[1]!.icon, label: occ[1]!.label }];
  return [first, { more: occ.length - 1 }];
}
