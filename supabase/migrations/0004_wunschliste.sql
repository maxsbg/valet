-- Wunschliste (14.11.2026): Kategorie je Wunschteil und eigene Reihenfolge je Liste
-- Kategorie: Grail (Krone), Watchlist (Auge), Next Cop (Pfeil), Someday (Sternschnuppe), Gift (Geschenk); höchstens eine pro Teil.
-- Keine Liste – nur im Filter und in der Suche.
alter table items add column if not exists wish_tag text
  check (wish_tag in ('grail', 'watchlist', 'nextcop', 'someday', 'gift'));

-- Eigene Reihenfolge der Teile innerhalb einer Liste (Teil-IDs)
alter table wishlists add column if not exists item_order uuid[] not null default '{}';
