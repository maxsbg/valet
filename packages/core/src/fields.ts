// Welche Felder je Kategorie (VALET_DETAILSEITE_SPEC.md, Abschnitt 8a, entschieden 15.11.2026)
// Felder, die für eine Kategorie keinen Sinn ergeben, werden in Bearbeiten und Ansicht nicht gezeigt.
// Gespeicherte Werte bleiben in der Datenbank. Eine Karte ohne sichtbare Zeile entfällt.

import { COLLAR_LIST, COLLARS, LETTER_DOUBLES, SIZES, ONE_SIZE, sizeSystemOf, type SizeSystem } from './attributes';
import { KEY_LISTS, label, pickKeys, type KeyList } from './keys';

/** Art der Größenangabe */
export type SizeKind =
  | 'clothing'  // Buchstaben (+ Doppelgrößen) / Zahlen 44–60 (+ One Size), Hemd zusätzlich Kragenweite
  | 'pants'     // W/L (Standard) oder Buchstaben, Stoffhose zusätzlich Zahlen; Shorts und Pyjama-Hose nur Bundweite
  | 'shoe'      // EU, ganze/halbe oder Drittelgrößen
  | 'cap'       // Kappe: verstellbar, Fitted (mit Größe) oder Flexfit
  | 'ring'      // Ringgröße
  | 'glove'     // Handschuh: Zahlen 5–12 oder Buchstaben
  | 'belt'      // Gürtel: Länge in cm oder Buchstaben
  | 'sock'      // Socke, Strumpfhose: Bereich (39–42) oder Buchstaben
  | 'hat'       // Hut: Kopfumfang in cm oder Buchstaben
  | 'bracelet'  // Armband: Länge in cm
  | 'necklace'  // Halskette: Länge in cm
  | 'watch'     // Uhr: Gehäusedurchmesser in mm
  | 'underwear' // Unterwäsche: Buchstaben oder Zahlen 4–9
  | 'letters';  // Mütze, Hijab, sonstige Kopfbedeckung: nur Buchstaben

export type Fields = {
  pattern: boolean;
  reversible: boolean;
  size: SizeKind | null;
  /** Passform-Skalen kommen aus fitScalesOf (categories.ts) */
  layers: boolean;
  weather: boolean;
  /** „Kragen“ oder „Ausschnitt“ – eine Zeile, Name und Werte nach Unterkategorie */
  neckline: { label: 'Kragen' | 'Ausschnitt'; options: KeyList } | null;
  closure: boolean;
  strap: boolean;
  care: boolean;
};

/** Ausschnitte bei Oberteilen (außer Hemd/Bluse) und Kleidern */
export const NECKLINES: KeyList = pickKeys(COLLAR_LIST, ['crew_neck', 'v_neck', 'placket', 'polo_collar', 'turtleneck', 'stand_collar', 'hood']);
/** Kragen bei Oberbekleidung */
export const OUTER_COLLARS: KeyList = pickKeys(COLLAR_LIST, [...COLLARS.map((c) => c.key).filter((k) => k !== 'no_collar'), 'hood', 'no_collar']);
/** Trägerart bei Taschen (bestätigt 15.11.2026) */
export const STRAPS: KeyList = KEY_LISTS.straps;
export const strapLabel = (key: string | null | undefined): string => label(STRAPS, key);

const ACC_CARE = new Set(['underwear', 'sock', 'tights', 'swimwear', 'scarf', 'suit_accessory', 'glove', 'traditional_clothing', 'warmer']);
const ACC_WEATHER = new Set(['scarf', 'glove', 'sock', 'tights', 'warmer', 'swimwear']);
const TOP_CLOSURE = new Set(['shirt', 'blouse', 'polo', 'bodysuit']);
const ACC_CLOSURE = new Set(['belt', 'glove']);
/** Accessoires ohne Größenfeld (Werte bleiben gespeichert) */
const ACC_NO_SIZE = new Set(['glasses', 'wallet', 'phone_case', 'hair_accessory', 'suit_accessory', 'scarf']);
const ACC_SIZE: Readonly<Record<string, SizeKind>> = { glove: 'glove', belt: 'belt', sock: 'sock', tights: 'sock', underwear: 'underwear' };
const JEWELRY_SIZE: Readonly<Record<string, SizeKind>> = { ring: 'ring', bracelet: 'bracelet', necklace: 'necklace', watch: 'watch' };

/** Ohne Kategorie: alles zeigen (nichts verstecken, solange nichts gewählt ist) */
const ALL: Fields = {
  pattern: true, reversible: true, size: 'clothing', layers: true, weather: true,
  neckline: { label: 'Kragen', options: COLLARS }, closure: true, strap: false, care: true,
};

export function fieldsFor(category: string | null | undefined, sub?: string | null): Fields {
  switch (category) {
    case 'top': {
      const shirt = sub === 'shirt' || sub === 'blouse';
      return { pattern: true, reversible: true, size: 'clothing', layers: true, weather: true,
        neckline: shirt ? { label: 'Kragen', options: COLLARS } : { label: 'Ausschnitt', options: NECKLINES },
        closure: !sub || TOP_CLOSURE.has(sub), strap: false, care: true };
    }
    case 'dress':
      return { pattern: true, reversible: true, size: 'clothing', layers: true, weather: true, neckline: { label: 'Ausschnitt', options: NECKLINES }, closure: false, strap: false, care: true };
    case 'pants':
    case 'shorts':
      return { pattern: true, reversible: true, size: 'pants', layers: false, weather: true, neckline: null, closure: false, strap: false, care: true };
    case 'skirt':
      return { pattern: true, reversible: true, size: 'clothing', layers: false, weather: true, neckline: null, closure: false, strap: false, care: true };
    case 'outerwear':
      return { pattern: true, reversible: true, size: 'clothing', layers: true, weather: true, neckline: { label: 'Kragen', options: OUTER_COLLARS }, closure: true, strap: false, care: true };
    case 'shoe':
      return { pattern: false, reversible: false, size: 'shoe', layers: false, weather: true, neckline: null, closure: true, strap: false, care: false };
    case 'bag':
      return { pattern: true, reversible: true, size: null, layers: false, weather: false, neckline: null, closure: true, strap: true, care: false };
    case 'headwear':
      return { pattern: true, reversible: true, size: sub === 'cap' ? 'cap' : sub === 'hat' ? 'hat' : 'letters', layers: false, weather: true, neckline: null, closure: false, strap: false, care: true };
    case 'jewelry':
      return { pattern: false, reversible: false, size: (sub && JEWELRY_SIZE[sub]) || null, layers: false, weather: false, neckline: null, closure: false, strap: false, care: false };
    case 'accessory':
      return { pattern: true, reversible: true, size: !sub ? 'clothing' : ACC_NO_SIZE.has(sub) ? null : ACC_SIZE[sub] ?? 'clothing', layers: false, weather: !!sub && ACC_WEATHER.has(sub), neckline: null,
        closure: !!sub && ACC_CLOSURE.has(sub), strap: false, care: !!sub && ACC_CARE.has(sub) };
    default:
      return ALL;
  }
}

// ---------- Größen je Art ----------

const range = (a: number, b: number, step = 1) => Array.from({ length: Math.round((b - a) / step) + 1 }, (_, i) => a + i * step);
/** Deutsche Schreibweise: 7.5 → „7,5“ */
const dec = (n: number) => String(n).replace('.', ',');

export const PANTS_WAIST = range(24, 44).map((n) => `W${n}`);
export const PANTS_LENGTH = range(26, 38).map((n) => `L${n}`);
/** EU-Schuhgrößen 35–50, ganze und halbe */
export const SHOE_SIZES = range(35, 50, 0.5).map((n) => (Number.isInteger(n) ? String(n) : `${Math.floor(n)},5`));
/** EU-Schuhgrößen 35–50 mit Drittelgrößen (adidas: „42 ⅔“) */
export const SHOE_THIRDS = range(35, 50).flatMap((n) => (n === 50 ? ['50'] : [String(n), `${n} ⅓`, `${n} ⅔`]));
/** Schuhgröße als Zahl (zum Sortieren): „42,5“ → 42.5, „42 ⅔“ → 42.67 */
export function shoeValue(v: string): number {
  const m = /^(\d+)(?:,5| (⅓|⅔))?$/.exec(v);
  if (!m) return NaN;
  return Number(m[1]) + (v.includes(',5') ? 0.5 : m[2] === '⅓' ? 1 / 3 : m[2] === '⅔' ? 2 / 3 : 0);
}
/** Alle EU-Größen numerisch sortiert */
export const SHOE_ALL = [...new Set([...SHOE_SIZES, ...SHOE_THIRDS])].sort((a, b) => shoeValue(a) - shoeValue(b));
export const isShoeThird = (v: string | null | undefined) => !!v && /[⅓⅔]/.test(v);

export const CAP_ADJUSTABLE = 'Verstellbar';
/** Fitted-Größen (US, Kopfumfang) */
export const CAP_FITTED = ['6 7/8', '7', '7 1/8', '7 1/4', '7 3/8', '7 1/2', '7 5/8', '7 3/4', '7 7/8', '8'] as const;
/** Flexfit-Größen (System „flexfit“) */
export const CAP_FLEXFIT = ['S/M', 'L/XL', 'XL/XXL'] as const;
/** Ringgrößen (Innenumfang in mm, bestätigt 15.11.2026) */
export const RING_SIZES = range(48, 66).map(String);
/** Handschuh 5–12 in halben Schritten („7,5“) */
export const GLOVE_SIZES = range(5, 12, 0.5).map(dec);
/** Gürtel 70–130 cm in 5er-Schritten */
export const BELT_SIZES = range(70, 130, 5).map((n) => `${n} cm`);
/** Socke/Strumpfhose: Schuhgrößen-Bereiche (beide üblichen Einteilungen, nach Anfang sortiert) */
export const SOCK_SIZES = ['35–38', '37–39', '39–42', '40–42', '43–45', '43–46', '46–48', '47–50'] as const;
/** Hut: Kopfumfang 53–62 cm */
export const HAT_SIZES = range(53, 62).map((n) => `${n} cm`);
/** Armband 14–24 cm in halben Schritten */
export const BRACELET_SIZES = range(14, 24, 0.5).map((n) => `${dec(n)} cm`);
/** Halskette: Standardlängen */
export const NECKLACE_SIZES = [35, 38, 40, 42, 45, 50, 55, 60, 70, 80, 90].map((n) => `${n} cm`);
/** Uhr: Gehäusedurchmesser 26–50 mm */
export const WATCH_SIZES = range(26, 50).map((n) => `${n} mm`);
/** Unterwäsche, Zahlen (Schiesser-Stil, 5 = M) */
export const UNDERWEAR_NUMBERS = range(4, 9).map(String);

/** Hose ohne Länge: Shorts und Pyjama-Hose (Spec 7) */
export const pantsWaistOnly = (category: string | null | undefined, sub?: string | null) =>
  category === 'shorts' || (category === 'pants' && sub === 'pajama_pants');
/** Hose mit Konfektionsgrößen (Zahlen 44–60): Anzug- und Stoffhosen */
export const pantsNumbers = (category: string | null | undefined, sub?: string | null) =>
  category === 'pants' && sub === 'trousers';

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

/** Alle Größen-Systeme (items.size_system, Prüfung in Migration 0013) */
export type SizeSystemAny = SizeSystem | 'eu' | 'cap' | 'flexfit' | 'ring' | 'glove' | 'belt' | 'sock' | 'hat' | 'bracelet' | 'necklace' | 'watch';

/**
 * Eine Auswahl innerhalb einer Größen-Art: System, Name des Systems (Umschalter),
 * Überschrift der Werte (mit Einheit) und die Werte. W/L, EU und Kappe zeichnet SizePicker eigens.
 */
export type SizeChoice = {
  system: SizeSystemAny; name: string; field: string; values: readonly string[];
  /** Doppelgrößen als zweite Reihe (nur Buchstaben) */
  doubles?: boolean;
  /** Einheit, die in den Werten steht (Kapseln zeigen nur die Zahl) */
  unit?: 'cm' | 'mm';
};

const LETTERS: SizeChoice = { system: 'letters', name: 'Buchstaben', field: 'Größe', values: SIZES.letters, doubles: true };
const NUMBERS: SizeChoice = { system: 'numbers', name: 'Zahlen', field: 'Größe', values: SIZES.numbers };

/** Auswahlen je Größen-Art; die erste ist der Standard (außer Kleidung/Unterwäsche: ohne Vorwahl) */
export function sizeChoices(kind: SizeKind | null, category?: string | null, sub?: string | null): SizeChoice[] {
  switch (kind) {
    case null: return [];
    case 'clothing': return [LETTERS, NUMBERS];
    case 'pants': return [{ system: 'wl', name: 'W/L', field: 'Bundweite', values: PANTS_WAIST }, LETTERS, ...(pantsNumbers(category, sub) ? [NUMBERS] : [])];
    case 'shoe': return [{ system: 'eu', name: 'EU', field: 'EU-Größe', values: SHOE_ALL }];
    case 'cap': return [{ system: 'cap', name: 'Kappe', field: 'Fitted-Größe', values: [CAP_ADJUSTABLE, ...CAP_FITTED] }, { system: 'flexfit', name: 'Flexfit', field: 'Flexfit-Größe', values: CAP_FLEXFIT }];
    case 'ring': return [{ system: 'ring', name: 'Ring', field: 'Ringgröße', values: RING_SIZES }];
    case 'glove': return [{ system: 'glove', name: 'Zahlen', field: 'Größe', values: GLOVE_SIZES }, LETTERS];
    case 'belt': return [{ system: 'belt', name: 'Länge', field: 'Länge in cm', values: BELT_SIZES, unit: 'cm' }, LETTERS];
    case 'sock': return [{ system: 'sock', name: 'Bereich', field: 'Bereich (EU-Schuhgröße)', values: SOCK_SIZES }, LETTERS];
    case 'hat': return [{ system: 'hat', name: 'Kopfumfang', field: 'Kopfumfang in cm', values: HAT_SIZES, unit: 'cm' }, LETTERS];
    case 'bracelet': return [{ system: 'bracelet', name: 'Länge', field: 'Länge in cm', values: BRACELET_SIZES, unit: 'cm' }];
    case 'necklace': return [{ system: 'necklace', name: 'Länge', field: 'Länge in cm', values: NECKLACE_SIZES, unit: 'cm' }];
    case 'watch': return [{ system: 'watch', name: 'Gehäuse-Ø', field: 'Gehäuse-Ø in mm', values: WATCH_SIZES, unit: 'mm' }];
    case 'underwear': return [LETTERS, { system: 'numbers', name: 'Zahlen', field: 'Größe', values: UNDERWEAR_NUMBERS }];
    case 'letters': return [LETTERS];
  }
}
/** Gibt es bei dieser Art Buchstabengrößen? (Kategoriewechsel behält dann „M“) */
export const kindHasLetters = (kind: SizeKind | null) => sizeChoices(kind).some((c) => c.system === 'letters');
const inChoice = (c: SizeChoice, v: string) => c.values.includes(v) || (!!c.doubles && (LETTER_DOUBLES as readonly string[]).includes(v));

/** Anzeige in der Ansicht und in der eingeklappten Zeile: „Länge 95 cm“, „Kopfumfang 58 cm“, „Gehäuse-Ø 40 mm“ */
export function sizeText(system: SizeSystemAny | null | undefined, size: string | null | undefined): string | null {
  if (!size) return null;
  const prefix: Partial<Record<SizeSystemAny, string>> = { belt: 'Länge', bracelet: 'Länge', necklace: 'Länge', hat: 'Kopfumfang', watch: 'Gehäuse-Ø' };
  const p = system ? prefix[system] : undefined;
  return p && /\d\s*(cm|mm)$/.test(size) ? `${p} ${size}` : size;
}

/** Größen-System beim Laden passend zur Art bestimmen (alte Daten: Schuhe „numbers“ → EU, Jeans „W30/L34“ → W/L); unbekannt → null */
export function sizeSystemOn(kind: SizeKind | null, stored: string | null | undefined, size: string | null | undefined): SizeSystemAny | null {
  switch (kind) {
    case null: return null;
    case 'shoe': return 'eu';
    case 'ring': return 'ring';
    case 'bracelet': case 'necklace': case 'watch': return kind;
    case 'letters': return 'letters';
    case 'cap':
      return stored === 'flexfit' || (!!size && (CAP_FLEXFIT as readonly string[]).includes(size) && stored !== 'cap') ? 'flexfit' : 'cap';
    case 'pants':
      if (stored === 'letters' || sizeSystemOf(size) === 'letters') return 'letters';
      if (stored === 'numbers') return 'numbers';
      return 'wl'; // Standard bei Hosen
    case 'clothing':
      if (stored === 'letters' || stored === 'numbers') return stored;
      return sizeSystemOf(size);
    default: {
      // Handschuh, Gürtel, Socke, Hut, Unterwäsche: gespeichertes System, wenn es zur Art passt; sonst am Wert erkennen
      const choices = sizeChoices(kind);
      if (choices.some((c) => c.system === stored)) return stored as SizeSystemAny;
      if (size) return choices.find((c) => inChoice(c, size))?.system ?? null;
      return kind === 'underwear' ? null : choices[0]!.system; // neue Teile: Standard vorwählen
    }
  }
}

// ---------- Größe aus Text (KI „Infos auslesen“, Link-Import) ----------

const LETTER_ALIAS: Readonly<Record<string, string>> = {
  '2XS': 'XXS', '2XL': 'XXL', XXXL: '3XL', XXXXL: '4XL', XXXXXL: '5XL', OS: ONE_SIZE, 'ONE SIZE': ONE_SIZE, ONESIZE: ONE_SIZE,
  EINHEITSGRÖSSE: ONE_SIZE, EINHEITSGRÖßE: ONE_SIZE,
};
const PART = '(XXS|XXL|XS|XL|S|M|L)';
/** „S/M“, „S-M“, „SM“, „s–m“ → „S/M“ (nur Doppelgrößen aus der Liste) */
function letterOf(s: string): string | null {
  const one = LETTER_ALIAS[s] ?? s;
  if (SIZES.letters.includes(one)) return one;
  const m = new RegExp(`^${PART}\\s*[/\\-– ]?\\s*${PART}$`).exec(s);
  const d = m ? `${m[1]}/${m[2]}` : null;
  return d && (LETTER_DOUBLES as readonly string[]).includes(d) ? d : null;
}
/** Zahl mit Bruchteil und optionaler Einheit: „42 2/3“, „42⅔“, „42.67“, „8,5“, „95cm“, „40 mm“ */
function numOf(s: string): { n: number; unit: 'CM' | 'MM' | null } | null {
  const m = /^(\d{1,3})(?:\s*(?:[.,](\d{1,2})|(\d)\/(\d)|([½⅓⅔])))?\s*(CM|MM)?$/.exec(s);
  if (!m) return null;
  let n = Number(m[1]);
  if (m[2]) n += Number(`0.${m[2]}`);
  else if (m[3]) n += Number(m[3]) / Number(m[4]);
  else if (m[5]) n += m[5] === '½' ? 0.5 : m[5] === '⅓' ? 1 / 3 : 2 / 3;
  return { n, unit: (m[6] as 'CM' | 'MM' | undefined) ?? null };
}
const near = (a: number, b: number) => Math.abs(a - b) < 0.02;
/** Wert in der Liste? Sonst null */
const hit = (system: SizeSystemAny, list: readonly string[], v: string | null) => (v && list.includes(v) ? { system, size: v } : null);

/**
 * Freie Größenangabe (z. B. „EU 42 1/2“, „32/34“, „xl“, „S-M“, „95cm“) → Wert aus den festen Listen der Größen-Art.
 * Passt nichts, kommt null zurück – die KI schreibt nie eigene Werte in die Größe.
 */
export function matchSize(kind: SizeKind | null, raw: string | null | undefined, category?: string | null, sub?: string | null): { system: SizeSystemAny; size: string } | null {
  const s = (raw ?? '').trim().toUpperCase().replace(/^(EU|DE|GR\.?|GRÖSSE|GRÖßE|SIZE)\s*/, '').trim();
  if (!kind || !s) return null;
  const letter = letterOf(s);
  const num = numOf(s);
  const letters = letter && kindHasLetters(kind) ? { system: 'letters' as const, size: letter } : null;
  const whole = num && Number.isInteger(num.n) ? num.n : null;
  switch (kind) {
    case 'shoe': {
      if (!num || num.unit) return null;
      const base = Math.floor(num.n + 0.01), f = num.n - base;
      const v = near(f, 0) ? String(base) : near(f, 0.5) ? `${base},5` : near(f, 1 / 3) || near(f, 0.33) ? `${base} ⅓` : near(f, 2 / 3) || near(f, 0.67) ? `${base} ⅔` : null;
      return hit('eu', SHOE_ALL, v);
    }
    case 'cap': {
      if (letter && (CAP_FLEXFIT as readonly string[]).includes(letter)) return { system: 'flexfit', size: letter };
      const v = capSize(letter === ONE_SIZE ? ONE_SIZE : s);
      return v ? { system: 'cap', size: v } : null;
    }
    case 'ring':
      return hit('ring', RING_SIZES, num && !num.unit && whole != null ? String(whole) : null);
    case 'glove':
      return letters ?? hit('glove', GLOVE_SIZES, num && !num.unit ? dec(num.n) : null);
    case 'belt':
      return letters ?? hit('belt', BELT_SIZES, num && num.unit !== 'MM' && whole != null ? `${whole} cm` : null);
    case 'hat':
      return letters ?? hit('hat', HAT_SIZES, num && num.unit !== 'MM' && whole != null ? `${whole} cm` : null);
    case 'bracelet':
      return hit('bracelet', BRACELET_SIZES, num && num.unit !== 'MM' ? `${dec(num.n)} cm` : null);
    case 'necklace':
      return hit('necklace', NECKLACE_SIZES, num && num.unit !== 'MM' && whole != null ? `${whole} cm` : null);
    case 'watch':
      return hit('watch', WATCH_SIZES, num && num.unit !== 'CM' && whole != null ? `${whole} mm` : null);
    case 'sock': {
      if (letters) return letters;
      const m = /^(\d{2})\s*[-–/]\s*(\d{2})$/.exec(s);
      return hit('sock', SOCK_SIZES, m ? `${m[1]}–${m[2]}` : null);
    }
    case 'underwear':
      return letters ?? hit('numbers', UNDERWEAR_NUMBERS, num && !num.unit && whole != null ? String(whole) : null);
    case 'letters':
      return letters;
    case 'pants': {
      if (letters) return letters;
      if (pantsNumbers(category, sub) && SIZES.numbers.includes(s)) return { system: 'numbers', size: s };
      const m = /^W?\s*(\d{2})(?:\s*[/X ]\s*L?\s*(\d{2}))?$/.exec(s);
      if (!m) return null;
      const w = `W${m[1]}`, l = m[2] && !pantsWaistOnly(category, sub) ? `L${m[2]}` : null;
      if (!PANTS_WAIST.includes(w) || (l && !PANTS_LENGTH.includes(l))) return null;
      return { system: 'wl', size: composeWL(w, l)! };
    }
    case 'clothing':
      if (letters) return letters;
      return SIZES.numbers.includes(s) ? { system: 'numbers', size: s } : null;
  }
}

// ---------- Lagen-Vorgabe je Unterkategorie (Max, 20.11.2026) ----------

/** 0 Basis · 1 Mittellage · 2 Offen darüber · 3 Außen. Fehlt ein Eintrag, gilt die Vorgabe der Kategorie (LAYER_BY_CATEGORY). */
const LAYER_BY_SUB: Readonly<Record<string, readonly number[]>> = {
  // Oberteil
  shirt: [0, 1, 2], blouse: [0, 1], sweatshirt: [1], hoodie: [1], sweater: [1], sweater_vest: [1], other: [],
  // Oberbekleidung
  // Einteilung der Jacken (Max, 21.11.2026): Außen = über einen Pullover, schützt vor Kälte/Wind/Regen;
  // leichte Übergangsjacken offen darüber oder außen; wie ein Pullover getragen = Mittellage + offen darüber
  blazer: [2], vest: [2], cardigan: [1, 2], sweat_jacket: [1, 2], overshirt: [2, 3], trucker_jacket: [2, 3], bolero: [2],
  blouson: [2, 3], varsity_jacket: [2, 3], coach_jacket: [2, 3], field_jacket: [2, 3],
  coat: [3], trench_coat: [3], parka: [3], puffer_jacket: [3], shearling_jacket: [3], biker_jacket: [3], sports_jacket: [3],
};
/** Vorgabe nach Typ (vor der Unterkategorie) */
const LAYER_BY_TYPE: Readonly<Record<string, readonly number[]>> = {
  suit_vest: [1], knit_vest: [1], puffer_vest: [3], poncho: [3], cape: [3], robe: [],
  // Sportjacken (Max, 21.11.2026): Trainingsjacke wie Sweatjacke, Windbreaker als Übergangsjacke
  track_jacket: [1, 2], windbreaker: [2, 3], anorak: [3], rain_jacket: [3], thermal_jacket: [3],
};
const LAYER_BY_CATEGORY: Readonly<Record<string, readonly number[]>> = { top: [0], outerwear: [3], dress: [0] };

/** Vorgabe der Lagen für einen Kategorie-Pfad; Kategorien ohne Lagen → [] */
export function defaultLayers(category: string | null | undefined, sub?: string | null, type?: string | null): number[] {
  if (!category || !fieldsFor(category, sub).layers) return [];
  const own = (type ? LAYER_BY_TYPE[type] : undefined) ?? (category !== 'dress' && sub ? LAYER_BY_SUB[sub] : undefined) ?? LAYER_BY_CATEGORY[category] ?? [];
  return [...own];
}
/** Lagen eines Teils: gespeicherte, sonst die Vorgabe der Kategorie */
export const layersOf = (i: { category: string | null; subcategory?: string | null; item_type?: string | null; type?: string | null; layers?: readonly number[] | null }): number[] =>
  i.layers?.length ? [...i.layers] : defaultLayers(i.category, i.subcategory, i.item_type ?? i.type);
