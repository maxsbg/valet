// Erzeugt die Prüfseite der Outfit-Zusammenstellung als eine eigenständige HTML-Datei.
// Aufruf: pnpm outfitpruefung <schrank-abzug.json> [ziel.html]
// Der Abzug (Teile aus Supabase) enthält private Daten und gehört NICHT ins Repo; die erzeugte Seite ebenso nicht.

import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const [src, out = resolve(here, 'outfit-pruefung.html')] = process.argv.slice(2);
if (!src) { console.error('Aufruf: pnpm outfitpruefung <schrank-abzug.json> [ziel.html]'); process.exit(1); }

const items = JSON.parse(readFileSync(src, 'utf8'));
const data = {
  items,
  imgBase: 'https://jocjisrmmzzvfnijosgg.supabase.co/storage/v1/object/public/items/',
  stand: new Date().toLocaleDateString('de-DE'),
};
const js = await build({
  entryPoints: [resolve(here, 'seite.ts')], bundle: true, write: false, format: 'iife', target: 'safari16', minify: true,
  alias: { '@valet/core': resolve(here, '../../../packages/core/src/index.ts') },
});

const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Valet – Outfit-Prüfung</title><style>
:root{--ink:#2a1a1d;--ox:#722638;--or:#FF641F;--pink:#EF91B0;--bg:#F5F0E8}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 -apple-system,system-ui,sans-serif;padding:16px;max-width:900px;margin:auto}
h1{color:var(--ox);font-size:24px;margin:4px 0}#stand{color:#7a6a66;font-size:13px;margin:0 0 12px}
.panel{background:#fff;border-radius:18px;padding:14px;display:grid;gap:10px;margin-bottom:12px}
.row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.row label{display:flex;gap:6px;align-items:center}
select,input[type=number]{max-width:100%;font:inherit;padding:6px 8px;border-radius:10px;border:1px solid #ddd;background:#fff}
input[type=range]{accent-color:var(--ox)}#temp{width:180px}
details summary{cursor:pointer;color:var(--ox);font-weight:600}
.w{display:grid;grid-template-columns:150px 1fr 28px;gap:8px;align-items:center;margin:4px 0}
button{font:inherit;font-weight:600;background:var(--or);color:#fff;border:0;border-radius:999px;padding:10px 20px}
#info{font-size:13px}#info p{margin:4px 0}.warn{color:#b03a2e;font-weight:600}
article{background:#fff;border-radius:22px;padding:14px;margin-bottom:12px}
article header{display:flex;gap:10px;align-items:baseline}article header strong{font-size:22px;color:var(--ox)}article header small{color:#7a6a66;margin-left:auto;font-size:12px}
.pieces{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;margin:10px 0}
figure{margin:0;background:var(--bg);border-radius:14px;padding:6px}figure img{width:100%;aspect-ratio:1;object-fit:contain}
.noimg{aspect-ratio:1;display:grid;place-items:center;font-size:11px;text-align:center}
figcaption{font-size:11px;line-height:1.3}figcaption i{display:block;color:var(--ox);font-style:normal;font-weight:600}figcaption small{display:block;color:#7a6a66}
.bars{display:grid;gap:3px}.bar{display:grid;grid-template-columns:150px 1fr 30px;gap:8px;align-items:center;font-size:12px}
.bar div{height:7px;background:#eee;border-radius:9px;overflow:hidden}.bar em{display:block;height:100%;background:var(--pink)}
article ul{margin:8px 0 0;padding-left:18px;font-size:13px}.ok{font-size:13px;color:#4f8a4a;margin:8px 0 0}
</style></head><body>
<h1>Outfit-Prüfung</h1><p id="stand"></p>
<div class="panel">
 <div class="row"><label>Temperatur <input id="temp" type="range" min="-5" max="32" value="8"><b id="tempv">8 °C</b></label></div>
 <div class="row">
  <label>Anlass <select id="occ"></select></label>
  <label>Monat <input id="month" type="number" min="1" max="12" style="width:64px"></label>
  <label>Regen <select id="rain"><option value="none">kein</option><option value="drizzle">Niesel</option><option value="rain">Regen</option><option value="heavy">Starkregen</option></select></label>
 </div>
 <div class="row">
  <label><input id="rainOn" type="checkbox" checked> Regen berücksichtigen</label>
  <label><input id="rainSoft" type="checkbox"> Regen nur 30–49 %</label>
  <label><input id="stored" type="checkbox"> Eingelagerte erlauben</label>
 </div>
 <div class="row"><label>Farbregel <select id="clash"><option value="strong">zwei kräftige Farben (entschieden)</option><option value="warmcool">warm/kühl (alt)</option><option value="both">beide</option><option value="off">aus</option></select></label>
  <label><input id="navy" type="checkbox"> Navy + Schwarz als „fast gleich“</label></div>
 <details><summary>Gewichte</summary><div id="weights"></div></details>
 <div class="row"><button id="roll">20 Outfits würfeln</button></div>
 <div id="info"></div>
</div>
<div id="list"></div>
<script>const DATA=${JSON.stringify(data).replace(/</g, '\\u003c')};</script>
<script>${js.outputFiles[0]!.text}</script>
</body></html>`;
writeFileSync(out, html);
console.log('geschrieben:', out, `(${Math.round(html.length / 1024)} KB)`);
