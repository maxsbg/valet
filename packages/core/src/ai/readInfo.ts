// KI „Infos auslesen“ (Spec 7): Etikett, Shop-Screenshot oder Bestellbestätigung → Steckbrief und Kauf.
// Gleicher Durchreicher wie „Teil erkennen“ (Edge Function `ki`), gleiche festen Listen.

import { MATERIALS, CARE, type Care, type CareGroup, type MaterialPart } from '../attributes';
import { ANALYZE_ITEM_PROPS, CATEGORY_PATHS, categoryDescription, checkAnalysis, type Analysis, type JsonSchema } from './analyzeItem';
import { toKey } from '../keys';

export type InfoKind = 'label' | 'shop' | 'order';

const text = (description: string): JsonSchema => ({ type: ['string', 'null'], description });
const num = (description: string): JsonSchema => ({ type: ['number', 'null'], description });

const CARE_PROPS: Record<string, JsonSchema> = Object.fromEntries(CARE.map((g) => [g.key, {
  type: ['string', 'null'], enum: [...g.options.map((o) => o.id), null],
  description: `${g.label}: ${g.options.map((o) => `${o.id} = ${o.short}`).join(', ')}`,
}]));

// Steckbrief-Felder wie bei „Teil erkennen“, aber Kategorie darf fehlen (z. B. beim Etikett) und Material mit Prozent
const { materials: _materials, category: _category, ...ITEM } = ANALYZE_ITEM_PROPS;
const PROPS: Record<string, JsonSchema> = {
  kind: { type: ['string', 'null'], enum: ['label', 'shop', 'order', null], description: 'Art des Bildes: label = Etikett/Pflegeetikett, shop = Produktseite eines Shops, order = Bestellbestätigung/Rechnung; null bei reinem Seitentext' },
  category: { type: ['string', 'null'], enum: [...CATEGORY_PATHS, null], description: categoryDescription('Nur wenn aus Text oder Bild klar erkennbar: Kategorie/Unterkategorie/Typ.') },
  ...ITEM,
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
Nutze für Listenfelder nur die vorgegebenen Werte (Keys). name = exakter Produktname aus dem Shop, ohne Farbe.
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
const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);

export function checkInfo(raw: unknown): Info {
  const r: Raw = raw && typeof raw === 'object' ? (raw as Raw) : {};
  const parts: MaterialPart[] = [];
  for (const m of Array.isArray(r.material_parts) ? r.material_parts : []) {
    const name = (m as Raw)?.name, pct = (m as Raw)?.pct;
    if (typeof name !== 'string' || toKey(MATERIALS, name) !== name || parts.some((p) => p.name === name)) continue;
    parts.push({ name, pct: typeof pct === 'number' && Number.isInteger(pct) && pct > 0 && pct <= 100 ? pct : null });
  }
  const item = { ...checkAnalysis({ ...r, materials: [] }), materials: parts.slice(0, 5) };
  const care: Care = {};
  const p = (r.care && typeof r.care === 'object' ? r.care : {}) as Raw;
  for (const g of CARE) {
    const v = p[g.key];
    if (typeof v === 'string' && g.options.some((o) => o.id === v)) care[g.key as CareGroup] = { v, src: 'etikett' };
  }
  const kind = r.kind === 'label' || r.kind === 'shop' || r.kind === 'order' ? r.kind : null;
  return {
    kind, item, care,
    shop: str(r.shop, 40), price: money(r.price), listPrice: money(r.list_price), purchaseDate: date(r.purchase_date),
    size: str(r.size, 12), articleNo: str(r.article_no, 40),
  };
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

/** Prompt für den Text einer Produktseite; der Seitentext hängt die Edge Function `ki` dahinter. */
export function readPagePrompt(facts: PageFacts): string {
  const known = Object.entries(facts).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}: ${String(v).slice(0, 600)}`).join('\n');
  return `Unten steht der Text einer Produktseite eines Online-Shops zu einem Kleidungsstück (ohne Bilder).
${known ? `Strukturierte Angaben der Seite:\n${known}\n` : ''}
Lies nur ab, was dort steht – nichts schätzen. Fehlt eine Angabe: null bzw. leere Liste.
Achte besonders auf Beschreibung, Materialzusammensetzung (mit Prozent) und Pflegehinweise.
Nutze für Listenfelder nur die vorgegebenen Werte (Keys). name = exakter Produktname aus dem Shop, ohne Farbe.
price = aktueller Preis in Euro; list_price nur, wenn ein Streichpreis/UVP angegeben ist. purchase_date = null.
Farbe nur, wenn die Seite sie nennt. Ignoriere Navigation, Empfehlungen und andere Produkte.`;
}
