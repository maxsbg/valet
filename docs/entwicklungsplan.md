# Valet – Strategie und Entwicklungsplan

Stand: 12.11.2026 (2. Fassung, ergänzt um Kosten, iOS-Ziel und Designsystem) · Grundlage: Code-Analyse von Valet (Artifact-Version 1794482748), `research.md` (Acloset) und eigene Technik-Recherche

---

## 1. Entscheidung

**Valet bleibt die fachliche Grundlage, Acloset liefert nur Funktionsideen.** Technisch baut Valet von nun an auf einer **gemeinsamen Codebasis für Web und iOS** auf:

- **Expo (React Native) mit React Native Web und Expo Router, in TypeScript**: eine App, die als Web-App startet und später ohne Neubau als native iOS-App erscheint.
- **Gemeinsame Pakete:** `core` (Fachlogik aus Valet), `ui` (Designsystem mit Liquid-Glass-Bedienebene) und `services` (Schnittstellen mit einer Umsetzung je Plattform, z. B. Freistellen im Browser bzw. über Apple Vision, Kalender als .ics bzw. Apple Kalender).
- **Kostenloser Betrieb:** Supabase (Daten, Login, Bilder, KI-Proxy), Cloudflare Pages (Web), Gemini Flash (KI), Open-Meteo (Wetter), Expo EAS (iOS-Builds). Einzige echte Kostenstelle ist später die Apple-Mitgliedschaft (99 $/Jahr), und die erst, wenn die iOS-App getestet bzw. veröffentlicht werden soll.

Die Fachlogik von Valet wird übernommen. Die Oberfläche wird **einmal** neu gebaut, und zwar so, dass sie danach für Web und iOS dient.

---

## 2. Ist-Stand von Valet

### 2.1 Architektur

| Punkt | Befund |
|---|---|
| Aufbau | **Eine einzige HTML-Datei** mit ~6.260 Zeilen und ~560 KB. Darin stecken CSS, HTML und ein großes Skript mit ~310 Funktionen und ~730 Variablen, die überall im Skript sichtbar sind. Dazu kommen KI-Modell-Gewichte als JSON-Dateien (u2netp, rmbg) für das Freistellen direkt im Browser. |
| Daten | Datenbank der Claude-Artifacts (`window.claude.use('db')`) mit den Sammlungen `items`, `outfits`, `people`, `wishlists`, `daily`, `cutoutFeedback`. Bilder liegen im Claude-Speicher (`assets`). Kleine Einstellungen liegen im `localStorage` (~35 Stellen). |
| KI | Läuft über Claude im Artifact (`window.claude.use('sample')`), an ~10 Stellen: Kleidung erkennen, Screenshots auslesen, Outfit-Vorschläge, Anlässe, Cap-Wahl, Wechselkurs, Kauf-Check. |
| Darstellung | Die Oberfläche wird aus Text-Bausteinen zusammengesetzt (`innerHTML`, ~90 Stellen). Es gibt kein Framework und keine Komponenten. |
| Fehlerbehandlung | ~170 `try{…}catch{}`-Blöcke, die meisten **schlucken Fehler still**. |
| Tests, Versionierung | Keine automatischen Tests, kein Git, kein Build-Schritt |
| Entwicklungsreste | `kiBench` (Messwerkzeug für die KI), `boardTestBar` (Testleiste). In `STATUS` steht der Schlüssel `repair` doppelt. |

**Die wichtigste Erkenntnis:** Valet läuft heute **nur innerhalb von claude.ai**. Außerhalb zeigt die App selbst die Meldung „Speichern ist in dieser Ansicht nicht verfügbar“. Dein Plan, Valet als eigenständige Web-App mit Gemini Flash zu betreiben, ist deshalb **kein kleiner Schritt, sondern ein Plattform-Umzug**: Datenbank, Bildspeicher und KI müssen ersetzt werden.

### 2.2 Funktionsumfang (laut Code)

Valet kann heute schon deutlich mehr, als ich in der ersten Fassung von `research.md` angenommen hatte:

- **Erfassen:**
  - Einzel- und Massen-Upload, Screenshots auslesen, Bild einfügen und hineinziehen.
  - Freistellen mit **mehreren Verfahren** (lokale Modelle u2netp, ISNet, RMBG sowie eigene Verfahren für Studio-, Verlaufs- und Schatten-Hintergründe).
  - Nachbearbeitung mit Radieren und Wiederherstellen.
  - KI-Erkennung von Name, Marke, Kategorie, Farbe und Material.
  - **Dubletten-Erkennung** über einen Bild-Fingerabdruck.
- **Kleiderschrank:**
  - Mosaik-, Spalten- und Stapel-Ansicht, eigene Reihenfolge per Ziehen, Sortierung, Suche, Filter, Tags.
  - Wendeteile mit zwei Seiten, Status (Wäsche, Reparatur, verliehen, aussortiert, verkauft mit Erlös).
  - Mehrere Personen mit Farbrand, Kauf in Fremdwährung mit Umrechnung, Kaufpreis auf mehrere Zahler aufteilen.
- **Outfits:**
  - Baukasten (Builder) mit Collage bzw. Board und automatischem Layout.
  - Outfit-Würfel mit Farbkombinationen nach Sanzo Wada, Lagen-Regeln, Material-Wärme, Anlässen, „rund um ein Teil“ und einem Freitext-Hinweis.
  - Tagesvorschlag.
  - Teilen als Bild.
- **Planen:**
  - Wochenleiste und Monatskalender, Outfits planen, Reservierungen für bestimmte Tage.
  - Wiederholungs-Hinweise, „getragen“-Einträge, Abfrage zur Wäsche.
- **Wunschliste:** Screenshot rein → Daten und freigestelltes Bild. Dazu Listen, Prioritäten, Wartezeit, „Gekauft“ → Schrank und **Kauf-Check**.
- **Statistik:** Tabs **Ausgaben**, **Getragen** (inkl. Kosten pro Tragen: am meisten rausgeholt / noch teuer) und **Bestand**.
- **Export:** CSV, JSON und Backup.

### 2.3 Bewertung der technischen Qualität

- **Stärken:**
  - Sehr viel echte Fachlogik (Freistellen, Farben, Lagen-Regeln, Zahler, Reservierungen), die so in keiner Konkurrenz-App steckt.
  - Viel Liebe zum Detail in den Abläufen.
  - Ein Export ist schon da.
- **Schulden:**
  1. **Plattform-Abhängigkeit** von claude.ai (Daten, Bilder, KI).
  2. **Eine Riesendatei mit globalem Zustand.** Jede Änderung kann an anderer Stelle etwas kaputtmachen, und Claude muss beim Ändern jedes Mal viel Kontext laden. Je größer die Datei wird, desto teurer und fehleranfälliger wird jede Erweiterung.
  3. **Stille Fehler.** Genau die Art von Bugs, die bei Acloset die häufigste Beschwerde sind (Upload hängt, nichts passiert), wären bei Valet unsichtbar.
  4. **Keine Tests und keine Versionsgeschichte.** Rückschritte lassen sich nicht erkennen oder zurückdrehen.
  5. **Mehrere Freistell-Verfahren nebeneinander.** Das ist schwer zu warten und bläht den Download auf.
  6. **Kein Offline-Modus und kein Installieren als App** (kein Manifest, kein Service Worker).

---

## 3. Vergleich mit Acloset

Legende: ✅ vorhanden · 🟡 teilweise · ❌ fehlt

| Bereich | Acloset | Valet | Urteil |
|---|---|---|---|
| Foto → freigestellt + erkannt | ✅ sehr gut | ✅ gut, lokal + KI | Valet behalten, ein Verfahren als Standard festlegen |
| Mehrere Fotos auf einmal mit Fortschritt pro Teil | ✅ | 🟡 Massen-Import ohne klaren Fortschritt pro Teil | **verbessern** |
| Eigenschaften als Chips (Jahreszeit, Material, Muster, Anlass, Stil) | ✅ sehr umfangreich | 🟡 Farbe, Material, Anlass, Tags | **gezielt ergänzen** (Jahreszeit, Muster). Kein Wildwuchs wie bei Acloset mit 30 Materialien. |
| Daten vervollständigen (Kleiderschrank-Check) | ✅ | 🟡 Merker `incomplete` | **übernehmen** als kurzer geführter Durchgang |
| Online-Käufe importieren (Shop-Login, Gmail) | ✅, aber umständlich | 🟡 Screenshot-Weg | **nicht übernehmen**. Dein Screenshot-Weg ist einfacher und datensparsamer. |
| Katalog / Bibliothek fremder Nutzer | ✅ | ❌ | **weglassen** (braucht viele Nutzer und Moderation) |
| Schrank-Ansicht, Filter, Sortierung | ✅ | ✅ mehr Ansichten als Acloset | behalten, Ansichten verschlanken |
| Outfit selbst bauen | ✅ 4 Wege | ✅ Builder + Board | behalten, Bedienung überarbeiten |
| KI-Vorschläge | ✅ Wetter automatisch, Rubriken | ✅ Regeln stärker als Acloset, Wetter nur per Hand | **Wetter automatisch + Temperaturempfinden übernehmen** |
| Rubriken „selten getragen“, „hoher CPW“, „mit neuem Teil“ | ✅ | 🟡 Daten da, Rubriken fehlen | **übernehmen** (kleiner Aufwand, großer Nutzen) |
| Ausschließen (Wäsche, eingelagert, unpassende Kombi) | ✅ | ✅ Status Wäsche, 🟡 eingelagert und unpassende Kombi fehlen | **ergänzen** |
| Kalender + getragen | ✅ | ✅ inkl. Reservierungen | behalten. „Heute getragen“ mit einem Tippen schärfen. |
| Statistik (CPW, Schrank-Wert, Ausgaben) | ✅ | ✅ | behalten. Komplette sortierbare Liste und „lange nicht getragen“ ergänzen. |
| Packliste | ✅ | ❌ (geplant) | später |
| Homescreen-Widget | ✅ | ❌ | im Web nicht möglich (dort morgendliche Mitteilung). In der iOS-App als echtes Widget (Phase 7). |
| Virtuelle Anprobe / Avatar | ✅ | ❌ | weglassen (teuer, wenig Nutzen) |
| Chat-Stylist mit Figur | ✅ | ❌ | **weglassen**. Dein Würfel mit Hinweis-Feld ist schneller. |
| Community, Challenges, Missionen, Bohnen, Werbung | ✅ | ❌ | **weglassen** (Hauptgrund für „überladen“) |
| Mehrere Personen, Kosten teilen, Reservieren | ❌ | ✅ | **Valet-Alleinstellung**, behalten |
| Wunschliste mit Kauf-Check | 🟡 | ✅ | Valet ist hier besser |
| Dubletten-Warnung | ❌ | ✅ | Valet ist hier besser |
| Offline, installierbar, stabil | 🟡 (Klagen über Abstürze) | ❌ | **Pflicht** beim Umzug |

**Fazit:**
- Bei den Kernfunktionen ist Valet **gleichauf oder besser** als Acloset.
- Was fehlt, sind vor allem drei Dinge:
  1. automatisches Wetter in den Vorschlägen,
  2. fertige Rubriken, die selten getragene oder teure Teile nach vorne holen,
  3. ein paar Eigenschaften und der „Daten vervollständigen“-Durchgang.
- Der eigentliche Rückstand liegt nicht bei den Funktionen, sondern in der **technischen Basis**.

---

## 4. Begründung der Entscheidung

**Warum nicht Option 1 (Neubau auf Basis von Acloset)?**
- Von Acloset gibt es keinen Code, nur eine Funktionsliste.
- Ein Neubau hieße, ~6.000 Zeilen funktionierende Fachlogik wegzuwerfen, die Acloset nicht einmal hat (Zahler, Reservierungen, Lagen-Regeln, Wada-Farben, Dubletten, lokales Freistellen).
- Außerdem würden wir Aclosets Schwächen nachbauen: zu viele Wege, Community-Ballast.

**Warum nicht reines Weiterbauen (Option 2 ohne Umbau)?**
- Jede neue Funktion in der Riesendatei vergrößert die Schulden.
- Der geplante Schritt raus aus claude.ai (zu Gemini) wird mit jeder Woche teurer.
- Ohne Tests und Fehleranzeige landet man genau bei Aclosets Hauptproblem: Bugs, die keiner sieht.

**Warum dieser Weg?**
- Wir behalten alles, was Valet stark macht: die Logik, die Abläufe und deine Daten.
- Wir tauschen die Teile aus, die uns ausbremsen: Plattform, Dateistruktur, Fehlerbehandlung und, wegen des iOS-Ziels (Abschnitt 5), die Oberfläche.
- Wir ergänzen von Acloset **nur** Ideen mit nachweisbarem Nutzen für die Kernschleife: Erfassen → Überblicken → Kombinieren → Tragen und Auswerten.

---

## 5. Neue Rahmenbedingungen (Ergänzung vom 12.11.2026)

Deine Prioritäten, absteigend:
1. Langfristig hochwertige, erweiterbare App
2. Möglichst einfacher Übergang von der Web-App zur nativen iOS-App
3. Möglichst viel Code, Logik und Designsystem wiederverwenden
4. Kosten minimieren (kostenlose Angebote, GitHub Student Developer Pack)
5. Schon in der Web-Version ein hochwertiges, iOS-typisches Nutzungsgefühl (an Liquid Glass orientiert, nicht kopiert)

**Was das am bisherigen Plan ändert:**
- Bisher hatte ich empfohlen, Valet in JavaScript-Module aufzuteilen und die Oberfläche aus Text-Bausteinen zu behalten.
- Für eine **native** iOS-App reicht das nicht: Eine Oberfläche, die als Text-HTML zusammengebaut wird, lässt sich nicht in eine echte iOS-Oberfläche überführen.
- Deshalb gilt jetzt: Die **Logik** von Valet wird übernommen, die **Oberfläche** wird einmal neu gebaut. Das passiert in einer Technik, die Web und iOS aus derselben Codebasis bedient.

---

## 6. Technologie-Vergleich

Bewertet nach deinen fünf Prioritäten (++ sehr gut, + gut, o neutral, – schwach).

| Ansatz | Qualität / Erweiterbarkeit | Übergang zu iOS | Wiederverwendung Web ↔ iOS | Kosten | iOS-Gefühl im Web | Urteil |
|---|---|---|---|---|---|---|
| **Expo (React Native) + React Native Web + Expo Router** | ++ TypeScript, große Community, eine Navigation für alle Plattformen | ++ dieselbe App, nur ein anderes Ziel beim Bauen | ++ Logik, Oberfläche und Designsystem gemeinsam | ++ kostenlose Stufe reicht | + | **Empfehlung** |
| Capacitor (Web-App in einer iOS-Hülle) | + | + schnell, aber es bleibt eine Web-Ansicht | ++ fast 100 % | ++ | + | Zweitbeste Wahl. Native Liquid-Glass-Elemente und ein echtes iOS-Gefühl sind nur nachgeahmt. |
| Next.js (Web) + später React Native | + | – zweite App nötig | o Logik ja, Oberfläche doppelt | + | + | Verstößt gegen „nicht neu programmieren“ |
| Flutter | + | ++ | + (Web-Version schwächer, große Downloads) | ++ | o | Neue Sprache (Dart), kein Vorteil gegenüber Expo |
| SwiftUI nativ + eigene Web-App | ++ für iOS | ++ | – alles doppelt | o | – | Zu viel Doppelarbeit |
| Kotlin Multiplatform | + | + | o | ++ | o | Zu aufwendig für ein Ein-Personen-Projekt |

**Warum Expo:**
- Expo führt iOS, Android und Web unter einem Dach zusammen. Expo Router nutzt dafür eine gemeinsame, dateibasierte Navigation auf allen drei Plattformen ([Quelle](https://aierastack.pages.dev/compare/expo/expo~ionic-team/ionic-framework~ionic-team/capacitor~flutter/flutter)).
- In Vergleichen von 2026 gilt Expo als die empfohlene Art, React-Native-Apps zu bauen, mit fertigen Diensten für Bauen, Einreichen und Aktualisieren ([Quelle](https://www.pkgpulse.com/guides/react-native-vs-expo-vs-capacitor-cross-platform-mobile-2026)).
- Liquid Glass gibt es fertig als Expo-Paket: `expo-glass-effect` nutzt das **echte iOS-Glas** (UIVisualEffectView) ([Quelle](https://docs.expo.dev/versions/v57.0.0/sdk/glass-effect/)). Es läuft erst ab iOS 26 und zeigt auf anderen Plattformen eine normale Fläche ([Quelle](https://docs.expo.dev/versions/v57.0.0/sdk/glass-effect/)). Für die Web-Version bauen wir deshalb eine eigene Glas-Variante per CSS (`backdrop-filter`) hinter derselben Komponente.
- Native iOS-Funktionen (Kalender, Mitteilungen, Kamera, Fotos, Standort) gibt es als fertige Expo-Module. Eigene Swift-Module lassen sich ergänzen, z. B. für das Freistellen mit Apples Vision-Framework.

**Ehrlicher Nachteil:**
- Die heutige Valet-Oberfläche (rund 90 Text-HTML-Bausteine) wird **einmal neu gebaut**.
- Das ist der Preis für „Web und iOS aus einer Codebasis“. Mit Capacitor wäre der Umbau kleiner, aber die iOS-App bliebe dauerhaft eine Web-Ansicht. Genau das soll vermieden werden.
- Die **Logik** (Farben, Wada, Lagen-Regeln, Kosten pro Tragen, Dubletten, KI-Prompts, Zahler, Reservierungen) wird dagegen **übernommen** und nur nach TypeScript übertragen.

---

## 7. Zielarchitektur

```
valet/                          (ein GitHub-Repository, pnpm-Workspace)
├─ packages/
│  ├─ core/        reine Logik, ohne UI und ohne Plattform-Abhängigkeit
│  │               Datenmodell (Teil, Outfit, Person, Tragen, Reservierung, Wunsch),
│  │               Farben/Wada, Lagen- und Material-Regeln, Würfel-Logik,
│  │               Statistik (CPW, Ausgaben, Bestand), Dubletten, Währung,
│  │               KI-Prompts + Antwort-Prüfung   → mit Vitest getestet
│  ├─ ui/          Designsystem: Tokens + Komponenten (Button, Card, Sheet,
│  │               TabBar, GlassSurface, Chip, ItemTile …)
│  │               je Komponente ggf. *.web.tsx / *.ios.tsx
│  └─ services/    Schnittstellen + Umsetzungen pro Plattform
│                  data, images, cutout, ai, weather, calendar, notify, files
├─ apps/
│  └─ valet/       Expo-App (Expo Router): Bildschirme, setzt core + ui + services zusammen
│                  → baut Web (statisch) und iOS aus demselben Code
└─ supabase/       Datenbank-Schema, Zugriffsregeln, Edge Functions (KI-Proxy)
```

**Grundregel:** Bildschirme sprechen nur mit `core` und mit den **Schnittstellen** in `services`. Ob dahinter Web oder iOS steckt, entscheidet allein die Plattform-Datei. So kommt eine native iOS-Funktion später als neue Umsetzung derselben Schnittstelle dazu, ohne dass sich ein Bildschirm ändert.

| Schnittstelle | Web (zuerst) | iOS (später) |
|---|---|---|
| `data` (Teile, Outfits, …) | Supabase + lokaler Zwischenspeicher | gleich |
| `images` (Speichern, Laden) | Supabase Storage | gleich |
| `cutout` (Freistellen) | dein bestehendes Verfahren im Browser (das beste aus `kiBench`) | Apple Vision „Subject Lifting“ auf dem Gerät: schnell, kostenlos, offline |
| `ai` (Erkennen, Vorschläge) | Edge Function → Gemini Flash | gleich (Schlüssel bleibt auf dem Server) |
| `weather` | Open-Meteo (kostenlos, ohne Schlüssel) | Open-Meteo, später optional WeatherKit |
| `calendar` | „Zum Kalender hinzufügen“ als .ics-Datei | Apple Kalender direkt (`expo-calendar`) |
| `notify` | Web-Push (nach dem Hinzufügen zum Homescreen) | lokale Mitteilungen sofort, Push über Expo |
| `files` (Kamera, Fotos, Teilen) | Browser-Dateiauswahl | `expo-image-picker`, `expo-camera`, Teilen-Menü |

**Daten:**
- Supabase (Postgres) wird die Hauptquelle, mit Login und Zugriffsregeln.
- Geteilte Schränke sind von Anfang an im Datenmodell vorgesehen:
  - Ein **Schrank** (`wardrobes`) hat **Mitglieder** (`wardrobe_members`) mit den Rollen Besitzer, Bearbeiten oder Ansehen.
  - Jedes Teil gehört zu einem Schrank und hat eine Person als Eigentümer. Kosten können auf mehrere Personen aufgeteilt werden, wie heute.
  - Neue Mitglieder kommen per Einladungslink dazu.
  - Zuerst gibt es einen gemeinsamen Schrank für dich und Paul. Weitere Personen oder Schränke kommen später ohne Umbau dazu.
- Die App hält einen lokalen Zwischenspeicher, damit der Schrank auch ohne Netz angezeigt werden kann.
- Die Bilder werden vor dem Hochladen verkleinert (WebP, ~1.200 px), damit der kostenlose Speicher lange reicht.

**Was aus dem heutigen Valet übernommen wird:**

| Teil | Wie |
|---|---|
| Fachlogik (~60 % der Funktionen) | in `packages/core` nach TypeScript übertragen und mit Tests absichern |
| Freistellen im Browser (u2netp/ISNet) | in `services/cutout.web.ts`, auf ein Verfahren reduziert |
| KI-Prompts | in `core` übernommen, Anbieter-unabhängig |
| Daten + Bilder | Export (Phase 0) → Import-Skript nach Supabase |
| Oberfläche | wird neu gebaut, aber Abläufe und Ideen 1:1 als Vorlage |

---

## 8. Designsystem (an iOS orientiert, eigenständig)

**Grundsätze:**
- **Glas nur für die Bedien-Ebene**, nicht für Inhalte. Tab-Leiste, Werkzeugleisten, schwebende Knöpfe und Sheets sind gläsern. Kleidungs-Kacheln, Listen und Texte liegen auf ruhigen, festen Flächen.
  - Auch Leitfäden für Expo empfehlen, Liquid Glass nur für Bedienelemente und Navigation einzusetzen, nicht für die Hauptinhalte ([Quelle](https://skills.sh/devanshudesai/agent-skills/expo-liquid-glass)).
  - So bleibt die Kleidung der Star, und Texte bleiben lesbar.
- **Deine Markenfarben bleiben die Basis:** Warm Ivory als Hintergrund, Oxblood als Akzent und Schrift, Orange für die Hauptaktion (+), Pink und Gelb nur für Status und Hervorhebungen. Glas wird leicht warm getönt (Ivory), nicht kühl-grau wie bei Apple.
- **iOS-Muster:**
  - Tab-Leiste unten.
  - Große Titel, die beim Scrollen klein werden.
  - Sheets mit Griff und Rastpunkten (halb / ganz).
  - Wischen zum Zurückgehen.
  - Kontextmenü bei langem Drücken.
  - Haptisches Feedback (nur iOS).
- **Typografie:** Systemschrift (SF Pro auf iOS, im Web der System-Schriftstapel) für alles Lesbare. Die Markenschrift (Gloock) nur für den Schriftzug „valet“ und große Überschriften. Größenstufen wie bei iOS (Large Title 34, Title 28/22/20, Body 17, Callout 16, Footnote 13, Caption 12).
- **Raster:** Abstände 4/8/12/16/24/32. Ecken 10 (klein), 16 (Karten), 22 (Sheets). Mindestgröße für Tippflächen 44 × 44.
- **Bewegung:** Push ~250 ms, Sheet ~300 ms mit leichter Feder, sofortiges Feedback beim Antippen. Dazu passen die Messungen aus `research.md`, Abschnitt 2.3.

**Technisch:**
- Alle Werte liegen als **Design-Tokens** in `packages/ui/tokens.ts` (Farben, Abstände, Radien, Schriftgrößen, Glas-Stufen).
- Eine Komponente `GlassSurface` wählt die passende Umsetzung: auf iOS 26+ `expo-glass-effect`, auf älterem iOS eine Unschärfe (Blur), im Web `backdrop-filter`. Fehlt das alles, gibt es eine halbtransparente feste Fläche.
- Zuerst entstehen ~15 Grundkomponenten mit einer kleinen Vorschau-Seite (Storybook oder eigene `/design`-Route). Erst danach werden Bildschirme gebaut.

---

## 9. Kosten: kostenlose Angebote und Student Pack

### 9.1 Geplante Dienste und ihre kostenlosen Grenzen

| Dienst | Wofür | Kostenlose Grenze (Stand der Recherche) | Risiko / Schutz |
|---|---|---|---|
| **GitHub** (Student Pack: GitHub Pro kostenlos, solange du verifiziert bist) | Code, Versionen, automatische Abläufe | – | keins |
| **Supabase Free** | Datenbank, Login, Bilder, KI-Proxy | 500 MB Datenbank, 1 GB Dateien, 5 GB Datenverkehr, 50.000 aktive Nutzer, Pausierung nach einer Woche Inaktivität ([Quelle](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/)) | Bei täglicher Nutzung pausiert nichts. Zusätzlich ein wöchentlicher automatischer Aufruf über GitHub Actions. **Keine Kreditkarte hinterlegen.** Bilder klein halten (siehe 7). |
| **Cloudflare Pages** | Web-App ausliefern | 500 Builds/Monat, unbegrenzte Bandbreite und Anfragen ([Quelle](https://freetier.co/cloudflare-free-tier)) | keins. Optional: R2 als Bildspeicher, falls 1 GB nicht reicht (10 GB frei, kein Traffic-Preis) ([Quelle](https://www.cloudflare.com/plans.md)) |
| **Gemini Flash (kostenlose Stufe)** | KI | Grenzen je Minute bzw. Tag | Ohne hinterlegte Zahlungsart kann nichts berechnet werden. Datenschutz-Hinweis siehe 9.4. |
| **Open-Meteo** | Wetter (Web + iOS) | kostenlos für nicht-kommerzielle Nutzung, ohne Schlüssel | keins |
| **Expo / EAS Free** | iOS-Builds in der Cloud | 30 Builds pro Monat, davon bis zu 15 für iOS ([Quelle](https://expo.dev/changelog/2023/08-01-eas-free-plan-limits)), keine Kreditkarte nötig ([Quelle](https://expo.dev:443/pricing)) | Für ein Ein-Personen-Projekt reicht das. |

### 9.2 Was das Student Pack konkret bringt

- **Nützlich:**
  - **GitHub Pro** (mehr Codespaces- und Actions-Kontingent).
  - **JetBrains** (z. B. WebStorm) kostenlos, solange du Student bist, jährlich verlängert ([Quelle](https://perkstack.co/blog/github-student-pack-guide)). Optional, VS Code reicht auch.
  - **Eine Domain für ein Jahr gratis**, z. B. über Namecheap oder Name.com ([Quelle](https://perkstack.co/blog/github-student-pack-guide)).
- **Achtung Domain:** Die Gratis-Domain kostet ab dem zweiten Jahr Geld. Empfehlung: **automatische Verlängerung ausschalten** und bis zum App-Store-Start die kostenlose Adresse `valet-….pages.dev` nutzen. Die eigene Domain erst holen, wenn sie gebraucht wird.
- **Nicht nutzen:**
  - **Azure for Students** (100 $ Guthaben, keine Kreditkarte nötig ([Quelle](https://perkstack.co/blog/github-student-pack-guide))). Supabase und Cloudflare decken alles kostenlos ab, und Guthaben läuft irgendwann aus. Das ist genau die Art Wechsel ins Kostenpflichtige, die wir vermeiden wollen.
  - Das 200-$-Guthaben von DigitalOcean gibt es nicht mehr ([Quelle](https://perkstack.co/blog/github-student-pack-guide)).
  - **GitHub Copilot:** Neue Anmeldungen für Copilot Student sind seit dem 20.04.2026 pausiert ([Quelle](https://perkstack.co/blog/github-student-pack-guide)). Für unser Projekt nicht nötig.

### 9.3 Die einzige echte Kostenstelle: Apple

- Das Apple Developer Program kostet 99 USD pro Jahr ([Quelle](https://developer-rno.apple.com/support/enrollment)).
- Eine Befreiung gibt es nur für akkreditierte Bildungseinrichtungen, nicht für einzelne Studierende ([Quelle](https://developer.apple.com/help/account/membership/program-enrollment/)).
- **Ohne** Mitgliedschaft kannst du eine Expo-App kostenlos auf deinem eigenen iPhone ausführen. Die Mitgliedschaft brauchst du erst, wenn du sie mit anderen teilen willst ([Quelle](https://expo.dev/blog/apple-developer-program-explained-free-vs-paid.md)).
- **Mit** Mitgliedschaft kommen TestFlight, Signieren in der Cloud, Push-Mitteilungen über den Server und der App Store dazu ([Quelle](https://expo.dev/blog/apple-developer-program-explained-free-vs-paid.md)).
- Wichtig: Ohne Mac brauchen Cloud-Builds für ein iPhone die bezahlte Mitgliedschaft ([Quelle](https://expo.dev/blog/apple-developer-program-explained-free-vs-paid)). **Ob du einen Mac hast, entscheidet also, wie früh du Valet kostenlos als echte App auf dem iPhone testen kannst.**
- Zur Mitgliedschaft gehört auch WeatherKit mit bis zu 500.000 Aufrufen pro Monat ([Quelle](https://developer.apple.com/weatherkit/get-started/)). Bis dahin reicht Open-Meteo.
- **Empfehlung:** Die 99 $ erst zahlen, wenn die iOS-Version reif für TestFlight bzw. Paul ist. Alles davor bleibt kostenlos.

### 9.4 Datenschutz beim KI-Anbieter (Gemini kostenlos)

- In den Gemini-API-Bedingungen ist geregelt, dass Google Eingaben und Antworten aus der kostenlosen Stufe nutzen darf, um seine Produkte zu verbessern. Bei der bezahlten Stufe ist das nicht der Fall. ([Quelle](https://conductatlas.com/platform/google-ai-studio/gemini-api-terms-of-service/))
- Laut den aktuellen Bedingungen können Menschen bei Google Ein- und Ausgaben lesen, um die Qualität zu prüfen. ([Quelle](https://ai.google.dev/gemini-api/terms-archive/terms_10_17_25))
- Für Fotos eurer Kleidung ist das vertretbar. Fotos, auf denen Personen zu sehen sind (Spiegel-Selfies, Paul), solltet ihr bewusst schicken oder vorher zuschneiden.
- Weil die Schnittstelle austauschbar ist, kann später ein anderer Anbieter oder die bezahlte Stufe ohne Umbau einspringen.

---

## 10. Funktionsentscheidungen

### Behalten (Valet-Stärken)
- Erfassen mit Freistellen, KI-Erkennung, Screenshots, Dubletten-Warnung
- Personen, Kosten teilen, Fremdwährung, Reservierungen, Status
- Builder bzw. Board, Outfit-Würfel mit Wada-Farben, Lagen- und Material-Regeln, Anlässe
- Kalender, Planen, getragen, Wiederholungs-Hinweis, Abfrage zur Wäsche
- Wunschliste mit Kauf-Check
- Statistik (Ausgaben / Getragen / Bestand), Export

### Verbessern (Anregung von Acloset, eigene Umsetzung)
1. **Wetter automatisch** (Ort + Tag) plus **Temperaturempfinden** im Profil („friere schnell“ / „normal“ / „mir ist schnell warm“). Beides fließt in Würfel und Tagesvorschlag.
2. **Rubriken im Outfit-Tab**: „Selten getragen – gib ihm eine Chance“, „Rund um dein neuestes Teil“, „Teuer pro Tragen“. Die Daten dafür hat Valet schon.
3. **„Heute getragen“ mit einem Tippen** direkt im Heute-Bereich und im Vorschlag.
4. **Massen-Upload mit Fortschritt pro Teil**. Fertige Teile sind sofort bearbeitbar, fehlgeschlagene haben „Nochmal“.
5. **Daten vervollständigen**: kurzer Durchgang nur für fehlende Kategorie, Farbe, Jahreszeit und Preis.
6. **Ausschluss erweitern**: Status „eingelagert“ und „unpassende Kombination merken“ (z. B. 👎 beim Würfel).
7. **Statistik**: komplette sortierbare Liste (am meisten / am wenigsten / lange nicht getragen).
8. **Eigenschaft Jahreszeit** als Chip (von der KI vorbefüllt). Muster nur, wenn die Vorschläge davon profitieren.

### Neu entwickeln (aus deiner eigenen Liste, nicht von Acloset)
Packliste, Budget pro Person, Ausmist-Assistent, Lücken-Analyse, Look nachbauen, Wrapped (Jahresrückblick), später das Outfit-Duell.

### Entfernen bzw. verschlanken
- Entwicklungsreste `kiBench` und `boardTestBar` (vorher die Ergebnisse von `kiBench` sichern). Den doppelten `repair`-Eintrag in `STATUS` korrigieren.
- Alle Freistell-Verfahren außer dem besten.
- Ansichten: **nur noch Mosaik** (entschieden am 12.11.2026). Spalten- und Stapel-Ansicht entfallen.
- Nicht übernehmen von Acloset: Community, Challenges, Missionen, Bohnen, Werbung, Shop-Login-Import, Katalog fremder Nutzer, Avatar-Anprobe, Chat-Figur.

---

## 11. Reihenfolge

Jede Phase endet mit einem lauffähigen Stand. **Das heutige Valet im Artifact bleibt in Betrieb, bis die neue App alles kann** (paralleler Betrieb, kein Datenverlust).

| Phase | Inhalt | Fertig, wenn … |
|---|---|---|
| **0 – Sichern** | Vollständiger Export aller Daten und Bilder aus dem Artifact (JSON + Bilder). Abnahme-Checkliste aller heutigen Funktionen (Abschnitt 2.2). Ergebnisse von `kiBench` sichern. | Backup liegt im valet-Ordner |
| **1 – Fundament** | Repository (pnpm-Workspace). `packages/core`: Fachlogik aus Valet nach TypeScript übertragen und mit Tests absichern. Supabase-Projekt: Schema, Zugriffsregeln für dich und Paul, Import-Skript für das Backup. | Tests laufen, Backup ist vollständig in Supabase importiert |
| **2 – Designsystem** | `packages/ui`: Tokens, `GlassSurface` (Web + iOS), ~15 Grundkomponenten, Vorschau-Seite | Alle Komponenten sind im Web sichtbar und abgenommen |
| **3 – App-Gerüst + Web-Start** | Expo-App mit Expo Router: Tabs Schrank · Outfits · Wunschliste · Statistik, Login, Schrank-Ansicht mit Filter und Suche, Teil-Detail und Bearbeiten. Veröffentlichung auf Cloudflare Pages, zum Homescreen hinzufügbar. | Du kannst deinen Schrank in der neuen Web-App ansehen und bearbeiten |
| **4 – Funktionen übertragen** | Bildschirm für Bildschirm nach der Checkliste: Erfassen (Upload, Freistellen im Browser, KI-Erkennung über die Edge Function), Wunschliste + Kauf-Check, Builder/Board, Würfel, Kalender, Tragen, Reservierungen, Status, Statistik, Export | Checkliste vollständig → das alte Artifact wird nur noch gelesen |
| **5 – Kernschleife schärfen** (Acloset-Ideen) | Wetter automatisch + Temperaturempfinden → „Heute getragen“ mit einem Tippen → Rubriken (selten getragen, teuer pro Tragen, mit neuem Teil) → Massen-Upload mit Fortschritt → Ausschlüsse → Daten vervollständigen → Statistik-Liste → Jahreszeit | Morgens: App öffnen → Vorschlag → „getragen“ in unter 10 Sekunden |
| **6 – iOS-App** | Erst in **Expo Go** auf dem iPhone testen (geht auch von Windows aus, ohne Mac). Für eigene native Module einen Development-Build am Mac. Bei kostenloser Signierung muss die App regelmäßig neu installiert werden, deshalb reicht ein Mac, den du ab und zu nutzen kannst. Native Umsetzungen: Freistellen über Apple Vision, Apple Kalender, lokale Mitteilungen, Kamera, Teilen-Menü, Haptik, echtes Liquid Glass. Danach Apple Developer Program → TestFlight für Paul → optional App Store. | Valet läuft als iOS-App mit denselben Daten wie die Web-App |
| **7 – Eigene neue Funktionen** | Packliste → Budget → Ausmist-Assistent → Lücken-Analyse → Look nachbauen → Wrapped → Outfit-Duell. Später Widgets (Swift-Erweiterung) und WeatherKit. | je Funktion einzeln abnehmen |

**Warum diese Reihenfolge?**
- Logik und Daten zuerst (Phase 1), weil sie auf allen Plattformen gleich sind und den größten Wert von Valet ausmachen.
- Das Designsystem vor den Bildschirmen (Phase 2), damit nicht jeder Bildschirm eigene Lösungen erfindet.
- Die Web-Version wird zuerst stabil (Phasen 3–5), so wie gewünscht. Weil Web und iOS dieselbe Codebasis teilen, ist Phase 6 im Wesentlichen das Ergänzen der nativen Umsetzungen hinter den bestehenden Schnittstellen und kein Neubau.

**Erste konkrete Schritte, sobald du zustimmst:**
1. Export-Funktion im heutigen Valet nutzen bzw. ergänzen, sodass Daten **und** Bilder vollständig gesichert werden.
2. GitHub-Repository `valet` anlegen und das Student Pack prüfen bzw. aktivieren.
3. Supabase- und Cloudflare-Konto anlegen, beide ohne Kreditkarte.

---

## 12. Getroffene Entscheidungen (12.11.2026)

1. **Mac:** Du hast regelmäßig, aber nicht jederzeit Zugriff auf einen Mac.
   - Entwickelt wird am Windows-Rechner (Web + Expo Go).
   - Der Mac wird nur für gelegentliche iOS-Development-Builds gebraucht.
   - Die Apple-Mitgliedschaft wird erst für TestFlight bzw. Paul fällig.
2. **Teilen:** Mehrere Personen sollen einen Schrank gemeinsam nutzen können. Zuerst nur du und Paul, mit Logins.
   - Das Datenmodell mit Schrank, Mitgliedern und Rollen ist von Anfang an darauf ausgelegt (Abschnitt 7).
3. **Ansicht:** Nur Mosaik.
4. **KI:** Gemini Flash in der kostenlosen Stufe, die Datenschutz-Grenzen (9.4) sind in Ordnung.

---

## 13. Späterer Umstieg auf Xcode / SwiftUI

**Kurz:**
- Ein späterer Wechsel zu einer reinen SwiftUI-App ist **möglich, aber nicht problemlos**.
- Die Oberfläche müsste dafür in Swift neu geschrieben werden, und die Logik aus `core` (TypeScript) müsste nach Swift übertragen werden.
- Das gilt für jeden Weg, der mit einer Web-App beginnt, weil Swift im Browser nicht läuft.

**Was ohne Änderung bleibt:**
- Supabase mit Datenbank, Login, Bildern und dem KI-Proxy
- alle Daten
- Designsystem-Tokens (Farben, Abstände, Schriftgrößen)
- Abläufe und Bildschirm-Entwürfe

**Was wir jetzt tun, damit der Wechsel billig bleibt (falls er kommt):**
1. **Regeln als Testfälle in JSON** (z. B. „dieses Outfit braucht eine Unterlage“, „CPW = …“). TypeScript prüft heute gegen diese Fälle, Swift könnte später gegen dieselben Fälle prüfen. Dann ist die Übertragung abgesichert.
2. **Rechenintensive bzw. KI-nahe Logik auf dem Server** (Edge Functions). Dort ist sie für jede App-Variante gleich.
3. **Klare Schnittstellen in `services`.** Sie entsprechen später 1:1 Swift-Protokollen.

**Ein Umstieg ist aber wahrscheinlich gar nicht nötig:**
- Eine Expo-App ist unter der Haube ein normales Xcode-Projekt. In Xcode kann man darin jederzeit SwiftUI-Code ergänzen, und Widgets werden ohnehin in SwiftUI geschrieben.
- Damit lassen sich einzelne Teile gezielt nativ bauen, ohne den Rest neu zu schreiben.
- Ein kompletter Wechsel lohnt sich erst, wenn die App praktisch nur noch auf dem iPhone genutzt wird und die Web-Version nicht mehr gebraucht wird.
