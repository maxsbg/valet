// Welche Felder je Kategorie (VALET_DETAILSEITE_SPEC.md, Abschnitt 8a, entschieden 15.11.2026)
// Felder, die für eine Kategorie keinen Sinn ergeben, werden in Bearbeiten und Ansicht nicht gezeigt.
// Gespeicherte Werte bleiben in der Datenbank. Eine Karte ohne sichtbare Zeile entfällt.

import { COLLARS, SIZES, ONE_SIZE, sizeSystemOf, type SizeSystem } from './attributes';

/** Art der Größenangabe */
export type SizeKind =
  | 'clothing' // Buchstaben / Zahlen 44–60 (+ One Size), Hemd zusätzlich Kragenweite
  | 'pants'    // W/L (Standard) oder Buchstaben; Shorts und Pyjama-Hose nur Bundweite
  | 'shoe'     // EU
  | 'cap'      // Kappe: verstellbar oder Fitted (mit Größe)
  | 'ring';    // Ringgröße

export type Fields = {
  pattern: boolean;
  reversible: boolean;
  size: SizeKind | null;
  /** Passform-Skalen kommen aus fitScalesOf (categories.ts) */
  layers: boolean;
  weather: boolean;
  /** „Kragen“ oder „Ausschnitt“ – eine Zeile, Name und Werte nach Unterkategorie */
  neckline: { label: 'Kragen' | 'Ausschnitt'; options: readonly string[] } | null;
  closure: boolean;
  strap: boolean;
  care: boolean;
};

export const NECKLINES = ['Rundhals', 'V-Ausschnitt', 'Knopfleiste', 'Polokragen', 'Rollkragen', 'Stehkragen', 'Kapuze'] as const;
export const OUTER_COLLARS = [...COLLARS.filter((c) => c !== 'ohne Kragen'), 'Kapuze', 'ohne Kragen'] as const;
/** Trägerart bei Taschen (bestätigt 15.11.2026) */
export const STRAPS = ['Henkel', 'Schultergurt', 'Umhängegurt', 'Rucksackgurte', 'Kette', 'ohne'] as const;

const ACC_CARE = new Set(['Unterwäsche', 'Socke', 'Strumpfhose', 'Bademode', 'Schal', 'Anzug-Accessoire', 'Handschuh', 'Traditionelle Kleidung', 'Stulpe']);
const ACC_WEATHER = new Set(['Schal', 'Handschuh', 'Socke', 'Strumpfhose', 'Stulpe', 'Bademode']);
const TOP_CLOSURE = new Set(['Hemd', 'Bluse', 'Polohemd', 'Body']);
const ACC_CLOSURE = new Set(['Gürtel', 'Handschuh']);

/** Ohne Kategorie: alles zeigen (nichts verstecken, solange nichts gewählt ist) */
const ALL: Fields = {
  pattern: true, reversible: true, size: 'clothing', layers: true, weather: true,
  neckline: { label: 'Kragen', options: COLLARS }, closure: true, strap: false, care: true,
};

export function fieldsFor(category: string | null | undefined, sub?: string | null): Fields {
  switch (category) {
    case 'Oberteil': {
      const shirt = sub === 'Hemd' || sub === 'Bluse';
      return { pattern: true, reversible: true, size: 'clothing', layers: true, weather: true,
        neckline: shirt ? { label: 'Kragen', options: COLLARS } : { label: 'Ausschnitt', options: NECKLINES },
        closure: !sub || TOP_CLOSURE.has(sub), strap: false, care: true };
    }
    case 'Kleid':
      return { pattern: true, reversible: true, size: 'clothing', layers: false, weather: true, neckline: { label: 'Ausschnitt', options: NECKLINES }, closure: false, strap: false, care: true };
    case 'Hose':
    case 'Shorts':
      return { pattern: true, reversible: true, size: 'pants', layers: false, weather: true, neckline: null, closure: false, strap: false, care: true };
    case 'Rock':
      return { pattern: true, reversible: true, size: 'clothing', layers: false, weather: true, neckline: null, closure: false, strap: false, care: true };
    case 'Oberbekleidung':
      return { pattern: true, reversible: true, size: 'clothing', layers: true, weather: true, neckline: { label: 'Kragen', options: OUTER_COLLARS }, closure: true, strap: false, care: true };
    case 'Schuh':
      return { pattern: false, reversible: false, size: 'shoe', layers: false, weather: true, neckline: null, closure: true, strap: false, care: false };
    case 'Tasche':
      return { pattern: true, reversible: true, size: null, layers: false, weather: false, neckline: null, closure: true, strap: true, care: false };
    case 'Kopfbedeckung':
      return { pattern: true, reversible: true, size: sub === 'Kappe' ? 'cap' : 'clothing', layers: false, weather: true, neckline: null, closure: false, strap: false, care: true };
    case 'Schmuck':
      return { pattern: false, reversible: false, size: sub === 'Ring' ? 'ring' : null, layers: false, weather: false, neckline: null, closure: false, strap: false, care: false };
    case 'Accessoire':
      return { pattern: true, reversible: true, size: 'clothing', layers: false, weather: !!sub && ACC_WEATHER.has(sub), neckline: null,
        closure: !!sub && ACC_CLOSURE.has(sub), strap: false, care: !!sub && ACC_CARE.has(sub) };
    default:
      return ALL;
  }
}

// ---------- Größen je Art ----------

const range = (a: number, b: number, step = 1) => Array.from({ length: Math.round((b - a) / step) + 1 }, (_, i) => a + i * step);

export const PANTS_WAIST = range(26, 40).map((n) => `W${n}`);
export const PANTS_LENGTH = range(28, 36).map((n) => `L${n}`);
/** EU-Schuhgrößen 35–48 in halben Schritten (bestätigt 15.11.2026) */
export const SHOE_SIZES = range(35, 48, 0.5).map((n) => (Number.isInteger(n) ? String(n) : `${Math.floor(n)},5`));
export const CAP_ADJUSTABLE = 'Verstellbar';
/** Fitted-Größen (US, Kopfumfang) */
export const CAP_FITTED = ['6 7/8', '7', '7 1/8', '7 1/4', '7 3/8', '7 1/2', '7 5/8', '7 3/4', '7 7/8', '8'] as const;
/** Ringgrößen (Innenumfang in mm, bestätigt 15.11.2026) */
export const RING_SIZES = range(48, 66).map(String);

/** Hose ohne Länge: Shorts und Pyjama-Hose (Spec 7) */
export const pantsWaistOnly = (category: string | null | undefined, sub?: string | null) =>
  category === 'Shorts' || (category === 'Hose' && sub === 'Pyjama-Hose');

/** „W32/L32“ → { w: 'W32', l: 'L32' } */
export function parseWL(size: string | null | undefined): { w: string | null; l: string | null } {
  const m = /^\s*(W\d{2})\s*(?:\/\s*(L\d{2}))?\s*$/i.exec(size ?? '');
  return m ? { w: m[1]!.toUpperCase(), l: m[2] ? m[2].toUpperCase() : null } : { w: null, l: null };
}
export const composeWL = (w: string | null, l: string | null) => (w ? (l ? `${w}/${l}` : w) : l ? l : null);

/** Kappe: alte Angaben wie „7 3/8 (58,7 cm)“ oder „One Size“ erkennen */
export function capSize(size: string | null | undefined): string | null {
  const s = (size ?? '').trim();
  if (!s) return null;
  if (s === ONE_SIZE || /verstell/i.test(s)) return CAP_ADJUSTABLE;
  const hit = [...CAP_FITTED].sort((a, b) => b.length - a.length).find((f) => s.startsWith(f));
  return hit ?? null;
}

/** Alle Größen-Systeme (items.size_system) */
export type SizeSystemAny = SizeSystem | 'wl' | 'eu' | 'cap' | 'ring';

/** Größen-System beim Laden passend zur Art bestimmen (alte Daten: Schuhe „numbers“ → EU, Jeans „W30/L34“ → W/L) */
export function sizeSystemOn(kind: SizeKind | null, stored: string | null | undefined, size: string | null | undefined): SizeSystemAny | null {
  switch (kind) {
    case null: return null;
    case 'shoe': return 'eu';
    case 'cap': return 'cap';
    case 'ring': return 'ring';
    case 'pants':
      if (stored === 'letters' || (size && SIZES.letters.includes(size))) return 'letters';
      return 'wl'; // Standard bei Hosen
    default:
      if (stored === 'letters' || stored === 'numbers') return stored;
      return sizeSystemOf(size);
  }
}

// ---------- Größe aus Text (KI „Infos auslesen“) ----------

const LETTER_ALIAS: Readonly<Record<string, string>> = { '2XS': 'XXS', '2XL': 'XXL', XXXL: '3XL', OS: ONE_SIZE, 'ONE SIZE': ONE_SIZE, ONESIZE: ONE_SIZE, EINHEITSGRÖSSE: ONE_SIZE, EINHEITSGRÖßE: ONE_SIZE };

/**
 * Freie Größenangabe (z. B. „EU 42 1/2“, „32/34“, „xl“) → Wert aus den festen Listen der Größen-Art.
 * Passt nichts, kommt null zurück – die KI schreibt nie eigene Werte in die Größe.
 */
export function matchSize(kind: SizeKind | null, raw: string | null | undefined, waistOnly = false): { system: SizeSystemAny; size: string } | null {
  const s = (raw ?? '').trim().toUpperCase().replace(/^(EU|DE|GR\.?|GRÖSSE|GRÖßE|SIZE)\s*/, '').trim();
  if (!kind || !s) return null;
  const letter = LETTER_ALIAS[s] ?? s;
  const isLetter = SIZES.letters.includes(letter);
  switch (kind) {
    case 'shoe': {
      const m = /^(\d{2})(?:\s*(?:[.,]5|1\/2|½))?$/.exec(s);
      if (!m) return null;
      const v = /[.,]5|1\/2|½/.test(s) ? `${m[1]},5` : m[1]!;
      return SHOE_SIZES.includes(v) ? { system: 'eu', size: v } : null;
    }
    case 'cap': {
      const v = capSize(letter === ONE_SIZE ? ONE_SIZE : s);
      return v ? { system: 'cap', size: v } : null;
    }
    case 'ring':
      return RING_SIZES.includes(s) ? { system: 'ring', size: s } : null;
    case 'pants': {
      if (isLetter) return { system: 'letters', size: letter };
      const m = /^W?\s*(\d{2})(?:\s*[/X ]\s*L?\s*(\d{2}))?$/.exec(s);
      if (!m) return null;
      const w = `W${m[1]}`, l = m[2] && !waistOnly ? `L${m[2]}` : null;
      if (!PANTS_WAIST.includes(w) || (l && !PANTS_LENGTH.includes(l))) return null;
      return { system: 'wl', size: composeWL(w, l)! };
    }
    default:
      if (isLetter) return { system: 'letters', size: letter };
      return SIZES.numbers.includes(s) ? { system: 'numbers', size: s } : null;
  }
}
