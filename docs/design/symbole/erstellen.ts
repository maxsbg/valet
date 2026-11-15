// Erstellt docs/design/symbole/symbol-katalog.html aus dem Symbol-Pool (packages/ui/src/symbols.ts):
// Regeln + alle Symbole mit Bedeutung und erlaubten Stellen. Eigenständige HTML-Datei für Max.
// Aufruf im Repo-Hauptordner:  pnpm symbole   (nach jeder Änderung am Pool – sonst schlägt symbols.test.ts an)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { katalogHtml } from './katalog';

const here = path.dirname(fileURLToPath(import.meta.url));
fs.writeFileSync(path.join(here, 'symbol-katalog.html'), katalogHtml());
console.log('symbol-katalog.html geschrieben');
