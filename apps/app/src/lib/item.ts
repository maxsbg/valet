import { supabase } from './supabase';
import { imageUrl, todayLocal } from './wardrobe';
import { storedPicture, type Picture, webpBlob } from './cutout';
import { migrateSeasons, normalizeCategory, normalizeOccasions, type ItemStatus, type StatusInfo } from '@valet/core';

export type ItemRow = {
  id: string; wardrobe_id: string; owner_id: string | null; owner_ids: string[] | null; highlight_color: string | null; name: string; brand: string | null; category: string;
  /** Unterkategorie und Typ (neue Liste); category kann bis zur Umstellung noch eine alte ID sein → loadItem rechnet um */
  subcategory: string | null; item_type: string | null;
  color: string | null; alt_color: string | null; size: string | null; material: string | null; style: string | null;
  seasons: string[] | null; qty: number | null; price_paid: number | null; list_price: number | null; purchase_date: string | null;
  shop: string | null; link: string | null; notes: string | null; status: ItemStatus | null;
  status_at: string | null; lent_to: string | null; sold_price: number | null;
  was_wish: boolean | null; created_at: string;
  /** Status-Zusatzangaben (Spec 6) */
  status_where: string | null; status_until: string | null; lent_person_id: string | null; sold_date: string | null; reversible: boolean | null; set_id: string | null;
  set_name: string | null; is_wish: boolean | null; wishlist_id: string | null; wish_tag: string | null;
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
    .map((o) => ({ id: o.id, name: o.name, occasions: normalizeOccasions(o.occasions), planDates: o.outfit_plans.map((p) => p.plan_date) }));
  const row = it.data as ItemRow;
  const path = normalizeCategory(row);
  const item: ItemRow = { ...row, category: path.category ?? '', subcategory: path.subcategory, item_type: path.type, seasons: migrateSeasons(row.seasons) };
  return { item, wears: (wears.data ?? []).map((w) => w.worn_on as string), outfits };
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

/** Status mit Zusatzangaben speichern (statusChange aus @valet/core liefert die bereinigten Werte) */
export async function saveStatus(itemId: string, info: StatusInfo) {
  const r = await supabase.from('items').update({ ...info, status_where: info.status_where ?? '', lent_to: info.lent_to ?? '' }).eq('id', itemId);
  if (r.error) throw r.error;
}

export type ItemChange = Partial<Pick<ItemRow, 'name' | 'brand' | 'category' | 'subcategory' | 'item_type' | 'owner_id' | 'owner_ids' | 'color' | 'size' | 'material' | 'style' | 'seasons' | 'qty' | 'price_paid' | 'list_price' | 'purchase_date' | 'shop' | 'link' | 'notes' | 'reversible' | 'is_wish' | 'wishlist_id' | 'wish_tag'>> & { styles?: string[] };

export async function updateItem(id: string, change: ItemChange | Record<string, unknown>) {
  const r = await supabase.from('items').update(change).eq('id', id);
  if (r.error) throw r.error;
}

export async function deleteItem(id: string) {
  const imgs = await supabase.from('item_images').select('storage_path').eq('item_id', id);
  const before = await supabase.from('items').select('set_id').eq('id', id).maybeSingle();
  const r = await supabase.from('items').delete().eq('id', id);
  if (r.error) throw r.error;
  const paths = (imgs.data ?? []).map((x) => x.storage_path as string);
  if (paths.length) await supabase.storage.from('items').remove(paths); // Bilder aufräumen, Fehler egal
  await cleanUpAfterDelete(id, (before.data?.set_id as string | null) ?? null); // Fehler egal, Teil ist schon weg
}

/** Nach dem Löschen: Set mit nur noch einem Teil auflösen, Teil aus eigenen Reihenfolgen austragen */
async function cleanUpAfterDelete(id: string, setId: string | null) {
  try {
    if (setId) {
      const rest = await supabase.from('items').select('id').eq('set_id', setId);
      if (rest.data && rest.data.length === 1) await supabase.from('items').update({ set_id: null, set_name: null }).eq('set_id', setId);
    }
    for (const table of ['wishlists', 'persons'] as const) {
      const rows = await supabase.from(table).select('id,item_order').contains('item_order', [id]);
      for (const row of rows.data ?? []) {
        await supabase.from(table).update({ item_order: (row.item_order as string[]).filter((x) => x !== id) }).eq('id', row.id);
      }
    }
  } catch { /* nur Aufräumen */ }
}

/** Aktuelle Bilder je Seite (Vorschaubild, sonst Hauptbild) – für die Bearbeiten-Seite */
export async function loadPictures(itemId: string): Promise<Record<'a' | 'b', string | null>> {
  const r = await supabase.from('item_images').select('side,kind,storage_path').eq('item_id', itemId).in('kind', ['thumb', 'cutout', 'original']);
  if (r.error) throw r.error;
  const out: Record<'a' | 'b', string | null> = { a: null, b: null };
  const rank = (k: string) => (k === 'thumb' ? 0 : k === 'cutout' ? 1 : 2);
  for (const x of [...(r.data ?? [])].sort((p, q) => rank(q.kind) - rank(p.kind))) {
    const side = (x.side ?? 'a').trim().toLowerCase() === 'b' ? 'b' : 'a';
    out[side] = imageUrl(x.storage_path as string);
  }
  return out;
}

/** Gespeichertes Bild einer Seite (Hauptbild + Vorschaubild) laden – zum Spiegeln in Bearbeiten; null = kein Bild */
export async function loadStoredPicture(itemId: string, side: 'a' | 'b'): Promise<Picture | null> {
  const r = await supabase.from('item_images').select('side,kind,storage_path,colors').eq('item_id', itemId).in('kind', ['thumb', 'cutout', 'original']);
  if (r.error) throw r.error;
  const rows = (r.data ?? []).filter((x) => ((x.side ?? 'a').trim().toLowerCase() === 'b' ? 'b' : 'a') === side);
  const main = rows.find((x) => x.kind === 'cutout') ?? rows.find((x) => x.kind === 'original');
  const thumb = rows.find((x) => x.kind === 'thumb');
  if (!main || !thumb) return null;
  return storedPicture(imageUrl(main.storage_path as string), imageUrl(thumb.storage_path as string), main.kind as Picture['kind'], (main.colors ?? []) as Picture['colors']);
}

/**
 * Bild für die KI-Nachanalyse (Spec 8): freigestelltes Hauptbild Seite A, sonst Original; dazu die Foto-Farben
 * (für „Farbe prüfen“). null = kein Bild.
 */
export async function analysisImage(itemId: string): Promise<{ path: string; colors: { h: string; s: number }[] } | null> {
  const r = await supabase.from('item_images').select('side,kind,storage_path,colors').eq('item_id', itemId).in('kind', ['cutout', 'original']);
  if (r.error) throw r.error;
  const rows = (r.data ?? []).filter((x) => (x.side ?? 'a').trim().toLowerCase() !== 'b');
  const main = rows.find((x) => x.kind === 'cutout') ?? rows.find((x) => x.kind === 'original');
  return main ? { path: main.storage_path as string, colors: Array.isArray(main.colors) ? main.colors as { h: string; s: number }[] : [] } : null;
}

export type NewItem = ItemChange & { name: string; category: string };

/**
 * Legt ein Teil an und lädt (falls vorhanden) Bild + Vorschaubild in den Bucket „items“.
 * Schlägt das Hochladen fehl, wird das Teil wieder entfernt, damit kein halbes Teil übrig bleibt.
 */
export async function createItem(wardrobeId: string, data: NewItem | Record<string, unknown>, picture?: Picture | null, pictureB?: Picture | null): Promise<string> {
  const ins = await supabase.from('items').insert({ ...data, wardrobe_id: wardrobeId }).select('id').single();
  if (ins.error) throw ins.error;
  const id = ins.data.id as string;
  if (picture) {
    try {
      await saveImage(wardrobeId, id, 'a', picture);
      if (pictureB) await saveImage(wardrobeId, id, 'b', pictureB);
    }
    catch (e) { await supabase.from('items').delete().eq('id', id); throw e; }
  }
  return id;
}

/** Speichert Bild + Vorschaubild einer Seite. Neuer Dateiname bei jedem Speichern, damit der Browser-Zwischenspeicher nie ein altes Bild zeigt. */
export async function saveImage(wardrobeId: string, itemId: string, side: 'a' | 'b', p: Picture, legacyId: string | null = null) {
  // Auch ältere/gespiegelte Picture-Blobs vor dem Upload normalisieren – Storage bekommt ausschließlich WebP.
  const main = p.main.type === 'image/webp' ? p.main : await webpBlob(p.main, 1200, p.kind === 'original' ? 0.88 : 0.9);
  const thumb = p.thumb.type === 'image/webp' ? p.thumb : await webpBlob(p.thumb, 400, 0.85);
  if (main.type !== 'image/webp' || thumb.type !== 'image/webp') throw new Error('Bilder müssen vor dem Upload in WebP umgewandelt werden.');
  const stamp = Date.now().toString(36);
  const base = `${wardrobeId}/${itemId}/${side}-${stamp}`;
  const mainPath = `${base}.webp`;
  const thumbPath = `${base}-thumb.webp`;
  const bucket = supabase.storage.from('items');
  const opts = { contentType: 'image/webp', cacheControl: '31536000', upsert: false };
  const [m, t] = await Promise.all([bucket.upload(mainPath, main, opts), bucket.upload(thumbPath, thumb, opts)]);
  const upErr = m.error ?? t.error;
  if (upErr) {
    await bucket.remove([mainPath, thumbPath]);
    throw new Error(/bucket not found/i.test(upErr.message) ? 'Bildspeicher fehlt noch (Bucket „items“ in Supabase anlegen).' : `Bild hochladen fehlgeschlagen: ${upErr.message}`);
  }
  // Ein Bild je Seite: vorheriges Hauptbild/Vorschaubild ersetzen
  const old = await supabase.from('item_images').select('storage_path').eq('item_id', itemId).eq('side', side).in('kind', ['cutout', 'original', 'thumb']);
  await supabase.from('item_images').delete().eq('item_id', itemId).eq('side', side).in('kind', ['cutout', 'original', 'thumb']);
  const r = await supabase.from('item_images').insert([
    { item_id: itemId, side, kind: p.kind, storage_path: mainPath, colors: p.colors, legacy_id: legacyId },
    { item_id: itemId, side, kind: 'thumb', storage_path: thumbPath, colors: null, legacy_id: legacyId },
  ]);
  if (r.error) { await bucket.remove([mainPath, thumbPath]); throw r.error; }
  const stale = (old.data ?? []).map((x) => x.storage_path as string);
  if (stale.length) await bucket.remove(stale); // aufräumen, Fehler egal
}


export type ImageMigrationProgress = { total: number; done: number; migrated: number; skipped: number; cleanupPending: number; currentPath: string | null };
export type ImageMigrationResult = ImageMigrationProgress & { failed: { path: string; error: string }[] };

/**
 * Migriert erreichbare item_images-Einträge auf WebP. Erst nach Upload + Formatprüfung
 * wird der DB-Pfad geändert; erst nach erfolgreichem DB-Update wird die alte Datei gelöscht.
 * RLS/Storage-Policies begrenzen die Migration auf Bilder, die der angemeldete Nutzer bearbeiten darf.
 */
export async function migrateItemImagesToWebp(onProgress?: (p: ImageMigrationProgress) => void): Promise<ImageMigrationResult> {
  const query = await supabase.from('item_images').select('id,storage_path').order('created_at', { ascending: true });
  if (query.error) throw query.error;
  const rows = (query.data ?? []) as { id: string; storage_path: string }[];
  const bucket = supabase.storage.from('items');
  const result: ImageMigrationResult = { total: rows.length, done: 0, migrated: 0, skipped: 0, cleanupPending: 0, currentPath: null, failed: [] };
  const converted = new Map<string, string>();

  for (const row of rows) {
    const oldPath = row.storage_path;
    result.currentPath = oldPath;
    try {
      if (/\.webp$/i.test(oldPath)) {
        result.skipped++;
      } else if (converted.has(oldPath)) {
        const nextPath = converted.get(oldPath)!;
        const update = await supabase.from('item_images').update({ storage_path: nextPath }).eq('id', row.id).eq('storage_path', oldPath).select('id').maybeSingle();
        if (update.error || !update.data) throw update.error ?? new Error('Datenbankeintrag wurde zwischenzeitlich geändert.');
        result.migrated++;
      } else {
        const nextPath = oldPath.replace(/\.(png|jpe?g)$/i, '.webp');
        if (nextPath === oldPath) throw new Error('Unbekannte Dateiendung – wird nicht automatisch konvertiert.');
        const source = await bucket.download(oldPath);
        if (source.error || !source.data) throw source.error ?? new Error('Quelldatei fehlt.');
        const webp = await webpBlob(source.data, Infinity, 0.9);
        if (webp.type !== 'image/webp') throw new Error('Encoder lieferte kein WebP.');
        const upload = await bucket.upload(nextPath, webp, { contentType: 'image/webp', cacheControl: '31536000', upsert: true });
        if (upload.error) throw upload.error;
        const verify = await bucket.download(nextPath);
        if (verify.error || !verify.data) throw verify.error ?? new Error('Hochgeladene WebP-Datei ist nicht lesbar.');
        const header = new Uint8Array(await verify.data.slice(0, 12).arrayBuffer());
        const signature = String.fromCharCode(...header);
        if (signature.slice(0, 4) !== 'RIFF' || signature.slice(8, 12) !== 'WEBP') throw new Error('Datei-Prüfung fehlgeschlagen: kein gültiger WebP-Header.');
        const update = await supabase.from('item_images').update({ storage_path: nextPath }).eq('id', row.id).eq('storage_path', oldPath).select('id').maybeSingle();
        if (update.error || !update.data) throw update.error ?? new Error('Datenbankeintrag wurde zwischenzeitlich geändert.');
        converted.set(oldPath, nextPath);
        const cleanup = await bucket.remove([oldPath]);
        if (cleanup.error) result.cleanupPending++;
        result.migrated++;
      }
    } catch (error) {
      result.failed.push({ path: oldPath, error: error instanceof Error ? error.message : String(error) });
    }
    result.done++;
    onProgress?.({ total: result.total, done: result.done, migrated: result.migrated, skipped: result.skipped, cleanupPending: result.cleanupPending, currentPath: result.currentPath });
  }
  result.currentPath = null;
  onProgress?.({ total: result.total, done: result.done, migrated: result.migrated, skipped: result.skipped, cleanupPending: result.cleanupPending, currentPath: null });
  return result;
}


/**
 * Wunschteil gekauft → Schrankteil: Preis, Kaufdatum und Besitzer setzen, Liste und Kategorie der Wunschliste entfernen.
 * Der bisherige Wunsch-Preis bleibt als Listenpreis erhalten. Aus der eigenen Reihenfolge der Liste wird das Teil ausgetragen.
 */
export async function markBought(item: Pick<ItemRow, 'id' | 'wishlist_id'>, data: { price: number | null; date: string | null; owners: string[] }) {
  // wish_price ist der beim Hinzufügen festgehaltene Originalpreis. list_price kann
  // sich durch spätere Preisprüfungen ändern; deshalb diesen Snapshot übernehmen.
  const wish = await supabase.from('items').select('wish_price,list_price').eq('id', item.id).single();
  if (wish.error) throw wish.error;
  const originalListPrice = (wish.data.wish_price as number | null) ?? (wish.data.list_price as number | null);
  const r = await supabase.from('items').update({
    is_wish: false, was_wish: true, wishlist_id: null, wish_tag: null, buy_on: null,
    price_paid: data.price, list_price: originalListPrice, purchase_date: data.date,
    owner_ids: data.owners, owner_id: data.owners.length === 1 ? data.owners[0]! : null,
  }).eq('id', item.id);
  if (r.error) throw r.error;
  if (item.wishlist_id) {
    const w = await supabase.from('wishlists').select('item_order').eq('id', item.wishlist_id).single();
    const order = (w.data?.item_order ?? []) as string[];
    if (order.includes(item.id)) await supabase.from('wishlists').update({ item_order: order.filter((x) => x !== item.id) }).eq('id', item.wishlist_id); // Fehler egal
  }
}

/**
 * Set eines Teils festlegen: `members` = alle Teile des Sets (inklusive des Teils selbst).
 * Bleibt nur ein Teil übrig, wird das Set aufgelöst. Entfernte Teile verlieren ihre Set-Zugehörigkeit.
 */
export async function saveSet(setId: string | null, members: string[], name: string | null): Promise<string | null> {
  const id = members.length > 1 ? setId ?? `set_${Math.random().toString(36).slice(2, 10)}` : null;
  if (setId) {
    const off = supabase.from('items').update({ set_id: null, set_name: null }).eq('set_id', setId);
    const r = await (members.length ? off.not('id', 'in', `(${members.join(',')})`) : off);
    if (r.error) throw r.error;
  }
  const r = await supabase.from('items').update({ set_id: id, set_name: id ? name || null : null }).in('id', members);
  if (r.error) throw r.error;
  return id;
}
