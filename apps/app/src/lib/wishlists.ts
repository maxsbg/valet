import { WISH_TAGS, type WishTag } from '@valet/core';
import { supabase } from './supabase';
import { rand } from './sort';
import type { Tile, Wishlist } from './wardrobe';

// Wunschliste: Listen anlegen/umbenennen/löschen, Reihenfolge, Suche, Filter und Sortierung (entschieden 14.11.2026)

/** Wunschteil-Detail → „Liste“ antippen: diese Liste beim nächsten Öffnen der Wunschliste geöffnet zeigen */
export const wishlistNav: { open: string | null } = { open: null };

export async function createList(wardrobeId: string, name: string, ownerId: string | null): Promise<string> {
  const r = await supabase.from('wishlists').insert({ wardrobe_id: wardrobeId, name: name.trim(), owner_id: ownerId }).select('id').single();
  if (r.error) throw r.error;
  return r.data.id as string;
}

export async function renameList(id: string, name: string) {
  const r = await supabase.from('wishlists').update({ name: name.trim() }).eq('id', id);
  if (r.error) throw r.error;
}

/** Liste löschen – die Teile bleiben auf der Wunschliste (wishlist_id wird per „on delete set null“ leer) */
export async function deleteList(id: string) {
  const r = await supabase.from('wishlists').delete().eq('id', id);
  if (r.error) throw r.error;
}

export async function setListOrder(id: string, itemIds: string[]) {
  const r = await supabase.from('wishlists').update({ item_order: itemIds }).eq('id', id);
  if (r.error) throw r.error;
}

// ---------- Sortieren ----------

export const WISH_SORTS = [
  { id: 'random', label: 'Zufällig' },
  { id: 'own', label: 'Eigene Reihenfolge' },
  { id: 'added', label: 'Zuletzt hinzugefügt' },
  { id: 'priceDesc', label: 'Höchster Preis' },
  { id: 'priceAsc', label: 'Niedrigster Preis' },
  { id: 'az', label: 'A–Z' },
] as const;
export type WishSortId = (typeof WISH_SORTS)[number]['id'];

const added = (a: Tile, b: Tile) => b.createdAt.localeCompare(a.createdAt);

/** Eigene Reihenfolge: in einer Liste deren item_order; bei „Alle“ die Listen nacheinander, Teile ohne Liste am Ende. Unbekannte Teile → zuletzt hinzugefügt zuerst. */
export function ownOrder(lists: Wishlist[], listId: string | null): string[] {
  if (listId) return lists.find((l) => l.id === listId)?.itemOrder ?? [];
  return lists.flatMap((l) => l.itemOrder);
}

export function sortWishes(items: Tile[], sort: WishSortId, seed: number, order: string[]): Tile[] {
  const a = [...items];
  const pos = new Map(order.map((id, i) => [id, i]));
  switch (sort) {
    case 'random': return a.sort((x, y) => rand(x.id, seed) - rand(y.id, seed));
    case 'own': return a.sort((x, y) => (pos.get(x.id) ?? 1e6) - (pos.get(y.id) ?? 1e6) || added(x, y));
    case 'added': return a.sort(added);
    case 'priceDesc': return a.sort((x, y) => (y.price ?? -1) - (x.price ?? -1) || added(x, y));
    case 'priceAsc': return a.sort((x, y) => (x.price ?? 1e9) - (y.price ?? 1e9) || added(x, y));
    case 'az': return a.sort((x, y) => x.name.localeCompare(y.name, 'de', { sensitivity: 'base' }));
  }
}

// ---------- Filter und Suche ----------

export type WishFilters = { person: string | null; tags: WishTag[] };
export const NO_WISH_FILTERS: WishFilters = { person: null, tags: [] };

/** Person: Teil gehört ihr; Kategorien: „oder“ untereinander, „und“ zur Person */
export function applyWishFilters(items: Tile[], f: WishFilters): Tile[] {
  return items.filter((i) =>
    (!f.person || i.owners.includes(f.person)) && (!f.tags.length || (!!i.wishTag && f.tags.includes(i.wishTag))));
}

/** Suche in Name, Marke, Shop und Kategorie („grail“ findet Grails) */
export function matchesWish(i: Tile, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const tag = WISH_TAGS.find((w) => w.id === i.wishTag)?.label;
  return [i.name, i.brand, i.shop, tag].some((f) => f?.toLowerCase().includes(s));
}
