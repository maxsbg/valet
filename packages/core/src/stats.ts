// Statistik – Rechnungen wie im alten Valet (Ausgaben, Getragen, Bestand)
import { qtyOf, totalPaid } from './money';
import { daysSince, todayISO, wearDates } from './wear';
import { SIDE_CATEGORIES } from './catalog';
import type { Outfit, WearLog } from './model';

export interface StatItem {
  id: string;
  ownerId: string | null;
  category: string;
  brand: string | null;
  qty: number;
  pricePaid: number | null;
  listPrice: number | null;
  /** Zahler: ohne Betrag = gleichmäßig aufgeteilt */
  payers: { personId: string | null; amount: number | null }[] | null;
  purchaseDate: string | null;
  status: string | null;
  soldPrice: number | null;
  isWish: boolean;
  createdAt: string;
  /** Saisons (leer = ganzjährig) – für „lange nicht getragen“ */
  seasons?: string[];
}

/** Wer hat wie viel bezahlt (Gesamtbetrag × Anteil). Ohne Zahler zahlt der Besitzer alles. */
export function sharesOf(i: StatItem): Record<string, number> {
  const t = totalPaid(i), out: Record<string, number> = {};
  if (!t) return out;
  const ps = (i.payers ?? []).filter((x): x is { personId: string; amount: number | null } => !!x?.personId);
  if (!ps.length) { if (i.ownerId) out[i.ownerId] = t; return out; }
  if (ps.some((x) => typeof x.amount === 'number')) for (const x of ps) out[x.personId] = (out[x.personId] ?? 0) + (x.amount ?? 0);
  else for (const x of ps) out[x.personId] = (out[x.personId] ?? 0) + t / ps.length;
  return out;
}
export const shareFor = (i: StatItem, personId: string) => sharesOf(i)[personId] ?? 0;
const totalList = (i: StatItem) => (i.listPrice ?? 0) * qtyOf(i);

/** Gleich geschriebene Marken zusammenfassen („Nike“, „NIKE“, „nike “) */
export const brandKey = (b: string) => b.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

export type Row<K> = { key: K; value: number; count?: number };

/** Ausgaben – im Profil einer Person nur ihr Anteil */
export function spendStats(all: StatItem[], personId: string | null, personIds: string[] = []) {
  const items = all.filter((i) => !i.isWish);
  const amt = (i: StatItem) => (personId ? shareFor(i, personId) : totalPaid(i));
  const listAmt = (i: StatItem) => { const t = totalPaid(i); return personId ? (t ? (totalList(i) * amt(i)) / t : 0) : totalList(i); };
  const owned = personId ? items.filter((i) => i.ownerId === personId) : items;
  const paid = (personId ? items.filter((i) => i.ownerId === personId || amt(i) > 0) : items).filter((i) => i.pricePaid != null);
  const allTotal = items.filter((i) => i.pricePaid != null).reduce((s, i) => s + totalPaid(i), 0);
  const total = paid.reduce((s, i) => s + amt(i), 0);
  const paidPieces = paid.reduce((s, i) => s + qtyOf(i), 0);
  const both = paid.filter((i) => i.listPrice != null);
  const listSum = both.reduce((s, i) => s + listAmt(i), 0);
  const saved = listSum - both.reduce((s, i) => s + amt(i), 0);
  const sold = (personId ? items.filter((i) => i.ownerId === personId || amt(i) > 0) : items).filter((i) => i.status === 'sold' && i.soldPrice != null);
  const revenue = sold.reduce((a, i) => {
    const t = totalPaid(i);
    return a + (personId ? (t ? (i.soldPrice! * amt(i)) / t : i.ownerId === personId ? i.soldPrice! : 0) : i.soldPrice!);
  }, 0);

  const sum = <K>(key: (i: StatItem) => K | null) => {
    const m = new Map<K, Row<K>>();
    for (const i of paid) { const k = key(i); if (k == null) continue; const r = m.get(k) ?? { key: k, value: 0, count: 0 }; r.value += amt(i); r.count! += qtyOf(i); m.set(k, r); }
    return [...m.values()].filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  };
  const brandName = new Map<string, string>();
  for (const i of paid) { const b = (i.brand ?? '').trim(); if (b && !brandName.has(brandKey(b))) brandName.set(brandKey(b), b); }
  const brands = sum((i) => { const b = (i.brand ?? '').trim(); return b ? brandKey(b) : null; }).map((r) => ({ ...r, key: brandName.get(r.key) ?? r.key }));
  const noBrand = paid.filter((i) => !(i.brand ?? '').trim()).reduce((a, i) => a + amt(i), 0);
  const years = sum((i) => (i.purchaseDate ?? '').slice(0, 4) || 'ohne Datum')
    .sort((a, b) => (a.key === 'ohne Datum' ? 1 : b.key === 'ohne Datum' ? -1 : b.key.localeCompare(a.key)));
  const byPerson = personId ? [] : personIds.map((p) => ({ key: p, value: paid.reduce((s, i) => s + shareFor(i, p), 0) }));
  const unassigned = personId ? 0 : paid.reduce((s, i) => {
    const known = Object.entries(sharesOf(i)).filter(([k]) => personIds.includes(k)).reduce((a, [, v]) => a + v, 0);
    return s + Math.max(0, totalPaid(i) - known);
  }, 0);

  return {
    total, allTotal, revenue, saved, listSum, paidPieces,
    avg: paidPieces ? total / paidPieces : 0,
    missing: owned.filter((i) => i.pricePaid == null).length,
    brands, noBrand, years, byPerson, unassigned,
    categories: sum((i) => i.category),
    top: [...paid].sort((a, b) => amt(b) - amt(a)).slice(0, 5).map((i) => ({ item: i, value: amt(i) })),
  };
}

/** Zeitraum der Getragen-Auswertung */
export type WearPeriod = '30' | 'year' | 'all';

/** Aktuelle Saison (wie die Saison-Angabe an den Teilen): Nov–Feb Winter, Jun–Aug Sommer, sonst Übergang */
export function seasonOf(iso: string): 'Winter' | 'Sommer' | 'Übergang' {
  const m = Number(iso.slice(5, 7));
  return m >= 11 || m <= 2 ? 'Winter' : m >= 6 && m <= 8 ? 'Sommer' : 'Übergang';
}

const shiftISO = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return todayISO(new Date(y!, m! - 1, d! + n));
};

/** Ab wann „lange nicht getragen“ gilt (Tage) */
export const IDLE_DAYS = 30;

/**
 * Getragen: Lieblingsteile, Schrank-Nutzung, Lieblings-Outfits und -Kombinationen, Verlauf (im gewählten Zeitraum),
 * Kosten pro Tragen (immer über die ganze Zeit) und „lange nicht getragen“ (nur Teile der aktuellen Saison).
 * Geplante Outfits zählen ab ihrem Tag automatisch als getragen.
 */
export function wearStats(all: StatItem[], personId: string | null, wears: WearLog, outfits: Outfit[], today = todayISO(), period: WearPeriod = 'all') {
  const pool = all.filter((i) => !i.isWish && i.status !== 'sold' && i.status !== 'out' && (!personId || i.ownerId === personId));
  const from = period === '30' ? shiftISO(today, -29) : period === 'year' ? shiftISO(today, -364) : null;
  const inPeriod = (d: string) => !from || d >= from;
  const amt = (i: StatItem) => (personId ? shareFor(i, personId) : totalPaid(i));
  const rows = pool.map((i) => {
    const w = wearDates(i.id, wears, outfits, today);
    return { item: i, w, pw: w.filter(inPeriod) };
  });
  const lifetime = rows.filter((r) => r.w.length);
  const tracked = rows.filter((r) => r.pw.length);
  const total = tracked.reduce((a, r) => a + r.pw.length, 0);
  // Beginn der Aufzeichnung (erster Tag überhaupt) – Zeiträume davor sind leer
  const start = lifetime.map((r) => r.w[0]!).sort()[0] ?? null;

  // Kosten pro Tragen: immer über die ganze Zeit (sonst springt der Wert mit dem Zeitraum)
  const withCpw = lifetime.filter((r) => totalPaid(r.item) > 0).map((r) => ({ ...r, cpw: amt(r.item) / r.w.length })).filter((r) => r.cpw > 0);
  const avgCpw = withCpw.length ? withCpw.reduce((a, r) => a + r.cpw, 0) / withCpw.length : null;
  const best = [...withCpw].sort((a, b) => a.cpw - b.cpw).slice(0, 4);
  const worst = withCpw.length > 4 ? [...withCpw].sort((a, b) => b.cpw - a.cpw).filter((r) => !best.includes(r)).slice(0, 4) : [];

  // Schrank-Nutzung: Anteil der verfügbaren Teile (ohne eingelagerte), die im Zeitraum getragen wurden
  const usable = rows.filter((r) => r.item.status !== 'stored');
  const catMap = new Map<string, { worn: number; total: number }>();
  for (const r of usable) {
    const c = catMap.get(r.item.category) ?? { worn: 0, total: 0 };
    c.total += 1; if (r.pw.length) c.worn += 1;
    catMap.set(r.item.category, c);
  }
  const usage = {
    worn: usable.filter((r) => r.pw.length).length,
    total: usable.length,
    categories: [...catMap].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.total - a.total),
  };

  // Lange nicht getragen: nur Teile der aktuellen Saison (ohne Saison-Angabe = ganzjährig), nicht eingelagert
  const season = seasonOf(today);
  const idle = usable
    .filter((r) => !r.item.seasons?.length || r.item.seasons.includes(season))
    .map((r) => ({ ...r, days: r.w.length ? daysSince(r.w[r.w.length - 1]!, today) : Math.min(start ? daysSince(start, today) : 0, daysSince(r.item.createdAt.slice(0, 10), today)) }))
    .filter((r) => r.days >= IDLE_DAYS).sort((a, b) => b.days - a.days).slice(0, 8);

  // Tage im Zeitraum: welche Teile wurden getragen (für Verlauf und Kombinationen)
  const byDay = new Map<string, Set<string>>();
  for (const r of tracked) for (const d of r.pw) (byDay.get(d) ?? byDay.set(d, new Set()).get(d)!).add(r.item.id);
  const days: Record<string, number> = {};
  for (const [d, set] of byDay) days[d] = set.size;

  // Lieblings-Outfits: geplante (= getragene) Tage im Zeitraum
  const outfitRows = outfits
    .map((o) => ({ outfit: o, n: o.plans.filter((p) => p.date && p.date <= today && inPeriod(p.date) && (!personId || p.personId === personId || (!p.personId && o.ownerId === personId))).length }))
    .filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 4);

  // Kombinationen: zwei Hauptteile, die am selben Tag getragen wurden (mind. 2×)
  const byId = new Map(pool.map((i) => [i.id, i]));
  const pairCount = new Map<string, number>();
  for (const set of byDay.values()) {
    const ids = [...set].filter((id) => !SIDE_CATEGORIES.has(byId.get(id)?.category ?? '')).sort();
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const k = `${ids[i]}|${ids[j]}`;
      pairCount.set(k, (pairCount.get(k) ?? 0) + 1);
    }
  }
  const pairs = [...pairCount].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([k, n]) => { const [a, b] = k.split('|'); return { a: byId.get(a!)!, b: byId.get(b!)!, n }; });

  return {
    pieces: pool.length, trackedPieces: tracked.length, total, avgCpw, start, from, season,
    favorites: [...tracked].sort((a, b) => b.pw.length - a.pw.length).slice(0, 8).map((r) => ({ ...r, w: r.pw })),
    best, worst, idle, usage, days, outfits: outfitRows, pairs,
  };
}

/** Bestand: Teile nach Kategorie, Status, Wunschliste */
export function closetStats(all: StatItem[], personId: string | null) {
  const owned = all.filter((i) => !i.isWish && (!personId || i.ownerId === personId));
  const wishes = all.filter((i) => i.isWish && (!personId || i.ownerId === personId));
  const m = new Map<string, number>();
  for (const i of owned) if (i.status !== 'sold' && i.status !== 'out') m.set(i.category, (m.get(i.category) ?? 0) + qtyOf(i));
  const status = (['wash', 'repair', 'lent', 'out', 'sold'] as const).map((k) => ({ key: k, value: owned.filter((i) => i.status === k).length })).filter((r) => r.value);
  return {
    pieces: owned.reduce((s, i) => s + qtyOf(i), 0),
    distinct: owned.length,
    categories: [...m.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value),
    status,
    wishes: wishes.length,
    wishValue: wishes.reduce((a, i) => a + (i.pricePaid ?? i.listPrice ?? 0), 0),
  };
}
