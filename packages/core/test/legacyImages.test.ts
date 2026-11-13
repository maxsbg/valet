import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { listZip, readZipEntry, imageType } from '../src/import/zip';
import { parseImageCsv, parseTransferPaths, planImageImport, zipImages, type DbImage } from '../src/import/legacyImages';

// ZIP wie im alten Valet (makeZip), wahlweise mit Deflate
function makeZip(files: { name: string; data: Uint8Array; deflate?: boolean }[]): Blob {
  const enc = new TextEncoder(), parts: Uint8Array[] = [], cen: Uint8Array[] = [];
  let off = 0;
  for (const f of files) {
    const nm = enc.encode(f.name), body = f.deflate ? new Uint8Array(deflateRawSync(f.data)) : f.data, method = f.deflate ? 8 : 0;
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(6, 0x0800, true); h.setUint16(8, method, true);
    h.setUint32(18, body.length, true); h.setUint32(22, f.data.length, true); h.setUint16(26, nm.length, true);
    parts.push(new Uint8Array(h.buffer), nm, body);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(8, 0x0800, true); c.setUint16(10, method, true);
    c.setUint32(20, body.length, true); c.setUint32(24, f.data.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    cen.push(new Uint8Array(c.buffer), nm);
    off += 30 + nm.length + body.length;
  }
  const size = cen.reduce((s, a) => s + a.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, size, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...cen, new Uint8Array(e.buffer)]);
}

test('ZIP lesen: ohne Kompression und Deflate', async () => {
  const a = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
  const b = new TextEncoder().encode('Bild-Datei;Bild-ID\n'.repeat(50));
  const zip = makeZip([{ name: 'bilder/abc.png', data: a }, { name: 'bilder.csv', data: b, deflate: true }]);
  const list = await listZip(zip);
  assert.deepEqual(list.map((x) => x.name), ['bilder/abc.png', 'bilder.csv']);
  const png = await readZipEntry(zip, list[0], imageType(list[0].name));
  assert.equal(png.type, 'image/png');
  assert.deepEqual(new Uint8Array(await png.arrayBuffer()), a);
  const csv = await readZipEntry(zip, list[1]);
  assert.equal(await csv.text(), new TextDecoder().decode(b));
});

test('Keine ZIP-Datei → verständlicher Fehler', async () => {
  await assert.rejects(listZip(new Blob(['hallo'])), /keine ZIP/);
});

test('Bilddateien im ZIP nach alter Bild-ID', () => {
  const m = zipImages(['bilder/', 'bilder/x1.png', 'bilder/x2.webp', '__MACOSX/bilder/._x1.png', 'bilder.csv', 'bilder/.DS_Store']);
  assert.deepEqual([...m.entries()], [['x1', 'bilder/x1.png'], ['x2', 'bilder/x2.webp']]);
});

test('bilder.csv lesen (BOM, Anführungszeichen)', () => {
  const csv = '﻿Bild-Datei;Bild-ID;Seite;Teil-ID;Name;Marke;Kategorie\nbilder/b1.png;b1;A;i1;"Hose; weit";X;Hose\nbilder/b2.png;b2;B;i1;Hose;X;Hose\n';
  assert.deepEqual(parseImageCsv(csv), [
    { file: 'bilder/b1.png', imageId: 'b1', side: 'a', legacyItemId: 'i1' },
    { file: 'bilder/b2.png', imageId: 'b2', side: 'b', legacyItemId: 'i1' },
  ]);
});

test('Plan: DB-Zeilen, Vorschaubild vorhanden, fehlend, Rückgriff über CSV', () => {
  const names = ['bilder/hose.png', 'bilder/shirtA.png', 'bilder/shirtB.png', 'bilder/neu.png', 'bilder/fremd.png', 'bilder/fertig.png'];
  const items = [
    { id: 'H', legacy_id: 'iHose' }, { id: 'S', legacy_id: 'iShirt' }, { id: 'N', legacy_id: 'iNeu' }, { id: 'F', legacy_id: 'iFertig' },
  ];
  const images: DbImage[] = [
    { item_id: 'H', side: 'a', kind: 'cutout', legacy_id: 'hose', colors: [{ h: '#191c23', s: 0.99 }] },
    { item_id: 'S', side: 'A ', kind: 'cutout', legacy_id: 'shirtA', colors: null },
    { item_id: 'S', side: 'b', kind: 'cutout', legacy_id: 'shirtB', colors: [{ h: 'kaputt' }] },
    { item_id: 'F', side: 'a', kind: 'cutout', legacy_id: 'fertig', colors: null },
    { item_id: 'F', side: 'a', kind: 'thumb', legacy_id: null, colors: null },
    { item_id: 'H', side: 'b', kind: 'cutout', legacy_id: 'weg', colors: null },
  ];
  const csv = [
    { file: '', imageId: 'neu', side: 'a' as const, legacyItemId: 'iNeu' },
    { file: '', imageId: 'hose', side: 'a' as const, legacyItemId: 'iHose' },
    { file: '', imageId: 'fremd', side: 'a' as const, legacyItemId: 'gibtsNicht' },
  ];
  const p = planImageImport(zipImages(names), csv, items, images);
  assert.deepEqual(p.jobs.map((j) => [j.itemId, j.side, j.legacyImageId, j.kind]), [
    ['H', 'a', 'hose', 'cutout'], ['S', 'a', 'shirtA', 'cutout'], ['S', 'b', 'shirtB', 'cutout'], ['N', 'a', 'neu', null],
  ]);
  assert.deepEqual(p.jobs[0].colors, [{ h: '#191c23', s: 0.99 }]);
  assert.equal(p.jobs[2].colors, null);
  assert.equal(p.done, 1);
  assert.deepEqual(p.missing, ['weg']);
  assert.deepEqual(p.unmatched, ['fremd']);
});

test('Plan ist wiederholbar: nach dem Import gibt es nichts mehr zu tun', () => {
  const images: DbImage[] = [
    { item_id: 'H', side: 'a', kind: 'cutout', legacy_id: 'hose', colors: null },
    { item_id: 'H', side: 'a', kind: 'thumb', legacy_id: 'hose', colors: null },
  ];
  const p = planImageImport(zipImages(['bilder/hose.png']), [], [{ id: 'H', legacy_id: 'iHose' }], images);
  assert.equal(p.jobs.length, 0);
  assert.equal(p.done, 1);
  assert.deepEqual(p.unmatched, []);
});

test('Direktübertragung: Zuordnung aus dem Dateinamen', () => {
  const w = 'e3601e23-c683-4c16-b88f-547194bc2cf6';
  const { files, csv } = parseTransferPaths([`${w}/legacy/a@iShirt@blobA.png`, `${w}/legacy/b@iShirt@blobB.webp`, `${w}/legacy/kaputt.png`]);
  assert.deepEqual([...files.entries()], [['blobA', `${w}/legacy/a@iShirt@blobA.png`], ['blobB', `${w}/legacy/b@iShirt@blobB.webp`]]);
  assert.deepEqual(csv.map((c) => [c.side, c.legacyItemId, c.imageId]), [['a', 'iShirt', 'blobA'], ['b', 'iShirt', 'blobB']]);
  const p = planImageImport(files, csv, [{ id: 'S', legacy_id: 'iShirt' }], [{ item_id: 'S', side: 'a', kind: 'cutout', legacy_id: 'blobA', colors: null }]);
  assert.deepEqual(p.jobs.map((j) => [j.side, j.legacyImageId, j.kind]), [['a', 'blobA', 'cutout'], ['b', 'blobB', null]]);
});
