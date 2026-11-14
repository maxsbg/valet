// Erstellt docs/design/kachel/pruefung/kachel-pruefung.html: die echte App-Kachel mit denselben Fällen
// wie valet-kachel-referenz.html, als eigenständige HTML-Datei (Fotos und Gloock eingebettet).
// Die Prüfseite gehört NICHT zur App: Das Skript legt sie nur während des Bauens kurz in die App und
// räumt danach wieder auf.
//
// Aufruf (im Repo-Hauptordner):  node docs/design/kachel/pruefung/erstellen.mjs
// Braucht Playwright mit Chromium (in der Claude-Umgebung vorhanden).

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const app = path.join(root, 'apps/app');
const route = path.join(app, 'src/app/kachel-test.tsx');
const pub = path.join(app, 'public/kachel-test');
const layoutFile = path.join(app, 'src/app/_layout.tsx');
const dist = path.join(app, 'dist');
const out = path.join(here, 'kachel-pruefung.html');

const layoutOrig = fs.readFileSync(layoutFile, 'utf8');

function patchLayout(s) {
  const steps = [
    ["import { Slot, Stack } from 'expo-router';", "import { Slot, Stack, usePathname } from 'expo-router';"],
    ['  const t = useTheme();\n  // Einladungslink', '  const t = useTheme();\n  const path = usePathname();\n  // Einladungslink'],
    ['  if (!session) return <Login />;', "  if (!session && path !== '/kachel-test') return <Login />;"],
  ];
  for (const [a, b] of steps) {
    if (!s.includes(a)) throw new Error(`_layout.tsx hat sich geändert, Stelle nicht gefunden: ${a}`);
    s = s.replace(a, b);
  }
  return s;
}

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const fileFor = (url) => path.join(dist, decodeURIComponent(url.split('?')[0]).replace(/^\/valet/, ''));

try {
  // 1) Prüfseite und Fotos vorübergehend in die App legen
  fs.copyFileSync(path.join(here, 'KachelTest.tsx'), route);
  fs.mkdirSync(pub, { recursive: true });
  for (const f of fs.readdirSync(path.join(here, 'bilder'))) fs.copyFileSync(path.join(here, 'bilder', f), path.join(pub, f));
  fs.writeFileSync(layoutFile, patchLayout(layoutOrig));

  // 2) Web-Build
  execSync('pnpm build:web', { cwd: app, stdio: 'inherit' });
} finally {
  // 3) Aufräumen: App wieder ohne Prüfseite
  fs.writeFileSync(layoutFile, layoutOrig);
  fs.rmSync(route, { force: true });
  fs.rmSync(pub, { recursive: true, force: true });
}

// 4) Gebaute Seite öffnen und als eigenständige HTML-Datei sichern
const server = http.createServer((q, r) => {
  let f = fileFor(q.url);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html');
  r.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
}).listen(0);
const port = server.address().port;

const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch();
let html;
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 2200 } });
  await page.goto(`http://localhost:${port}/valet/kachel-test`);
  await page.waitForFunction(() => document.querySelectorAll('[role=button]').length >= 43, null, { timeout: 30000 });
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(500);
  // react-native-web und expo-font schreiben ihre Regeln per CSSOM (insertRule) – die stehen nicht im HTML-Text.
  // Deshalb alle Regeln einsammeln und als eigenen <style>-Block ablegen.
  html = await page.evaluate(() => {
    const css = [...document.styleSheets].map((sh) => { try { return [...sh.cssRules].map((r) => r.cssText).join('\n'); } catch { return ''; } }).join('\n');
    for (const st of document.querySelectorAll('style')) st.remove();
    const tag = document.createElement('style');
    tag.textContent = css;
    document.head.appendChild(tag);
    return '<!doctype html>\n' + document.documentElement.outerHTML;
  });
} finally {
  await browser.close();
  server.close();
}

// Skripte raus (statisches Abbild), Fotos und Schrift einbetten
html = html.replace(/<script\b[\s\S]*?<\/script>/g, '');
html = html.replace(/\/valet\/[^"')\s&]+\.(?:jpg|png|ttf)/g, (url) => {
  const f = fileFor(url);
  if (!fs.existsSync(f)) return url;
  return `data:${types[path.extname(f)]};base64,${fs.readFileSync(f).toString('base64')}`;
});
fs.writeFileSync(out, html);
console.log(`geschrieben: ${path.relative(root, out)} (${Math.round(html.length / 1024)} KB)`);
