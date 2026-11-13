import { supabase } from './supabase';
import { todayLocal, type Tile } from './wardrobe';

export type OutfitPlan = { id: string; date: string; personId: string | null; createdAt: string };
export type OutfitPiece = { id: string; x: number | null; y: number | null; z: number | null };
export type Outfit = {
  id: string;
  name: string;
  occasions: string[];
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
  /** Teile in gespeicherter Reihenfolge, mit eigener Lage auf dem Board (falls verschoben) */
  pieces: OutfitPiece[];
  plans: OutfitPlan[];
};
export type Wear = { itemId: string; date: string };

/** Anlässe, die es immer gibt (wie im alten Valet) */
export const OCCASIONS = ['Uni', 'Arbeit', 'Training/Sport', 'Abend/Ausgehen'];
export const allOccasions = (outfits: Outfit[]) => [...new Set([...OCCASIONS, ...outfits.flatMap((o) => o.occasions)])];

type PlanRow = { id: string; plan_date: string; person_id: string | null; created_at: string };
type OutfitRow = {
  id: string; name: string | null; occasions: string[] | null; owner_id: string | null; created_at: string; updated_at: string;
  outfit_items: { item_id: string; position: number; x: number | null; y: number | null; z: number | null }[];
  outfit_plans: PlanRow[];
};

export async function loadOutfits(wardrobeId: string): Promise<{ outfits: Outfit[]; wears: Wear[] }> {
  const [os, ws] = await Promise.all([
    supabase.from('outfits')
      .select('id,name,occasions,owner_id,created_at,updated_at, outfit_items(item_id,position,x,y,z), outfit_plans(id,plan_date,person_id,created_at)')
      .eq('wardrobe_id', wardrobeId),
    supabase.from('wears').select('item_id,worn_on'),
  ]);
  if (os.error) throw os.error;
  if (ws.error) throw ws.error;
  const outfits = ((os.data ?? []) as unknown as OutfitRow[]).map((o) => ({
    id: o.id,
    name: o.name ?? '',
    occasions: o.occasions ?? [],
    ownerId: o.owner_id,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    pieces: [...o.outfit_items].sort((a, b) => a.position - b.position).map((p) => ({ id: p.item_id, x: p.x, y: p.y, z: p.z })),
    plans: o.outfit_plans.map((p) => ({ id: p.id, date: p.plan_date, personId: p.person_id, createdAt: p.created_at })),
  }));
  const wears = (ws.data ?? []).map((w) => ({ itemId: w.item_id as string, date: w.worn_on as string }));
  return { outfits, wears };
}

/** Teile, die heute getragen oder fürs heutige Outfit geplant sind */
export function todayIds(outfits: Outfit[], wears: Wear[], today = todayLocal()): string[] {
  const s = new Set(wears.filter((w) => w.date === today).map((w) => w.itemId));
  for (const o of outfits) if (o.plans.some((p) => p.date === today)) for (const p of o.pieces) s.add(p.id);
  return [...s];
}

/** Planungen eines Tages, in der Reihenfolge des Eintragens (morgens → abends) */
export function plansOn(outfits: Outfit[], date: string) {
  const out: { outfit: Outfit; plan: OutfitPlan }[] = [];
  for (const o of outfits) for (const p of o.plans) if (p.date === date) out.push({ outfit: o, plan: p });
  return out.sort((a, b) => a.plan.createdAt.localeCompare(b.plan.createdAt));
}

/** Wert eines Outfits (ohne Wunschteile), wie im alten Valet */
export const outfitValue = (o: Outfit, byId: Map<string, Tile>) =>
  o.pieces.reduce((s, p) => { const i = byId.get(p.id); return s + (i && !i.isWish ? i.pricePaid ?? 0 : 0); }, 0);

/** Nächster geplanter Tag ab heute */
export const nextPlan = (o: Outfit, today = todayLocal()) => o.plans.filter((p) => p.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];

export type OutfitDraft = { id?: string; wardrobeId: string; ownerId: string | null; occasions: string[]; itemIds: string[] };

/** Outfit anlegen oder ändern. Gespeicherte Lagen bleiben für Teile, die drin bleiben. */
export async function saveOutfit(d: OutfitDraft): Promise<string> {
  let id = d.id;
  if (id) {
    const r = await supabase.from('outfits').update({ occasions: d.occasions, occasions_auto: false, owner_id: d.ownerId }).eq('id', id);
    if (r.error) throw r.error;
    const del = await supabase.from('outfit_items').delete().eq('outfit_id', id).not('item_id', 'in', `(${d.itemIds.join(',')})`);
    if (del.error) throw del.error;
  } else {
    const r = await supabase.from('outfits').insert({ wardrobe_id: d.wardrobeId, owner_id: d.ownerId, occasions: d.occasions }).select('id').single();
    if (r.error) throw r.error;
    id = r.data.id as string;
  }
  const up = await supabase.from('outfit_items')
    .upsert(d.itemIds.map((item_id, position) => ({ outfit_id: id, item_id, position })), { onConflict: 'outfit_id,item_id' });
  if (up.error) {
    if (!d.id) await supabase.from('outfits').delete().eq('id', id); // kein halbes Outfit übrig lassen
    throw up.error;
  }
  if (d.id) await syncReservations(id!);
  return id!;
}

export async function deleteOutfit(id: string) {
  const r = await supabase.from('outfits').delete().eq('id', id); // Teile, Planungen und Reservierungen hängen per „cascade“ dran
  if (r.error) throw r.error;
}

export async function setOccasions(id: string, occasions: string[]) {
  const r = await supabase.from('outfits').update({ occasions, occasions_auto: false }).eq('id', id);
  if (r.error) throw r.error;
}

/** Outfit für einen Tag planen. Ab heute werden die Teile für den Tag reserviert. */
export async function planOutfit(outfitId: string, date: string, personId: string | null) {
  // pro Tag und Person nur eine Planung desselben Outfits (wie im alten Valet)
  const old = supabase.from('outfit_plans').delete().eq('outfit_id', outfitId).eq('plan_date', date);
  const rOld = await (personId ? old.eq('person_id', personId) : old.is('person_id', null));
  if (rOld.error) throw rOld.error;
  const r = await supabase.from('outfit_plans').insert({ outfit_id: outfitId, plan_date: date, person_id: personId }).select('id').single();
  if (r.error) throw r.error;
  if (date >= todayLocal()) await reserve(outfitId, [{ id: r.data.id as string, date, personId }]);
}

export async function unplanOutfit(planId: string) {
  const r = await supabase.from('outfit_plans').delete().eq('id', planId);
  if (r.error) throw r.error;
}

async function reserve(outfitId: string, plans: { id: string; date: string; personId: string | null }[]) {
  if (!plans.length) return;
  const items = await supabase.from('outfit_items').select('item_id, items(is_wish)').eq('outfit_id', outfitId);
  if (items.error) throw items.error;
  const ids = ((items.data ?? []) as unknown as { item_id: string; items: { is_wish: boolean } | null }[])
    .filter((x) => !x.items?.is_wish).map((x) => x.item_id);
  if (!ids.length) return;
  const rows = plans.flatMap((p) => ids.map((item_id) => ({ item_id, plan_id: p.id, person_id: p.personId, date_from: p.date, date_to: p.date })));
  const r = await supabase.from('reservations').insert(rows);
  if (r.error) throw r.error;
}

/** Reservierungen künftiger Planungen an geänderte Teile anpassen */
async function syncReservations(outfitId: string) {
  const ps = await supabase.from('outfit_plans').select('id,plan_date,person_id').eq('outfit_id', outfitId).gte('plan_date', todayLocal());
  if (ps.error) throw ps.error;
  const plans = (ps.data ?? []).map((p) => ({ id: p.id as string, date: p.plan_date as string, personId: p.person_id as string | null }));
  if (!plans.length) return;
  const del = await supabase.from('reservations').delete().in('plan_id', plans.map((p) => p.id));
  if (del.error) throw del.error;
  await reserve(outfitId, plans);
}

/** Wer hat ein Teil an einem Tag schon reserviert (andere Person)? */
export async function clashes(outfitId: string, date: string, personId: string | null) {
  const items = await supabase.from('outfit_items').select('item_id').eq('outfit_id', outfitId);
  if (items.error) throw items.error;
  const ids = (items.data ?? []).map((x) => x.item_id as string);
  if (!ids.length) return [];
  const r = await supabase.from('reservations').select('item_id,person_id,plan_id, outfit_plans(outfit_id)')
    .in('item_id', ids).lte('date_from', date).gte('date_to', date);
  if (r.error) throw r.error;
  type Row = { item_id: string; person_id: string | null; outfit_plans: { outfit_id: string } | null };
  return ((r.data ?? []) as unknown as Row[]).filter((x) => x.person_id !== personId && x.outfit_plans?.outfit_id !== outfitId);
}

// ---------- Datum ----------
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const WD_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
export const dateOf = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y!, m! - 1, d!); };
export const addDays = (iso: string, n: number) => { const d = dateOf(iso); d.setDate(d.getDate() + n); return todayLocal(d); };
export const weekday = (iso: string) => WD[dateOf(iso).getDay()]!;
/** „Heute“, „Morgen“ oder „Mo 17.11.“ */
export function fmtShort(iso: string, today = todayLocal()) {
  if (iso === today) return 'Heute';
  if (iso === addDays(today, 1)) return 'Morgen';
  if (iso === addDays(today, -1)) return 'Gestern';
  const [, m, d] = iso.split('-');
  return `${weekday(iso)} ${d}.${m}.`;
}
export function fmtLong(iso: string) {
  const d = dateOf(iso);
  return `${WD_LONG[d.getDay()]}, ${d.getDate()}.${d.getMonth() + 1}.`;
}
/** Montag der Woche, in der der Tag liegt */
export const mondayOf = (iso: string) => addDays(iso, -((dateOf(iso).getDay() + 6) % 7));
