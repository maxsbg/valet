// Baut den Symbol-Katalog (HTML) aus dem Symbol-Pool. Benutzt von erstellen.ts (schreibt die Datei)
// und packages/core/test/symbols.test.ts (prüft, dass symbol-katalog.html zum Code passt).
import { ICON_SIZE, MONO_SIZE, SYMBOL_GROUPS, SYMBOLS, type SymbolDef, type SymbolGroup } from '../../../packages/ui/src/symbols';

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

const MONO_TEXT: Record<keyof typeof MONO_SIZE, string> = {
  text: 'neben 14-px-Text: Infozeile der Wunschlisten-Karte, Kopf einer geöffneten Liste, Balken in der Statistik',
  chip: 'in allen Chips und Kapseln – genau die Plakette der Kachel (20 px, Buchstabe 11 px), konzentrisch (Rand Chip 8, Kapsel 9, hoher Chip 12)',
  row: 'Listenzeile mit zwei Textzeilen (Schrank teilen) – so groß wie ein Wert-Kreis',
  button: 'Profil-Knopf in der Kopfzeile – so groß wie die runden Knöpfe',
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


const mono = (letter: string, px: number, color = '#8E2440') =>
  `<span class="m" style="width:${px}px;height:${px}px;font-size:${Math.round(px * 0.55)}px;color:${color}">${letter}</span>`;
const monos = Object.entries(MONO_SIZE).map(([k, v]) => `<tr><td><code>${k}</code></td><td>${v} px</td><td>${MONO_TEXT[k as keyof typeof MONO_SIZE]}</td></tr>`).join('');

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
  .demo { padding:14px 16px; } .drow { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin:6px 0; }
  .chip, .cap { display:inline-flex; align-items:center; gap:6px; height:36px; padding:0 14px; border:1px solid var(--line); border-radius:99px; font-size:15px; background:#fff; }
  .cap { height:38px; padding:0 13px; gap:7px; font-weight:600; font-size:16px; } .chip.tall { height:44px; padding:0 16px; }
  .chip.mono { padding-left:7px; } .chip.tall.mono { padding-left:11px; } .cap.mono { padding-left:8px; }
  .m { display:inline-flex; align-items:center; justify-content:center; border-radius:50%; background:#fff; box-shadow:inset 0 0 0 1px rgba(42,26,29,.12); font-family:Georgia,serif; flex:none; }
  .txt { gap:6px; font-size:14px; color:var(--muted); }
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

<h2>Monogramme</h2>
<p class="lead">Monogramme stehen an denselben Stellen wie Symbole und haben deshalb ebenfalls feste Stufen. In Chips und Kapseln ist das Monogramm genau die Plakette der Kachel (weiße Scheibe 20 px, Buchstabe 11 px) – so sehen Kapsel und Kachel gleich aus, und die Scheibe wirkt nur so groß wie ein Symbol. Sie sitzt konzentrisch: Rand links = Rand oben und unten.</p>
<div class="card"><table><tr><th>Stufe</th><th>Durchmesser</th><th>Wofür</th></tr>${monos}</table></div>
<div class="card demo">
  <div class="drow"><span class="chip">${svg(SYMBOLS.occSport as SymbolDef, ICON_SIZE.chip)}Sport</span><span class="chip mono">${mono('M', MONO_SIZE.chip)}Max</span><span class="chip tall mono">${mono('P', MONO_SIZE.chip, '#B00E28')}Paul</span></div>
  <div class="drow"><span class="cap">${svg(SYMBOLS.label as SymbolDef, ICON_SIZE.chip)}Etikett</span><span class="cap mono">${mono('M', MONO_SIZE.chip)}Max (du)</span></div>
  <div class="drow txt">${mono('M', MONO_SIZE.text)}<span>Max · 6 Teile · 412 €</span></div>
</div>

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
