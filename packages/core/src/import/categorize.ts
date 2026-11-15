// Altdaten → neue Kategorie-Liste (Spec 8, „Umstellung vorhandener Teile“).
// Nur eindeutige Fälle bekommen eine Unterkategorie bzw. einen Typ; der Rest wird als `sure: false` gemeldet
// und Max zum Nachsehen gezeigt (nicht raten). Wird auch beim frischen Import aus dem alten Valet benutzt.

import { CATEGORY_NAMES, isValidPath, type CategoryPath } from '../categories';
import { LEGACY_COLORS, MATERIALS } from '../attributes';

export type LegacyInput = { category: string | null; name: string; desc?: string | null; brand?: string | null };
export type LegacyResult = CategoryPath & {
  /** true = eindeutig; false = nur Kategorie sicher (oder gar nichts) → Liste für Max */
  sure: boolean;
  /** Material, das im alten Namen steckte (Flanell, Fleece, Daunen …) */
  material?: string;
  /** Länge (Rock/Kleid), falls im alten Namen (Mini/Midi/Maxi) */
  fitLength?: number;
};

type Rule = { re: RegExp; path: [string, string?, string?]; material?: string };
const r = (re: RegExp, cat: string, sub?: string, type?: string, material?: string): Rule => ({ re, path: [cat, sub, type], material });

// Reihenfolge zählt: erste passende Regel gewinnt.
const TOPS: Rule[] = [
  r(/(hoodie|kapuze).*(zip|reißverschluss|reissverschluss)|(zip|reißverschluss|reissverschluss).*(hoodie|kapuze)/, 'Oberbekleidung', 'Sweatjacke', 'Zip-Hoodie'),
  r(/sweat\w*.*(reißverschluss|reissverschluss)|sweatjacke|zip-sweat/, 'Oberbekleidung', 'Sweatjacke'),
  r(/strickjacke|cardigan|knit jacket/, 'Oberbekleidung', 'Strickjacke'),
  r(/hemdjacke|overshirt/, 'Oberbekleidung', 'Hemdjacke'),
  r(/hoodie|kapuzenpullover/, 'Oberteil', 'Kapuzenpullover'),
  r(/sweatshirt|crewneck/, 'Oberteil', 'Sweatshirt'),
  r(/polo/, 'Oberteil', 'Polohemd'),
  r(/pullover|sweater|strickpulli/, 'Oberteil', 'Pullover'),
  r(/flannel|flanell/, 'Oberteil', 'Hemd', undefined, 'Flanell'),
  r(/kurzarmhemd/, 'Oberteil', 'Hemd', 'Kurzarmhemd'),
  r(/langarmhemd/, 'Oberteil', 'Hemd', 'Langarmhemd'),
  r(/henley.*(longsleeve|langarm|langärm)|(longsleeve|langarm|langärm).*henley/, 'Oberteil', 'Langarmshirt', 'Henley-Langarmshirt'),
  r(/henley/, 'Oberteil', 'T-Shirt', 'Henley-T-Shirt'),
  r(/\bhemd\b|kentkragen|klassischer kragen|button-down/, 'Oberteil', 'Hemd'),
  r(/bluse/, 'Oberteil', 'Bluse'),
  r(/tank|ärmellos|sleeveless/, 'Oberteil', 'Ärmelloses Shirt'),
  r(/crop top/, 'Oberteil', 'Crop Top'),
  r(/longsleeve|langarm|langärm/, 'Oberteil', 'Langarmshirt'),
  r(/t-shirt|tshirt|\btee\b|kurzarm/, 'Oberteil', 'T-Shirt'),
  r(/trikot|funktionsshirt|sport-bh/, 'Oberteil', 'Sporttop'),
];
const JACKETS: Rule[] = [
  r(/trench/, 'Oberbekleidung', 'Trenchcoat'),
  r(/parka/, 'Oberbekleidung', 'Parka'),
  r(/peacoat|pea coat|caban/, 'Oberbekleidung', 'Mantel', 'Peacoat'),
  r(/shearling|lammfell/, 'Oberbekleidung', 'Shearlingjacke'),
  r(/bomber/, 'Oberbekleidung', 'Blouson', 'Bomberjacke'),
  r(/harrington/, 'Oberbekleidung', 'Blouson', 'Harrington-Jacke'),
  r(/varsity|college/, 'Oberbekleidung', 'Collegejacke'),
  r(/track|trainingsjacke/, 'Oberbekleidung', 'Sportjacke', 'Trainingsjacke'),
  r(/windbreaker/, 'Oberbekleidung', 'Sportjacke', 'Windbreaker'),
  r(/regenjacke/, 'Oberbekleidung', 'Sportjacke', 'Regenjacke'),
  r(/anorak/, 'Oberbekleidung', 'Sportjacke', 'Anorak'),
  r(/overshirt|hemdjacke/, 'Oberbekleidung', 'Hemdjacke'),
  r(/puffer|stepp|daunen/, 'Oberbekleidung', 'Steppjacke'),
  r(/fleece/, 'Oberbekleidung', 'Sweatjacke', undefined, 'Fleece'),
  r(/blazer/, 'Oberbekleidung', 'Blazer'),
  r(/weste|gilet/, 'Oberbekleidung', 'Weste'),
  r(/trucker|jeansjacke|denim jacket/, 'Oberbekleidung', 'Truckerjacke'),
  r(/biker/, 'Oberbekleidung', 'Bikerjacke'),
  r(/coach/, 'Oberbekleidung', 'Coachjacke'),
  r(/feldjacke|field jacket/, 'Oberbekleidung', 'Feldjacke'),
  r(/strickjacke|cardigan|knit jacket/, 'Oberbekleidung', 'Strickjacke'),
  r(/blouson/, 'Oberbekleidung', 'Blouson'),
];
const PANTS: Rule[] = [
  r(/jogger|jogginghose|sweatpants|trainingshose/, 'Hose', 'Jogginghose'),
  r(/cargo/, 'Hose', 'Cargohose'),
  r(/jeans|denim/, 'Hose', 'Jeans'),
  r(/leggings/, 'Hose', 'Leggings'),
  r(/latzhose/, 'Hose', 'Latzhose'),
  r(/chino/, 'Hose', 'Stoffhose', 'Chino'),
  r(/bundfalten|pleated/, 'Hose', 'Stoffhose', 'Bundfaltenhose'),
  r(/anzughose|dress pants|stoffhose/, 'Hose', 'Stoffhose'),
];
const SHORTS: Rule[] = [
  r(/bermuda/, 'Hose', 'Shorts', 'Bermudashorts'),
  r(/cargo/, 'Hose', 'Shorts', 'Cargoshorts'),
  r(/.*/, 'Hose', 'Shorts'),
];
const SHOES: Rule[] = [
  r(/loafer/, 'Schuh', 'Halbschuh', 'Loafer'),
  r(/oxford/, 'Schuh', 'Halbschuh', 'Oxford-Schuh'),
  r(/derby/, 'Schuh', 'Halbschuh', 'Derby-Schuh'),
  r(/chelsea/, 'Schuh', 'Stiefel', 'Chelsea Boot'),
  r(/desert boot/, 'Schuh', 'Stiefel', 'Desert Boot'),
  r(/(stiefel|boot).*schnürung|schnürung.*(stiefel|boot)|timberland/, 'Schuh', 'Stiefel', 'Schnürboot'),
  r(/stiefel|\bboots?\b/, 'Schuh', 'Stiefel'),
  // Asics-Modelle zählen als Laufschuh (entschieden 15.11.2026)
  r(/\bgel[- ]|kayano|\bgt-\d/, 'Schuh', 'Sportschuh', 'Laufschuh'),
  r(/laufschuh/, 'Schuh', 'Sportschuh', 'Laufschuh'),
  r(/high-top|hoher sneaker|chuck taylor/, 'Schuh', 'Sneaker', 'High-Top-Sneaker'),
  r(/low-top|niedrig\w* (schaft|sneaker)|flacher\w* (low-top-)?sneaker/, 'Schuh', 'Sneaker', 'Low-Top-Sneaker'),
  r(/sneaker|samba|speedcat|air force|skateschuh/, 'Schuh', 'Sneaker'),
  r(/birkenstock.*boston|\bclog/, 'Schuh', 'Clog'),
  r(/sandale/, 'Schuh', 'Sandale'),
];
const BAGS: Rule[] = [
  r(/weekender|weekend bag/, 'Tasche', 'Reisetasche', 'Weekender'),
  r(/duffel/, 'Tasche', 'Reisetasche', 'Duffel-Bag'),
  r(/tote|shopper/, 'Tasche', 'Handtasche', 'Shopper'),
  r(/hobo/, 'Tasche', 'Handtasche', 'Hobo-Bag'),
  r(/rucksack|backpack/, 'Tasche', 'Rucksack'),
  r(/bauchtasche|belt bag|gürteltasche/, 'Tasche', 'Bauchtasche'),
  r(/kosmetik|cosmetic/, 'Tasche', 'Sonstiges'),
  r(/clutch/, 'Tasche', 'Clutch'),
];
const ACCESSORIES: Rule[] = [
  r(/\bcap\b|kappe|basecap/, 'Kopfbedeckung', 'Kappe'),
  r(/beanie|mütze/, 'Kopfbedeckung', 'Mütze'),
  r(/bucket hat/, 'Kopfbedeckung', 'Hut', 'Bucket Hat'),
  r(/sonnenbrille|sunglass/, 'Accessoire', 'Brille', 'Sonnenbrille'),
  r(/brille|glasses/, 'Accessoire', 'Brille'),
  r(/gürtel|belt/, 'Accessoire', 'Gürtel'),
  r(/uhr|watch|chronograph/, 'Schmuck', 'Uhr'),
  r(/armband|bracelet/, 'Schmuck', 'Armband'),
  r(/halskette|kette|necklace|amulett|medaillon/, 'Schmuck', 'Halskette'),
  r(/ohrring|earring/, 'Schmuck', 'Ohrring'),
  r(/\bring\b/, 'Schmuck', 'Ring'),
  r(/handschuh|gloves?/, 'Accessoire', 'Handschuh'),
  r(/schal|scarf/, 'Accessoire', 'Schal'),
  r(/socke|socks?\b/, 'Accessoire', 'Socke'),
  r(/krawatte|fliege|einstecktuch/, 'Accessoire', 'Anzug-Accessoire'),
];

/** Alte Kategorie → (sichere Oberkategorie | null, Regeln) */
const OLD: Record<string, [string | null, Rule[]]> = {
  oberteil: ['Oberteil', TOPS], pullover: ['Oberteil', TOPS], sport: ['Oberteil', TOPS],
  hose: ['Hose', PANTS], shorts: ['Hose', SHORTS],
  jacke: ['Oberbekleidung', JACKETS], mantel: ['Oberbekleidung', [r(/trench/, 'Oberbekleidung', 'Trenchcoat'), r(/parka/, 'Oberbekleidung', 'Parka'), r(/peacoat|pea coat|caban/, 'Oberbekleidung', 'Mantel', 'Peacoat'), r(/.*/, 'Oberbekleidung', 'Mantel')]],
  schuhe: ['Schuh', SHOES], tasche: ['Tasche', BAGS], accessoire: [null, ACCESSORIES], sonstiges: [null, [...ACCESSORIES, ...BAGS]],
};

const EXTRA_MATERIAL: [RegExp, string][] = [[/flannel|flanell/, 'Flanell'], [/fleece/, 'Fleece'], [/daunen|\bdown\b/, 'Daunen'], [/\bpelz|\bfur\b/, 'Pelz'], [/lammfell/, 'Lammfell']];

export function categorizeLegacy(i: LegacyInput): LegacyResult {
  const old = (i.category ?? '').toLowerCase();
  const t = `${i.brand ?? ''} ${i.name} ${i.desc ?? ''}`.toLowerCase();
  // Schon neu?
  if (CATEGORY_NAMES.includes(i.category ?? '')) return { category: i.category, subcategory: null, type: null, sure: true };
  // Röcke und Kleider aus dem Namen (im alten Valet gab es keine eigene Kategorie)
  const skirt = /(mini|midi|maxi)rock|(mini|midi|maxi)[- ]skirt/.exec(t);
  if (skirt) return { category: 'Rock', subcategory: null, type: null, sure: true, fitLength: { mini: 0, midi: 3, maxi: 4 }[skirt[1] ?? skirt[2] ?? 'midi'] };
  const [safe, rules] = OLD[old] ?? [null, []];
  const hit = rules.find((x) => x.re.test(t));
  const material = hit?.material ?? EXTRA_MATERIAL.find(([re]) => re.test(t))?.[1];
  if (hit) {
    const [category, subcategory = null, type = null] = hit.path;
    const p = { category, subcategory, type };
    if (isValidPath(p)) return { ...p, sure: true, ...(material ? { material } : {}) };
  }
  return { category: safe, subcategory: null, type: null, sure: false, ...(material ? { material } : {}) };
}

// ---------- Material ----------

const MATERIAL_SYNONYMS: Record<string, string> = {
  wollmischung: 'Wolle', baumwollmischung: 'Baumwolle', 'baumwoll-fleece': 'Baumwolle', lackleder: 'Leder', silber: 'Metall', gold: 'Metall',
  acetat: 'Kunststoff/Gummi', canvas: 'Baumwolle', funktionsstoff: 'Polyester', polyestermix: 'Polyester', 'beschichtetes polyester': 'Polyester',
  twill: '', mix: '', mischgewebe: '', strick: '', vermutet: '', jersey: 'Baumwolle', cotton: 'Baumwolle', wool: 'Wolle', leather: 'Leder',
};
const known = new Map(MATERIALS.map((m) => [m.toLowerCase(), m] as const));

/** Alter Materialtext („Wolle und Leder“, „Polyester / Kunstleder (Mix)“) → Liste in Reihenfolge, ohne Doppelte */
export function parseLegacyMaterial(s: string | null | undefined): string[] {
  const out: string[] = [];
  const add = (m: string | undefined) => { if (m && !out.includes(m)) out.push(m); };
  const whole = (s ?? '').trim().toLowerCase();
  if (!whole) return out;
  if (known.has(whole)) return [known.get(whole)!];
  if (MATERIAL_SYNONYMS[whole] !== undefined) return MATERIAL_SYNONYMS[whole] ? [MATERIAL_SYNONYMS[whole]!] : [];
  for (const raw of whole.split(/[\/,()]|\bund\b|\+/)) {
    const w = raw.trim();
    if (!w) continue;
    if (known.has(w)) add(known.get(w));
    else if (MATERIAL_SYNONYMS[w] !== undefined) add(MATERIAL_SYNONYMS[w] || undefined);
    else for (const part of w.split(/\s+/)) add(known.get(part) ?? (MATERIAL_SYNONYMS[part] || undefined));
  }
  return out;
}

// ---------- Farben ----------

const luma = (hex: string) => {
  const v = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255);
  return 0.2126 * v[0]! + 0.7152 * v[1]! + 0.0722 * v[2]!;
};

/**
 * Alter Farbtext („Schwarz/Weiß“) → neue Palette, höchstens 3, ohne Doppelte.
 * „Grau“ gibt es nicht mehr: nach der Helligkeit des Fotos (Hauptfarbe der Farbanalyse) Hellgrau oder Dunkelgrau;
 * ohne Foto-Farbe bleibt es offen (unclear).
 */
export function parseLegacyColors(s: string | null | undefined, photoHex?: string | null): { colors: string[]; unclear: string[] } {
  const colors: string[] = [], unclear: string[] = [];
  for (const raw of (s ?? '').split(/[\/,]/)) {
    const w = raw.trim().toLowerCase();
    if (!w) continue;
    let c: string | undefined = LEGACY_COLORS[w];
    if (w === 'grau') c = photoHex && /^#[0-9a-f]{6}$/i.test(photoHex) ? (luma(photoHex) >= 0.5 ? 'Hellgrau' : 'Dunkelgrau') : undefined;
    if (!c) { unclear.push(raw.trim()); continue; }
    if (!colors.includes(c) && colors.length < 3) colors.push(c);
  }
  return { colors, unclear };
}

/**
 * Kategorie-Pfad beim Laden: neue Daten unverändert, alte (Kategorie-IDs wie „oberteil“) über die Regeln.
 * So läuft die App schon vor der einmaligen Umstellung (Migration 0007) mit beiden Formaten.
 */
export function normalizeCategory(i: { category: string | null; subcategory?: string | null; item_type?: string | null; name?: string | null; brand?: string | null }): CategoryPath {
  if (!i.category || CATEGORY_NAMES.includes(i.category)) return { category: i.category ?? null, subcategory: i.subcategory ?? null, type: i.item_type ?? null };
  const r = categorizeLegacy({ category: i.category, name: i.name ?? '', brand: i.brand });
  return { category: r.category, subcategory: r.subcategory, type: r.type };
}
