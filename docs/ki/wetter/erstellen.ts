// Prüfseite „Wärme & Regen aus Typ + Material“ (Entwurf, Max 21.11.2026).
// Aufruf: pnpm wetterregeln [abzug.json] → docs/ki/wetter/wetter-regeln.html
// Mit Abzug (privat, nicht ins Repo) zusätzlich: Vergleich je Teil – gespeichert (KI/bestätigt) vs. berechnet.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MATERIAL_RAIN, MATERIAL_WARMTH, RAIN_WORDS, WARM_WORDS, WARMTH_BY_SUB, WARMTH_BY_TYPE, KEY_LISTS, label, weatherFrom, toMaterialParts,
} from '../../../packages/core/src/index';

const here = dirname(fileURLToPath(import.meta.url));
const src = process.argv[2];
const W = ['sehr leicht', 'leicht', 'mittel', 'warm'];
const R = ['schlecht', 'mittel', 'gut'];
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const cats = KEY_LISTS.categories as unknown as { key: string; label: string; subs: { key: string; label: string; types?: { key: string; label: string }[] }[] }[];
const subLabel = new Map<string, string>(), typeLabel = new Map<string, string>();
for (const c of cats) for (const s of c.subs) { subLabel.set(s.key, s.label); for (const t of s.types ?? []) typeLabel.set(t.key, t.label); }
const mat = (k: string) => label(KEY_LISTS.materials, k) || k;

const subRows = Object.entries(WARMTH_BY_SUB).map(([k, v]) => `<tr><td>${esc(subLabel.get(k) ?? k)}</td><td>${W[v]}</td></tr>`).join('');
const typeRows = Object.entries(WARMTH_BY_TYPE).map(([k, v]) => `<tr><td>${esc(typeLabel.get(k) ?? k)}</td><td>${W[v]}</td></tr>`).join('');
const allMats = (KEY_LISTS.materials as unknown as { key: string }[]).map((m) => m.key);
const matRows = allMats.map((k) => {
  const w = MATERIAL_WARMTH[k] ?? 0, r = MATERIAL_RAIN[k] ?? 0;
  return `<tr><td>${esc(mat(k))}</td><td class="${w > 0 ? 'up' : w < 0 ? 'down' : ''}">${w > 0 ? '+' : w < 0 ? '−' : '±'}${Math.abs(w) || 0}</td><td>${R[r]}</td></tr>`;
}).join('');

let compare = '';
if (src) {
  type Row = { name: string; category: string; subcategory: string | null; item_type: string | null; materials: unknown; warmth: number | null; rain: number | null; pending: boolean; thumb: string | null };
  const items = JSON.parse(readFileSync(src, 'utf8')) as Row[];
  const img = 'https://jocjisrmmzzvfnijosgg.supabase.co/storage/v1/object/public/items/';
  let same = 0, diff = 0;
  const rows = items.map((i) => {
    const r = weatherFrom({ category: i.category, subcategory: i.subcategory, type: i.item_type, materials: toMaterialParts(i.materials), name: i.name });
    if (r.warmth == null && r.rain == null) return '';
    const dW = i.warmth != null && r.warmth != null && i.warmth !== r.warmth, dR = i.rain != null && r.rain != null && i.rain !== r.rain;
    if (dW || dR) diff++; else same++;
    const now = (v: number | null, l: string[]) => (v == null ? '–' : l[v]);
    return `<tr class="${dW || dR ? 'diff' : ''}"><td>${i.thumb ? `<img src="${img}${i.thumb}" loading="lazy">` : ''}</td><td>${esc(i.name)}<small>${esc(subLabel.get(i.subcategory ?? '') ?? i.category)} · ${esc(toMaterialParts(i.materials).map((m) => mat(m.name) + (m.pct ? ` ${m.pct} %` : '')).join(', ') || 'kein Material')}</small></td>
      <td class="${dW ? 'hl' : ''}">${now(i.warmth, W)}${i.pending ? '<i>KI</i>' : i.warmth != null ? '<i>✓</i>' : ''} → <b>${now(r.warmth, W)}</b><small>${esc(r.why.warmth)}</small></td>
      <td class="${dR ? 'hl' : ''}">${now(i.rain, R)} → <b>${now(r.rain, R)}</b><small>${esc(r.why.rain)}</small></td></tr>`;
  }).join('');
  compare = `<h2>Deine Teile: jetzt → berechnet</h2><p>${same} gleich, <b>${diff} abweichend</b> (hervorgehoben). „KI“ = Vorschlag noch offen, „✓“ = gespeichert/bestätigt. Bestätigte Werte würden nie überschrieben.</p>
  <table class="cmp"><tr><th></th><th>Teil</th><th>Wärme</th><th>Regen</th></tr>${rows}</table>`;
}

const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Valet – Wärme & Regen aus Material</title>
<style>body{background:#F5F0E8;color:#2a1a1d;font:15px/1.45 -apple-system,system-ui,sans-serif;max-width:900px;margin:auto;padding:16px}h1,h2{color:#722638}h1{font-size:24px}
table{border-collapse:collapse;width:100%;background:#fff;border-radius:14px;overflow:hidden;margin:8px 0 18px}td,th{padding:6px 10px;border-bottom:1px solid #eee;text-align:left;vertical-align:top}th{background:#faf6ef}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.up{color:#b8430f;font-weight:600}.down{color:#3567b0;font-weight:600}
small{display:block;color:#7a6a66;font-size:12px}i{font-style:normal;font-size:11px;color:#722638;margin-left:4px}img{width:52px;height:52px;object-fit:contain}
tr.diff{background:#fff6ef}td.hl b{color:#b8430f}.note{background:#fff;border-radius:14px;padding:12px 14px}</style></head><body>
<h1>Wärme &amp; Regen aus Typ + Material</h1>
<div class="note"><b>So wird gerechnet</b><ul>
<li><b>Wärme</b> = Grundwert aus Typ/Unterkategorie + Verschiebung durch das Material (gewichtet nach Prozent; ohne Prozent nach Reihenfolge 80/20 bzw. 70/20/10, Elasthan 3 %) + 1 bei Stichwort im Namen (${WARM_WORDS.map(esc).join(', ')}); Ergebnis 0–3.</li>
<li><b>Regen</b> = Regenschutz des Hauptmaterials (größter Anteil); Regenjacke/Gummistiefel gut, Anorak/Windbreaker/Steppweste mindestens mittel; Stichwort „wasserdicht“ (${RAIN_WORDS.proof.map(esc).join(', ')}) → gut, „wasserabweisend“ (${RAIN_WORDS.repellent.map(esc).join(', ')}) → mindestens mittel.</li>
<li><b>Rangfolge:</b> von dir bestätigt &gt; aus Material berechnet &gt; KI-Schätzung aus dem Bild (nur wenn kein Material bekannt).</li></ul></div>
${compare}
<h2>Material</h2><table><tr><th>Material</th><th>Wärme</th><th>Regen</th></tr>${matRows}</table>
<div class="cols"><div><h2>Grundwärme je Unterkategorie</h2><table>${subRows}</table></div><div><h2>Abweichend je Typ</h2><table>${typeRows}</table></div></div>
<p style="text-align:center;color:#722638">valet</p></body></html>`;
const out = resolve(here, 'wetter-regeln.html');
writeFileSync(out, html);
console.log('geschrieben:', out);
