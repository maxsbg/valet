// Regeln rund um ein einzelnes Teil
import type { Item, Side } from './model';

/** Wendeteil mit echter zweiter Seite (Bild vorhanden). */
export const isReversible = (i: Pick<Item, 'reversible' | 'images'>): boolean =>
  !!(i.reversible && i.images.b);

/** Welche Seite gilt: gewünschte Seite, sonst Hauptseite – bei Nicht-Wendeteilen immer 'a'. */
export const sideOf = (i: Pick<Item, 'reversible' | 'images' | 'mainSide'>, side?: Side): Side =>
  isReversible(i) ? (side ?? i.mainSide ?? 'a') : 'a';

export const sideImage = (i: Pick<Item, 'reversible' | 'images' | 'mainSide'>, side?: Side) =>
  i.images[sideOf(i, side)];

export const sideColor = (i: Pick<Item, 'reversible' | 'images' | 'mainSide' | 'color' | 'altColor'>, side?: Side): string =>
  sideOf(i, side) === 'b' ? i.altColor || i.color || '' : i.color || '';

/** Aussortiert oder verkauft: zählt nicht mehr zum Bestand. */
export const isGone = (i: Pick<Item, 'status'>): boolean => i.status === 'out' || i.status === 'sold';

/** Wirklich im Schrank verfügbar (für Outfit-Vorschläge). */
export const isAvailable = (i: Pick<Item, 'status'>): boolean => !i.status;
