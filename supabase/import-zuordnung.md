# Import: altes Valet → Supabase

Stand 12.11.2026. Gilt für das Import-Skript in Phase 1. Jede alte ID wird in `legacy_id` gespeichert, damit Verweise (Outfits → Teile, Reservierungen → Pläne) aufgelöst werden können und ein zweiter Import nichts doppelt anlegt.

## Reihenfolge
1. Schrank „Max & Paul“ anlegen (Max = Besitzer). Paul kommt später über einen Einladungslink dazu.
2. `people` → `persons` (Max, Paul)
3. `wishlists` → `wishlists`
4. `items` → `items` + `item_images` + `wears` (ohne Reservierungen)
5. `outfits` → `outfits` + `outfit_items` + `outfit_plans`
6. Reservierungen aus `items.reservations` → `reservations` (Plan über `outfitId` + `id` finden)
7. `daily` → `daily_suggestions`
8. `cutoutFeedback` → `cutout_feedback`
9. Bilder hochladen (separater Schritt, siehe unten)

## Felder

| Alt (Valet) | Neu (Supabase) | Hinweis |
|---|---|---|
| people.name / color | persons.name / color | |
| people.order | persons.item_order | alte IDs → neue UUIDs übersetzen |
| people.prefs, washAsk | persons.prefs, wash_ask_on | |
| people.cols | – | Spaltenansicht entfällt (nur Mosaik) |
| items.ownerId | items.owner_id | `null` bleibt `null` (gemeinsames Teil) |
| items.wish, listId | items.is_wish, wishlist_id | |
| items.pricePaid, listPrice, qty | price_paid, list_price, qty | |
| items.origCurrency/origPaid/origList/fxRate/fxEstimated | orig_currency … fx_estimated | |
| items.payers [{id, amount}] | items.payers [{person_id, amount}] | IDs übersetzen |
| items.status, statusAt, lentTo, soldDate, soldPrice | status, status_at, lent_to, sold_date, sold_price | |
| items.reversible, mainSide, altColor | reversible, main_side, alt_color | |
| items.setId, setName | set_id, set_name | |
| items.vdesc, matInfo, accent, layerAuto, materialAuto, vdescAuto, brandManual, autoDetected, tagsDetected, bgProcessed, matStale | items.analysis (JSON) | |
| items.hexes / altHexes | item_images.colors (Seite a / b) | |
| items.fp | items.fingerprint | |
| items.dupOf | items.dup_of | ID übersetzen |
| items.imageId / altImageId | item_images.legacy_id (Seite a / b) | Datei kommt in Schritt 9 |
| items.wears [Datum] | wears (je Datum eine Zeile) | |
| items.trimV2…V5, tile, hexFor, altHexFor, accentFor, incomplete | – | interne Verarbeitungs-Merker, entfallen |
| outfits.itemIds | outfit_items (position = Reihenfolge) | |
| outfits.layout {id:{x,y,z}} | outfit_items.x/y/z | |
| outfits.plans [{id, date, personId}] | outfit_plans | |
| outfits.occasions, occAuto, fromSuggestion, wada | occasions, occasions_auto, from_suggestion, wada | |
| outfits.capTried | outfits.meta | |
| daily-ID „Datum_Person“ / „Datum_all“ | for_date + person_id (null bei „all“) | |
| daily.dir, reason, itemIds, occasions, wada | direction, reason, item_ids, occasions, wada | |

## Bekannte Datenpunkte zum Prüfen
- Test-Teile mit Namen „j“ und „k“ (Wunschliste): vor dem Import mit Max klären.
- Ein Teil ohne `ownerId` (Name „k“) → wird gemeinsames Teil.
- `people.order` enthält IDs, die es nicht mehr gibt (z. B. gelöschte Teile) → beim Übersetzen verwerfen.

## Bilder (offen)
Die Bilder liegen im Speicher des Artifacts und lassen sich derzeit nicht gesammelt exportieren (Downloads-Funktion bei Valet nicht freischaltbar, Übergabe über die App-Datenbank zu groß). Lösung wird in Phase 1 gesucht, sobald Supabase steht.
