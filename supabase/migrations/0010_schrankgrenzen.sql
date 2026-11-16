-- N1 (#99): Verweise über Schrankgrenzen verhindern.
-- Die RLS-Regeln prüfen nur die „Haupt“-Zeile (z. B. das Outfit). Dieser Trigger prüft zusätzlich,
-- dass Teil, Person, Outfit, Planung und Wunschliste einer Zeile alle zum selben Schrank gehören.
-- Läuft mit den Rechten der aufrufenden Person: Fremde Zeilen sind dort unsichtbar → ebenfalls abgelehnt.

create or replace function public.check_same_wardrobe() returns trigger
language plpgsql set search_path = '' as $$
declare
  w uuid;
  bad boolean := false;
begin
  if tg_table_name = 'outfit_items' then
    select wardrobe_id into w from public.outfits where id = new.outfit_id;
    bad := w is distinct from (select wardrobe_id from public.items where id = new.item_id);
  elsif tg_table_name = 'outfit_plans' then
    select wardrobe_id into w from public.outfits where id = new.outfit_id;
    bad := new.person_id is not null and w is distinct from (select wardrobe_id from public.persons where id = new.person_id);
  elsif tg_table_name in ('wears', 'reservations') then
    select wardrobe_id into w from public.items where id = new.item_id;
    bad := (new.person_id is not null and w is distinct from (select wardrobe_id from public.persons where id = new.person_id));
    if tg_table_name = 'wears' then
      bad := bad or (new.outfit_id is not null and w is distinct from (select wardrobe_id from public.outfits where id = new.outfit_id));
    else
      bad := bad or (new.plan_id is not null and w is distinct from (
        select o.wardrobe_id from public.outfit_plans p join public.outfits o on o.id = p.outfit_id where p.id = new.plan_id));
    end if;
  elsif tg_table_name = 'items' then
    w := new.wardrobe_id;
    bad := (new.owner_id is not null and w is distinct from (select wardrobe_id from public.persons where id = new.owner_id))
        or (new.lent_person_id is not null and w is distinct from (select wardrobe_id from public.persons where id = new.lent_person_id))
        or (new.wishlist_id is not null and w is distinct from (select wardrobe_id from public.wishlists where id = new.wishlist_id));
  elsif tg_table_name in ('outfits', 'wishlists') then
    bad := new.owner_id is not null and new.wardrobe_id is distinct from (select wardrobe_id from public.persons where id = new.owner_id);
  end if;
  if bad then
    raise exception 'Verweis auf einen anderen Schrank ist nicht erlaubt (%).', tg_table_name using errcode = '23514';
  end if;
  return new;
end $$;

create trigger outfit_items_same_wardrobe before insert or update on public.outfit_items for each row execute function public.check_same_wardrobe();
create trigger outfit_plans_same_wardrobe before insert or update on public.outfit_plans for each row execute function public.check_same_wardrobe();
create trigger wears_same_wardrobe        before insert or update on public.wears        for each row execute function public.check_same_wardrobe();
create trigger reservations_same_wardrobe before insert or update on public.reservations for each row execute function public.check_same_wardrobe();
create trigger items_same_wardrobe        before insert or update of wardrobe_id, owner_id, lent_person_id, wishlist_id on public.items for each row execute function public.check_same_wardrobe();
create trigger outfits_same_wardrobe      before insert or update of wardrobe_id, owner_id on public.outfits   for each row execute function public.check_same_wardrobe();
create trigger wishlists_same_wardrobe    before insert or update of wardrobe_id, owner_id on public.wishlists for each row execute function public.check_same_wardrobe();
