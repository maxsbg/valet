// Gleichmäßig umbrechen (Spec 1): Zeilenzahl wie beim normalen Umbruch, dann Kapseln möglichst gleich verteilen
// (5 → 3 + 2, 6 → 3 + 3). Passt die gleiche Verteilung nicht, normaler Umbruch.

/** Normaler Umbruch: Anzahl je Zeile */
export function greedyRows(widths: readonly number[], available: number, gap: number): number[] {
  const rows: number[] = [];
  let cur = 0, w = 0;
  for (const x of widths) {
    if (cur && w + gap + x > available) { rows.push(cur); cur = 0; w = 0; }
    w += (cur ? gap : 0) + x; cur++;
  }
  if (cur) rows.push(cur);
  return rows;
}

/** Anzahl je Zeile, gleichmäßig verteilt (vordere Zeilen bekommen den Rest) */
export function balanceRows(widths: readonly number[], available: number, gap: number): number[] {
  if (!widths.length) return [];
  const greedy = greedyRows(widths, available, gap);
  const R = greedy.length, base = Math.floor(widths.length / R), extra = widths.length % R;
  const even = Array.from({ length: R }, (_, k) => base + (k < extra ? 1 : 0));
  let k = 0;
  const fits = even.every((cnt) => { let w = 0; for (let j = 0; j < cnt; j++) w += widths[k++]! + (j ? gap : 0); return w <= available; });
  return fits ? even : greedy;
}

/** Liste nach Zeilen-Anzahlen aufteilen */
export function splitRows<T>(items: readonly T[], counts: readonly number[]): T[][] {
  const out: T[][] = [];
  let k = 0;
  for (const c of counts) { out.push(items.slice(k, k + c)); k += c; }
  return out;
}
