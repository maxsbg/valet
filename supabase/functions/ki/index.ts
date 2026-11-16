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
const GEMINI = { endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", model: "gemini-flash-latest" };
/** Ersatzmodelle, wenn das gewählte überlastet ist (503) */
const GEMINI_FALLBACK = ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-flash-lite-latest"];
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
  prompt?: string;
  schema?: JsonSchema;
}

const MAX_PROMPT = 4000;
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
  base64Image: string;
  mimeType: string;
  schema: JsonSchema;
}): Promise<unknown> {
  const response = await fetch(params.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify({
      model: params.model,
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: params.prompt },
            { type: "image_url", image_url: { url: `data:${params.mimeType};base64,${params.base64Image}` } },
          ],
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
      return jsonResponse({ error: "Server configuration error" }, 500);
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

    // 3. Request-Body validieren
    let payload: RequestPayload;
    try {
      payload = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const imagePath = payload.imagePath?.trim();
    const prompt = payload.prompt?.trim();
    const responseSchema = payload.schema;
    const inline = payload.image;
    if ((!imagePath && !inline?.data) || !prompt || !responseSchema || typeof responseSchema !== "object") {
      return jsonResponse({ error: "imagePath or image, prompt and schema are required" }, 400);
    }
    if (prompt.length > MAX_PROMPT || JSON.stringify(responseSchema).length > MAX_SCHEMA) {
      return jsonResponse({ error: "prompt or schema too large" }, 413);
    }

    // 4. Bild: mitgeschickt oder aus dem Storage-Bucket (respektiert RLS des Users)
    let base64Image: string;
    let mimeType: string;
    if (inline?.data) {
      mimeType = inline.mimeType || "image/jpeg";
      if (!IMAGE_TYPES.includes(mimeType) || inline.data.length > MAX_IMAGE_B64) {
        return jsonResponse({ error: "unsupported or too large image" }, 413);
      }
      base64Image = inline.data;
    } else {
      const { data: fileBlob, error: storageError } = await supabase.storage
        .from(storageBucket)
        .download(imagePath!);
      if (storageError || !fileBlob) {
        return jsonResponse(
          { error: `Failed to download image from bucket '${storageBucket}'`, details: storageError?.message },
          404
        );
      }
      base64Image = encodeBase64(await fileBlob.arrayBuffer());
      mimeType = fileBlob.type || "image/jpeg";
    }

    // 5. Modell-Aufruf; bei Fehler (z. B. kaputtes JSON) ein Wiederholungsversuch
    // Gewähltes Modell zuerst; bei Überlastung (503) die Ersatzmodelle, sonst ein Wiederholungsversuch
    const models = [model, ...(preset === GEMINI ? GEMINI_FALLBACK.filter((m) => m !== model) : [model])];
    let lastError = "";
    for (const m of models) {
      try {
        const data = await callModel({ endpoint, token: modelToken, model: m, prompt, base64Image, mimeType, schema: responseSchema });
        return jsonResponse({ data, model: m }, 200);
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.warn(`${m}: model call error`, lastError);
        if (lastError.includes("(429)")) return jsonResponse({ error: "rate_limited" }, 429);
      }
    }
    return jsonResponse({ error: "AI request failed", details: lastError }, 502);
  } catch (err) {
    console.error("Unexpected error in ki:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
