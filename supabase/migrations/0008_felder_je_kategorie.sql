-- 0008: Felder je Kategorie (VALET_DETAILSEITE_SPEC.md, Abschnitt 8a, 15.11.2026)
-- Größen-Systeme: Buchstaben, Zahlen, W/L (Hose), EU (Schuh), Kappe (verstellbar/Fitted), Ring.
-- Trägerart bei Taschen. Altdaten bleiben; die App ordnet sie beim Laden zu (sizeSystemOn in packages/core/src/fields.ts).

alter table public.items drop constraint if exists items_size_system_check;
alter table public.items add constraint items_size_system_check
  check (size_system in ('letters', 'numbers', 'wl', 'eu', 'cap', 'ring'));

alter table public.items add column if not exists strap text;
