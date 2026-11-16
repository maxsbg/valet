// Freistellen im Browser mit RMBG-1.4 (public/freistellen/rmbg.js) und Bildaufbereitung fürs Hochladen.
// Nur im Web verfügbar; in der iOS-App kommt später Apple Vision dazu.
import { Platform } from 'react-native';
import { analyzePrecut } from '@valet/core';

type RmbgResult = { canvas: HTMLCanvasElement; file: Blob; thumb: Blob | null; info: Record<string, unknown> };
type Rmbg = {
  load: (onProgress?: (p: number) => void) => Promise<{ fromCache: boolean }>;
  isCached: () => Promise<boolean>;
  cutout: (file: Blob, mode: 'alt2', onStep?: (step: string, p?: number) => void) => Promise<RmbgResult>;
  engineName: () => string;
  ready: boolean;
};
declare global { interface Window { ValetRMBG?: Rmbg } }

export const canCutout = Platform.OS === 'web';

/** Fertiges Bild zum Speichern: Hauptbild + Vorschaubild für die Kacheln + Hauptfarben */
export type Picture = {
  kind: 'cutout' | 'original';
  main: Blob;
  thumb: Blob;
  /** Anzeige vor dem Speichern (Objekt-URL) */
  preview: string;
  colors: { h: string; s: number }[];
  /** Wie freigestellt: Modell, schon sauber (nur zugeschnitten) oder Schatten entfernt (ohne Modell) */
  source?: 'model' | 'clean' | 'shadow';
};

/** Größte Kante des gespeicherten Hauptbildes – hält den kostenlosen Speicher (1 GB) lange frei */
const MAIN_EDGE = 1200;
const THUMB_EDGE = 400;

let script: Promise<Rmbg> | null = null;
function loadScript(): Promise<Rmbg> {
  if (window.ValetRMBG) return Promise.resolve(window.ValetRMBG);
  if (!script) script = new Promise<Rmbg>((res, rej) => {
    const el = document.createElement('script');
    el.src = `${process.env.EXPO_BASE_URL ?? ''}/freistellen/rmbg.js`;
    el.onload = () => (window.ValetRMBG ? res(window.ValetRMBG) : rej(new Error('Freistellen konnte nicht gestartet werden')));
    el.onerror = () => { script = null; rej(new Error('Freistellen konnte nicht geladen werden (keine Verbindung?)')); };
    document.head.appendChild(el);
  });
  return script;
}

/** true, wenn das Modell schon im Gerät gespeichert ist (kein 44-MB-Download nötig) */
export async function modelCached(): Promise<boolean> {
  if (!canCutout) return false;
  try { return await (await loadScript()).isCached(); } catch { return false; }
}

/**
 * Stellt das Teil frei (Variante „Neues Alt“).
 * Schon freigestellte Bilder (durchsichtiger Rand) gehen nicht durchs Modell: sauber → nur zuschneiden,
 * mit Schatten → Schatten entfernen und zuschneiden (`analyzePrecut` in core). opts.model erzwingt das Modell.
 * onStep meldet Fortschritt: beim ersten Mal den Download des Modells, danach die Durchgänge.
 */
export async function cutout(file: Blob, onStep: (text: string, p?: number) => void, opts: { model?: boolean } = {}): Promise<Picture> {
  if (!opts.model) {
    onStep('Prüfe Bild …', 0);
    const pre = await precut(file).catch(() => null);
    if (pre) return pre;
  }
  const R = await loadScript();
  if (!R.ready) {
    const cached = await R.isCached();
    onStep(cached ? 'Starte Freistellen …' : 'Lade Freistell-Modell (einmalig, 44 MB) …', 0);
    await R.load(cached ? undefined : (p) => onStep(`Lade Freistell-Modell (einmalig) … ${Math.round(p * 44)} von 44 MB`, p));
  }
  const r = await R.cutout(file, 'alt2', (step, p) => onStep(step.replace(/ …$/, '') + ' …', p));
  onStep('Bild wird vorbereitet …', 1);
  const main = await toWebp(r.canvas, MAIN_EDGE, 0.9);
  const thumb = r.thumb ?? await toWebp(r.canvas, THUMB_EDGE, 0.85);
  return { kind: 'cutout', main, thumb, preview: URL.createObjectURL(main), colors: mainColors(r.canvas), source: 'model' };
}

/** Größte Kante beim Prüfen schon freigestellter Bilder (wie die Arbeitsgröße des Modells) */
const PRECUT_EDGE = 2000;

/** Schon freigestelltes Bild ohne Modell aufbereiten; null = normales Foto (oder kaum Deckendes) → Modell */
async function precut(file: Blob): Promise<Picture | null> {
  const c = await fileToCanvas(file, PRECUT_EDGE);
  const W = c.width, H = c.height, x = c.getContext('2d', { willReadFrequently: true })!;
  const img = x.getImageData(0, 0, W, H), d = img.data, alpha = new Uint8Array(W * H);
  for (let i = 0; i < alpha.length; i++) alpha[i] = d[i * 4 + 3]!;
  const r = analyzePrecut(alpha, W, H);
  if (r.kind === 'photo' || !r.box) return null;
  if (r.kind === 'shadow') { for (let i = 0; i < alpha.length; i++) d[i * 4 + 3] = r.alpha[i]!; x.putImageData(img, 0, 0); }
  const { x0, y0, x1, y1 } = r.box, out = document.createElement('canvas');
  out.width = x1 - x0; out.height = y1 - y0;
  out.getContext('2d')!.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  const main = await toWebp(out, MAIN_EDGE, 0.9);
  const thumb = await toWebp(out, THUMB_EDGE, 0.85);
  return { kind: 'cutout', main, thumb, preview: URL.createObjectURL(main), colors: mainColors(out), source: r.kind };
}

/** Hinweis im „Passt das so?“-Schritt, wenn das Modell übersprungen wurde */
export function precutNote(p: Picture | null): string | null {
  if (p?.source === 'clean') return 'War schon freigestellt – nur zugeschnitten.';
  if (p?.source === 'shadow') return 'War schon freigestellt – Schatten entfernt und zugeschnitten.';
  return null;
}

/** Foto unverändert übernehmen (nur verkleinert). Keine Farbanalyse – sie würde den Hintergrund mitzählen. */
export async function original(file: Blob): Promise<Picture> {
  const c = await fileToCanvas(file, MAIN_EDGE);
  const main = await toWebp(c, MAIN_EDGE, 0.88);
  const thumb = await toWebp(c, THUMB_EDGE, 0.85);
  return { kind: 'original', main, thumb, preview: URL.createObjectURL(main), colors: [] };
}

/**
 * Bild aus dem alten Valet übernehmen: verkleinern, Vorschaubild erzeugen, Farben übernehmen oder berechnen.
 * kind = null → am Bild entscheiden: durchsichtiger Rand = freigestellt.
 */
export async function legacyPicture(file: Blob, kind: 'cutout' | 'original' | null, colors: Picture['colors'] | null): Promise<Picture> {
  const c = await fileToCanvas(file, MAIN_EDGE);
  const k = kind ?? (transparentEdge(c) ? 'cutout' : 'original');
  const main = await toWebp(c, MAIN_EDGE, 0.9);
  const thumb = await toWebp(c, THUMB_EDGE, 0.85);
  return { kind: k, main, thumb, preview: '', colors: colors ?? (k === 'cutout' ? mainColors(c) : []) };
}

/** true, wenn der Bildrand überwiegend durchsichtig ist (freigestelltes Teil) */
function transparentEdge(c: HTMLCanvasElement): boolean {
  const d = c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height).data;
  let n = 0, t = 0;
  const at = (x: number, y: number) => { n++; if (d[(y * c.width + x) * 4 + 3] < 128) t++; };
  for (let x = 0; x < c.width; x += 2) { at(x, 0); at(x, c.height - 1); }
  for (let y = 0; y < c.height; y += 2) { at(0, y); at(c.width - 1, y); }
  return n > 0 && t / n > 0.5;
}

async function fileToCanvas(file: Blob, maxEdge: number): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const k = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
    const x = c.getContext('2d')!; x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } catch { throw new Error('Das Foto ließ sich nicht öffnen.'); }
  finally { URL.revokeObjectURL(url); }
}

/** Verkleinert (falls nötig) und speichert als WebP; Safari ohne WebP-Encoder → PNG (Freigestelltes) */
async function toWebp(src: HTMLCanvasElement, maxEdge: number, q: number): Promise<Blob> {
  let c = src;
  const k = Math.min(1, maxEdge / Math.max(src.width, src.height));
  if (k < 1) {
    c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(src.width * k)); c.height = Math.max(1, Math.round(src.height * k));
    const x = c.getContext('2d')!; x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, c.width, c.height);
  }
  const blob = (type: string) => new Promise<Blob | null>((r) => c.toBlob(r, type, q));
  const webp = await blob('image/webp');
  if (webp && webp.type === 'image/webp') return webp;
  const png = await blob('image/png');
  if (!png) throw new Error('Bild konnte nicht gespeichert werden.');
  return png;
}

/**
 * Hauptfarben des Bildes wie im alten Valet ([{h: '#rrggbb', s: Anteil}]), durchsichtige Pixel zählen nicht.
 * Grobe Farbwürfel (4 Bit je Kanal), die größten 5 mit gemitteltem Farbton.
 */
function mainColors(src: HTMLCanvasElement): { h: string; s: number }[] {
  const k = Math.min(1, 96 / Math.max(src.width, src.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(src.width * k)); c.height = Math.max(1, Math.round(src.height * k));
  const x = c.getContext('2d', { willReadFrequently: true })!; x.drawImage(src, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  const bins = new Map<number, [number, number, number, number]>();
  let total = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 160) continue;
    const key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
    const b = bins.get(key) ?? [0, 0, 0, 0];
    b[0] += d[i]; b[1] += d[i + 1]; b[2] += d[i + 2]; b[3]++;
    bins.set(key, b); total++;
  }
  if (!total) return [];
  const hex = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return [...bins.values()].sort((a, b) => b[3] - a[3]).slice(0, 5)
    .map(([r, g, b, n]) => ({ h: `#${hex(r / n)}${hex(g / n)}${hex(b / n)}`, s: Math.round((n / total) * 1000) / 1000 }));
}
