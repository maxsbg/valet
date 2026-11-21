// Stapellauf „Farbanteile nachtragen“ (Max 21.11.2026): schon analysierte, mehrfarbige Teile bekommen nur die
// Flächenanteile ihrer Farben (sharesMissing in core). Nichts zu prüfen – Profil und Farben bleiben unverändert.
// Teilt sich Minuten-/Tagesgrenze mit „Profile ergänzen“ (gleicher Zähler je Gerät). Fehlgeschlagene Teile bleiben
// offen und kommen beim nächsten Start wieder dran.
import { useSyncExternalStore } from 'react';
import { BATCH_PER_DAY, BATCH_PER_MIN, batchErrorKind, checkColorShares, colorSharesPrompt, colorSharesSchema, kiMessage, sharesChange, sharesMissing } from '@valet/core';
import { supabase } from './supabase';
import { kiError } from './ki';
import { countCall, usedToday } from './profileBatch';
import { analysisPaths } from './item';

export type SharesState = { phase: 'idle' | 'loading' | 'running' | 'paused' | 'done'; total: number; done: number; failed: number; processed: number; message: string };
type Row = { id: string; colors: string[] | null; analysis: unknown };

const GAP_MS = Math.ceil(60000 / BATCH_PER_MIN);
let state: SharesState = { phase: 'idle', total: 0, done: 0, failed: 0, processed: 0, message: '' };
let stopFlag = false;
const subs = new Set<() => void>();
const set = (p: Partial<SharesState>) => { state = { ...state, ...p }; subs.forEach((f) => f()); };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function loadRows(wardrobeId: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('items').select('id,colors,analysis').eq('wardrobe_id', wardrobeId).order('id').range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) return out;
  }
}

/** Teile, denen noch Farbanteile fehlen */
export async function countShares(wardrobeId: string): Promise<number> {
  return (await loadRows(wardrobeId)).filter((r) => sharesMissing(r.colors, r.analysis)).length;
}

async function askShares(path: string, colors: string[], backPath: string | null): Promise<number[]> {
  const { data: res, error } = await supabase.functions.invoke('ki', {
    body: { imagePath: path, prompt: colorSharesPrompt(colors, !!backPath), schema: colorSharesSchema(colors), temperature: 0, ...(backPath ? { backPath } : {}) },
  });
  if (error) throw error;
  const shares = checkColorShares(res?.data, colors);
  if (!shares) throw new Error('empty_answer');
  return shares;
}

export async function startShares(wardrobeId: string) {
  if (state.phase === 'running' || state.phase === 'loading') return;
  stopFlag = false;
  set({ phase: 'loading', done: 0, failed: 0, processed: 0, message: '' });
  try {
    const todo = (await loadRows(wardrobeId)).filter((r) => sharesMissing(r.colors, r.analysis));
    set({ total: todo.length });
    if (!todo.length) { set({ phase: 'done', message: 'Alle mehrfarbigen Teile haben Farbanteile.' }); return; }
    const paths = await analysisPaths(todo.map((r) => r.id));
    set({ phase: 'running' });
    let last = 0;
    for (const r of todo) {
      if (stopFlag) { set({ phase: 'paused', message: 'Angehalten – „Weiter“ macht beim nächsten Teil weiter.' }); return; }
      set({ processed: state.processed + 1 });
      const path = paths.get(r.id)?.path;
      if (!path) { set({ failed: state.failed + 1 }); continue; }
      if (usedToday() >= BATCH_PER_DAY) { set({ phase: 'paused', message: `Tagesgrenze erreicht (${BATCH_PER_DAY}). Morgen geht es weiter.` }); return; }
      const gap = last + GAP_MS - Date.now();
      if (gap > 0) await wait(gap);
      last = Date.now();
      let shares: number[];
      try {
        shares = await askShares(path, r.colors ?? [], paths.get(r.id)?.back ?? null);
        countCall();
      } catch (e) {
        const { code, status } = await kiError(e);
        if (status != null || code) countCall();
        if (batchErrorKind(code, status) === 'pause') { set({ phase: 'paused', message: `${kiMessage(code, status)} Später „Weiter“ tippen.` }); return; }
        set({ failed: state.failed + 1 });
        continue;
      }
      try {
        // frisch lesen: Farben inzwischen geändert oder neu analysiert → nicht überschreiben
        const { data: now, error } = await supabase.from('items').select('colors,analysis').eq('id', r.id).maybeSingle();
        if (error) throw error;
        if (!now || !sharesMissing(now.colors, now.analysis) || JSON.stringify(now.colors) !== JSON.stringify(r.colors)) continue;
        const u = await supabase.from('items').update(sharesChange(now.analysis, r.colors ?? [], shares)).eq('id', r.id);
        if (u.error) throw u.error;
        set({ done: state.done + 1 });
      } catch (e) {
        console.warn('Farbanteile: Speichern', e);
        set({ phase: 'paused', message: 'Speichern fehlgeschlagen – bitte Verbindung prüfen und „Weiter“ tippen.' });
        return;
      }
    }
    set({ phase: 'done', message: `${state.done} ${state.done === 1 ? 'Teil' : 'Teile'} ergänzt${state.failed ? ` · ${state.failed} fehlgeschlagen (nächster Start versucht sie erneut)` : ''}.` });
  } catch (e) {
    console.warn('Farbanteile', e);
    set({ phase: 'paused', message: 'Teile konnten nicht geladen werden – bitte Verbindung prüfen und „Weiter“ tippen.' });
  }
}

export function stopShares() { stopFlag = true; }

export function useShares(): SharesState {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => state, () => state);
}
