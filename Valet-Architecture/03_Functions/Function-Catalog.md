---
id: FUN-CATALOG-001
type: function_catalog
name: Funktionskatalog
status: implemented
---
# Funktionskatalog
Die Funktions-IDs sind stabil. `partial` bedeutet, dass Code existiert, aber nicht alle Plattform-/Randfälle geprüft sind.

| ID | Funktion | Modul | Status | Trigger / Input → Output | Kernlogik / Quelle |
|---|---|---|---|---|---|
| FUN-001 | Session initialisieren | MOD-001 | implemented | App-Start → Session/ready | getSession + onAuthStateChange; `lib/session.tsx` |
| FUN-002 | Auth-Gate | MOD-001 | implemented | Root render → Login oder App | `app/_layout.tsx` |
| FUN-003 | Einladung erfassen | MOD-001 | implemented | Invite-URL → Token | `lib/invite.ts`, captureInvite |
| FUN-004 | Tab-/Routen-Navigation | MOD-001 | implemented | Navigation → Screen | Expo Router, TabLayout |
| FUN-005 | Web-/Native-Routenpräsentation | MOD-001 | implemented | Plattform → Slot/Stack | `app/_layout.tsx` |
| FUN-010 | Schrank laden/darstellen | MOD-002 | implemented | Session/Wardrobe → Items/Personen/Tiles | `lib/wardrobe.ts`, index.tsx |
| FUN-011 | Suche, Filter, Sortierung | MOD-002 | implemented | Query/Filter → Itemliste | `lib/sort.ts`, index.tsx |
| FUN-012 | Teil-Detail anzeigen | MOD-002 | implemented | Item-ID → Detaildaten | `teil/[id].tsx`, components/detail |
| FUN-013 | Teil bearbeiten | MOD-002 | implemented | EditForm → Item-Update | ItemEditor, core/edit.ts |
| FUN-014 | Teilstatus verwalten | MOD-002 | implemented | Statusaktion → Status/Datum | StatusMenu/Sheet, core/status.ts |
| FUN-015 | Wendeteil-/Set-Handling | MOD-002 | partial | Seite/Set → Bildseite/Set-Zuordnung | model.ts, ItemEditor, DB |
| FUN-016 | Eigentümer/Kostenanteile | MOD-002 | implemented | Person/Payer → Zuordnung | model.ts, wardrobe.ts |
| FUN-020 | Outfits laden | MOD-003 | implemented | Wardrobe-ID → Outfits/Wears/Holds | `lib/outfits.ts` |
| FUN-021 | Outfit zusammenstellen | MOD-003 | implemented | Item-IDs/Anlass → Outfit | outfit-bauen.tsx |
| FUN-022 | Boardlayout berechnen | MOD-003 | implemented | Kategorie/Material → x/y/w/h/z | `core/board.ts` |
| FUN-023 | Outfit planen/entplanen | MOD-003 | implemented | Outfit/Datum/Person → Plan | outfits.ts, WeekCalendar |
| FUN-024 | Reservierung/Konfliktprüfung | MOD-003 | partial | Item/Zeitraum/Person → Hold/Clash | outfits.ts |
| FUN-025 | Getragen erfassen | MOD-003 | implemented | Item/Datum/Person → wears | outfits.ts, Session.setToday |
| FUN-026 | Outfit teilen/exportieren | MOD-003 | partial | Outfit → Bild/Share | ExportSheet, lib/share.ts |
| FUN-030 | Wunschlisten verwalten | MOD-004 | implemented | Create/Rename/Delete → Wishlist | `lib/wishlists.ts` |
| FUN-031 | Wunschitems filtern/sortieren | MOD-004 | implemented | Person/Tag/Query/Sort → Tiles | wishlists.ts |
| FUN-032 | Wunschpreise aktualisieren | MOD-004 | implemented | App-Start + Link → Preisupdate | `lib/priceCheck.ts`; 6h, parallel 2 |
| FUN-033 | Produktseite lesen | MOD-004/006 | implemented | URL/HTML/Bild → Fakten/Text/Bilder | Edge Function produkt |
| FUN-040 | Ausgabenstatistik | MOD-005 | implemented | Preis/Payer/Datum → Kennzahlen | core/stats.ts |
| FUN-041 | Trage-/CPW-Statistik | MOD-005 | implemented | Wear + Kosten → CPW/Ranglisten | core/stats.ts |
| FUN-042 | Bestandsstatistik | MOD-005 | implemented | Bestand/Status → Kennzahlen | core/stats.ts |
| FUN-043 | Profile-Batch ergänzen | MOD-005/006 | implemented | unvollständige Profile → Batch-Updates | profileBatch.ts, core/ai/view.ts |
| FUN-050 | Neues Teil erfassen | MOD-006 | implemented | Foto + Zusatzinfos + Form → Item/Bild | neu.tsx |
| FUN-051 | Produktseite auslesen | MOD-006 | implemented | öffentliche URL/HTML → strukturierte Fakten | functions/produkt |
| FUN-052 | KI-Bildanalyse | MOD-006 | implemented | Bild/Prompt/Schema → Analyse | core/ai/analyzeItem.ts, lib/ki.ts |
| FUN-053 | KI-Quellen zusammenführen | MOD-006 | implemented | Bild/Etikett/Shop/Name → EditForm | core/ai/merge.ts |
| FUN-054 | KI-Antwort validieren | MOD-006 | implemented | Modellantwort → typed result/error | checkAnalysis/checkInfo |
| FUN-055 | Profil-Batch ausführen | MOD-006 | implemented | Itemqueue → Profile/Progress | lib/profileBatch.ts |
| FUN-060 | Rollen-/Mitgliedschaft prüfen | MOD-007 | implemented | auth.uid + wardrobe + role → allow/deny | SQL is_member + RLS |
| FUN-070 | Bild auswählen/vorbereiten | MOD-008 | implemented | Datei/Foto → Picture/Blob | PhotoPicker, cutout.ts |
| FUN-071 | Bild freistellen | MOD-008 | partial | Bild/Modell → transparenter Blob | cutout.ts, public/freistellen |
| FUN-072 | Freistellung nachbearbeiten | MOD-008 | partial | Maske/Pinsel → korrigiertes Bild | EditImage.tsx |
| FUN-073 | Bild speichern/laden | MOD-008 | implemented | Item/Bild → Storage-Pfad/URL | item.ts, item_images |

## Nicht als implementiert gewertet
Wetterautomatik, Packliste, Homescreen-Widget, Offline/PWA und Kalender-Synchronisation sind Plan-/Zukunftsthemen, soweit hier kein ausführbarer Pfad nachgewiesen wurde. Historische Artifact-Funktionen sind nicht automatisch migriert.
