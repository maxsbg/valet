-- 0009: Shorts werden eine eigene Oberkategorie (Max, 15.11.2026).
-- Vorher Hose › Shorts › Typ, jetzt Shorts › Typ (die Typen werden zu Unterkategorien).
-- Die App rechnet alte Zeilen schon beim Laden um (normalizeCategory), die Migration räumt nur die Daten auf.
begin;
update public.items
   set category = 'Shorts',
       subcategory = case when item_type in ('Sportshorts', 'Cargoshorts', 'Bermudashorts', 'Anzugshorts') then item_type else null end,
       item_type = null
 where category = 'Hose' and subcategory = 'Shorts';
commit;
