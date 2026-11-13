// Freistellen im Browser mit RMBG-1.4 (public/freistellen/rmbg.js) und Bildaufbereitung fürs Hochladen.
// Nur im Web verfügbar; in der iOS-App kommt später Apple Vision dazu.
import { Platform } from 'react-native';

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
 * onStep meldet Fortschritt: beim ersten Mal den Download des Modells, danach die Durchgänge.
 */
export async function cutout(file: Blob, onStep: (text: string, p?: number) => void): Promise<Picture> {
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
  return { kind: 'cutout', main, thumb, preview: URL.createObjectURL(main), colors: mainColors(r.canvas) };
}

/** Foto unverändert übernehmen (nur verkleinert). Keine Farbanalyse – sie würde den Hintergrund mitzählen. */
export async function original(file: Blob): Promise<Picture> {
  const c = await fileToCanvas(file, MAIN_EDGE);
  const main = await toWebp(c, MAIN_EDGE, 0.88);
  const thumb = await toWebp(c, THUMB_EDGE, 0.85);
  return { kind: 'original', main, thumb, preview: URL.createObjectURL(main), colors: [] };
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
