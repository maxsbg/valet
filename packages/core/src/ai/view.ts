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
  const set = fitScalesOf(f.category).filter((sc) => f.fit[sc.key] != null);
  const words = set.map((sc) => sc.steps[f.fit[sc.key]!] ?? '');
  // Spec 14.2 („Zulaufend · Normal · Lang · Hoch“): je Stufe nur das Wort, ohne Bezeichnung (Max, 20.11.2026)
  const scales = words.map((w) => cap(w));
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

/** Zeitstempel → Tag in Ortszeit „20.11.2026“ (23:30Z ist in Deutschland schon der nächste Tag); ungültig → '' */
function localDay(at: string | null): string {
  if (!at) return '';
  const t = new Date(at);
  if (Number.isNaN(t.getTime())) return '';
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(t.getDate())}.${two(t.getMonth() + 1)}.${t.getFullYear()}`;
}

/** „Analysiert am 19.11.2026 mit gemini-3.5-flash-lite“; ohne Profil '' */
export function analysisNote(analysis: unknown): string {
  const m = storedMeta(analysis);
  if (!m || m.v < 2) return '';
  const d = localDay(m.at);
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
  const ctx = profileCtx(f);
  const p = activeProfile(f.profile, ctx) as Record<string, unknown>;
  const shown = (label: string, value: string | null | undefined): AnalysisRow =>
    ({ label, value: value || 'Noch nicht angegeben' });
  const details: AnalysisRow[] = [
    ...(fx.pattern ? [shown(rev ? 'Muster Seite A' : 'Muster', f.pattern ? patternLabel(f.pattern) : '')] : []),
    ...(fx.pattern && rev ? [shown('Muster Seite B', f.patternB ? patternLabel(f.patternB) : '')] : []),
    shown('Stil', f.styles.map(styleLabel).filter(Boolean).join(', ')),
    ...(fx.neckline ? [shown(fx.neckline.label, f.collar ? collarLabel(f.collar) : '')] : []),
    ...(fx.closure ? [shown('Verschluss', f.closure ? closureLabel(f.closure) : '')] : []),
    ...(fx.strap ? [shown('Trägerart', f.strap ? strapLabel(f.strap) : '')] : []),
  ];
  const wear: AnalysisRow[] = [
    ...(fx.layers ? [shown('Lagen', [...f.layers].sort().map((i) => LAYERS[i]).filter(Boolean).join(' · '))] : []),
    ...(fx.layers ? [shown('Allein tragbar', f.standalone ? 'Ja' : 'Nein')] : []),
    ...(fx.weather ? [shown('Wärme', f.warmth != null ? WARMTH[f.warmth] : '')] : []),
    ...(fx.weather ? [shown('Regen', f.rain != null ? RAIN[f.rain] : '')] : []),
  ];
  const out: AnalysisSection[] = [
    { key: 'details', title: 'Details', rows: details, weak: false },
    { key: 'wear', title: 'Tragen', rows: wear, weak: false },
  ];
  if (hasProfile(f.analysisBase)) {
    for (const g of ['shape', 'surface', 'style'] as const) {
      const rows = PROFILE_FIELDS.filter((x) => x.group === g && x.applies(ctx))
        .map((x) => ({ label: ROW_LABEL[x.key as ProfileKey] ?? x.label, value: profileLabel(x.key, p[x.key as ProfileKey]) }))
        .filter((row) => row.value !== '');
      const confidence = f.confidence[g];
      out.push({ key: g, title: SECTION_TITLE[g], rows, weak: confidence != null && confidence < WEAK });
    }
  }
  return out.filter((section) => section.rows.length > 0);
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

/** Ab so vielen „model_rejected“ hintereinander liegt es eher am Anbieter als an den Teilen → Lauf anhalten */
export const BATCH_MAX_REJECTED_RUN = 3;

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

/** „x Teile ergänzt, y fehlgeschlagen, z übersprungen“ (fehlgeschlagen = wird beim nächsten Start erneut versucht) */
export const batchSummary = (done: number, failed: number, skipped: number): string =>
  [`${done} ${done === 1 ? 'Teil' : 'Teile'} ergänzt`, failed ? `${failed} fehlgeschlagen` : '', `${skipped} übersprungen`].filter(Boolean).join(', ');

/**
 * Fehler im Stapellauf einordnen: `pause` = vorübergehend (Kontingent, Überlast, Zeitüberschreitung, kein Netz,
 * abgelaufene Anmeldung) – Lauf anhalten, kein Fehlversuch; `fail` = am Teil selbst (Bild fehlt, 404/413, `model_rejected` 422, ungültige/leere Antwort) – Fehlversuch zählen.
 */
export function batchErrorKind(code: string, status: number | null): 'pause' | 'fail' {
  if (code === 'rate_limited' || status === 429) return 'pause';
  if (status === 401 || status === 403) return 'pause'; // Sitzung abgelaufen: nicht dem Teil anlasten
  if (status == null && !code) return 'pause';
  if (code === 'config_error') return 'pause';
  if (status != null && status >= 500 && status !== 501) return 'pause';
  return 'fail';
}

/**
 * Verständlicher Satz zu einem Fehler der KI (Code/Status aus kiError), für Blatt, Formular und „Infos auslesen“.
 * Nie rohe englische Codes zeigen.
 */
export function kiMessage(code: string, status: number | null): string {
  if (code === 'rate_limited' || status === 429) return 'Das Gratis-Kontingent der KI ist gerade erschöpft. Bitte später noch einmal.';
  if (code === 'empty_answer') return 'Die KI hat nichts Brauchbares geliefert. Bitte noch einmal versuchen.';
  if (code === 'not_member') return 'Die KI steht erst zur Verfügung, wenn du einem Schrank beigetreten bist.';
  if (status === 401 || status === 403) return 'Anmeldung abgelaufen. Bitte neu laden und noch einmal versuchen.';
  if (status === 404) return 'Das Bild wurde nicht gefunden.';
  if (code === 'model_rejected' || status === 422) return 'Die KI konnte das nicht auswerten. Ein anderes Foto bzw. ein anderer Link hilft oft.';
  if (status === 413) return 'Das Bild bzw. der Text ist zu groß oder hat ein unbekanntes Format.';
  if (code === 'config_error') return 'Die KI ist gerade falsch eingerichtet (Schlüssel oder Modell). Bitte Bescheid geben.';
  if (status == null) return 'Keine Verbindung zur KI. Bitte Netz prüfen und noch einmal versuchen.';
  if (status >= 400 && status < 500) return 'Die Anfrage an die KI war ungültig. Bitte noch einmal versuchen.';
  return 'Die KI ist gerade nicht erreichbar. Bitte später noch einmal.';
}
