// KI „Infos auslesen“ (Spec 7): Etikett, Shop-Screenshot oder Bestellbestätigung → Steckbrief und Kauf.
// Gleicher Durchreicher wie „Teil erkennen“ (Edge Function `ki`), gleiche festen Listen.

import { MATERIALS, CARE, type Care, type CareGroup, type MaterialPart } from '../attributes';
import { ANALYZE_ITEM_PROPS, CATEGORY_PATHS, categoryDescription, checkAnalysis, type Analysis, type JsonSchema } from './analyzeItem';
import { emptyConfidence, emptyProfile } from './profile';
import { toKey } from '../keys';

export type InfoKind = 'label' | 'shop' | 'order';

const text = (description: string): JsonSchema => ({ type: ['string', 'null'], description });
const num = (description: string): JsonSchema => ({ type: ['number', 'null'], description });

const CARE_PROPS: Record<string, JsonSchema> = Object.fromEntries(CARE.map((g) => [g.key, {
  type: ['string', 'null'], enum: [...g.options.map((o) => o.id), null],
  description: `${g.label}: ${g.options.map((o) => `${o.id} = ${o.short}`).join(', ')}`,
}]));

// Steckbrief-Felder wie bei „Teil erkennen“ (gleiche Keys), aber zum Ablesen statt Schätzen: eigene Beschreibungen,
// Kategorie und Name dürfen fehlen, Material mit Prozent. Ohne Profil, Konfidenz, Stil, Lagen und Wetter – das sind
// Schätzungen aus dem Foto, die eine Info nicht liefern soll (Spec 6.7: Profil nur aus dem Bild).
const { materials: _m, category: _c, name: _n, profile: _p, confidence: _cf, styles: _s, layers: _l, warmth: _w, rain: _r, ...ITEM } = ANALYZE_ITEM_PROPS;
/** Labels einer Liste aus der Beschreibung von „Teil erkennen“ übernehmen, Anweisung ersetzen */
const read = (key: string, intro: string): JsonSchema => {
  const base = ITEM[key]!;
  const labels = /\(([^()]*=[^()]*)\)$/.exec(base.description ?? '')?.[1];
  return { ...base, description: labels ? `${intro} (${labels})` : intro };
};
const READ_ITEM: Record<string, JsonSchema> = {
  name: text('Exakter Produktname, wie er dasteht, ohne Farbe; sonst null (auf einem Etikett meist null)'),
  brand: text('Marke, nur wenn sie dasteht, sonst null'),
  colors: read('colors', 'Nur die genannte Farbangabe (Farbname des Shops/der Bestellung), höchstens 3; sonst leere Liste. Nicht aus dem Produktfoto schätzen.'),
  pattern: read('pattern', 'Nur wenn das Muster genannt ist (z. B. „gestreift“, „kariert“), sonst null'),
  seasons: read('seasons', 'Nur wenn ausdrücklich genannt (z. B. „Sommerkollektion“), sonst leere Liste'),
  collar: read('collar', 'Nur wenn genannt (z. B. „Rundhals“, „Button-Down“), sonst null'),
  closure: read('closure', 'Nur wenn genannt, sonst null'),
  strap: read('strap', 'Nur wenn genannt (bei Taschen), sonst null'),
  width: { ...ITEM.width!, description: 'Nur wenn ein Passform-Begriff genannt ist: 0 Slim/Skinny … 2 Regular … 3 Relaxed, 4 Oversized/Baggy/Wide; sonst null' },
  length: { ...ITEM.length!, description: 'Nur wenn genannt: 0 Cropped/kurz … 4 lang (bei Kleid/Rock: 0 Mini, 1 über Knie, 2 Knie, 3 Midi, 4 Maxi); sonst null' },
  rise: { ...ITEM.rise!, description: 'Nur wenn genannt: 0 Low Rise, 1 Mid Rise, 2 High Waist/High Rise; sonst null' },
};
const PROPS: Record<string, JsonSchema> = {
  kind: { type: ['string', 'null'], enum: ['label', 'shop', 'order', null], description: 'Art des Bildes: label = Etikett/Pflegeetikett, shop = Produktseite eines Shops, order = Bestellbestätigung/Rechnung; null bei reinem Seitentext' },
  category: { type: ['string', 'null'], enum: [...CATEGORY_PATHS, null], description: categoryDescription('Nur wenn aus Text oder Bild klar erkennbar: Kategorie/Unterkategorie/Typ.') },
  ...READ_ITEM,
  shop: text('Name des Shops oder Händlers'),
  price: num('Aktueller bzw. bezahlter Preis je Stück in Euro (Zahl, z. B. 59.95)'),
  list_price: num('Durchgestrichener Preis oder UVP in Euro, sonst null'),
  purchase_date: text('Bestell- bzw. Kaufdatum als JJJJ-MM-TT, sonst null'),
  size: text('Größe wie angegeben, nur die Größe ohne Zusätze, z. B. M, S/M (Doppelgröße), 4XL, 42, 42 1/2, 42 2/3 (Drittelgröße), W32/L34, 7 3/8 (Fitted), 8,5 (Handschuh), 39–42 (Socken), 95 cm (Gürtellänge), 58 cm (Kopfumfang Hut), 45 cm (Kettenlänge), 40 mm (Uhrgehäuse)'),
  article_no: text('Artikel- oder Modellnummer, sonst null'),
  material_parts: {
    type: 'array', description: `Materialzusammensetzung laut Text oder Etikett, Hauptmaterial zuerst; nächstliegender Listenwert (z. B. Cotton, Baumwolle → cotton). Labels: ${MATERIALS.map((m) => `${m.key} = ${m.label}`).join(', ')}`,
    items: { type: 'object', properties: { name: { type: 'string', enum: MATERIALS.map((m) => m.key) }, pct: { type: ['integer', 'null'] } }, required: ['name', 'pct'], additionalProperties: false },
  },
  care: { type: 'object', properties: CARE_PROPS, required: Object.keys(CARE_PROPS), additionalProperties: false, description: 'Pflegesymbole bzw. -hinweise, nur wenn angegeben' },
};

export const READ_INFO_SCHEMA: JsonSchema = { type: 'object', properties: PROPS, required: Object.keys(PROPS), additionalProperties: false };

const WHAT: Record<InfoKind, string> = {
  label: 'das Etikett (Pflegeetikett) eines Kleidungsstücks',
  shop: 'einen Screenshot einer Produktseite aus einem Online-Shop',
  order: 'eine Bestellbestätigung oder Rechnung',
};

export function readInfoPrompt(kind: InfoKind | null): string {
  return `Du siehst ${kind ? WHAT[kind] : 'ein Etikett, einen Shop-Screenshot oder eine Bestellbestätigung zu einem Kleidungsstück'}.
Lies nur ab, was dort steht oder klar zu sehen ist – nichts schätzen. Fehlt eine Angabe: null bzw. leere Liste.
Nutze für Listenfelder nur die vorgegebenen Werte (Keys). name = exakter Produktname, ohne Farbe (sonst null).
Stehen mehrere Artikel darauf, nimm nur den ersten bzw. den hervorgehobenen.`;
}

// ---------- Antwort prüfen ----------

export type Info = {
  /** Art laut KI (Etikett, Shop, Bestellung); null = unbekannt */
  kind: InfoKind | null;
  item: Analysis;
  shop: string | null;
  price: number | null;
  listPrice: number | null;
  purchaseDate: string | null;
  size: string | null;
  articleNo: string | null;
  care: Care;
};

type Raw = Record<string, unknown>;
const str = (v: unknown, max = 60) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const money = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 100000 ? Math.round(v * 100) / 100 : null);
/** JJJJ-MM-TT, nur echte Kalendertage (2026-02-30 → null) */
const date = (v: unknown) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split('-').map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d!));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m! - 1 && t.getUTCDate() === d ? v : null;
};

export function checkInfo(raw: unknown): Info {
  const r: Raw = raw && typeof raw === 'object' ? (raw as Raw) : {};
  const parts: MaterialPart[] = [];
  for (const m of Array.isArray(r.material_parts) ? r.material_parts : []) {
    const name = (m as Raw)?.name, pct = (m as Raw)?.pct;
    if (typeof name !== 'string' || toKey(MATERIALS, name) !== name || parts.some((p) => p.name === name)) continue;
    parts.push({ name, pct: typeof pct === 'number' && Number.isInteger(pct) && pct > 0 && pct <= 100 ? pct : null });
  }
  // Profil, Konfidenz, Stil, Lagen und Wetter liefert eine Info nie (auch wenn die Antwort sie enthielte)
  const item: Analysis = {
    ...checkAnalysis({ ...r, materials: [], profile: null, confidence: null, styles: [], layers: [], warmth: null, rain: null }),
    materials: parts.slice(0, 5), profile: emptyProfile(), confidence: emptyConfidence(),
  };
  const care: Care = {};
  const p = (r.care && typeof r.care === 'object' ? r.care : {}) as Raw;
  for (const g of CARE) {
    const v = p[g.key];
    if (typeof v === 'string' && g.options.some((o) => o.id === v)) care[g.key as CareGroup] = { v, src: 'etikett' }; // 'etikett' = abgelesen (Etikett oder Angabe des Shops), nicht geschätzt
  }
  const kind = r.kind === 'label' || r.kind === 'shop' || r.kind === 'order' ? r.kind : null;
  return {
    kind, item, care,
    shop: str(r.shop, 40), price: money(r.price), listPrice: money(r.list_price), purchaseDate: date(r.purchase_date),
    size: str(r.size, 12), articleNo: str(r.article_no, 40),
  };
}

/** Hat die ausgelesene Info überhaupt etwas ergeben? (leer → dem Nutzer sagen statt still schließen) */
export function infoUsable(i: Info): boolean {
  const it = i.item;
  return !!(it.path.category || it.name || it.brand || it.colors.length || it.materials.length || it.pattern || it.seasons.length
    || it.collar || it.closure || it.strap || Object.values(it.fit).some((v) => v != null)
    || i.shop || i.price != null || i.listPrice != null || i.purchaseDate || i.size || i.articleNo || Object.keys(i.care).length);
}

// ---------- Ins Formular übernehmen ----------

// applyInfo liegt in merge.ts (Rangfolge der Quellen, mergeSources)
export { applyInfo } from './merge';

// ---------- Produktseite (per Link) ----------

/** Angaben, die die Edge Function `produkt` schon strukturiert gefunden hat (JSON-LD, Meta-Tags) */
export type PageFacts = {
  name?: string | null; brand?: string | null; price?: number | null; currency?: string | null; sku?: string | null;
  color?: string | null; material?: string | null; description?: string | null; shop?: string | null;
};

export const PAGE_FACTS_MAX = 2400;

/** Prompt für den Text einer Produktseite; der Seitentext hängt die Edge Function `ki` dahinter. */
export function readPagePrompt(facts: PageFacts): string {
  // Grenze der Edge Function: Prompt ≤ 4000 Zeichen → Angaben je 300, zusammen höchstens 2400 (Beschreibung steht ohnehin im Seitentext)
  const known = Object.entries(facts).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}: ${String(v).replace(/\s+/g, ' ').slice(0, 300)}`).join('\n').slice(0, PAGE_FACTS_MAX);
  return `Unten steht der Text einer Produktseite eines Online-Shops zu einem Kleidungsstück (ohne Bilder).
${known ? `Strukturierte Angaben der Seite:\n${known}\n` : ''}
Lies nur ab, was dort steht – nichts schätzen. Fehlt eine Angabe: null bzw. leere Liste.
Achte besonders auf Beschreibung, Materialzusammensetzung (mit Prozent) und Pflegehinweise.
Nutze für Listenfelder nur die vorgegebenen Werte (Keys). name = exakter Produktname aus dem Shop, ohne Farbe.
price = aktueller Preis in Euro; list_price nur, wenn ein Streichpreis/UVP angegeben ist. purchase_date = null.
Farbe nur, wenn die Seite sie nennt. Ignoriere Navigation, Empfehlungen und andere Produkte.`;
}
