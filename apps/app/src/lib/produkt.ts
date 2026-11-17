// „Per Link hinzufügen“: Produktseite über die Edge Function `produkt` auslesen (Bilder, Text, Angaben).
// Bilder kommen ebenfalls über `produkt`, weil Safari fremde Bilder nicht als Datei lesen darf (CORS).
import type { PageFacts } from '@valet/core';
import { supabase, SUPABASE_URL } from './supabase';

export type ProductPage = {
  url: string;
  title: string | null;
  images: string[];
  facts: PageFacts;
  text: string;
  /** vermutlich Bot-Sperre (keine Bilder, kaum Text) */
  blocked: boolean;
};

/** Link aus geteiltem Text herausziehen („Schau mal: https://…“) */
export function findUrl(raw: string): string | null {
  const m = raw.match(/https?:\/\/[^\s<>"']+/i);
  if (m) return m[0].replace(/[).,;!?]+$/, '');
  const bare = raw.trim();
  return /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(bare) ? `https://${bare}` : null;
}

export async function loadProduct(url: string, html?: string): Promise<ProductPage> {
  const { data, error } = await supabase.functions.invoke('produkt', { body: html ? { url, html } : { url } });
  if (error) {
    let code = '';
    try { code = (await (error as { context?: Response }).context?.json())?.error ?? ''; } catch { /* egal */ }
    throw new Error(code || error.message);
  }
  return data as ProductPage;
}

/** Gewähltes Bild als Datei holen (für Freistellen + KI) */
export async function fetchImage(src: string, referer: string): Promise<File> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/produkt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
    body: JSON.stringify({ image: src, referer }),
  });
  if (!res.ok) throw new Error('Bild konnte nicht geladen werden');
  const blob = await res.blob();
  const ext = (blob.type.split('/')[1] ?? 'jpg').replace('jpeg', 'jpg');
  return new File([blob], `produkt.${ext}`, { type: blob.type || 'image/jpeg' });
}

/** Kurzer Hinweis zu Fehlern beim Laden der Seite */
export function productError(e: unknown): string {
  const m = String((e as Error)?.message ?? e);
  if (m.includes('invalid_url')) return 'Das sieht nicht nach einem gültigen Link aus.';
  if (m.includes('page_failed') || m.includes('blocked')) return 'Der Shop lässt die Seite nicht von außen laden.';
  if (m.includes('timeout')) return 'Die Seite hat zu lange gebraucht.';
  return 'Die Seite konnte nicht geladen werden.';
}
