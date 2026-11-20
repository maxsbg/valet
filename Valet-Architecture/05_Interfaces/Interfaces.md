---
id: API-CATALOG-001
type: interface_catalog
name: Schnittstellen
status: implemented
---
# Schnittstellen & Integrationen

## API-001 Supabase Postgres / Client
`@supabase/supabase-js`, Client in `apps/app/src/lib/supabase.ts`. App-Service-Module lesen/schreiben Tabellen und nutzen Auth.

## API-002 Supabase Storage
Bucket `items` (Migration 0002); Item-Bilder über `item_images.storage_path`. Policies in Storage-Migrationen prüfen.

## API-003 Supabase Auth
Session via getSession/onAuthStateChange; Login-/Invite-/Join-Flows. Auth-User ist Grundlage der Wardrobe-Mitgliedschaft.

## API-004 Edge Function ki
POST/OPTIONS. Request: imagePath oder Base64 image, prompt, JSON schema, optional text, temperature 0–1, model nur für erlaubte Eval-User. Gemini OpenAI-kompatibel bevorzugt; sonst KI_ENDPOINT/KI_API_KEY mit Mistral-Default. Limits für Prompt/Text/Schema/Bild und Timeout. App validiert Antwort zusätzlich. Secrets nie dokumentieren.

## API-005 Edge Function produkt
POST/OPTIONS. Request: URL, optional HTML, oder Bild-URL. Response: Seitentext, Produktfakten, Bilder. Blockt private Hosts/IPs, Credentials und unsichere Redirects; Größen-/Zeitlimits. Kein KI-Aufruf in dieser Function.

## API-006 Externe KI-Provider
Gemini / Mistral hinter API-004; OpenAI-kompatible Chat-Completions und JSON-Schema-Antworten.

## API-007 Externe Shop-Webseiten
Abruf über produkt; nicht garantiert stabil (Anti-Bot, Rate Limits, Markup-Änderungen).

## API-008 GitHub Actions / Pages
`.github/workflows/web.yml`; README dokumentiert Web-Deployment bei Push auf main.

## API-009 Expo / React Native Runtime
Expo Router, React Native und react-native-web. Web-Ausführung belegt; nativer iOS-Release nicht durch Repository-Sichtung bestätigt.
