-- Herkunft eines Schrank-Teils dauerhaft markieren, wenn es aus der Wunschliste gekauft wurde.
alter table public.items
  add column if not exists was_wish boolean not null default false;

-- Bestehende Wunschteile und bereits gekaufte Teile mit gespeichertem Merken-Preis erkennen.
update public.items
set was_wish = true
where is_wish = true or wish_price is not null;
