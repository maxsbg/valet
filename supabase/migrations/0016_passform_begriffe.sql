-- Passform: Begriffe statt „schmal … weit“ / „kurz … lang“ (Max, 20.11.2026).
-- Gespeichert bleibt der Index der Skala je Kategorie (packages/core/src/categories.ts, FIT_SCALES):
--   Oberteil Weite  slim · regular · relaxed · oversized     (vorher 5 Stufen)
--   Hose Weite      skinny · slim · regular · relaxed · wide (5 Stufen, unverändert)
--   Shorts Weite    slim · regular · relaxed · wide          (vorher 5 Stufen)
--   Oberteil Länge  cropped · regular · longline             (vorher 5 Stufen)
--   Hose Länge      cropped · regular · long                 (vorher 5 Stufen)
--   Shorts Länge    short · mid · long                       (vorher 5 Stufen)
--   Kleid/Rock-Länge und Bund unverändert.
-- Erst NACH dem Merge der App anwenden, die die neuen Skalen zeigt.
-- Alte Werte bleiben in items_fit_backup_0016 (Rückweg: siehe Ende der Datei).

begin;

create table if not exists items_fit_backup_0016 as
  select id, category, fit_width, fit_length from items where fit_width is not null or fit_length is not null;
alter table items_fit_backup_0016 enable row level security;

-- Weite 5 → 4 Stufen: schmal/eher schmal → Slim, normal → Regular, eher weit → Relaxed, weit → Oversized/Wide
update items set fit_width = case fit_width when 0 then 0 when 1 then 0 when 2 then 1 when 3 then 2 when 4 then 3 end
where category in ('top', 'shorts') and fit_width is not null;

-- Länge 5 → 3 Stufen: kurz/eher kurz → Cropped/Short, normal → Regular/Mid, eher lang/lang → Longline/Long
update items set fit_length = case fit_length when 0 then 0 when 1 then 0 when 2 then 1 when 3 then 2 when 4 then 2 end
where category in ('top', 'pants', 'shorts') and fit_length is not null;

commit;

-- Prüfung danach (muss 0 Zeilen liefern):
-- select id from items where (category in ('top','shorts') and fit_width > 3) or (category in ('top','pants','shorts') and fit_length > 2);
-- Rückweg:
-- update items i set fit_width = b.fit_width, fit_length = b.fit_length from items_fit_backup_0016 b where b.id = i.id;
