// Kleine Format-Helfer (Beträge und Datum in deutscher Schreibweise)

export const eur = (n: number | null) => (n == null ? '' : n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
