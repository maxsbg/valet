// Sieben Status (VALET_DETAILSEITE_SPEC.md, Abschnitt 6, entschieden 15.11.2026)
// „Im Schrank“ ist in der Datenbank status = null.

import type { ItemStatus } from './catalog';
import { formatPrice } from './money';

export type StatusKey = 'closet' | ItemStatus;

export type StatusDef = {
  key: StatusKey;
  label: string;
  /** Symbol-Schlüssel in TileIcons */
  icon: StatusKey;
  /** true = nach der Wahl im Menü öffnet sich das Blatt für die Zusatzangaben („…“ im Menü) */
  details: boolean;
  /** Ein Satz, was der Status bewirkt (Blatt) */
  hint: string;
};

export const STATUS_LIST: readonly StatusDef[] = [
  { key: 'closet', label: 'Im Schrank', icon: 'closet', details: false, hint: 'Normalzustand: Das Teil ist da und kann vorgeschlagen werden.' },
  { key: 'wash', label: 'Wäsche', icon: 'wash', details: false, hint: 'In der Wäsche: fällt aus den Vorschlägen, bis du es zurück in den Schrank setzt.' },
  { key: 'repair', label: 'Reparatur', icon: 'repair', details: true, hint: 'In Reparatur: fällt aus den Vorschlägen, bis es zurück ist.' },
  { key: 'lent', label: 'Verliehen', icon: 'lent', details: true, hint: 'Verliehene Teile fallen aus den Vorschlägen. Ist ein Rückgabetag gesetzt, erinnert Valet dich daran.' },
  { key: 'stored', label: 'Eingelagert', icon: 'stored', details: true, hint: 'Bleibt im Schrank sichtbar und im Outfit-Baukasten wählbar, mit Hinweis, dass es gerade nicht griffbereit ist.' },
  { key: 'out', label: 'Aussortiert', icon: 'out', details: false, hint: 'Aussortiert heißt: soll weg, ist aber noch nicht verkauft. Im Schrank ausgeblendet, über den Filter sichtbar.' },
  { key: 'sold', label: 'Verkauft', icon: 'sold', details: true, hint: 'Der Erlös wird in der Statistik abgezogen („netto ausgegeben“). Das Teil verschwindet aus dem Schrank, bleibt aber über den Filter sichtbar.' },
];

export const statusKey = (s: ItemStatus | null | undefined): StatusKey => s ?? 'closet';
export const statusDb = (k: StatusKey): ItemStatus | null => (k === 'closet' ? null : k);
export const statusDef = (k: StatusKey) => STATUS_LIST.find((s) => s.key === k)!;

/** Vorschläge im Blatt (Spec 6) */
export const STORED_PLACES = ['Keller', 'Dachboden', 'Bei den Eltern'] as const;
export const SOLD_PLACES = ['Vinted', 'eBay', 'Kleinanzeigen', 'Freunde', 'Sonstiges'] as const;

/** Zusatzangaben eines Status (Spalten in items) */
export type StatusInfo = {
  status: ItemStatus | null;
  /** seit (Datum) */
  status_at: string | null;
  /** Reparatur / Eingelagert / Verkauft: wo */
  status_where: string | null;
  /** Verliehen: zurück bis */
  status_until: string | null;
  /** Verliehen an: Person aus dem Schrank … */
  lent_person_id: string | null;
  /** … oder freier Name */
  lent_to: string | null;
  sold_price: number | null;
  sold_date: string | null;
};

/** Datenbank-Änderung für einen neuen Status; nicht passende Angaben werden geleert. */
export function statusChange(k: StatusKey, d: Partial<StatusInfo>, today: string): StatusInfo {
  const s = statusDb(k);
  const where = (d.status_where ?? '').trim() || null;
  return {
    status: s,
    status_at: s ? d.status_at || today : null,
    status_where: s === 'repair' || s === 'stored' || s === 'sold' ? where : null,
    status_until: s === 'lent' ? d.status_until || null : null,
    lent_person_id: s === 'lent' ? d.lent_person_id ?? null : null,
    lent_to: s === 'lent' && !d.lent_person_id ? (d.lent_to ?? '').trim() || null : null,
    sold_price: s === 'sold' ? d.sold_price ?? null : null,
    sold_date: s === 'sold' ? d.sold_date || today : null,
  };
}

/** Prüfen vor dem Speichern: Fehlermeldung oder null */
export function statusError(k: StatusKey, d: Partial<StatusInfo>): string | null {
  if (k === 'lent' && d.status_until && d.status_at && d.status_until < d.status_at) return '„Zurück bis“ liegt vor „Seit“.';
  if (k === 'sold' && d.sold_price != null && d.sold_price < 0) return 'Der Erlös kann nicht negativ sein.';
  return null;
}

// ---------- Status-Karte (Spec 3.1) ----------

/** „12.10.“ im laufenden Jahr, sonst „12.10.2025“ */
export function shortDate(iso: string, today: string): string {
  const [y, m, d] = iso.split('-');
  return `${Number(d)}.${Number(m)}.${y === today.slice(0, 4) ? '' : y}`;
}
const days = (a: string, b: string) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 864e5);

export type StatusCard = {
  icon: StatusKey;
  title: string;
  details: string[];
  /** Hinweis in accent (Rückgabe fällig) */
  warn: string | null;
  /** genau eine Schnellaktion; „sheet:sold“ öffnet das Verkauft-Blatt */
  action: { label: string; to: StatusKey | 'sheet:sold' };
};

/** Karte nur, wenn der Status nicht „Im Schrank“ ist. personName löst lent_person_id auf. */
export function statusCard(i: StatusInfo, today: string, personName: (id: string) => string | null = () => null): StatusCard | null {
  const s = i.status;
  if (!s) return null;
  const since = i.status_at ? `seit ${shortDate(i.status_at, today)}` : null;
  const parts = (...x: (string | null | false | undefined)[]) => x.filter((v): v is string => !!v);
  switch (s) {
    case 'wash':
      return { icon: s, title: 'In der Wäsche', details: parts(since), warn: null, action: { label: 'Gewaschen', to: 'closet' } };
    case 'repair':
      return { icon: s, title: 'In Reparatur', details: parts(since, i.status_where && `bei ${i.status_where}`), warn: null, action: { label: 'Zurück', to: 'closet' } };
    case 'lent': {
      const who = (i.lent_person_id && personName(i.lent_person_id)) || i.lent_to;
      let warn: string | null = null;
      if (i.status_until) {
        const n = days(today, i.status_until);
        warn = n < 0 ? `Rückgabe seit ${-n === 1 ? 'gestern' : `${-n} Tagen`} fällig` : n === 0 ? 'Rückgabe heute fällig' : null;
      }
      return {
        icon: s, title: who ? `Verliehen an ${who}` : 'Verliehen',
        details: parts(since, i.status_until && `zurück bis ${shortDate(i.status_until, today)}`), warn, action: { label: 'Zurück', to: 'closet' },
      };
    }
    case 'stored':
      return { icon: s, title: i.status_where ? `Eingelagert · ${i.status_where}` : 'Eingelagert', details: parts(since), warn: null, action: { label: 'Hervorholen', to: 'closet' } };
    case 'out':
      return { icon: s, title: 'Aussortiert', details: parts(since, 'soll verkauft werden'), warn: null, action: { label: 'Verkauft', to: 'sheet:sold' } };
    case 'sold':
      return {
        icon: s, title: i.sold_price != null ? `Verkauft für ${formatPrice(i.sold_price)}` : 'Verkauft',
        details: parts(i.sold_date && `am ${shortDate(i.sold_date, today)}`, i.status_where), warn: null, action: { label: 'Doch nicht', to: 'out' },
      };
  }
}

/** Verliehene Teile mit fälliger Rückgabe (Hinweis in der App, Push-Nachricht später) */
export const lentDue = (i: Pick<StatusInfo, 'status' | 'status_until'>, today: string) =>
  i.status === 'lent' && !!i.status_until && i.status_until <= today;
