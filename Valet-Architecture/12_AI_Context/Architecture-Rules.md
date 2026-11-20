---
id: AI-002
type: ai_architecture_rules
name: Architecture Rules
status: implemented
---
# Architecture Rules
1. Core ist Single Source of Truth für Domänenlogik.
2. Screens orchestrieren; Regeln nicht in UI duplizieren.
3. Supabase-Zugriff über Service-Module in apps/app/src/lib.
4. Wardrobe-Tenant-Isolation für jede neue Ressource.
5. RLS ist Security Boundary; UI ist keine Berechtigungsdurchsetzung.
6. Migrationen append-only; Rückwärtskompatibilität und Datenmigration berücksichtigen.
7. IDs nie wiederverwenden oder umdeuten.
8. Jede Behauptung braucht Code-/Migrations-/Test-Evidenz.
9. Status streng trennen: implemented/partial/planned/historical/unknown.
10. Keine echten Nutzerdaten, Tokens oder Secrets im Vault.
11. Canvas-Edges müssen REL-IDs und Beziehungstypen spiegeln.
12. Nicht belegte Integrationen nicht als implementiert dokumentieren.
