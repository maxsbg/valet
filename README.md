# Valet

Kleiderschrank-App für Max und Paul: Teile mit Bild und Preis erfassen, Outfits zusammenstellen, planen, tragen, auswerten.
Zuerst als Web-App, später als iOS-App aus derselben Codebasis (Expo / React Native).

## Aufbau

```
packages/core/      Fachlogik ohne Oberfläche (Preise, Getragen, Wendeteile, Import aus dem alten Valet) – mit Tests
packages/ui/        Designsystem (folgt in Phase 2)
packages/services/  Plattform-Schnittstellen: Daten, Bilder, Freistellen, KI, Wetter … (folgt)
apps/valet/         Expo-App für Web und iOS (folgt in Phase 3)
supabase/           Datenbank-Schema, Zugriffsregeln, Import-Zuordnung
docs/               Recherche, Entwicklungsplan, Abnahme-Checkliste
```

## Stand

- Phase 0: Daten des alten Valet gesichert und geprüft (172 Einträge). Bilder: noch offen.
- Phase 1: Supabase-Schema eingespielt, Kernlogik und Import-Umwandlung mit Tests.

## Befehle

```
pnpm install
pnpm test
pnpm typecheck
```

Die Tests laufen derzeit mit dem in Node eingebauten Test-Runner über `tsx` (ohne Zusatzpakete).
Sobald Pakete installiert werden können, wird auf Vitest umgestellt.

## Kosten

Nur kostenlose Stufen (Supabase Free, Cloudflare Pages, Gemini Free, EAS Free). Keine Kreditkarte hinterlegen.
Details: `docs/entwicklungsplan.md`, Abschnitt 9.
