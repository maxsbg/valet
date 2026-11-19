// Passform aus Shop-Begriffen im Namen („Slim Ribbed Shirt“ → Weite schmal). Der Name hat Vorrang vor der
// Schätzung der KI aus dem Foto (Max, 19.11.2026). Reine Funktionen, Stufen aus FIT_TERMS in categories.ts.
import { FIT_TERMS, fitScalesOf, type FitScale } from './categories';

type FitPart = Partial<Record<FitScale['key'], number>>;
export type NameFit = { fit: FitPart; leg?: 'straight' | 'tapered' };

/** Schreibweisen im Namen → Begriff aus FIT_TERMS */
const ALIASES: Readonly<Record<string, string>> = {
  'slim fit': 'slim', oversize: 'oversized', 'over sized': 'oversized', 'over size': 'oversized',
  'high waisted': 'high waist', 'relaxed fit': 'relaxed',
};
/** Zusätzlich zu FIT_TERMS (nur fürs Auslesen des Namens) */
const EXTRA: Readonly<Record<string, FitPart>> = { 'wide leg': { width: 4 } };
/** Nur Hinweis für profile.leg (keine Stufe der Passform) */
const LEG_TERMS: Readonly<Record<string, 'straight' | 'tapered'>> = { 'straight leg': 'straight', tapered: 'tapered' };

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9äöüß]+/g, ' ').trim()} `;
const has = (n: string, term: string) => n.includes(` ${term} `);

/**
 * Begriffe im Namen (Groß-/Kleinschreibung egal, nur ganze Wörter, Bindestriche wie Leerzeichen) → Teilwerte
 * für width/length/rise und ggf. den Beinverlauf. Mehrere Begriffe ergänzen sich; spätere überschreiben frühere.
 */
export function fitFromName(name: string | null | undefined): NameFit {
  const n = norm(name ?? '');
  const out: NameFit = { fit: {} };
  if (!n.trim()) return out;
  const terms: [string, FitPart][] = [...Object.entries(FIT_TERMS), ...Object.entries(EXTRA)];
  for (const [term, part] of terms) {
    const words = [term, ...Object.entries(ALIASES).filter(([, t]) => t === term).map(([a]) => a)];
    if (words.some((w) => has(n, w))) Object.assign(out.fit, part);
  }
  for (const [term, leg] of Object.entries(LEG_TERMS)) if (has(n, term)) out.leg = leg;
  return out;
}

/**
 * Nur die Stufen, die es für die Kategorie gibt. Länge nur auf der Skala kurz–lang
 * (Kleid/Rock zählen Mini bis Maxi – „Cropped“/„Oversized“ sagen dort nichts darüber).
 */
export function nameFitFor(category: string | null | undefined, part: FitPart): FitPart {
  const out: FitPart = {};
  for (const sc of fitScalesOf(category)) {
    const v = part[sc.key];
    if (v == null) continue;
    if (sc.key === 'length' && sc.steps[0] !== 'kurz') continue;
    out[sc.key] = Math.min(v, sc.steps.length - 1);
  }
  return out;
}

/** Gefundene Passform-Begriffe in einem Text (Name, Beschreibung), in der Schreibweise der Liste: „slim“, „wide leg“, „tapered“ */
export function fitTermsIn(text: string | null | undefined): string[] {
  const n = norm(text ?? '');
  if (!n.trim()) return [];
  const terms = [...Object.keys(FIT_TERMS), ...Object.keys(EXTRA), ...Object.keys(LEG_TERMS)];
  return terms.filter((term) => [term, ...Object.entries(ALIASES).filter(([, t]) => t === term).map(([a]) => a)].some((w) => has(n, w)));
}
