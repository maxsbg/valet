-- 1) Hosenlänge neu (Max, 21.11.2026): Skala cropped · ankle · regular · stacked (vorher cropped · regular · long).
--    Gespeichert wird der Index → regular 1 → 2, long 2 → 3 (stacked); cropped 0 bleibt. Nur Kategorie Hose.
-- 2) Neues Profilfeld Saum (hem): alle vorhandenen Hosen ohne Saum bekommen „open“ (Offen), Max 21.11.2026.
create table if not exists items_fit_backup_0018 as
  select id, fit_length, analysis -> 'profile' -> 'hem' as hem from items where category = 'pants';

update items set fit_length = 3 where category = 'pants' and fit_length = 2;
update items set fit_length = 2 where category = 'pants' and fit_length = 1;

update items
   set analysis = jsonb_set(coalesce(analysis, '{}'::jsonb), '{profile}', coalesce(analysis -> 'profile', '{}'::jsonb) || '{"hem": "open"}'::jsonb)
 where category = 'pants' and coalesce(analysis -> 'profile' ->> 'hem', '') = '';

-- Rückweg:
-- update items i set fit_length = b.fit_length from items_fit_backup_0018 b where b.id = i.id;
-- update items i set analysis = i.analysis #- '{profile,hem}' from items_fit_backup_0018 b where b.id = i.id and b.hem is null;
