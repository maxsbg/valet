-- N2 (#100): fehlende Einschränkungen im Schema.
-- Bewusst nicht hier: eindeutige Planung je Outfit/Tag/Person (gehört zu M3 #84, dort gibt es noch eine doppelte Planung)
-- und Pflicht-Kategorie (leerer Text = „ohne Kategorie“ ist in der App gewollt, siehe neu.tsx).

-- Reservierung: von ≤ bis
alter table public.reservations add constraint reservations_dates_check check (date_from <= date_to);

-- Anzahl ≥ 1, Beträge ≥ 0
alter table public.items
  add constraint items_qty_check check (qty >= 1),
  add constraint items_amounts_check check (
    coalesce(price_paid, 0) >= 0 and coalesce(list_price, 0) >= 0 and coalesce(sold_price, 0) >= 0
    and coalesce(gift_value, 0) >= 0 and coalesce(wish_price, 0) >= 0
    and coalesce(orig_paid, 0) >= 0 and coalesce(orig_list, 0) >= 0);

-- Tagesvorschlag „für alle“ (person_id leer) nur einmal je Schrank und Tag
alter table public.daily_suggestions drop constraint daily_suggestions_wardrobe_id_for_date_person_id_key;
alter table public.daily_suggestions add constraint daily_suggestions_wardrobe_id_for_date_person_id_key
  unique nulls not distinct (wardrobe_id, for_date, person_id);

-- owner_ids: Ersatz für den fehlenden Fremdschlüssel (bei Arrays nicht möglich)
create or replace function public.check_owner_ids() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1 from unnest(coalesce(new.owner_ids, '{}')) as o(id)
    where not exists (select 1 from public.persons p where p.id = o.id and p.wardrobe_id = new.wardrobe_id)
  ) then
    raise exception 'Besitzer gehört nicht zu diesem Schrank.' using errcode = '23503';
  end if;
  return new;
end $$;
create trigger items_owner_ids_check before insert or update of owner_ids, wardrobe_id on public.items
  for each row execute function public.check_owner_ids();

-- Wird eine Person gelöscht, verschwindet sie aus owner_ids (wie „on delete set null“ beim Spiegel owner_id)
create or replace function public.remove_person_from_items() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.items set owner_ids = array_remove(owner_ids, old.id) where old.id = any(owner_ids);
  return old;
end $$;
create trigger persons_remove_from_items before delete on public.persons
  for each row execute function public.remove_person_from_items();
