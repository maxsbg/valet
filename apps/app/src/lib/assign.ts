// Bilder zuordnen: viele Fotos auf einmal wählen, freistellen und den Teilen ohne Bild zuordnen.
// (Übergang vom alten Valet: Dort lassen sich die Bilder nicht automatisch herausholen – Download, Teilen und Netz sind gesperrt.)
import { supabase } from './supabase';
import { canCutout, cutout, legacyPicture, original, type Picture } from './cutout';
import type { Tile } from './wardrobe';

/** Eine Seite eines Teils, die noch kein Vorschaubild hat */
export type Missing = { item: Tile; side: 'a' | 'b' };

/** Seiten ohne Vorschaubild: Seite A jedes Teils, bei Wendeteilen auch Seite B */
export async function loadMissing(items: Tile[]): Promise<Missing[]> {
  const ids = new Set(items.map((i) => i.id));
  const has = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('item_images').select('item_id,side').eq('kind', 'thumb').order('id').range(from, from + 999);
    if (error) throw error;
    for (const r of data ?? []) if (ids.has(r.item_id)) has.add(`${r.item_id}:${(r.side ?? 'a').trim().toLowerCase()}`);
    if (!data || data.length < 1000) break;
  }
  const out: Missing[] = [];
  for (const item of items) {
    if (!has.has(`${item.id}:a`)) out.push({ item, side: 'a' });
    if (item.reversible && !has.has(`${item.id}:b`)) out.push({ item, side: 'b' });
  }
  return out;
}

/**
 * Foto vorbereiten: schon freigestellte Bilder (durchsichtiger Rand, z. B. aus dem alten Valet gesichert) ohne Modell
 * übernehmen (zugeschnitten, Schatten entfernt – siehe `cutout`), sonst freistellen (RMBG).
 * Klappt das Freistellen nicht, bleibt das Original.
 */
export async function preparePhoto(file: File, onStep: (text: string, p?: number) => void): Promise<Picture> {
  if (!canCutout) return withPreview(await legacyPicture(file, null, null));
  try { return await cutout(file, onStep); }
  catch { return withPreview(await legacyPicture(file, null, null)); }
}

export async function originalPhoto(file: File): Promise<Picture> { return original(file); }

const withPreview = (p: Picture): Picture => ({ ...p, preview: p.preview || URL.createObjectURL(p.main) });

/** Farbabstand zweier Hex-Farben (für die Sortierung „ähnliche Farbe zuerst“) */
export function colorDistance(a: string | null | undefined, b: string | null | undefined): number {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  if (!a || !b || !/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return 1e9;
  const [r, g, bl] = rgb(a), [r2, g2, b2] = rgb(b);
  return 2 * (r! - r2!) ** 2 + 4 * (g! - g2!) ** 2 + 3 * (bl! - b2!) ** 2;
}
