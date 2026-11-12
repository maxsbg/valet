// Wandelt die Komplettsicherung des alten Valet (Export → „Sicherung kopieren“) in ein SQL-Skript für Supabase um.
// Aufruf: npx tsx scripts/backup-to-sql.ts <sicherung.json> <cutoutFeedback.json|-> <auth-user-id> > import.sql
// Das Skript läuft in einer Transaktion: entweder alles wird importiert oder nichts.

import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { convertLegacy, type LegacyDoc, type LegacyExport } from '../packages/core/src/import/legacy';

const [backupPath, feedbackPath, ownerUserId] = process.argv.slice(2);
if (!backupPath || !feedbackPath || !ownerUserId) {
  console.error('Aufruf: tsx scripts/backup-to-sql.ts <sicherung.json> <cutoutFeedback.json|-> <auth-user-id>');
  process.exit(1);
}

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const backup = read(backupPath);

// Objekte aus dem App-Export haben die ID im Datensatz selbst → in {id, data} umformen
const docs = (list: Record<string, unknown>[]): LegacyDoc[] =>
  list.map(({ id, ...data }) => ({ id: String(id), data }));

const src: LegacyExport = {
  people: docs(backup.profile),
  wishlists: docs(backup.wunschlisten),
  items: docs(backup.teile),
  outfits: docs(backup.outfits),
  daily: Object.entries(backup.tagesvorschlaege as Record<string, Record<string, unknown>>).map(([id, data]) => ({ id, data })),
  cutoutFeedback: feedbackPath === '-' ? [] : read(feedbackPath),
};

const wardrobeId = randomUUID();
const r = convertLegacy(src, wardrobeId, randomUUID);

const now = new Date().toISOString();
const fill = (rows: Record<string, unknown>[]) =>
  rows.map((row) => ({ ...row, created_at: row.created_at ?? now, updated_at: row.updated_at ?? row.created_at ?? now }));

const DOLLAR = '$valet$';
const insert = (table: string, rows: Record<string, unknown>[]) => {
  if (!rows.length) return `-- ${table}: keine Zeilen`;
  const json = JSON.stringify(fill(rows));
  if (json.includes(DOLLAR)) throw new Error(`Daten für ${table} enthalten ${DOLLAR}`);
  return `insert into ${table} select * from json_populate_recordset(null::${table}, ${DOLLAR}${json}${DOLLAR}::json);`;
};

// Die Person, die zum Login gehört (Profil „Max“), mit dem Login verknüpfen
const ownerPerson = r.persons.find((p) => p.name === 'Max');

const out = [
  '-- Valet: Import der Sicherung vom ' + String(backup.exportiert ?? 'unbekannt'),
  '-- Erzeugt am ' + now + ' mit scripts/backup-to-sql.ts',
  'begin;',
  `insert into wardrobes (id, name, created_by) values ('${wardrobeId}', 'Max & Paul', '${ownerUserId}');`,
  insert('persons', r.persons),
  ownerPerson ? `update persons set user_id = '${ownerUserId}' where id = '${ownerPerson.id}';` : '-- keine Person „Max“ gefunden',
  insert('wishlists', r.wishlists),
  insert('items', r.items),
  insert('item_images', r.itemImages),
  insert('wears', r.wears),
  insert('outfits', r.outfits),
  insert('outfit_items', r.outfitItems),
  insert('outfit_plans', r.outfitPlans),
  insert('reservations', r.reservations),
  insert('daily_suggestions', r.dailySuggestions),
  insert('cutout_feedback', r.cutoutFeedback),
  'commit;',
  '',
  '-- Kontrolle: Anzahl je Tabelle',
  `select 'persons' t, count(*) from persons union all select 'items', count(*) from items union all select 'outfits', count(*) from outfits union all select 'item_images', count(*) from item_images union all select 'daily_suggestions', count(*) from daily_suggestions;`,
].join('\n\n');

process.stdout.write(out + '\n');

const summary = {
  wardrobeId,
  persons: r.persons.length, wishlists: r.wishlists.length, items: r.items.length, itemImages: r.itemImages.length,
  wears: r.wears.length, outfits: r.outfits.length, outfitItems: r.outfitItems.length, outfitPlans: r.outfitPlans.length,
  reservations: r.reservations.length, dailySuggestions: r.dailySuggestions.length, cutoutFeedback: r.cutoutFeedback.length,
  warnings: r.warnings,
};
console.error(JSON.stringify(summary, null, 2));
