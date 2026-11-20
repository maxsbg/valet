---
id: APP-001
type: application
name: Valet
status: implemented
source_branch: main
source_commit: 2b14a6697336ccf81f3156d2abd3254de023ceb6
---
# Valet – Architekturübersicht
Valet ist eine digitale Kleiderschrank-App: Kleidungsstücke mit Bild und Preis erfassen, Outfits zusammenstellen, planen, tragen und auswerten. Ziel ist eine gemeinsame Expo-Codebasis für Web und iOS.

## Technischer Aufbau
- TypeScript-/pnpm-Monorepo
- `apps/app`: Expo 58, Expo Router, React 19, React Native 0.88, react-native-web
- `packages/core`: Domänenmodell, Fachlogik, Validierung, KI-Schemas
- `packages/ui`: Designsystem, Symbole und UI-Tokens
- `supabase`: Postgres, Auth, Storage, RLS, Edge Functions
- KI-Proxy: Edge Function `ki`; Produktseitenimport: Edge Function `produkt`
- Web-Deployment: GitHub Actions / GitHub Pages

## Module
- [[../01_Modules/Modules#MOD-001|App-Shell & Navigation]]
- [[../01_Modules/Modules#MOD-002|Kleiderschrank]]
- [[../01_Modules/Modules#MOD-003|Outfits & Planung]]
- [[../01_Modules/Modules#MOD-004|Wunschliste]]
- [[../01_Modules/Modules#MOD-005|Statistik]]
- [[../01_Modules/Modules#MOD-006|Erfassung & KI]]
- [[../01_Modules/Modules#MOD-007|Identität & Zusammenarbeit]]
- [[../01_Modules/Modules#MOD-008|Bildverarbeitung]]

## Statusmodell
`implemented` = Code/Migration vorhanden; `partial` = Teilpfad belegt, Vollständigkeit nicht bestätigt; `planned` = Dokumentation/Plan ohne implementierten Pfad; `historical` = Alt-App; `unknown` = nicht ermittelbar.

## Grenzen
Momentaufnahme von main am 20.11.2026. UI-Routen und Komponenten wurden statisch analysiert; keine angemeldete Live-UI-Session. Produktiv-Secrets und produktiver Datenbankzustand waren nicht einsehbar. Der Nutzerauftrag endet mitten in Abschnitt „8. Claude“.
