// Bilder aus dem alten Valet übernehmen: ZIP-Export lesen, Teilen zuordnen, Bild + Vorschaubild hochladen.
import { listZip, readZipEntry, imageType, parseImageCsv, planImageImport, type ImageJob, type ImagePlan, type ZipEntry, type DbImage, type DbItem } from '@valet/core';
import { supabase } from './supabase';
import { legacyPicture } from './cutout';
import { saveImage } from './item';

export type Prepared = { zip: Blob; entries: Map<string, ZipEntry>; plan: ImagePlan; imageCount: number };

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

/** ZIP öffnen und planen, was zu tun ist (noch nichts hochladen) */
export async function prepare(wardrobeId: string, zip: Blob): Promise<Prepared> {
  const list = await listZip(zip);
  const entries = new Map(list.map((e) => [e.name, e]));
  const csvEntry = list.find((e) => e.name.split('/').pop() === 'bilder.csv');
  const csv = csvEntry ? parseImageCsv(await (await readZipEntry(zip, csvEntry)).text()) : [];
  const items = await all<DbItem>((a, b) => supabase.from('items').select('id,legacy_id').eq('wardrobe_id', wardrobeId).order('id').range(a, b));
  const ids = new Set(items.map((i) => i.id));
  const images = (await all<DbImage>((a, b) => supabase.from('item_images').select('item_id,side,kind,legacy_id,colors').order('id').range(a, b)))
    .filter((im) => ids.has(im.item_id));
  const plan = planImageImport(list.map((e) => e.name), csv, items, images);
  const imageCount = list.filter((e) => imageType(e.name) && !e.name.startsWith('__MACOSX/')).length;
  if (!imageCount) throw new Error('In dieser ZIP-Datei sind keine Bilder. Bitte den Export „Alle Bilder (ZIP)“ aus dem alten Valet wählen.');
  return { zip, entries, plan, imageCount };
}

/** Ein Bild übernehmen */
async function runJob(wardrobeId: string, p: Prepared, job: ImageJob) {
  const e = p.entries.get(job.file);
  if (!e) throw new Error('Datei fehlt im ZIP');
  const blob = await readZipEntry(p.zip, e, imageType(e.name));
  const pic = await legacyPicture(blob, job.kind, job.colors);
  await saveImage(wardrobeId, job.itemId, job.side, pic, job.legacyImageId);
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
      try { await runJob(wardrobeId, p, job); ok++; }
      catch (e) { failed.push({ job, error: (e as Error)?.message || String(e) }); }
      onProgress(ok + failed.length, jobs.length, failed.length);
    }
  };
  await Promise.all([worker(), worker()]);
  return { ok, failed };
}
