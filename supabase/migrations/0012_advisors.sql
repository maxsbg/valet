-- N4 (#102): Hinweise der Supabase-Advisors.
-- Nicht per SQL lösbar: „Geleakte Passwörter prüfen“ (Auth-Einstellung, im Free-Tarif nicht verfügbar).
-- accept_invite/is_member bleiben für Angemeldete aufrufbar (beabsichtigt).

-- Sicherheit: fester Suchpfad
alter function public.storage_wardrobe(text) set search_path = '';

-- Leistung: Indizes für Fremdschlüssel
create index if not exists cutout_feedback_item_id_idx      on public.cutout_feedback (item_id);
create index if not exists cutout_feedback_wardrobe_id_idx  on public.cutout_feedback (wardrobe_id);
create index if not exists daily_suggestions_person_id_idx  on public.daily_suggestions (person_id);
create index if not exists items_dup_of_idx                 on public.items (dup_of);
create index if not exists items_lent_person_id_idx         on public.items (lent_person_id);
create index if not exists items_owner_id_idx               on public.items (owner_id);
create index if not exists items_wishlist_id_idx            on public.items (wishlist_id);
create index if not exists outfit_items_item_id_idx         on public.outfit_items (item_id);
create index if not exists outfit_plans_outfit_id_idx       on public.outfit_plans (outfit_id);
create index if not exists outfit_plans_person_id_idx       on public.outfit_plans (person_id);
create index if not exists outfits_owner_id_idx             on public.outfits (owner_id);
create index if not exists outfits_wardrobe_id_idx          on public.outfits (wardrobe_id);
create index if not exists persons_user_id_idx              on public.persons (user_id);
create index if not exists persons_wardrobe_id_idx          on public.persons (wardrobe_id);
create index if not exists reservations_item_id_idx         on public.reservations (item_id);
create index if not exists reservations_person_id_idx       on public.reservations (person_id);
create index if not exists reservations_plan_id_idx         on public.reservations (plan_id);
create index if not exists wardrobe_invites_created_by_idx  on public.wardrobe_invites (created_by);
create index if not exists wardrobe_invites_used_by_idx     on public.wardrobe_invites (used_by);
create index if not exists wardrobe_invites_wardrobe_id_idx on public.wardrobe_invites (wardrobe_id);
create index if not exists wardrobe_members_user_id_idx     on public.wardrobe_members (user_id);
create index if not exists wardrobes_created_by_idx         on public.wardrobes (created_by);
create index if not exists wears_person_id_idx              on public.wears (person_id);
create index if not exists wishlists_owner_id_idx           on public.wishlists (owner_id);
create index if not exists wishlists_wardrobe_id_idx        on public.wishlists (wardrobe_id);

-- Leistung: Anmeldung nur einmal je Abfrage auswerten
alter policy wardrobes_insert on public.wardrobes with check (created_by = (select auth.uid()));

-- Leistung: je Tabelle nur noch eine Regel fürs Lesen.
-- Die bisherigen „…_write … for all“-Regeln galten auch fürs Lesen; sie werden in insert/update/delete aufgeteilt.
-- Gleiche Bedingungen wie vorher, nur ohne SELECT.
do $$
declare
  t text;
  cond text;
begin
  -- Tabellen mit eigener wardrobe_id
  foreach t in array array['persons','wishlists','items','outfits','daily_suggestions','cutout_feedback'] loop
    cond := 'is_member(wardrobe_id, ''edit'')';
    execute format('drop policy %1$s_write on public.%1$s', t);
    execute format('create policy %1$s_insert on public.%1$s for insert with check (%2$s)', t, cond);
    execute format('create policy %1$s_update on public.%1$s for update using (%2$s) with check (%2$s)', t, cond);
    execute format('create policy %1$s_delete on public.%1$s for delete using (%2$s)', t, cond);
  end loop;
  -- über ein Teil
  foreach t in array array['item_images','wears','reservations'] loop
    cond := format('is_member((select i.wardrobe_id from public.items i where i.id = %1$s.item_id), ''edit'')', t);
    execute format('drop policy %1$s_write on public.%1$s', t);
    execute format('create policy %1$s_insert on public.%1$s for insert with check (%2$s)', t, cond);
    execute format('create policy %1$s_update on public.%1$s for update using (%2$s) with check (%2$s)', t, cond);
    execute format('create policy %1$s_delete on public.%1$s for delete using (%2$s)', t, cond);
  end loop;
  -- über ein Outfit
  foreach t in array array['outfit_items','outfit_plans'] loop
    cond := format('is_member((select o.wardrobe_id from public.outfits o where o.id = %1$s.outfit_id), ''edit'')', t);
    execute format('drop policy %1$s_write on public.%1$s', t);
    execute format('create policy %1$s_insert on public.%1$s for insert with check (%2$s)', t, cond);
    execute format('create policy %1$s_update on public.%1$s for update using (%2$s) with check (%2$s)', t, cond);
    execute format('create policy %1$s_delete on public.%1$s for delete using (%2$s)', t, cond);
  end loop;
end $$;

-- Mitglieder: Besitzer verwalten, alle lesen
drop policy members_admin on public.wardrobe_members;
create policy members_insert on public.wardrobe_members for insert with check (is_member(wardrobe_id, 'owner'));
create policy members_update on public.wardrobe_members for update using (is_member(wardrobe_id, 'owner')) with check (is_member(wardrobe_id, 'owner'));
create policy members_delete on public.wardrobe_members for delete using (is_member(wardrobe_id, 'owner'));
