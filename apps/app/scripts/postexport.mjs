// Nach `expo export`: Seite für GitHub Pages vorbereiten (Sprache, iPhone-Startbildschirm, Unterseiten, kein Jekyll).
import { readFileSync, writeFileSync } from 'node:fs';
const f = 'dist/index.html';
const baseUrl = (process.env.VALET_BASE_URL || '/valet').replace(/\/$/, '');
let h = readFileSync(f, 'utf8')
  .replace(/<meta name="theme-color" content="[^"]*">/, '')
  .replace('<html lang="en">', '<html lang="de">')
  .replace('</head>', [
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-title" content="Valet">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
    `<link rel="apple-touch-icon" href="${baseUrl}/apple-touch-icon.png">`,
    '<meta name="theme-color" content="#F5F0E8" media="(prefers-color-scheme: light)">',
    '<meta name="theme-color" content="#17110F" media="(prefers-color-scheme: dark)">',
    '<style>html,body{background:#F5F0E8;height:auto!important;min-height:100%;overflow:visible!important;overscroll-behavior-y:none}@media (prefers-color-scheme:dark){html,body{background:#17110F}}#root{height:auto!important;min-height:100dvh}</style>',
    '</head>',
  ].join(''));
h = h.replace('content="width=device-width, initial-scale=1, shrink-to-fit=no"', 'content="width=device-width, initial-scale=1, viewport-fit=cover"');
writeFileSync(f, h);
writeFileSync('dist/404.html', h);
writeFileSync('dist/.nojekyll', '');
console.log('postexport ok');
