-- 0013: Größen erweitert (17.11.2026)
-- Neue Größen-Systeme: Handschuh (glove), Gürtel (belt), Socke/Strumpfhose (sock), Hut (hat), Armband (bracelet),
-- Halskette (necklace), Uhr (watch), Kappe Flexfit (flexfit). Doppelgrößen (S/M …) und 4XL/5XL laufen unter „letters“,
-- Unterwäsche 4–9 und Stoffhosen 44–60 unter „numbers“, Drittelgrößen bei Schuhen unter „eu“.
-- Bestehende Werte bleiben unverändert; die App ordnet Altdaten beim Laden zu (sizeSystemOn in packages/core/src/fields.ts).

alter table public.items drop constraint if exists items_size_system_check;
alter table public.items add constraint items_size_system_check
  check (size_system in ('letters', 'numbers', 'wl', 'eu', 'cap', 'ring',
    'glove', 'belt', 'sock', 'hat', 'bracelet', 'necklace', 'watch', 'flexfit'));
