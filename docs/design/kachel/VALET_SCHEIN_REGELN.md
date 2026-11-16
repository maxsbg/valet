# Valet – Innenschein der Kacheln (Regeln)

Stand: 16.11.2026, entschieden mit Max. Ersetzt Abschnitt 3 („Innenschein“) der Kachel-Spec und die frühere Highlight-Farbe.
Lesefassung für Max: `schein-regeln.html` (gleicher Inhalt).

Code: `packages/core/src/glow.ts` (`glowColorName`, `glowFor`, `glowShadow`, Ranglisten), Tests `packages/core/test/glow.test.ts`,
Darstellung `apps/app/src/components/tile/TileGlow.tsx`, Werte `itemTile.glow` in `packages/ui/src/tokens.ts`.

## 1. Woher kommt die Farbe?

Aus den **Farben im Steckbrief** des Teils (`items.colors`, Rang-Reihenfolge, max. 3) – nicht mehr aus dem Foto.
Jede Palettenfarbe (Haupt- und Nuance, `COLORS` in `attributes.ts`) hat genau eine Scheinfarbe: ihren eigenen Hex-Wert.

Ausnahmen:
- **Weiß** → heller Ersatzton `#D8D2C8` (weiß auf weißer Kachel wäre unsichtbar).
- **Bunt** → Farbkreis (`MULTICOLOR_STOPS`) **nur am Rand**, gleiche Form wie der einfarbige Schein.
- **Teil ohne Steckbrief-Farben** → nächste Palettenfarbe zur Foto-Farbe (`nearestColor`); ohne Foto-Farbe Ersatzton.

## 2. Welche Farbe gewinnt? (`glowColorName`)

1. **Rang 1 ist farbig** → Rang 1. (Auch wenn eine „stärkere“ Farbe folgt: Gelb · Blau → Gelb.)
2. **Rang 1 ist neutral, das Teil hat aber farbige Farben** → immer eine farbige Farbe (Akzent).
   Bei mehreren gewinnt die, die in der **farbigen Rangliste** weiter oben steht.
   Beispiele: Weiß · Rot → Rot; Schwarz · Gelb → Gelb; Dunkelgrau · Rosa → Rosa; Beige · Braun → Braun.
3. **Nur Neutralfarben** → die, die in der **neutralen Rangliste** weiter oben steht.
   Beispiele: Weiß · Silber · Schwarz → Silber; Schwarz · Beige → Beige; Schwarz · Weiß → Schwarz.

Der Akzent ersetzt die neutrale Farbe am ganzen Rand (kein zweifarbiger Rand).

**Neutralfarben** (nie Akzent): Weiß, Elfenbein, Beige, Taupe, Hellgrau, Dunkelgrau, Schwarz, Silber.
Alles andere ist farbig (auch Braun, Camel, Gold, Bronze, Pastelltöne).

## 3. Ranglisten (oben = wird auf der Kachel stärker wahrgenommen)

**Farbig** (`GLOW_COLOR_RANK`):
1 Bunt · 2 Magenta · 3 Rot · 4 Violett · 5 Burgunderrot · 6 Lila · 7 Blau · 8 Orange · 9 Terrakotta · 10 Koralle ·
11 Senfgelb · 12 Pink · 13 Grün · 14 Marineblau · 15 Gelb · 16 Hellgrün · 17 Bronze · 18 Dunkelgrün · 19 Gold ·
20 Olivgrün · 21 Cyan · 22 Türkis · 23 Petrol · 24 Braun · 25 Camel · 26 Flieder · 27 Khaki · 28 Hellgelb ·
29 Altrosa · 30 Himmelblau · 31 Lavendel · 32 Rosa · 33 Mint

**Neutral** (`GLOW_NEUTRAL_RANK`):
1 Silber · 2 Taupe · 3 Beige · 4 Dunkelgrau · 5 Hellgrau · 6 Elfenbein · 7 Schwarz · 8 Weiß
(Weiß ganz unten = kein Unterschied zu „kein Schein“; Schwarz knapp darüber, weil dunkle Ränder vermieden werden sollen.)

Die farbige Rangliste ist aus Farbkraft (OKLCH-Chroma) und etwas Dunkelheit berechnet und von Max so bestätigt.
Neue Palettenfarbe → in eine der beiden Listen eintragen (Test prüft, dass beide Listen zusammen genau die Palette abdecken).

## 4. Darstellung

| Wert | Kachel (Schrank, Wunschliste) | Bild-Kachel Detail / Bearbeiten |
|---|---|---|
| Form | `box-shadow: inset 0 0 22px 3px rgba(farbe, 0.6)` | `inset 0 0 52px 8px rgba(farbe, 0.6)` |
| Stärke | **60 % für alle Farben** | 60 % |
| Bunt | Ebene unter dem Foto: `conic-gradient` aus den Bunt-Farben, Deckkraft 0,6, darüber weiße Fläche (Abstand = spread, Weichzeichnung = blur/2) | gleich, mit 52/8 |

- In Bearbeiten folgt der Schein live den gewählten Farben (bei Wendeteilen Seite B mit den Farben von Seite B).
- Outfit-Karten bleiben weiß (kein Schein).
- iOS (nativ): Bunt-Ebene gibt es noch nicht → dort heller Ersatzton, bis eine native Lösung (z. B. SVG-Verlauf) gebaut ist.

## 5. Nicht mehr verwendet

- `items.highlight_color` (Spalte bleibt, wird nicht mehr gelesen) und die Highlight-Erkennung aus dem Foto.
- Die HSV-Regel „neutral = Sättigung < 0,25 oder Helligkeit < 0,2“ mit 52 % / 28 %.

## Entstehung (Entwürfe auf claude.ai)

- „Valet – Schein je Farbe“: alle Palettenfarben als Kachel, Stärke je Farbe.
- „Valet – Rangliste der Farben“: beide Ranglisten + Wirkung auf die echten Teile.
- „Valet – Schein nach Steckbrief-Farbe“: Vergleich heute/neu am ganzen Schrank.
