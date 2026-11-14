// Kategorien und Status – 1:1 aus dem bisherigen Valet übernommen

export const CATEGORIES = [
  { id: 'mantel', label: 'Mäntel' },
  { id: 'jacke', label: 'Jacken' },
  { id: 'pullover', label: 'Pullover & Hoodies' },
  { id: 'oberteil', label: 'Oberteile' },
  { id: 'hose', label: 'Hosen' },
  { id: 'shorts', label: 'Shorts' },
  { id: 'schuhe', label: 'Schuhe' },
  { id: 'sport', label: 'Sport' },
  { id: 'tasche', label: 'Taschen' },
  { id: 'accessoire', label: 'Accessoires' },
  { id: 'sonstiges', label: 'Sonstiges' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

/** Kategorien, die im Outfit „nebenbei“ laufen (keine Hauptlage). */
export const SIDE_CATEGORIES: ReadonlySet<string> = new Set(['accessoire', 'tasche', 'sonstiges']);

export const categoryLabel = (id: string): string =>
  CATEGORIES.find((c) => c.id === id)?.label ?? 'Sonstiges';

export const STATUSES = {
  wash: { label: 'Wäsche', color: '#3b7bbf' },
  repair: { label: 'Reparatur', color: '#555555' },
  lent: { label: 'Verliehen', color: '#b7791f' },
  stored: { label: 'Eingelagert', color: '#8a7a5c' },
  out: { label: 'Aussortiert', color: '#7a7468' },
  sold: { label: 'Verkauft', color: '#6d1f2c' },
} as const;

export type ItemStatus = keyof typeof STATUSES;

export const isItemStatus = (s: unknown): s is ItemStatus =>
  typeof s === 'string' && s in STATUSES;

export const SEASONS = ['Sommer', 'Übergang', 'Winter'] as const;
export const STYLES = ['Casual', 'Streetwear', 'Schick', 'Business', 'Sport'] as const;
