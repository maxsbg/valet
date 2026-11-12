# Valet – Abnahme-Checkliste für die neue App

Stand: 12.11.2026 (Phase 0). Hier steht alles, was das heutige Valet kann. Die neue App (Phase 4) gilt erst als fertig portiert, wenn jeder Punkt abgehakt ist oder bewusst gestrichen wurde (dann mit Grund).

Legende: `[ ]` offen · `[x]` in neuer App vorhanden · `[–]` bewusst gestrichen (Grund dahinter)

## Datenbestand zum Sicherungszeitpunkt (12.11.2026, gelesen über die Datenbank des Artefakts)

| Sammlung | Anzahl | Inhalt |
|---|---|---|
| items | 128 | Teile (davon einige Wunschlisten-Teile mit `wish: true`) |
| outfits | 20 | gespeicherte Outfits inkl. Planungen (`plans`) und Layout |
| people | 2 | Max, Paul (mit Farbe, Spaltenreihenfolge, Vorlieben) |
| wishlists | 1 | Liste „acessories“ |
| daily | 16 | Tagesvorschläge 05.–12.11. pro Person bzw. „all“ |
| cutoutFeedback | 5 | Rückmeldungen zum Freistellen |
| **Summe** | **172** | entspricht `db_usage` (172 Dokumente, ca. 316 KB) |

Der Import in Phase 1 muss genau diese Zahlen wieder ergeben.

## Erfassen
- [ ] Einzel-Upload
- [ ] Massen-Upload (mehrere Fotos auf einmal)
- [ ] Screenshot auslesen (Produktseite → Daten)
- [ ] Bild einfügen (Zwischenablage) und hineinziehen
- [ ] Freistellen: lokale Modelle (u2netp, ISNet, RMBG)
- [ ] Freistellen: eigene Verfahren für Studio-, Verlaufs- und Schatten-Hintergründe
- [ ] Nachbearbeitung: Radieren / Wiederherstellen
- [ ] Rückmeldung zum Freistellen speichern (cutoutFeedback)
- [ ] KI-Erkennung: Name, Marke, Kategorie, Farbe, Material
- [ ] KI-Beschreibung (`vdesc`), Material-Infos (Wärme, Regen, Pflegehinweis)
- [ ] Farbanalyse (`hexes` mit Anteilen), Akzentfarbe
- [ ] Lagen-Erkennung (basis / offen / zu)
- [ ] Dubletten-Erkennung über Bild-Fingerabdruck (`fp`)

## Kleiderschrank
- [ ] Mosaik-Ansicht (einzige Ansicht in der neuen App, laut Entscheidung)
- [–] Spalten- und Stapel-Ansicht (Entscheidung 12.11.: nur Mosaik)
- [ ] Eigene Reihenfolge per Ziehen (`order` pro Person)
- [ ] Sortierung, Suche, Filter, Tags
- [ ] Wendeteile mit zwei Seiten (`reversible`, `altImageId`, `altColor`, `mainSide`)
- [ ] Sets (`setId`)
- [ ] Status: Wäsche, Reparatur, verliehen (an wen), aussortiert, verkauft (mit Erlös und Datum)
- [ ] Mehrere Personen mit Farbrand; Teile ohne Besitzer
- [ ] Kauf in Fremdwährung mit Umrechnung (`origCurrency`, `fxRate`, `fxEstimated`)
- [ ] Kaufpreis auf mehrere Zahler aufteilen (`payers`)
- [ ] Felder: Größe, Shop, Kaufdatum, Listenpreis, Menge, Saisons, Stil, Notizen, Link

## Outfits
- [ ] Baukasten mit Collage/Board und automatischem Layout (`layout` x/y/z)
- [ ] Outfit-Würfel: Farbkombinationen nach Sanzo Wada
- [ ] Würfel: Lagen-Regeln, Material-Wärme, Anlässe
- [ ] Würfel: „rund um ein Teil“ und Freitext-Hinweis
- [ ] Würfel: Cap-Vorliebe (`prefs.caps`, `capTried`)
- [ ] Tagesvorschlag pro Person und gemeinsam
- [ ] Anlässe (automatisch und manuell)
- [ ] Teilen als Bild

## Planen
- [ ] Wochenleiste
- [ ] Monatskalender
- [ ] Outfits für Tage planen (`plans`)
- [ ] Reservierungen von Teilen für Tage
- [ ] Wiederholungs-Hinweise
- [ ] „Getragen“-Einträge (`wears`)
- [ ] Abfrage zur Wäsche (`washAsk`)

## Wunschliste
- [ ] Screenshot rein → Daten und freigestelltes Bild
- [ ] Mehrere Listen
- [ ] Prioritäten, Wartezeit
- [ ] „Gekauft“ → wandert in den Schrank
- [ ] Kauf-Check

## Statistik
- [ ] Ausgaben
- [ ] Getragen inkl. Kosten pro Tragen (am meisten rausgeholt / noch teuer)
- [ ] Bestand

## Export
- [ ] CSV
- [ ] JSON-Backup
- [ ] Neu: alle Bilder gesammelt exportieren (fehlt heute)

## Bekannte Fehler, die nicht mitwandern sollen
- [ ] Doppelter Schlüssel `repair` in der STATUS-Liste
- [ ] Einzelne Test-Teile mit Namen wie „j“ oder „k“ beim Import prüfen und ggf. aufräumen

## Ergänzt nach der Bildschirmaufnahme (12.11.2026)
- [ ] Bestellung auslesen (Preise zu vorhandenen Teilen)
- [ ] Mehrere Produktbilder auf einmal importieren, Daten später nachtragen
- [ ] Kachelfarben neu scannen, Teile analysieren
- [ ] Kachelgröße im Mosaik pro Teil
- [ ] Ansicht: Kachelrand (ohne / Hauptfarbe / grau), Farbverlauf an/aus, Teile anderer Personen markieren / nicht markieren / ausblenden
- [ ] Bild exportieren (freigestellt, durchsichtiger Hintergrund)
- [ ] Outfit des Tages: aus welchem Schrank (Max / Paul / Beide), „Andere Cap“ / „Ohne Cap“, optionale Cap antippen, Farbpunkte mit Wada-Nummer
- [ ] Wunschliste: Geschenkliste, „Lohnt sich das?“, „Im Outfit ansehen“, Prioritäten Grail / Next Cop / Watchlist / Someday, Bedenkzeit-Ring auf der Kachel
- [ ] Trageweise (von Claude geschätzt), Beschreibung für Vorschläge (leer = Claude schreibt sie)
- [ ] Statistik: gespart ggü. Listenpreis, teuerste Teile, Lieblingsteile, Ausgaben nach Kaufjahr
- [ ] Personen: „Das bin ich“, Person hinzufügen
- [ ] Vor dem Umstieg: frischer Import aus dem alten Valet (dort wird weiter gepflegt)
