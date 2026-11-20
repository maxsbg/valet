// Beträge: Eingaben in deutscher Schreibweise lesen, Gesamtpreise rechnen

/** "1.234,56 €" → 1234.56; leere/ungültige Eingabe → null. Wie num() im alten Valet. */
export function parseAmount(v: unknown, decimals = 2): number | null {
  if (v === '' || v == null) return null;
  let s = String(v).trim().replace(/[€\s]/g, '');
  const sign = /^[+-]/.test(s) ? s[0] : '';
  const body = sign ? s.slice(1) : s;
  let normalized: string;
  if (body.includes(',')) {
    const [integer, fraction, ...extra] = body.split(',');
    if (integer == null || fraction == null || extra.length > 0 || !/^\d+(?:\.\d{3})*$/.test(integer) || !/^\d+$/.test(fraction)) return null;
    normalized = `${integer.replace(/\./g, '')}.${fraction}`;
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(body)) {
    normalized = body.replace(/\./g, '');
  } else if (/^\d+\.\d+$/.test(body) || /^\d+$/.test(body)) {
    normalized = body;
  } else {
    return null;
  }
  const n = Number(`${sign}${normalized}`);
  const f = 10 ** decimals;
  return Number.isFinite(n) ? Math.round(n * f) / f : null;
}

/** Menge, mindestens 1, ganzzahlig. */
export const qtyOf = (i: { qty?: number | null }): number =>
  Math.max(1, Math.round(Number(i.qty) || 1));

/** Bezahlter Gesamtbetrag eines Teils (Stückpreis × Menge). */
export const totalPaid = (i: { pricePaid?: number | null; qty?: number | null }): number =>
  (i.pricePaid ?? 0) * qtyOf(i);

/** Fremdwährung umrechnen; gerundet auf Cent. */
export const convert = (amount: number, rate: number): number =>
  Math.round(amount * rate * 100) / 100;

export const formatEur = (n: number | null | undefined): string =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n ?? 0);

/**
 * Preis-Anzeige der Detailseiten (Spec 1): unter 100 € mit Cent (8,43 €, 59,00 €),
 * ab 100 € ganze Euro mit Tausenderpunkt (143 €, 4.643 €).
 */
/** Genauer Preis immer mit Cent (Wunschteil, Kauf-Reiter – Max, 17.11.2026); Kacheln bleiben gerundet */
export function formatPriceExact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '–';
  return `${n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '–';
  const a = Math.abs(n);
  const s = a < 100
    ? a.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Math.round(a).toLocaleString('de-DE', { maximumFractionDigits: 0 });
  return `${n < 0 ? '−' : ''}${s} €`;
}

/** Gleiche Anteile in Cent, Rest auf die ersten verteilen (59,00 € / 2 → 29,50 + 29,50; 10 € / 3 → 3,34 + 3,33 + 3,33). */
export function equalSplit(total: number, n: number): number[] {
  if (n <= 0) return [];
  const cents = Math.round(total * 100), base = Math.floor(cents / n), rest = cents - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < rest ? 1 : 0)) / 100);
}

/** Summenprüfung der Aufteilung: 0 = passt, > 0 = es fehlt noch, < 0 = zu viel (auf Cent gerundet). */
export const splitGap = (total: number, amounts: readonly (number | null)[]): number =>
  Math.round((total - amounts.reduce<number>((a, b) => a + (b ?? 0), 0)) * 100) / 100;
