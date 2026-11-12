import type { Tile } from './wardrobe';

export const SORTS = [
  { id: 'random', label: 'Zufällig' },
  { id: 'own', label: 'Eigene Reihenfolge' },
  { id: 'newest', label: 'Neueste' },
  { id: 'az', label: 'A–Z' },
  { id: 'priceDesc', label: 'Preis ↓' },
  { id: 'priceAsc', label: 'Preis ↑' },
  { id: 'bought', label: 'Kaufdatum' },
] as const;
export type SortId = (typeof SORTS)[number]['id'];

/** Gleichbleibender Zufall je Teil und „Mischung“ (seed), damit das Mosaik beim Filtern nicht springt */
function rand(id: string, seed: number): number {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

export function sortTiles(items: Tile[], sort: SortId, seed: number, order: string[] = []): Tile[] {
  const a = [...items];
  const pos = new Map(order.map((id, n) => [id, n]));
  const newest = (x: Tile, y: Tile) => y.createdAt.localeCompare(x.createdAt);
  switch (sort) {
    case 'random': return a.sort((x, y) => rand(x.id, seed) - rand(y.id, seed));
    case 'own': return a.sort((x, y) => (pos.get(x.id) ?? 1e6) - (pos.get(y.id) ?? 1e6) || newest(x, y));
    case 'newest': return a.sort(newest);
    case 'az': return a.sort((x, y) => x.name.localeCompare(y.name, 'de', { sensitivity: 'base' }));
    case 'priceDesc': return a.sort((x, y) => (y.price ?? -1) - (x.price ?? -1));
    case 'priceAsc': return a.sort((x, y) => (x.price ?? 1e9) - (y.price ?? 1e9));
    case 'bought': return a.sort((x, y) => (y.purchaseDate ?? '').localeCompare(x.purchaseDate ?? '') || newest(x, y));
  }
}

export type Filters = { status: string[]; seasons: string[]; styles: string[] };
export const NO_FILTERS: Filters = { status: [], seasons: [], styles: [] };
export const filterCount = (f: Filters) => f.status.length + f.seasons.length + f.styles.length;

export const STATUS_FILTERS = [
  { id: 'wash', label: 'Wäsche' },
  { id: 'repair', label: 'Reparatur' },
  { id: 'lent', label: 'Verliehen' },
  { id: 'gone', label: 'Aussortiert & verkauft' },
] as const;
export const SEASON_FILTERS = ['Sommer', 'Übergang', 'Winter'];
export const STYLE_FILTERS = ['Casual', 'Streetwear', 'Sport', 'Schick', 'Business'];

/** Ohne Status-Filter: nur Teile im Schrank (ohne aussortiert/verkauft). Innerhalb einer Gruppe „oder“, zwischen Gruppen „und“. */
export function applyFilters(items: Tile[], f: Filters): Tile[] {
  return items.filter((i) => {
    const gone = i.status === 'out' || i.status === 'sold';
    if (f.status.length) {
      const ok = f.status.some((s) => (s === 'gone' ? gone : i.status === s));
      if (!ok) return false;
    } else if (gone) return false;
    if (f.seasons.length && !f.seasons.some((s) => i.seasons.includes(s))) return false;
    if (f.styles.length && !(i.style && f.styles.includes(i.style))) return false;
    return true;
  });
}
