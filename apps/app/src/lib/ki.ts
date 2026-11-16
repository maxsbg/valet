// KI über die Edge Function `ki` (Durchreicher zu Gemini). Prompt, Schema und Prüfung kommen aus @valet/core.
import { ANALYZE_ITEM_PROMPT, ANALYZE_ITEM_SCHEMA, checkAnalysis, type Analysis } from '@valet/core';
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

/** Teil auf dem Bild erkennen. Wirft bei Fehler; „rate_limited“ = Gratis-Kontingent gerade erschöpft. */
export async function analyzePicture(image: Blob): Promise<Analysis> {
  const data = await toBase64(image);
  const { data: res, error } = await supabase.functions.invoke('ki', {
    body: { image: { data, mimeType: image.type || 'image/jpeg' }, prompt: ANALYZE_ITEM_PROMPT, schema: ANALYZE_ITEM_SCHEMA },
  });
  if (error) throw error;
  return checkAnalysis(res?.data);
}
