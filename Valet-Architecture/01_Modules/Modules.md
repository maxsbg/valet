---
id: MOD-CATALOG-001
type: module_catalog
name: Module
status: implemented
---
# Module

## <a id="MOD-001"></a> MOD-001 – App-Shell & Navigation
**Status:** implemented. Root-Layout, Auth-Gate, SessionProvider, Invite-Erfassung, Tab-/Stack-Navigation, Theme und Safe-Area. Tabs: Schrank, Outfits, Wunschliste, Statistik. Routen: `/teil/[id]`, `/bearbeiten/[id]`, `/neu`, `/bilder-zuordnen`, `/outfit/[id]`, `/outfit-bauen`. Quellen: `apps/app/src/app/_layout.tsx`, `(tabs)/_layout.tsx`, `lib/session.tsx`.

## <a id="MOD-002"></a> MOD-002 – Kleiderschrank
**Status:** implemented. Schrank-Mosaik, Kategorie-/Filterleiste, Suche, Sortierung, Teil-Detail, Edit-Flow, Status, Personen-/Eigentümerzuordnung, Kostenanteile, Wendeteile und Sets. Quellen: `(tabs)/index.tsx`, `teil/[id].tsx`, `bearbeiten/[id].tsx`, `lib/wardrobe.ts`, `lib/sort.ts`, `components/edit/*`.

## <a id="MOD-003"></a> MOD-003 – Outfits & Planung
**Status:** implemented. Outfitübersicht, Anlassfilter, Outfit-Baukasten, Boardlayout, Detail, Wochenkalender, Planung, Reservierungen, Trageprotokoll. Quellen: `(tabs)/outfits.tsx`, `outfit-bauen.tsx`, `outfit/[id].tsx`, `lib/outfits.ts`, `packages/core/src/board.ts`.

## <a id="MOD-004"></a> MOD-004 – Wunschliste
**Status:** implemented. Listen anlegen/umbenennen/löschen, Sortierung, Filter, Tags, Wunschitem-Detail, Preisprüfung. Quellen: `(tabs)/wunschliste.tsx`, `lib/wishlists.ts`, `lib/priceCheck.ts`.

## <a id="MOD-005"></a> MOD-005 – Statistik
**Status:** implemented. Tabs Ausgaben, Getragen/Cost-per-wear, Bestand; Person-/Zeitraumfilter und Profil-Batch-Tool. Quellen: `(tabs)/statistik.tsx`, `packages/core/src/stats.ts`, `lib/profileBatch.ts`.

## <a id="MOD-006"></a> MOD-006 – Erfassung & KI-Analyse
**Status:** implemented. Neuerfassungs-Wizard, Foto, Freistellung, weitere Infos (Link/Screenshot/Etikett), Produktseitenabruf, KI-Bildanalyse, Quellenmerge, Formular, Speichern; Stapelprofilanalyse. Quellen: `neu.tsx`, `lib/ki.ts`, `packages/core/src/ai/*`.

## <a id="MOD-007"></a> MOD-007 – Identität & Zusammenarbeit
**Status:** implemented. Supabase Auth, Schrankmitgliedschaft, Einladungen, Personen, Rollen owner/edit/view. Quellen: `Login.tsx`, `Join.tsx`, `Invite.tsx`, Migration 0001.

## <a id="MOD-008"></a> MOD-008 – Bildverarbeitung
**Status:** partial. Bildauswahl, lokale Freistelllogik/Modelle, Nachbearbeitung, Storage und Wendeseitenbilder. Vollständige Parität zur historischen Artifact-App nicht belegt. Quellen: `lib/cutout.ts`, `components/edit/EditImage.tsx`, `public/freistellen/*`.
