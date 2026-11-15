// Baut den Symbol-Katalog (HTML) aus dem Symbol-Pool. Benutzt von erstellen.ts (schreibt die Datei)
// und packages/core/test/symbols.test.ts (prüft, dass symbol-katalog.html zum Code passt).
import { ICON_SIZE, SYMBOL_GROUPS, SYMBOLS, type SymbolDef, type SymbolGroup } from '../../../packages/ui/src/symbols';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function el(x: string): string {
  if (x.startsWith('c:') || x.startsWith('f:')) {
    const [cx, cy, r] = x.slice(2).split(',');
    return `<circle cx="${cx}" cy="${cy}" r="${r}"${x[0] === 'f' ? ' fill="currentColor" stroke="none"' : ''}/>`;
  }
  if (x.startsWith('t:')) {
    const [tx, ty, fs, fw, ...t] = x.slice(2).split(',');
    return `<text x="${tx}" y="${ty}" text-anchor="middle" font-size="${fs}" font-weight="${fw}" fill="currentColor" stroke="none" font-family="-apple-system,Arial,sans-serif">${esc(t.join(','))}</text>`;
  }
  return `<path d="${x}"/>`;
}
function svg(def: SymbolDef, px: number): string {
  const g = def.grid ?? 24;
  return `<svg width="${px}" height="${px}" viewBox="0 0 ${g} ${g}" fill="none" stroke="currentColor" stroke-width="${(2 * g) / 24}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${def.els.map(el).join('')}</svg>`;
}

const SIZE_TEXT: Record<keyof typeof ICON_SIZE, string> = {
  mini: 'X in Mini-Knöpfen (Suche leeren, Teil aus dem Baukasten entfernen)',
  inline: 'Pfeile und kleine Symbole neben Text, Pills auf dem Bild',
  chip: 'Chips und Kapseln – in allen Tabs gleich',
  row: 'Zeilen, Listen, Menüs, Schalter, Blätter-Pfeile',
  button: 'runde Knöpfe: Kopfzeile, Werkzeugleiste, Suche/Sortieren, Pflege-Kreise',
  bar: 'Tab-Leiste und Hauptknopf der Werkzeugleiste',
  large: 'große Einzel-Symbole (Neu-Seite, Neues Set, Geschenk-Karte)',
};

const entries = Object.entries(SYMBOLS) as [string, SymbolDef][];
const groups = Object.keys(SYMBOL_GROUPS) as SymbolGroup[];
const sizes = Object.entries(ICON_SIZE).map(([k, v]) => `<tr><td><code>${k}</code></td><td>${v} px</td><td>${SIZE_TEXT[k as keyof typeof ICON_SIZE]}</td></tr>`).join('');

const sections = groups.map((g) => {
  const list = entries.filter(([, d]) => d.group === g);
  if (!list.length) return '';
  return `<h2>${SYMBOL_GROUPS[g]} <small>${list.length}</small></h2><div class="grid">${list.map(([name, d]) => `
    <div class="sym${d.reserved ? ' res' : ''}"><div class="ics">${svg(d, 36)}${svg(d, 18)}</div>
      <b>${esc(d.meaning)}</b><code>${name}</code>
      <ul>${d.uses.map((u) => `<li>${esc(u)}</li>`).join('')}</ul>
      ${d.reserved ? '<span class="tag">vorgemerkt</span>' : ''}${d.src ? `<span class="tag src">${d.src}</span>` : ''}</div>`).join('')}</div>`;
}).join('');


export function katalogHtml(): string {
  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Valet – Symbol-Katalog</title>
<style>
  :root { --bg:#F5F0E8; --ink:#2a1a1d; --muted:#7a6a6d; --ox:#722638; --card:#fff; --line:#e6ddd0; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.45 -apple-system,"Helvetica Neue",Arial,sans-serif; }
  main { max-width:820px; margin:0 auto; padding:24px 16px 60px; }
  h1 { font-size:28px; margin:0 0 6px; color:var(--ox); }
  h2 { font-size:19px; margin:34px 0 10px; color:var(--ox); } h2 small { color:var(--muted); font-weight:500; font-size:14px; }
  .lead { color:var(--muted); margin:0 0 8px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:18px; padding:6px 16px; margin:10px 0; }
  ol { padding-left:22px; } ol li { margin:8px 0; }
  table { width:100%; border-collapse:collapse; font-size:14px; } td, th { text-align:left; padding:7px 6px; border-bottom:1px solid var(--line); vertical-align:top; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:10px; }
  .sym { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:12px; font-size:13px; }
  .sym.res { border-style:dashed; border-color:var(--ox); }
  .sym .ics { display:flex; align-items:center; gap:12px; margin-bottom:8px; }
  .sym b { display:block; font-size:14px; } .sym code { color:var(--muted); }
  .sym ul { margin:6px 0 0; padding-left:16px; color:var(--muted); } .sym li { margin:2px 0; }
  .tag { display:inline-block; margin:6px 4px 0 0; font-size:11px; font-weight:700; color:#fff; background:var(--ox); border-radius:99px; padding:1px 8px; }
  .tag.src { background:#9a8a8d; }
  code { font:12.5px ui-monospace,Menlo,monospace; }
</style></head><body><main>
<h1>Valet – Symbol-Katalog</h1>
<p class="lead">Alle ${entries.length} Symbole der App mit fester Bedeutung. Erzeugt aus <code>packages/ui/src/symbols.ts</code> – der einzigen Quelle. Stand der Regeln: 15.11.2026.</p>

<h2>Regeln</h2>
<div class="card"><ol>
  <li><b>Eine Quelle.</b> Jedes Symbol der App steht im Pool und wird mit <code>&lt;Icon name="…"/&gt;</code> gezeichnet (Plaketten mit <code>&lt;TileIcon/&gt;</code>, gleiche Formen). Keine Symbole woanders zeichnen, keine Schriftzeichen als Symbol (✓ × + −), keine Icon-Pakete.</li>
  <li><b>Ein Symbol – eine Bedeutung, eine Funktion – ein Symbol.</b> Bei einer neuen Funktion zuerst hier suchen. Passt die Bedeutung, wird die Stelle unter „benutzt für“ ergänzt. Passt nichts, kommt ein neues Symbol nur mit Max' Okay dazu – und es darf keinem vorhandenen ähneln.</li>
  <li><b>Raster 24 × 24, nur Linien.</b> Gefüllt sind nur kleine Punkte (z. B. „…“). Pflegesymbole liegen wegen der Ziffern im 32er-Raster.</li>
  <li><b>Strichstärke 2 – überall,</b> auch auf den Kachel-Plaketten. Keine eigene Strichstärke für einzelne Knöpfe. Im 32er-Raster 2,67 (gleiche Dicke).</li>
  <li><b>Runde Enden, runde Ecken.</b> Rechtecke mit Eckradius 2.</li>
  <li><b>Größe im Raster:</b> hohe Formen 18 hoch, breite höchstens 20 breit, runde und quadratische 18. Optisch mittig (einzige Ausnahme: der Bügel mit seinem festgelegten Versatz).</li>
  <li><b>Richtung durch Drehen.</b> Den Pfeil (Chevron) gibt es nur einmal – nach unten, links usw. wird er gedreht, nicht neu gezeichnet.</li>
  <li><b>Größen in der App nur aus festen Stufen</b> (Tabelle unten). Plaketten auf Kacheln, Outfit-Karten und Detail-Bild haben eigene Maße aus der Kachel-Spec.</li>
  <li><b>Vorgemerkte Symbole</b> (gestrichelt) sind für eine geplante Funktion reserviert und werden für nichts anderes benutzt.</li>
  <li><b>Herkunft</b> wird vermerkt: Formen aus dem freien Icon-Set Lucide sind markiert.</li>
  <li><b>Ein Test</b> (<code>packages/core/test/symbols.test.ts</code>) schlägt Alarm bei gleich gezeichneten Symbolen, bei einer Funktion mit zwei Symbolen, bei Symbolen außerhalb des Pools und bei Schriftzeichen als Symbol.</li>
</ol></div>

<h2>Größen</h2>
<div class="card"><table><tr><th>Stufe</th><th>Größe</th><th>Wofür</th></tr>${sizes}</table></div>

<h2>Bewusst an mehreren Stellen</h2>
<div class="card"><ul>
  <li><b>Schrank</b> – Tab „Schrank“ und Status „Im Schrank“</li>
  <li><b>Bügel</b> – heute getragen, geplant oder reserviert</li>
  <li><b>Geschenk</b> – Wunsch-Kategorie „Gift“ und Eigenschaft „Geschenk“</li>
  <li><b>Kalender</b> – Reservieren, Kauftag planen, Outfit für einen Tag planen (alles „für einen Tag vormerken“)</li>
  <li><b>X, Haken, Plus</b> – Schließen/Entfernen, Fertig/Ausgewählt, Hinzufügen</li>
</ul></div>
${sections}
</main></body></html>`;
}
