import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { encodeBase64 } from "jsr:@std/encoding@1.0.5/base64";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Anbieter über Secrets wählbar (OpenAI-kompatible Schnittstelle): KI_ENDPOINT, KI_MODEL, KI_API_KEY.
// GEMINI_API_KEY gesetzt → Gemini über dessen OpenAI-Schnittstelle (hat Vorrang), sonst KI_API_KEY mit Mistral.
const GEMINI = { endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", model: "gemini-3.5-flash-lite" };
/** Ersatzmodelle, wenn das gewählte überlastet ist oder hängt */
const GEMINI_FALLBACK = ["gemini-3.8-flash", "gemini-flash-lite-latest"];
/** Je Modell höchstens so lange warten, insgesamt höchstens TOTAL_MS (Supabase bricht nach 150 s ab) */
const CALL_MS = 20_000;
const TOTAL_MS = 50_000;
const MISTRAL = { endpoint: "https://api.mistral.ai/v1/chat/completions", model: "mistral-small-latest" };
const DEFAULT_STORAGE_BUCKET = "items";

// Allgemeiner KI-Durchreicher (Valet): Bild + Prompt + JSON-Schema → OpenAI-kompatibler Anbieter → JSON.
// Prompt, Schema und Prüfung der Antwort liegen in packages/core (z. B. core/src/ai/analyzeItem.ts),
// damit sie mit denselben festen Listen arbeiten wie die App. Die App prüft die Antwort selbst.

// deno-lint-ignore no-explicit-any
type JsonSchema = Record<string, any>;

interface RequestPayload {
  /** Bild im Storage (bei bestehenden Teilen) … */
  imagePath?: string;
  /** … oder direkt mitgeschickt (neues Teil, noch nicht hochgeladen), Base64 ohne data:-Präfix */
  image?: { data?: string; mimeType?: string };
  /** Optional zweites Bild = Rückseite desselben Teils (Backprint), aus dem Storage oder mitgeschickt */
  backPath?: string;
  backImage?: { data?: string; mimeType?: string };
  prompt?: string;
  schema?: JsonSchema;
  /** Nur Text, ohne Bild (z. B. ausgelesene Produktseite) – wird hinter den Prompt gehängt */
  text?: string;
  /** 0–1, Standard 0,2 (Teil-Analyse schickt 0) */
  temperature?: number;
  /** Erzwingt ein Modell ohne Ersatz – nur für Nutzer-IDs aus dem Secret KI_EVAL_USERS (Eval), sonst ignoriert */
  model?: string;
}

const DEFAULT_TEMPERATURE = 0.2;
/** Gültige Temperatur 0–1, sonst Standard */
function temperatureOf(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1 ? v : DEFAULT_TEMPERATURE;
}
/** Nutzer-IDs aus KI_EVAL_USERS (durch Komma, Leerzeichen oder Zeilenumbruch getrennt) */
function evalUsers(): string[] {
  return (Deno.env.get("KI_EVAL_USERS") ?? "").split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
}
/** Modellname nur aus harmlosen Zeichen (z. B. „gemini-3.5-flash-lite“) */
const MODEL_NAME = /^[A-Za-z0-9][A-Za-z0-9._:\/-]{0,79}$/;

const MAX_PROMPT = 4000;
const MAX_TEXT = 20000;
const MAX_SCHEMA = 60000;
const MAX_IMAGE_B64 = 6_000_000; // ≈ 4,5 MB
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callModel(params: {
  endpoint: string;
  token: string;
  model: string;
  prompt: string;
  /** leer = nur Text; mehrere = Vorderseite, Rückseite */
  images: { b64: string; mime: string }[];
  schema: JsonSchema;
  temperature: number;
}): Promise<unknown> {
  const content = params.images.length
    ? [
      { type: "text", text: params.prompt },
      ...params.images.map((i) => ({ type: "image_url", image_url: { url: `data:${i.mime};base64,${i.b64}` } })),
    ]
    : params.prompt;
  const response = await fetch(params.endpoint, {
    method: "POST",
    signal: AbortSignal.timeout(CALL_MS),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify({
      model: params.model,
      temperature: params.temperature,
      messages: [
        {
          role: "user",
          content,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "antwort", strict: true, schema: params.schema },
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Model API error (${response.status}): ${errText.slice(0, 500)}`);
  }

  const data = await response.json();
  const rawText = data?.choices?.[0]?.message?.content;
  if (typeof rawText !== "string") {
    throw new Error("No text response received from model.");
  }
  return JSON.parse(rawText);
}

Deno.serve(async (req: Request) => {
  // 1. CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    // 2. Auth-Header prüfen & Supabase-Client im User-Kontext initialisieren
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Missing or invalid Authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
    const modelToken = geminiKey || Deno.env.get("KI_API_KEY")?.trim();
    const preset = geminiKey ? GEMINI : MISTRAL;
    const endpoint = Deno.env.get("KI_ENDPOINT")?.trim() || preset.endpoint;
    const model = Deno.env.get("KI_MODEL")?.trim() || preset.model;
    const storageBucket = Deno.env.get("ITEMS_BUCKET_NAME")?.trim() || DEFAULT_STORAGE_BUCKET;

    if (!supabaseUrl || !supabaseAnonKey || !modelToken) {
      console.error("Missing required environment variables");
      return jsonResponse({ error: "config_error" }, 503);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Nur Mitglieder eines Schranks dürfen das gemeinsame Gratis-Kontingent nutzen (Registrierung ist offen).
    // RLS members_read: eigene Mitgliedschaften sind lesbar.
    const { data: membership, error: memberError } = await supabase
      .from("wardrobe_members").select("wardrobe_id").eq("user_id", user.id).limit(1);
    if (memberError) {
      console.error("membership check failed", memberError.message);
      return jsonResponse({ error: "storage_unavailable" }, 503);
    }
    if (!membership?.length) return jsonResponse({ error: "not_member" }, 403);

    // 3. Request-Body validieren
    let payload: RequestPayload;
    try {
      payload = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const imagePath = payload.imagePath?.trim();
    const basePrompt = payload.prompt?.trim();
    const text = typeof payload.text === "string" ? payload.text.trim() : "";
    const responseSchema = payload.schema;
    const inline = payload.image;
    if ((!imagePath && !inline?.data && !text) || !basePrompt || !responseSchema || typeof responseSchema !== "object") {
      return jsonResponse({ error: "imagePath, image or text, prompt and schema are required" }, 400);
    }
    if (basePrompt.length > MAX_PROMPT || text.length > MAX_TEXT || JSON.stringify(responseSchema).length > MAX_SCHEMA) {
      return jsonResponse({ error: "prompt, text or schema too large" }, 413);
    }
    const prompt = text ? `${basePrompt}\n\n---\n${text}` : basePrompt;

    // 4. Bilder: mitgeschickt oder aus dem Storage-Bucket (respektiert RLS des Users); optional Rückseite
    const loadImage = async (path: string | undefined, sent: { data?: string; mimeType?: string } | undefined): Promise<{ b64: string; mime: string } | Response | null> => {
      if (sent?.data) {
        const mime = sent.mimeType || "image/jpeg";
        if (!IMAGE_TYPES.includes(mime) || sent.data.length > MAX_IMAGE_B64) return jsonResponse({ error: "unsupported or too large image" }, 413);
        return { b64: sent.data, mime };
      }
      if (!path) return null;
      const { data: fileBlob, error: storageError } = await supabase.storage.from(storageBucket).download(path);
      if (storageError || !fileBlob) {
        console.warn("storage download failed", storageError?.message);
        // nur echtes „nicht gefunden“ als 404 (Fehlversuch am Teil); sonst vorübergehend → 503 (Stapellauf pausiert)
        const status = (storageError as { statusCode?: string | number } | null)?.statusCode;
        const missing = !storageError || String(status) === "404" || /not.?found/i.test(storageError.message ?? "");
        return jsonResponse({ error: missing ? "image_not_found" : "storage_unavailable" }, missing ? 404 : 503);
      }
      const mime = fileBlob.type || "image/jpeg";
      // gleiche Grenzen wie für mitgeschickte Bilder (Base64 ist ~4/3 der Bytes)
      if (!IMAGE_TYPES.includes(mime) || fileBlob.size * 4 / 3 > MAX_IMAGE_B64) return jsonResponse({ error: "unsupported or too large image" }, 413);
      return { b64: encodeBase64(await fileBlob.arrayBuffer()), mime };
    };
    const images: { b64: string; mime: string }[] = [];
    const front = await loadImage(imagePath, inline);
    if (front instanceof Response) return front;
    if (front) {
      images.push(front);
      const back = await loadImage(payload.backPath?.trim() || undefined, payload.backImage);
      if (back instanceof Response) return back;
      if (back) images.push(back);
    }

    // 5. Modell-Aufruf; bei Fehler (z. B. kaputtes JSON) ein Wiederholungsversuch
    // Gewähltes Modell zuerst; bei Überlastung (503) die Ersatzmodelle, sonst ein Wiederholungsversuch.
    // Eval: erzwungenes Modell (nur erlaubte Nutzer) ohne Ersatz – ein Fehler soll sichtbar bleiben.
    const temperature = temperatureOf(payload.temperature);
    const forced = typeof payload.model === "string" ? payload.model.trim() : "";
    const useForced = !!forced && MODEL_NAME.test(forced) && evalUsers().includes(user.id);
    const models = useForced ? [forced] : [model, ...(preset === GEMINI ? GEMINI_FALLBACK.filter((m) => m !== model) : [model])];
    let lastError = "";
    let limited = 0;
    let rejected = 0; // Anbieter lehnt dieses Bild/diese Anfrage ab (400/422 …, leere oder kaputte Antwort)
    let config = 0; // Einstellungsfehler (Schlüssel ungültig 401/403, Modell unbekannt 404) – nicht dem Teil anlasten
    let attempted = 0;
    let mainConfig = false; // das Hauptmodell selbst meldet Schlüssel-/Modellfehler
    const started = Date.now();
    for (const m of models) {
      if (Date.now() - started > TOTAL_MS - CALL_MS) break;
      attempted++;
      try {
        const data = await callModel({ endpoint, token: modelToken, model: m, prompt, images, schema: responseSchema, temperature });
        return jsonResponse({ data, model: m }, 200);
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.warn(`${m}: model call error`, lastError);
        // Gratisgrenzen gelten je Modell → nächstes Modell probieren; „rate_limited“ erst, wenn alle begrenzt sind
        if (lastError.includes("(429)")) limited++;
        // Google meldet einen ungültigen Schlüssel oft als 400 („API_KEY_INVALID“) – ebenfalls Einstellungsfehler
        else if (/\((401|403|404)\)/.test(lastError) || /API_KEY_INVALID|API key not valid|API key expired/i.test(lastError)) { config++; if (attempted === 1) mainConfig = true; }
        else if (/\((4\d\d)\)/.test(lastError) || err instanceof SyntaxError || lastError.startsWith("No text response")) rejected++;
      }
    }
    // gezählt wird gegen die tatsächlich versuchten Modelle (die Zeitgrenze kann die Schleife früher beenden)
    // Kontingent hat Vorrang: liefert nur ein Ersatzmodell 401/403/404, bleibt es „rate_limited“
    if (limited > 0 && limited + config === attempted) return jsonResponse({ error: "rate_limited" }, 429);
    // config_error nur, wenn kein Modell überlastet war (sonst ist „nicht erreichbar“ die ehrlichere Meldung)
    // config_error nur, wenn das Hauptmodell selbst so antwortet (404 eines Ersatzmodells steht nur im Log)
    if (mainConfig && config + rejected === attempted) {
      console.error("ki: provider configuration error (key/model)", lastError);
      return jsonResponse({ error: "config_error" }, 503);
    }
    // Liegt es an der Anfrage selbst (nicht an Überlast), soll der Stapellauf das Teil als Fehlversuch zählen statt zu pausieren
    // nur, wenn kein Modell am Kontingent hing (gemischt → lieber pausieren als dem Teil einen Fehlversuch anrechnen)
    if (rejected > 0 && limited === 0 && rejected === attempted && attempted === models.length) return jsonResponse({ error: "model_rejected" }, 422);
    // Fehlertext des Anbieters nur ins Log, nicht an die App
    return jsonResponse({ error: "AI request failed" }, 502);
  } catch (err) {
    console.error("Unexpected error in ki:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
