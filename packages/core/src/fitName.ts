// Passform aus Shop-Begriffen im Namen („Slim Ribbed Shirt“ → Weite Slim). Der Name hat Vorrang vor der
// Schätzung der KI aus dem Foto (Max, 19.11.2026). Reine Funktionen, Begriffe aus FIT_TERMS in categories.ts.
import { FIT_TERMS, fitIndex, fitScalesOf, type FitScale } from './categories';

/** Begriffe je Skala („oversized“, „cropped“ …), noch ohne Kategorie */
type FitWords = Partial<Record<FitScale['key'], string>>;
/** Stufen (Index) in der Skala einer Kategorie */
type FitPart = Partial<Record<FitScale['key'], number>>;
export type NameFit = { fit: FitWords; leg?: 'straight' | 'tapered' | 'flared' };

/** Schreibweisen im Namen → Begriff aus FIT_TERMS */
const ALIASES: Readonly<Record<string, string>> = {
  'slim fit': 'slim', slimfit: 'slim', 'skinny fit': 'skinny', 'regular fit': 'regular',
  oversize: 'oversized', 'over sized': 'oversized', 'over size': 'oversized',
  'high waisted': 'high waist', highwaist: 'high waist', 'high rise': 'high waist', highrise: 'high waist',
  'relaxed fit': 'relaxed', 'loose fit': 'relaxed', 'low waist': 'low rise',
};
/** Zusätzlich zu FIT_TERMS (nur fürs Auslesen des Namens) */
const EXTRA: Readonly<Record<string, FitWords>> = { 'wide leg': { width: 'wide' } };
/** Nur Hinweis für profile.leg (keine Stufe der Passform) */
const LEG_TERMS: Readonly<Record<string, NonNullable<NameFit['leg']>>> = {
  'straight leg': 'straight', 'straight fit': 'straight', tapered: 'tapered',
  bootcut: 'flared', 'boot cut': 'flared', flared: 'flared', flare: 'flared',
};

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
  const terms: [string, FitWords][] = [...Object.entries(FIT_TERMS), ...Object.entries(EXTRA)];
  for (const [term, part] of terms) {
    const words = [term, ...Object.entries(ALIASES).filter(([, t]) => t === term).map(([a]) => a)];
    if (words.some((w) => has(n, w))) Object.assign(out.fit, part);
  }
  for (const [term, leg] of Object.entries(LEG_TERMS)) if (has(n, term)) out.leg = leg;
  return out;
}

/**
 * Begriffe → Stufen der Kategorie; nur, was es dort gibt (Kleid/Rock zählen Mini bis Maxi – „Cropped“/„Oversized“
 * sagen dort nichts über die Länge).
 */
export function nameFitFor(category: string | null | undefined, words: FitWords): FitPart {
  const out: FitPart = {};
  for (const sc of fitScalesOf(category)) {
    const i = fitIndex(category, sc.key, words[sc.key]);
    if (i != null) out[sc.key] = i;
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
