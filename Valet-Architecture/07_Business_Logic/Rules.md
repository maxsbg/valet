---
id: BIZ-001
type: business_logic
name: Geschäftsregeln
status: implemented
---
# Geschäftslogik

- Wardrobe ist Mandantengrenze; Item mit owner_id null ist gemeinsames Teil.
- Rollen owner/edit/view; RLS ist Sicherheitsdurchsetzung, UI-Checks sind keine Security Boundary.
- Wunschitems sind Items mit is_wish=true und wishlist_id. Listenlöschung löscht zuerst enthaltene Wunschitems.
- Wunschsortierung: random, eigene Reihenfolge, zuletzt hinzugefügt, Preis hoch/runter, A–Z.
- Preisprüfung: nur Items mit Link, frühestens alle 6 Stunden, maximal 2 parallele Requests.
- Outfit-Board: Seitenverhältnis 4:5; x/y normiert, z für Layer; Layout berücksichtigt Kategorie, Körperzone, Layer und Cap-Sonderfall.
- Tagesübersicht berücksichtigt geplante Outfits, Wear-Logs und aktive Holds.
- KI-Quellenrangfolge: bestätigte Nutzerwerte > Etikett > Shop/Screenshot > vertrauenswürdiger Name > Bildschätzung. Profil nur aus Bildanalyse.
- Etikett darf nur definierte Fakten (Marke, Material, Größe, Pflege, Artikelnummer) liefern.
- Englische Keys in Code/DB/KI-Schema; deutsche Labels nur in UI. `docs/keys/key-zuordnung.json` ist Quelle der Wahrheit.
- Keine Wetterautomatik/Kalendersynchronisierung als implementiert behaupten, solange kein Codepfad belegt ist.
