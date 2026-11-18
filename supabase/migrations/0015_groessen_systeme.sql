-- 0015: Alle Größen-Systeme aus fields.ts in der Datenbank zulassen.
-- Die Uhr verwendet size_system = 'watch' (z. B. Gehäuse-Ø 40 mm).

alter table public.items drop constraint if exists items_size_system_check;
alter table public.items add constraint items_size_system_check
  check (size_system in ('letters', 'numbers', 'wl', 'eu', 'cap', 'ring',
    'glove', 'belt', 'sock', 'hat', 'bracelet', 'necklace', 'watch', 'flexfit'));
