// Erstellt docs/ki/analyse-v2/farb-merkmale.html: alle Palettenfarben mit deutschem Namen, Farbfeld,
// warm/kühl/neutral, Helligkeit 1–5 und Sättigung 1–5 (berechnet in packages/core/src/traits.ts, Spec 5.1).
// Eigenständige HTML-Datei für Max zum Prüfen. Korrekturen kommen in COLOR_TRAIT_OVERRIDES.
// Aufruf im Repo-Hauptordner:  pnpm farbmerkmale

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLORS, MULTICOLOR, MULTICOLOR_STOPS, colorHex, colorLabel } from '../../../packages/core/src/attributes';
import { COLOR_TRAIT_OVERRIDES, MULTICOLOR_TRAIT, colorTrait, paletteKeys } from '../../../packages/core/src/traits';

const TEMP: Record<string, string> = { warm: 'warm', cool: 'kühl', neutral: 'neutral', mixed: 'gemischt' };
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dots = (n: number) => `<span class="dots" title="${n} von 5">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}<b>${n}</b></span>`;
const mains = new Set(COLORS.map((c) => c.key));

// Werte nahe an einer Schwelle markieren (L ± 0,005, C ± 0,003), damit Max weiß, wo eine kleine HEX-Änderung kippt
const L_LIM = [0.35, 0.5, 0.65, 0.8], C_LIM = [0.035, 0.075, 0.11, 0.145];
const close = (v: number, lims: number[], eps: number) => lims.some((x) => Math.abs(v - x) < eps);
const H_LIM = [115, 330];

const rows = paletteKeys().map((key) => {
  const name = esc(colorLabel(key));
  const cls = mains.has(key) ? 'main' : 'nuance';
  if (key === MULTICOLOR) {
    return `<tr class="${cls}"><td class="sw"><span style="background:conic-gradient(${MULTICOLOR_STOPS.join(',')},${MULTICOLOR_STOPS[0]})"></span></td>
      <td class="name">${name}<small>${key}</small></td><td><span class="tag mixed">${TEMP[MULTICOLOR_TRAIT.temperature]}</span></td>
      <td>${dots(MULTICOLOR_TRAIT.lightness)}</td><td>${dots(MULTICOLOR_TRAIT.chroma)}</td><td class="raw">fest vorgegeben</td><td></td></tr>`;
  }
  const t = colorTrait(key)!;
  const notes: string[] = [];
  if (t.override) notes.push(`von Hand: ${TEMP[COLOR_TRAIT_OVERRIDES[key]!.temperature]} (gerechnet ${TEMP[t.h < 115 || t.h >= 330 ? 'warm' : 'cool']})`);
  if (close(t.L, L_LIM, 0.005)) notes.push('Helligkeit knapp an der Grenze');
  if (close(t.C, C_LIM, 0.003)) notes.push(t.C < 0.04 ? 'knapp neutral/farbig' : 'Sättigung knapp an der Grenze');
  if (!t.neutral && H_LIM.some((x) => Math.abs(t.h - x) < 8)) notes.push('Farbton nahe der Grenze warm/kühl');
  const raw = `L ${t.L.toFixed(2)} · C ${t.C.toFixed(3)}${t.neutral ? '' : ` · h ${Math.round(t.h)}°`}`;
  return `<tr class="${cls}"><td class="sw"><span style="background:${colorHex(key)}"></span></td>
    <td class="name">${name}<small>${key}</small></td><td><span class="tag ${t.temperature}">${TEMP[t.temperature]}</span></td>
    <td>${dots(t.lightness)}</td><td>${dots(t.chroma)}</td><td class="raw">${raw}</td><td class="note">${notes.join('<br>')}</td></tr>`;
}).join('\n');

const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Valet – Farbmerkmale der Palette</title>
<style>
  :root { color-scheme: light; --ink:#2a1a1d; --soft:#7a6a6d; --line:#eadfd6; --bg:#fbf7f1; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px 16px 48px; font: 15px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: var(--bg); }
  main { max-width: 900px; margin: 0 auto; }
  h1 { font-size: 26px; margin: 0 0 6px; }
  p { margin: 0 0 12px; color: var(--soft); }
  .wrap { overflow-x: auto; background: #fff; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.06); margin-top: 16px; }
  table { border-collapse: collapse; width: 100%; min-width: 640px; }
  th { text-align: left; font-size: 12px; font-weight: 600; color: var(--soft); padding: 10px 10px; border-bottom: 1px solid var(--line); position: sticky; top: 0; background: #fff; }
  td { padding: 7px 10px; border-bottom: 1px solid var(--line); vertical-align: middle; }
  tr.main td { border-top: 2px solid var(--line); }
  tr.nuance .name { padding-left: 24px; }
  .sw span { display: block; width: 34px; height: 34px; border-radius: 50%; border: 1px solid rgba(0,0,0,.12); }
  .name { font-weight: 600; white-space: nowrap; }
  .name small { display: block; font-weight: 400; color: var(--soft); font-size: 11px; }
  .tag { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 13px; font-weight: 600; }
  .tag.warm { background: #fde3cf; color: #8a3b0c; } .tag.cool { background: #d9e7f7; color: #1f3f6e; }
  .tag.neutral { background: #ece9e6; color: #555; } .tag.mixed { background: linear-gradient(90deg,#fde3cf,#d9e7f7); color: #444; }
  .dots { display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
  .dots i { width: 9px; height: 9px; border-radius: 50%; background: #ece4dc; }
  .dots i.on { background: #b0566f; }
  .dots b { margin-left: 6px; font-weight: 600; font-size: 13px; }
  .raw { font-size: 12px; color: var(--soft); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .note { font-size: 12px; color: #8a3b0c; }
  ul { color: var(--soft); padding-left: 20px; margin: 0; }
</style></head>
<body><main>
<h1>Farbmerkmale der Palette</h1>
<p>Berechnet aus den HEX-Werten der Palette (OKLCH) nach Spec 5.1. Bitte durchschauen: Was fühlt sich falsch an (warm/kühl, zu hell, zu dunkel, zu satt)? Diese Korrekturen kommen in <code>COLOR_TRAIT_OVERRIDES</code>.</p>
<ul>
  <li><b>Neutral</b>: Sättigung (Chroma) unter 0,035. Sonst <b>warm</b> bei Farbton unter 115° oder ab 330°, sonst <b>kühl</b>.</li>
  <li><b>Helligkeit</b>: L unter 0,35 → 1 · 0,50 → 2 · 0,65 → 3 · 0,80 → 4 · sonst 5.</li>
  <li><b>Sättigung</b>: C unter 0,035 → 1 · 0,075 → 2 · 0,11 → 3 · 0,145 → 4 · sonst 5.</li>
  <li>Von Hand gesetzt (vorbelegt): Olivgrün → warm; Pink, Rosa, Magenta → kühl. Rechts stehen Hinweise, wo ein Wert knapp an einer Grenze liegt.</li>
</ul>
<div class="wrap"><table>
<thead><tr><th></th><th>Farbe</th><th>Wirkung</th><th>Helligkeit</th><th>Sättigung</th><th>Messwerte</th><th>Hinweis</th></tr></thead>
<tbody>
${rows}
</tbody></table></div>
<p style="margin-top:16px">Erzeugt mit <code>pnpm farbmerkmale</code> aus <code>packages/core/src/traits.ts</code>.</p>
</main></body></html>
`;

const here = path.dirname(fileURLToPath(import.meta.url));
fs.writeFileSync(path.join(here, 'farb-merkmale.html'), html);
console.log('farb-merkmale.html geschrieben');
