---
id: AI-001
type: ai_context
name: Claude Code Context
status: implemented
---
# Claude Code – Valet
Vor Änderungen zuerst [[../00_Overview/Valet|Überblick]], [[../09_Technical_Architecture/Architecture|Architektur]], [[../04_Data_Models/Data-Model|Datenmodell]], [[../06_Relationships/Relationship-Register|Beziehungen]] und den betroffenen Modul-/Funktionsabschnitt lesen.

- Domänenlogik in packages/core; UI in apps/app; Backendzugriff in apps/app/src/lib; Designsystem in packages/ui.
- Englische Keys in Code, DB und KI-Schemas; deutsche Labels nur in UI. Keine Keys erfinden; key-zuordnung.json beachten.
- DB-Änderungen als neue Migration; RLS und Storage Policies prüfen.
- Secrets niemals in Code, Markdown, Logs oder Commits.
- Fehler nicht still verschlucken; verständliche Meldung plus sichere Diagnose.
- Tests: pnpm test, pnpm typecheck, pnpm --filter @valet/app build:web.
- Jede neue Funktion/Entität/Beziehung im Vault mit ID, Status, Evidenz und Canvas-Update dokumentieren.
- Keine Funktion als implementiert markieren, wenn nur Design-Spec/Entwicklungsplan existiert.
