// Stapellauf „Profile ergänzen“ (KI-Analyse v2, Spec 8): analysiert alle Teile ohne meta.v ≥ 2.
// Seit 20.11.2026 (Max): wie „Neu analysieren“ – Profil plus leere Felder (Wärme, Regen, Saison …) als KI-Vorschlag,
// danach analysis.review = offen → einzeln prüfen unter /ki-pruefen (Übernehmen / Überspringen).
// Läuft modulweit (nicht in der Seite), damit er beim Tab-Wechsel weiterläuft. Höchstens BATCH_PER_MIN je Minute
// und BATCH_PER_DAY je Tag (Zähler je Gerät). Bei „rate_limited“ pausiert er; beim nächsten Start geht es weiter.
import { useSyncExternalStore } from 'react';
import { hasProfile, profileFilled, BATCH_MAX_REJECTED_RUN, BATCH_PER_DAY, BATCH_PER_MIN, batchChange, batchErrorKind, confirmedContext, kiMessage, batchPending, batchSkipped, batchSummary, batchUsed, failedPatch, reviewKey, reviewOpen, toEditForm, type EditForm, type EditRow, type ProfilePatchRow } from '@valet/core';
import { loadItem } from './item';
import { supabase } from './supabase';
import { todayLocal } from './wardrobe';
import { analyzeStored, kiError } from './ki';

export type BatchState = {
  phase: 'idle' | 'loading' | 'running' | 'paused' | 'done' | 'error';
  /** offen beim Start dieses Laufs */
  total: number; done: number; failed: number;
  /** Teile ohne Profil, die nach 3 Fehlversuchen übersprungen werden (failed = in diesem Lauf fehlgeschlagen, wird erneut versucht) */
  skipped: number;
  /** in diesem Lauf schon angefasst (für „x von total“, auch übersprungene/inzwischen erledigte) */
  processed: number;
  message: string;
};

type Row = ProfilePatchRow & { id: string };

const KEY = 'valet-profile-batch';
const GAP_MS = Math.ceil(60000 / BATCH_PER_MIN);

let state: BatchState = { phase: 'idle', total: 0, done: 0, failed: 0, skipped: 0, processed: 0, message: '' };
let stopFlag = false;
/** Teil, an dem der Lauf zuletzt wegen eines vorübergehenden Fehlers pausierte (zweimal hintereinander → Fehlversuch) */
let pausedOn: string | null = null;
const subs = new Set<() => void>();
const set = (p: Partial<BatchState>) => { state = { ...state, ...p }; subs.forEach((f) => f()); };

function readDay(): { day: string; n: number } | null {
  try { return JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null'); } catch { return null; }
}
let memDay: { day: string; n: number } | null = null;
/** Heute schon verbrauchte Aufrufe */
export function usedToday(): number { return batchUsed(readDay() ?? memDay, todayLocal()); }
function countCall() {
  const v = { day: todayLocal(), n: usedToday() + 1 };
  memDay = v;
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(v)); } catch { /* egal */ }
}

/** Alle Teile des Schranks mit Analyse-Stand (seitenweise, 1000 je Abfrage) */
async function loadRows(wardrobeId: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('items').select('id,name,category,subcategory,pattern,materials,analysis,ai_pending')
      .eq('wardrobe_id', wardrobeId).order('id').range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) return out;
  }
}

/** IDs aller Teile (Schrank und Wunschliste) ohne KI-Profil v2 – für die Übersicht im Profil-Blatt */
export async function itemsWithoutProfile(wardrobeId: string): Promise<string[]> {
  const out: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('items').select('id,analysis').eq('wardrobe_id', wardrobeId).order('id').range(from, from + 999);
    if (error) throw error;
    for (const r of data ?? []) if (!hasProfile((r as { analysis: unknown }).analysis)) out.push((r as { id: string }).id);
    if (!data || data.length < 1000) return out;
  }
}

/** Hauptbild Seite A je Teil: freigestellt, sonst Original */
async function loadPaths(ids: string[]): Promise<Map<string, string>> {
  const best = new Map<string, { kind: string; path: string }>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase.from('item_images').select('item_id,side,kind,storage_path')
      .in('item_id', ids.slice(i, i + 200)).in('kind', ['cutout', 'original']);
    if (error) throw error;
    for (const r of data ?? []) {
      if ((r.side ?? 'a').trim().toLowerCase() === 'b') continue;
      const cur = best.get(r.item_id as string);
      if (!cur || (cur.kind !== 'cutout' && r.kind === 'cutout')) best.set(r.item_id as string, { kind: r.kind as string, path: r.storage_path as string });
    }
  }
  return new Map([...best].map(([k, v]) => [k, v.path]));
}

/** Ein Teil frisch laden (vor dem Speichern); gelöscht → null */
async function loadRow(id: string): Promise<Row | null> {
  const { data, error } = await supabase.from('items').select('id,name,category,subcategory,pattern,materials,analysis,ai_pending').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Row | null) ?? null;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const save = async (id: string, change: Record<string, unknown>) => {
  const r = await supabase.from('items').update(change).eq('id', id);
  if (r.error) throw r.error;
};

/** Offene und übersprungene Teile zählen (ohne Lauf) */
export async function countBatch(wardrobeId: string): Promise<{ pending: number; skipped: number; review: number }> {
  const rows = await loadRows(wardrobeId);
  return { pending: rows.filter((r) => batchPending(r.analysis)).length, skipped: rows.filter((r) => batchSkipped(r.analysis)).length, review: rows.filter((r) => reviewOpen(r.analysis)).length };
}

/** IDs der Teile mit offenem KI-Ergebnis, in Prüf-Reihenfolge (übersprungene hinten) */
export async function reviewQueue(wardrobeId: string): Promise<string[]> {
  const rows = await loadRows(wardrobeId);
  return rows.filter((r) => reviewOpen(r.analysis)).sort((a, b) => reviewKey(a.analysis).localeCompare(reviewKey(b.analysis))).map((r) => r.id);
}

/** Formular eines Teils frisch aus der Datenbank */
export async function loadForm(id: string): Promise<EditForm | null> {
  try { return toEditForm((await loadItem(id)).item as unknown as EditRow); } catch { return null; }
}
const rowOf = (f: EditForm): ProfilePatchRow => ({ category: f.category, subcategory: f.subcategory, pattern: f.pattern, materials: f.materials, analysis: f.analysisBase, ai_pending: f.aiPending, name: f.name });

export async function startBatch(wardrobeId: string) {
  if (state.phase === 'running' || state.phase === 'loading') return;
  stopFlag = false;
  set({ phase: 'loading', done: 0, failed: 0, processed: 0, message: '' });
  try {
    const rows = await loadRows(wardrobeId);
    const todo = rows.filter((r) => batchPending(r.analysis));
    const skipped = rows.filter((r) => batchSkipped(r.analysis)).length;
    set({ total: todo.length, skipped });
    if (!todo.length) { set({ phase: 'done', message: skipped ? batchSummary(0, 0, skipped) : 'Alle Teile haben ein Profil.' }); return; }
    const paths = await loadPaths(todo.map((r) => r.id));
    set({ phase: 'running' });
    let last = 0;
    let rejectedRun = 0;
    for (const r of todo) {
      if (stopFlag) { set({ phase: 'paused', message: 'Angehalten – „Weiter“ macht beim nächsten Teil weiter.' }); return; }
      const path = paths.get(r.id);
      if (path && usedToday() >= BATCH_PER_DAY) { set({ phase: 'paused', message: `Tagesgrenze erreicht (${BATCH_PER_DAY}). Morgen geht es weiter.` }); return; }
      set({ processed: state.processed + 1 });
      if (!path) { // kein Bild: kein Aufruf, nur vermerken (frisch gelesen, falls inzwischen analysiert)
        const now = await loadRow(r.id).catch(() => null);
        const patch = now && batchPending(now.analysis) ? failedPatch(now.analysis) : null;
        if (patch) await save(r.id, patch).catch(() => {});
        if (patch) { if (batchSkipped(patch.analysis)) set({ skipped: state.skipped + 1 }); else set({ failed: state.failed + 1 }); }
        continue;
      }
      if (usedToday() >= BATCH_PER_DAY) { set({ phase: 'paused', message: `Tagesgrenze erreicht (${BATCH_PER_DAY}). Morgen geht es weiter.` }); return; }
      const gap = last + GAP_MS - Date.now();
      if (gap > 0) await wait(gap);
      if (stopFlag) { set({ phase: 'paused', message: 'Angehalten – „Weiter“ macht beim nächsten Teil weiter.' }); return; }
      last = Date.now();
      let a: Awaited<ReturnType<typeof analyzeStored>>;
      let counted = false;
      try {
        // bestätigte Werte als Kontext, damit das Profil zu ihnen passt (wie „Neu analysieren“)
        const before = await loadForm(r.id);
        a = await analyzeStored(path, before ? confirmedContext(before) : '');
        countCall(); counted = true;
        // ohne Mode-Profil zählt die Antwort nicht als Ergänzung (sonst stünde ein leeres Profil als „analysiert“ da)
        if (!profileFilled(a)) throw new Error('empty_answer');
      } catch (e) {
        const { code, status } = await kiError(e);
        if (!counted && (status != null || code)) countCall(); // Anfrage kam an (zählt fürs Kontingent)
        const kind = batchErrorKind(code, status);
        const global = code === 'rate_limited' || status === 429 || code === 'config_error' || status === 401 || status === 403 || (status == null && !code);
        // scheitert dasselbe Teil nach „Weiter“ erneut vorübergehend, liegt es wohl am Teil → Fehlversuch statt Endlos-Pause
        if (kind === 'pause' && (global || pausedOn !== r.id)) {
          if (!global) pausedOn = r.id;
          set({ phase: 'paused', message: `${kiMessage(code, status)} Später „Weiter“ tippen.` });
          return;
        }
        pausedOn = null;
        const now = await loadRow(r.id).catch(() => null);
        const patch = failedPatch((now ?? r).analysis);
        await save(r.id, patch).catch(() => {});
        // dritter Fehlversuch: ab jetzt übersprungen (nicht „wird erneut versucht“)
        if (batchSkipped(patch.analysis)) set({ skipped: state.skipped + 1 }); else set({ failed: state.failed + 1 });
        rejectedRun = code === 'model_rejected' ? rejectedRun + 1 : 0;
        if (rejectedRun >= BATCH_MAX_REJECTED_RUN) {
          set({ phase: 'paused', message: `${BATCH_MAX_REJECTED_RUN} Teile hintereinander abgelehnt – vermutlich ein Problem bei der KI. Später „Weiter“ tippen.` });
          return;
        }
        continue;
      }
      pausedOn = null; rejectedRun = 0;
      try {
        // frisch lesen: wurde das Teil während des Laufs bearbeitet oder neu analysiert, gilt dessen Stand
        if (!(await loadRow(r.id))) continue; // inzwischen gelöscht
        const fresh = toEditForm((await loadItem(r.id)).item as unknown as EditRow);
        if (!batchPending(fresh.analysisBase)) continue; // inzwischen anders analysiert – nicht als „ergänzt“ zählen
        await save(r.id, batchChange(fresh, rowOf(fresh), a));
        set({ done: state.done + 1 });
      } catch (e) {
        console.warn('Profile ergänzen: Speichern', e);
        set({ phase: 'paused', message: 'Speichern fehlgeschlagen – bitte Verbindung prüfen und „Weiter“ tippen.' });
        return;
      }
    }
    set({ phase: 'done', message: batchSummary(state.done, state.failed, state.skipped) });
  } catch (e) {
    console.warn('Profile ergänzen', e);
    set({ phase: 'paused', message: 'Teile konnten nicht geladen werden – bitte Verbindung prüfen und „Weiter“ tippen.' });
  }
}

export function stopBatch() { stopFlag = true; }

export function useBatch(): BatchState {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => state, () => state);
}
