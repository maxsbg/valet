# Arbeitsanweisung: Englische Keys statt deutscher Namen

Für die KI, die den Umbau macht. Antworte und committe auf **Deutsch** (siehe `CLAUDE.md`).

## Ziel
Leitsatz von Max (19.11.2026): **Code, Datenbank und KI-Schemas verwenden englische Keys, Deutsch erscheint nur als Label in der Oberfläche.**
Heute speichert die App deutsche Namen (z. B. `items.category = 'Oberteil'`, `colors = ['Marineblau']`). Nach dem Umbau speichert sie Keys (`'top'`, `['navy']`) und zeigt überall die deutschen Labels.

## Verbindliche Quelle
`docs/keys/key-zuordnung.json` – jede Liste mit `{ key, label }`, Kategorien als Baum (Kategorie → Unterkategorie → Typ; `other` = „Sonstiges“, eindeutig innerhalb der Elternebene).
Keys und Labels **nicht ändern** und keine erfinden. Fehlt etwas, im PR melden.

Betroffene Listen: Kategorien/Unterkategorien/Typen, Farben (mit Nuancen), Material, Muster, Stil, Saison, Kragen/Ausschnitt (`collars` = COLLARS + NECKLINES + OUTER_COLLARS), Verschluss, Trägerart, Anlässe.
**Nicht** betroffen: Status, `wish_tag`, Pflege-IDs, Größen-Systeme (schon Keys), `persons.color`, die alten Freitext-Spiegel `items.color` / `material` / `style` (schreiben weiter das deutsche Label von Rang 1 wie bisher).

## Was zu tun ist
1. **Listen umbauen** in `packages/core/src/categories.ts`, `attributes.ts`, `fields.ts`, `occasions.ts`: jeder Eintrag bekommt `key` + `label`. Inhalte exakt aus der JSON. Je Liste eine Hilfe `labelOf…(key)` bzw. eine gemeinsame `label(list, key)`. Bestehende Funktionsnamen möglichst behalten, damit der Umbau überschaubar bleibt.
2. **Gespeichert und verglichen werden nur Keys**: Formular (`edit.ts`), Filter/Sortierung (`apps/app/src/lib/sort.ts`), Mosaik/Board (`layout.ts`, `board.ts`), Schein (`glow.ts`: `GLOW_COLOR_RANK`, `GLOW_NEUTRAL_RANK`), Symbole (`CATEGORY_ICON`, `SEASON_ICON` in `packages/ui/src/symbols.ts` u. a.), Statistik (`stats.ts`, Saisons), Felder je Kategorie (`fieldsFor`, `fitScalesOf`, `pantsWaistOnly` …), Wunschliste, Outfits (Anlässe), Import (`import/categorize.ts`, `import/legacy.ts` erzeugen Keys).
3. **Oberfläche zeigt nur Labels**: überall, wo heute ein gespeicherter Wert als Text erscheint (Kapseln, Chips, Suche, Export-Texte, Steckbrief, Bearbeiten). Die Suche findet weiter über das deutsche Label.
4. **Lesen ist tolerant** (wichtig für die Reihenfolge unten): eine Funktion `toKey(list, value)` in core nimmt einen Key **oder** ein deutsches Label **oder** einen Altwert (die vorhandenen `LEGACY_*`-Tabellen, alte Kategorie-IDs über `normalizeCategory`) und liefert den Key. Sie wird beim Laden angewendet (`toEditForm`, Laden der Teile in der App, Laden der Outfits/Anlässe). So läuft die neue App mit alten **und** umgestellten Daten.
5. **KI-Schemas** (`packages/core/src/ai/analyzeItem.ts`, `readInfo.ts`, `profile.ts`):
   - Feldnamen englisch: `kategorie` → `category`, `farben` → `colors`, `muster` → `pattern`, `material` → `materials`, `stil` → `styles`, `saison` → `seasons`, `kragen` → `collar`, `verschluss` → `closure`, `traeger` → `strap`, `weite` → `width`, `laenge` → `length`, `bund` → `rise`, `lagen` → `layers`, `waerme` → `warmth`, `regen` → `rain`, `profil` → `profile`, `konfidenz` → `confidence`.
   - Enum-Werte = Keys. Kategorie-Pfad als `top/shirt/long_sleeve_shirt` (Trennzeichen `/`).
   - Die Beschreibung jeder Liste nennt die deutschen Labels (`navy = Marineblau, …`), damit die KI deutsche Shoptexte zuordnen kann. Gesamtgröße des Schemas < 60 000 Zeichen (Test vorhanden).
   - `profile.ts`: Die Bedingungen (`applies`) vergleichen heute deutsche Kategorienamen (`'Schuh'`, `'Gürtel'`, Muster `'Unifarben'`, Material `'Denim'`) → auf Keys umstellen.
6. **Tests**: bestehende Tests auf Keys umstellen. Neu: ein Test, der jede Liste im Code gegen `docs/keys/key-zuordnung.json` prüft (gleiche Keys, Labels, Reihenfolge), und ein Test für `toKey` (Key, Label, Altwert, Unbekanntes → `null`).
7. **Abnahme-Suche**: Nach dem Umbau dürfen deutsche Listenwerte nur noch in den Label-Tabellen und in `LEGACY_*`/Import-Regeln stehen. Prüfen z. B. mit
   `grep -rn "'Oberteil'\|'Unifarben'\|'Marineblau'\|'Winter'\|'Baumwolle'\|'Alltag'" apps/app/src packages --include=*.ts --include=*.tsx`
   und die Treffer im PR auflisten und begründen.

## Was NICHT zu tun ist
- Die Migration `supabase/migrations/0014_englische_keys.sql` **nicht** anwenden und nicht ändern (sie wird aus der JSON erzeugt: `python3 docs/keys/sql-erzeugen.py`). Das Anwenden übernimmt Claude nach dem Merge.
- Keine anderen Migrationen, keine Secrets, keine Änderungen am Schrank „Max & Paul“.
- Kein Umgestalten der Oberfläche; sichtbare Texte bleiben genau gleich.

## Reihenfolge der Auslieferung
1. PR (Zweig `englische-keys`) gegen `main`, `pnpm test`, `pnpm typecheck` und `pnpm --filter @valet/app build:web` grün.
2. Max merged → die App wird ausgeliefert (liest alte und neue Werte, schreibt Keys).
3. Claude wendet `0014_englische_keys.sql` an (mit Sicherung `items_keys_backup_0014`) und prüft danach, ob in den betroffenen Spalten nur noch Keys stehen.
4. In `CLAUDE.md` den Leitsatz und den Stand der Migration eintragen.

## Hinweise
- Max testet am iPhone (Safari). Deutsch in allen Texten und Commit-Nachrichten.
- Vor großen Entscheidungen, die hier nicht geregelt sind, im PR fragen statt raten.
