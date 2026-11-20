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

## Nächster Schritt

Harte Regeln und Gerüst (Schritte 2–3) gemeinsam mit Max festlegen.
