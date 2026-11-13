-- Schrank-Kachel (docs/design/kachel/VALET_KACHEL_SPEC.md)
-- 1) Mehrere Besitzer je Teil. Im Formular werden die Besitzer einzeln gewählt, „gemeinsam“ gibt es nicht mehr.
--    owner_id bleibt vorerst als Spiegel für bestehende Auswertungen (Statistik):
--    genau ein Besitzer → dessen ID, sonst null (= früher „gemeinsam“).
-- 2) Highlight-Farbe: zweite, auffällige Farbe am Teil (für den Innenschein bei neutralen Teilen).
--    Wie sie ermittelt wird (automatisch aus dem Foto oder manuell), ist noch offen.

alter table items add column if not exists owner_ids uuid[] not null default '{}';
alter table items add column if not exists highlight_color text
  check (highlight_color is null or highlight_color ~ '^#[0-9a-fA-F]{6}$');

-- Bestand übernehmen: Besitzer → [Besitzer]; Schrankteile ohne Besitzer (gemeinsam) → alle Personen des Schranks.
-- Wunschteile ohne Besitzer bleiben ohne Besitzer.
update items i
set owner_ids = case
  when i.owner_id is not null then array[i.owner_id]
  when i.is_wish then '{}'
  else coalesce((select array_agg(p.id order by p.created_at) from persons p where p.wardrobe_id = i.wardrobe_id), '{}')
end
where i.owner_ids = '{}';
