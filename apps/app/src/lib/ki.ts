// KI über die Edge Function `ki` (Durchreicher zu Gemini). Prompt, Schema und Prüfung kommen aus @valet/core.
import { ANALYZE_ITEM_PROMPT, BACK_SIDE_NOTE, ANALYZE_ITEM_SCHEMA, READ_INFO_SCHEMA, analysisUsable, pagePriceInEuro, checkAnalysis, checkInfo, readInfoPrompt, readPagePrompt, type PageFacts, type Analysis, type Info, type InfoKind } from '@valet/core';
import { supabase } from './supabase';

/** Blob → Base64 ohne data:-Präfix */
function toBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

/** Großes Foto (Kamera, Screenshot) verkleinern: lange Seite höchstens `max` px, JPEG. Text bleibt lesbar. */
async function shrink(file: Blob, max = 2000): Promise<Blob> {
  if (typeof document === 'undefined') return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Bild nicht lesbar'));
      i.src = url;
    });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Bild nicht lesbar'))), 'image/jpeg', 0.85));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Leere oder kaputte Antwort der KI (kein Objekt, nichts Brauchbares) – zählt als Fehlschlag, nie als „analysiert“ */
const EMPTY = 'empty_answer';
function usable(data: unknown, model: string | null): Analysis {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(EMPTY);
  const a = checkAnalysis(data, model);
  if (!analysisUsable(a)) throw new Error(EMPTY);
  return a;
}

/** Antwort der Edge Function: geprüft wird in core, `model` = tatsächlich genutztes Modell */
type Answer = { data: unknown; model: string | null };

async function ask(image: Blob, prompt: string, schema: unknown, opts: { temperature?: number; text?: string; back?: Blob | null } = {}): Promise<Answer> {
  const data = await toBase64(image);
  const { text, back, ...rest } = opts;
  const backImage = back ? { data: await toBase64(back), mimeType: back.type || 'image/jpeg' } : null;
  const { data: res, error } = await supabase.functions.invoke('ki', {
    body: { image: { data, mimeType: image.type || 'image/jpeg' }, prompt, schema, ...rest, ...(text ? { text } : {}), ...(backImage ? { backImage } : {}) },
  });
  if (error) throw error;
  return { data: res?.data, model: typeof res?.model === 'string' ? res.model : null };
}

/** Etikett, Shop-Screenshot oder Bestellbestätigung auslesen */
export async function readInfo(file: Blob, kind: InfoKind | null, hint = ''): Promise<Info> {
  return checkInfo((await ask(await shrink(file), readInfoPrompt(kind, hint), READ_INFO_SCHEMA)).data);
}

/**
 * Teil auf dem Bild erkennen. `context` = Angaben aus Shopseite/Screenshot/Etikett (infoContext), die die Edge Function
 * hinter den Prompt hängt. Wirft bei Fehler; „rate_limited“ = Gratis-Kontingent gerade erschöpft.
 */
export async function analyzePicture(image: Blob, context = '', back: Blob | null = null): Promise<Analysis> {
  // Temperatur 0: gleiches Bild → möglichst gleiches Profil (Spec 6.3); Rückseite (Backprint) als zweites Bild
  const { data, model } = await ask(image, ANALYZE_ITEM_PROMPT, ANALYZE_ITEM_SCHEMA, { temperature: 0, text: withBack(context, !!back).slice(0, 20000), back });
  return usable(data, model);
}

/**
 * Gespeichertes Teil neu erkennen (Spec 8): Bild aus dem Storage über den Pfad (freigestelltes Hauptbild Seite A,
 * sonst Original). `context` geht als Text hinter den Prompt. Wirft bei Fehler; kiError(e) liefert den Code („rate_limited“ …).
 */
export async function analyzeStored(imagePath: string, context = '', backPath: string | null = null): Promise<Analysis> {
  // context: bestätigte Steckbrief-Werte (confirmedContext), damit das Profil zu ihnen passt; backPath = Rückseite (Backprint)
  const text = withBack(context, !!backPath);
  const { data: res, error } = await supabase.functions.invoke('ki', {
    body: { imagePath, prompt: ANALYZE_ITEM_PROMPT, schema: ANALYZE_ITEM_SCHEMA, temperature: 0, ...(text ? { text: text.slice(0, 20000) } : {}), ...(backPath ? { backPath } : {}) },
  });
  if (error) throw error;
  return usable(res?.data, typeof res?.model === 'string' ? res.model : null);
}

/** Kontext um den Rückseiten-Hinweis ergänzen (nur mit zweitem Bild) */
const withBack = (context: string, back: boolean) => (back ? [BACK_SIDE_NOTE, context].filter(Boolean).join('\n\n') : context);

/** Fehlercode der Edge Function („rate_limited“, „empty_answer“, HTTP-Status 404 …) aus einem Fehler lesen; ohne Status = Netzfehler */
export async function kiError(e: unknown): Promise<{ code: string; status: number | null }> {
  if (e instanceof Error && e.message === EMPTY) return { code: EMPTY, status: null };
  const ctx = (e as { context?: Response } | null)?.context;
  const status = typeof ctx?.status === 'number' ? ctx.status : null;
  let code = '';
  try { code = String((await ctx?.clone().json())?.error ?? ''); } catch { /* egal */ }
  if (!code && status === 429) code = 'rate_limited';
  return { code, status };
}

/** Text einer Produktseite auslesen (Beschreibung, Material, Pflege, Preis …) – ohne Bild */
export async function readPage(text: string, facts: PageFacts): Promise<Info> {
  const { data: res, error } = await supabase.functions.invoke('ki', {
    body: { text: text.slice(0, 20000), prompt: readPagePrompt(facts), schema: READ_INFO_SCHEMA },
  });
  if (error) throw error;
  return pagePriceInEuro(checkInfo(res?.data), facts);
}
