# Valet – Symbole (verbindlich seit 15.11.2026, mit Max)

Einzige Quelle: `packages/ui/src/symbols.ts` (`SYMBOLS`). Übersicht für Max: `symbol-katalog.html` (neu erzeugen mit `pnpm symbole` nach jeder Änderung am Pool; Aufbau in `katalog.ts`). Wächter: `packages/core/test/symbols.test.ts` – schlägt auch an, wenn der Katalog nicht mehr zum Code passt.

## Regeln

1. **Eine Quelle.** Jedes Symbol steht im Pool und wird mit `<Icon name size color />` (`apps/app/src/components/Icon.tsx`) gezeichnet; auf Plaketten mit `<TileIcon name color scale />` (gleiche Formen, Maße aus `itemTile.badge`). Keine Symbole woanders zeichnen (`react-native-svg` nur in `Icon.tsx`, `TileBadge.tsx` = Bedenkzeit-Ring, `edit/fields.tsx` = Farbkreise), keine Schriftzeichen als Symbol (✓ × + − › ‹), keine Icon-Pakete.
2. **Ein Symbol – eine Bedeutung; eine Funktion – ein Symbol.** Neue Funktion → zuerst im Pool suchen (`meaning`, `uses`). Passt die Bedeutung, die Stelle in `uses` ergänzen. Passt nichts → **Max fragen**, Varianten zeigen; ein neues Symbol darf keinem vorhandenen ähneln (auch nicht gedreht).
3. **Raster 24 × 24, nur Linien.** Gefüllt nur kleine Punkte (`f:`). Pflegesymbole im 32er-Raster (Ziffern).
4. **Strich 2 überall** – auch auf Kachel-Plaketten (`itemTile.badge.icon.stroke`, `wornToday.stroke`). Kein eigener Strich pro Knopf. 32er-Raster: 2,67 (`strokeFor`).
5. **Runde Enden und Ecken**, Rechtecke mit Eckradius 2.
6. **Größe im Raster:** hohe Formen 18 hoch, breite höchstens 20 breit, runde/quadratische 18; optisch mittig. Ausnahme: Bügel (`wornToday`) mit Versatz aus `itemTile.badge.wornToday.offsetY`.
7. **Richtung durch Drehen** (`rotate`): den Chevron gibt es einmal – nach unten 90, nach links 180.
8. **Größen nur aus `ICON_SIZE`:** `mini` 12 (X in Mini-Knöpfen) · `inline` 16 (neben Text, Pills) · `chip` 18 (Chips und Kapseln, alle Tabs gleich) · `row` 20 (Zeilen, Menüs, Schalter, Blätter-Pfeile) · `button` 22 (runde Knöpfe, Werkzeugleiste, Pflege-Kreise) · `bar` 24 (Tab-Leiste, Hauptknopf) · `large` 28 (große Einzel-Symbole). Plaketten über `TileIcon`.
9. **Vorgemerkte Symbole** (`reserved`) nicht für anderes benutzen: `dice` (Outfit würfeln), `grip` (Umsortieren per Ziehen), `undo` (Kopfknopf „Zurücksetzen“ laut Spec). Wird die Funktion gebaut: `reserved` entfernen.
10. **Herkunft** angeben: von Lucide abgeleitete Formen mit `src: 'Lucide'` (Lizenzhinweis steht in `symbols.ts`).

## Bewusst geteilt (gleiche Bedeutung)
- `closet`: Tab „Schrank“ + Status „Im Schrank“
- `wornToday`: heute getragen, geplant oder reserviert
- `gift`: Wunsch-Kategorie „Gift“ + Eigenschaft „Geschenk“
- `calendar`: Reservieren, Kauftag planen, Outfit für einen Tag planen
- `close`, `check`, `plus`: Schließen/Entfernen, Fertig/Ausgewählt, Hinzufügen

## Entscheidungen 15.11.2026
- Doppelungen aufgelöst (vorher vier Sammlungen: `Icon.tsx`, `TileIcons.tsx`, `DetailIcons.tsx`, `GLYPHS` in `detail/parts.tsx`); jeweils die Fassung der Detailseite behalten.
- Besonderer Anlass = Rosette (Funkeln bleibt KI). Sonstiges = Formen (sah vorher aus wie „Mehr“). Zurücksetzen = Rückgängig-Pfeil (nicht wie Wendbar). Reihenfolge = gerade Pfeile hoch/runter (nicht Chevron). „Outfit damit“/Baukasten = Karten-Stapel mit Plus (Würfel bleibt fürs Generieren). Büro bleibt Aktentasche.
- Angeglichen: Strich überall 2; neu gezeichnet Verliehen, Eingelagert, Frühling, Herbst, Sommer, Kamera, Etikett, Tüte/Gekauft; Eckradius 2 bei Kalender, Wäsche, Handy, Würfel; Größe/Mitte bei Alltag, Party (eine Linie weniger), Strand, Café, Wärme, Loungewear, Geschenk, Büro, KI, Regen, Waschen/Nicht bleichen.
- Woche/Monat blättern mit Chevron statt Zurück-Pfeil.
