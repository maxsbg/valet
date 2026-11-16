// KI „Infos auslesen“ (Spec 7): Etikett, Shop-Screenshot oder Bestellbestätigung → Steckbrief und Kauf.
// Gleicher Durchreicher wie „Teil erkennen“ (Edge Function `ki`), gleiche festen Listen.

import { MATERIALS, CARE, type Care, type CareGroup, type MaterialPart } from '../attributes';
import { setField, type EditForm } from '../edit';
import { ANALYZE_ITEM_PROPS, CATEGORY_PATHS, checkAnalysis, applyAnalysis, type Analysis, type JsonSchema } from './analyzeItem';

export type InfoKind = 'label' | 'shop' | 'order';

const text = (description: string): JsonSchema => ({ type: ['string', 'null'], description });
const num = (description: string): JsonSchema => ({ type: ['number', 'null'], description });

const CARE_PROPS: Record<string, JsonSchema> = Object.fromEntries(CARE.map((g) => [g.key, {
  type: ['string', 'null'], enum: [...g.options.map((o) => o.id), null],
  description: `${g.label}: ${g.options.map((o) => `${o.id} = ${o.short}`).join(', ')}`,
}]));

// Steckbrief-Felder wie bei „Teil erkennen“, aber Kategorie darf fehlen (z. B. beim Etikett) und Material mit Prozent
const { material: _material, kategorie: _kategorie, ...ITEM } = ANALYZE_ITEM_PROPS;
const PROPS: Record<string, JsonSchema> = {
  kategorie: { type: ['string', 'null'], enum: [...CATEGORY_PATHS, null], description: 'Nur wenn aus Text oder Bild klar erkennbar: Kategorie › Unterkategorie › Typ' },
  ...ITEM,
  shop: text('Name des Shops oder Händlers'),
  preis: num('Aktueller bzw. bezahlter Preis je Stück in Euro (Zahl, z. B. 59.95)'),
  listenpreis: num('Durchgestrichener Preis oder UVP in Euro, sonst null'),
  kaufdatum: text('Bestell- bzw. Kaufdatum als JJJJ-MM-TT, sonst null'),
  groesse: text('Größe genau wie angegeben, z. B. M, 42, W32/L34'),
  artikelnummer: text('Artikel- oder Modellnummer, sonst null'),
  materialAnteile: {
    type: 'array', description: 'Materialzusammensetzung laut Text oder Etikett, Hauptmaterial zuerst; nächstliegender Listenwert (z. B. Cotton → Baumwolle)',
    items: { type: 'object', properties: { name: { type: 'string', enum: [...MATERIALS] }, prozent: { type: ['integer', 'null'] } }, required: ['name', 'prozent'], additionalProperties: false },
  },
  pflege: { type: 'object', properties: CARE_PROPS, required: Object.keys(CARE_PROPS), additionalProperties: false, description: 'Pflegesymbole bzw. -hinweise, nur wenn angegeben' },
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
Nutze für Listenfelder nur die vorgegebenen Werte. Name = exakter Produktname aus dem Shop, ohne Farbe.
Stehen mehrere Artikel darauf, nimm nur den ersten bzw. den hervorgehobenen.`;
}

// ---------- Antwort prüfen ----------

export type Info = {
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
  for (const m of Array.isArray(r.materialAnteile) ? r.materialAnteile : []) {
    const name = (m as Raw)?.name, pct = (m as Raw)?.prozent;
    if (typeof name !== 'string' || !(MATERIALS as readonly string[]).includes(name) || parts.some((p) => p.name === name)) continue;
    parts.push({ name, pct: typeof pct === 'number' && Number.isInteger(pct) && pct > 0 && pct <= 100 ? pct : null });
  }
  const item = { ...checkAnalysis({ ...r, material: [] }), materials: parts.slice(0, 5) };
  const care: Care = {};
  const p = (r.pflege && typeof r.pflege === 'object' ? r.pflege : {}) as Raw;
  for (const g of CARE) {
    const v = p[g.key];
    if (typeof v === 'string' && g.options.some((o) => o.id === v)) care[g.key as CareGroup] = { v, src: 'etikett' };
  }
  return {
    item, care,
    shop: str(r.shop, 40), price: money(r.preis), listPrice: money(r.listenpreis), purchaseDate: date(r.kaufdatum),
    size: str(r.groesse, 12), articleNo: str(r.artikelnummer, 40),
  };
}

// ---------- Ins Formular übernehmen ----------

const eur = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Wie applyAnalysis: nur leere oder unbestätigte Felder; Wunschteile bekommen den Preis als „Preis“ (= Listenpreis). */
export function applyInfo(form: EditForm, info: Info): EditForm {
  let f = applyAnalysis(form, info.item);
  const open = new Set(form.aiPending);
  const marked: string[] = [];
  const put = <K extends keyof EditForm>(k: K, v: EditForm[K], empty: boolean) => {
    if (!(empty || open.has(k))) return;
    f = setField(f, k, v);
    marked.push(k);
  };
  if (info.shop) put('shop', info.shop, !f.shop.trim());
  if (info.articleNo) put('articleNo', info.articleNo, !f.articleNo.trim());
  if (info.purchaseDate && !f.isWish) put('purchaseDate', info.purchaseDate, !f.purchaseDate);
  if (info.size) put('size', info.size, !f.size);
  if (f.isWish) {
    const p = info.price ?? info.listPrice;
    if (p != null) put('listPrice', eur(p), !f.listPrice.trim());
  } else {
    if (info.price != null) put('price', eur(info.price), !f.price.trim());
    if (info.listPrice != null) put('listPrice', eur(info.listPrice), !f.listPrice.trim());
  }
  const care: Care = { ...f.care };
  let careNew = false;
  for (const [g, v] of Object.entries(info.care)) if (!care[g as CareGroup]) { care[g as CareGroup] = v; careNew = true; }
  if (careNew) put('care', care, true);
  return { ...f, aiPending: [...new Set([...f.aiPending, ...marked])] };
}
