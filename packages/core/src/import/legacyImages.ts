// Zuordnung der Bilder aus dem alten Valet (ZIP-Export) zu den Teilen in Supabase.
// Reine Funktionen ohne Netz: Eingabe = Dateinamen im ZIP, bilder.csv und die Zeilen aus der DB, Ausgabe = Aufträge.
//
// Aufbau des ZIP (Funktion exportAllZip im alten Valet):
//   bilder/<alte Bild-ID>.<png|webp|jpg>
//   bilder.csv   Bild-Datei;Bild-ID;Seite;Teil-ID;Name;Marke;Kategorie   (Seite = A/B, Teil-ID = alte Teil-ID)
//   valet-daten.json, evtl. fehlende-bilder.txt

import type { Side } from '../model';

export interface DbItem { id: string; legacy_id: string | null }
export interface DbImage { item_id: string; side: string | null; kind: string; legacy_id: string | null; colors: unknown }
export interface CsvImage { file: string; imageId: string; side: Side; legacyItemId: string }

export interface ImageJob {
  itemId: string;
  side: Side;
  legacyImageId: string;
  /** Dateiname im ZIP */
  file: string;
  /** Art aus der DB-Zeile; null = beim Import am Bild entscheiden (durchsichtig → cutout) */
  kind: 'cutout' | 'original' | null;
  /** Farben aus dem alten Valet ([{h, s}]), sonst null → werden aus dem Bild berechnet */
  colors: { h: string; s: number }[] | null;
}

export interface ImagePlan {
  jobs: ImageJob[];
  /** Seiten, die schon ein Vorschaubild haben (bereits übernommen oder neu fotografiert) */
  done: number;
  /** Alte Bild-IDs aus der DB, die im ZIP fehlen */
  missing: string[];
  /** Bilder im ZIP, zu denen kein Teil gefunden wurde */
  unmatched: string[];
}

const normSide = (v: string | null | undefined): Side => ((v ?? 'a').trim().toLowerCase() === 'b' ? 'b' : 'a');

/** Bilddateien im ZIP: alte Bild-ID (Dateiname ohne Ordner/Endung) → Dateiname */
export function zipImages(names: string[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const n of names) {
    if (n.endsWith('/') || n.startsWith('__MACOSX/')) continue;
    const base = n.split('/').pop() ?? '';
    if (base.startsWith('.')) continue;
    const dot = base.lastIndexOf('.');
    if (dot <= 0) continue;
    if (!/^(png|webp|jpe?g|gif)$/i.test(base.slice(dot + 1))) continue;
    m.set(base.slice(0, dot), n);
  }
  return m;
}

/** Einfacher CSV-Leser (Semikolon, Anführungszeichen, BOM) */
export function parseCsv(text: string, sep = ';'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x !== ''));
}

/** bilder.csv aus dem Export lesen */
export function parseImageCsv(text: string): CsvImage[] {
  const [head, ...rows] = parseCsv(text);
  if (!head) return [];
  const col = (n: string) => head.findIndex((h) => h.trim() === n);
  const f = col('Bild-Datei'), id = col('Bild-ID'), sd = col('Seite'), it = col('Teil-ID');
  if (id < 0 || it < 0) return [];
  return rows
    .map((r) => ({ file: f >= 0 ? r[f] ?? '' : '', imageId: (r[id] ?? '').trim(), side: normSide(sd >= 0 ? r[sd] : 'a'), legacyItemId: (r[it] ?? '').trim() }))
    .filter((r) => r.imageId && r.legacyItemId);
}

const colorsOf = (v: unknown): { h: string; s: number }[] | null => {
  if (!Array.isArray(v)) return null;
  const c = v.filter((x): x is { h: string; s: number } => !!x && typeof x.h === 'string' && /^#[0-9a-f]{6}$/i.test(x.h) && typeof x.s === 'number');
  return c.length ? c : null;
};

/**
 * Plant die Übernahme:
 * 1. Bildzeilen aus dem Datenimport (item_images mit legacy_id) bekommen ihr Bild, falls die Seite noch kein Vorschaubild hat.
 * 2. Teile, die beim Datenimport kein Bild bekamen, werden über bilder.csv (alte Teil-ID + Seite) gefunden.
 * Seiten mit Vorschaubild werden nie angefasst – der Import kann also gefahrlos wiederholt werden.
 * files: alte Bild-ID → Datei (Name im ZIP bzw. Pfad im Bildspeicher), siehe zipImages / parseTransferPaths.
 */
export function planImageImport(files: Map<string, string>, csv: CsvImage[], items: DbItem[], images: DbImage[]): ImagePlan {
  const key = (item: string, side: Side) => `${item}:${side}`;
  const hasThumb = new Set<string>();
  const hasMain = new Set<string>();
  for (const im of images) {
    const k = key(im.item_id, normSide(im.side));
    if (im.kind === 'thumb') hasThumb.add(k); else hasMain.add(k);
  }

  const jobs: ImageJob[] = [];
  const planned = new Set<string>();
  const used = new Set<string>();
  const missing = new Set<string>();
  const done = new Set<string>();

  for (const im of images) {
    if (im.kind === 'thumb' || !im.legacy_id) continue;
    const side = normSide(im.side), k = key(im.item_id, side);
    if (hasThumb.has(k)) { done.add(k); used.add(im.legacy_id); continue; }
    if (planned.has(k)) continue;
    const file = files.get(im.legacy_id);
    if (!file) { missing.add(im.legacy_id); continue; }
    planned.add(k); used.add(im.legacy_id);
    jobs.push({ itemId: im.item_id, side, legacyImageId: im.legacy_id, file, kind: im.kind === 'original' ? 'original' : 'cutout', colors: colorsOf(im.colors) });
  }

  const byLegacy = new Map<string, string>();
  for (const it of items) if (it.legacy_id) byLegacy.set(it.legacy_id, it.id);
  for (const r of csv) {
    const itemId = byLegacy.get(r.legacyItemId);
    const file = files.get(r.imageId);
    if (!itemId || !file) continue;
    const k = key(itemId, r.side);
    if (hasThumb.has(k)) { done.add(k); used.add(r.imageId); continue; }
    if (hasMain.has(k) || planned.has(k)) { if (planned.has(k)) used.add(r.imageId); continue; }
    planned.add(k); used.add(r.imageId);
    jobs.push({ itemId, side: r.side, legacyImageId: r.imageId, file, kind: null, colors: null });
  }

  const unmatched = [...files.keys()].filter((id) => !used.has(id));
  return { jobs, done: done.size, missing: [...missing], unmatched };
}

/**
 * Direktübertragung aus dem alten Valet in den Bildspeicher (Bucket „items“):
 *   <Schrank>/legacy/<Seite a|b>@<alte Teil-ID>@<alte Bild-ID>.<png|webp|jpg>
 * Die Zuordnung steckt im Dateinamen, weil der Bucket nur Bilder annimmt (keine CSV).
 */
export function parseTransferPaths(paths: string[]): { files: Map<string, string>; csv: CsvImage[] } {
  const files = new Map<string, string>();
  const csv: CsvImage[] = [];
  for (const path of paths) {
    const m = /^([ab])@([^@/]+)@([^@/]+)\.(png|webp|jpe?g)$/i.exec(path.split('/').pop() ?? '');
    if (!m) continue;
    const [, side, legacyItemId, imageId] = m as unknown as [string, string, string, string];
    if (!files.has(imageId)) files.set(imageId, path);
    csv.push({ file: path, imageId, side: side.toLowerCase() as Side, legacyItemId });
  }
  return { files, csv };
}
