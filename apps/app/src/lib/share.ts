import { Platform } from 'react-native';
import { boardLayout, BOARD_AR } from '@valet/core';
import type { OutfitPiece } from './outfits';
import type { Tile } from './wardrobe';

// Bilder exportieren (Web): als PNG über das Teilen-Menü (iPhone: „Bild sichern“), sonst als Download.

const IVORY = '#F5F0E8';
const OXBLOOD = '#722638';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous'; // Supabase-Speicher erlaubt das, sonst wäre die Leinwand gesperrt
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('Bild konnte nicht geladen werden.'));
    img.src = url;
  });
}

const toPng = (c: HTMLCanvasElement) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Bild konnte nicht erstellt werden.'))), 'image/png'));

/** Ergebnis eines Exports: Bild + ggf. Hinweis, was fehlt */
export type Exported = { blob: Blob; warning?: string };

/** Dateiname ohne Sonderzeichen */
export const fileName = (s: string) =>
  (s || 'valet').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'valet';

/** Teilen-Menü mit Datei; geht das nicht (z. B. Desktop-Browser), wird die Datei heruntergeladen. false = abgebrochen */
export async function shareFile(blob: Blob, name: string): Promise<boolean> {
  const file = new File([blob], name, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file] }); return true; }
    catch (e) { if ((e as Error).name === 'AbortError') return false; /* sonst herunterladen */ }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return true;
}

/** Bild eines Teils als PNG mit durchsichtigem Hintergrund (bleibt freigestellt) */
export async function itemPng(url: string): Promise<Blob> {
  const img = await loadImage(url);
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  c.getContext('2d')!.drawImage(img, 0, 0);
  return toPng(c);
}

/** Bild in ein Feld einpassen (contain, mittig) */
function drawContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Outfit als Bild: weiße Outfit-Fläche (gleiche Anordnung wie in der App) auf Elfenbein,
 * darunter der Name und klein der Schriftzug „valet“.
 * Fehlen Teil-Bilder (ohne Bild oder nicht ladbar), gibt es einen Hinweis; fehlen alle, schlägt der Export fehl.
 */
export async function outfitPng(pieces: OutfitPiece[], byId: Map<string, Tile>, title: string): Promise<Exported> {
  const items = pieces.map((p) => byId.get(p.id)).filter((i): i is Tile => !!i);
  const placed = boardLayout(items, Object.fromEntries(pieces.map((p) => [p.id, p])));
  const imgs = await Promise.all(placed.map((p) => {
    const it = p.item as Tile;
    const url = it.image ?? it.thumb;
    return url ? loadImage(url).catch(() => null) : Promise.resolve(null);
  }));
  const missing = imgs.filter((i) => !i).length;
  if (placed.length && missing === placed.length) throw new Error('Keines der Teil-Bilder konnte geladen werden. Bitte Verbindung prüfen und erneut versuchen.');

  const W = 1080, pad = 60;
  const bw = W - 2 * pad, bh = Math.round(bw * BOARD_AR);
  const H = pad + bh + 190;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = IVORY;
  ctx.fillRect(0, 0, W, H);

  // Fläche mit leichtem Schatten
  ctx.save();
  ctx.shadowColor = 'rgba(42,26,29,0.12)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6;
  roundRect(ctx, pad, pad, bw, bh, 36);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, pad, pad, bw, bh, 36);
  ctx.clip();
  placed
    .map((p, n) => ({ p, img: imgs[n] }))
    .sort((a, b) => a.p.z - b.p.z)
    .forEach(({ p, img }) => {
      if (!img) return;
      ctx.globalAlpha = (p.item as Tile).isWish ? 0.5 : 1;
      drawContain(ctx, img, pad + (p.left / 100) * bw, pad + (p.top / 100) * bh, (p.width / 100) * bw, (p.height / 100) * bh);
    });
  ctx.restore();

  // Name und Schriftzug (Gloock ist in der App geladen)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#2A1A1D';
  ctx.font = '56px Gloock_400Regular, Georgia, serif';
  let t = title;
  while (ctx.measureText(t).width > bw && t.length > 4) t = t.slice(0, -2).trimEnd() + '…';
  ctx.fillText(t, W / 2, pad + bh + 92);
  ctx.fillStyle = OXBLOOD;
  ctx.font = '36px Gloock_400Regular, Georgia, serif';
  ctx.fillText('valet', W / 2, pad + bh + 150);
  const blob = await toPng(c);
  return { blob, warning: missing ? `${missing === 1 ? '1 Teil fehlt' : `${missing} Teile fehlen`} im Bild (Bild nicht ladbar).` : undefined };
}

export const canExport = Platform.OS === 'web';
