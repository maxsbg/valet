# Valet – Schrank-Kachel (ItemTile): Spezifikation zum Nachbau

Stand: 13.11.2026, Endstand (Anzahl „2ד, allein im Kreis; Zahlenschrift 8,5/6,5 px; optische Zentrierung; Überlappung einheitlich 3 px). Diese Datei beschreibt die Kleidungs-Kachel im Schrank-Mosaik vollständig. Die Datei `valet-kachel-referenz.html` daneben ist die **verbindliche visuelle Referenz**: exaktes CSS, alle Symbole als SVG, die Logik als JavaScript und alle Zustände inklusive Extremfälle. Bei Widersprüchen gilt die HTML-Referenz.

Ziel: In der neuen App (Repo `maxsbg/valet`, Web-App jetzt, später iOS aus derselben Codebasis) genau diese Kachel bauen. Werte als Tokens in `packages/ui/src/tokens.ts` anlegen und die Kachel nur aus Tokens bauen.

Hinweis: Das Valet-Designsystem auf claude.ai enthält bei der Kachel noch einen veralteten Zwischenstand (16 px Ecken, 24-px-Plaketten, Status als Text). **Für die Kachel gilt ausschließlich diese Spec und die HTML-Referenz.**

---

## 1. Grundsatz

- **Kein Text auf der Kachel.** Alle Infos stecken in runden Plaketten mit Symbolen. Einzige Ausnahmen: Monogramm-Buchstaben und Zahlen (Anzahl, „+N“).
- Die Kachel ist **weiß**, auch im dunklen Modus.
- Das Produktfoto (freigestellt, transparenter Hintergrund) ist der Star.

## 2. Kachel

| Eigenschaft | Wert |
|---|---|
| Hintergrund | `#ffffff` |
| Eckenradius | **14 px** (`radius-tile`) |
| Schatten | keiner |
| Feine Kante | 1 px innen, `rgba(42,26,29,0.09)` (`tile-edge`), als Overlay über allem (`::after`, `pointer-events: none`), wie die Cover in Apple Music |
| Innenschein | `box-shadow: inset 0 0 22px 3px <Scheinfarbe mit Alpha>` (siehe 3.) |
| Foto | `object-fit: contain`, 10 px Innenabstand rundum, volle Kachelbreite |
| Overflow | `hidden` |

Mosaik: 3 Spalten. Im Entwurf 8 px Abstand, Höhen je Kategorie (Schuhe/Caps/Taschen flach ≈ 1:1, Oberteile mittel ≈ 1:1,3, Jacken ≈ 1:1,4, Hosen/Mäntel hoch ≈ 1:1,65). Die Mosaik-Logik aus dem alten Valet bzw. dem Designsystem (Zeilen à 44 px, „Kachelgröße im Mosaik“ pro Teil) bleibt bestehen. Diese Spec betrifft nur die Kachel selbst.

### Abwesende Teile
~~Foto abblenden~~ – **entfällt (16.11.2026, Max):** Bei keinem Status wird das Foto abgeblendet oder entsättigt. Der Status zeigt sich nur über die Plakette oben links.

## 3. Innenschein (Farbregel)

**Ersetzt am 16.11.2026** – verbindlich ist jetzt `VALET_SCHEIN_REGELN.md` (Lesefassung `schein-regeln.html`):
Farbe aus den Steckbrief-Farben (Rang 1, bei neutralem Rang 1 der farbige Akzent nach Rangliste), immer 60 %,
Weiß → Ersatzton `#d8d2c8`, Bunt → Farbkreis am Rand. Highlight-Farbe aus dem Foto und die 52/28-%-Regel entfallen.

Form unverändert: `box-shadow: inset 0 0 22px 3px rgba(farbe, 0.6)`

## 4. Plaketten – gemeinsames Material und Maße

| Eigenschaft | Wert |
|---|---|
| Durchmesser rund | **20 px** (`size-badge`) |
| Abstand zum Kachelrand | **4 px** (`inset-badge`) |
| Konzentrisch | Radius 10 = 14 − 4. Regel: `radius-badge = radius-tile − inset-badge`. Ändert sich einer der Werte, wird nachgerechnet. |
| Fläche | `rgba(255,255,255,0.62)` (`badge-glass`) |
| Unschärfe | `backdrop-filter: blur(10px) saturate(1.8)` (+ `-webkit-`) |
| Kanten/Schatten | `box-shadow: inset 0 0.5px 0 #fff, inset 0 0 0 0.5px rgba(255,255,255,0.7), 0 0 0 0.5px rgba(42,26,29,0.10), 0 2px 6px rgba(42,26,29,0.12)` |
| Symbolfarbe | ink `#2a1a1d` (Ausnahmen: Bügel und Monogramm, siehe unten) |
| Symbole | 24er-Raster, Linien, `stroke-width` 2 (seit 15.11.2026, vorher 2,2–2,4), runde Enden; gerendert 11 px (Bügel 12 px). Formen aus dem Symbol-Pool `packages/ui/src/symbols.ts` |

Leistung (Web): Die Unschärfe bei 100+ Kacheln auf dem iPhone testen. Ruckelt das Scrollen, `backdrop-filter` weglassen, das Aussehen auf Weiß ändert sich dadurch kaum.

## 5. Die fünf Plätze

```
┌──────────────────────┐
│ [Status]     [Wend.] │   oben rechts: Wendbar, darunter (3 px) Anzahl-Kapsel „2ד;
│              [ 2× ]  │   ohne Wendbar: Anzahl als Kreis in der Ecke
│                      │
│        Foto          │
│                      │
│ [Bügel]     [P][M]   │   unten rechts: eigenes Monogramm in der Ecke, obenauf; ab 3 Besitzern [+N][M]
└──────────────────────┘
```

### 5.1 Oben links – Status (eines davon oder nichts)
| Status | Symbol |
|---|---| |
| Wäsche | Korb |
| Reparatur | Schere |
| verliehen | Pfeil schräg nach oben rechts (getauscht 14.11.2026; der gerade Pfeil gehört jetzt „Next Cop“ in der Wunschliste) |
| eingelagert / aussortiert | Kiste |
| verkauft | Etikett

Symbol in ink. `aria-label` = Statusname.

### 5.2 Oben rechts – Wendbar und Anzahl
- **Wendbar**: runde Plakette, Symbol zwei gegenläufige Pfeile.
- **Anzahl** (nur wenn ≥ 2), Format **„2ד, „12ד**, ab 100 **„99+“**:
  - **Allein** (kein Wendbar): voller **Kreis 20 px** in der Ecke (`top: 4px; right: 4px`).
  - **Mit Wendbar**: Wendbar in der Ecke, darunter mit 3 px Abstand eine **Kapsel 20 × 14 px** (`border-radius: 999px`), horizontal mittig zum Wendbar-Kreis.
- **Zahlenschrift (gilt für Anzahl und „+N“ gleich):** Ziffern **8,5 px**, `font-weight: 700`, `letter-spacing: -0.3px`, `font-variant-numeric: tabular-nums`, ink; Beizeichen **× und + 6,5 px**, `font-weight: 600`. Ein- und zweistellig gleich groß; „12ד ist so ca. 14,3 px breit und passt mit Luft in Kreis und Kapsel. Immer mittig.
- Nur Wendbar: Kreis in der Ecke.
- Zentrierung von Zahl, ×, + siehe **5.5** (Pflicht).

### 5.3 Unten links – Kleiderbügel
- Wird heute getragen **oder** ist für heute reserviert.
- Runde Plakette im Milchglas, **Bügel-Symbol in der Farbe der Person**, die es trägt bzw. reserviert hat (Strich in Personenfarbe: Max `#d9668e`, Paul `#c8102e`).
- `aria-label` z. B. „heute: Paul“.

### 5.4 Unten rechts – Besitzer (Monogramme)
- Runde Plakette im Milchglas, Buchstabe in **Gloock** (Display-Schrift), **11 px**, in Personenfarbe (im Entwurf dunklere Textvariante: Max `#a8325f`, Paul `#b00e28`. Vorschlag: als Tokens `person-pink-text` / `person-red-text` anlegen).
- **Reihenfolge**: Das **eigene Monogramm (angemeldete Person) sitzt rechts in der Ecke und liegt obenauf**. Links daneben, **3 px** überlappend und *darunter* liegend, die andere Person bzw. „+N“.
- Regeln:
  | Besitzer | Anzeige (links → rechts) |
  |---|---|
  | nur ich | keine Plakette (geändert 14.11.2026) |
  | ich + 1 | `[P][M]`, M oben |
  | ich + 2 oder mehr | `[+N][M]`, N = Anzahl der anderen, M oben |
  | nur eine andere Person | `[P]` |
  | ohne mich, 2 Personen | `[L][P]`, erste Person in der Ecke oben |
  | ohne mich, 3+ Personen | `[+N][P]`, erste Person in der Ecke oben, N = Rest |
  | niemand | keine Plakette |
- „+N“ ist eine **runde** 20-px-Plakette (keine Kapsel), Zahlenschrift wie die Anzahl (siehe 5.2), „+“ klein, **mittig im Kreis** (siehe 5.5).
- **Überlappung einheitlich 3 px**, egal ob Buchstabe oder „+N“ darunter liegt. 3 px ist die kleinste Überlappung, bei der auch „+12“ mittig und vollständig sichtbar bleibt.
- Personen ohne „Konto“ zählen ganz normal mit.
- Auf Max' Gerät liegt M oben, auf Pauls Gerät P.

### 5.5 Optische Zentrierung in allen Plaketten – Pflicht, für jede Schrift

**Regel:** Alles, was in einer Plakette steht (Ziffern, × und +, Monogramm-Buchstabe, Symbol), sitzt **optisch** in der Mitte von Kreis bzw. Kapsel. Toleranz: **≤ 0,25 px** in beide Richtungen.

**Warum das nicht von selbst passiert:** Flexbox (`align-items/justify-content: center`) zentriert die *Textbox*, nicht die sichtbaren Zeichen. Die Textbox enthält Platz für Ober- und Unterlängen; Ziffern und Großbuchstaben nutzen nur Grundlinie bis Versalhöhe. Jede Schrift hat dabei andere Maße. Gemessen (Ziffern 8,5 px, Monogramm 11 px, 20-px-Kreis):

| Schrift | ohne Korrektur | mit Korrektur |
|---|---|---|
| Systemschrift (Inter als Stellvertreter für SF Pro) – Ziffern | 1,1 px zu hoch | 0,1 px |
| Gloock – Monogramm | 0,9 px zu tief | 0,1 px |
| Ersatzschrift Serif (Georgia-artig) – Monogramm | 0,6 px zu hoch | 0,4 px (ungenaue Schriftmetriken) |

**Umsetzung Web (so in der Referenz):**
```css
.v-badge__num, .v-badge__mono { display: block; text-box: trim-both cap alphabetic; }
.v-badge__sym { vertical-align: .12em; }   /* × und + auf die Ziffernmitte heben */
```
`text-box` schneidet die Textbox **aus den Maßen der jeweils verwendeten Schrift** auf Versalhöhe bis Grundlinie zu. Dadurch funktioniert dieselbe Regel für SF Pro und Gloock, ohne feste Pixel-Korrekturen (Safari/iOS 18.2+, Chrome 133+).

**Schriften festlegen, damit keine Ersatzschrift einspringt:**
- **Gloock als Datei mitliefern** (selbst gehostet bzw. im App-Bundle, nicht nur per Google-Fonts-Link) und vor dem ersten Rendern der Kacheln laden (`font-display: block` für Gloock oder `document.fonts.load('11px Gloock')` abwarten). Sonst erscheint kurz Georgia/Times, und die Monogramme sitzen schief.
- Ziffern in der Systemschrift (SF Pro auf Apple-Geräten). Andere Systemschriften (Roboto, Segoe UI) haben saubere Maße und funktionieren mit derselben Regel.
- Symbole (SVG) sind geometrisch im 24er-Raster zentriert und brauchen keine Korrektur.

**Umsetzung React Native / iOS (kein `text-box`):**
- `includeFontPadding: false` (Android), `lineHeight` = Schriftgröße, `textAlignVertical: 'center'`.
- Pro Schrift einen festen Versatz nachmessen und als Token ablegen, z. B. `badge-num-offset-y` (SF Pro) und `badge-mono-offset-y` (Gloock), angewendet als `transform: [{ translateY }]`. Ziel ≤ 0,25 px.
- Alternativ in nativem SwiftUI: Text mit `.alignmentGuide(VerticalAlignment.center) { d in d[.firstTextBaseline] - capHeight/2 }` auf die Versalhöhe zentrieren.

**Prüfen:** Plakette stark vergrößert (8- bis 10-fach) rendern, Bounding-Box der sichtbaren Pixel mit der Kreismitte vergleichen – für Ziffern **und** Monogramme, ein- und zweistellig, im Kreis und in der Kapsel.

## 6. Symbole (SVG, viewBox 0 0 24 24, fill none, stroke currentColor, linecap/linejoin round)

**Seit 15.11.2026 überholt:** Alle Formen kommen aus dem Symbol-Pool `packages/ui/src/symbols.ts` (Regeln: `docs/design/symbole/VALET_SYMBOLE.md`). Die Liste unten ist nur noch der Ursprungsstand.

```
Bügel:      <path d="M12 7.5a2.2 2.2 0 1 1 2.2-2.2"/><path d="M12 7.5v1.2L3.2 15.6a1 1 0 0 0 .6 1.8h16.4a1 1 0 0 0 .6-1.8L12 8.7"/>
Wäsche:     <path d="M4 10h16l-1.6 8.8a1.6 1.6 0 0 1-1.6 1.2H7.2a1.6 1.6 0 0 1-1.6-1.2z"/><path d="M8.5 10l3-6"/><path d="M15.5 10l-3-6"/>
Reparatur:  <circle cx="6.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/><path d="M8.3 15.8L18 4"/><path d="M15.7 15.8L6 4"/>
verliehen:  <path d="M6.5 17.5l11-11"/><path d="M9 6.5h8.5V15"/>
eingelagert:<path d="M4.5 9h15v10a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1z"/><path d="M3 4.5h18V9H3z"/><path d="M10 13h4"/>
verkauft:   <path d="M3.5 12V4.5a1 1 0 0 1 1-1H12l8.5 8.5-8.5 8.5z"/><circle cx="8" cy="8" r="1.4"/>
Wendbar:    <path d="M4.5 11a7.5 7.5 0 0 1 13-4.5L19.5 8.5"/><path d="M19.5 4v4.5H15"/><path d="M19.5 13a7.5 7.5 0 0 1-13 4.5L4.5 15.5"/><path d="M4.5 20v-4.5H9"/>
```
Strichstärke: seit 15.11.2026 überall 2 (vorher Status/Wendbar 2,2 bei 11 px, Bügel 2,4 bei 12 px).

## 7. Neue Tokens (für `tokens.ts` / Designsystem)

| Token | Wert | Zweck |
|---|---|---|
| `radius-tile` | 14px | Kachel |
| `inset-badge` | 4px | Abstand Plakette ↔ Rand |
| `size-badge` | 20px | Plakette rund |
| `radius-badge` | 10px | = radius-tile − inset-badge |
| `size-count-h` | 14px | Höhe Anzahl-Kapsel, nur unter Wendbar (Breite = size-badge) |
| `gap-badge-stack` | 3px | Wendbar ↔ Anzahl |
| `overlap-owner` | 3px | Überlappung der Besitzer-Plaketten (Monogramm und „+N“ gleich) |
| `font-badge-num` / `font-badge-sym` | 8.5px 700 / 6.5px 600 | Ziffern / × und + |
| `badge-glass` | rgba(255,255,255,0.62) | Plakettenfläche |
| `tile-edge` | rgba(42,26,29,0.09) | Kachelkante |
| `glow-blur` / `glow-spread` | 22px / 3px | Innenschein |
| `glow-alpha` | 0.6 | Innenschein (alle Farben, seit 16.11.2026) |
| `glow-fallback` | #d8d2c8 | Schein für Weiß bzw. ohne Farbe |
| `person-pink-text` / `person-red-text` | #a8325f / #b00e28 | Monogramm-Buchstaben |

Bestehende Tokens bleiben: `person-pink` #d9668e, `person-red` #c8102e, `ink` #2a1a1d, Gloock für Monogramme.

## 8. Umsetzung in React Native (iOS später)

- Innenschein: `boxShadow` mit `inset` gibt es in React Native ab 0.76 (neue Architektur). Alternativ eine radiale Verlaufsebene unter dem Foto.
- Milchglas: `expo-blur` (`BlurView`, intensity ≈ 10–15, tint light) plus halbtransparentes Weiß; unter iOS 26 optional `expo-glass-effect`.
- Konzentrische Ecken unter iOS 26 nativ: `ConcentricRectangle` / `.containerConcentric`. Sonst die Regel aus 4. rechnen.
- Fotos müssen einen transparenten Hintergrund haben (freigestellt), damit der Schein dahinter sichtbar ist. Die Referenz-HTML simuliert das mit `mix-blend-mode: multiply`. Das ist in der App **nicht** nötig.

## 9. Barrierefreiheit

- Jede Plakette hat ein `aria-label` / `accessibilityLabel` (Status, „Wendbar“, „2 Stück“, „heute: Paul“, Besitzername, „2 weitere“).
- Die Kachel ist ein Button (antippen → Teil öffnen, lang drücken → Kontextmenü). Ihr Label: Teilname plus die Plaketten-Infos in Worten.
- Plaketten selbst sind nicht antippbar (zu klein für 44-px-Ziele).

## 10. Offene Punkte (nicht entschieden, nicht erfinden)

1. **Sets**: Im alten Valet hatten Sets ein Bügel-Symbol unten links. Der Bügel bedeutet jetzt „heute“. Ob Sets ein eigenes Zeichen bekommen, ist offen.
2. **Eingelagert vs. aussortiert**: beide im Entwurf mit Kiste. Ob sie getrennte Symbole bekommen, ist offen.
3. **Wunschlisten-Kachel**: noch nicht auf die neue Kachel umgestellt (bisher Preis-Pille mit Text und Bedenkzeit-Ring). Offen.
4. **Farben für Person 3+**: Es gibt bisher nur Farben für Max und Paul.
5. ~~Highlight-Farbe~~ – entschieden 16.11.2026: Akzent aus den Steckbrief-Farben, siehe `VALET_SCHEIN_REGELN.md`.

## 11. Abnahme (so prüfst du dein Ergebnis)

1. `valet-kachel-referenz.html` im Browser öffnen und die eigene Kachel mit denselben Daten daneben rendern (gleiche Kachelbreite 114 px, gleiche Fälle wie in der Referenz: Mosaik, Besitzer-Regeln, Wendbar/Anzahl, Status/Bügel, Innenschein, Extremfälle).
2. Maße per DevTools nachmessen: Ecken 14, Plaketten 20, Abstand 4, Kapsel 20 × 14, Stapelabstand 3, Überlappung 3.
3. Zentrierung prüfen wie in 5.5 beschrieben: Ziffern (Systemschrift) **und** Monogramme (Gloock) liegen optisch in der Mitte (≤ 0,25 px), auch in der Kapsel und zweistellig; „12ד und „+12“ stoßen nirgends an. Gloock muss dabei wirklich geladen sein (keine Ersatzschrift).
4. Logik mit Tests absichern: `glowFor` (siehe `glow.test.ts`), `ownersFor` (alle Zeilen der Tabelle in 5.4, auch aus Pauls Sicht), Anzahl-Format (`2×`, `12×`, `99+`) und Kreis vs. Kapsel je nach Wendbar.
5. Offene Punkte aus 10. nicht selbst entscheiden, sondern nachfragen.
