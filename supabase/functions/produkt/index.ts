import { createClient } from "npm:@supabase/supabase-js@2.45.0";

// Produktseite auslesen (Valet „Per Link hinzufügen“):
//   POST { url }            → Seite laden, Bilder + Text + strukturierte Angaben zurück
//   POST { url, html }      → wie oben, aber HTML kommt schon mit (iOS-Kurzbefehl liest die Seite im eigenen Safari aus)
//   POST { image: url }     → ein Bild durchreichen (der Browser darf fremde Bilder nicht als Datei lesen – CORS)
// Ohne KI: Die KI bekommt danach nur den Text (Edge Function `ki`), die Bildauswahl trifft Max selbst.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const PAGE_MAX = 4_000_000; // Bytes HTML
const IMAGE_MAX = 12_000_000; // Bytes je Bild
const HTML_IN_MAX = 4_000_000; // mitgeschicktes HTML
const TEXT_MAX = 15_000; // Zeichen Seitentext für die KI
const IMAGES_MAX = 40;
const TIMEOUT = 15_000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ---------- Sicherheit: nur öffentliche http(s)-Adressen ----------

function privateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  const v4 = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (h.includes(":")) return h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80") || h.startsWith("::ffff:");
  return false;
}

function safeUrl(raw: unknown): URL | null {
  if (typeof raw !== "string" || raw.length > 4000) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password || (u.port && u.port !== "80" && u.port !== "443")) return null;
    if (privateHost(u.hostname)) return null;
    return u;
  } catch {
    return null;
  }
}

/** fetch mit eigener Weiterleitungs-Prüfung (jede Station muss öffentlich sein) */
async function safeFetch(url: URL, accept: string, referer?: string): Promise<Response> {
  let cur = url;
  for (let i = 0; i < 6; i++) {
    const res = await fetch(cur, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT),
      headers: {
        "User-Agent": UA,
        Accept: accept,
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.7",
        ...(referer ? { Referer: referer } : {}),
      },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      await res.body?.cancel();
      const next = safeUrl(new URL(res.headers.get("location")!, cur).href);
      if (!next) throw new Error("blocked_redirect");
      cur = next;
      continue;
    }
    return res;
  }
  throw new Error("too_many_redirects");
}

async function readCapped(res: Response, max: number): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new Error("too_large");
    }
    parts.push(value);
  }
  const out = new Uint8Array(size);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// ---------- HTML auslesen ----------

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", euro: "€", auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß", eacute: "é", reg: "®", trade: "™", middot: "·", deg: "°", ndash: "–", mdash: "—" };
function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e] ?? m;
  });
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? decode(m[2] ?? m[3] ?? m[4] ?? "") : null;
}

function meta(html: string, key: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const k = attr(tag, "property") ?? attr(tag, "name") ?? attr(tag, "itemprop");
    if (k && k.toLowerCase() === key) return attr(tag, "content");
  }
  return null;
}

// deno-lint-ignore no-explicit-any
type Any = any;

function jsonLd(html: string): Any[] {
  const out: Any[] = [];
  const re = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    try {
      const walk = (v: Any) => {
        if (Array.isArray(v)) return v.forEach(walk);
        if (v && typeof v === "object") {
          out.push(v);
          if (Array.isArray(v["@graph"])) v["@graph"].forEach(walk);
          if (Array.isArray(v.hasVariant)) v.hasVariant.forEach(walk);
          if (v.mainEntity) walk(v.mainEntity);
        }
      };
      walk(JSON.parse(m[1].trim().replace(/^<!--|-->$/g, "")));
    } catch { /* kaputtes JSON-LD einfach überspringen */ }
  }
  return out;
}

const isType = (o: Any, t: string) => [].concat(o?.["@type"] ?? []).some((x: string) => String(x).toLowerCase() === t);

function ldImages(v: Any): string[] {
  if (!v) return [];
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(ldImages);
  if (typeof v === "object") return [v.contentUrl, v.url].filter((x) => typeof x === "string");
  return [];
}

function first(v: Any): Any {
  return Array.isArray(v) ? v[0] : v;
}

/** größtes Bild aus srcset */
function fromSrcset(s: string | null): string | null {
  if (!s) return null;
  let best: string | null = null, bestW = -1;
  for (const part of s.split(",")) {
    const [u, d] = part.trim().split(/\s+/);
    if (!u) continue;
    const w = d ? parseFloat(d) * (d.endsWith("x") ? 1000 : 1) : 0;
    if (w > bestW) { best = u; bestW = w; }
  }
  return best;
}

const SKIP = /(logo|icon|sprite|favicon|placeholder|blank|spacer|pixel|tracking|badge|payment|flag|avatar|rating|star|loader|spinner)/i;

function imgTags(html: string): string[] {
  const out: string[] = [];
  for (const tag of html.match(/<(img|source)\b[^>]*>/gi) ?? []) {
    const w = Number(attr(tag, "width") ?? 0), h = Number(attr(tag, "height") ?? 0);
    if ((w && w < 150) || (h && h < 150)) continue;
    const src = fromSrcset(attr(tag, "srcset") ?? attr(tag, "data-srcset")) ?? attr(tag, "data-src") ?? attr(tag, "data-zoom-image") ?? attr(tag, "src");
    if (!src || src.startsWith("data:")) continue;
    if (SKIP.test(src) || SKIP.test(attr(tag, "alt") ?? "") || SKIP.test(attr(tag, "class") ?? "")) continue;
    out.push(src);
  }
  return out;
}

function pageText(html: string): string {
  const body = html
    .replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr|\/section|\/dt|\/dd)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const lines = decode(body).split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l.length > 1);
  // gleiche Zeilen (Navigation, Fußzeile doppelt) nur einmal
  const seen = new Set<string>();
  return lines.filter((l) => (seen.has(l) ? false : (seen.add(l), true))).join("\n").slice(0, TEXT_MAX);
}

function normImage(raw: string, base: URL): string | null {
  try {
    const u = new URL(raw.trim().replace(/^\/\//, base.protocol + "//"), base);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (/\.(svg|gif|ico)(\?|$)/i.test(u.pathname)) return null;
    return u.href;
  } catch {
    return null;
  }
}

/** Gleiche Bilder in anderer Größe (…?w=200 / ?w=1200) nur einmal – die größere Variante gewinnt nicht, aber die erste (strukturierte) */
function imageKey(href: string): string {
  const u = new URL(href);
  const plain = /\.(jpe?g|png|webp|avif)$/i.test(u.pathname);
  return plain ? u.host + u.pathname.replace(/[-_]\d{2,4}x\d{2,4}(?=\.)/, "") : u.host + u.pathname + u.search;
}

async function shopify(url: URL, html: string): Promise<{ images: string[]; facts: Record<string, unknown> } | null> {
  if (!/cdn\.shopify\.com|Shopify\.theme/i.test(html) || !/\/products\//.test(url.pathname)) return null;
  try {
    const u = new URL(url.href);
    u.pathname = u.pathname.replace(/\/$/, "") + ".js";
    u.search = "";
    const res = await safeFetch(u, "application/json");
    if (!res.ok) return null;
    const p = JSON.parse(new TextDecoder().decode(await readCapped(res, 2_000_000)));
    return {
      images: (p.images ?? []).map(String),
      facts: { name: p.title, brand: p.vendor, price: typeof p.price === "number" ? p.price / 100 : null },
    };
  } catch {
    return null;
  }
}

async function parse(html: string, url: URL) {
  const ld = jsonLd(html);
  const product = ld.find((o) => isType(o, "product")) ?? ld.find((o) => isType(o, "productgroup"));
  const variants = ld.filter((o) => isType(o, "product") && o !== product);
  const offer = first(product?.offers);
  const sp = await shopify(url, html);

  const raw = [
    ...ldImages(product?.image),
    ...variants.flatMap((v) => ldImages(v.image)),
    ...(sp?.images ?? []),
    meta(html, "og:image:secure_url") ?? meta(html, "og:image") ?? "",
    meta(html, "twitter:image") ?? "",
    ...imgTags(html),
  ];
  const seen = new Set<string>();
  const images: string[] = [];
  for (const r of raw) {
    const href = r && normImage(r, url);
    if (!href) continue;
    const k = imageKey(href);
    if (seen.has(k)) continue;
    seen.add(k);
    images.push(href);
    if (images.length >= IMAGES_MAX) break;
  }

  const brand = first(product?.brand);
  const facts = {
    name: product?.name ?? sp?.facts.name ?? meta(html, "og:title") ?? null,
    brand: (typeof brand === "string" ? brand : brand?.name) ?? sp?.facts.brand ?? meta(html, "product:brand") ?? null,
    price: Number(offer?.price ?? offer?.lowPrice ?? meta(html, "product:price:amount") ?? sp?.facts.price) || null,
    currency: offer?.priceCurrency ?? meta(html, "product:price:currency") ?? null,
    sku: product?.sku ?? product?.mpn ?? null,
    color: product?.color ?? null,
    material: product?.material ?? null,
    description: typeof product?.description === "string" ? decode(product.description).slice(0, 3000) : meta(html, "og:description"),
    shop: meta(html, "og:site_name") ?? url.hostname.replace(/^www\./, ""),
  };
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "") || null;
  return { url: url.href, title, images, facts, text: pageText(html) };
}

// ---------- Anfrage ----------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    let body: Any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "invalid_json" }, 400);
    }

    // Bild durchreichen
    if (body.image) {
      const u = safeUrl(body.image);
      if (!u) return json({ error: "invalid_url" }, 400);
      const referer = safeUrl(body.referer)?.href;
      const res = await safeFetch(u, "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8", referer);
      const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
      if (!res.ok || !type.startsWith("image/")) return json({ error: "image_failed", status: res.status }, 502);
      const bytes = await readCapped(res, IMAGE_MAX);
      return new Response(bytes.buffer as ArrayBuffer, { headers: { ...corsHeaders, "Content-Type": type, "Cache-Control": "no-store" } });
    }

    const url = safeUrl(body.url);
    if (!url) return json({ error: "invalid_url" }, 400);

    let html: string;
    if (typeof body.html === "string" && body.html.length) {
      if (body.html.length > HTML_IN_MAX) return json({ error: "too_large" }, 413);
      html = body.html;
    } else {
      const res = await safeFetch(url, "text/html,application/xhtml+xml");
      if (!res.ok) return json({ error: "page_failed", status: res.status }, 502);
      html = new TextDecoder().decode(await readCapped(res, PAGE_MAX));
    }
    const out = await parse(html, url);
    // Seite ohne Bilder und fast ohne Text = vermutlich Bot-Sperre (Captcha, „Access denied“)
    const blocked = !out.images.length && out.text.length < 400;
    return json({ ...out, blocked });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("produkt:", msg);
    if (msg === "too_large") return json({ error: "too_large" }, 413);
    if (msg.includes("timed out") || msg.includes("TimeoutError")) return json({ error: "timeout" }, 504);
    return json({ error: "failed", details: msg.slice(0, 200) }, 502);
  }
});
