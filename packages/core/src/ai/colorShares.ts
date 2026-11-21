// Stapellauf „Farbanteile nachtragen“ (Max 21.11.2026): für schon analysierte, mehrfarbige Teile nur die Flächenanteile
// der gespeicherten Farben abfragen – Profil, Farben und alle anderen Werte bleiben unverändert.
import { MULTICOLOR, colorLabel, toColorKeys } from '../attributes';
import { sharesFor } from '../traits';
import { hasProfile } from './view';

const STEPS = Array.from({ length: 20 }, (_, i) => (i + 1) * 5);

/** Braucht das Teil noch Farbanteile? Mindestens 2 Farben (nicht „Bunt“), KI-Profil vorhanden, noch keine gültigen Anteile */
export function sharesMissing(colors: readonly string[] | null | undefined, analysis: unknown): boolean {
  const keys = toColorKeys(colors ?? []);
  if (keys.length < 2 || keys.includes(MULTICOLOR) || !hasProfile(analysis)) return false;
  return !sharesFor(keys, (analysis as { color_shares?: unknown } | null)?.color_shares);
}

export function colorSharesPrompt(colors: readonly string[], back = false): string {
  const keys = toColorKeys(colors);
  return [
    ...(back ? ['Das zweite Bild zeigt die Rückseite desselben Teils (z. B. Backprint) – rechne beide Seiten zusammen.'] : []),
    'Du siehst ein Kleidungsstück. Seine Farben sind bereits festgelegt (nach Fläche sortiert):',
    keys.map((k, i) => `${i + 1}. ${colorLabel(k)} (${k})`).join('\n'),
    'Schätze für jede dieser Farben ihren Anteil an der sichtbaren Fläche des Teils in Prozent, in 5er-Schritten, in genau dieser Reihenfolge.',
    'Kleine Details wie Logo, Naht, Knöpfe, Schriftzug oder Streifen am Bündchen bekommen ehrlich kleine Werte (5 oder 10).',
    'Die Summe soll 100 ergeben. Keine Farbe weglassen, keine neue Farbe hinzufügen.',
  ].join('\n');
}

export function colorSharesSchema(_colors: readonly string[]) {
  return {
    type: 'object',
    properties: {
      color_shares: { type: 'array', description: 'Flächenanteil je Farbe in %, gleiche Reihenfolge wie die Farben', items: { type: 'integer', enum: STEPS } },
    },
    required: ['color_shares'],
    additionalProperties: false,
  };
}

/** Antwort prüfen: genau eine Zahl > 0 je Farbe, auf 100 % und 5er-Schritte gebracht; sonst null */
export function checkColorShares(data: unknown, colors: readonly string[]): number[] | null {
  const n = toColorKeys(colors).length;
  const v = (data as { color_shares?: unknown } | null)?.color_shares;
  if (!Array.isArray(v) || v.length !== n || !v.every((x) => typeof x === 'number' && x > 0)) return null;
  const sum = (v as number[]).reduce((a, b) => a + b, 0);
  return (v as number[]).map((x) => Math.max(5, Math.round((x / sum) * 20) * 5));
}

/** Änderung fürs Speichern: nur items.analysis.color_shares */
export function sharesChange(analysis: unknown, colors: readonly string[], shares: readonly number[]): { analysis: Record<string, unknown> } {
  const base = analysis && typeof analysis === 'object' ? (analysis as Record<string, unknown>) : {};
  return { analysis: { ...base, color_shares: { colors: toColorKeys(colors), shares: [...shares] } } };
}
