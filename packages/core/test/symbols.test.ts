// Wächter über den Symbol-Pool (packages/ui/src/symbols.ts, Regeln: docs/design/symbole/VALET_SYMBOLE.md).
// Schlägt an bei: gleich gezeichneten Symbolen, einer Funktion mit zwei Symbolen, fehlenden Symbolen für
// Status/Anlässe/Wunsch-Kategorien/Pflege/Saison/Oberkategorien, Symbolen außerhalb des Pools in der App
// und Schriftzeichen als Symbol.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORY_ICON, ICON_SIZE, SEASON_ICON, SYMBOLS, type SymbolDef } from '@valet/ui';
import { CARE, CATEGORY_NAMES, OCCASIONS, SEASONS, STATUS_LIST, WISH_TAGS } from '../src/index';

const entries = Object.entries(SYMBOLS) as [string, SymbolDef][];
const names = new Set(entries.map(([n]) => n));

test('kein Symbol ist doppelt gezeichnet', () => {
  const seen = new Map<string, string>();
  for (const [name, d] of entries) {
    const key = d.els.join('|');
    assert.ok(!seen.has(key), `„${name}“ ist genauso gezeichnet wie „${seen.get(key)}“`);
    seen.set(key, name);
  }
});

test('jedes Symbol hat eine Bedeutung und mindestens eine Stelle', () => {
  for (const [name, d] of entries) {
    assert.ok(d.meaning.trim(), `${name}: Bedeutung fehlt`);
    assert.ok(d.uses.length > 0, `${name}: keine Stelle angegeben`);
  }
});

test('jede Funktion hat genau ein Symbol', () => {
  const owner = new Map<string, string>();
  for (const [name, d] of entries) for (const u of d.uses) {
    const k = u.toLowerCase().trim();
    assert.ok(!owner.has(k), `„${u}“ steht bei „${owner.get(k)}“ und bei „${name}“`);
    owner.set(k, name);
  }
});

test('Elemente sind gültig (Pfad, Kreis, Punkt, Text)', () => {
  for (const [name, d] of entries) for (const e of d.els) {
    assert.ok(/^[Mm]/.test(e) || /^[cf]:[\d.-]+,[\d.-]+,[\d.]+$/.test(e) || /^t:/.test(e), `${name}: unbekanntes Element ${e}`);
    if (e.startsWith('t:')) assert.equal(d.grid, 32, `${name}: Text nur im 32er-Raster (Pflege)`);
  }
});

test('Status, Anlässe, Wunsch-Kategorien, Pflege, Saison und Oberkategorien haben ein Symbol', () => {
  for (const s of STATUS_LIST) assert.ok(names.has(s.icon), `Status ${s.label}: ${s.icon}`);
  for (const o of OCCASIONS) assert.ok(names.has(o.icon), `Anlass ${o.label}: ${o.icon}`);
  for (const w of WISH_TAGS) assert.ok(names.has(w.id), `Wunsch-Kategorie ${w.label}`);
  for (const g of CARE) for (const o of g.options) assert.ok(names.has(o.id), `Pflege ${o.id}`);
  for (const s of SEASONS) assert.ok(SEASON_ICON[s] && names.has(SEASON_ICON[s]!), `Saison ${s}`);
  for (const c of CATEGORY_NAMES) assert.ok(CATEGORY_ICON[c] && names.has(CATEGORY_ICON[c]!), `Oberkategorie ${c}`);
});

test('Größen-Stufen bleiben die festgelegten', () => {
  assert.deepEqual(ICON_SIZE, { mini: 12, inline: 16, chip: 18, row: 20, button: 22, bar: 24, large: 28 });
});

// ---------- App-Code ----------
const here = path.dirname(fileURLToPath(import.meta.url));
const appSrc = path.resolve(here, '../../../apps/app/src');
const files = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? files(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []);
const src = files(appSrc).map((f) => ({ f: path.relative(appSrc, f), s: fs.readFileSync(f, 'utf8') }));

// Erlaubte Zeichnungen außerhalb des Pools: der Zeichner selbst, Bedenkzeit-Ring der Plakette, Farbkreise in Bearbeiten
const SVG_ALLOWED = ['components/Icon.tsx', 'components/tile/TileBadge.tsx', 'components/edit/fields.tsx'];

test('Symbole werden nur aus dem Pool gezeichnet', () => {
  for (const { f, s } of src) {
    if (/from 'react-native-svg'/.test(s)) assert.ok(SVG_ALLOWED.includes(f), `${f} zeichnet selbst (react-native-svg) – Symbol in den Pool und <Icon/> benutzen`);
    assert.ok(!/@expo\/vector-icons|lucide-react|expo-symbols/.test(s), `${f}: kein Icon-Paket benutzen`);
  }
});

test('keine Schriftzeichen als Symbol', () => {
  for (const { f, s } of src) {
    const m = s.match(/>\s*[✓✔✕✗×＋−›‹]\s*</);
    assert.ok(!m, `${f}: „${m?.[0]}“ – Symbol aus dem Pool benutzen`);
  }
});

test('Bedienungs-, Tab- und Plaketten-Symbole sind benutzt, vorgemerkte noch nicht', () => {
  const all = src.map((x) => x.s).join('\n');
  for (const [name, d] of entries) {
    if (!['bedienung', 'tab', 'plakette'].includes(d.group)) continue;
    const used = new RegExp(`['"]${name}['"]`).test(all);
    if (d.reserved) assert.ok(!used, `„${name}“ ist vorgemerkt (${d.uses[0]}) und darf noch nicht benutzt werden`);
    else assert.ok(used, `„${name}“ wird nirgends benutzt – entfernen oder vormerken`);
  }
});

test('Symbol-Katalog passt zum Code (sonst: pnpm symbole)', async () => {
  const { katalogHtml } = await import('../../../docs/design/symbole/katalog');
  const file = path.resolve(here, '../../../docs/design/symbole/symbol-katalog.html');
  assert.ok(fs.readFileSync(file, 'utf8') === katalogHtml(),
    'symbol-katalog.html ist veraltet – nach Änderungen am Symbol-Pool im Repo-Hauptordner „pnpm symbole“ ausführen');
});
