// Teil-Detail (VALET_DETAILSEITE_SPEC.md, Abschnitte 3 und 5): Tragen-Kacheln, eigener Anteil, Kauf-Anzeige
import { formatPrice } from './money';
import { shortDate } from './status';

type Payer = { personId: string | null; amount: number | null };

const dayDiff = (a: string, b: string) =>
  Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 864e5);

/** „heute“, „gestern“, „vor 3 Tagen“, ab 2 Wochen „vor 3 Wochen“, ab 2 Monaten „vor 4 Monaten“ */
export function agoLabel(iso: string, today: string): string {
  const n = dayDiff(iso, today);
  if (n <= 0) return 'heute';
  if (n === 1) return 'gestern';
  if (n < 14) return `vor ${n} Tagen`;
  if (n < 60) return `vor ${Math.round(n / 7)} Wochen`;
  return `vor ${Math.round(n / 30)} Monaten`;
}

/**
 * Eigener Anteil am Gesamtpreis (Preis je Stück × Anzahl). Ohne Zahler bzw. ohne eigene Beträge: gleiche Teile;
 * bin ich kein Zahler, zählt der ganze Betrag (z. B. Teil nur von Paul bezahlt, aber ich sehe es an).
 */
export function ownShare(pricePaid: number | null, qty: number | null, payers: Payer[] | null, meId: string | null): number | null {
  if (pricePaid == null) return null;
  const total = Math.round(pricePaid * Math.max(1, qty ?? 1) * 100) / 100;
  const ps = (payers ?? []).filter((p) => !!p.personId);
  if (ps.length < 2 || !meId || !ps.some((p) => p.personId === meId)) return total;
  const mine = ps.find((p) => p.personId === meId)!;
  if (ps.some((p) => typeof p.amount === 'number')) return mine.amount ?? 0;
  return Math.round((total / ps.length) * 100) / 100;
}

export type StatTile = { label: string; value: string; hint: string; /** Antippen öffnet Bearbeiten im Reiter Kauf */ editPrice?: boolean };

/**
 * Drei Kacheln: Getragen, Pro Tragen, Zuletzt (Spec 3.2).
 * Leer: kein Preis → „–“ + „Preis fehlt“ (antippbar); nie getragen → „0“ + „noch nie“, Zuletzt „–“; Geschenk → Pro Tragen „–“.
 */
export function wearTiles(o: { days: readonly string[]; today: string; share: number | null; gift: boolean }): StatTile[] {
  const days = [...o.days].sort();
  const n = days.length;
  const getragen: StatTile = { label: 'Getragen', value: n ? `${n}×` : '0', hint: n ? `seit ${shortDate(days[0]!, o.today)}` : 'noch nie' };
  let pro: StatTile;
  if (o.gift) pro = { label: 'Pro Tragen', value: '–', hint: 'Geschenk' };
  else if (o.share == null) pro = { label: 'Pro Tragen', value: '–', hint: 'Preis fehlt', editPrice: true };
  else pro = { label: 'Pro Tragen', value: n ? formatPrice(o.share / n) : '–', hint: `bei ${formatPrice(o.share)}` };
  const last = days[n - 1];
  const zuletzt: StatTile = last
    ? { label: 'Zuletzt', value: shortDate(last, o.today), hint: agoLabel(last, o.today) }
    : { label: 'Zuletzt', value: '–', hint: 'noch nie' };
  return [getragen, pro, zuletzt];
}

/**
 * Gemeinsame Schriftgröße der Kachel-Werte: 22 px; passt einer nicht, alle zusammen kleiner, höchstens bis 20 px.
 * widths22: gemessene Breiten bei 22 px; available: Innenbreite einer Kachel.
 */
export function statFontSize(widths22: readonly number[], available: number, max = 22, min = 20): number {
  const widest = Math.max(0, ...widths22);
  if (!widest || widest <= available) return max;
  return Math.max(min, Math.floor((max * available) / widest * 10) / 10);
}

/** Rabatt in Prozent (gerundet), wenn bezahlt < Listenpreis */
export function discountPct(paid: number | null, list: number | null): number | null {
  if (paid == null || list == null || list <= 0 || paid >= list) return null;
  return Math.round(((list - paid) / list) * 100);
}

/** Anteile für die Kauf-Ansicht: Prozent und Betrag je Zahler (vom Gesamtbetrag) */
export function shareRows(pricePaid: number | null, qty: number | null, payers: Payer[] | null): { personId: string; pct: number; amount: number }[] {
  const ps = (payers ?? []).filter((p): p is { personId: string; amount: number | null } => !!p.personId);
  if (pricePaid == null || ps.length < 2) return [];
  const total = Math.round(pricePaid * Math.max(1, qty ?? 1) * 100) / 100;
  const custom = ps.some((p) => typeof p.amount === 'number');
  return ps.map((p) => {
    const amount = custom ? p.amount ?? 0 : Math.round((total / ps.length) * 100) / 100;
    return { personId: p.personId, amount, pct: total ? Math.round((amount / total) * 100) : 0 };
  });
}

/** Kurzform der Aufteilung: „je Hälfte“, „je ein Drittel“, sonst leer */
export function splitLabel(rows: { pct: number }[]): string {
  if (rows.length === 2 && rows.every((r) => r.pct === 50)) return 'je Hälfte';
  if (rows.length === 3 && rows.every((r) => Math.abs(r.pct - 33) <= 1)) return 'je ein Drittel';
  return '';
}

/** Adresse kurz für die Anzeige: ohne https:// und www. */
export const shortUrl = (url: string) => url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');

/** Domain eines Links ohne „www.“, z. B. „https://www.zalando.de/hemd“ → „zalando.de“; kein Link → null */
export function shopDomain(link: string | null | undefined): string | null {
  const m = (link ?? '').trim().match(/^(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?:[:/?#]|$)/i);
  return m?.[1] ? m[1].toLowerCase() : null;
}

/** Shop in der Ansicht (17.11.2026, Max): als Domain („zalando.de“) und antippbar.
 *  Domain aus dem Produktlink, sonst der Shop selbst, wenn er schon eine Domain ist; sonst nur Text. */
export function shopView(shop: string | null | undefined, link: string | null | undefined): { label: string; url: string | null } | null {
  const own = shopDomain(shop);
  const host = shopDomain(link) ?? (own && !/\s/.test((shop ?? '').trim()) ? own : null);
  if (host) return { label: host, url: `https://${host}` };
  const name = (shop ?? '').trim();
  return name ? { label: name, url: null } : null;
}


/** Produktlink geändert → Shop als Domain eintragen, wenn er leer ist, zur alten Domain gehörte oder nur der Name dazu ist („Zalando“ → „zalando.de“) */
export function shopFromLink(shop: string, oldLink: string, newLink: string): string {
  const d = shopDomain(newLink);
  if (!d) return shop;
  const name = shop.trim().toLowerCase();
  if (!name || name === shopDomain(oldLink) || name === d || d.startsWith(`${name.replace(/\s+/g, '')}.`)) return d;
  return shop;
}
