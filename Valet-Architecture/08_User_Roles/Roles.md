---
id: ROLE-CATALOG-001
type: role_catalog
name: Rollen und Berechtigungen
status: implemented
---
# Benutzerrollen

## ROLE-001 owner
Schrankbesitzer. Darf Schrank-/Mitglieder-/Einladungsverwaltung administrieren. RLS-Prüfung: `is_member(wardrobe_id,'owner')`.

## ROLE-002 edit
Schreibzugriff auf Schrankdaten. RLS: `is_member(wardrobe_id,'edit')` akzeptiert edit und owner.

## ROLE-003 view
Lesezugriff. RLS: `is_member(wardrobe_id,'view')` akzeptiert alle Mitglieder.

Mitgliedschaft liegt in `wardrobe_members`; Einladungen in `wardrobe_invites`. Nicht aus UI-Bezeichnungen ableiten, ob jeder Sonderfall umgesetzt ist; SQL-Policies sind maßgeblich.
