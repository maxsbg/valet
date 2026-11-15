# Valet – Teil-Detailseite, Wunschteil und Bearbeiten: Spezifikation

Stand: 15.11.2026. Verbindliche Regeln aus der Abstimmung mit Max für die Seiten **Teil-Detail** (`src/app/teil/[id].tsx`), **Wunschteil-Detail** und **Bearbeiten** (`src/components/ItemForm.tsx`, auch für „Neues Teil“).

- **Visuelle Referenz:** Leinwand „Valet – Teil-Detailseite“ auf claude.ai (dunkles Thema): https://claude.ai/artifact/257e6JVHkfBnrNxKjnWLha – drei Reihen: Detailseite Schrank-Teil, Detailseite Wunschteil, Bearbeiten. Die Bearbeitungsseite ist dort antippbar (Kategorie, Farben, alle Zeilen, Aufteilung, Geschenk, Wendbar, Anzahl). Seit 15.11.2026 auch: „D · Status-Menü“, „D · Übersicht, leere Zustände“, „E · Wunschteil – Steckbrief (Pflege geschätzt)“, „H · Wunschteil bearbeiten“ und eine Reihe „Helles Thema“.
- **Dieselben Regeln** stehen im Valet-Designsystem auf claude.ai (Abschnitt „Teil-Detailseite, Wunschteil und Bearbeiten“).
- Die Leinwand zeigt das Ergebnis, diese Datei das Warum und die Ausnahmen. **Bei Widerspruch gilt diese Datei.** Die Beispielwerte (COS, 59,00 €, Flannel) sind ausgedacht.
- Werte als Tokens in `packages/ui/src/tokens.ts`, Logik (Rang, Verteilung, Preisformat, Set-Reihenfolge) in `packages/core`, mit Tests.

---

## 1. Allgemeine Regeln (gelten für alle drei Seiten)

- **Gloock** für: Name des Teils (32 px), Karten-Überschriften (20 px), Titel in Kopfzeilen und Blättern (20 px), große Preise (32 px), Werte der Tragen-Kacheln (22 px), „Geschenk“. Alles andere (Kapseln, Zeilen, Beschriftungen, Fließtext) in SF Pro.
- **Kapsel-Maße** überall gleich wie die Filter-Kapseln im Schrank: 38 px hoch, mindestens 52 px breit, 13 px seitlich, Schrift 16 px / 600, Text mittig. Gewählt = gefüllt (`ink` auf `bg`), ungewählt = feiner Rand (`hairline`). Erneut tippen hebt die Wahl auf. Kein X in Kapseln.
- **Werte nur als Symbol** (Saison, Farben, Pflege, Status, Wunsch-Kategorie) stehen in **runden** 38-px-Kreisen, nicht in ovalen Kapseln. Farbkreise darin immer 24 px, überall gleich groß (Auswahl, Nuancen, Zeile, Ansicht).
- **Wischen nur bei Leisten** (Filterleiste im Schrank, Kategorie-Leiste der Wunschliste). Auswahlfelder in Formularen brechen immer um.
- **Gleichmäßig umbrechen:** Passen Kapseln nicht in eine Zeile, werden sie gleichmäßig auf die nötigen Zeilen verteilt (5 → 3 + 2, nicht 4 + 1; 6 → 3 + 3). Passt alles in eine Zeile, bleibt es eine. Vorgehen: Zeilenzahl R wie beim normalen Umbruch bestimmen, dann die Kapseln möglichst gleich auf R Zeilen verteilen; passt das nicht, normaler Umbruch. Breiten messen, nicht schätzen. Gilt für Auswahlfelder und für die Werte rechts in Zeilen (dort rechtsbündig).
- **Reihenfolge statt Zahl:** Wo eine Reihenfolge zählt (Farben, Material nach Anteil), steht der Rang nur in der geöffneten Auswahl. In Zeilen und in der Ansicht genügt die Reihenfolge.
- **Personen** immer mit Monogramm-Plakette (Gloock, `person-*-text` auf Weiß), nie mit Farbpunkt. Personenfarben nur in Balken (z. B. Kostenaufteilung).
- **Status-Symbole** einfarbig in Schriftfarbe, keine Statusfarben in den Symbolen. In gefüllten (hellen) Kapseln nimmt das Symbol die Schriftfarbe der Kapsel an (nicht weiß auf weiß).
- **Kopfzeilen:** Titel exakt mittig (Raster `1fr auto 1fr`, nicht mittig zwischen ungleich breiten Knöpfen). Knöpfe als **runde 44-px-Kreise mit Symbol statt Text:** X = Abbrechen (Glas), Haken = Fertig (`accent`), Pfeil gegen den Uhrzeigersinn = Zurücksetzen (Glas, nicht rot).
- **Preise:** unter 100 € mit Cent (8,43 €, 59,00 €), ab 100 € ganze Euro mit Tausenderpunkt (143 €, 4.643 €).
- **Symbol-Schalter** statt iOS-Schalter für Eigenschaften, die eine Kachel-Plakette haben (Geschenk, Wendbar): runder 38-px-Knopf rechts neben der Bezeichnung mit dem Plaketten-Symbol, leer = aus, gefüllt = an. So lernt man das Symbol für die Kachel.

## 2. Detailseite – Aufbau

- Kopf: runde Glasknöpfe Zurück, Teilen, Bearbeiten.
- Bild als große Kachel 358 × 380, Radius 28, Plaketten 40 px mit 8 px Abstand (konzentrisch: 28 − 8 = 20). Gleiche Plaketten-Regeln wie die Schrank-Kachel (`VALET_KACHEL_SPEC.md`), nur × 2. Kein randloses Bild.
- Darunter Marke (13 px, `ink-muted`), Name (Gloock 32), Reiter **Übersicht · Steckbrief · Kauf** (SegmentedControl).
- **Untere Leiste ist eine Werkzeugleiste** (Apple-Richtlinie: Tab-Leiste = Navigation, Werkzeugleiste = Aktionen). Sie ersetzt auf der Detailseite die Tab-Leiste, beide nie gleichzeitig. Gleiche Plätze bei Schrank- und Wunschteil:

| Platz | Schrank-Teil | Wunschteil |
|---|---|---|
| links 1 | Status (aktuelles Status-Symbol, ohne Pfeil) | Kategorie (Next Cop, Grail …, ohne Pfeil) |
| links 2 | Kalender: reservieren | Kalender: Kauftag planen |
| rechts | Würfel: Outfit damit | Würfel: im Outfit ansehen |
| Hauptaktion (rund, 52 px, `accent`) | Heute tragen (Bügel) | Gekauft (Einkaufstüte mit Haken) |

Nur Symbole, in Glas-Gruppen (links eine Gruppe, rechts Würfel + Hauptaktion). Status- bzw. Kategorie-Knopf öffnet das Auswahl-Blatt.

## 3. Detailseite – Übersicht

1. **Status-Karte** nur, wenn der Status nicht „Im Schrank“ ist: Symbol, Titel (z. B. „Verliehen an Paul“), Details (seit / zurück bis), genau eine Schnellaktion (z. B. „Zurück“). Ändern nur über den Knopf unten.
2. **Drei Kacheln in einer Zeile:** Getragen, Pro Tragen, Zuletzt, je mit Hinweis darunter (z. B. „seit 12.10.“, „bei 59,00 €“, „vor 3 Tagen“). Werte immer gleich groß, **22 px**; passt einer nicht (ab fünfstellig), alle drei gemeinsam kleiner, höchstens bis 20 px (Breite messen). Pro Tragen bei geteiltem Preis = eigener Anteil; bei Geschenk „–“. Keine Kachel „Reserviert“.
   **Leere Zustände:** kein Preis → Pro Tragen „–“, Hinweis „Preis fehlt“, Antippen öffnet Bearbeiten im Reiter Kauf; nie getragen → Getragen „0“ mit Hinweis „noch nie“, Zuletzt „–“.
3. **Set-Karte** (falls verknüpft): kleine Kacheln aller Teile, sortiert **von oben nach unten am Körper:** Kopf → Oberbekleidung → Oberteil/Kleid → Hose/Rock → Schuhe → Taschen, Schmuck, Sonstiges; bei gleicher Kategorie außen vor innen (Lagen). Das aktuelle Teil ist in `accent` umrandet. „Bearbeiten“ öffnet ein Blatt mit Set-Name, Suche und Schrank-Raster (gewählt = `accent`-Rahmen + Haken unten rechts) und „Set auflösen“. Ein Teil ist in höchstens einem Set. **Sets werden in der Detailansicht gepflegt, nicht im Bearbeiten-Modus.**
4. **In N Outfits** (keins: Zeile „Noch in keinem Outfit“ mit Knopf „Outfit damit“; kein Set: keine Set-Karte, Verbinden über das „…“-Menü), dann **Notizen**.

Wunschteil-Übersicht: Zeile mit der Liste (nur Name; die Kategorie steht unten in der Leiste), Karte „Lohnt sich das?“ (Kauf-Check: Kombinierbar mit, Ähnlich im Schrank, Lücke, Preis, Prüfdatum), „Im Outfit ansehen“.

## 4. Detailseite – Steckbrief

Karten **Aussehen** (Kategorie, Saison, Farben, Muster, Material, Größe), **Tragen**, **Details** (Stil, Kragen, Verschluss), **Pflege**. Zeilen: Bezeichnung links (15 px, `ink-muted`), Werte rechts als gefüllte Kapseln bzw. Kreise, gleichmäßig umbrochen.

- Kategorie: nur die letzte gewählte Stufe (z. B. „Kurzarmhemd“), kein Pfad. Typnamen sind deshalb immer allein verständlich (Liste und Namensregeln in Abschnitt 8).
- **Tragen als Skalen, nicht als Kapseln:**
  - Passform: zwei 5er-Skalen – Weite (schmal → weit) und Länge (kurz → lang), rechts das Wort (z. B. „eher weit“). Bei Hose und Rock dazu eine 3er-Skala Bund (tief · normal · hoch). Kleid und Rock nur Länge (Mini · über Knie · Knie · Midi · Maxi), keine Weite. „Oversized“ = weit + lang, „Boxy“ = weit + kurz, kein eigener Wert. Shop-Begriffe rechnet die KI auf die beiden Stufen um.
  - Lagen: 4 Stufen von innen nach außen (Unterlage, Mitte zu, Mitte offen, Außen), mehrere möglich, rechts „auch allein tragbar“.
  - Wetter: Balken für Wärme (0–3: sehr leicht, leicht, mittel, warm) und Regen (schlecht, mittel, gut).
- Pflege als Symbol-Kreise in der Reihenfolge Waschen, Bleichen, Trocknen, Bügeln, Professionell. Ohne Angabe und ohne Schätzung: „noch leer“ mit „Etikett“ und „Selbst wählen“.
- **Geschätzte Pflege (entschieden 15.11.2026):** Gibt es kein Etikett, schätzt die KI die Pflege aus dem Material, aber nur wenn das Material bekannt ist, und im Zweifel die vorsichtigere Stufe (30 °C statt 40 °C, Trockner „nicht“ statt „niedrig“). Professionelle Reinigung wird nie geschätzt. Geschätzte Symbole: Kreis ohne Füllung, Symbol in `ink-muted`, kleiner Stern (✱) oben rechts am Kreis; darunter einmal „geschätzt aus Material“. Antippen eines geschätzten Symbols → Blatt „Stimmt das?“ mit Bestätigen (wird normal gefüllt) oder Ändern. Ein Etikett-Foto ersetzt jede Schätzung. Speichern je Wert mit Herkunft (`etikett` / `geschaetzt` / `hand`).
- **Wendbar:** zwei Fotos; die Wende-Plakette oben rechts auf der Kachel wechselt die Seite (bestehende Drehung aus `ItemTile`/`useFlip` beibehalten), dazu zwei Punkte unter dem Bild und „Seite A / B“. Farben (und ggf. Muster) je Seite: „Farben Seite A“, „Farben Seite B“.

## 5. Detailseite – Kauf

- Preis groß (Gloock 32), Streichpreis (Listenpreis), Rabatt in `action-text`; Gekauft, Shop, Artikelnummer; Knopf „Produktseite öffnen“ mit Adresse darunter. **Größe steht im Steckbrief, nicht im Kauf.**
- **Geteilt** (mehrere Zahler): Balken in Personenfarben, darunter je Person Monogramm, Name, Anteil in %, Betrag.
- **Geschenk:** statt Preis „Geschenk · von …“ mit Geschenk-Symbol, Datum, Wert (nur Info). Statistik: 0 € in eigener Zeile „Geschenke“, keine Kosten pro Tragen.
- **Wunschteil:** Preis, Shop, Artikelnummer, Gemerkt am, Kauftag geplant, Preis beim Merken, Produktlink. Angaben „aus der Wunschliste“ (Liste, Kategorie, Gemerkt am) gehören nur auf die Wunschteil-Seite, nicht auf die Schrank-Teil-Seite.

## 6. Status

Sieben Status. **Status-Knopf unten öffnet ein Menü wie bei Apple (Pull-down) mit allen sieben Status samt Symbol, der aktuelle mit Haken (entschieden 15.11.2026).** Im Schrank, Wäsche und Aussortiert sind damit sofort gesetzt; Reparatur, Verliehen, Eingelagert und Verkauft öffnen danach ein Blatt für die Zusatzangaben. Kapseln mit Symbol (einfarbig):

| Status | Symbol | Zusatzangaben im Blatt |
|---|---|---|
| Im Schrank | Schrank (zwei Türen) | – |
| Wäsche | Waschmaschine | – |
| Reparatur | Schere | seit, wo (optional) |
| Verliehen | schräg aufsteigender Pfeil | an wen (Monogramm-Kapseln, + andere Person), seit, zurück bis (optional, mit Erinnerung) |
| Eingelagert | Ablage (offene Schale mit Fach) | wo (Keller, Dachboden, bei den Eltern, + Ort) |
| Aussortiert | Kiste (Deckel + Griffleiste), ohne Pfeil | – |
| Verkauft | Euro im Kreis | Erlös, Datum, wo (Vinted, eBay, Kleinanzeigen, Freunde, Sonstiges); Erlös mindert „netto ausgegeben“ |

Symbole genau wie im Entwurf (Leinwand, Zeichenfläche D-Status); sie ersetzen die bisherigen Status-Symbole in `TileIcons.tsx`. Auf der Kachel als Plakette oben links. Einfache Status ohne Angaben erklären im Blatt in einem Satz, was sie bewirken.

SVG-Pfade der Status-Symbole (viewBox 0 0 24, Strich 2, `currentColor`, ohne Füllung):

```
Im Schrank   <rect x="5" y="3" width="14" height="18" rx="2"></rect><path d="M12 3v18"></path><path d="M9.5 11v2"></path><path d="M14.5 11v2"></path>
Wäsche       <rect x="4" y="3" width="16" height="18" rx="2.5"></rect><circle cx="12" cy="13" r="4.5"></circle><path d="M7.5 6.5h2"></path>
Reparatur    <circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M20 4L8.1 15.9"></path><path d="M14.5 14.5L20 20"></path><path d="M8.1 8.1L12 12"></path>
Verliehen    <path d="M7 17L17 7"></path><path d="M9 7h8v8"></path>
Eingelagert  <path d="M4 13l2-8h12l2 8v6H4z"></path><path d="M4 13h5l1 2h4l1-2h5"></path>
Aussortiert  <rect x="3" y="4" width="18" height="5" rx="1.5"></rect><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"></path><path d="M10 13h4"></path>
Verkauft     <circle cx="12" cy="12" r="9"></circle><path d="M15.5 8.6a4.5 4.5 0 1 0 0 6.8"></path><path d="M7 11h6"></path><path d="M7 13.4h6"></path>
```

## 7. Bearbeiten (auch „Neues Teil prüfen“)

- Kopfzeile: X · „Bearbeiten“ (Gloock, mittig) · Haken.
- Bild-Kachel (Radius 28) mit „Foto ändern“ (bei wendbaren Teilen „Foto Seite A/B ändern“ für die gerade gezeigte Seite, Wende-Plakette + Punkte wie in der Ansicht) und **„Infos auslesen“**: Blatt mit Etikett (Pflegesymbole, Material in %, Größe, Artikelnummer), Shop-Screenshot (Name, Marke, Preis, Streichpreis, Farbe, Passform, Material), Bestellbestätigung (bezahlter Preis, Kaufdatum, Shop, Größe), dann Kamera oder Fotos. Die KI erkennt die Art des Bildes auch selbst; Ergebnisse landen als KI-Vorschlag in den Feldern.
- KI-Hinweis, Name und Marke als Textfelder, Reiter **Steckbrief · Kauf**.
- Jede Eigenschaft ist eine **aufklappbare Zeile**: zu = gewählte Werte rechts (genau wie in der Ansicht), auf = Auswahl darunter, Pfeil dreht sich. Felder, die die KI vorausgefüllt hat, tragen eine kleine „KI“-Markierung, bis sie bestätigt oder geändert sind.
- **Kategorie:** Kategorie, Unterkategorie und Typ (nur wo es Typen gibt) stehen untereinander, alle umbrechend, kleine Überschrift je Ebene. Nichts verschwindet beim Wählen, keine Suche, kein X. Neue Oberkategorie setzt Art und Typ zurück. Die Zeile zeigt nur die letzte Stufe als Kapsel.
- **Farben:**
  1. Alle eigenständigen Farben (Hauptfarben, Türkis, Neutral, Sonder) als Kapseln mit Farbkreis.
  2. Hauptfarbe antippen → gewählt, ihre Nuancen erscheinen in einer leicht abgesetzten Fläche darunter (Überschrift = Hauptfarbe, ohne Trennlinie). Die anderen Hauptfarben bleiben wählbar.
  3. Nuance antippen → ersetzt die Hauptfarbe auf demselben Rang. Hauptfarbe erneut → zurück zur Hauptfarbe. Nochmal → abgewählt. Nuance erneut → zurück zur Hauptfarbe.
  4. Höchstens 3 Farben, Rang als Zahl im Farbkreis (dunkel auf hellen, weiß auf dunklen Farben). Bei der vierten: Hinweis in `accent` „Höchstens 3 Farben – erst eine abwählen.“
  5. Zeile zu: nur die Farbkreise in runden Kreisen, ohne Namen, ohne Zahl.
- **Material:** mehrfach, Rang im Chip, 1 = Hauptmaterial.
- **Größe:** System (Buchstaben / Zahlen 44–60), dann Größe (+ One Size); bei Hemden zusätzlich Kragenweite. Systemwechsel setzt die Größe zurück.
- **Passform, Lagen, Wetter:** antippbare Skalen (Strich antippen, 44 px Tippfläche). Lagen mehrfach, darunter ein Schalter „Auch allein tragbar“.
- **Pflege:** je Gruppe (Waschen, Bleichen, Trocknen, Bügeln, Professionell) Chips mit Symbol und kurzer Beschriftung („nicht“, „niedrig“ – die Gruppe sagt den Rest; Screenreader-Text vollständig, z. B. „Bügeln: 2 Punkte“), je Gruppe ein Wert, alles optional. Die KI füllt Pflege aus einem Etikett- oder Shop-Bild aus; ohne Bild schätzt sie nach den Regeln in Abschnitt 4 (grau mit Stern). Antippen und Bestätigen macht eine Schätzung zum festen Wert.
- **Wendbar** (Symbol-Schalter direkt unter den Farben): an → „Farben Seite A“ und „Farben Seite B“, Foto je Seite.
- **Kauf:** Bezahlt | Listenpreis (nebeneinander), Geschenk (Symbol-Schalter; an → Von, Bekommen am, Wert; Bezahlt, Listenpreis, Bezahlt von und Kaufdatum entfallen), Bezahlt von (Monogramm-Kapseln), bei zwei oder mehr Personen Aufteilung „Gleich“ / „Eigene Beträge“ mit Balken und Summenprüfung („Summe passt“ / „Es fehlen noch …“ in `accent`), Kaufdatum | Shop, Produktlink, Artikelnummer.
- **Besitz:** Gehört (Monogramm-Kapseln), Anzahl (− / +; der Preis gilt für alle zusammen, Hinweis „je Stück …“, Kachel zeigt „n×“). „Teil löschen“ am Ende.

## 7a. Bearbeiten – Wunschteil (entschieden 15.11.2026)

Dieselbe Seite wie beim Schrank-Teil, Reiter **Steckbrief · Wunsch** statt Steckbrief · Kauf.
- **Steckbrief** genau wie beim Schrank-Teil (Größe heißt einfach „Größe“, gemeint ist die gewünschte).
- **Wunsch:** Preis (= `list_price`) | Shop, Produktlink, Artikelnummer, Liste (Kapseln mit den Listen, eine), Kategorie (Next Cop, Grail, Watchlist, Someday, Gift als runde Symbol-Kreise, eine), Kauftag geplant (Datum, optional).
- **Entfällt:** Bezahlt, Bezahlt von, Aufteilung, Geschenk-Schalter, Kaufdatum, Anzahl, Status, Gehört. Das alles kommt erst über „Gekauft“ (Blatt wie bisher).
- „Wunsch löschen“ am Ende (statt „Teil löschen“).

## 7b. Helles Thema

Gleicher Aufbau, Farben aus den hellen Tokens des Designsystems (`bg` Ivory, `surface`, `ink`, `accent` Oxblood). Zur Kontrolle liegen auf der Leinwand die Übersicht und Bearbeiten auch in hell. Kacheln bleiben in beiden Themen weiß.

## 8. Kategorie, Unterkategorie, Typ und Passform (entschieden 15.11.2026)

Ersetzt die alte Acloset-Liste (Plural, übersetzte Typen wie „Denimjacke“ unter Hemden). Dieselbe Liste steht im Doc „Valet – KI-Funktionen“ (Steckbrief); bei Widerspruch gilt diese Datei. Gehört als feste Liste nach `packages/core` (Formular, Filter, KI-Prompt und Antwort-Prüfung lesen von dort).

**Namensregeln**
- Immer **Einzahl** (Jeans, Shorts, Leggings, Boxershorts, Pumps sind schon Einzahl).
- Jeder **Typ ist allein verständlich**, weil er oft allein angezeigt wird (eingeklappte Zeile, Detailansicht, Suche, KI): Kurzarmhemd statt Kurzarm, Low-Top-Sneaker statt Low-Top. Feste deutsche Wörter zusammen, englische Begriffe mit Bindestrich.
- Kein „&“ in Namen. Kein Name wiederholt die Ebene darüber.
- **Typ = nur Form.** Material, Muster, Kragen/Ausschnitt, Verschluss, Stil, Länge und Bund haben eigene Felder: Flanellhemd = Hemd + Material Flanell, Lederjacke = Bikerjacke + Leder, Fleecejacke = Sweatjacke + Fleece, Daunenjacke = Steppjacke + Daunen.
- **Anzug und Pyjama** sind keine Kategorie, sondern ein Set (Blazer + Anzughose, Pyjama-Oberteil + Pyjama-Hose).
- **Oberbekleidung** = was man über etwas anzieht und vorne öffnen kann. Hemden bleiben Oberteil.
- Typ ist optional; ohne Klammer gibt es keinen Typ.

| Kategorie | Unterkategorie (Typ) |
|---|---|
| Oberteil | T-Shirt (Henley-T-Shirt), Langarmshirt (Henley-Langarmshirt), Ärmelloses Shirt, Trägertop, Trägerloses Top, Crop Top, Polohemd (Kurzarm-Polohemd, Langarm-Polohemd), Hemd (Kurzarmhemd, Langarmhemd), Bluse (Kurzarmbluse, Langarmbluse, Ärmellose Bluse), Sweatshirt, Kapuzenpullover, Pullover, Pullunder, Sporttop (Trikot, Funktionsshirt, Sport-BH), Body, Pyjama-Oberteil (Pyjama-Shirt, Nachthemd), Sonstiges |
| Kleid | T-Shirt-Kleid, Hemdkleid, Etuikleid, A-Linien-Kleid, Wickelkleid, Bodycon-Kleid, Shiftkleid, Slipdress, Skaterkleid, Stufenkleid, Tunika, Mantelkleid, Jumpsuit, Playsuit, Sonstiges |
| Hose | Jeans, Stoffhose (Chino, Anzughose, Bundfaltenhose), Cargohose, Jogginghose (Trainingshose), Leggings, Latzhose, Shorts (Sportshorts, Cargoshorts, Bermudashorts, Anzugshorts), Pyjama-Hose (Schlafshorts), Sonstiges |
| Rock | A-Linien-Rock, Bleistiftrock, Wickelrock, Plisseerock, Stufenrock, Tellerrock, Meerjungfrau-Rock, Sonstiges |
| Oberbekleidung | Mantel (Chesterfield-Mantel, Caban-Mantel, Covert-Mantel, Duster-Mantel, Carcoat), Trenchcoat, Parka, Steppjacke, Blazer (Einreihiger Blazer, Zweireihiger Blazer), Weste (Anzugweste, Steppweste, Strickweste), Strickjacke, Sweatjacke, Hemdjacke, Shearlingjacke, Blouson, Collegejacke, Coachjacke, Truckerjacke, Bikerjacke, Feldjacke, Sportjacke (Anorak, Regenjacke, Windbreaker, Trainingsjacke, Thermojacke), Bolero, Sonstiges (Poncho, Cape, Morgenmantel) |
| Schuh | Sneaker (Low-Top-Sneaker, Mid-Top-Sneaker, High-Top-Sneaker, Chunky Sneaker, Plateau-Sneaker), Sportschuh (Laufschuh, Fußballschuh, Hallenschuh, Basketballschuh, Tennisschuh, Trainingsschuh), Halbschuh (Oxford-Schuh, Derby-Schuh, Monkstrap-Schuh, Loafer, Wholecut-Schuh, Bootsschuh, Mokassin), Slip-On (Espadrille, Slipper), Stiefel (Chelsea Boot, Desert Boot, Schnürboot, Westernstiefel, Gummistiefel, Lammfellstiefel, Kniestiefel, Overknee-Stiefel), Wanderschuh (Wanderstiefel, Wanderhalbschuh, Trailrunning-Schuh), Sandale (Trekkingsandale, Riemchensandale, Gladiatorensandale), Pantolette (Badelatsche, Flip-Flop, Mule), Hausschuh, Clog, Flacher Schuh (Ballerina, Mary-Jane-Schuh, Slingback), High Heel (Pumps, Stiletto, Blockabsatzschuh, Keilabsatzschuh, Plateau-Heel, Sandalette, Mule Heel), Sonstiges |
| Tasche | Handtasche (Shopper, Hobo-Bag, Bowlingtasche, Beuteltasche, Satchel, Baguette-Bag, Halbmondtasche, Satteltasche, Barrel-Bag), Clutch (Minaudière), Rucksack, Bauchtasche, Stoffbeutel (Jutebeutel, Turnbeutel), Reisetasche (Weekender, Duffel-Bag, Sporttasche), Arbeitstasche (Aktentasche, Laptoptasche), Koffer, Sonstiges |
| Kopfbedeckung | Kappe (Baseball-Cap, Flat-Brim-Cap, Trucker-Cap, 5-Panel-Cap, Dad Cap), Hut (Fedora, Bucket Hat, Sonnenhut, Panamahut), Mütze (Beanie, Baskenmütze, Schiebermütze), Hijab, Sonstiges |
| Schmuck | Ohrring, Halskette, Armband, Ring, Brosche, Uhr, Sonstiges |
| Accessoire | Unterwäsche (Boxershorts, Slip, Unterhemd, BH, Thermowäsche), Socke (Sneakersocke, Sportsocke, Stutzen, Kniestrumpf), Strumpfhose, Bademode (Badeshorts, Badehose, Bikini, Badeanzug), Gürtel, Schal (Strickschal, Loop-Schal, Halstuch, Bandana), Anzug-Accessoire (Krawatte, Fliege, Einstecktuch, Manschettenknopf), Handschuh (Fingerhandschuh, Fäustling, Sporthandschuh, Torwarthandschuh), Brille (Sehbrille, Sonnenbrille), Haarschmuck, Geldbörse, Handyhülle, Traditionelle Kleidung, Stulpe, Sonstiges |

**Passform je Kategorie** (Skalen, Werte als Stufen-Index speichern, nicht als Text):

| Kategorie | Skalen |
|---|---|
| Oberteil | Weite 5 (schmal, eher schmal, normal, eher weit, weit) · Länge 5 (kurz, eher kurz, normal, eher lang, lang) |
| Hose | Weite 5 · Länge 5 · Bund 3 (tief, normal, hoch) |
| Kleid | Länge 5 (Mini, über Knie, Knie, Midi, Maxi) |
| Rock | Länge 5 (wie Kleid) · Bund 3 |
| alle anderen | keine Passform-Zeile |

Shop-Begriffe rechnet die KI um (Slim = schmal, Relaxed = eher weit, Oversized = weit + lang, Boxy = weit + kurz, Cropped = kurz, Baggy = weit, High Waist = Bund hoch, Low Rise = Bund tief). Tapered, Bootcut und Flared entfallen.

**Weitere Listen:** Material zusätzlich Flanell und Lammfell, Muster zusätzlich Zopfmuster und Rippstrick. Kragenweite bei der Größe nur für Unterkategorie Hemd.

**Umstellung vorhandener Teile:** Alte Kategorien und Arten beim Laden bzw. per einmaligem Skript auf die neue Liste abbilden (Plural → Einzahl, „Oberteile › Hemden › Flannel“ → „Oberteil › Hemd“ + Material Flanell, Mini-/Midi-/Maxi-Röcke → Rock + Länge, Pelz-/Fleece-/Daunenjacke → Material). Was sich nicht eindeutig abbilden lässt: Liste für Max zum Nachsehen, nicht raten.

## 9. Offen – Max fragen, nicht selbst entscheiden

Derzeit keine offenen Punkte zu diesen Seiten (alle am 15.11.2026 entschieden). Neue Fragen hier sammeln und erst mit Max klären.
