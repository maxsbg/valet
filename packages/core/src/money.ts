// Beträge: Eingaben in deutscher Schreibweise lesen, Gesamtpreise rechnen

/** "1.234,56 €" → 1234.56; leere/ungültige Eingabe → null. Wie num() im alten Valet. */
export function parseAmount(v: unknown, decimals = 2): number | null {
  if (v === '' || v == null) return null;
  let s = String(v).trim().replace(/[€\s]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
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
