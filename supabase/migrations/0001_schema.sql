-- Valet – Datenbank-Schema (Supabase / Postgres)
-- Stand: 12.11.2026, abgeleitet aus den echten Valet-Daten (items, outfits, people, wishlists, daily, cutoutFeedback)
-- Grundidee: Alles hängt an einem Schrank (wardrobe). Zugriff nur für Mitglieder des Schranks.

-- pgcrypto ist bei Supabase im Schema "extensions" bereits aktiv

-- ---------------------------------------------------------------
-- Schränke, Mitglieder, Einladungen
-- ---------------------------------------------------------------
create table wardrobes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now()
);

create type member_role as enum ('owner', 'edit', 'view');

create table wardrobe_members (
  wardrobe_id uuid not null references wardrobes(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        member_role not null default 'edit',
  joined_at   timestamptz not null default now(),
  primary key (wardrobe_id, user_id)
);

create table wardrobe_invites (
  token       text primary key default encode(extensions.gen_random_bytes(18), 'hex'),
  wardrobe_id uuid not null references wardrobes(id) on delete cascade,
  role        member_role not null default 'edit',
  created_by  uuid not null references auth.users(id),
  expires_at  timestamptz not null default now() + interval '7 days',
  used_by     uuid references auth.users(id),
  used_at     timestamptz
);

-- Personen im Schrank (alt: people). Eine Person kann mit einem Login verknüpft sein, muss aber nicht.
create table persons (
  id          uuid primary key default gen_random_uuid(),
  wardrobe_id uuid not null references wardrobes(id) on delete cascade,
  user_id     uuid references auth.users(id),
  name        text not null,
  color       text,                       -- alt: color ("Rot", "Rosa")
  item_order  uuid[] not null default '{}',  -- alt: order (eigene Reihenfolge im Mosaik)
  prefs       jsonb not null default '{}',   -- alt: prefs {caps, styles}
  wash_ask_on date,                       -- alt: washAsk
  legacy_id   text unique,
  created_at  timestamptz not null default now()
);

create table wishlists (
  id          uuid primary key default gen_random_uuid(),
  wardrobe_id uuid not null references wardrobes(id) on delete cascade,
  owner_id    uuid references persons(id) on delete set null,
  name        text not null,
  legacy_id   text unique,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Teile
-- ---------------------------------------------------------------
create type item_status as enum ('wash', 'repair', 'lent', 'out', 'sold');

create table items (
  id            uuid primary key default gen_random_uuid(),
  wardrobe_id   uuid not null references wardrobes(id) on delete cascade,
  owner_id      uuid references persons(id) on delete set null,  -- null = gemeinsames Teil
  name          text not null default '',
  brand         text not null default '',
  category      text not null,                -- oberteil, hose, shorts, pullover, jacke, mantel, schuhe, tasche, accessoire …
  color         text not null default '',
  alt_color     text not null default '',     -- Seite B bei Wendeteilen
  size          text not null default '',
  material      text not null default '',
  style         text not null default '',     -- Casual, Streetwear, Schick, Business, Sport
  seasons       text[] not null default '{}', -- Sommer, Übergang, Winter
  layer         text,                         -- basis, offen, zu
  qty           int not null default 1,
  -- Kauf
  price_paid    numeric(10,2),
  list_price    numeric(10,2),
  orig_currency text,                         -- z. B. GBP
  orig_paid     numeric(10,2),
  orig_list     numeric(10,2),
  fx_rate       numeric(10,4),
  fx_estimated  boolean not null default false,
  payers        jsonb,                        -- [{person_id, amount}] bei geteilten Kosten
  purchase_date date,
  shop          text not null default '',
  link          text not null default '',
  notes         text not null default '',
  -- Zustand
  status        item_status,
  status_at     date,
  lent_to       text not null default '',
  sold_date     date,
  sold_price    numeric(10,2),
  -- Wunschliste
  is_wish       boolean not null default false,
  wishlist_id   uuid references wishlists(id) on delete set null,
  kauf_check    jsonb,
  -- Wendeteil / Set
  reversible    boolean not null default false,
  main_side     char(1) not null default 'a' check (main_side in ('a','b')),
  set_id        text,
  set_name      text,
  -- KI- und Analyse-Ergebnisse (alt: vdesc, matInfo, hexes, accent, fp, *Auto-Flags)
  analysis      jsonb not null default '{}',
  fingerprint   text,                         -- alt: fp (Bild-Fingerabdruck für Dubletten)
  dup_of        uuid references items(id) on delete set null,
  legacy_id     text unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on items (wardrobe_id);
create index on items (wardrobe_id, category);

-- Bilder (alt: imageId, altImageId). Datei liegt in Supabase Storage, Bucket "items".
create table item_images (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references items(id) on delete cascade,
  side          char(1) not null default 'a' check (side in ('a','b')),
  kind          text not null default 'cutout',  -- cutout, original
  storage_path  text not null,
  colors        jsonb,                           -- alt: hexes / altHexes [{h, s}]
  legacy_id     text,                            -- alte Bild-ID (Blob im Artifact)
  created_at    timestamptz not null default now(),
  unique (item_id, side, kind)
);

-- Getragen (alt: wears[] am Teil)
create table wears (
  item_id    uuid not null references items(id) on delete cascade,
  worn_on    date not null,
  person_id  uuid references persons(id) on delete set null,
  outfit_id  uuid,
  primary key (item_id, worn_on)
);

-- ---------------------------------------------------------------
-- Outfits, Planung, Reservierungen
-- ---------------------------------------------------------------
create table outfits (
  id              uuid primary key default gen_random_uuid(),
  wardrobe_id     uuid not null references wardrobes(id) on delete cascade,
  owner_id        uuid references persons(id) on delete set null,
  name            text not null default '',
  notes           text not null default '',
  occasions       text[] not null default '{}',
  occasions_auto  boolean not null default false,
  from_suggestion boolean not null default false,
  wada            int,                           -- Farbkombination nach Sanzo Wada
  meta            jsonb not null default '{}',   -- z. B. capTried
  legacy_id       text unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table outfit_items (
  outfit_id uuid not null references outfits(id) on delete cascade,
  item_id   uuid not null references items(id) on delete cascade,
  position  int not null,
  x real, y real, z int,                          -- alt: layout {itemId: {x, y, z}}
  primary key (outfit_id, item_id)
);

create table outfit_plans (
  id         uuid primary key default gen_random_uuid(),
  outfit_id  uuid not null references outfits(id) on delete cascade,
  person_id  uuid references persons(id) on delete set null,
  plan_date  date not null,
  legacy_id  text,
  created_at timestamptz not null default now()
);

-- alt: reservations[] am Teil, verknüpft mit einem Plan
create table reservations (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references items(id) on delete cascade,
  plan_id    uuid references outfit_plans(id) on delete cascade,
  person_id  uuid references persons(id) on delete set null,
  date_from  date not null,
  date_to    date not null,
  created_at timestamptz not null default now()
);

-- Tagesvorschläge (alt: daily, Schlüssel "Datum_Person" bzw. "Datum_all")
create table daily_suggestions (
  id          uuid primary key default gen_random_uuid(),
  wardrobe_id uuid not null references wardrobes(id) on delete cascade,
  for_date    date not null,
  person_id   uuid references persons(id) on delete cascade,  -- null = für alle
  item_ids    uuid[] not null,
  direction   text,          -- alt: dir
  reason      text,
  occasions   text[] not null default '{}',
  wada        int,
  meta        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  unique (wardrobe_id, for_date, person_id)
);

-- Rückmeldungen zum Freistellen (alt: cutoutFeedback)
create table cutout_feedback (
  id          uuid primary key default gen_random_uuid(),
  wardrobe_id uuid not null references wardrobes(id) on delete cascade,
  item_id     uuid references items(id) on delete set null,
  side        char(1),
  model       text,
  variant     text,
  gpu         boolean,
  note        text not null default '',
  file_name   text,
  meta        jsonb not null default '{}',  -- alte Bild-IDs
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Zugriffsregeln (Row Level Security)
-- ---------------------------------------------------------------
create or replace function is_member(w uuid, min_role member_role default 'view')
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from wardrobe_members m
    where m.wardrobe_id = w and m.user_id = auth.uid()
      and case min_role
            when 'view'  then true
            when 'edit'  then m.role in ('edit','owner')
            when 'owner' then m.role = 'owner'
          end
  );
$$;

alter table wardrobes         enable row level security;
alter table wardrobe_members  enable row level security;
alter table wardrobe_invites  enable row level security;
alter table persons           enable row level security;
alter table wishlists         enable row level security;
alter table items             enable row level security;
alter table item_images       enable row level security;
alter table wears             enable row level security;
alter table outfits           enable row level security;
alter table outfit_items      enable row level security;
alter table outfit_plans      enable row level security;
alter table reservations      enable row level security;
alter table daily_suggestions enable row level security;
alter table cutout_feedback   enable row level security;

create policy wardrobes_read   on wardrobes for select using (is_member(id));
create policy wardrobes_insert on wardrobes for insert with check (created_by = auth.uid());
create policy wardrobes_update on wardrobes for update using (is_member(id, 'owner'));

create policy members_read  on wardrobe_members for select using (is_member(wardrobe_id));
create policy members_admin on wardrobe_members for all using (is_member(wardrobe_id, 'owner'));
create policy invites_admin on wardrobe_invites for all using (is_member(wardrobe_id, 'owner'));

-- Tabellen mit eigener wardrobe_id: lesen ab "view", schreiben ab "edit"
do $$
declare t text;
begin
  foreach t in array array['persons','wishlists','items','outfits','daily_suggestions','cutout_feedback'] loop
    execute format('create policy %1$s_read  on %1$s for select using (is_member(wardrobe_id))', t);
    execute format('create policy %1$s_write on %1$s for all using (is_member(wardrobe_id, ''edit'')) with check (is_member(wardrobe_id, ''edit''))', t);
  end loop;
end $$;

-- Tabellen, die über ein Teil am Schrank hängen
do $$
declare t text;
begin
  foreach t in array array['item_images','wears','reservations'] loop
    execute format('create policy %1$s_read  on %1$s for select using (is_member((select wardrobe_id from items i where i.id = item_id)))', t);
    execute format('create policy %1$s_write on %1$s for all using (is_member((select wardrobe_id from items i where i.id = item_id), ''edit''))', t);
  end loop;
end $$;

-- Tabellen, die über ein Outfit am Schrank hängen
create policy outfit_items_read  on outfit_items for select using (is_member((select wardrobe_id from outfits o where o.id = outfit_id)));
create policy outfit_items_write on outfit_items for all    using (is_member((select wardrobe_id from outfits o where o.id = outfit_id), 'edit'));
create policy outfit_plans_read  on outfit_plans for select using (is_member((select wardrobe_id from outfits o where o.id = outfit_id)));
create policy outfit_plans_write on outfit_plans for all    using (is_member((select wardrobe_id from outfits o where o.id = outfit_id), 'edit'));

-- Wer einen Schrank anlegt, wird automatisch Besitzer
create or replace function add_owner() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into wardrobe_members (wardrobe_id, user_id, role) values (new.id, new.created_by, 'owner');
  return new;
end $$;
create trigger wardrobes_add_owner after insert on wardrobes for each row execute function add_owner();

-- Einladung einlösen: nur über diese Funktion, nicht direkt
create or replace function accept_invite(p_token text) returns uuid language plpgsql security definer set search_path = public as $$
declare inv wardrobe_invites;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into inv from wardrobe_invites where token = p_token and used_at is null and expires_at > now();
  if not found then raise exception 'Einladung ungültig oder abgelaufen'; end if;
  insert into wardrobe_members (wardrobe_id, user_id, role) values (inv.wardrobe_id, auth.uid(), inv.role)
    on conflict (wardrobe_id, user_id) do nothing;
  update wardrobe_invites set used_by = auth.uid(), used_at = now() where token = p_token;
  return inv.wardrobe_id;
end $$;

-- updated_at automatisch pflegen
create or replace function touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
create trigger items_touch   before update on items   for each row execute function touch_updated_at();
create trigger outfits_touch before update on outfits for each row execute function touch_updated_at();

-- Funktionen nicht für Gäste ohne Login freigeben (Supabase-Sicherheitshinweis)
revoke execute on function public.add_owner() from public, anon, authenticated;
revoke execute on function public.is_member(uuid, member_role) from public, anon;
revoke execute on function public.accept_invite(text) from public, anon;
grant execute on function public.is_member(uuid, member_role) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
