# Valet – Outfit-Zusammenstellung (Brainstorming, 20.11.2026)

Stand: Brainstorming mit Max, noch keine Umsetzung. Gilt für Würfel, Tagesvorschlag, „rund um ein Teil“ und später Kauf-Check/Lücken-Analyse (eine gemeinsame Logik).

**Ausgangslage:** Die Merkmale der Teile stehen (`matchTraits` in `packages/core/src/traits.ts`: Farbwirkung, Formalität als Bereich, Auffälligkeit, optisches Gewicht, Struktur, Lagen-Rolle, Statement; dazu Profilfelder in `ai/profile.ts` wie Metallton, Form, Glanz, Vielseitigkeit; Wetter/Saison/Lagen in `fields.ts`/`attributes.ts`). Passform (Weite/Länge) ist in `MatchItem.fit` vorgesehen, aber noch nicht ausgewertet. Es fehlt die eigentliche Kombinationslogik.

**Entschieden (Max, 20.11.2026):**
- Keine Ampel-/Kriterien-Anzeige für den Nutzer.
- Wie intern bewertet wird (Score, Gewichte), wird noch gemeinsam durchgegangen – nicht selbst festlegen.

## Die 7 Schritte

1. **Kontext:** Anlass, Wetter, Datum, Person, optional Ankerteil („rund um …“).
2. **Gerüst:** benötigte Slots je Tag (Oberteil, Unterteil, Schuhe, je nach Wetter Mid-/Außenlage); Lagen-Regel mit automatischer Unterlage (meist Weiß, Schwarz nur bei dunklem Anteil).
3. **Harte Filter:** Status (Wäsche, verliehen, reserviert, eingelagert, aussortiert), Wetter, Formalitätsbereiche aller Teile müssen sich überschneiden.
4. **Weiche Bewertung pro Paar:** Farbe (Sanzo Wada, Temperatur – Mode-Neutrale `wearNeutral` lösen keinen Bruch aus), höchstens ein Statement-Teil, optisches Gewicht oben/unten im Gleichgewicht, Struktur-Mix, gleicher Metallton.
5. **Aufbau Schritt für Schritt:** mit Anker bzw. zufälligem Startteil beginnen, jeden Slot mit dem Teil füllen, das zu den bereits gewählten am besten passt; per Zufall aus den Top 3–5 ziehen, damit der Würfel nicht immer dasselbe liefert.
6. **Vielfalt:** kürzlich Getragenes abwerten, „lange nicht getragen“ leicht bevorzugen, später Vorlieben aus dem Outfit-Duell als Gewichtung.
7. **KI nur optional:** z. B. Freitext („heute etwas Mutigeres“). Alles davor läuft lokal und sofort, ohne KI-Aufruf.

## Begriffe

- **Duell-Elo:** Jedes Outfit startet mit z. B. 1000 Punkten; ein Sieg bringt Punkte, mehr gegen stärkere Gegner → Rangliste. Wichtiger: lernen, welche Merkmale öfter gewinnen, und das in Schritt 6 einfließen lassen.
- **Kosten pro Tragen fürs Outfit:** Summe der Kosten pro Tragen der enthaltenen Teile. Eher fürs Wrapped, für die Zusammenstellung kaum relevant.

## Gerüst und harte Regeln (entschieden 20.11.2026, Max)

Gilt zunächst nur für die **Tagesplanung** (ein Outfit für einen Tag). Andere Modi (Würfel frei, Packliste, Kauf-Check …) später gesondert prüfen.

### Gerüst

- Immer: Unterteil + Basis-Oberteil (oder Kleid) + Schuhe.
- Nach gefühlter Temperatur des Tages:
  - ab 24 °: nur Basis, Shorts erlaubt, keine Außenlage; dünne Hemden erlaubt
  - 17–23 °: Basis, optional Mittellage oder Offen darüber
  - 10–16 °: Basis + Mittellage oder Offen darüber, leichte Jacke optional
  - 3–9 °: Basis + Mittellage + Außenlage
  - unter 3 °: wie 3–9 °, Schal/Mütze optional
- Lagen-Regel: Teile mit durchgehender Knopfleiste **oder durchgehendem Zip** (Hemd, Overshirt, Zip-Hoodie, Trainingsjacke, Fleece) brauchen eine Basis darunter, außer unter einem Pullover. Sommer-Ausnahme (offen ohne Shirt) **nur für Hemden**, nicht für Zips. Henley/Quarter-Zip zählen nicht. Unterlage automatisch ergänzen (Weiß ≈ 90 %, Schwarz nur bei dunklem Anteil).
- Accessoires (Kappe, Gürtel, Tasche, Schmuck) nicht in Version 1.

### Wärme je Teil (`warmth` 0–3: sehr leicht · leicht · mittel · warm)

Keine Wärme-Summe, sondern Grenzen je Teil:
- ab 24 °: höchstens „leicht“
- 17–23 °: höchstens „mittel“ (z. B. Wollhose fliegt raus)
- 10–16 °: alles erlaubt
- unter 10 °: „sehr leicht“ fliegt raus, keine Shorts
- Außenlage zusätzlich: 3–9 ° mindestens „mittel“, unter 3 ° „warm“

### Harte Filter

1. Status: nur „Im Schrank“. Eingelagerte nur über einen **Schalter** (oder als selbst gewähltes Ankerteil).
2. Reservierung: an dem Tag für jemand anderen reservierte Teile fallen raus.
3. Saison: aktuelle Saison oder keine angegeben.
4. Regen (`rain` 0–2: schlecht · mittel · gut):
   - Niesel: nichts fliegt raus, „schlecht“ wird nur abgewertet (weiche Bewertung)
   - Regen: Außenlage und Schuhe mindestens „mittel“
   - Starkregen: Außenlage „gut“, Schuhe mindestens „mittel“
5. Formalität: Bereiche aller Teile überschneiden sich und treffen den Bereich des Anlasses (z. B. Sport 1, Campus 1–3, Büro 3–4, Formell 4–5).
6. Sets: **nicht** automatisch mitnehmen. Logik offen, wahrscheinlich nur „Set kommt eher in Frage“.

### Teile anderer Personen (z. B. Paul)

- Schalter beim Planen: „Nur meins“ / „Beide Schränke“.
- Fremdes Teil im Outfit → immer Anfrage: die andere Person bekommt eine Mitteilung, nach Bestätigung wird reserviert.
- Keine zwei festen Modi („zusammen wohnen“/„separat“), sondern eine Einstellung je verbundenem Schrank: „Teile sind sofort greifbar“ ja/nein. Bei „nein“ fremde Teile erst ab morgen vorschlagen (müssen abgeholt werden).

### Wetter

- Quelle vorerst **Open-Meteo** (kostenlos, ohne Schlüssel/Karte) hinter einer eigenen austauschbaren Schnittstelle (z. B. `WeatherProvider` → einheitliches Tageswetter: gefühlte Temperatur, Regenstufe). 
- **Vermerk:** in der iOS-App später **WeatherKit** als weitere Quelle anschließen, ohne die Logik zu ändern.
- **Anlass zuerst (20.11.2026):** Der Anlass wird vor dem Generieren angegeben (vorbelegt, damit es ein Tipp bleibt). Er bestimmt Formalität und Zeitraum.
- **Vorbelegung des Anlasses (20.11.2026, Max):** Mischung aus Kalender und Gewohnheit. Reihenfolge: (1) Termin im Kalender an dem Tag → passender Anlass + Zeitraum (später, iOS/Apple Kalender); (2) sonst gelernt aus den Wochentagen (häufigster Anlass geplanter/getragener Outfits an diesem Wochentag, ggf. Tageszeit); (3) ohne genug Daten „Alltag“. Start mit (2), Kalender folgt.
- **Zeitraum je Anlass (entschieden 20.11.2026, Max):** Vorgabe je Anlass, bei Bedarf von–bis selbst ändern:
  - `everyday` Alltag 8–20 · `campus` Campus 8–19 · `office` Büro 7–19 · `cafe` Café 10–19
  - `date` Date 18–24 · `party` Party 20–3 (Folgetag mitlesen) · `formal` Formell 16–24 · `special_occasion` Besonderer Anlass 12–24
  - `sport` Sport 17–21 (Hin- und Rückweg) · `vacation` Urlaub 9–22 · `beach` Strand 10–19 · `other` Sonstiges 8–22
  - `loungewear` Loungewear: drinnen, Schalter „Regen berücksichtigen“ standardmäßig aus
- **Sport drinnen/draußen (20.11.2026, Max):** kein eigener Schalter. Temperatur zählt immer (Hin- und Rückweg). Der Schalter „Regen berücksichtigen“ deckt „drinnen“ ab: bei Sport standardmäßig an (Training draußen), für Halle/Gym aus. Bewusste Lücke: Hallensport bei Regen verlangt dann keine regenfeste Außenlage.
- **Schalter „Regen berücksichtigen“** (Standard an): aus z. B. bei Auto/Taxi oder wenn man drinnen bleibt.
- **Regenstufe = schlimmste Stunde im Zeitraum** nach Regenmenge (mm/h, einheitlicher als der Wettercode):
  - Niesel: unter 0,5 mm/h
  - Regen: 0,5 bis 4 mm/h
  - Starkregen: ab 4 mm/h oder Gewitter
- **Wahrscheinlichkeit:** Stunde zählt ab 50 % voll (harte Filter); 30–49 % nur als weicher Abzug für „schlecht“ regenfeste Teile, damit knappe Fälle nicht durchrutschen.

### Vielfalt

„Lange nicht getragen“ leicht bevorzugen (Schritt 6); zusätzlich ein Modus „nur lange nicht Getragenes“ (Max: ja).

## Weiche Bewertung (Schritt 4, Stand 20.11.2026, Max)

Jedes Kriterium 0–1, mal Gewicht, normiert auf 0–100. Je Slot zufällig aus den besten k (Standard 4). Teile ohne KI-Profil bekommen neutrale bzw. geschätzte Werte. Alle Zahlen in `packages/core/src/outfit/config.ts` (`DEFAULT_OUTFIT_CONFIG`), Logik in `compose.ts`.

- **Farbe (35):** höchstens 2 Akzentfarben (Mode-Neutrale zählen nicht); Wada-Bonus (2 Farben einer Kombination +0,15, 3+ +0,3); **zwei kräftige Farben (Sättigung ≥ 4) aus verschiedenen Familien ohne Wada-Bezug = Abzug** (ersetzt die verworfene Warm/kühl-Regel, Max 20.11.2026); „fast gleich“ = gleiche Familie bzw. Gruppe (Grau-Achse, Beige-Gruppe), andere Farbe, kaum Helligkeitsunterschied → Abzug.
  - Navy bleibt Mode-Neutrale; zu anderen Blautönen gilt es als Blau (gleiche Familie).
  - **Navy + Schwarz ist okay** (verschiedene Familien, kein „fast gleich“; Schalter `navyBlackNearSame` aus).
- **Auffälligkeit und Muster (20):** höchstens ein Statement-Teil; höchstens ein lautes Muster, dezent zu laut ist okay.
- **Formalität (10):** je enger die Bereiche und je näher an der Mitte des Anlasses, desto besser.
- **Proportion (10):** weit oben + weit unten leichter Abzug; Schuhgewicht passend zur Hosenweite. (Max hat dazu noch einen Punkt.)
- **Oberfläche (5):** vorläufig: höchstens ein glänzendes Teil, Mischung glatt/strukturiert leichter Bonus – **noch genauer durchgehen**.
- **Metallton (5):** Gold und Silber gemischt leichter Abzug.
- **Vielfalt (15):** kürzlich getragen Abzug, lange nicht getragen Bonus; Niesel bzw. Regen 30–49 %: nicht regenfeste Außenlage/Schuhe Abzug; später Duell-Vorlieben.

### Prüfseite

`pnpm outfitpruefung <schrank-abzug.json> [ziel.html]` erzeugt eine eigenständige Seite (nicht in der App, nicht im Repo, weil private Daten): Temperatur, Anlass, Monat, Regen, Schalter, Farbregel und Gewichte einstellen, 20 Outfits würfeln, je Outfit Punkte pro Kriterium und Abzüge. Der Abzug kommt per SQL aus Supabase (Teile mit Profil, Wärme, Regen, Vorschaubild, zuletzt getragen).

**Befund 20.11.2026:** Von 122 Teilen haben erst 8 ein KI-Profil und 9 Wärme/Regen – die übrigen laufen mit Schätzungen. Vor dem Feintuning „Profile ergänzen“ (Statistik → Werkzeuge) laufen lassen. Viele Teile haben keine Wintersaison eingetragen (56 fallen im November raus).

## Stilprofil (Zukunft, Vermerk 20.11.2026, Max)

Das hier ist das **neutrale Grundprofil**. Später ein persönliches Stilprofil (z. B. laut/leise): es ändert nur Gewichte und Grenzen in `OutfitConfig` (z. B. „laut“: zwei Statement-Teile erlaubt, weniger Muster-Abzug, kräftige Farben ohne Abzug), nicht die Regeln. Lernen aus: Angaben im Profil, von Hand gebauten Outfits, Outfit-Duellen. Mit Max noch besprechen.

## Nächster Schritt

Oberfläche (E) und Max' Punkt zur Proportion (D) besprechen, Profile ergänzen, dann Gewichte an der Prüfseite feinjustieren.
