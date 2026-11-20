---
id: DEV-001
type: development_status
name: Status und offene Punkte
status: partial
---
# Status und offene Punkte

## Implementiert (Codebeleg)
Web-App Tabs: Schrank, Outfits, Wunschliste, Statistik; Teil-Detail/Bearbeiten; Neu-Erfassung; Bildzuordnung; Outfit-Baukasten/Detail; Supabase-Schema; Auth/RLS; KI- und Produkt-Edge-Functions; Core-Fachlogik und Tests.

## Partial / noch zu verifizieren
- Freistellungsparität und native iOS-Bildpfade.
- Export/Share plattformübergreifend.
- Reservierungskonflikte und alle Sonderfälle.
- Vollständigkeit aller Formularfelder gegen ItemEditor und Core fields.
- Storage-Policies und vollständige Folge-Migrationen.

## Geplant / nicht als implementiert belegt
Wetterautomatik, Packliste, Homescreen-Widget, Offline/PWA, Kalender-Sync, iOS-Store-Veröffentlichung. Gmail-/Shop-Login-Import laut Entwicklungsplan bewusst nicht übernommen.

## Prüfplan
1. Jede Migration bis zur aktuellen Version konsolidieren.
2. UI-Formularfelder mit DB-Spalten und KI-Feldern abgleichen.
3. RLS/Storage/Edge-Function-Auth in Supabase-Projekt prüfen.
4. iPhone Safari und native iOS-Pfade interaktiv testen.
5. Historische Artifact-Abnahme-Checkliste Punkt für Punkt mit aktueller App abgleichen.
