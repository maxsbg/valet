# Valet

Das Designsystem der Kleiderschrank-App **valet** – für die Web-App und später die iOS-App aus derselben Codebasis. Es orientiert sich an iOS und Liquid Glass, bleibt aber eigenständig: warm statt kühl, ruhig statt verspielt, die Kleidung steht im Mittelpunkt.

Die Werte stammen aus einer einzigen Quelle im Code (`packages/ui/src/tokens.ts` im Repository `maxsbg/valet`); diese Seite wird daraus erzeugt.

## Grundsätze

1. **Die Kleidung ist der Star.** Kacheln sind weiß und tragen keinen Text; ein weicher Farbschein in der Hauptfarbe des Teils und kleine runde Plaketten (Person, Status, Wendeteil, Set) sagen alles Nötige. Kacheln, Mosaik und Outfit-Karten sind aus dem alten Valet übernommen.
2. **Glas nur für die Bedien-Ebene.** Tab-Leiste, Kopfleisten beim Scrollen, Sheets, schwebende Knöpfe und Hinweise sind gläsern (`glass` + Unschärfe). Inhalte – Kacheln, Listen, Text – liegen auf festen Flächen.
3. **Eine Hauptaktion je Bildschirm** in Orange (`action`). Oxblood (`accent`) ist die Stimme der Marke: Schriftzug, aktive Tabs, Links, Bestätigen.
4. **Pink und Gelb sind Gewürze.** Pink (`blush`) für Markierungen wie den Bedenkzeit-Ring; Personen haben eigene Farben (`person-pink` Max, `person-red` Paul). Gelb (`highlight`) nur für „Heute“. Nie als große Flächen.
5. **Text bleibt lesbar.** Jede Kombination erreicht mindestens 4,5:1 (Text) bzw. 3:1 (Symbole, Rahmen) – im hellen und im dunklen Thema. Farbe trägt nie allein eine Bedeutung: Status hat immer ein Wort.

## Inhalt und Ton

- Sprache: Deutsch, du-Form, kurz und konkret. „Teil hinzufügen“, nicht „Neues Kleidungsstück zur Sammlung hinzufügen“.
- Zahlen in deutscher Schreibweise: „54,90 €“, „11.11.“. Bestandszahlen überall gleich zählen („128 Teile“).
- Kein Ausrufezeichen-Jubel, keine Emojis in der Oberfläche.
- Bestätigungen sagen, was passiert ist: „Als getragen eingetragen“ – mit „Rückgängig“.

## Farbe

| Rolle | Hell | Dunkel | Einsatz |
| --- | --- | --- | --- |
| `bg` | Warm Ivory `#f5f0e8` | `#17110f` | Seitenhintergrund |
| `surface` | `#fffcf7` | `#221a18` | Karten, Listen (Kacheln sind immer weiß) |
| `ink` | `#2a1a1d` | Ivory | Text |
| `accent` | Oxblood `#722638` | `#e8899f` | Marke, aktiv, bestätigen |
| `action` | Orange `#ff641f` | Orange | Hauptaktion (Fläche) – Schrift darauf dunkel (`on-action`) |
| `highlight` | Gelb `#f9e58a` | Gelb | nur „Heute“ |
| `blush` | Pink `#ef91b0` | Pink | Personen, Markierungen |

Orange erscheint nie als Schrift auf Ivory (2,6:1); dafür gibt es `action-text` (4,8:1). Oxblood ist im Dunklen zu dunkel und wird dort durch ein aufgehelltes Rosé-Oxblood ersetzt.

## Schrift

- **Systemschrift** (SF Pro auf Apple-Geräten, sonst der Systemstapel) für alles Lesbare, in den iOS-Größenstufen von `large-title` (34) bis `caption` (12).
- **Gloock** nur für den Schriftzug „valet“ (immer klein geschrieben, in `accent`) und seltene große Titel.

## Form und Raster

- Abstände im 4er-Raster: 10 px zwischen Kacheln im Mosaik, `space-md` 16 als Seitenrand, `space-lg` 24 zwischen Abschnitten.
- Ecken: `radius-sm` 10 (Knöpfe, Felder), `radius-md` 16 (Karten), `radius-lg` 22 (Kacheln, Outfit-Karten, Sheets), `radius-pill` (Tab-Leiste, Chips, Plaketten).
- Tippflächen mindestens 44 × 44 px.

## Bewegung

- Rückmeldung beim Antippen sofort (90 ms Verkleinerung), Seitenwechsel 250 ms, Sheets 300 ms mit leichter Feder, Listen blenden mit 60 ms Versatz ein.
- Auf iOS dazu leichte Haptik bei Bestätigungen. Wer „Bewegung reduzieren“ eingestellt hat, bekommt Überblendungen statt Bewegungen.

## Symbole

- Linien-Symbole, 2 px Strich, runde Enden, 24 px Raster (im Stil von SF Symbols, aber eigene Zeichnungen im Web).
- Feste Bedeutungen: **Würfel** = Outfit vorschlagen, **Kleiderbügel** = Schrank, **Ebenen** = Outfits, **Herz** = Wunschliste (nur als Tab, nicht an Teilen), **Balken** = Statistik.

## Glas – technisch

| Plattform | Umsetzung |
| --- | --- |
| iOS 26+ | natives Liquid Glass (`expo-glass-effect`) |
| älteres iOS | Unschärfe (`expo-blur`) mit `glass`-Ton |
| Web | `backdrop-filter: blur() saturate()` mit `glass`-Ton |
| ohne Unterstützung | halbtransparente feste Fläche `glass` |

## Komponenten

17 Grundbausteine, jeweils mit Vorschau und Regeln: Button, IconButton, Chip, SegmentedControl, ItemTile, WishTile, StatusBadge, OutfitCard, TabBar, Header, Sheet, ListRow, TextField, Switch, Toast, WeekStrip, TodayBar. Die Vorschauen zeigen Silhouetten als Platzhalter; in der App stehen dort die freigestellten Produktfotos.

## Was die Komponenten brauchen

Die Web-Vorschauen nutzen `tokens.css` und `components/bundle.css` dieser Seite. In der App entstehen dieselben Bausteine als React-Native-Komponenten in `packages/ui`, die nur diese Tokens verwenden.
