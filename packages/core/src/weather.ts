// Wärme und Regenschutz aus Typ + Material berechnen (Max, 21.11.2026; Prüfseite `pnpm wetterregeln`).
// Wärme = Grundwert aus Unterkategorie/Typ + Verschiebung durch das Material (gewichtet nach Prozent) + Stichwörter.
//   Schuhe: nur nach Art (Zehen offen 0 · geschlossen 1 · Stiefel 2 · gefüttert 3), Material verschiebt nichts.
// Regen = Regenschutz des Hauptmaterials (nur Außenlage und Schuhe; Hosen/Oberteile nie aus dem Material),
//   angehoben durch Typ, Unterkategorie (Trenchcoat) oder Stichwörter im Namen.
// Rangfolge im Formular: bestätigt > aus Material berechnet (Herkunft `material`) > KI-Bildschätzung (`applyWeather`).

import type { MaterialPart } from './attributes';
import { fieldsFor } from './fields';
import type { EditForm } from './edit';

/** 0 sehr leicht · 1 leicht · 2 mittel · 3 warm */
export type Warmth = 0 | 1 | 2 | 3;
/** 0 schlecht · 1 mittel · 2 gut */
export type Rain = 0 | 1 | 2;

// ---------- Grundwärme je Unterkategorie / Typ ----------

/** Typ vor Unterkategorie; fehlt beides → Vorgabe der Kategorie */
export const WARMTH_BY_TYPE: Readonly<Record<string, Warmth>> = {
  short_sleeve_polo: 1, long_sleeve_polo: 1, short_sleeve_shirt: 0, long_sleeve_shirt: 1,
  short_sleeve_blouse: 0, long_sleeve_blouse: 1, sleeveless_blouse: 0,
  puffer_vest: 2, suit_vest: 1, knit_vest: 1,
  anorak: 1, rain_jacket: 1, windbreaker: 0, track_jacket: 1, thermal_jacket: 3,
  poncho: 1, cape: 2, robe: 1,
  // Schuhe (Max 21.11.2026): Zehen offen = sehr leicht; Mules, Slingbacks, Clogs = leicht; Stiefel = mittel; gefüttert = warm
  espadrille: 0, heeled_sandal: 0, mule: 1, heeled_mule: 1, slingback: 1, sheepskin_boot: 3,
  hiking_boot: 2, low_hiking_shoe: 1, trail_running_shoe: 1,
  neckerchief: 0, bandana: 0, knit_scarf: 2, loop_scarf: 2,
  beanie: 2, beret: 1, flat_cap: 1, sun_hat: 0, panama_hat: 0, bucket_hat: 0, fedora: 1,
  ankle_sock: 0, knee_sock: 1, thermal_underwear: 2,
};
export const WARMTH_BY_SUB: Readonly<Record<string, Warmth>> = {
  // Oberteil
  t_shirt: 1, long_sleeve: 1, sleeveless_shirt: 0, tank_top: 0, strapless_top: 0, crop_top: 0, polo: 1, shirt: 1, blouse: 1,
  sweatshirt: 2, hoodie: 2, sweater: 2, sweater_vest: 1, sports_top: 0, bodysuit: 0, pajama_top: 1,
  // Oberbekleidung
  coat: 3, trench_coat: 2, parka: 3, puffer_jacket: 3, blazer: 1, vest: 1, cardigan: 2, sweat_jacket: 2, overshirt: 1,
  shearling_jacket: 3, blouson: 2, varsity_jacket: 2, coach_jacket: 1, trucker_jacket: 1, biker_jacket: 2, field_jacket: 2,
  sports_jacket: 1, bolero: 0,
  // Hose / Shorts / Rock / Kleid
  jeans: 2, trousers: 1, cargo_pants: 1, sweatpants: 2, leggings: 1, overalls: 2, pajama_pants: 1,
  // Schuhe
  sneaker: 1, sports_shoe: 1, dress_shoe: 1, slip_on: 1, boot: 2, hiking_shoe: 1, sandal: 0, slide: 0, clog: 1, flat: 1, high_heel: 1,
  // Kopfbedeckung, Accessoires mit Wetterfeld
  cap: 0, hat: 0, beanie_cap: 2, scarf: 2, glove: 2, sock: 1, tights: 1, warmer: 2, swimwear: 0,
};
const WARMTH_BY_CATEGORY: Readonly<Record<string, Warmth>> = {
  top: 1, outerwear: 2, pants: 1, shorts: 0, skirt: 1, dress: 1, shoe: 1, headwear: 0, accessory: 1,
};

export function baseWarmth(category: string | null | undefined, sub?: string | null, type?: string | null): Warmth | null {
  if (!category) return null;
  return (type ? WARMTH_BY_TYPE[type] : undefined) ?? (sub ? WARMTH_BY_SUB[sub] : undefined) ?? WARMTH_BY_CATEGORY[category] ?? null;
}

// ---------- Material ----------

/** Wärme-Verschiebung je Material (−1 kühler … +1 wärmer); fehlt = 0 */
export const MATERIAL_WARMTH: Readonly<Record<string, number>> = {
  wool: 1, merino: 1, cashmere: 1, alpaca: 1, mohair: 1, angora: 1, fleece: 1, shearling: 1, fur: 1, down: 1, boucle: 1, tweed: 1,
  flannel: 0.5, corduroy: 0.5, velvet: 0.5, acrylic: 0.5,
  viscose: -0.5, lyocell: -0.5, cupro: -0.5,
  linen: -1, silk: -1, chiffon: -1, mesh: -1, lace: -1,
};
/** Regenschutz je Material (0 schlecht · 1 mittel · 2 gut); fehlt = 0 */
export const MATERIAL_RAIN: Readonly<Record<string, Rain>> = {
  leather: 1, faux_leather: 1, polyester: 1, nylon: 1, down: 1, tweed: 1, plastic_rubber: 2,
};

/** Anteile 0–1 je Material; ohne Prozentangaben gleich verteilt, fehlende Prozente teilen sich den Rest */
export function materialShares(parts: readonly MaterialPart[]): { name: string; share: number }[] {
  if (!parts.length) return [];
  const known = parts.reduce((a, p) => a + (p.pct ?? 0), 0);
  const without = parts.filter((p) => p.pct == null).length;
  if (!known) return parts.map((p) => ({ name: p.name, share: 1 / parts.length }));
  const rest = Math.max(0, 100 - known) / Math.max(1, without);
  return parts.map((p) => ({ name: p.name, share: (p.pct ?? rest) / 100 }));
}

// ---------- Stichwörter im Namen ----------

/** Wasserdicht → gut; wasserabweisend → mindestens mittel */
export const RAIN_WORDS: Readonly<Record<'proof' | 'repellent', readonly string[]>> = {
  proof: ['waterproof', 'wasserdicht', 'gore tex', 'goretex', 'membran', 'membrane', 'regenjacke', 'rain jacket', 'rubber', 'gummi'],
  repellent: ['water repellent', 'wasserabweisend', 'dwr', 'gewachst', 'waxed', 'wax', 'gabardine'],
};
/** Wärmer: gefüttert, wattiert, Thermo … */
export const WARM_WORDS: readonly string[] = ['gefüttert', 'lined', 'wattiert', 'padded', 'thermo', 'thermal', 'teddy', 'sherpa', 'puffer', 'daune', 'down'];

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9äöüß]+/g, ' ').trim()} `;
const hasWord = (n: string, w: string) => n.includes(` ${w} `);

/** Typen, die per se regenfest sind */
const RAIN_BY_TYPE: Readonly<Record<string, Rain>> = { rain_jacket: 2, rain_boot: 2, anorak: 1, windbreaker: 1, puffer_vest: 1 };
/** Unterkategorien mit Mindest-Regenschutz (Trenchcoat: Gabardine, meist imprägniert) */
const RAIN_BY_SUB: Readonly<Record<string, Rain>> = { trench_coat: 1 };
/** Nur hier zählt das Material für den Regenschutz (eine Stoffhose aus Polyester wird trotzdem nass, Max 21.11.2026) */
const RAIN_BY_MATERIAL_IN: ReadonlySet<string> = new Set(['outerwear', 'shoe']);

// ---------- Berechnung ----------

export type WeatherInput = { category: string | null; subcategory?: string | null; type?: string | null; materials?: readonly MaterialPart[] | null; name?: string | null };
export type WeatherResult = {
  warmth: Warmth | null; rain: Rain | null;
  /** kurze Begründung für die Anzeige / Prüftabelle */
  why: { warmth: string; rain: string };
  /** ohne Material berechnet (nur Typ) */
  typeOnly: boolean;
  /** Wärme hat eine echte Grundlage (Material, Stichwort oder Schuh-Art) – sonst nur Grundwert des Typs */
  warmthSure: boolean;
};

export function weatherFrom(i: WeatherInput): WeatherResult {
  const fx = i.category ? fieldsFor(i.category, i.subcategory ?? null) : null;
  if (!fx?.weather) return { warmth: null, rain: null, why: { warmth: 'kein Wetterfeld', rain: 'kein Wetterfeld' }, typeOnly: true, warmthSure: false };
  const base = baseWarmth(i.category, i.subcategory, i.type);
  const shares = materialShares(i.materials ?? []);
  const n = norm(i.name ?? '');

  // Wärme
  const shoe = i.category === 'shoe';
  let delta = shoe ? 0 : shares.reduce((a, m) => a + m.share * (MATERIAL_WARMTH[m.name] ?? 0), 0);
  const warmWord = WARM_WORDS.find((w) => hasWord(n, w));
  if (warmWord) delta = shoe ? Math.max(0, 3 - (base ?? 1)) : delta + 1;
  const warmth = base == null ? null : (Math.max(0, Math.min(3, Math.round(base + delta))) as Warmth);
  const whyW = base == null ? 'kein Grundwert'
    : `Typ ${base}${Math.abs(delta) >= 0.05 ? ` ${delta > 0 ? '+' : '−'} ${Math.abs(Math.round(delta * 10) / 10)} (${warmWord ? `„${warmWord}“` : 'Material'})` : ''}`;

  // Regen: Hauptmaterial, dann Typ und Stichwörter heben an
  const main = [...shares].sort((a, b) => b.share - a.share)[0];
  const matCounts = RAIN_BY_MATERIAL_IN.has(i.category ?? '');
  let rain: Rain = main && matCounts ? (MATERIAL_RAIN[main.name] ?? 0) : 0;
  let whyR = !main ? 'kein Material → 0' : matCounts ? `Hauptmaterial ${main.name} → ${rain}` : 'Material zählt hier nicht → 0';
  const byType = (i.type ? RAIN_BY_TYPE[i.type] : undefined) ?? (i.subcategory ? RAIN_BY_SUB[i.subcategory] : undefined);
  if (byType != null && byType > rain) { rain = byType; whyR += `, Typ → ${byType}`; }
  const proof = RAIN_WORDS.proof.find((w) => hasWord(n, w));
  const repel = RAIN_WORDS.repellent.find((w) => hasWord(n, w));
  if (proof) { rain = 2; whyR += `, „${proof}“ → 2`; }
  else if (repel && rain < 1) { rain = 1; whyR += `, „${repel}“ → 1`; }
  // Strick, Wildleder & Co. bleiben schlecht, auch wenn ein Typ mehr verspräche – nur Stichwörter heben das an
  return { warmth, rain: main || byType != null || proof || repel ? rain : null, why: { warmth: whyW, rain: whyR }, typeOnly: !shares.length, warmthSure: !!shares.length || shoe || !!warmWord };
}

/** Wert gilt als berechnet (sonst bleibt die KI-Schätzung): Wärme mit Material/Stichwort, bei Schuhen schon aus der Art; Regen mit Material, Typ oder Stichwort */
const trusted = (r: WeatherResult, k: 'warmth' | 'rain'): boolean => r[k] != null && (k === 'rain' || r.warmthSure);

/**
 * Wärme/Regen im Formular aus Typ + Material + Name: ersetzt leere Felder und offene Vorschläge aus Bild oder Namen
 * (Herkunft `material`, Rang über der Bildschätzung), nie bestätigte Werte. Entfällt die Grundlage (Material gelöscht),
 * verschwindet ein zuvor berechneter offener Wert wieder.
 */
export function applyWeather(f: EditForm): EditForm {
  const r = weatherFrom({ category: f.category, subcategory: f.subcategory, type: f.type, materials: f.materials, name: f.name });
  const src0 = f.analysisBase?.src;
  const src: Record<string, unknown> = src0 && typeof src0 === 'object' && !Array.isArray(src0) ? { ...(src0 as Record<string, unknown>) } : {};
  let pending = [...f.aiPending];
  let out: EditForm = f;
  for (const k of ['warmth', 'rain'] as const) {
    const open = pending.includes(k);
    if (f[k] != null && !open) continue; // bestätigt
    const fromMaterial = open && src[k] === 'material';
    if (trusted(r, k)) {
      const origin = open ? (src[k] ?? 'image') : null;
      if (f[k] != null && origin !== 'image' && origin !== 'name' && origin !== 'material') continue; // höherrangige Quelle
      if (f[k] === r[k] && fromMaterial) continue;
      out = { ...out, [k]: r[k] };
      if (!open) pending = [...pending, k];
      src[k] = 'material';
    } else if (fromMaterial) {
      out = { ...out, [k]: null };
      pending = pending.filter((x) => x !== k);
      delete src[k];
    }
  }
  if (out === f) return f;
  return { ...out, aiPending: pending, analysisBase: { ...f.analysisBase, src } };
}

/** Hinweis in Bearbeiten, wenn Wärme oder Regen noch offen und aus Typ + Material berechnet sind */
export function weatherNote(f: Pick<EditForm, 'aiPending' | 'analysisBase'>): string | null {
  const src = f.analysisBase?.src as Record<string, unknown> | undefined;
  const ks = (['warmth', 'rain'] as const).filter((k) => f.aiPending.includes(k) && src?.[k] === 'material');
  if (!ks.length) return null;
  const what = ks.length === 2 ? 'Wärme und Regen' : ks[0] === 'warmth' ? 'Wärme' : 'Regen';
  return `${what} aus Typ und Material berechnet. Passt es nicht, wähle selbst – dein Wert gilt dann immer.`;
}
