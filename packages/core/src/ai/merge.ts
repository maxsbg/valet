// Zusammenführen der KI-Quellen (Entscheidung 19.11.2026, Spec 6.7 und 14):
// Rangfolge für den Steckbrief: Nutzer (bestätigt) > Etikett > Shopseite/Screenshot > Begriffe im Namen > Bildschätzung.
// Das Profil (profile, confidence, aiMeta) kommt immer und nur aus der Bildanalyse.
// Dazu der Kontext für den Prompt der Bildanalyse („Angaben des Shops, verlässlicher als das Foto: …“).

import { categoryName, fitIndex, fitScaleOf, fitScalesOf, fitWordLabel, subcategoryName, typeName, type CategoryPath, type FitScale } from '../categories';
import { colorLabel, materialLabel, patternLabel, type Care, type CareGroup, type MaterialPart } from '../attributes';
import { dropHidden, setField, setCategory, fitOpen, type EditForm } from '../edit';
import { fieldsFor, matchSize } from '../fields';
import { fitFromName, fitTermsIn, nameFitFor } from '../fitName';
import { PROFILE_FIELDS, aiMeta, clearInactive, emptyConfidence, emptyProfile, type AnalysisSource, type Ctx, type Profile } from './profile';
import { profileFilled, type Analysis } from './analyzeItem';
import type { Info } from './readInfo';

import { ORIGIN_RANK, nameTrusted, originOf, originsOf, type InfoSource, type Origin } from './origin';
export { ORIGIN_RANK, nameTrusted, originsOf, type InfoSource, type Origin } from './origin';
export type SourceInfo = { from: InfoSource; info: Info };
/**
 * `image` = Bildanalyse, `infos` = ausgelesene Infos. `used` = Quellen, die als Kontext in die Bildanalyse eingingen
 * (nur für meta.source, wenn die Infos selbst schon vorher übernommen wurden).
 */
export type Sources = {
  image?: Analysis | null; infos?: readonly SourceInfo[]; used?: readonly InfoSource[];
  /**
   * Infos, die schon übernommen wurden, deren Passform-Stufen und Größe aber evtl. noch nicht passten (Formular noch ohne
   * Kategorie): nach dem Bild werden nur Stufen und Größe noch einmal mit dem endgültigen Pfad angewendet
   * (zweiter Schritt bei „Neues Teil“; dreht sonst nichts zurück).
   */
  late?: readonly SourceInfo[];
};

const RANK = ORIGIN_RANK;

/** Quelle einer ausgelesenen Info: per Link = Seite, sonst nach der Art, die die KI erkannt hat */
export const infoSource = (info: Pick<Info, 'kind'>, viaLink = false): InfoSource =>
  viaLink ? 'page' : info.kind === 'label' ? 'label' : 'screenshot';

/** analysis.meta.source: Bild allein oder Bild + die ranghöchste Info, die als Kontext mitging */
export function analysisSource(infos: readonly Pick<SourceInfo, 'from'>[] = []): AnalysisSource {
  const top = [...infos].sort((a, b) => RANK[b.from] - RANK[a.from])[0];
  return top ? `image+${top.from}` : 'image';
}

// ---------- Herkunft je Feld (items.analysis.src) ----------

function withOrigins(f: EditForm, set: Record<string, Origin>): EditForm {
  if (!Object.keys(set).length) return f;
  // nur Einträge zu Feldern behalten, die noch offen sind (bestätigte brauchen keine Herkunft mehr)
  const pending = new Set(f.aiPending);
  const all = { ...originsOf(f), ...set };
  const src = Object.fromEntries(Object.entries(all).filter(([k]) => pending.has(k) || pending.has(k.split('.')[0]!)));
  return { ...f, analysisBase: { ...f.analysisBase, src } };
}

const samePath = (a: CategoryPath, b: CategoryPath) => a.category === b.category && a.subcategory === b.subcategory && a.type === b.type;


/** Felder, die ein Etikett tragen kann (Marke, Material mit %, Größe, Pflege, Artikelnummer) – nie Farbe, Stil, Saison … */
const LABEL_FACTS: ReadonlySet<string> = new Set(['brand', 'materials']);
// (Größe, Pflege und Artikelnummer übernimmt applyExtras; Shop, Preise und Kaufdatum nie vom Etikett)

// ---------- Eine Quelle ins Formular ----------

const addPending = (f: EditForm, keys: readonly string[]): EditForm => ({ ...f, aiPending: [...new Set([...f.aiPending, ...keys])] });

/**
 * Steckbrief aus einer Quelle: nur leere Felder und unbestätigte (aiPending), deren Wert aus einer gleich- oder
 * rangniedrigeren Quelle stammt; jedes übernommene Feld wird markiert und seine Herkunft vermerkt.
 * Passform je Stufe: nur Stufen, die die Quelle nennt, ersetzen die bisherigen (gleiche Rangregel je Stufe).
 * Eine von der KI gesetzte Kategorie leert nie eine bestätigte Größe.
 */
function applyFacts(form: EditForm, a: Analysis, from: Origin): EditForm {
  let f = form;
  const marked: string[] = [];
  const origin: Record<string, Origin> = {};
  // nach einem Kategoriewechsel neu gelesen (setCategory kann Vorschläge aus dem Namen setzen bzw. versteckte entfernen)
  let open = new Set(form.aiPending);
  let origins = originsOf(form);
  const may = (k: string, empty: boolean) => empty || (open.has(k) && RANK[originOf(origins, k)] <= RANK[from]);
  const allowed = (k: string) => from !== 'label' || LABEL_FACTS.has(k);
  const put = <K extends keyof EditForm>(k: K, v: EditForm[K], empty: boolean, has: boolean) => {
    if (!has || !allowed(k) || !may(k, empty)) return;
    f = setField(f, k, v);
    marked.push(k); origin[k] = from;
  };
  if (a.path.category && allowed('category')) {
    const cur: CategoryPath = { category: f.category, subcategory: f.subcategory, type: f.type };
    const sizeKept = !!f.size && !open.has('size') ? { size: f.size, sizeSystem: f.sizeSystem } : null;
    // Herkunft je Ebene: category, category.sub (Unterkategorie), category.type (Typ); fehlt eine, gilt die der Ebene darüber
    const catO = originOf(origins, 'category');
    const subO = origins['category.sub'] ?? catO;
    const typeO = origins['category.type'] ?? subO;
    const hi = (x: Origin, y: Origin): Origin => (RANK[y] > RANK[x] ? y : x);
    if (f.category && open.has('category') && a.path.category === f.category) {
      // gleiche Oberkategorie: Ebene für Ebene zusammenführen (verfeinern, gröbere Angaben bestätigen nur, was sie nennen)
      const next: CategoryPath = { ...cur };
      const o: Record<string, Origin> = { category: hi(catO, from), 'category.sub': subO, 'category.type': typeO };
      if (a.path.subcategory) {
        if (!cur.subcategory || (cur.subcategory !== a.path.subcategory && RANK[from] >= RANK[subO])) {
          next.subcategory = a.path.subcategory; next.type = a.path.type;
          o['category.sub'] = from; o['category.type'] = from;
        } else if (cur.subcategory === a.path.subcategory) {
          o['category.sub'] = hi(subO, from);
          if (a.path.type && (!cur.type || (cur.type !== a.path.type && RANK[from] >= RANK[typeO]))) { next.type = a.path.type; o['category.type'] = from; }
          else if (a.path.type && cur.type === a.path.type) o['category.type'] = hi(typeO, from);
        }
      }
      if (!samePath(cur, next)) { f = setCategory(f, next); if (sizeKept) f = { ...f, ...sizeKept }; }
      marked.push('category'); Object.assign(origin, o);
    } else if (may('category', !f.category)) {
      // leer oder echter Wechsel der Oberkategorie: der ganze Pfad stammt jetzt aus dieser Quelle
      f = setCategory(f, a.path);
      if (sizeKept) f = { ...f, ...sizeKept };
      marked.push('category');
      Object.assign(origin, { category: from, 'category.sub': from, 'category.type': from });
    }
  }
  if (f !== form) { open = new Set(f.aiPending); origins = { ...originsOf(f), ...origin }; }
  put('name', a.name ?? '', !f.name.trim(), !!a.name);
  put('brand', a.brand ?? '', !f.brand.trim(), !!a.brand);
  put('colors', a.colors, f.colors.length === 0, a.colors.length > 0);
  put('pattern', a.pattern, f.pattern == null, a.pattern != null);
  put('materials', a.materials, f.materials.length === 0, a.materials.length > 0);
  // Stil wird nicht mehr vorgeschlagen und nicht angezeigt (Max, 21.11.2026); gespeicherte Werte bleiben (Ersatz-Formalität ohne Profil)
  put('seasons', a.seasons, f.seasons.length === 0, a.seasons.length > 0);
  put('collar', a.collar, f.collar == null, a.collar != null);
  put('closure', a.closure, f.closure == null, a.closure != null);
  put('strap', a.strap, f.strap == null, a.strap != null);
  // Passform: nur Stufen der (endgültigen) Kategorie, je Stufe nach Rang
  if (allowed('fit')) {
    const scales = new Set(fitScalesOf(f.category).map((sc) => sc.key));
    const fitOk = open.has('fit') || (f.fit.width == null && f.fit.length == null && f.fit.rise == null);
    const given: Partial<EditForm['fit']> = {};
    for (const [k, word] of Object.entries(a.fit) as [FitScale['key'], string | null][]) {
      const v = fitIndex(f.category, k, word);
      if (v == null || !scales.has(k) || !fitOk) continue;
      if (f.fit[k] != null && RANK[originOf(origins, `fit.${k}`)] > RANK[from]) continue;
      given[k] = v; origin[`fit.${k}`] = from;
    }
    if (Object.keys(given).length) { f = { ...setField(f, 'fit', { ...f.fit, ...given }) }; marked.push('fit'); }
  }
  put('layers', a.layers, f.layers.length === 0, a.layers.length > 0);
  put('warmth', a.warmth, f.warmth == null, a.warmth != null);
  put('rain', a.rain, f.rain == null, a.rain != null);
  return withOrigins(addPending(f, marked), origin);
}

const eur = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Kauf, Größe und Pflege aus einer Info (gleiche Regel: nur leere oder unbestätigte Felder gleichen oder niedrigeren Rangs) */
function applyExtras(form: EditForm, info: Info, from: InfoSource): EditForm {
  let f = form;
  const open = new Set(form.aiPending);
  const origins = originsOf(form);
  const marked: string[] = [];
  const origin: Record<string, Origin> = {};
  const may = (k: string, empty: boolean) => empty || (open.has(k) && RANK[originOf(origins, k)] <= RANK[from]);
  const put = <K extends keyof EditForm>(k: K, v: EditForm[K], empty: boolean) => {
    if (!may(k, empty)) return;
    f = setField(f, k, v);
    marked.push(k); origin[k] = from;
  };
  // Etikett: nur Artikelnummer, Größe, Pflege (kein Shop, Preis, Kaufdatum – die stehen nicht auf einem Etikett)
  const label = from === 'label';
  if (info.shop && !label) put('shop', info.shop, !f.shop.trim());
  if (info.articleNo) put('articleNo', info.articleNo, !f.articleNo.trim());
  if (info.purchaseDate && !f.isWish && !label) put('purchaseDate', info.purchaseDate, !f.purchaseDate);
  // Größe nur als Wert aus der Liste der Größen-Art (wie alle Listenfelder, kein freier Text)
  const hit = matchSize(fieldsFor(f.category, f.subcategory).size, info.size, f.category, f.subcategory);
  if (hit && may('size', !f.size)) {
    f = setField(setField(f, 'sizeSystem', hit.system), 'size', hit.size);
    marked.push('size'); origin.size = from;
  }
  if (!label && f.isWish) {
    const p = info.price ?? info.listPrice;
    if (p != null) put('listPrice', eur(p), !f.listPrice.trim());
  } else if (!label) {
    if (info.price != null) put('price', eur(info.price), !f.price.trim());
    if (info.listPrice != null) put('listPrice', eur(info.listPrice), !f.listPrice.trim());
  }
  // Pflege je Gruppe: fehlende Gruppen immer; vorhandene nur, wenn geschätzt oder selbst ein offener Vorschlag aus
  // gleich- oder rangniedrigerer Quelle (Herkunft je Gruppe „care.wash“ …). Vom Nutzer gesetzte Gruppen („hand“) nie.
  const care: Care = { ...f.care };
  const careOrigin: Record<string, Origin> = {};
  const originUp: Record<string, Origin> = {};
  const careOpen = open.has('care');
  for (const [g, v] of Object.entries(info.care) as [CareGroup, NonNullable<Care[CareGroup]>][]) {
    const cur = care[g];
    if (cur) {
      if (cur.src === 'hand') continue;
      const own = origins[`care.${g}`];
      const groupOpen = careOpen || open.has(`care.${g}`);
      const replaceable = cur.src === 'geschaetzt' || (groupOpen && own != null && RANK[own] <= RANK[from]);
      if (!replaceable) continue;
    }
    if (JSON.stringify(cur) === JSON.stringify(v)) {
      // gleicher Wert aus ranghöherer Quelle: nur die Herkunft hochstufen (wie bei den anderen Feldern)
      const own = origins[`care.${g}`];
      if (own && RANK[from] > RANK[own]) originUp[`care.${g}`] = from;
      continue;
    }
    care[g] = v; careOrigin[`care.${g}`] = from;
  }
  if (Object.keys(careOrigin).length) {
    const confirmed = !careOpen && Object.keys(f.care).some((g) => !open.has(`care.${g}`));
    if (confirmed) {
      // bestätigte Gruppen bleiben bestätigt: nur die neuen Gruppen werden markiert (aiPending „care.dry“ …)
      f = { ...f, care };
      marked.push(...Object.keys(careOrigin)); Object.assign(origin, careOrigin);
    } else {
      // setField nimmt 'care' (und 'care.*') aus aiPending → Herkunft der übrigen offenen Gruppen bewahren
      const keep = Object.fromEntries(Object.entries(origins).filter(([k]) => k.startsWith('care.')));
      f = setField(f, 'care', care);
      marked.push('care'); Object.assign(origin, keep, careOrigin);
    }
  }
  Object.assign(origin, originUp);
  return withOrigins(addPending(f, marked), origin);
}

const LEG_FIELD = PROFILE_FIELDS.find((x) => x.key === 'leg');
const HEM_FIELD = PROFILE_FIELDS.find((x) => x.key === 'hem');
/** Beinverlauf („Straight Leg“, „Tapered“) und Saum („Open Leg“, „Cuffed“, Max 21.11.2026) aus dem Namen ersetzen die KI-Schätzung */
export function legFromName(p: Profile, name: string | null | undefined, ctx: Ctx): Profile {
  const { leg, hem } = fitFromName(name);
  let out = p;
  if (leg && LEG_FIELD?.applies(ctx)) out = { ...out, leg };
  if (hem && HEM_FIELD?.applies(ctx)) out = { ...out, hem };
  return out;
}

// ---------- Alle Quellen ----------

/**
 * Führt Bildanalyse und ausgelesene Infos nach der Rangfolge zusammen (reine Funktion):
 * Nutzer (bestätigt, also gesetzt und nicht in aiPending) > Etikett > Shopseite/Screenshot > Begriffe im Namen > Bild.
 * Von unten nach oben angewendet: jede Quelle darf leere und unbestätigte Felder füllen, auch die, die eine
 * rangniedrigere Quelle gerade vorgeschlagen hat. Profil, Konfidenz und aiMeta nur aus `image`; ohne Bild bleiben sie.
 */
export function mergeSources(form: EditForm, s: Sources, now: string = new Date().toISOString()): EditForm {
  let f = form;
  if (s.image) f = applyFacts(f, s.image, 'image');
  // Begriffe im Namen: über dem Bild, unter Shop/Etikett (je Stufe nach Rang, siehe applyFacts)
  f = applyNameFit(f);
  const infos = [...(s.infos ?? [])].sort((a, b) => RANK[a.from] - RANK[b.from]);
  for (const x of infos) f = applyNameFit(applyExtras(applyFacts(f, x.info.item, x.from), x.info, x.from));
  for (const x of [...(s.late ?? [])].sort((a, b) => RANK[a.from] - RANK[b.from])) {
    f = applyFacts(f, { ...NO_FACTS, fit: x.info.item.fit }, x.from);
    if (x.info.size) f = applyExtras(f, { ...noInfo(), size: x.info.size }, x.from);
  }
  f = dropHidden(f);
  if (!s.image) return f;
  // Profil erst hier nach Kategorie bereinigen: mit dem endgültigen Pfad, Muster und Material (Spec 8)
  const ctx: Ctx = { category: f.category, sub: f.subcategory, type: f.type, pattern: f.pattern, materials: f.materials.map((m) => m.name) };
  const used = [...infos.map((x) => x.from), ...(s.used ?? []), ...(s.late ?? []).map((x) => x.from)].map((from) => ({ from }));
  // ohne Mode-Profil (nur Steckbrief-Fakten) bleibt das bisherige Profil samt meta – das Teil gilt nicht als neu analysiert
  if (!profileFilled(s.image)) return f;
  return { ...f, profile: legFromName(clearInactive(s.image.profile, ctx), nameTrusted(f) ? f.name : null, ctx), confidence: s.image.confidence, aiMeta: aiMeta(s.image.model, now, analysisSource(used)) };
}

/** Passform-Stufen aus Begriffen im Namen (Rang „name“) in offene Stufen gleichen oder niedrigeren Rangs */
function applyNameFit(f: EditForm): EditForm {
  if (!fitOpen(f) || !nameTrusted(f)) return f;
  const words = fitFromName(f.name).fit;
  if (!Object.keys(nameFitFor(f.category, words)).length) return f;
  return applyFacts(f, { ...NO_FACTS, fit: { width: null, length: null, rise: null, ...words } }, 'name');
}
/** Info ohne Inhalt (für das Nachziehen der Größe in `late`); item wird dort nicht gelesen */
const noInfo = (): Info => ({ kind: null, item: NO_FACTS, shop: null, price: null, listPrice: null, purchaseDate: null, size: null, articleNo: null, care: {} });

const NO_FACTS: Analysis = {
  path: { category: null, subcategory: null, type: null }, name: null, brand: null, colors: [], pattern: null, materials: [], styles: [], seasons: [],
  collar: null, closure: null, strap: null, fit: { width: null, length: null, rise: null }, layers: [], warmth: null, rain: null,
  profile: emptyProfile(), confidence: emptyConfidence(), model: null,
};

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
/** Passform als Text: Begriffe (Info/Analyse) direkt, Stufen (Formular) über die Skala der Kategorie */
const fitText = (category: string | null, fit: Partial<Record<FitScale['key'], number | string | null>>) =>
  (['width', 'length', 'rise'] as const).flatMap((k) => {
    const v = fit[k];
    if (v == null) return [];
    const label = { width: 'Weite', length: 'Länge', rise: 'Bund' }[k];
    // Begriff aus einer Info/Analyse oder Stufe aus dem Formular (Skala der Kategorie)
    const word = typeof v === 'string' ? fitWordLabel(k, v) : fitScaleOf(category, k)?.steps[v];
    return word ? [`${label} ${word}`] : [];
  });
const cut = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

type Facts = {
  name?: string | null; path?: CategoryPath; colors?: readonly string[]; pattern?: string | null; materials?: readonly MaterialPart[];
  fit?: Partial<Record<FitScale['key'], number | string | null>>; description?: string | null;
  /** Passform-Begriffe aus Name/Beschreibung mitschicken (nicht, wenn eine bestätigte Passform ihnen widerspräche) */
  nameTerms?: boolean;
  /** Kategorie für die Skalen-Wörter der Passform (sonst die aus `path`) */
  fitCategory?: string | null;
};

function factLines(x: Facts): string[] {
  const lines: string[] = [];
  if (x.name?.trim()) lines.push(`Name: ${x.name.trim()}`);
  const path = x.path ? pathText(x.path) : '';
  if (path) lines.push(`Kategorie: ${path}`);
  if (x.colors?.length) lines.push(`Farben: ${x.colors.map((c) => `${colorLabel(c)} (${c})`).join(', ')}`);
  if (x.pattern) lines.push(`Muster: ${patternLabel(x.pattern)} (${x.pattern})`);
  if (x.materials?.length) lines.push(`Material: ${materialText(x.materials)}`);
  const terms = x.nameTerms === false ? [] : fitTermsIn(`${x.name ?? ''} ${x.description ?? ''}`);
  const fit = [...terms, ...fitText(x.fitCategory !== undefined ? x.fitCategory : x.path?.category ?? null, x.fit ?? {})];
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
    // Etikett: nur, was ein Etikett tragen kann (Material mit %) – gleiche Regel wie beim Übernehmen (LABEL_FACTS)
    const lines = x.from === 'label'
      ? factLines({ materials: it.materials, nameTerms: false })
      : factLines({ name: it.name, path: it.path, colors: it.colors, pattern: it.pattern, materials: it.materials, fit: it.fit, description: x.from === 'page' ? description : null });
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
    // Skalen immer nach der aktuellen Kategorie (Kleid: „Mini“ statt „kurz“), auch wenn sie selbst noch offen ist
    fitCategory: f.category,
    // bestätigte Passform hat Vorrang vor Begriffen im Namen (sonst „slim, Weite normal“)
    nameTerms: fitOpen(f),
  });
  return lines.length ? `Vom Nutzer bestätigte Angaben, verlässlicher als das Foto:\n${lines.join('\n')}\nDas Profil soll zu diesen Angaben passen.` : '';
}
