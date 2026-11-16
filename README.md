# Valet

Kleiderschrank-App für Max und Paul: Teile mit Bild und Preis erfassen, Outfits zusammenstellen, planen, tragen, auswerten.
Zuerst als Web-App, später als iOS-App aus derselben Codebasis (Expo / React Native).

## Aufbau

```
packages/core/      Fachlogik ohne Oberfläche (Preise, Getragen, Kategorien, Status, Import aus dem alten Valet) – mit Tests
packages/ui/        Designsystem: Farben, Personen, Kacheln, Symbole
apps/app/           Expo-App (Expo Router, react-native-web) für Web und später iOS
supabase/           Datenbank-Schema (migrations/), Zugriffsregeln, Import-Zuordnung
docs/               Recherche, Entwicklungsplan, Design-Specs, Prüfberichte
```

## Stand

- Web-App läuft: Schrank, Outfits (Kalender, Baukasten), Wunschliste, Statistik, Teil-Detail und Bearbeiten, Freistellen im Browser.
- Live: https://maxsbg.github.io/valet/ – wird bei jedem Push auf `main` gebaut (`.github/workflows/web.yml`).
- Bekannte Fehler stehen als GitHub-Issues mit Label `bekannter-fehler`.

## Befehle

```
pnpm install
pnpm test
pnpm typecheck
pnpm --filter @valet/app build:web
```

Die Tests laufen mit dem in Node eingebauten Test-Runner über `tsx`.

## Kosten

Nur kostenlose Stufen (Supabase Free, GitHub Pages, Gemini Free, EAS Free). Keine Kreditkarte hinterlegen.
Details: `docs/entwicklungsplan.md`, Abschnitt 9.
