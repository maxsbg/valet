-- 0006: Felder für Teil-Detail, Wunschteil-Detail und Bearbeiten (VALET_DETAILSEITE_SPEC.md)
-- Angewendet am 15.11.2026 (nur neue Spalten; alte Felder bleiben vorerst als Spiegel).
--
-- Grundsatz: Neue Felder kommen dazu, alte bleiben vorerst als Spiegel stehen
-- (color, material, style, layer), damit Suche/Statistik/Kachel während der Umstellung
-- weiterlaufen. Werte der festen Listen (Kategorie, Farben, Material …) werden als
-- deutscher Name aus packages/core gespeichert, Skalen als Stufen-Index (0 = erste Stufe).

alter table public.items
  -- Kategorie in drei Ebenen (category bekommt die neuen Namen: Oberteil, Hose, Schuh …)
  add column if not exists subcategory  text,
  add column if not exists item_type    text,

  -- Aussehen
  add column if not exists colors       text[] not null default '{}',   -- Rang = Reihenfolge, höchstens 3
  add column if not exists colors_b     text[] not null default '{}',   -- Wendbar: Seite B
  add column if not exists pattern      text,                            -- ein Muster
  add column if not exists pattern_b    text,                            -- Wendbar: Seite B
  add column if not exists materials    jsonb  not null default '[]',    -- [{ "name": "Baumwolle", "pct": 80 }], Rang = Reihenfolge
  add column if not exists size_system  text check (size_system in ('letters', 'numbers')),
  add column if not exists collar_size  text,                            -- nur Unterkategorie Hemd

  -- Tragen (Stufen-Index)
  add column if not exists fit_width    smallint check (fit_width  between 0 and 4),  -- schmal … weit
  add column if not exists fit_length   smallint check (fit_length between 0 and 4),  -- kurz … lang bzw. Mini … Maxi
  add column if not exists fit_rise     smallint check (fit_rise   between 0 and 2),  -- Bund tief · normal · hoch
  add column if not exists layers       smallint[] not null default '{}',             -- 0 Unterlage, 1 Mitte zu, 2 Mitte offen, 3 Außen
  add column if not exists standalone   boolean not null default false,               -- „auch allein tragbar“
  add column if not exists warmth       smallint check (warmth between 0 and 3),      -- sehr leicht … warm
  add column if not exists rain         smallint check (rain   between 0 and 2),      -- schlecht · mittel · gut

  -- Details
  add column if not exists styles       text[] not null default '{}',   -- mehrere (neue Stil-Liste)
  add column if not exists collar       text,
  add column if not exists closure      text,

  -- Pflege: je Gruppe ein Wert mit Herkunft
  -- { "wash": { "v": "w30", "src": "etikett" | "geschaetzt" | "hand" }, "bleach": …, "dry": …, "iron": …, "pro": … }
  add column if not exists care         jsonb  not null default '{}',

  -- Kauf
  add column if not exists article_no   text   not null default '',
  add column if not exists is_gift      boolean not null default false,  -- Bekommen am = purchase_date
  add column if not exists gift_from    text   not null default '',
  add column if not exists gift_value   numeric,

  -- Status-Zusatzangaben (status_at = „seit“, lent_to = freier Name, sold_* gibt es schon)
  add column if not exists lent_person_id uuid references public.persons(id) on delete set null,
  add column if not exists status_until date,                            -- Verliehen: zurück bis
  add column if not exists status_where text not null default '',       -- Reparatur: wo · Eingelagert: wo · Verkauft: wo

  -- Wunschteil (Gemerkt am = created_at)
  add column if not exists buy_on       date,                            -- Kauftag geplant
  add column if not exists wish_price   numeric,                         -- Preis beim Merken

  -- KI-Vorschläge, die noch nicht bestätigt sind (Feldnamen, z. B. {'colors','care.wash'})
  add column if not exists ai_pending   text[] not null default '{}';

-- qty (Anzahl), payers (Aufteilung), set_id/set_name, reversible, link, notes, list_price,
-- price_paid, purchase_date, shop, wish_tag, wishlist_id bestehen bereits.
