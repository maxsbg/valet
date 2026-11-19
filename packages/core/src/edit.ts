// Bearbeiten-Seite (auch „Neues Teil prüfen“) – Formular-Modell (VALET_DETAILSEITE_SPEC.md, Abschnitte 7 und 7a)
// Plattformunabhängig: Laden aus der Datenbank-Zeile, Ändern, Prüfen, zurück in eine Datenbank-Änderung.

import { isValidPath, type FitScale } from './categories';
import { fitFromName, nameFitFor } from './fitName';
import { COLLAR_LIST, CLOSURES, MAX_COLORS, ONE_SIZE, PATTERNS, colorLabel, materialLabel, migrateSeasons, styleLabel, toColorKeys, toMaterialParts, toStyleKeys, type Care, type MaterialPart } from './attributes';
import { toKey } from './keys';
import { normalizeCategory } from './import/categorize';
import { capSize, fieldsFor, kindHasLetters, sizeSystemOn, STRAPS, type SizeSystemAny } from './fields';
import { equalSplit, formatPrice, parseAmount, splitGap } from './money';
import { isWishTag, type WishTag } from './tile';
import { checkConfidence, emptyConfidence, readProfile, type AiMeta, type Confidence, type Profile } from './ai/profile';
import { ORIGIN_RANK, originOf, originsOf } from './ai/origin';

/** Spalten der Tabelle items, die das Formular liest (Teilmenge, alles optional) */
export type EditRow = Partial<{
  name: string; brand: string | null; category: string | null; subcategory: string | null; item_type: string | null;
  seasons: string[] | null; colors: string[] | null; colors_b: string[] | null; pattern: string | null; pattern_b: string | null;
  materials: MaterialPart[] | null; size: string | null; size_system: string | null; collar_size: string | null;
  fit_width: number | null; fit_length: number | null; fit_rise: number | null; layers: number[] | null; standalone: boolean | null;
  warmth: number | null; rain: number | null; styles: string[] | null; collar: string | null; closure: string | null; strap: string | null; care: Care | null;
  reversible: boolean | null; notes: string | null;
  price_paid: number | null; list_price: number | null; is_gift: boolean | null; gift_from: string | null; gift_value: number | null;
  purchase_date: string | null; shop: string | null; link: string | null; article_no: string | null;
  payers: { person_id?: string | null; amount?: number | null }[] | null;
  owner_ids: string[] | null; owner_id: string | null; qty: number | null;
  is_wish: boolean | null; wishlist_id: string | null; wish_tag: string | null; buy_on: string | null; wish_price: number | null;
  ai_pending: string[] | null;
  /** KI-Analyse (jsonb): Altdaten aus dem Import (vdesc, matInfo, extra …) + profile/confidence/meta (Analyse v2, Spec 6.6) */
  analysis: Record<string, unknown> | null;
}>;

export type SplitMode = 'equal' | 'custom';

export type EditForm = {
  name: string; brand: string;
  category: string | null; subcategory: string | null; type: string | null;
  seasons: string[]; colors: string[]; colorsB: string[]; pattern: string | null; patternB: string | null;
  materials: MaterialPart[]; sizeSystem: SizeSystemAny | null; size: string | null; collarSize: string | null;
  fit: { width: number | null; length: number | null; rise: number | null };
  layers: number[]; standalone: boolean; warmth: number | null; rain: number | null;
  styles: string[]; collar: string | null; closure: string | null; strap: string | null; care: Care;
  reversible: boolean; notes: string;
  // Kauf (Preise als Text, wie getippt)
  price: string; listPrice: string; gift: boolean; giftFrom: string; giftValue: string;
  purchaseDate: string | null; shop: string; link: string; articleNo: string;
  payers: string[]; splitMode: SplitMode; amounts: Record<string, string>;
  // Besitz
  owners: string[]; qty: number;
  // Wunschteil
  isWish: boolean; wishlistId: string | null; wishTag: WishTag | null; buyOn: string | null;
  /** von der KI vorausgefüllt, noch nicht bestätigt (nur Steckbrief, nie profile.*) */
  aiPending: string[];
  // KI-Profil (Analyse v2, Spec 6.4/6.6)
  profile: Profile; confidence: Confidence;
  /** gesetzt, wenn in dieser Sitzung eine Analyse lief; sonst bleibt das gespeicherte meta */
  aiMeta: AiMeta | null;
  /** ganzes items.analysis beim Laden (Altschlüssel bleiben beim Speichern erhalten); neues Teil = {} */
  analysisBase: Record<string, unknown>;
};

const eur = (n: number | null | undefined) => (n == null ? '' : n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

export function emptyEditForm(opts: { ownerId?: string | null; wish?: { wishlistId: string | null } } = {}): EditForm {
  return toEditForm({ owner_ids: opts.ownerId ? [opts.ownerId] : [], is_wish: !!opts.wish, wishlist_id: opts.wish?.wishlistId ?? null });
}

/** Datenbank-Zeile → Formular. Liest tolerant: Keys, deutsche Labels und Altwerte werden zu Keys (toKey). */
export function toEditForm(r: EditRow): EditForm {
  const path = normalizeCategory({ category: r.category || null, subcategory: r.subcategory, item_type: r.item_type, name: r.name, brand: r.brand });
  const sizeKind = fieldsFor(path.category, path.subcategory).size;
  const payers = (r.payers ?? []).filter((p) => !!p?.person_id);
  const custom = payers.length > 1 && payers.some((p) => typeof p.amount === 'number');
  const owners = r.owner_ids?.length ? r.owner_ids : r.owner_id ? [r.owner_id] : [];
  return {
    name: r.name ?? '', brand: r.brand ?? '',
    category: path.category, subcategory: path.subcategory, type: path.type,
    seasons: migrateSeasons(r.seasons), colors: toColorKeys(r.colors), colorsB: toColorKeys(r.colors_b),
    pattern: toKey(PATTERNS, r.pattern), patternB: toKey(PATTERNS, r.pattern_b),
    materials: toMaterialParts(r.materials), sizeSystem: sizeSystemOn(sizeKind, r.size_system, r.size), size: sizeKind === 'cap' ? capSize(r.size) ?? (r.size || null) : r.size || null,
    collarSize: r.collar_size ?? null,
    fit: { width: r.fit_width ?? null, length: r.fit_length ?? null, rise: r.fit_rise ?? null },
    layers: r.layers ?? [], standalone: !!r.standalone, warmth: r.warmth ?? null, rain: r.rain ?? null,
    styles: toStyleKeys(r.styles), collar: toKey(COLLAR_LIST, r.collar), closure: toKey(CLOSURES, r.closure), strap: toKey(STRAPS, r.strap), care: r.care ?? {},
    reversible: !!r.reversible, notes: r.notes ?? '',
    price: eur(r.price_paid), listPrice: eur(r.list_price), gift: !!r.is_gift, giftFrom: r.gift_from ?? '', giftValue: eur(r.gift_value),
    purchaseDate: r.purchase_date ?? null, shop: r.shop ?? '', link: r.link ?? '', articleNo: r.article_no ?? '',
    // ohne Zahler: die Besitzer (wie bisher in der Statistik)
    payers: payers.length ? payers.map((p) => p.person_id!) : owners.slice(),
    splitMode: custom ? 'custom' : 'equal',
    amounts: custom ? Object.fromEntries(payers.map((p) => [p.person_id!, eur(p.amount ?? 0)])) : {},
    owners, qty: Math.max(1, Math.round(Number(r.qty) || 1)),
    isWish: !!r.is_wish, wishlistId: r.wishlist_id ?? null, wishTag: isWishTag(r.wish_tag) ? r.wish_tag : null, buyOn: r.buy_on ?? null,
    aiPending: r.ai_pending ?? [],
    ...readAnalysis(r.analysis),
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** items.analysis → Profil, Konfidenz und das ganze Objekt (fehlt → leeres Profil, {}) */
function readAnalysis(a: unknown): Pick<EditForm, 'profile' | 'confidence' | 'aiMeta' | 'analysisBase'> {
  const base = isObj(a) ? a : {};
  return { profile: readProfile(base.profile), confidence: isObj(base.confidence) ? checkConfidence(base.confidence) : emptyConfidence(), aiMeta: null, analysisBase: base };
}

/**
 * Neues items.analysis: alle Altschlüssel (vdesc, matInfo, extra …) bleiben, profile und confidence werden ersetzt,
 * meta nur, wenn eine neue Analyse lief (sonst bleibt das gespeicherte meta unverändert).
 */
export function mergeAnalysis(base: Record<string, unknown> | null | undefined, profile: Profile, confidence: Confidence, meta: AiMeta | null): Record<string, unknown> {
  return { ...(isObj(base) ? base : {}), profile, confidence, ...(meta ? { meta } : {}) };
}

/** analysis.src (Herkunft offener KI-Werte) beim Speichern auf die noch offenen Felder kürzen; leer → weg */
function withPendingSrc(f: Pick<EditForm, 'analysisBase' | 'aiPending'>): Record<string, unknown> {
  const base = f.analysisBase;
  if (!isObj(base) || !('src' in base)) return base;
  const { src, ...rest } = base;
  const pending = new Set(f.aiPending);
  const kept = isObj(src) ? Object.fromEntries(Object.entries(src).filter(([k]) => pending.has(k.split('.')[0]!))) : {};
  return Object.keys(kept).length ? { ...rest, src: kept } : rest;
}

// ---------- Ändern ----------

/** Feld ändern; eine KI-Markierung dieses Felds verschwindet (Spec 7) */
export function setField<K extends keyof EditForm>(f: EditForm, k: K, v: EditForm[K]): EditForm {
  return { ...f, [k]: v, aiPending: f.aiPending.filter((x) => x !== k && !x.startsWith(`${String(k)}.`)) };
}
/** Kategorie ändern: Pfad setzen und das Größen-System an die neue Art anpassen (z. B. Hose → W/L, Schuh → EU) */
export function setCategory(f: EditForm, p: { category: string | null; subcategory: string | null; type: string | null }): EditForm {
  const before = fieldsFor(f.category, f.subcategory).size, after = fieldsFor(p.category, p.subcategory).size;
  let next = setField(setField(setField(f, 'category', p.category), 'subcategory', p.subcategory), 'type', p.type);
  if (before === after) return next;
  // Buchstabengröße passt auch zur neuen Art (Kleidung ↔ Hose, Handschuh, Mütze …): bleibt stehen (Max, 15.11.2026).
  // Sonst Größe leeren; W/L ist bei Hosen nur vorgewählt, wenn keine Größe gesetzt ist.
  const keepLetters = f.sizeSystem === 'letters' && !!f.size && kindHasLetters(after);
  return keepLetters ? { ...next, sizeSystem: 'letters' } : { ...next, sizeSystem: sizeSystemOn(after, null, null), size: null };
}

/** Passform noch offen: leer oder nur unbestätigt vorgeschlagen (vom Nutzer bestätigte Passform bleibt immer) */
export const fitOpen = (f: Pick<EditForm, 'fit' | 'aiPending'>): boolean =>
  (f.fit.width == null && f.fit.length == null && f.fit.rise == null) || f.aiPending.includes('fit');

/**
 * Shop-Begriffe im Namen („Slim“, „Oversized“, „Wide Leg“ …) → Passform, als unbestätigt markiert ('fit' in aiPending).
 * Nur wenn `open` (Passform vorher leer oder unbestätigt) und der Name für die Kategorie etwas hergibt.
 */
export function suggestFitFromName(f: EditForm, open: boolean = fitOpen(f)): EditForm {
  if (!open) return f;
  // Rang je Stufe (Spec 6.7): Begriffe im Namen ersetzen nur Stufen, die Shop oder Etikett nicht selbst nennen
  const origins = originsOf(f);
  const part = Object.fromEntries(Object.entries(nameFitFor(f.category, fitFromName(f.name).fit))
    .filter(([k]) => f.fit[k as keyof EditForm['fit']] == null || !f.aiPending.includes('fit') || ORIGIN_RANK[originOf(origins, `fit.${k}`)] <= ORIGIN_RANK.name));
  if (Object.keys(part).length === 0) return f;
  const src = { ...(isObj(f.analysisBase.src) ? f.analysisBase.src : {}), ...Object.fromEntries(Object.keys(part).map((k) => [`fit.${k}`, 'name'])) };
  return {
    ...f, fit: { ...f.fit, ...part }, aiPending: f.aiPending.includes('fit') ? f.aiPending : [...f.aiPending, 'fit'],
    analysisBase: { ...f.analysisBase, src },
  };
}

/** Name ändern (Bearbeiten): enthält er einen Passform-Begriff, wird die Passform nur vorgeschlagen, nie still überschrieben */
export function setName(f: EditForm, name: string): EditForm {
  return suggestFitFromName(setField(f, 'name', name), fitOpen(f));
}

/** KI-Vorschlag bestätigen (Wert bleibt) */
export const confirmAi = (f: EditForm, k: string): EditForm => ({ ...f, aiPending: f.aiPending.filter((x) => x !== k) });
/** Alle KI-Vorschläge übernehmen (Knopf „Alle übernehmen“): danach gelten sie als bestätigt (Spec 7, Detailseite) */
export const confirmAllAi = (f: EditForm): EditForm => ({ ...f, aiPending: [] });

/** Mehrfachauswahl: an/aus (Reihenfolge = Reihenfolge der Wahl) */
export const toggleIn = <T>(list: readonly T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
/** Einfachauswahl: erneut tippen hebt auf */
export const pickOne = <T>(cur: T | null, v: T): T | null => (cur === v ? null : v);

/** Material: mehrfach mit Rang (Reihenfolge), 1 = Hauptmaterial; Prozent bleiben erhalten */
export function toggleMaterial(list: readonly MaterialPart[], name: string): MaterialPart[] {
  return list.some((m) => m.name === name) ? list.filter((m) => m.name !== name) : [...list, { name }];
}
export const materialRank = (list: readonly MaterialPart[], name: string) => list.findIndex((m) => m.name === name) + 1;

/** Größe antippen: Wert samt System setzen; erneut tippen hebt auf (System bleibt) */
export function pickSize(f: EditForm, system: SizeSystemAny, size: string | null): EditForm {
  return setField(setField(f, 'sizeSystem', system), 'size', size);
}

/** Größe: Systemwechsel setzt die Größe zurück (One Size bleibt) */
export function pickSizeSystem(f: EditForm, s: SizeSystemAny): EditForm {
  const next = f.sizeSystem === s ? null : s;
  return setField({ ...f, size: f.size === ONE_SIZE ? ONE_SIZE : null }, 'sizeSystem', next);
}

/** Skalen-Stufe antippen; erneut tippen hebt auf */
export function pickFit(f: EditForm, key: FitScale['key'], step: number): EditForm {
  return setField(f, 'fit', { ...f.fit, [key]: f.fit[key] === step ? null : step });
}
/** Stufe (Wärme 0–3, Regen 0–2): erneut tippen hebt auf */
export const pickLevel = (cur: number | null, step: number) => (cur === step ? null : step);

/** Farben: höchstens 3 */
export const colorsFull = (list: readonly string[]) => list.length >= MAX_COLORS;

/** Zahler an/aus; mindestens einer bleibt */
export function togglePayer(f: EditForm, personId: string): EditForm {
  const next = toggleIn(f.payers, personId);
  return next.length ? setField(f, 'payers', next) : f;
}

// ---------- Kauf: Aufteilung ----------

/** Gesamtbetrag (Preis je Stück × Anzahl) – Grundlage der Aufteilung */
export function totalOf(f: Pick<EditForm, 'price' | 'qty'>): number | null {
  const p = parseAmount(f.price);
  return p == null ? null : Math.round(p * f.qty * 100) / 100;
}

export type SplitView = {
  rows: { personId: string; amount: number; pct: number }[];
  /** 0 = passt, > 0 = fehlt, < 0 = zu viel */
  gap: number;
  hint: string;
  warn: boolean;
};

/** Aufteilung für Balken, Liste und Summenprüfung (nur bei zwei oder mehr Zahlern) */
export function splitView(f: EditForm): SplitView | null {
  if (f.gift || f.payers.length < 2) return null;
  const total = totalOf(f) ?? 0;
  const amounts = f.splitMode === 'equal'
    ? equalSplit(total, f.payers.length)
    : f.payers.map((p) => parseAmount(f.amounts[p] ?? '') ?? 0);
  const gap = f.splitMode === 'equal' ? 0 : splitGap(total, amounts);
  const rows = f.payers.map((personId, i) => ({ personId, amount: amounts[i]!, pct: total ? Math.round((amounts[i]! / total) * 100) : 0 }));
  const hint = f.splitMode === 'equal'
    ? 'Jeder zahlt den gleichen Anteil. Für Statistik und Kosten pro Tragen zählt bei jedem nur sein Anteil.'
    : gap === 0 ? `Summe passt: ${formatPrice(total)}.` : gap > 0 ? `Es fehlen noch ${formatPrice(gap)}.` : `${formatPrice(-gap)} zu viel.`;
  return { rows, gap, hint, warn: f.splitMode === 'custom' && gap !== 0 };
}

/** Hinweis bei Anzahl > 1 (Preis gilt je Stück, Regel 15.11.2026) */
export function qtyHint(f: Pick<EditForm, 'price' | 'qty'>): string | null {
  if (f.qty < 2) return null;
  const total = totalOf(f);
  return `Gleiches Teil mehrfach, z. B. zwei gleiche weiße T-Shirts. Der Preis oben gilt je Stück${total != null ? `, zusammen ${formatPrice(total)}` : ''}. Auf der Kachel steht dann „${f.qty}ד.`;
}

// ---------- Speichern ----------

export type EditResult = { error: string } | { change: Record<string, unknown> };

const num = (label: string, v: string): number | null | { error: string } => {
  if (!v.trim()) return null;
  const n = parseAmount(v);
  return n == null || n < 0 ? { error: `${label} ist keine gültige Zahl.` } : n;
};
const isErr = (x: unknown): x is { error: string } => !!x && typeof x === 'object' && 'error' in x;

/**
 * Formular → Änderung für die Datenbank. Neue Felder plus Spiegel der alten (color, material, style),
 * damit Suche, Kachel-Schein und Statistik weiterlaufen. Felder, die zur Kategorie nicht passen, werden geleert.
 * today: für „Preis beim Merken“ bei neuen Wunschteilen.
 */
export function editChange(f: EditForm, opts: { isNew?: boolean } = {}): EditResult {
  if (!f.name.trim()) return { error: 'Bitte einen Namen eingeben.' };
  if (!isValidPath({ category: f.category, subcategory: f.subcategory, type: f.type })) return { error: 'Kategorie ist unvollständig.' };
  const price = num(f.isWish ? 'Preis' : 'Bezahlt', f.isWish ? f.listPrice : f.price);
  const list = num('Listenpreis', f.listPrice);
  const giftValue = num('Wert', f.giftValue);
  for (const x of [price, list, giftValue]) if (isErr(x)) return x;

  const base: Record<string, unknown> = {
    name: f.name.trim(), brand: f.brand.trim(),
    // items.category ist „not null“ → ohne Kategorie leerer Text (beim Laden = keine Kategorie)
    category: f.category ?? '', subcategory: f.category ? f.subcategory : null, item_type: f.category && f.subcategory ? f.type : null,
    seasons: f.seasons, colors: f.colors.slice(0, MAX_COLORS), colors_b: f.reversible ? f.colorsB.slice(0, MAX_COLORS) : [],
    pattern: f.pattern, pattern_b: f.reversible ? f.patternB : null,
    materials: f.materials, size_system: f.sizeSystem,
    // Felder, die zur Kategorie nicht passen, werden nur nicht gezeigt – gespeicherte Werte bleiben (Spec 8a)
    size: f.size ?? '', collar_size: f.collarSize,
    fit_width: f.fit.width, fit_length: f.fit.length, fit_rise: f.fit.rise,
    layers: [...f.layers].sort(), standalone: f.standalone, warmth: f.warmth, rain: f.rain,
    styles: f.styles, collar: f.collar, closure: f.closure, strap: f.strap, care: f.care,
    reversible: f.reversible, notes: f.notes.trim(),
    shop: f.shop.trim(), link: f.link.trim(), article_no: f.articleNo.trim(),
    ai_pending: f.aiPending,
    analysis: mergeAnalysis(withPendingSrc(f), f.profile, f.confidence, f.aiMeta),
    // Spiegel der alten Felder (deutsches Label wie bisher)
    color: f.colors.map(colorLabel).join('/'), material: f.materials[0] ? materialLabel(f.materials[0].name) : '', style: f.styles[0] ? styleLabel(f.styles[0]) : '',
  };

  if (f.isWish) {
    // Wunschteile gehören immer zu einer Liste (17.11.2026, Max) – ohne Liste kein Wunschteil
    if (!f.wishlistId) return { error: 'Bitte eine Liste wählen.' };
    // Wunschteil (Spec 7a): Preis = list_price; Bezahlt, Zahler, Geschenk, Kaufdatum, Anzahl, Gehört entfallen
    return { change: {
      ...base, is_wish: true, list_price: price, wishlist_id: f.wishlistId, wish_tag: f.wishTag, buy_on: f.buyOn,
      ...(opts.isNew && price != null ? { wish_price: price } : {}),
    } };
  }

  const split = splitView(f);
  if (split?.warn) return { error: `Aufteilung: ${split.hint}` };
  const payers = f.gift || f.payers.length === 0 ? null
    : f.payers.length === 1 ? [{ person_id: f.payers[0], amount: null }]
    : f.payers.map((p, i) => ({ person_id: p, amount: f.splitMode === 'custom' ? split!.rows[i]!.amount : null }));

  return { change: {
    ...base,
    owner_ids: f.owners, owner_id: f.owners.length === 1 ? f.owners[0] : null, qty: Math.max(1, f.qty),
    is_gift: f.gift, gift_from: f.gift ? f.giftFrom.trim() : '', gift_value: f.gift ? giftValue : null,
    price_paid: f.gift ? null : price, list_price: f.gift ? null : list, payers,
    purchase_date: f.purchaseDate,
  } };
}
