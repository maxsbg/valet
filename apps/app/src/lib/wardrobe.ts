import { supabase } from './supabase';

export type Person = { id: string; name: string; color: string | null; user_id: string | null; item_order: string[] | null };
export type Tile = {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  color: string | null;
  ownerId: string | null;
  status: 'wash' | 'repair' | 'lent' | 'out' | 'sold' | null;
  qty: number;
  reversible: boolean;
  setId: string | null;
  isWish: boolean;
  price: number | null;
  createdAt: string;
  /** Hauptfarbe für den Farbschein (aus der Farbanalyse des Bildes, sonst aus dem Farbnamen) */
  hex: string | null;
};
export type Wardrobe = { id: string; name: string; persons: Person[]; items: Tile[] };

/** Lädt den ersten Kleiderschrank, in dem der angemeldete Nutzer Mitglied ist. */
export async function loadWardrobe(): Promise<Wardrobe | null> {
  const { data: ws, error: e1 } = await supabase.from('wardrobes').select('id,name').order('created_at').limit(1);
  if (e1) throw e1;
  const w = ws?.[0];
  if (!w) return null;
  const [persons, items, images] = await Promise.all([
    supabase.from('persons').select('id,name,color,user_id,item_order').eq('wardrobe_id', w.id).order('created_at'),
    supabase
      .from('items')
      .select('id,name,brand,category,color,owner_id,status,qty,reversible,main_side,set_id,is_wish,price_paid,list_price,created_at')
      .eq('wardrobe_id', w.id),
    supabase.from('item_images').select('item_id,side,colors'),
  ]);
  for (const r of [persons, items, images]) if (r.error) throw r.error;
  const colorsBy = new Map<string, string>();
  for (const im of images.data ?? []) {
    const c = Array.isArray(im.colors) ? (im.colors as { h: string; s: number }[]) : [];
    const top = [...c].sort((a, b) => b.s - a.s)[0];
    if (top?.h) colorsBy.set(`${im.item_id}:${(im.side ?? 'A').trim()}`, top.h);
  }
  const tiles: Tile[] = (items.data ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    brand: i.brand,
    category: i.category ?? 'sonstiges',
    color: i.color,
    ownerId: i.owner_id,
    status: i.status,
    qty: i.qty ?? 1,
    reversible: !!i.reversible,
    setId: i.set_id,
    isWish: !!i.is_wish,
    price: i.price_paid ?? i.list_price ?? null,
    createdAt: i.created_at,
    hex: colorsBy.get(`${i.id}:${(i.main_side ?? 'A').trim()}`) ?? colorsBy.get(`${i.id}:A`) ?? nameToHex(i.color),
  }));
  return { id: w.id, name: w.name, persons: persons.data ?? [], items: tiles };
}

const NAMED: Record<string, string> = {
  schwarz: '#1c1c1e', anthrazit: '#3a3a3c', grau: '#8e8e93', hellgrau: '#c7c7cc', weiß: '#e8e6e1', creme: '#efe6d2',
  beige: '#d6c3a5', camel: '#c19a6b', braun: '#6b4a34', navy: '#1f2a44', blau: '#2f5bd3', hellblau: '#9cc3e6',
  petrol: '#1f6f78', grün: '#3f7d4a', oliv: '#6b6b3a', khaki: '#a39a6b', rot: '#c62f3a', burgunder: '#6d1f2c',
  rosa: '#f0a6bf', lila: '#8a5cb8', gelb: '#f2d24b', orange: '#f08a3c', silber: '#c0c0c0', gold: '#c9a646', denim: '#4a6a95',
};
export function nameToHex(name: string | null): string | null {
  const first = name?.split('/')[0]?.trim().toLowerCase();
  return first ? NAMED[first] ?? null : null;
}

/** Personenfarbe aus dem gespeicherten Namen („Rosa“, „Rot“) */
export function personKey(color: string | null): 'pink' | 'red' {
  return color && /rot|red/i.test(color) ? 'red' : 'pink';
}
