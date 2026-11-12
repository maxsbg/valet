// Getragen-Tage und Kosten pro Tragen – Logik wie im alten Valet:
// getragen = einzeln eingetragene Tage + Tage, an denen ein Outfit mit dem Teil geplant war (bis heute)
import type { Item, Outfit, WearLog } from './model';
import { totalPaid } from './money';

export const todayISO = (d = new Date()): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export function wearDates(itemId: string, wears: WearLog, outfits: Outfit[], today = todayISO()): string[] {
  const set = new Set((wears[itemId] ?? []).filter((d) => d <= today));
  for (const o of outfits) {
    if (!o.itemIds.includes(itemId)) continue;
    for (const p of o.plans) if (p.date && p.date <= today) set.add(p.date);
  }
  return [...set].sort();
}

/** Kosten pro Tragen; null, wenn nie getragen oder ohne Preis. */
export function costPerWear(item: Pick<Item, 'id' | 'pricePaid' | 'qty'>, wears: WearLog, outfits: Outfit[], today = todayISO()): number | null {
  const n = wearDates(item.id, wears, outfits, today).length;
  const p = totalPaid(item);
  return n && p ? p / n : null;
}

const dateOf = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
};

export const daysSince = (iso: string, today = todayISO()): number =>
  Math.round((dateOf(today).getTime() - dateOf(iso).getTime()) / 864e5);
