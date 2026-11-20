-- Lagen auf die Vorgabe je Unterkategorie zurücksetzen (Max, 20.11.2026).
-- Leere Lagen = Vorgabe aus defaultLayers (packages/core/src/fields.ts); die alten Werte stammten meist aus der KI.
-- Alte Werte bleiben in items_layers_backup_0017 (Rückweg: siehe Ende der Datei).

begin;

create table if not exists items_layers_backup_0017 as
  select id, category, subcategory, layers, standalone from items where layers is not null and cardinality(layers) > 0;
alter table items_layers_backup_0017 enable row level security;

update items set layers = '{}' where layers is not null and cardinality(layers) > 0;

commit;

-- Rückweg:
-- update items i set layers = b.layers from items_layers_backup_0017 b where b.id = i.id;
