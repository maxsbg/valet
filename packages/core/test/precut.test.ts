import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzePrecut, distanceToCore, borderClear, alphaBox } from '../src/precut';

// Künstliche Bilder: Teil = deckendes Rechteck, Kante 1 px halbtransparent, Schatten = breiter halbtransparenter Hof.
const W = 200, H = 200;
function make(fn: (x: number, y: number) => number): Uint8Array {
  const a = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) a[y * W + x] = fn(x, y);
  return a;
}
const inside = (x: number, y: number) => x >= 60 && x < 140 && y >= 50 && y < 150;
const edge = (x: number, y: number) => !inside(x, y) && x >= 59 && x < 141 && y >= 49 && y < 151;

test('normales Foto (deckender Rand) → Modell', () => {
  const r = analyzePrecut(make(() => 255), W, H);
  assert.equal(r.kind, 'photo');
  assert.equal(r.box, null);
});

test('sauber freigestellt → nur zuschneiden, Alpha unverändert', () => {
  const a = make((x, y) => (inside(x, y) ? 255 : edge(x, y) ? 120 : 0));
  const r = analyzePrecut(a, W, H);
  assert.equal(r.kind, 'clean');
  assert.deepEqual(r.box, { x0: 59, y0: 49, x1: 141, y1: 151 });
  assert.deepEqual([...r.alpha], [...a]);
});

test('mit Schatten → Schatten weg, Teil + Saum bleiben', () => {
  // Schatten rechts unten, bis 40 px vom Teil entfernt
  const a = make((x, y) => (inside(x, y) ? 255 : edge(x, y) ? 140 : x >= 60 && x < 180 && y >= 50 && y < 190 ? 60 : 0));
  const r = analyzePrecut(a, W, H);
  assert.equal(r.kind, 'shadow');
  assert.ok(r.info.share > 0.3);
  assert.equal(r.alpha[170 * W + 170], 0, 'Schatten entfernt');
  assert.equal(r.alpha[100 * W + 100], 255, 'Teil bleibt');
  assert.equal(r.alpha[100 * W + 140], 140, 'Saum bleibt');
  // Ausschnitt nur noch ums Teil (+ Saum)
  assert.ok(r.box!.x1 <= 143 && r.box!.y1 <= 153);
});

test('fast nichts Deckendes (sehr durchscheinend) → lieber Modell', () => {
  const r = analyzePrecut(make((x, y) => (inside(x, y) ? 100 : 0)), W, H);
  assert.equal(r.kind, 'photo');
});

test('Hilfsfunktionen', () => {
  const a = make((x, y) => (inside(x, y) ? 255 : 0));
  assert.equal(borderClear(a, W, H), 1);
  assert.deepEqual(alphaBox(a, W, H), { x0: 60, y0: 50, x1: 140, y1: 150 });
  const d = distanceToCore(a, W, H);
  assert.equal(d[100 * W + 100], 0);
  assert.equal(d[100 * W + 145], 6); // 6 px rechts vom Teil
});
