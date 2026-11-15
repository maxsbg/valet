// Wunschteil-Detail (VALET_DETAILSEITE_SPEC.md, Abschnitte 2, 3 und 5): Kauf-Angaben, Kauftag, „Gekauft“-Blatt
// Plattformunabhängig, Datumswerte als ISO-Text (JJJJ-MM-TT).

import { formatPrice } from './money';

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const;
const parts = (iso: string) => iso.split('-').map(Number) as [number, number, number];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (day: string, n: number) => { const [y, m, d] = parts(day); return iso(new Date(y, m - 1, d + n)); };
const weekday = (day: string) => { const [y, m, d] = parts(day); return new Date(y, m - 1, d).getDay(); };

/** „02.09.2026“ */
export function deDate(day: string): string {
  const [y, m, d] = day.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

/** Kauftag mit Wochentag: „Sa 21.11.2026“ */
export const buyDayLabel = (day: string) => `${WEEKDAYS[weekday(day)]} ${deDate(day)}`;

/** Kauftag relativ zu heute (Hinweis im Blatt / auf der Übersicht): „heute“, „morgen“, „in 5 Tagen“, „vor 2 Tagen“ */
export function buyDayHint(day: string, today: string): string {
  const [a, b] = [parts(today), parts(day)];
  const n = Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 864e5);
  if (n === 0) return 'heute';
  if (n === 1) return 'morgen';
  if (n > 1) return `in ${n} Tagen`;
  if (n === -1) return 'gestern';
  return `vor ${-n} Tagen`;
}

/** Schnellwahl im Blatt „Kauftag planen“: Heute, Morgen, Samstag (nächster, am Samstag in einer Woche), In einer Woche */
export function buyDayQuick(today: string): { label: string; day: string }[] {
  const toSat = (6 - weekday(today) + 7) % 7 || 7;
  return [
    { label: 'Heute', day: today },
    { label: 'Morgen', day: addDays(today, 1) },
    { label: 'Samstag', day: addDays(today, toSat) },
    { label: 'In einer Woche', day: addDays(today, 7) },
  ];
}

/** Preisänderung seit dem Merken (nur ganze Prozent, ab 1 %) */
export function priceTrend(atSave: number | null | undefined, now: number | null | undefined): { pct: number; down: boolean } | null {
  if (atSave == null || now == null || atSave <= 0 || now === atSave) return null;
  const pct = Math.round(Math.abs(now - atSave) / atSave * 100);
  return pct >= 1 ? { pct, down: now < atSave } : null;
}

export type WishRow = {
  list_price: number | null; wish_price: number | null; shop: string | null; article_no: string | null;
  created_at: string | null; buy_on: string | null;
};

/** Kauf-Reiter des Wunschteils (Spec 5): Shop, Artikelnummer, Gemerkt am, Kauftag geplant, Preis beim Merken – leere weglassen */
export function wishFacts(r: WishRow): [string, string][] {
  return ([
    ['Shop', r.shop ?? ''],
    ['Artikelnummer', r.article_no ?? ''],
    ['Gemerkt am', r.created_at ? deDate(r.created_at) : ''],
    ['Kauftag geplant', r.buy_on ? buyDayLabel(r.buy_on) : ''],
    ['Preis beim Merken', r.wish_price != null ? formatPrice(r.wish_price) : ''],
  ] as [string, string][]).filter(([, v]) => !!v);
}

/** Wem der Wunsch gehört: Besitzer des Teils, sonst Besitzer der Liste */
export function wishOwners(ownerIds: readonly string[] | null | undefined, listOwner: string | null | undefined): string[] {
  if (ownerIds?.length) return [...ownerIds];
  return listOwner ? [listOwner] : [];
}

/** „Gekauft“-Blatt vorbelegen: Preis = Wunsch-Preis, Kaufdatum heute, Besitzer: Wunschteil → Liste → ich */
export function buyDefaults(o: { ownerIds?: readonly string[] | null; listOwner?: string | null; me?: string | null; price: number | null; today: string }) {
  const owners = wishOwners(o.ownerIds, o.listOwner);
  return { price: o.price, date: o.today, owners: owners.length ? owners : o.me ? [o.me] : [] };
}

/** „Gekauft“-Blatt prüfen; null = in Ordnung */
export function buyError(b: { price: string; priceValue: number | null; date: string | null; owners: string[] }, today: string): string | null {
  if (b.price.trim() && b.priceValue == null) return 'Preis ist keine Zahl.';
  if (b.priceValue != null && b.priceValue < 0) return 'Preis darf nicht negativ sein.';
  if (!b.date) return 'Bitte ein Kaufdatum wählen.';
  if (b.date > today) return 'Das Kaufdatum liegt in der Zukunft.';
  if (!b.owners.length) return 'Bitte wählen, wem das Teil gehört.';
  return null;
}
