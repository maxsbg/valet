---
id: REL-CATALOG-001
type: relationship_catalog
name: Beziehungsregister
status: implemented
---
# Beziehungsregister
Standardtypen: BELONGS_TO, USES, DEPENDS_ON, READS_FROM, WRITES_TO, CALLS, TRIGGERS, PROVIDES_DATA_TO, IMPLEMENTS, EXTENDS, AUTHORIZES.

| ID | Von | Typ | Nach | Beschreibung |
|---|---|---|---|---|
| REL-001 | MOD-002 | BELONGS_TO | MOD-001 | Schrank ist Tab in App-Shell |
| REL-002 | MOD-003 | BELONGS_TO | MOD-001 | Outfits ist Tab |
| REL-003 | MOD-004 | BELONGS_TO | MOD-001 | Wunschliste ist Tab |
| REL-004 | MOD-005 | BELONGS_TO | MOD-001 | Statistik ist Tab |
| REL-005 | MOD-002 | USES | DAT-004 | Kleiderschrank verwaltet Items |
| REL-006 | MOD-003 | USES | DAT-006 | Outfitdaten |
| REL-007 | MOD-003 | USES | DAT-007 | Outfit-Item-Verknüpfungen/Layout |
| REL-008 | MOD-003 | USES | DAT-008 | Kalenderplanung |
| REL-009 | MOD-003 | USES | DAT-009 | Reservierungen |
| REL-010 | MOD-003 | USES | DAT-010 | Trageprotokolle |
| REL-011 | MOD-004 | USES | DAT-003 | Wunschlisten |
| REL-012 | MOD-004 | USES | DAT-004 | Wunschitems sind Items |
| REL-013 | MOD-005 | READS_FROM | DAT-004 | Bestands-/Kostendaten |
| REL-014 | MOD-005 | READS_FROM | DAT-010 | Tragehäufigkeit/CPW |
| REL-015 | MOD-006 | CALLS | API-004 | KI-Analyse |
| REL-016 | MOD-006 | CALLS | API-005 | Produktseiteninfos |
| REL-017 | MOD-006 | WRITES_TO | DAT-004 | Item + analysis |
| REL-018 | MOD-008 | WRITES_TO | DAT-005 | Bildmetadaten |
| REL-019 | MOD-008 | USES | API-002 | Bildspeicherung |
| REL-020 | MOD-007 | AUTHORIZES | MOD-002 | RLS begrenzt Schrankzugriff |
| REL-021 | MOD-007 | AUTHORIZES | MOD-003 | RLS begrenzt Outfits |
| REL-022 | MOD-007 | AUTHORIZES | MOD-004 | RLS begrenzt Wunschdaten |
| REL-023 | MOD-001 | USES | API-003 | Session/Auth |
| REL-024 | MOD-006 | DEPENDS_ON | MOD-008 | Bildaufbereitung im Aufnahmefluss |
| REL-025 | MOD-003 | DEPENDS_ON | MOD-002 | Outfits referenzieren Items |
| REL-026 | API-004 | CALLS | API-006 | KI-Provider |
| REL-027 | API-005 | CALLS | API-007 | Shopseitenabruf |
| REL-028 | MOD-005 | TRIGGERS | MOD-006 | Profil-Batch |
| REL-029 | DAT-004 | BELONGS_TO | DAT-001 | Item gehört zu Wardrobe |
| REL-030 | DAT-005 | BELONGS_TO | DAT-004 | ItemImage gehört zu Item |
| REL-031 | DAT-006 | BELONGS_TO | DAT-001 | Outfit gehört zu Wardrobe |
| REL-032 | DAT-007 | USES | DAT-006 | Join-Tabelle referenziert Outfit |
| REL-033 | DAT-007 | USES | DAT-004 | Join-Tabelle referenziert Item |
| REL-034 | DAT-008 | BELONGS_TO | DAT-006 | Plan gehört zu Outfit |
| REL-035 | DAT-009 | USES | DAT-004 | Reservation reserviert Item |
| REL-036 | DAT-010 | USES | DAT-004 | Wear protokolliert Item |
| REL-037 | API-001 | USES | API-003 | Supabase Client nutzt Auth |
| REL-038 | MOD-004 | TRIGGERS | API-005 | Preisprüfung/Produktimport |
| REL-039 | MOD-004 | WRITES_TO | DAT-004 | Preisupdate am Wunschitem |
| REL-040 | MOD-003 | USES | MOD-008 | Outfit-Board zeigt Itembilder |

Beziehungen sind aus Importen, SQL-FKs/RLS, Supabase-Queries und dokumentierten Aufrufen abgeleitet. Nicht belegte indirekte Laufzeitbeziehungen bleiben offen.
