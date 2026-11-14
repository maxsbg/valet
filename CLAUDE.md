# Valet – Projektwissen für Claude

Kleiderschrank-App für Max und Paul (Vorbild: Acloset). Teile mit Bild und Preis erfassen, Outfits zusammenstellen, planen, tragen, auswerten.
Zuerst Web-App, später iOS-App aus derselben Codebasis.

## Zusammenarbeit mit Max
- Immer auf **Deutsch** antworten, auch in Commit-Nachrichten und Oberflächentexten.
- Max kann **.md-Dateien nicht öffnen** → Dokumente zum Lesen als HTML liefern.
- Nur **kostenlose Stufen**, **keine Kreditkarte** (GitHub Student Pack vorhanden). Keine Dienste vorschlagen, die eine Karte verlangen.
- Tokens/Secrets nie in Chat oder Code → GitHub- bzw. Supabase-Secrets.
- Ehrliche Einschätzung, kurz begründet. Vor größeren Umbauten kurz rückfragen.
- Max testet hauptsächlich am **iPhone (Safari)**.

## Aufbau (pnpm-Monorepo)
- `apps/app` – Expo SDK 58, Expo Router, react-native-web. Seiten in `src/app`, Rest in `src/components`, `src/lib`. Siehe `apps/app/AGENTS.md` (Expo-Regeln).
- `packages/core` – Fachlogik + Import aus dem alten Valet (Tests mit `node --test` über `tsx`).
- `packages/ui` – Design-Tokens (Farben, Personen, Kacheln, Schatten).
- `supabase/migrations` – Schema (0004: `items.wish_tag`, `wishlists.item_order`, am 14.11.2026 angewendet). `backup/` – Sicherung der Daten aus dem alten Valet.

Befehle: `pnpm install`, `pnpm test`, `pnpm typecheck`, Web-Build: `pnpm --filter @valet/app build:web`.

## Veröffentlichen
- GitHub `maxsbg/valet` (privat). Action `.github/workflows/web.yml` baut bei Push auf `main` (oder per workflow_dispatch auf einem Zweig) und schiebt nach `gh-pages`.
- Live: https://maxsbg.github.io/valet/ (baseUrl `/valet`).
- Achtung: workflow_dispatch auf einem Zweig überschreibt die Live-Seite mit diesem Zweig.
- PRs immer gegen `main` öffnen (PR #8 landete versehentlich in einem Feature-Zweig).

## Supabase
- Projekt `jocjisrmmzzvfnijosgg` (eu-west-1), Publishable Key in `src/lib/supabase.ts`.
- Zugriff über RLS mit `is_member(wardrobe_id)`. Schrank „Max & Paul“: `e3601e23-…`.
- Tabellen: wardrobes, wardrobe_members, wardrobe_invites, persons (color 'Rosa'/'Rot', item_order), wishlists, items (Besitzer in `owner_ids uuid[]`, mehrere möglich, kein „gemeinsam“; `owner_id` nur Spiegel für die Statistik: genau einer → dessen ID, sonst null; `highlight_color`), item_images (colors jsonb `[{h,s}]`), wears (PK item_id+worn_on), outfits, outfit_items, outfit_plans, reservations, daily_suggestions, cutout_feedback.
- `outfit_plans` hat **keine** direkte Verbindung zu `outfit_items` → über `outfits(outfit_items(item_id))` laden. Abfragen immer gegen die echte DB prüfen.
- Testkonto `claude-test@valet.invalid` (Schrank `c9fcb483-…`) kann gelöscht werden.

## Design
- **Schrank-Kachel** (neu, 13.11.2026): verbindlich `docs/design/kachel/VALET_KACHEL_SPEC.md` + `valet-kachel-referenz.html` (bei Widerspruch gilt die HTML). Werte in `packages/ui/src/tokens.ts` (`itemTile`), Logik in `packages/core/src/tile.ts` (glowFor, ownersFor, countLabel, topRightFor), Komponente `src/components/ItemTile.tsx` + `components/tile/`. Das Designsystem auf claude.ai ist bei der Kachel veraltet.
  - Prüfseite gehört **nicht** in die App: `node docs/design/kachel/pruefung/erstellen.mjs` erzeugt `kachel-pruefung.html` (eigenständig, gleiche Fälle wie die Referenz).
  - Offen (Max fragen, nicht selbst entscheiden): Set-Plakette, eingelagert vs. aussortiert, Highlight-Farbe automatisch/manuell, Auswahl im Outfit-Baukasten (vorerst alt). Personen ohne Farbe → Monogramm/Bügel schwarz (ink). Teile, die nur der angemeldeten Person gehören, zeigen keine Besitzer-Plakette (14.11.2026). iOS: Blur (expo-blur), Grau-Filter, Text-Versatz nachmessen.
- **Wunschlisten-Kachel (entschieden 14.11.2026):** Aufbau wie die Schrank-Kachel. Entwurf `docs/design/wunschliste/wunsch-kacheln.html`.
  - Unten links Preis-Kapsel (ganze Euro, kleines €, wächst mit der Stellenzahl, einstellig = Kreis) – `priceLabel` in `packages/core/src/tile.ts`.
  - Oben rechts Bedenkzeit-Ring mit Resttagen (≤ 3 Tage orange); nach Ablauf verschwindet die Plakette einfach. **Funktion vorerst AUS:** `WISH_WAIT.enabled = false` in `packages/core/src/tile.ts`. Nur einschalten, wenn Max es sagt.
  - Oben links Kategorie (`items.wish_tag`, eine pro Teil): Grail = Krone, Watchlist = Auge, Next Cop = Pfeil gerade nach rechts, Someday = Sternschnuppe, Gift = Geschenk (`WISH_TAGS` in core, Symbole in `TileIcons.tsx`). Keine Listen – nur Filter und Suche. Status „verliehen“ hat dafür den schrägen Pfeil (getauscht 14.11.2026).
  - Kein grauer Schleier über Wunschteilen.
- **Wunschlisten-Seite (umgesetzt 14.11.2026):** `src/app/(tabs)/wunschliste.tsx`, Logik in `src/lib/wishlists.ts`, Entwurf `docs/design/wunschliste/wunschliste-leiste.html`.
  - Keine Kopfkarte mit Gesamtwert. Leiste = `ClosetBar` wie im Schrank, Chips = Listen (`wishlists`, eine Liste pro Teil über `items.wishlist_id`), „Alle“ vorne, „+ Liste“ (gestrichelt) am Ende. Listen gehören einer Person (`owner_id`), sichtbar für alle; mit Personen-Filter nur deren Listen.
  - Liste gedrückt halten → Blatt mit Umbenennen / Reihenfolge ändern (hoch/runter, `wishlists.item_order`, danach Sortierung „Eigene Reihenfolge“) / Liste löschen (nur Text, Löschen rot; Teile bleiben unter „Alle“).
  - Filter: Person und Kategorie (mehrere). Suche: Name, Marke, Shop, Kategorie. Sortieren: Zufällig, Eigene Reihenfolge, Zuletzt hinzugefügt, Höchster/Niedrigster Preis, A–Z.
  - Plus → `/neu?wunsch=1(&liste=…)`; im Formular bei Wunschteilen „Preis“ (= `list_price`), Liste und Kategorie.
  - Noch offen: „Lohnt sich das?“ in der Detailansicht, „Gekauft“ → Schrank.
- **Schrank-Seite (entschieden und umgesetzt 13.11.2026):** Leiste in `src/components/ClosetBar.tsx`, Kopfzeile mit Profil-/Einstellungs-Blatt in `ui.tsx` (`Header`), Filter in `src/lib/sort.ts`. Entwürfe `docs/design/schrank/schrank-entwuerfe.html` (6 Zustände) und `suche-animation.html` (Animation, verbindlich).
  - Heute-Karte entfällt. Kopf: links Profil-Monogramm (Personenfarbe, ersetzt „?“), Mitte Logo, rechts Zahnrad (Einstellungen).
  - Zeile darunter: Lupe · Kategorie-Chips (wischbar, rechts weicher Verlauf) · Sortieren. Klebt beim Scrollen oben als Milchglas, Kacheln laufen darunter durch.
  - Lupe antippen: Suchfeld wächst aus dem Knopf (gleiche Höhe 44), rechts dreht Sortieren zu Filter. Chips rutschen 12 px darunter und gehen dort bis an beide Bildschirmränder (kein Verlauf, Padding nur im Inhalt). Choreografie: Öffnen = Chips erst runter, dann seitlich, Feld leicht verzögert; Schließen = Feld schnell zu + Chips seitlich, dann hoch. Nie überlappen.
  - Filter nur noch Person (Alle/Max/Paul) und Saison; Stil entfällt. Aktiver Filter bei geschlossener Suche = rosa Punkt an der Lupe.
  - Plus-Knopf kleiner (48) im Milchglas mit rosa Plus. Mosaik bleibt bei jeder Sortierung.
- Tab-Leiste wie Apple Music: 58 hoch, 21 seitlich, 25 über dem Rand (Web-App), im Browser über der Safari-Leiste (`useTabBarBottom`).
- Mosaik und Outfit-Karten aus dem alten Valet übernehmen.
- Andere Seiten (Teil-Detail, Bearbeiten, Status, Statistik) dürfen neu gestaltet werden.
- Web: Das Dokument selbst scrollt (kein innerer Scroll-Kasten), nur so zeigt Safari den Inhalt auch unter seiner Leiste. Seiten nutzen `src/components/Page.tsx` (iOS: ScrollView, Web: normaler Fluss + Scroll-Stand je Seite gemerkt); klebende Leisten über `STICKY`, feste (Tab-Leiste, Plus, Hinweise) über `position: fixed` (`FIXED` in `ui.tsx`). Abstände unten aus `src/lib/bottomInset.ts`. Web nutzt `Slot` statt `Stack` (Stack schneidet jede Seite in einen Rahmen) → Seiten werden beim Wechsel abgebaut, Zustand wie Kategorie/Filter bei Bedarf modulweit merken.

## Freistellen (entschieden)
- Modell **RMBG-1.4 von BRIA** (nur nicht-kommerziell!), im Browser auf dem Grafikchip (WebGPU, 1024 px), sonst Prozessor (512 px).
- Dateien: `apps/app/public/freistellen/` – `rmbg.js` (Rechenkern aus dem alten Valet + Ablauf), `rmbg14.bin` (44 MB, int8) + `rmbg14.json`. Modell wird in IndexedDB `valet-ki` gespeichert.
- API: `ValetRMBG.load(onProgress)`, `ValetRMBG.cutout(file, 'alt2', onStep)` → `{ canvas, file (WebP), thumb (WebP 400 px), info }`.
- Gewählte Variante: **`alt2` („Neues Alt“)** = Ablauf altes Valet (Kanten unverändert) + Krümel/einfarbigen Hintergrund entfernen + WebP mit Vorschaubild. Am iPhone ca. 11 s.
- Verworfen: Kantenfilter/Farbsaum (zeichnet Kanten unpassend nach), BiRefNet im Browser (iPhone stürzt ab), Server-Lösungen (ZeroGPU-Kontingent, Azure nicht berechtigt, Modal ohne Karte nur 1 $). Testseite: `/valet/freistell-rmbg.html`.

## Nächste Schritte
1. ~~Teil hinzufügen~~ (Seite `src/app/neu.tsx`, Formular gemeinsam mit Bearbeiten in `src/components/ItemForm.tsx`). Bucket `items` per `supabase/migrations/0002_storage_items.sql` (öffentlich lesbar, Schreiben nur Mitglieder). Ablage `<wardrobe>/<item>/<seite>-<stempel>.webp` + `-thumb.webp`; in `item_images` je Seite eine Zeile `cutout`/`original` (mit Farben) und eine `thumb`. Kacheln zeigen nur `thumb`-Zeilen, sonst Silhouette.
2. ~~Alte Bilder~~ → **manuell zuordnen**: Seite `src/app/bilder-zuordnen.tsx` (über Statistik). Mehrere Fotos wählen → nacheinander freistellen (PNG mit durchsichtigem Rand wird direkt übernommen) → je Bild ein Teil ohne Bild antippen (ähnliche Farbe zuerst, Suche) → `saveImage`. Logik in `src/lib/assign.ts`.
   Automatisch aus dem alten Artifact geht **nicht** (getestet): kein Datei-Download (`downloads` nicht freigeschaltet, freischalten geht nicht, weil Paul dort mitschreibt), kein Teilen-Menü, kein Netz (fetch zu Supabase: „Failed to fetch“); auch die Artifact-Tools (list_assets usw.) verweigern den Zugriff. Was geht: Bild gedrückt halten → „Zu Fotos hinzufügen“ (Teil öffnen → Export-Symbol am Bild).
3. ~~Outfits-Seite, Statistik, Paul einladen~~
   - Outfits: `src/app/(tabs)/outfits.tsx` (Wochenleiste, Anlass-Filter, Karten), Detail `src/app/outfit/[id].tsx` (Heute tragen, Für Tag planen, Tage), Baukasten `src/app/outfit-bauen.tsx` (`?id=` bearbeiten, `?date=&who=` danach planen, `?item=` mit Teil starten). Board-Anordnung aus dem alten Valet in `packages/core/src/board.ts` (ohne Bildmasken, ohne Ziehen/Anordnen). Daten/Planen/Reservieren in `src/lib/outfits.ts`; Outfits + Trage-Tage liegen im Session-Kontext (`reloadOutfits`).
   - Planen = Zeile in `outfit_plans`; ab heute zusätzlich je Teil eine Zeile in `reservations` (mit `plan_id`, löscht sich per cascade).
   - Statistik: Rechnungen in `packages/core/src/stats.ts` (Ausgaben/Getragen/Bestand, Anteile über `payers` `[{person_id, amount}]`).
   - Einladen: Statistik → „Schrank teilen“ (`src/components/Invite.tsx`, `src/lib/invite.ts`). Link `…/valet/?einladung=<token>`; Token wird gemerkt, Login bietet „Konto anlegen“, danach `accept_invite` + „Wer bist du?“ (`src/components/Join.tsx`, setzt `persons.user_id`). Nur der Besitzer (Rolle owner) darf Einladungen anlegen.
   - Noch offen aus dem alten Valet: Würfel/Vorschläge, Wada-Farben, Cap-Wahl, Teile auf dem Board verschieben, Monatskalender, Teilen als Bild, einzelne Teile reservieren.
4. Frischer Datenimport vor dem Umstieg.
