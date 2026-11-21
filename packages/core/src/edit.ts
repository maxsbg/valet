// Bearbeiten-Seite (auch „Neues Teil prüfen“) – Formular-Modell (VALET_DETAILSEITE_SPEC.md, Abschnitte 7 und 7a)
// Plattformunabhängig: Laden aus der Datenbank-Zeile, Ändern, Prüfen, zurück in eine Datenbank-Änderung.

import { applyWeather } from './weather';
import { applyRules } from './ruleForm';
/** Abgeleitete Werte neu: Wärme/Regen aus Typ + Material, dann Saison, Verschluss, Kragen, Muster, Pflege (feste Regeln) */
const derive = (f: EditForm): EditForm => applyRules(applyWeather(f));
import { convertFit, fitScalesOf, isValidPath, type FitScale } from './categories';
import { fitFromName, nameFitFor } from './fitName';
import { COLLAR_LIST, CLOSURES, MAX_COLORS, ONE_SIZE, PATTERNS, colorLabel, materialLabel, migrateSeasons, styleLabel, toColorKeys, toMaterialParts, toStyleKeys, type Care, type MaterialPart } from './attributes';
import { toKey } from './keys';
import { normalizeCategory } from './import/categorize';
import { capSize, defaultLayers, fieldsFor, kindHasLetters, sizeSystemOn, STRAPS, type SizeSystemAny } from './fields';
import { equalSplit, formatPrice, parseAmount, splitGap } from './money';
import { isWishTag, type WishTag } from './tile';
import { checkConfidence, emptyConfidence, readProfile, type AiMeta, type Confidence, type Profile } from './ai/profile';
import { ORIGIN_RANK, nameTrusted, originOf, originsOf } from './ai/origin';

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
    // ohne eigene Lagen die Vorgabe der Unterkategorie (Max, 20.11.2026)
    layers: r.layers?.length ? [...r.layers] : defaultLayers(path.category, path.subcategory, path.type), standalone: !!r.standalone, warmth: r.warmth ?? null, rain: r.rain ?? null,
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
  const kept = isObj(src) ? Object.fromEntries(Object.entries(src).filter(([k]) => pending.has(k) || pending.has(k.split('.')[0]!))) : {};
  return Object.keys(kept).length ? { ...rest, src: kept } : rest;
}

// ---------- Ändern ----------

/** Feld ändern; eine KI-Markierung dieses Felds verschwindet (Spec 7) */
export function setField<K extends keyof EditForm>(f: EditForm, k: K, v: EditForm[K]): EditForm {
  const next = markOwn({ ...f, [k]: v, aiPending: f.aiPending.filter((x) => x !== k && !x.startsWith(`${String(k)}.`)) }, String(k));
  // Material oder Wärme geändert: abgeleitete Werte neu (nur offene oder leere)
  return k === 'materials' || k === 'warmth' ? derive(next) : next;
}
/**
 * Offene KI-Werte in Feldern, die es für den endgültigen Pfad nicht gibt (Spec 8a „Die KI füllt nur die gezeigten Felder“),
 * wieder leeren und aus aiPending nehmen – sonst stünden versteckte, nie bestätigbare Vorschläge im Formular.
 * Vom Nutzer gesetzte (bestätigte) Werte bleiben wie immer gespeichert.
 */
export function dropHidden(f: EditForm): EditForm {
  const open = new Set(f.aiPending);
  if (!open.size || !f.category) return f; // ohne Kategorie ist noch nichts endgültig
  const fx = fieldsFor(f.category, f.subcategory);
  const out: EditForm = { ...f };
  const drop: string[] = [];
  const clear = <K extends keyof EditForm>(k: K, empty: EditForm[K], hidden: boolean) => {
    if (hidden && open.has(k)) { out[k] = empty; drop.push(k); }
  };
  clear('pattern', null, !fx.pattern);
  clear('collar', null, !!f.collar && !(fx.neckline?.options.some((o) => o.key === f.collar)));
  clear('closure', null, !fx.closure);
  clear('strap', null, !fx.strap);
  clear('layers', [], !fx.layers);
  clear('warmth', null, !fx.weather);
  clear('rain', null, !fx.weather);
  clear('size', null, fx.size == null);
  if (open.has('fit')) {
    const scales = new Set(fitScalesOf(f.category).map((sc) => sc.key));
    const fit = { ...f.fit };
    for (const k of ['width', 'length', 'rise'] as const) if (!scales.has(k)) fit[k] = null;
    out.fit = fit;
    if (fit.width == null && fit.length == null && fit.rise == null) drop.push('fit');
  }
  if (!fx.care) {
    if (open.has('care')) { out.care = {}; drop.push('care'); }
    // einzeln vorgeschlagene Gruppen (care.dry …) ebenso entfernen
    for (const k of open) if (k.startsWith('care.')) { const g = k.slice(5) as keyof Care; const c = { ...out.care }; delete c[g]; out.care = c; drop.push(k); }
  }
  // offene Markierungen ohne Wert (z. B. Größe, die setCategory geleert hat) nicht stehen lassen
  for (const k of open) if (emptyValue(out, k)) drop.push(k);
  return drop.length ? { ...out, aiPending: out.aiPending.filter((k) => !drop.includes(k)) } : out;
}

/** Ist das Formularfeld leer? (unbekannte Schlüssel gelten als nicht leer) */
function emptyValue(f: EditForm, k: string): boolean {
  if (k === 'fit') return f.fit.width == null && f.fit.length == null && f.fit.rise == null;
  if (k === 'care') return Object.keys(f.care).length === 0;
  if (!(k in f)) return false;
  const v = (f as unknown as Record<string, unknown>)[k];
  return v == null || v === '' || (Array.isArray(v) && v.length === 0);
}

/** Kategorie ändern: Pfad setzen und das Größen-System an die neue Art anpassen (z. B. Hose → W/L, Schuh → EU) */
export function setCategory(f: EditForm, p: { category: string | null; subcategory: string | null; type: string | null }): EditForm {
  const before = fieldsFor(f.category, f.subcategory).size, after = fieldsFor(p.category, p.subcategory).size;
  let next = setField(setField(setField(f, 'category', p.category), 'subcategory', p.subcategory), 'type', p.type);
  // Stufen über ihren Begriff in die Skala der neuen Kategorie umrechnen (Oberteil Relaxed → Hose Relaxed);
  // ohne Gegenstück (Länge Cropped ↔ Mini–Maxi) wird die Stufe leer
  if (f.category !== p.category) next = { ...next, fit: convertFit(f.category, p.category, next.fit) };
  // Lagen folgen der Vorgabe, solange sie nicht selbst geändert wurden (leer oder gleich der alten Vorgabe)
  const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);
  if (!f.layers.length || same(f.layers, defaultLayers(f.category, f.subcategory, f.type))) next = { ...next, layers: defaultLayers(p.category, p.subcategory, p.type) };
  if (before === after) return derive(dropHidden(suggestFitFromName(next)));
  // Buchstabengröße passt auch zur neuen Art (Kleidung ↔ Hose, Handschuh, Mütze …): bleibt stehen (Max, 15.11.2026).
  // Sonst Größe leeren; W/L ist bei Hosen nur vorgewählt, wenn keine Größe gesetzt ist.
  const keepLetters = f.sizeSystem === 'letters' && !!f.size && kindHasLetters(after);
  // offene KI-Werte in Feldern, die es für die neue Kategorie nicht gibt, fallen weg (auch beim Wählen in Bearbeiten)
  // Passform aus dem Namen erst jetzt möglich, wenn der Name vor der Kategorie stand (nur bei offener Passform)
  return derive(dropHidden(suggestFitFromName(keepLetters ? { ...next, sizeSystem: 'letters' } : { ...next, sizeSystem: sizeSystemOn(after, null, null), size: null })));
}

/** Passform noch offen: leer oder nur unbestätigt vorgeschlagen (vom Nutzer bestätigte Passform bleibt immer) */
export const fitOpen = (f: Pick<EditForm, 'fit' | 'aiPending'>): boolean =>
  (f.fit.width == null && f.fit.length == null && f.fit.rise == null) || f.aiPending.includes('fit');

/**
 * Shop-Begriffe im Namen („Slim“, „Oversized“, „Wide Leg“ …) → Passform, als unbestätigt markiert ('fit' in aiPending).
 * Nur wenn `open` (Passform vorher leer oder unbestätigt) und der Name für die Kategorie etwas hergibt.
 */
export function suggestFitFromName(f: EditForm, open: boolean = fitOpen(f)): EditForm {
  // nur Namen vom Nutzer oder aus Shop/Etikett – ein von der KI aus dem Foto erzeugter Name zählt nicht (nameTrusted)
  if (!open || !nameTrusted(f)) return f;
  // Rang je Stufe (Spec 6.7): Begriffe im Namen ersetzen nur Stufen, die Shop oder Etikett nicht selbst nennen
  const origins = originsOf(f);
  // Stufen, die nur aus einem früheren Namen stammten und der neue Name nicht mehr trägt, zurücksetzen
  const fromName = nameFitFor(f.category, fitFromName(f.name).fit);
  if (f.aiPending.includes('fit')) {
    const stale = (['width', 'length', 'rise'] as const).filter((k) => origins[`fit.${k}`] === 'name' && !(k in fromName) && f.fit[k] != null);
    if (stale.length) {
      const fit = { ...f.fit }; for (const k of stale) fit[k] = null;
      const src = Object.fromEntries(Object.entries(isObj(f.analysisBase.src) ? f.analysisBase.src : {}).filter(([k]) => !stale.some((s) => k === `fit.${s}`)));
      f = { ...f, fit, analysisBase: { ...f.analysisBase, src } };
      if (fit.width == null && fit.length == null && fit.rise == null) f = { ...f, aiPending: f.aiPending.filter((k) => k !== 'fit') };
    }
  }
  const part = Object.fromEntries(Object.entries(fromName)
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
  return derive(suggestFitFromName(setField(f, 'name', name), fitOpen(f)));
}

/**
 * Pflege ändern: bestätigt nur die geänderten Gruppen. Einzeln vorgeschlagene Gruppen (aiPending „care.dry“) bleiben
 * offen, wenn sie nicht angefasst wurden; war die ganze Pflege offen („care“), werden die übrigen Gruppen einzeln offen.
 */
export function setCare(f: EditForm, care: Care): EditForm {
  const groups = new Set([...Object.keys(f.care), ...Object.keys(care)]);
  const changed = [...groups].filter((g) => JSON.stringify(f.care[g as keyof Care]) !== JSON.stringify(care[g as keyof Care]));
  const wholeOpen = f.aiPending.includes('care');
  const keep = f.aiPending.filter((k) => k !== 'care' && !changed.some((g) => k === `care.${g}`));
  const split = wholeOpen ? Object.keys(care).filter((g) => !changed.includes(g)).map((g) => `care.${g}`) : [];
  const aiPending = [...new Set([...keep, ...split])];
  // Herkunft der noch offenen Gruppen behalten (bei „care“ offen galt sie für alle Gruppen)
  const src = isObj(f.analysisBase.src) ? { ...f.analysisBase.src } : null;
  if (src && wholeOpen) for (const g of split) if (!(g in src)) src[g] = src.care ?? 'image';
  return { ...f, care, aiPending, ...(src ? { analysisBase: { ...f.analysisBase, src } } : {}) };
}

/**
 * Foto gewechselt (Neues Teil): offene Vorschläge, die aus dem alten Foto stammen (Herkunft „image“), leeren – sonst
 * sähen sie wie Vorschläge zum neuen Foto aus. Vorschläge aus Shop/Etikett/Name und alles Bestätigte bleiben.
 * Profil und meta des alten Fotos fallen ebenfalls weg (das neue Foto wird neu analysiert).
 */
export function dropImageSuggestions(f: EditForm): EditForm {
  const origins = originsOf(f);
  const blank = emptyEditForm();
  let out: EditForm = { ...f, profile: blank.profile, confidence: blank.confidence, aiMeta: null };
  const drop: string[] = [];
  for (const k of f.aiPending) {
    if (k === 'fit') {
      const fit = { ...out.fit };
      for (const st of ['width', 'length', 'rise'] as const) if (originOf(origins, `fit.${st}`) === 'image') fit[st] = null;
      out = { ...out, fit };
      if (fit.width == null && fit.length == null && fit.rise == null) drop.push('fit');
      continue;
    }
    if (k === 'care' || k.startsWith('care.')) {
      // Pflege je Gruppe: nur Gruppen aus dem Bild leeren (Shop/Etikett bleiben)
      const care = { ...out.care };
      const groups = k === 'care' ? Object.keys(care) : [k.slice(5)];
      let left = false;
      for (const g of groups) { if (originOf(origins, `care.${g}`) === 'image') delete care[g as keyof Care]; else left = true; }
      out = { ...out, care };
      if (!left) drop.push(k);
      continue;
    }
    if (k === 'category') {
      // je Ebene: Kategorie, Unterkategorie, Typ nach ihrer eigenen Herkunft
      const catO = originOf(origins, 'category');
      const subO = origins['category.sub'] ?? catO;
      const typeO = origins['category.type'] ?? subO;
      if (catO === 'image') { out = { ...out, category: null, subcategory: null, type: null }; drop.push(k); continue; }
      if (subO === 'image') out = { ...out, subcategory: null, type: null };
      else if (typeO === 'image') out = { ...out, type: null };
      continue;
    }
    if (originOf(origins, k) !== 'image' || k.includes('.')) continue;
    if (k in blank) { (out as unknown as Record<string, unknown>)[k] = (blank as unknown as Record<string, unknown>)[k]; drop.push(k); }
  }
  return { ...out, aiPending: out.aiPending.filter((k) => !drop.includes(k)) };
}

/** KI-Vorschlag bestätigen (Wert bleibt) */
export const confirmAi = (f: EditForm, k: string): EditForm =>
  withAccepted({ ...f, aiPending: f.aiPending.filter((x) => x !== k) }, [k.split('.')[0]!]);
/** Alle KI-Vorschläge übernehmen (Knopf „Alle übernehmen“): danach gelten sie als bestätigt (Spec 7, Detailseite) */
export const confirmAllAi = (f: EditForm): EditForm => withAccepted({ ...f, aiPending: [] }, f.aiPending.map((k) => k.split('.')[0]!));

/**
 * Übernommene KI-Werte (items.analysis.accepted): bestätigt, aber nicht selbst eingetragen (Max 21.11.2026).
 * Feste Regeln dürfen sie noch korrigieren (dann wieder offen), selbst Eingetragenes nie.
 */
export function acceptedKeys(f: Pick<EditForm, 'analysisBase'>): string[] {
  const a = f.analysisBase?.accepted;
  return Array.isArray(a) ? a.filter((k): k is string => typeof k === 'string') : [];
}
function withAccepted(f: EditForm, add: readonly string[], remove: readonly string[] = []): EditForm {
  const cur = acceptedKeys(f);
  const next = [...new Set([...cur, ...add])].filter((k) => !remove.includes(k));
  if (next.length === cur.length && next.every((k) => cur.includes(k))) return f;
  const { accepted: _, ...rest } = f.analysisBase ?? {};
  return { ...f, analysisBase: next.length ? { ...rest, accepted: next } : rest };
}
/** Wert wurde selbst gesetzt → nicht mehr „nur übernommen“ */
export const markOwn = (f: EditForm, k: string): EditForm => withAccepted(f, [], [k]);

/** Mehrfachauswahl: an/aus (Reihenfolge = Reihenfolge der Wahl) */
export const toggleIn = <T>(list: readonly T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
/** Einfachauswahl: erneut tippen hebt auf */
export const pickOne = <T>(cur: T | null, v: T): T | null => (cur === v ? null : v);

/** Material: mehrfach mit Rang (Reihenfolge), 1 = Hauptmaterial; Prozent bleiben erhalten */
export function toggleMaterial(list: readonly MaterialPart[], name: string): MaterialPart[] {
  return list.some((m) => m.name === name) ? list.filter((m) => m.name !== name) : [...list, { name }];
}
export const materialRank = (list: readonly MaterialPart[], name: string) => list.findIndex((m) => m.name === name) + 1;

/** Prozent-Eingabe lesen: leer oder keine Zahl → null, sonst ganze Zahl 1–100 */
export function parsePct(v: string): number | null {
  const n = Number(v.trim().replace(',', '.').replace(/%$/, '').trim());
  if (!v.trim() || !Number.isFinite(n)) return null;
  return Math.max(1, Math.min(100, Math.round(n)));
}
export const setMaterialPct = (list: readonly MaterialPart[], name: string, pct: number | null): MaterialPart[] =>
  list.map((m) => (m.name !== name ? m : pct == null ? { name: m.name } : { ...m, pct }));
export const materialPctSum = (list: readonly MaterialPart[]) => list.reduce((s, m) => s + (m.pct ?? 0), 0);
/** Rang widerspricht den Anteilen (ein späteres Material hat mehr % als ein früheres) */
export function materialOrderOff(list: readonly MaterialPart[]): boolean {
  const pcts = list.map((m) => m.pct).filter((p): p is number => p != null);
  return pcts.some((p, i) => i > 0 && p > pcts[i - 1]!);
}
/** Nach Anteil sortieren (höchster zuerst); ohne Anteil bleiben in ihrer Reihenfolge dahinter */
export function sortMaterialsByPct(list: readonly MaterialPart[]): MaterialPart[] {
  const withPct = list.filter((m) => m.pct != null).sort((a, b) => b.pct! - a.pct!);
  return [...withPct, ...list.filter((m) => m.pct == null)];
}

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
/**
 * Hat sich an items.analysis wirklich etwas geändert? Reihenfolge der Schlüssel zählt nicht; ein leeres Profil bzw.
 * leere Konfidenz gilt wie ein fehlendes (sonst würde jedes Speichern eines Teils ohne Profil analysis schreiben und ein
 * inzwischen vom Stapellauf ergänztes Profil löschen).
 */
function sameAnalysis(next: Record<string, unknown>, base: Record<string, unknown>): boolean {
  const empty = (v: unknown) => v == null || (isObj(v) && Object.values(v).every((x) => x == null || (Array.isArray(x) && x.length === 0)));
  const norm = (o: Record<string, unknown>): unknown => {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) {
      const v = o[k];
      if ((k === 'profile' || k === 'confidence' || k === 'src') && empty(v)) continue;
      out[k] = isObj(v) ? norm(v) : v;
    }
    return out;
  };
  return JSON.stringify(norm(next)) === JSON.stringify(norm(isObj(base) ? base : {}));
}

export function editChange(f: EditForm, opts: { isNew?: boolean } = {}): EditResult {
  if (!f.name.trim()) return { error: 'Bitte einen Namen eingeben.' };
  if (materialPctSum(f.materials) > 100) return { error: `Materialanteile ergeben ${materialPctSum(f.materials)} %, höchstens 100 % möglich.` };
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
    // analysis nur schreiben, wenn sich Profil/meta/src geändert haben – sonst löschte Speichern ein Profil, das der
    // Stapellauf inzwischen ergänzt hat (Stand beim Öffnen)
    ...(() => {
      const next = mergeAnalysis(withPendingSrc(f), f.profile, f.confidence, f.aiMeta);
      return opts.isNew || !sameAnalysis(next, f.analysisBase) ? { analysis: next } : {};
    })(),
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
