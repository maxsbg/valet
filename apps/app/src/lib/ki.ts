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

async function ask(image: Blob, prompt: string, schema: unknown): Promise<unknown> {
  const data = await toBase64(image);
  const { data: res, error } = await supabase.functions.invoke('ki', {
    body: { image: { data, mimeType: image.type || 'image/jpeg' }, prompt, schema },
  });
  if (error) throw error;
  return res?.data;
}

/** Etikett, Shop-Screenshot oder Bestellbestätigung auslesen */
export async function readInfo(file: Blob, kind: InfoKind | null): Promise<Info> {
  return checkInfo(await ask(await shrink(file), readInfoPrompt(kind), READ_INFO_SCHEMA));
}

/** Teil auf dem Bild erkennen. Wirft bei Fehler; „rate_limited“ = Gratis-Kontingent gerade erschöpft. */
export async function analyzePicture(image: Blob): Promise<Analysis> {
  return checkAnalysis(await ask(image, ANALYZE_ITEM_PROMPT, ANALYZE_ITEM_SCHEMA));
}

/** Text einer Produktseite auslesen (Beschreibung, Material, Pflege, Preis …) – ohne Bild */
export async function readPage(text: string, facts: PageFacts): Promise<Info> {
  const { data: res, error } = await supabase.functions.invoke('ki', {
    body: { text: text.slice(0, 20000), prompt: readPagePrompt(facts), schema: READ_INFO_SCHEMA },
  });
  if (error) throw error;
  return checkInfo(res?.data);
}
