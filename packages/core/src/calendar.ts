// Monatskalender: Raster aus ISO-Daten (YYYY-MM-DD), Wochen beginnen am Montag.

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

const iso = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m, d));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
};

/** Monat relativ zu einem Datum: `shiftMonth('2026-11-14', 1)` → `{ year: 2026, month: 11 }` (month 0-basiert: 11 = Dezember) */
export function shiftMonth(fromIso: string, offset: number): { year: number; month: number } {
  const y = Number(fromIso.slice(0, 4));
  const m = Number(fromIso.slice(5, 7)) - 1 + offset;
  return { year: y + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
}

/** „November 2026“ */
export const monthTitle = (year: number, month: number) => `${MONTHS[month]} ${year}`;

/**
 * Wochen des Monats (je 7 Tage, Montag zuerst). Tage aus dem Vor- und Folgemonat füllen
 * die erste und letzte Woche auf; `inMonth` sagt, ob der Tag zum Monat gehört.
 */
export function monthGrid(year: number, month: number): { date: string; inMonth: boolean }[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Montag = 0
  const daysIn = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const weeks = Math.ceil((lead + daysIn) / 7);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const n = w * 7 + d - lead + 1;
      return { date: iso(year, month, n), inMonth: n >= 1 && n <= daysIn };
    }),
  );
}
