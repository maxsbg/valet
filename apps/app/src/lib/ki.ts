// KI über die Edge Function `ki` (Durchreicher zu Gemini). Prompt, Schema und Prüfung kommen aus @valet/core.
import { ANALYZE_ITEM_PROMPT, ANALYZE_ITEM_SCHEMA, READ_INFO_SCHEMA, checkAnalysis, checkInfo, readInfoPrompt, readPagePrompt, type PageFacts, type Analysis, type Info, type InfoKind } from '@valet/core';
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

/** Antwort der Edge Function: geprüft wird in core, `model` = tatsächlich genutztes Modell */
type Answer = { data: unknown; model: string | null };

async function ask(image: Blob, prompt: string, schema: unknown, opts: { temperature?: number } = {}): Promise<Answer> {
  const data = await toBase64(image);
  const { data: res, error } = await supabase.functions.invoke('ki', {
    body: { image: { data, mimeType: image.type || 'image/jpeg' }, prompt, schema, ...opts },
  });
  if (error) throw error;
  return { data: res?.data, model: typeof res?.model === 'string' ? res.model : null };
}

/** Etikett, Shop-Screenshot oder Bestellbestätigung auslesen */
export async function readInfo(file: Blob, kind: InfoKind | null): Promise<Info> {
  return checkInfo((await ask(await shrink(file), readInfoPrompt(kind), READ_INFO_SCHEMA)).data);
}

/** Teil auf dem Bild erkennen. Wirft bei Fehler; „rate_limited“ = Gratis-Kontingent gerade erschöpft. */
export async function analyzePicture(image: Blob): Promise<Analysis> {
  // Temperatur 0: gleiches Bild → möglichst gleiches Profil (Spec 6.3)
  const { data, model } = await ask(image, ANALYZE_ITEM_PROMPT, ANALYZE_ITEM_SCHEMA, { temperature: 0 });
  return checkAnalysis(data, model);
}

/**
 * Gespeichertes Teil neu erkennen (Spec 8): Bild aus dem Storage über den Pfad (freigestelltes Hauptbild Seite A,
 * sonst Original). Wirft bei Fehler; kiError(e) liefert den Code („rate_limited“ …).
 */
export async function analyzeStored(imagePath: string): Promise<Analysis> {
  const { data: res, error } = await supabase.functions.invoke('ki', {
    body: { imagePath, prompt: ANALYZE_ITEM_PROMPT, schema: ANALYZE_ITEM_SCHEMA, temperature: 0 },
  });
  if (error) throw error;
  if (!res?.data || typeof res.data !== 'object') throw new Error('Ungültige Antwort der KI');
  return checkAnalysis(res.data, typeof res?.model === 'string' ? res.model : null);
}

/** Fehlercode der Edge Function („rate_limited“, HTTP-Status 404 …) aus einem Fehler lesen */
export async function kiError(e: unknown): Promise<{ code: string; status: number | null }> {
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
  return checkInfo(res?.data);
}
