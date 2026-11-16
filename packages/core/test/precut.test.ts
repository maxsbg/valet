import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzePrecut, distanceToCore, borderClear, alphaBox } from '../src/precut';

// Künstliche Bilder: Teil = deckendes Rechteck, Kante 1 px halbtransparent, Schatten = breiter schwarzer Hof.
const W = 200, H = 200;
type Px = [number, number, number, number];
const CLOTH: Px = [200, 170, 120, 255], NONE: Px = [0, 0, 0, 0];
function make(fn: (x: number, y: number) => Px): Uint8ClampedArray {
  const a = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) a.set(fn(x, y), (y * W + x) * 4);
  return a;
}
const inside = (x: number, y: number) => x >= 60 && x < 140 && y >= 50 && y < 150;
const edge = (x: number, y: number) => !inside(x, y) && x >= 59 && x < 141 && y >= 49 && y < 151;
const alphaAt = (d: Uint8ClampedArray, x: number, y: number) => d[(y * W + x) * 4 + 3];
const cloth = (a: number, c: Px = CLOTH): Px => [c[0], c[1], c[2], a];

test('normales Foto (deckender Rand) → Modell', () => {
  const r = analyzePrecut(make(() => CLOTH), W, H);
  assert.equal(r.kind, 'photo');
  assert.equal(r.box, null);
});

test('sauber freigestellt → nur zuschneiden, Bild unverändert', () => {
  const a = make((x, y) => (inside(x, y) ? CLOTH : edge(x, y) ? cloth(120) : NONE));
  const r = analyzePrecut(a, W, H);
  assert.equal(r.kind, 'clean');
  assert.deepEqual(r.box, { x0: 59, y0: 49, x1: 141, y1: 151 });
  assert.equal(r.data, a);
});

test('mit Schatten → Schatten weg, Teil bleibt, Kante ohne dunklen Rand', () => {
  // Schatten (schwarz, Alpha 60) rechts unten, bis 40 px vom Teil entfernt.
  // Kante dort: halbe Stoffdeckung über dem Schatten → Alpha 0,5 + 0,5·60/255, Farbe abgedunkelt.
  const s = 60 / 255, A = 0.5 + 0.5 * s, k = 0.5 / A;
  const mixed: Px = [Math.round(CLOTH[0] * k), Math.round(CLOTH[1] * k), Math.round(CLOTH[2] * k), Math.round(A * 255)];
  const inShadow = (x: number, y: number) => x >= 60 && x < 180 && y >= 50 && y < 190;
  const a = make((x, y) => (inside(x, y) ? CLOTH : edge(x, y) ? (inShadow(x, y) ? mixed : cloth(128)) : inShadow(x, y) ? [0, 0, 0, 60] : NONE));
  const r = analyzePrecut(a, W, H);
  assert.equal(r.kind, 'shadow');
  assert.ok(r.info.share > 0.3);
  assert.equal(alphaAt(r.data, 170, 170), 0, 'Schatten entfernt');
  assert.equal(alphaAt(r.data, 143, 100), 0, 'Schatten direkt neben der Kante entfernt');
  assert.equal(alphaAt(r.data, 100, 100), 255, 'Teil bleibt');
  // Kante am Schatten: Stoff-Anteil zurückgerechnet (≈ 50 % von 255, wegen der 15 % Toleranz etwas mehr), Farbe = Stoff
  const o = (100 * W + 140) * 4;
  assert.ok(r.data[o + 3]! > 110 && r.data[o + 3]! < 165, `Kante ${r.data[o + 3]}`);
  assert.deepEqual([...r.data.slice(o, o + 3)], [200, 170, 120]);
  // Kante ohne Schatten daneben (links oben) bleibt original
  assert.equal(alphaAt(r.data, 59, 60), 128);
  assert.ok(r.box!.x1 <= 142 && r.box!.y1 <= 152);
  assert.notEqual(r.data, a, 'Original bleibt unangetastet');
});

test('farbiger durchscheinender Stoff (kein Schatten) → bleibt, wie er ist', () => {
  // breiter halbtransparenter roter Bereich, z. B. Mesh
  const a = make((x, y) => (inside(x, y) ? CLOTH : x >= 60 && x < 180 && y >= 50 && y < 190 ? [200, 30, 40, 90] : NONE));
  const r = analyzePrecut(a, W, H);
  assert.equal(r.kind, 'clean');
  assert.equal(alphaAt(r.data, 170, 170), 90);
});

test('dunkles Teil mit Schatten → Schatten weg, 1 px Saum bleibt', () => {
  const BLACK: Px = [20, 20, 22, 255];
  const a = make((x, y) => (inside(x, y) ? BLACK : x >= 55 && x < 180 && y >= 45 && y < 190 ? [0, 0, 0, 70] : NONE));
  const r = analyzePrecut(a, W, H);
  assert.equal(r.kind, 'shadow');
  assert.equal(alphaAt(r.data, 140, 100), 70, '1 px Saum');
  assert.equal(alphaAt(r.data, 142, 100), 0);
  assert.equal(alphaAt(r.data, 170, 170), 0);
});

test('fast nichts Deckendes (sehr durchscheinend) → lieber Modell', () => {
  const r = analyzePrecut(make((x, y) => (inside(x, y) ? cloth(100) : NONE)), W, H);
  assert.equal(r.kind, 'photo');
});

test('Hilfsfunktionen', () => {
  const a = make((x, y) => (inside(x, y) ? CLOTH : NONE));
  assert.equal(borderClear(a, W, H), 1);
  assert.deepEqual(alphaBox(a, W, H), { x0: 60, y0: 50, x1: 140, y1: 150 });
  const { d, near } = distanceToCore(a, W, H);
  assert.equal(d[100 * W + 100], 0);
  assert.equal(d[100 * W + 145], 6); // 6 px rechts vom Teil
  assert.equal(near[100 * W + 145], 100 * W + 139);
});
