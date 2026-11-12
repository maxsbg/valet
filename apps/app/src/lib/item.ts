import { supabase } from './supabase';
import { todayLocal } from './wardrobe';

export type ItemRow = {
  id: string; wardrobe_id: string; owner_id: string | null; name: string; brand: string | null; category: string;
  color: string | null; alt_color: string | null; size: string | null; material: string | null; style: string | null;
  seasons: string[] | null; qty: number | null; price_paid: number | null; list_price: number | null; purchase_date: string | null;
  shop: string | null; link: string | null; notes: string | null; status: 'wash' | 'repair' | 'lent' | 'out' | 'sold' | null;
  status_at: string | null; lent_to: string | null; sold_price: number | null; reversible: boolean | null; set_id: string | null;
  set_name: string | null; is_wish: boolean | null;
};
export type ItemOutfit = { id: string; name: string | null; occasions: string[] | null; planDates: string[] };
export type ItemDetail = { item: ItemRow; wears: string[]; outfits: ItemOutfit[] };

export async function loadItem(id: string): Promise<ItemDetail> {
  const [it, wears, ois] = await Promise.all([
    supabase.from('items').select('*').eq('id', id).single(),
    supabase.from('wears').select('worn_on').eq('item_id', id),
    supabase.from('outfit_items').select('outfit_id, outfits(id,name,occasions, outfit_plans(plan_date))').eq('item_id', id),
  ]);
  if (it.error) throw it.error;
  if (wears.error) throw wears.error;
  if (ois.error) throw ois.error;
  type O = { id: string; name: string | null; occasions: string[] | null; outfit_plans: { plan_date: string }[] };
  const outfits = ((ois.data ?? []) as unknown as { outfits: O | null }[])
    .map((r) => r.outfits)
    .filter((o): o is O => !!o)
    .map((o) => ({ id: o.id, name: o.name, occasions: o.occasions, planDates: o.outfit_plans.map((p) => p.plan_date) }));
  return { item: it.data as ItemRow, wears: (wears.data ?? []).map((w) => w.worn_on as string), outfits };
}

/** Tage, an denen das Teil getragen wurde: einzeln eingetragen + geplante Outfits bis heute (wie im alten Valet) */
export function wornDays(d: ItemDetail, today = todayLocal()): string[] {
  const s = new Set(d.wears.filter((x) => x <= today));
  for (const o of d.outfits) for (const p of o.planDates) if (p <= today) s.add(p);
  return [...s].sort();
}

export async function setWornToday(itemId: string, personId: string | null, worn: boolean) {
  const today = todayLocal();
  const r = worn
    ? await supabase.from('wears').upsert({ item_id: itemId, worn_on: today, person_id: personId })
    : await supabase.from('wears').delete().eq('item_id', itemId).eq('worn_on', today);
  if (r.error) throw r.error;
}

export async function setStatus(itemId: string, status: ItemRow['status'], lentTo?: string | null) {
  const r = await supabase.from('items')
    .update({ status, status_at: status ? todayLocal() : null, lent_to: status === 'lent' ? lentTo ?? null : null })
    .eq('id', itemId);
  if (r.error) throw r.error;
}
