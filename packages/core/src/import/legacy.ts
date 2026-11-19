// Umwandlung der Daten aus dem alten Valet-Artifact in Zeilen für das Supabase-Schema.
// Reine Funktion ohne Netz- oder Datenbankzugriff: Eingabe = exportierte Dokumente, Ausgabe = Zeilen + Hinweise.
// Zuordnung siehe supabase/import-zuordnung.md

import { isItemStatus } from '../catalog';
import { migrateSeasons } from '../attributes';
import { normalizeOccasions } from '../occasions';
import { normalizeCategory } from './categorize';

/** Ein Dokument, wie es die Artifact-Datenbank liefert ({id, data}). */
export interface LegacyDoc<T = Record<string, unknown>> {
  id: string;
  data: T;
}

export interface LegacyExport {
  people: LegacyDoc[];
  wishlists: LegacyDoc[];
  items: LegacyDoc[];
  outfits: LegacyDoc[];
  daily: LegacyDoc[];
  cutoutFeedback: LegacyDoc[];
}

type Row = Record<string, unknown>;

export interface ImportResult {
  persons: Row[];
  wishlists: Row[];
  items: Row[];
  itemImages: Row[];
  wears: Row[];
  outfits: Row[];
  outfitItems: Row[];
  outfitPlans: Row[];
  reservations: Row[];
  dailySuggestions: Row[];
  cutoutFeedback: Row[];
  /** Alte Bild-ID → Ziel (Teil, Seite), für das spätere Hochladen der Bilder */
  imageJobs: { legacyImageId: string; itemId: string; side: 'a' | 'b'; storagePath: string }[];
  warnings: string[];
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const numOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;
const dateOrNull = (v: unknown): string | null =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
const arr = <T = unknown>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const tsOrNull = (v: unknown): string | null =>
  typeof v === 'number' && Number.isFinite(v) ? new Date(v).toISOString() : null;

/** Felder, die nur interne Verarbeitungs-Merker waren und entfallen. */
const DROPPED = new Set(['trimV2', 'trimV3', 'trimV4', 'trimV5', 'tile', 'hexFor', 'altHexFor', 'accentFor', 'incomplete']);
/** Felder, die in items.analysis (JSON) landen. */
const ANALYSIS = ['vdesc', 'vdescAuto', 'matInfo', 'matStale', 'materialAuto', 'accent', 'layerAuto', 'layerChecked', 'brandManual', 'autoDetected', 'tagsDetected', 'bgProcessed'];

export function convertLegacy(src: LegacyExport, wardrobeId: string, newId: () => string): ImportResult {
  const r: ImportResult = {
    persons: [], wishlists: [], items: [], itemImages: [], wears: [], outfits: [], outfitItems: [],
    outfitPlans: [], reservations: [], dailySuggestions: [], cutoutFeedback: [], imageJobs: [], warnings: [],
  };

  const personId = new Map<string, string>();
  const wishlistId = new Map<string, string>();
  const itemId = new Map<string, string>();
  const outfitId = new Map<string, string>();
  const planId = new Map<string, string>(); // Schlüssel: altOutfitId + '|' + altPlanId

  const mapPerson = (v: unknown, ctx: string): string | null => {
    if (v == null || v === '') return null;
    const id = personId.get(str(v));
    if (!id) r.warnings.push(`${ctx}: unbekannte Person ${str(v)} – als „gemeinsam“ übernommen`);
    return id ?? null;
  };

  // 1. Personen (Reihenfolge der Teile wird nach dem Teile-Import übersetzt)
  for (const d of src.people) {
    const id = newId();
    personId.set(d.id, id);
    r.persons.push({
      id, wardrobe_id: wardrobeId, name: str(d.data.name) || 'Ohne Namen', color: str(d.data.color) || null,
      item_order: [], prefs: (d.data.prefs as object) ?? {}, wash_ask_on: dateOrNull(d.data.washAsk),
      legacy_id: d.id, created_at: tsOrNull(d.data.createdAt) ?? undefined,
    });
  }

  // 2. Wunschlisten
  for (const d of src.wishlists) {
    const id = newId();
    wishlistId.set(d.id, id);
    r.wishlists.push({
      id, wardrobe_id: wardrobeId, owner_id: mapPerson(d.data.ownerId, `Wunschliste ${d.id}`),
      name: str(d.data.name), legacy_id: d.id, created_at: tsOrNull(d.data.createdAt) ?? undefined,
    });
  }

  // 3. Teile – erst alle IDs vergeben, damit dupOf auflösbar ist
  for (const d of src.items) itemId.set(d.id, newId());
  for (const d of src.items) {
    const x = d.data;
    const id = itemId.get(d.id)!;
    const ctx = `Teil „${str(x.name) || d.id}“`;

    const analysis: Record<string, unknown> = {};
    for (const k of ANALYSIS) if (x[k] !== undefined) analysis[k] = x[k];

    const known = new Set(['name', 'brand', 'category', 'color', 'altColor', 'size', 'material', 'style', 'seasons', 'layer', 'qty',
      'pricePaid', 'listPrice', 'origCurrency', 'origPaid', 'origList', 'fxRate', 'fxEstimated', 'payers', 'purchaseDate', 'shop',
      'link', 'notes', 'status', 'statusAt', 'lentTo', 'soldDate', 'soldPrice', 'wish', 'listId', 'kaufCheck', 'reversible', 'mainSide',
      'setId', 'setName', 'fp', 'dupOf', 'imageId', 'altImageId', 'hexes', 'altHexes', 'wears', 'reservations', 'ownerId',
      'createdAt', 'updatedAt', ...ANALYSIS, ...DROPPED]);
    const unknown = Object.keys(x).filter((k) => !known.has(k));
    if (unknown.length) r.warnings.push(`${ctx}: unbekannte Felder ${unknown.join(', ')} – in analysis.extra abgelegt`);
    if (unknown.length) analysis.extra = Object.fromEntries(unknown.map((k) => [k, x[k]]));

    const status = isItemStatus(x.status) ? x.status : null;
    if (x.status && !status) r.warnings.push(`${ctx}: unbekannter Status ${str(x.status)} – entfernt`);

    const payers = arr<{ id?: string; amount?: number }>(x.payers).map((p) => ({
      person_id: mapPerson(p.id, ctx), amount: numOrNull(p.amount),
    }));

    let dupOf: string | null = null;
    if (x.dupOf) {
      dupOf = itemId.get(str(x.dupOf)) ?? null;
      if (!dupOf) r.warnings.push(`${ctx}: Dublette verweist auf fehlendes Teil – Verweis entfernt`);
    }
    let wl: string | null = null;
    if (x.listId) {
      wl = wishlistId.get(str(x.listId)) ?? null;
      if (!wl) r.warnings.push(`${ctx}: Wunschliste ${str(x.listId)} fehlt – Zuordnung entfernt`);
    }

    // Kategorie, Saisons und Anlässe als Keys (seit 19.11.2026); die alte Kategorie bleibt in analysis.legacyCategory
    const path = normalizeCategory({ category: str(x.category) || 'sonstiges', name: str(x.name), brand: str(x.brand) });
    if (x.category) analysis.legacyCategory = str(x.category);
    r.items.push({
      id, wardrobe_id: wardrobeId, owner_id: mapPerson(x.ownerId, ctx),
      name: str(x.name), brand: str(x.brand), category: path.category ?? '', subcategory: path.subcategory, item_type: path.type,
      color: str(x.color), alt_color: str(x.altColor), size: str(x.size), material: str(x.material), style: str(x.style),
      seasons: migrateSeasons(arr<string>(x.seasons)), layer: x.layer ? str(x.layer) : null, qty: Math.max(1, Math.round(Number(x.qty) || 1)),
      price_paid: numOrNull(x.pricePaid), list_price: numOrNull(x.listPrice),
      orig_currency: x.origCurrency ? str(x.origCurrency) : null, orig_paid: numOrNull(x.origPaid), orig_list: numOrNull(x.origList),
      fx_rate: numOrNull(x.fxRate), fx_estimated: !!x.fxEstimated,
      payers: payers.length ? payers : null, purchase_date: dateOrNull(x.purchaseDate),
      shop: str(x.shop), link: str(x.link), notes: str(x.notes),
      status, status_at: dateOrNull(x.statusAt), lent_to: str(x.lentTo), sold_date: dateOrNull(x.soldDate), sold_price: numOrNull(x.soldPrice),
      is_wish: !!x.wish, wishlist_id: wl, kauf_check: x.kaufCheck ?? null,
      reversible: !!x.reversible, main_side: x.mainSide === 'b' ? 'b' : 'a',
      set_id: x.setId ? str(x.setId) : null, set_name: x.setName ? str(x.setName) : null,
      analysis, fingerprint: x.fp ? str(x.fp) : null, dup_of: dupOf, legacy_id: d.id,
      created_at: tsOrNull(x.createdAt) ?? undefined, updated_at: tsOrNull(x.updatedAt) ?? undefined,
    });

    // Bilder
    for (const [side, key, hexKey] of [['a', 'imageId', 'hexes'], ['b', 'altImageId', 'altHexes']] as const) {
      const legacyImage = x[key];
      if (!legacyImage) continue;
      const storagePath = `${wardrobeId}/${id}/${side}.webp`;
      r.itemImages.push({
        id: newId(), item_id: id, side, kind: 'cutout', storage_path: storagePath,
        colors: x[hexKey] ?? null, legacy_id: str(legacyImage),
      });
      r.imageJobs.push({ legacyImageId: str(legacyImage), itemId: id, side, storagePath });
    }
    if (!x.imageId) r.warnings.push(`${ctx}: hat kein Bild`);

    // Getragen (einzeln eingetragene Tage)
    for (const day of new Set(arr<string>(x.wears))) {
      const worn = dateOrNull(day);
      if (worn) r.wears.push({ item_id: id, worn_on: worn, person_id: null, outfit_id: null });
    }
  }

  // Reihenfolge je Person übersetzen (gelöschte Teile fallen weg)
  for (const p of r.persons) {
    const legacy = src.people.find((d) => d.id === p.legacy_id)!;
    const order = arr<string>(legacy.data.order);
    p.item_order = order.map((o) => itemId.get(o)).filter((v): v is string => !!v);
    const lost = order.length - (p.item_order as string[]).length;
    if (lost) r.warnings.push(`Person ${str(p.name)}: ${lost} Einträge in der Reihenfolge verweisen auf gelöschte Teile – entfernt`);
  }

  // 4. Outfits, Teile im Outfit, Planungen
  for (const d of src.outfits) {
    const x = d.data;
    const id = newId();
    outfitId.set(d.id, id);
    const ctx = `Outfit ${d.id}`;
    const meta: Record<string, unknown> = {};
    if (x.capTried) meta.capTried = arr<string>(x.capTried).map((c) => itemId.get(c) ?? c);
    r.outfits.push({
      id, wardrobe_id: wardrobeId, owner_id: mapPerson(x.ownerId, ctx), name: str(x.name), notes: str(x.notes),
      occasions: normalizeOccasions(arr<string>(x.occasions)), occasions_auto: !!x.occAuto, from_suggestion: !!x.fromSuggestion,
      wada: numOrNull(x.wada), meta, legacy_id: d.id,
      created_at: tsOrNull(x.createdAt) ?? undefined, updated_at: tsOrNull(x.updatedAt) ?? undefined,
    });
    const layout = (x.layout ?? {}) as Record<string, { x?: number; y?: number; z?: number }>;
    const seen = new Set<string>();
    arr<string>(x.itemIds).forEach((legacyItem, position) => {
      const it = itemId.get(legacyItem);
      if (!it) { r.warnings.push(`${ctx}: Teil ${legacyItem} existiert nicht mehr – aus dem Outfit entfernt`); return; }
      if (seen.has(it)) return;
      seen.add(it);
      const l = layout[legacyItem] ?? {};
      r.outfitItems.push({ outfit_id: id, item_id: it, position, x: numOrNull(l.x), y: numOrNull(l.y), z: numOrNull(l.z) });
    });
    for (const p of arr<{ id?: string; date?: string; personId?: string; createdAt?: number }>(x.plans)) {
      const date = dateOrNull(p.date);
      if (!date) { r.warnings.push(`${ctx}: Planung ohne gültiges Datum – übersprungen`); continue; }
      const pid = newId();
      if (p.id) planId.set(`${d.id}|${p.id}`, pid);
      r.outfitPlans.push({
        id: pid, outfit_id: id, person_id: mapPerson(p.personId, ctx), plan_date: date,
        legacy_id: p.id ?? null, created_at: tsOrNull(p.createdAt) ?? undefined,
      });
    }
  }

  // 5. Reservierungen (am Teil gespeichert, verweisen auf Outfit + Plan; alte Plan-ID trägt vorn ein "o")
  for (const d of src.items) {
    const it = itemId.get(d.id)!;
    for (const res of arr<{ id?: string; from?: string; to?: string; outfitId?: string; personId?: string; createdAt?: number }>(d.data.reservations)) {
      const from = dateOrNull(res.from), to = dateOrNull(res.to) ?? from;
      if (!from || !to) { r.warnings.push(`Reservierung an ${d.id}: ohne Datum – übersprungen`); continue; }
      const legacyPlan = str(res.id).replace(/^o/, '');
      const plan = res.outfitId ? planId.get(`${res.outfitId}|${legacyPlan}`) ?? null : null;
      if (res.outfitId && !plan) r.warnings.push(`Reservierung an ${d.id}: zugehörige Planung nicht gefunden – ohne Verknüpfung übernommen`);
      r.reservations.push({
        id: newId(), item_id: it, plan_id: plan, person_id: mapPerson(res.personId, `Reservierung an ${d.id}`),
        date_from: from, date_to: to, created_at: tsOrNull(res.createdAt) ?? undefined,
      });
    }
  }

  // 6. Tagesvorschläge: ID "YYYY-MM-DD_<person|all>"
  for (const d of src.daily) {
    const m = /^(\d{4}-\d{2}-\d{2})_(.+)$/.exec(d.id);
    if (!m) { r.warnings.push(`Tagesvorschlag ${d.id}: unbekanntes ID-Format – übersprungen`); continue; }
    const items = arr<string>(d.data.itemIds).map((i) => itemId.get(i)).filter((v): v is string => !!v);
    const meta: Record<string, unknown> = {};
    if (d.data.capTried) meta.capTried = arr<string>(d.data.capTried).map((c) => itemId.get(c) ?? c);
    if (d.data.src) meta.src = d.data.src;
    r.dailySuggestions.push({
      id: newId(), wardrobe_id: wardrobeId, for_date: m[1], person_id: m[2] === 'all' ? null : mapPerson(m[2], `Tagesvorschlag ${d.id}`),
      item_ids: items, direction: d.data.dir ? str(d.data.dir) : null, reason: d.data.reason ? str(d.data.reason) : null,
      occasions: normalizeOccasions(arr<string>(d.data.occasions)), wada: numOrNull(d.data.wada), meta,
      created_at: tsOrNull(d.data.createdAt) ?? undefined,
    });
  }

  // 7. Rückmeldungen zum Freistellen
  for (const d of src.cutoutFeedback) {
    const x = d.data;
    r.cutoutFeedback.push({
      id: newId(), wardrobe_id: wardrobeId, item_id: itemId.get(str(x.itemId)) ?? null,
      side: x.side === 'b' ? 'b' : x.side === 'a' ? 'a' : null, model: x.model ? str(x.model) : null,
      variant: x.variant ? str(x.variant) : null, gpu: typeof x.gpu === 'boolean' ? x.gpu : null,
      note: str(x.note), file_name: x.fileName ? str(x.fileName) : null,
      meta: { itemName: x.itemName, originalId: x.originalId, oldImageId: x.oldImageId, newCutoutId: x.newCutoutId },
      created_at: tsOrNull(x.createdAt) ?? undefined,
    });
  }

  return r;
}
