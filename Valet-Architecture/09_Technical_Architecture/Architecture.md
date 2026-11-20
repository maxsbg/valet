---
id: TECH-001
type: technical_architecture
name: Technische Architektur
status: implemented
---
# Technische Architektur
- pnpm 9.15 Monorepo: apps/app, packages/core, packages/ui.
- Expo 58 / Expo Router / React 19 / React Native 0.88 / react-native-web.
- Core exportiert Katalog, Modell, Keys, Money, Items, Wear, Import, Board, Stats, Tile, Occasions, Categories, FitName, Attributes, Layout, Status, Fields, Edit, Detail, Wish und AI-Module.
- UI enthält Designsystem, Symbole, Tokens.
- Supabase Postgres + Auth + Storage + Edge Functions; SQL-Migrationen und RLS.
- Edge Function ki: Providerproxy für Gemini/Mistral mit JSON Schema.
- Edge Function produkt: SSRF-begrenzter Abruf öffentlicher Produktseiten.
- Tests: Node Test Runner über tsx; Scripts pnpm test/typecheck/build:web.
- Web-CI/CD: GitHub Actions und Pages.

## Architekturgrenzen
UI orchestriert; Fachlogik gehört in packages/core; Datenzugriff in apps/app/src/lib; provider secrets nur als Supabase Secrets; DB-Änderungen als neue Migration; RLS bei jeder neuen Tabelle/Beziehung prüfen.

## Risiken / offene Verifikation
Storage-Policies und alle Folge-Migrationen konsolidieren; iOS-Build/Signing/Release nicht belegt; native File-/Share-/Cutout-Pfade separat testen; Fehlerbehandlung des Hintergrund-Preischecks ist teilweise still; großes lokales Freistellmodell auf Bundle-/Ladezeit prüfen.
