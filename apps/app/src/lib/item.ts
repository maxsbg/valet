import { supabase } from './supabase';
import { todayLocal } from './wardrobe';
import type { Picture } from './cutout';

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

export type ItemChange = Partial<Pick<ItemRow, 'name' | 'brand' | 'category' | 'owner_id' | 'color' | 'size' | 'material' | 'style' | 'seasons' | 'qty' | 'price_paid' | 'list_price' | 'purchase_date' | 'shop' | 'link' | 'notes' | 'reversible'>>;

export async function updateItem(id: string, change: ItemChange) {
  const r = await supabase.from('items').update(change).eq('id', id);
  if (r.error) throw r.error;
}

export async function deleteItem(id: string) {
  const imgs = await supabase.from('item_images').select('storage_path').eq('item_id', id);
  const r = await supabase.from('items').delete().eq('id', id);
  if (r.error) throw r.error;
  const paths = (imgs.data ?? []).map((x) => x.storage_path as string);
  if (paths.length) await supabase.storage.from('items').remove(paths); // Bilder aufräumen, Fehler egal
}

export type NewItem = ItemChange & { name: string; category: string };

/**
 * Legt ein Teil an und lädt (falls vorhanden) Bild + Vorschaubild in den Bucket „items“.
 * Schlägt das Hochladen fehl, wird das Teil wieder entfernt, damit kein halbes Teil übrig bleibt.
 */
export async function createItem(wardrobeId: string, data: NewItem, picture?: Picture | null): Promise<string> {
  const ins = await supabase.from('items').insert({ ...data, wardrobe_id: wardrobeId }).select('id').single();
  if (ins.error) throw ins.error;
  const id = ins.data.id as string;
  if (picture) {
    try { await saveImage(wardrobeId, id, 'a', picture); }
    catch (e) { await supabase.from('items').delete().eq('id', id); throw e; }
  }
  return id;
}

const ext = (b: Blob) => (b.type === 'image/png' ? 'png' : b.type === 'image/jpeg' ? 'jpg' : 'webp');

/** Speichert Bild + Vorschaubild einer Seite. Neuer Dateiname bei jedem Speichern, damit der Browser-Zwischenspeicher nie ein altes Bild zeigt. */
export async function saveImage(wardrobeId: string, itemId: string, side: 'a' | 'b', p: Picture) {
  const stamp = Date.now().toString(36);
  const base = `${wardrobeId}/${itemId}/${side}-${stamp}`;
  const mainPath = `${base}.${ext(p.main)}`;
  const thumbPath = `${base}-thumb.${ext(p.thumb)}`;
  const bucket = supabase.storage.from('items');
  const opts = (b: Blob) => ({ contentType: b.type, cacheControl: '31536000', upsert: false });
  const [m, t] = await Promise.all([bucket.upload(mainPath, p.main, opts(p.main)), bucket.upload(thumbPath, p.thumb, opts(p.thumb))]);
  const upErr = m.error ?? t.error;
  if (upErr) {
    await bucket.remove([mainPath, thumbPath]);
    throw new Error(/bucket not found/i.test(upErr.message) ? 'Bildspeicher fehlt noch (Bucket „items“ in Supabase anlegen).' : `Bild hochladen fehlgeschlagen: ${upErr.message}`);
  }
  // Ein Bild je Seite: vorheriges Hauptbild/Vorschaubild ersetzen
  const old = await supabase.from('item_images').select('storage_path').eq('item_id', itemId).eq('side', side).in('kind', ['cutout', 'original', 'thumb']);
  await supabase.from('item_images').delete().eq('item_id', itemId).eq('side', side).in('kind', ['cutout', 'original', 'thumb']);
  const r = await supabase.from('item_images').insert([
    { item_id: itemId, side, kind: p.kind, storage_path: mainPath, colors: p.colors },
    { item_id: itemId, side, kind: 'thumb', storage_path: thumbPath, colors: null },
  ]);
  if (r.error) { await bucket.remove([mainPath, thumbPath]); throw r.error; }
  const stale = (old.data ?? []).map((x) => x.storage_path as string);
  if (stale.length) await bucket.remove(stale); // aufräumen, Fehler egal
}

