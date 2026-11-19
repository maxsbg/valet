// Zusammenführen der KI-Quellen (Entscheidung 19.11.2026, Spec 6.7 und 14):
// Rangfolge für den Steckbrief: Nutzer (bestätigt) > Etikett > Shopseite/Screenshot > Begriffe im Namen > Bildschätzung.
// Das Profil (profile, confidence, aiMeta) kommt immer und nur aus der Bildanalyse.
// Dazu der Kontext für den Prompt der Bildanalyse („Angaben des Shops, verlässlicher als das Foto: …“).

import { categoryName, fitScalesOf, subcategoryName, typeName, type CategoryPath, type FitScale } from '../categories';
import { colorLabel, materialLabel, patternLabel, type Care, type CareGroup, type MaterialPart } from '../attributes';
import { setField, setCategory, fitOpen, type EditForm } from '../edit';
import { fieldsFor, matchSize } from '../fields';
import { fitFromName, fitTermsIn, nameFitFor } from '../fitName';
import { PROFILE_FIELDS, aiMeta, type AnalysisSource, type Ctx, type Profile } from './profile';
import type { Analysis } from './analyzeItem';
import type { Info } from './readInfo';

/** Woher eine Info stammt: Text der Produktseite (Link), Bild eines Shops/einer Bestellung, Etikett */
export type InfoSource = 'page' | 'screenshot' | 'label';
export type SourceInfo = { from: InfoSource; info: Info };
export type Sources = { image?: Analysis | null; infos?: readonly SourceInfo[] };

/** Höher schlägt niedriger (Bildschätzung = 0, Begriffe im Namen liegen zwischen Bild und Shop) */
const RANK: Record<InfoSource, number> = { page: 1, screenshot: 1, label: 2 };

/** Quelle einer ausgelesenen Info: per Link = Seite, sonst nach der Art, die die KI erkannt hat */
export const infoSource = (info: Pick<Info, 'kind'>, viaLink = false): InfoSource =>
  viaLink ? 'page' : info.kind === 'label' ? 'label' : 'screenshot';

/** analysis.meta.source: Bild allein oder Bild + die ranghöchste Info, die als Kontext mitging */
export function analysisSource(infos: readonly Pick<SourceInfo, 'from'>[] = []): AnalysisSource {
  const top = [...infos].sort((a, b) => RANK[b.from] - RANK[a.from])[0];
  return top ? `image+${top.from}` : 'image';
}

// ---------- Eine Quelle ins Formular ----------

const addPending = (f: EditForm, keys: readonly string[]): EditForm => ({ ...f, aiPending: [...new Set([...f.aiPending, ...keys])] });

/**
 * Steckbrief aus einer Quelle: nur leere oder noch unbestätigte Felder (aiPending), jedes übernommene Feld wird markiert.
 * Passform je Stufe: nur Stufen, die die Quelle nennt, ersetzen die bisherigen.
 */
function applyFacts(form: EditForm, a: Analysis): EditForm {
  let f = form;
  const marked: string[] = [];
  const open = new Set(form.aiPending);
  const put = <K extends keyof EditForm>(k: K, v: EditForm[K], empty: boolean, has: boolean) => {
    if (!(empty || open.has(k)) || !has) return;
    f = setField(f, k, v);
    marked.push(k);
  };
  if ((!f.category || open.has('category')) && a.path.category) {
    f = setCategory(f, a.path);
    marked.push('category');
  }
  put('name', a.name ?? '', !f.name.trim(), !!a.name);
  put('brand', a.brand ?? '', !f.brand.trim(), !!a.brand);
  put('colors', a.colors, f.colors.length === 0, a.colors.length > 0);
  put('pattern', a.pattern, f.pattern == null, a.pattern != null);
  put('materials', a.materials, f.materials.length === 0, a.materials.length > 0);
  put('styles', a.styles, f.styles.length === 0, a.styles.length > 0);
  put('seasons', a.seasons, f.seasons.length === 0, a.seasons.length > 0);
  put('collar', a.collar, f.collar == null, a.collar != null);
  put('closure', a.closure, f.closure == null, a.closure != null);
  put('strap', a.strap, f.strap == null, a.strap != null);
  const fitEmpty = f.fit.width == null && f.fit.length == null && f.fit.rise == null;
  const given = Object.fromEntries(Object.entries(a.fit).filter(([, v]) => v != null));
  put('fit', { ...f.fit, ...given }, fitEmpty, Object.keys(given).length > 0);
  put('layers', a.layers, f.layers.length === 0, a.layers.length > 0);
  put('warmth', a.warmth, f.warmth == null, a.warmth != null);
  put('rain', a.rain, f.rain == null, a.rain != null);
  return addPending(f, marked);
}

const eur = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Kauf, Größe und Pflege aus einer Info (gleiche Regel: nur leere oder unbestätigte Felder) */
function applyExtras(form: EditForm, info: Info): EditForm {
  let f = form;
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
  // Größe nur als Wert aus der Liste der Größen-Art (wie alle Listenfelder, kein freier Text)
  const hit = matchSize(fieldsFor(f.category, f.subcategory).size, info.size, f.category, f.subcategory);
  if (hit && (!f.size || open.has('size'))) {
    f = setField(setField(f, 'sizeSystem', hit.system), 'size', hit.size);
    marked.push('size');
  }
  if (f.isWish) {
    const p = info.price ?? info.listPrice;
    if (p != null) put('listPrice', eur(p), !f.listPrice.trim());
  } else {
    if (info.price != null) put('price', eur(info.price), !f.price.trim());
    if (info.listPrice != null) put('listPrice', eur(info.listPrice), !f.listPrice.trim());
  }
  // Pflege je Gruppe: fehlende Gruppen immer, vorgeschlagene (unbestätigte) dürfen ranghöhere Quellen ersetzen
  const care: Care = { ...f.care };
  let careNew = false;
  for (const [g, v] of Object.entries(info.care)) {
    if (care[g as CareGroup] && !open.has('care')) continue;
    if (JSON.stringify(care[g as CareGroup]) === JSON.stringify(v)) continue;
    care[g as CareGroup] = v; careNew = true;
  }
  if (careNew) put('care', care, true);
  return addPending(f, marked);
}

const LEG_FIELD = PROFILE_FIELDS.find((x) => x.key === 'leg');
/** Beinverlauf aus dem Namen („Straight Leg“, „Tapered“) ersetzt die KI-Schätzung, nur bei Hose/Shorts */
export function legFromName(p: Profile, name: string | null | undefined, ctx: Ctx): Profile {
  const leg = fitFromName(name).leg;
  return leg && LEG_FIELD?.applies(ctx) ? { ...p, leg } : p;
}

// ---------- Alle Quellen ----------

/**
 * Führt Bildanalyse und ausgelesene Infos nach der Rangfolge zusammen (reine Funktion):
 * Nutzer (bestätigt, also gesetzt und nicht in aiPending) > Etikett > Shopseite/Screenshot > Begriffe im Namen > Bild.
 * Von unten nach oben angewendet: jede Quelle darf leere und unbestätigte Felder füllen, auch die, die eine
 * rangniedrigere Quelle gerade vorgeschlagen hat. Profil, Konfidenz und aiMeta nur aus `image`; ohne Bild bleiben sie.
 */
export function mergeSources(form: EditForm, s: Sources, now: string = new Date().toISOString()): EditForm {
  const fitWasOpen = fitOpen(form);
  let f = form;
  if (s.image) f = applyFacts(f, s.image);
  const infos = [...(s.infos ?? [])].sort((a, b) => RANK[a.from] - RANK[b.from]);
  for (const x of infos) f = applyExtras(applyFacts(f, x.info.item), x.info);
  // Begriffe im Namen: über dem Bild, unter Shop/Etikett (deren Stufen bleiben)
  if (fitWasOpen) {
    const fromInfo = new Set(infos.flatMap((x) => Object.entries(x.info.item.fit).filter(([, v]) => v != null).map(([k]) => k)));
    const own = Object.fromEntries(Object.entries(nameFitFor(f.category, fitFromName(f.name).fit)).filter(([k]) => !fromInfo.has(k)));
    if (Object.keys(own).length) f = addPending({ ...f, fit: { ...f.fit, ...own } }, ['fit']);
  }
  if (!s.image) return f;
  const ctx: Ctx = { category: f.category, sub: f.subcategory, pattern: f.pattern, materials: f.materials.map((m) => m.name) };
  return { ...f, profile: legFromName(s.image.profile, f.name, ctx), confidence: s.image.confidence, aiMeta: aiMeta(s.image.model, now, analysisSource(infos)) };
}

/** Nur die Bildanalyse (auch „Neu analysieren“): Steckbrief in offene Felder, Profil komplett ersetzt */
export const applyAnalysis = (form: EditForm, a: Analysis, now: string = new Date().toISOString()): EditForm =>
  mergeSources(form, { image: a }, now);

/**
 * Nur eine ausgelesene Info (Seite, Screenshot, Etikett): Steckbrief, Kauf, Größe, Pflege.
 * Ersetzt NIE profile, confidence oder aiMeta – die kommen allein aus der Bildanalyse.
 */
export const applyInfo = (form: EditForm, info: Info, from: InfoSource = infoSource(info)): EditForm =>
  mergeSources(form, { infos: [{ from, info }] });

// ---------- Kontext für den Prompt der Bildanalyse ----------

/** Beschreibungstext der Shopseite höchstens so lang im Prompt */
export const DESCRIPTION_MAX = 1500;

const pathText = (p: CategoryPath): string => {
  if (!p.category) return '';
  const names = [categoryName(p.category), subcategoryName(p.category, p.subcategory), typeName(p.category, p.subcategory, p.type)].filter(Boolean);
  const keys = [p.category, p.subcategory, p.type].filter(Boolean).join('/');
  return `${names.join(' › ')} (${keys})`;
};
const materialText = (ms: readonly MaterialPart[]) =>
  ms.map((m) => `${m.pct ? `${m.pct} % ` : ''}${materialLabel(m.name)} (${m.name})`).join(', ');
const fitText = (category: string | null, fit: Partial<Record<FitScale['key'], number | null>>) =>
  fitScalesOf(category).filter((sc) => fit[sc.key] != null).map((sc) => `${sc.label} ${sc.steps[fit[sc.key]!] ?? ''}`.trim());
const cut = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

type Facts = {
  name?: string | null; path?: CategoryPath; colors?: readonly string[]; pattern?: string | null; materials?: readonly MaterialPart[];
  fit?: Partial<Record<FitScale['key'], number | null>>; description?: string | null;
};

function factLines(x: Facts): string[] {
  const lines: string[] = [];
  if (x.name?.trim()) lines.push(`Name: ${x.name.trim()}`);
  const path = x.path ? pathText(x.path) : '';
  if (path) lines.push(`Kategorie: ${path}`);
  if (x.colors?.length) lines.push(`Farben: ${x.colors.map((c) => `${colorLabel(c)} (${c})`).join(', ')}`);
  if (x.pattern) lines.push(`Muster: ${patternLabel(x.pattern)} (${x.pattern})`);
  if (x.materials?.length) lines.push(`Material: ${materialText(x.materials)}`);
  const fit = [...fitTermsIn(`${x.name ?? ''} ${x.description ?? ''}`), ...fitText(x.path?.category ?? null, x.fit ?? {})];
  if (fit.length) lines.push(`Passform: ${[...new Set(fit)].join(', ')}`);
  const d = x.description?.replace(/\s+/g, ' ').trim();
  if (d) lines.push(`Beschreibung: ${cut(d, DESCRIPTION_MAX)}`);
  return lines;
}

const CONTEXT_TITLE: Record<InfoSource, string> = {
  page: 'Angaben des Shops, verlässlicher als das Foto',
  screenshot: 'Angaben des Shops, verlässlicher als das Foto',
  label: 'Angaben vom Etikett, verlässlicher als das Foto',
};
const CONTEXT_END = 'Übernimm diese Angaben in den Steckbrief und richte das Profil danach aus; aus dem Foto nur, was dort nicht steht.';

/**
 * Kontext aus ausgelesenen Infos für die Bildanalyse (geht als `text` an die Edge Function, hinter den Prompt):
 * Kategorie, Farben, Material mit %, Passform-Begriffe, Beschreibung (gekürzt auf DESCRIPTION_MAX). Ohne Fakten ''.
 */
export function infoContext(infos: readonly SourceInfo[], description?: string | null): string {
  const blocks = [...infos].sort((a, b) => RANK[b.from] - RANK[a.from]).map((x) => {
    const it = x.info.item;
    const lines = factLines({ name: it.name, path: it.path, colors: it.colors, pattern: it.pattern, materials: it.materials, fit: it.fit, description: x.from === 'page' ? description : null });
    return lines.length ? `${CONTEXT_TITLE[x.from]}:\n${lines.join('\n')}` : '';
  }).filter(Boolean);
  return blocks.length ? `${blocks.join('\n\n')}\n${CONTEXT_END}` : '';
}

/**
 * „Neu analysieren“: bestätigte Steckbrief-Werte (gesetzt und nicht in aiPending) als Kontext, damit das Profil zu ihnen passt.
 * Ohne bestätigte Werte ''.
 */
export function confirmedContext(f: EditForm): string {
  const ok = (k: string) => !f.aiPending.includes(k);
  const lines = factLines({
    name: ok('name') ? f.name : null,
    path: ok('category') ? { category: f.category, subcategory: f.subcategory, type: f.type } : undefined,
    colors: ok('colors') ? f.colors : [],
    pattern: ok('pattern') ? f.pattern : null,
    materials: ok('materials') ? f.materials : [],
    fit: ok('fit') ? f.fit : {},
  });
  return lines.length ? `Vom Nutzer bestätigte Angaben, verlässlicher als das Foto:\n${lines.join('\n')}\nDas Profil soll zu diesen Angaben passen.` : '';
}
