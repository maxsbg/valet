import { supabase } from './supabase';
import { personText } from '@valet/ui';
import { isWishTag, type WishTag, type ItemStatus } from '@valet/core';
import { loadOutfits, todayIds, todayWho, type Hold, type Outfit, type Wear } from './outfits';
import type { PersonLook } from '@/components/ItemTile';

export type Person = { id: string; name: string; color: string | null; user_id: string | null; item_order: string[] | null };
export type Tile = {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  color: string | null;
  /** Spiegel von owner_id für Auswertungen: genau ein Besitzer → dessen ID, sonst null */
  ownerId: string | null;
  /** Besitzer (Personen-IDs) */
  owners: string[];
  status: ItemStatus | null;
  qty: number;
  reversible: boolean;
  setId: string | null;
  isWish: boolean;
  /** Wunschliste: Liste (eine pro Teil) und Kategorie (Grail, Watchlist …) */
  wishlistId: string | null;
  wishTag: WishTag | null;
  /** Shop (für die Suche in der Wunschliste) */
  shop: string | null;
  price: number | null;
  pricePaid: number | null;
  listPrice: number | null;
  soldPrice: number | null;
  payers: { personId: string | null; amount: number | null }[] | null;
  material: string | null;
  createdAt: string;
  purchaseDate: string | null;
  seasons: string[];
  style: string | null;
  /** Hauptfarbe für den Farbschein (aus der Farbanalyse des Bildes, sonst aus dem Farbnamen) */
  hex: string | null;
  /** Highlight-Farbe (zweite, auffällige Farbe am Teil) für den Innenschein */
  highlight: string | null;
  /** Vorschaubild (400 px) für Kacheln */
  thumb: string | null;
  /** Hauptbild (freigestellt oder Original) für die Detailseite */
  image: string | null;
};
/** Liste der Wunschliste; gehört einer Person, sichtbar für alle im Schrank */
export type Wishlist = { id: string; name: string; ownerId: string | null; itemOrder: string[]; createdAt: string };
export type Wardrobe = {
  id: string; name: string; persons: Person[]; items: Tile[];
  wishlists: Wishlist[];
  outfits: Outfit[];
  /** einzeln eingetragene Trage-Tage */
  wears: Wear[];
  /** einzeln reservierte Teile (ab heute) */
  holds: Hold[];
  /** heute getragen oder fürs heutige Outfit geplant */
  today: string[];
  /** wer ein Teil heute trägt bzw. für heute reserviert hat (Teil-ID → Person-ID) */
  todayBy: Record<string, string | null>;
};

/** Lädt den ersten Kleiderschrank, in dem der angemeldete Nutzer Mitglied ist. */
export async function loadWardrobe(): Promise<Wardrobe | null> {
  const { data: ws, error: e1 } = await supabase.from('wardrobes').select('id,name').order('created_at').limit(1);
  if (e1) throw e1;
  const w = ws?.[0];
  if (!w) return null;
  const [persons, items, images, lists, rest] = await Promise.all([
    supabase.from('persons').select('id,name,color,user_id,item_order').eq('wardrobe_id', w.id).order('created_at'),
    supabase
      .from('items')
      .select('id,name,brand,category,color,owner_id,owner_ids,highlight_color,status,qty,reversible,main_side,set_id,is_wish,wishlist_id,wish_tag,shop,price_paid,list_price,sold_price,payers,material,created_at,purchase_date,seasons,style')
      .eq('wardrobe_id', w.id),
    supabase.from('item_images').select('item_id,side,kind,colors,storage_path'),
    supabase.from('wishlists').select('id,name,owner_id,item_order,created_at').eq('wardrobe_id', w.id).order('created_at'),
    loadOutfits(w.id),
  ]);
  for (const r of [persons, items, images, lists]) if (r.error) throw r.error;
  const colorsBy = new Map<string, string>();
  const thumbBy = new Map<string, string>();
  const imageBy = new Map<string, string>();
  for (const im of images.data ?? []) {
    const key = `${im.item_id}:${side(im.side)}`;
    if (im.kind === 'thumb') { thumbBy.set(key, imageUrl(im.storage_path)); continue; }
    // freigestelltes Bild hat Vorrang vor dem Original
    if (im.kind === 'cutout' || !imageBy.has(key)) imageBy.set(key, imageUrl(im.storage_path));
    const c = Array.isArray(im.colors) ? (im.colors as { h: string; s: number }[]) : [];
    const top = [...c].sort((a, b) => b.s - a.s)[0];
    if (top?.h) colorsBy.set(key, top.h);
  }
  const tiles: Tile[] = (items.data ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    brand: i.brand,
    category: i.category ?? 'sonstiges',
    color: i.color,
    ownerId: i.owner_id,
    owners: i.owner_ids ?? [],
    status: i.status,
    qty: i.qty ?? 1,
    reversible: !!i.reversible,
    setId: i.set_id,
    isWish: !!i.is_wish,
    wishlistId: i.wishlist_id ?? null,
    wishTag: isWishTag(i.wish_tag) ? i.wish_tag : null,
    shop: i.shop || null,
    price: i.price_paid ?? i.list_price ?? null,
    pricePaid: i.price_paid,
    listPrice: i.list_price,
    soldPrice: i.sold_price,
    payers: Array.isArray(i.payers) ? (i.payers as { person_id?: string | null; amount?: number | null }[]).map((p) => ({ personId: p.person_id ?? null, amount: p.amount ?? null })) : null,
    material: i.material,
    createdAt: i.created_at,
    purchaseDate: i.purchase_date,
    seasons: i.seasons ?? [],
    style: i.style,
    hex: pick(colorsBy, i.id, i.main_side) ?? nameToHex(i.color),
    highlight: i.highlight_color ?? null,
    thumb: pick(thumbBy, i.id, i.main_side),
    image: pick(imageBy, i.id, i.main_side),
  }));
  const ids = new Set(tiles.map((t) => t.id));
  const wears = rest.wears.filter((x) => ids.has(x.itemId));
  const holds = rest.holds.filter((x) => ids.has(x.itemId));
  const wishlists: Wishlist[] = (lists.data ?? []).map((l) => ({ id: l.id, name: l.name, ownerId: l.owner_id, itemOrder: l.item_order ?? [], createdAt: l.created_at }));
  return { id: w.id, name: w.name, persons: persons.data ?? [], items: tiles, wishlists, outfits: rest.outfits, wears, holds, today: todayIds(rest.outfits, wears, holds), todayBy: todayWho(rest.outfits, wears, holds) };
}

/** Seite eines Bildes ('a'/'b'); ältere Daten hatten Großbuchstaben oder Leerzeichen */
const side = (v: string | null) => (v ?? 'a').trim().toLowerCase();
/** Wert für die Hauptseite eines Teils, sonst Seite A */
const pick = (m: Map<string, string>, id: string, main: string | null) => m.get(`${id}:${side(main)}`) ?? m.get(`${id}:a`) ?? null;

/** Öffentliche Adresse eines Bildes im Bucket „items“ (kein Netzaufruf) */
export const imageUrl = (path: string) => supabase.storage.from('items').getPublicUrl(path).data.publicUrl;

export const NAMED: Record<string, string> = {
  schwarz: '#1c1c1e', anthrazit: '#3a3a3c', grau: '#8e8e93', hellgrau: '#c7c7cc', weiß: '#e8e6e1', creme: '#efe6d2',
  beige: '#d6c3a5', camel: '#c19a6b', braun: '#6b4a34', navy: '#1f2a44', blau: '#2f5bd3', hellblau: '#9cc3e6',
  petrol: '#1f6f78', grün: '#3f7d4a', oliv: '#6b6b3a', khaki: '#a39a6b', rot: '#c62f3a', burgunder: '#6d1f2c',
  rosa: '#f0a6bf', lila: '#8a5cb8', gelb: '#f2d24b', orange: '#f08a3c', silber: '#c0c0c0', gold: '#c9a646', denim: '#4a6a95',
};
export function nameToHex(name: string | null): string | null {
  const first = name?.split('/')[0]?.trim().toLowerCase();
  return first ? NAMED[first] ?? null : null;
}

/** Nächstliegender Farbname zu einer Hex-Farbe (Vorschlag beim Anlegen) */
export function hexToName(hex: string): string | null {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = rgb(hex);
  if ([r, g, b].some(Number.isNaN)) return null;
  let best: string | null = null, bestD = Infinity;
  for (const [name, h] of Object.entries(NAMED)) {
    const [r2, g2, b2] = rgb(h);
    // gewichteter Abstand (Auge reagiert stärker auf Grün)
    const d = 2 * (r - r2) ** 2 + 4 * (g - g2) ** 2 + 3 * (b - b2) ** 2;
    if (d < bestD) { bestD = d; best = name; }
  }
  return best && best[0].toUpperCase() + best.slice(1);
}

/** Personenfarbe auf der Kachel: „Rosa“/„Rot“, sonst keine (→ ink/schwarz) */
export function personTone(color: string | null): 'pink' | 'red' | null {
  if (!color) return null;
  if (/rot|red/i.test(color)) return 'red';
  if (/rosa|pink/i.test(color)) return 'pink';
  return null;
}

/** Darstellung einer Person auf der Kachel-Plakette (Plaketten sind immer hell → helle Personenfarben) */
export function personLook(p: Person, ink: string, tones: { pink: string; red: string }): PersonLook {
  const tone = personTone(p.color);
  return {
    name: p.name,
    letter: p.name.trim().slice(0, 1).toUpperCase(),
    stroke: tone ? tones[tone] : ink,
    text: tone ? personText[tone] : ink,
  };
}

/** Personenfarbe aus dem gespeicherten Namen („Rosa“, „Rot“) */
export function personKey(color: string | null): 'pink' | 'red' {
  return color && /rot|red/i.test(color) ? 'red' : 'pink';
}

/** Heutiges Datum (lokale Zeit) als YYYY-MM-DD */
export function todayLocal(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
