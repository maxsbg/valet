// Oberfläche der KI-Analyse v2 (Spec Abschnitte 8, 11 Schritt 5 und 14): Passform als Begriffe, Blatt „KI-Analyse“,
// Einzel-Nachanalyse und Stapellauf „Profile ergänzen“. Reine Funktionen, die App zeichnet nur.

import { fitScalesOf } from '../categories';
import { LAYERS, RAIN, WARMTH, collarLabel, closureLabel, patternLabel, styleLabel } from '../attributes';
import { fieldsFor, strapLabel } from '../fields';
import { editChange, type EditForm } from '../edit';
import { PROFILE_FIELDS, activeProfile, profileLabel, type Ctx, type Group, type ProfileKey } from './profile';
import { applyAnalysis, profilePatch, type Analysis, type ProfilePatchRow } from './analyzeItem';

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** Bedingungen des Profils für das Formular (gespeicherte Keys) */
export const profileCtx = (f: Pick<EditForm, 'category' | 'subcategory' | 'pattern' | 'materials'>): Ctx => ({
  category: f.category, sub: f.subcategory, pattern: f.pattern, materials: f.materials.map((m) => m.name),
});

// ---------- Passform als Begriffe (Spec 14.2) ----------

/**
 * Kapseln der Zeile „Passform“: Form (silhouette bzw. leg bei Hose/Shorts), Weite, Länge, Bund, Schulter (nur ≠ „natural“).
 * Leere Werte entfallen; nur Profil-Felder, die für die Kategorie gelten. Beispiel Jeans: Zulaufend · Normal · Lang · Hoch.
 */
export function fitWords(f: Pick<EditForm, 'category' | 'subcategory' | 'pattern' | 'materials' | 'fit' | 'profile'>): string[] {
  const p = activeProfile(f.profile, profileCtx(f));
  const legs = f.category === 'pants' || f.category === 'shorts';
  const form = legs ? profileLabel('leg', p.leg) : profileLabel('silhouette', p.silhouette);
  const scales = fitScalesOf(f.category).map((sc) => (f.fit[sc.key] != null ? cap(sc.steps[f.fit[sc.key]!] ?? '') : ''));
  const shoulder = p.shoulder && p.shoulder !== 'natural' ? profileLabel('shoulder', p.shoulder) : '';
  return [form, ...scales, shoulder].filter(Boolean);
}

// ---------- Blatt „KI-Analyse“ ----------

export type AnalysisRow = { label: string; value: string };
export type AnalysisSection = { key: 'details' | 'wear' | Group; title: string; rows: AnalysisRow[]; /** Konfidenz der Gruppe < 6 → grau */ weak: boolean };
export type StoredMeta = { v: number; model: string | null; at: string | null; failed: { n: number; at: string | null } | null };

/** items.analysis.meta tolerant lesen (fehlt → null) */
export function storedMeta(analysis: unknown): StoredMeta | null {
  const m = isObj(analysis) ? analysis.meta : null;
  if (!isObj(m)) return null;
  const f = isObj(m.failed) ? m.failed : null;
  return {
    v: typeof m.v === 'number' ? m.v : 0,
    model: typeof m.model === 'string' && m.model ? m.model : null,
    at: typeof m.at === 'string' && m.at ? m.at : null,
    failed: f ? { n: typeof f.n === 'number' ? f.n : 0, at: typeof f.at === 'string' ? f.at : null } : null,
  };
}

/** Hat das Teil schon ein Profil der Analyse v2? */
export const hasProfile = (analysis: unknown): boolean => (storedMeta(analysis)?.v ?? 0) >= 2;

/** „Analysiert am 19.11.2026 mit gemini-3.5-flash-lite“; ohne Profil '' */
export function analysisNote(analysis: unknown): string {
  const m = storedMeta(analysis);
  if (!m || m.v < 2) return '';
  const d = m.at && /^\d{4}-\d{2}-\d{2}/.test(m.at) ? `${m.at.slice(8, 10)}.${m.at.slice(5, 7)}.${m.at.slice(0, 4)}` : '';
  return ['Analysiert', d && `am ${d}`, m.model && `mit ${m.model}`].filter(Boolean).join(' ');
}

const SECTION_TITLE: Record<Group, string> = { shape: 'Form', surface: 'Oberfläche', style: 'Wirkung' };
/** Zeilen im Blatt nicht wie ihr Abschnitt benennen (Labels in Bearbeiten bleiben) */
const ROW_LABEL: Partial<Record<ProfileKey, string>> = { silhouette: 'Silhouette', surface: 'Stoffbild', effects: 'Eindruck' };
const WEAK = 6;

/**
 * Abschnitte des Blatts: „Details“ und „Tragen“ (aus dem Steckbrief, Spec 14: Muster, Stil, Kragen/Ausschnitt, Verschluss,
 * Trägerart, Lagen, Wetter) und – nur mit Profil v2 – „Form“, „Oberfläche“, „Wirkung“ (nur activeProfile).
 * Leere Zeilen und Abschnitte entfallen.
 */
export function analysisSections(f: EditForm): AnalysisSection[] {
  const fx = fieldsFor(f.category, f.subcategory);
  const rev = fx.reversible && f.reversible;
  const row = (label: string, value: string | null | undefined): AnalysisRow[] => (value ? [{ label, value }] : []);
  const details: AnalysisRow[] = [
    ...(fx.pattern ? row(rev ? 'Muster Seite A' : 'Muster', f.pattern ? patternLabel(f.pattern) : '') : []),
    ...(fx.pattern && rev ? row('Muster Seite B', f.patternB ? patternLabel(f.patternB) : '') : []),
    ...row('Stil', f.styles.map(styleLabel).filter(Boolean).join(', ')),
    ...(fx.neckline ? row(fx.neckline.label, f.collar ? collarLabel(f.collar) : '') : []),
    ...(fx.closure ? row('Verschluss', f.closure ? closureLabel(f.closure) : '') : []),
    ...(fx.strap ? row('Trägerart', f.strap ? strapLabel(f.strap) : '') : []),
  ];
  const wear: AnalysisRow[] = [
    ...(fx.layers ? row('Lagen', [...f.layers].sort().map((i) => LAYERS[i]).filter(Boolean).join(' · ')) : []),
    ...(fx.layers && f.standalone ? row('Allein tragbar', 'ja') : []),
    ...(fx.weather ? row('Wärme', f.warmth != null ? WARMTH[f.warmth] : '') : []),
    ...(fx.weather ? row('Regen', f.rain != null ? RAIN[f.rain] : '') : []),
  ];
  const out: AnalysisSection[] = [
    { key: 'details', title: 'Details', rows: details, weak: false },
    { key: 'wear', title: 'Tragen', rows: wear, weak: false },
  ];
  if (hasProfile(f.analysisBase) || f.aiMeta) {
    const p = activeProfile(f.profile, profileCtx(f)) as Record<string, unknown>;
    for (const g of ['shape', 'surface', 'style'] as const) {
      const rows = PROFILE_FIELDS.filter((x) => x.group === g && x.key in p)
        .flatMap((x) => row(ROW_LABEL[x.key as ProfileKey] ?? x.label, profileLabel(x.key, p[x.key as ProfileKey])));
      const c = f.confidence[g];
      out.push({ key: g, title: SECTION_TITLE[g], rows, weak: c != null && c < WEAK });
    }
  }
  return out.filter((s) => s.rows.length > 0);
}

// ---------- Einzel-Nachanalyse („Neu analysieren“) ----------

/**
 * Änderung für „Neu analysieren“ (Spec 8 + 6.4): Steckbrief nur in leeren oder offenen Feldern, Profil ersetzt.
 * Geschrieben werden nur Spalten, die sich ändern (plus analysis und ai_pending). Scheitert der normale Speicherweg
 * (z. B. Altteil ohne Namen), wird wie im Stapellauf nur das Profil gespeichert.
 */
export function reanalysisChange(form: EditForm, row: ProfilePatchRow, a: Analysis, now: string = new Date().toISOString()): Record<string, unknown> {
  const before = editChange(form);
  const after = editChange(applyAnalysis(form, a, now));
  if ('error' in before || 'error' in after) return profilePatch(row, a, now);
  const out: Record<string, unknown> = { analysis: after.change.analysis, ai_pending: after.change.ai_pending };
  for (const [k, v] of Object.entries(after.change)) if (JSON.stringify(v) !== JSON.stringify(before.change[k])) out[k] = v;
  return out;
}

// ---------- Stapellauf „Profile ergänzen“ (Spec 8) ----------

/** Höchstens 6 Aufrufe je Minute und 100 je Tag (Gratis-Kontingent; ≥ 30 % bleiben für die normale Nutzung) */
export const BATCH_PER_MIN = 6;
export const BATCH_PER_DAY = 100;
/** Ab so vielen Fehlversuchen überspringt der Stapellauf ein Teil („Neu analysieren“ geht weiter) */
export const BATCH_MAX_FAILS = 3;

/** Noch zu ergänzen: kein Profil v2 und weniger als 3 Fehlversuche */
export const batchPending = (analysis: unknown): boolean => {
  const m = storedMeta(analysis);
  return (m?.v ?? 0) < 2 && (m?.failed?.n ?? 0) < BATCH_MAX_FAILS;
};
/** Übersprungen: kein Profil v2, aber schon 3 Fehlversuche */
export const batchSkipped = (analysis: unknown): boolean => {
  const m = storedMeta(analysis);
  return (m?.v ?? 0) < 2 && (m?.failed?.n ?? 0) >= BATCH_MAX_FAILS;
};

/** Fehlversuch vermerken: analysis.meta.failed = { n + 1, at }, alles andere bleibt */
export function failedPatch(analysis: Record<string, unknown> | null | undefined, now: string = new Date().toISOString()): { analysis: Record<string, unknown> } {
  const base = isObj(analysis) ? analysis : {};
  const meta = isObj(base.meta) ? base.meta : {};
  const n = (storedMeta(base)?.failed?.n ?? 0) + 1;
  return { analysis: { ...base, meta: { ...meta, failed: { n, at: now } } } };
}

/** Tageszähler (je Gerät): neuer Tag → 0 */
export const batchUsed = (stored: { day: string; n: number } | null | undefined, today: string): number =>
  stored && stored.day === today && typeof stored.n === 'number' ? stored.n : 0;

/** „x Teile ergänzt, z übersprungen“ */
export const batchSummary = (done: number, skipped: number): string =>
  `${done} ${done === 1 ? 'Teil' : 'Teile'} ergänzt, ${skipped} übersprungen`;
