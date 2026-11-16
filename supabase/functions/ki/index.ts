import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { encodeBase64 } from "jsr:@std/encoding@1.0.5/base64";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_STORAGE_BUCKET = "items";

// Allgemeiner KI-Durchreicher (Valet): Bild aus dem Storage + Prompt + Antwort-Schema → Gemini → JSON.
// Prompt, Schema und Prüfung der Antwort liegen in packages/core (z. B. core/src/ai/analyzeItem.ts),
// damit sie mit denselben festen Listen arbeiten wie die App. Die App prüft die Antwort selbst.

// deno-lint-ignore no-explicit-any
type GeminiSchema = Record<string, any>;

interface RequestPayload {
  /** Bild im Storage (bei bestehenden Teilen) … */
  imagePath?: string;
  /** … oder direkt mitgeschickt (neues Teil, noch nicht hochgeladen), Base64 ohne data:-Präfix */
  image?: { data?: string; mimeType?: string };
  prompt?: string;
  schema?: GeminiSchema;
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

async function callGeminiVision(params: {
  apiKey: string;
  model: string;
  prompt: string;
  base64Image: string;
  mimeType: string;
  responseSchema: GeminiSchema;
}): Promise<unknown> {
  // API-Key wird sicher über den Header x-goog-api-key statt über die URL übergeben
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": params.apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: params.prompt },
            {
              inline_data: {
                mime_type: params.mimeType,
                data: params.base64Image,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: params.responseSchema,
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof rawText !== "string") {
    throw new Error("No text response received from Gemini.");
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
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    const geminiModel = Deno.env.get("GEMINI_MODEL")?.trim() || DEFAULT_GEMINI_MODEL;
    const storageBucket = Deno.env.get("ITEMS_BUCKET_NAME")?.trim() || DEFAULT_STORAGE_BUCKET;

    if (!supabaseUrl || !supabaseAnonKey || !geminiApiKey) {
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

    // 5. Gemini-Aufruf; bei Fehler (z. B. kaputtes JSON) ein Wiederholungsversuch
    let lastError = "";
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const data = await callGeminiVision({
          apiKey: geminiApiKey,
          model: geminiModel,
          prompt,
          base64Image,
          mimeType,
          responseSchema,
        });
        return jsonResponse({ data }, 200);
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.warn(`Attempt ${attempt}/2: Gemini call error`, lastError);
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
