// Bilder aus dem alten Valet übernehmen. Zwei Quellen:
//  • „storage“: Das alte Valet hat die Bilder direkt in den Bildspeicher geladen (<Schrank>/legacy/…), siehe parseTransferPaths
//  • „zip“: ZIP-Export aus dem alten Valet (falls das Herunterladen dort einmal geht)
// Danach: Teilen zuordnen, Bild + Vorschaubild speichern (saveImage), Zwischendateien aufräumen.
import {
  listZip, readZipEntry, imageType, parseImageCsv, parseTransferPaths, planImageImport, zipImages,
  type ImageJob, type ImagePlan, type DbImage, type DbItem,
} from '@valet/core';
import { supabase } from './supabase';
import { legacyPicture } from './cutout';
import { saveImage } from './item';

export type Prepared = {
  source: 'storage' | 'zip';
  plan: ImagePlan;
  imageCount: number;
  /** Datei lesen (Name aus job.file) */
  read: (file: string) => Promise<Blob>;
  /** Zwischendateien im Bildspeicher (nur „storage“), werden nach erfolgreicher Übernahme gelöscht */
  transferPaths: string[];
};

/** Alle Zeilen einer Abfrage (Supabase liefert höchstens 1.000 je Anfrage) */
async function all<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

async function dbRows(wardrobeId: string) {
  const items = await all<DbItem>((a, b) => supabase.from('items').select('id,legacy_id').eq('wardrobe_id', wardrobeId).order('id').range(a, b));
  const ids = new Set(items.map((i) => i.id));
  const images = (await all<DbImage>((a, b) => supabase.from('item_images').select('item_id,side,kind,legacy_id,colors').order('id').range(a, b)))
    .filter((im) => ids.has(im.item_id));
  return { items, images };
}

/** Dateien, die das alte Valet in den Bildspeicher übertragen hat */
export async function listTransfer(wardrobeId: string): Promise<string[]> {
  const dir = `${wardrobeId}/legacy`, out: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from('items').list(dir, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    for (const f of data ?? []) if (f.id) out.push(`${dir}/${f.name}`); // f.id null = Unterordner
    if (!data || data.length < 1000) return out;
  }
}

/** Übertragene Bilder aus dem Bildspeicher planen */
export async function prepareStorage(wardrobeId: string): Promise<Prepared> {
  const paths = await listTransfer(wardrobeId);
  const { files, csv } = parseTransferPaths(paths);
  if (!files.size) throw new Error('Im Bildspeicher liegen noch keine übertragenen Bilder. Zuerst im alten Valet „Direkt in die neue App übertragen“ ausführen.');
  const { items, images } = await dbRows(wardrobeId);
  return {
    source: 'storage', plan: planImageImport(files, csv, items, images), imageCount: files.size, transferPaths: paths,
    read: async (path) => {
      const { data, error } = await supabase.storage.from('items').download(path);
      if (error || !data) throw new Error(`Laden fehlgeschlagen: ${error?.message ?? 'leer'}`);
      return data.type.startsWith('image/') ? data : new Blob([data], { type: imageType(path) });
    },
  };
}

/** ZIP-Export planen (noch nichts hochladen) */
export async function prepareZip(wardrobeId: string, zip: Blob): Promise<Prepared> {
  const list = await listZip(zip);
  const entries = new Map(list.map((e) => [e.name, e]));
  const csvEntry = list.find((e) => e.name.split('/').pop() === 'bilder.csv');
  const csv = csvEntry ? parseImageCsv(await (await readZipEntry(zip, csvEntry)).text()) : [];
  const files = zipImages(list.map((e) => e.name));
  if (!files.size) throw new Error('In dieser ZIP-Datei sind keine Bilder. Bitte den Export „Alle Bilder (ZIP)“ aus dem alten Valet wählen.');
  const { items, images } = await dbRows(wardrobeId);
  return {
    source: 'zip', plan: planImageImport(files, csv, items, images), imageCount: files.size, transferPaths: [],
    read: async (name) => {
      const e = entries.get(name);
      if (!e) throw new Error('Datei fehlt im ZIP');
      return readZipEntry(zip, e, imageType(name));
    },
  };
}

/**
 * Führt alle Aufträge aus, zwei gleichzeitig (schneller, ohne das iPhone zu überlasten).
 * Fehler einzelner Bilder brechen nicht ab, sie werden gesammelt.
 */
export async function runImport(
  wardrobeId: string, p: Prepared,
  onProgress: (done: number, total: number, failed: number) => void,
  cancelled: () => boolean,
): Promise<{ ok: number; failed: { job: ImageJob; error: string }[] }> {
  const jobs = p.plan.jobs, failed: { job: ImageJob; error: string }[] = [];
  let next = 0, ok = 0;
  const worker = async () => {
    while (next < jobs.length && !cancelled()) {
      const job = jobs[next++];
      try {
        const pic = await legacyPicture(await p.read(job.file), job.kind, job.colors);
        await saveImage(wardrobeId, job.itemId, job.side, pic, job.legacyImageId);
        ok++;
      } catch (e) { failed.push({ job, error: (e as Error)?.message || String(e) }); }
      onProgress(ok + failed.length, jobs.length, failed.length);
    }
  };
  await Promise.all([worker(), worker()]);
  return { ok, failed };
}

/**
 * Räumt übertragene Dateien weg, die nicht mehr gebraucht werden: neu planen und alles löschen, was übernommen ist.
 * Bleiben: noch offene/fehlgeschlagene Bilder und Bilder ohne passendes Teil (kommen mit dem frischen Datenimport).
 */
export async function cleanupTransfer(wardrobeId: string): Promise<number> {
  const p = await prepareStorage(wardrobeId).catch(() => null);
  if (!p) return 0;
  const keep = new Set(p.plan.jobs.map((j) => j.file));
  const unmatched = new Set(p.plan.unmatched);
  const imageId = (path: string) => /@([^@/]+)\.\w+$/.exec(path)?.[1] ?? '';
  const remove = p.transferPaths.filter((x) => !keep.has(x) && !unmatched.has(imageId(x)) && !p.plan.jobs.some((j) => j.legacyImageId === imageId(x)));
  for (let i = 0; i < remove.length; i += 100) await supabase.storage.from('items').remove(remove.slice(i, i + 100));
  return remove.length;
}
