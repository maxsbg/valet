---
id: DAT-CATALOG-001
type: data_catalog
name: Datenmodelle
status: implemented
---
# Datenmodelle
Primärquelle: `supabase/migrations/0001_schema.sql` plus Folge-Migrationen. UI-Read-Modelle sind von DB-Records zu unterscheiden.

## DAT-001 Wardrobe – wardrobes
`id` UUID PK; `name` text NOT NULL; `created_by` UUID → auth.users; `created_at` timestamptz. Mandantengrenze für Schrankdaten.

## DAT-002 Person – persons
`id` UUID PK; `wardrobe_id` FK; `user_id` nullable FK; `name` text NOT NULL; `color` text; `item_order` uuid[]; `prefs` jsonb; `wash_ask_on` date; `legacy_id` unique; `created_at`.

## DAT-003 Wishlist – wishlists
`id` UUID PK; `wardrobe_id` FK; `owner_id` nullable FK persons; `name` text NOT NULL; `legacy_id` unique; `created_at`.

## DAT-004 Item – items
**Pflicht/Identität:** id UUID PK, wardrobe_id UUID FK NOT NULL, category text NOT NULL, name/brand/color/alt_color/size/material/style text NOT NULL mit Defaults.
**Eigenschaften:** seasons text[], layer text nullable, qty int default 1.
**Kosten:** price_paid/list_price numeric(10,2), orig_currency text, orig_paid/orig_list numeric(10,2), fx_rate numeric(10,4), fx_estimated boolean, payers jsonb, purchase_date date, shop/link/notes text.
**Status:** status item_status, status_at date, lent_to text, sold_date date, sold_price numeric.
**Wunsch:** is_wish boolean, wishlist_id UUID FK, kauf_check jsonb.
**Seite/Set:** reversible boolean, main_side char(1) CHECK a/b, set_id/set_name text.
**Analyse:** analysis jsonb, fingerprint text, dup_of UUID self-FK.
**Audit:** legacy_id unique, created_at/updated_at timestamptz.
Regeln: owner_id null = gemeinsames Teil; Bild-/KI-Metadaten liegen teilweise in JSONB.

## DAT-005 ItemImage – item_images
id UUID PK; item_id FK CASCADE; side char(1) CHECK a/b; kind text (cutout/original); storage_path text NOT NULL; colors jsonb; legacy_id; created_at. Unique (item_id,side,kind).

## DAT-006 Outfit – outfits
id UUID PK; wardrobe_id FK; owner_id FK persons; name/notes text; occasions text[]; occasions_auto/from_suggestion boolean; wada int; meta jsonb; legacy_id unique; timestamps.

## DAT-007 OutfitItem – outfit_items
outfit_id FK, item_id FK, position int; x/y real; z int; PK (outfit_id,item_id). Verknüpft Outfit und Item.

## DAT-008 OutfitPlan – outfit_plans
id UUID PK; outfit_id FK; person_id FK nullable; plan_date date NOT NULL; legacy_id; created_at.

## DAT-009 Reservation – reservations
id UUID PK; item_id FK; plan_id FK nullable; person_id FK nullable; date_from/date_to date NOT NULL; created_at. plan_id null = separate Einzelreservierung.

## DAT-010 Wear – wears
item_id FK; worn_on date; person_id FK nullable; outfit_id UUID; PK (item_id,worn_on). Protokoll getragener Teile.

## DAT-011 WardrobeMember – wardrobe_members
wardrobe_id FK; user_id FK auth.users; role member_role; joined_at; PK (wardrobe_id,user_id).

## DAT-012 WardrobeInvite – wardrobe_invites
token text PK; wardrobe_id FK; role; created_by; expires_at (7 Tage Default); used_by; used_at.

## DAT-013 DailySuggestion – daily_suggestions
id UUID PK; wardrobe_id FK; for_date date; person_id nullable; item_ids uuid[]; direction/reason text; occasions text[]; wada int; meta jsonb; created_at; unique (wardrobe_id,for_date,person_id).

## DAT-014 CutoutFeedback – cutout_feedback
id UUID PK; wardrobe_id FK; item_id nullable FK; side char(1); model/variant/note/file_name text; gpu boolean; meta jsonb; created_at.

## DAT-015 ItemStatus – item_status enum
Basisschema: wash, repair, lent, out, sold. Folge-Migrationen erweitern Werte; aktuelle catalog.ts und Migrationshistorie sind maßgeblich.

## DAT-016 MemberRole – member_role enum
owner, edit, view.

## Beziehungen / Validierung
Wardrobe → Members/Invites/Persons/Wishlists/Items/Outfits/DailySuggestions/CutoutFeedback. Item → Images/Wears/Reservations; Outfit → OutfitItems/Plans; OutfitItem → Item. Fremdschlüssel und RLS sind in SQL maßgeblich. `packages/core/src/model.ts` definiert zusätzlich TypeScript Item, Payer, Outfit, OutfitPlan und WearLog; `lib/wardrobe.ts` enthält ein abgeleitetes Tile-View-Model.
