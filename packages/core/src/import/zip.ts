// Kleiner ZIP-Leser für den Bilder-Export aus dem alten Valet („Valet_Komplett_<Datum>.zip“).
// Liest nur das Inhaltsverzeichnis am Dateiende und holt jede Datei einzeln per Blob.slice –
// so muss das ganze ZIP (oft > 100 MB) nie auf einmal in den Speicher (wichtig am iPhone).
// Unterstützt „ohne Kompression“ (so schreibt das alte Valet) und „Deflate“ (falls das ZIP am Mac neu gepackt wurde).

export interface ZipEntry {
  name: string;
  /** 0 = ohne Kompression, 8 = Deflate */
  method: number;
  compressedSize: number;
  size: number;
  /** Lage des lokalen Datei-Kopfes im ZIP */
  headerOffset: number;
}

const u8 = async (b: Blob) => new Uint8Array(await b.arrayBuffer());

/** Liest das Inhaltsverzeichnis eines ZIP (ohne ZIP64 – reicht bis 4 GB bzw. 65.535 Dateien). */
export async function listZip(zip: Blob): Promise<ZipEntry[]> {
  // Ende-Eintrag suchen: 22 Bytes + bis zu 64 KB Kommentar
  const tailStart = Math.max(0, zip.size - 22 - 0xffff);
  const tail = await u8(zip.slice(tailStart));
  const tv = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) if (tv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Das ist keine ZIP-Datei.');
  const count = tv.getUint16(eocd + 10, true);
  const cdSize = tv.getUint32(eocd + 12, true);
  const cdOffset = tv.getUint32(eocd + 16, true);
  if (cdOffset === 0xffffffff || count === 0xffff) throw new Error('Diese ZIP-Datei ist zu groß (ZIP64 wird nicht unterstützt).');
  const cd = await u8(zip.slice(cdOffset, cdOffset + cdSize));
  const v = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
  const out: ZipEntry[] = [];
  let p = 0;
  for (let k = 0; k < count; k++) {
    if (p + 46 > cd.length || v.getUint32(p, true) !== 0x02014b50) throw new Error('Das Inhaltsverzeichnis der ZIP-Datei ist beschädigt.');
    const flags = v.getUint16(p + 8, true);
    const nameLen = v.getUint16(p + 28, true), extraLen = v.getUint16(p + 30, true), commentLen = v.getUint16(p + 32, true);
    const raw = cd.subarray(p + 46, p + 46 + nameLen);
    // Bit 11 = UTF-8; ältere Packer nutzen CP437, für unsere Namen (IDs, ASCII) egal
    const name = new TextDecoder(flags & 0x800 ? 'utf-8' : 'latin1').decode(raw);
    out.push({
      name,
      method: v.getUint16(p + 10, true),
      compressedSize: v.getUint32(p + 20, true),
      size: v.getUint32(p + 24, true),
      headerOffset: v.getUint32(p + 42, true),
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/** Holt eine Datei aus dem ZIP als Blob (entpackt, falls nötig). */
export async function readZipEntry(zip: Blob, e: ZipEntry, type = ''): Promise<Blob> {
  const h = await u8(zip.slice(e.headerOffset, e.headerOffset + 30));
  const hv = new DataView(h.buffer, h.byteOffset, h.byteLength);
  if (h.length < 30 || hv.getUint32(0, true) !== 0x04034b50) throw new Error(`${e.name}: Datei im ZIP beschädigt`);
  const start = e.headerOffset + 30 + hv.getUint16(26, true) + hv.getUint16(28, true);
  const data = zip.slice(start, start + e.compressedSize);
  if (e.method === 0) return type ? new Blob([data], { type }) : data;
  if (e.method === 8) {
    const stream = data.stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const buf = await new Response(stream).arrayBuffer();
    return new Blob([buf], type ? { type } : undefined);
  }
  throw new Error(`${e.name}: Kompressionsart ${e.method} wird nicht unterstützt`);
}

/** Bildtyp nach Dateiendung */
export function imageType(name: string): string {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  return ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : '';
}
