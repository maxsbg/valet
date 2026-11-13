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
- `supabase/migrations` – Schema. `backup/` – Sicherung der Daten aus dem alten Valet.

Befehle: `pnpm install`, `pnpm test`, `pnpm typecheck`, Web-Build: `pnpm --filter @valet/app build:web`.

## Veröffentlichen
- GitHub `maxsbg/valet` (privat). Action `.github/workflows/web.yml` baut bei Push auf `main` (oder per workflow_dispatch auf einem Zweig) und schiebt nach `gh-pages`.
- Live: https://maxsbg.github.io/valet/ (baseUrl `/valet`).
- Achtung: workflow_dispatch auf einem Zweig überschreibt die Live-Seite mit diesem Zweig.
- PRs immer gegen `main` öffnen (PR #8 landete versehentlich in einem Feature-Zweig).

## Supabase
- Projekt `jocjisrmmzzvfnijosgg` (eu-west-1), Publishable Key in `src/lib/supabase.ts`.
- Zugriff über RLS mit `is_member(wardrobe_id)`. Schrank „Max & Paul“: `e3601e23-…`.
- Tabellen: wardrobes, wardrobe_members, wardrobe_invites, persons (color 'Rosa'/'Rot', item_order), wishlists, items, item_images (colors jsonb `[{h,s}]`), wears (PK item_id+worn_on), outfits, outfit_items, outfit_plans, reservations, daily_suggestions, cutout_feedback.
- `outfit_plans` hat **keine** direkte Verbindung zu `outfit_items` → über `outfits(outfit_items(item_id))` laden. Abfragen immer gegen die echte DB prüfen.
- Testkonto `claude-test@valet.invalid` (Schrank `c9fcb483-…`) kann gelöscht werden.

## Design
- Kacheln aus dem alten Valet **genau** übernehmen: Schrank- und Wunschlisten-Kacheln mit allen Badges, Mosaik, Outfit-Karten.
- Andere Seiten (Teil-Detail, Bearbeiten, Status, Statistik) dürfen neu gestaltet werden.
- Web: Das Dokument selbst scrollt, damit Inhalte unter der Safari-Leiste durchlaufen. Feste Leisten über `position: fixed` (Web) und `src/lib/bottomInset.ts` (misst, wie viel die Browserleiste unten verdeckt). Web nutzt `Slot` statt `Stack`.

## Freistellen (entschieden)
- Modell **RMBG-1.4 von BRIA** (nur nicht-kommerziell!), im Browser auf dem Grafikchip (WebGPU, 1024 px), sonst Prozessor (512 px).
- Dateien: `apps/app/public/freistellen/` – `rmbg.js` (Rechenkern aus dem alten Valet + Ablauf), `rmbg14.bin` (44 MB, int8) + `rmbg14.json`. Modell wird in IndexedDB `valet-ki` gespeichert.
- API: `ValetRMBG.load(onProgress)`, `ValetRMBG.cutout(file, 'alt2', onStep)` → `{ canvas, file (WebP), thumb (WebP 400 px), info }`.
- Gewählte Variante: **`alt2` („Neues Alt“)** = Ablauf altes Valet (Kanten unverändert) + Krümel/einfarbigen Hintergrund entfernen + WebP mit Vorschaubild. Am iPhone ca. 11 s.
- Verworfen: Kantenfilter/Farbsaum (zeichnet Kanten unpassend nach), BiRefNet im Browser (iPhone stürzt ab), Server-Lösungen (ZeroGPU-Kontingent, Azure nicht berechtigt, Modal ohne Karte nur 1 $). Testseite: `/valet/freistell-rmbg.html`.

## Nächste Schritte
1. ~~Teil hinzufügen~~ (Seite `src/app/neu.tsx`, Formular gemeinsam mit Bearbeiten in `src/components/ItemForm.tsx`). Bucket `items` per `supabase/migrations/0002_storage_items.sql` (öffentlich lesbar, Schreiben nur Mitglieder). Ablage `<wardrobe>/<item>/<seite>-<stempel>.webp` + `-thumb.webp`; in `item_images` je Seite eine Zeile `cutout`/`original` (mit Farben) und eine `thumb`. Kacheln zeigen nur `thumb`-Zeilen, sonst Silhouette.
2. ~~Alte Bilder importieren~~ (Seite `src/app/bilder-import.tsx`, erreichbar über Statistik). Altes Valet: Zahnrad → „Kleiderschrank exportieren“ → „Alle Bilder (ZIP)“ (`exportAllZip`, ZIP ohne Kompression: `bilder/<alte Bild-ID>.png`, `bilder.csv`, `valet-daten.json`). Am iPhone über Teilen → „In Dateien sichern“, weil die Fähigkeit `downloads` im alten Artifact nicht freigeschaltet ist. Neue App liest das ZIP stückweise (`packages/core/src/import/zip.ts`), ordnet über `item_images.legacy_id` bzw. `bilder.csv` (alte Teil-ID + Seite) zu (`legacyImages.ts`) und speichert mit `saveImage` (WebP 1200 px + Vorschaubild 400 px). Seiten mit `thumb`-Zeile werden übersprungen → wiederholbar, auch nach dem frischen Datenimport.
3. Outfits-Seite, Statistik, Paul einladen.
4. Frischer Datenimport vor dem Umstieg.
