# Freistell-Server

BiRefNet General-dynamic (MIT-Lizenz, ZhengPeng7/BiRefNet_dynamic) als kleiner Webdienst, läuft in Azure Container Apps (Prozessor, 4 Kerne, 8 GB, schaltet sich bei Nichtnutzung ab).

- `POST /freistellen`: Bild im Body, `Authorization: Bearer <Supabase-Sitzung>` → PNG mit Transparenz, eng zugeschnitten, Farbsaum an den Kanten entfernt
- `GET /health`: weckt den Server auf

Längste Seite beim Rechnen: `MAX_SIDE` (Standard 768). Eingespielt wird automatisch über `.github/workflows/freistellen.yml`.
