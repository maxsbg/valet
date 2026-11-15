// Status (Kategorien: categories.ts, weitere Listen: attributes.ts)
export { CATEGORY_NAMES as CATEGORIES, SIDE_CATEGORIES } from './categories';

/** Anzeigename einer Kategorie (gespeichert wird der Name selbst) */
export const categoryLabel = (name: string | null | undefined): string => name || 'Ohne Kategorie';

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

