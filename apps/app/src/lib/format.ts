// Kleine Format-Helfer (Beträge und Datum in deutscher Schreibweise)

export const eur = (n: number | null) => (n == null ? '' : n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
export const toDe = (iso: string | null) => (iso ? iso.split('-').reverse().join('.') : '');
export function toIso(de: string): string | null | undefined {
  const t = de.trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return undefined; // ungültig
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
