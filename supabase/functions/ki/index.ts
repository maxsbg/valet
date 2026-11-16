import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { encodeBase64 } from "jsr:@std/encoding@1.0.5/base64";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_MODEL = "openai/gpt-4.1-mini";
const ENDPOINT = "https://models.github.ai/inference/chat/completions";
const DEFAULT_STORAGE_BUCKET = "items";

// Allgemeiner KI-Durchreicher (Valet): Bild + Prompt + JSON-Schema → GitHub Models (OpenAI-kompatibel) → JSON.
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
  token: string;
  model: string;
  prompt: string;
  base64Image: string;
  mimeType: string;
  schema: JsonSchema;
}): Promise<unknown> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${params.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      model: params.model,
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: params.prompt },
            { type: "image_url", image_url: { url: `data:${params.mimeType};base64,${params.base64Image}`, detail: "high" } },
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
    const modelToken = Deno.env.get("GITHUB_MODELS_TOKEN");
    const model = Deno.env.get("KI_MODEL")?.trim() || DEFAULT_MODEL;
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
    let lastError = "";
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const data = await callModel({
          token: modelToken,
          model,
          prompt,
          base64Image,
          mimeType,
          schema: responseSchema,
        });
        return jsonResponse({ data }, 200);
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.warn(`Attempt ${attempt}/2: model call error`, lastError);
        // Kontingent erschöpft → nicht sofort erneut versuchen
        if (lastError.includes("(429)")) return jsonResponse({ error: "rate_limited" }, 429);
      }
    }
    return jsonResponse({ error: "AI request failed", details: lastError }, 502);
  } catch (err) {
    console.error("Unexpected error in ki:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
