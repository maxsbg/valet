import { test } from 'node:test';
import assert from 'node:assert/strict';
import { glowFor, glowColorName, glowShadow, GLOW_COLOR_RANK, GLOW_NEUTRAL_RANK } from '../src/glow';
import { COLORS, MULTICOLOR } from '../src/attributes';

// Regeln: docs/design/kachel/VALET_SCHEIN_REGELN.md (16.11.2026)

test('Ranglisten decken genau alle Palettenfarben ab (inkl. Bunt), ohne Doppelungen', () => {
  const all = COLORS.flatMap((c) => [c.key, ...c.nuances.map((n) => n.key)]);
  const ranked = [...GLOW_COLOR_RANK, ...GLOW_NEUTRAL_RANK];
  assert.equal(new Set(ranked).size, ranked.length);
  assert.deepEqual([...ranked].sort(), [...all].sort());
  assert.ok(GLOW_COLOR_RANK.includes(MULTICOLOR));
});

test('Regel 1: Rang 1 farbig → Rang 1, auch wenn eine stärkere Farbe folgt', () => {
  assert.equal(glowColorName(['yellow', 'blue']), 'yellow'); // Flanellhemd
  assert.equal(glowColorName(['rose', 'ivory']), 'rose');
});

test('Regel 2: Rang 1 neutral → farbige Farbe gewinnt immer, bei mehreren nach Rangliste', () => {
  assert.equal(glowColorName(['white', 'red']), 'red');
  assert.equal(glowColorName(['black', 'yellow']), 'yellow');
  assert.equal(glowColorName(['dark_grey', 'rose']), 'rose');             // Rosa schlägt Schwarz/Grau immer
  assert.equal(glowColorName(['ivory', 'navy']), 'navy');
  assert.equal(glowColorName(['black', 'ivory', 'red']), 'red');
  assert.equal(glowColorName(['beige', 'brown']), 'brown');
  assert.equal(glowColorName(['white', 'sky_blue', 'red']), 'red');      // Rot steht vor Himmelblau
});

test('Regel 3: nur Neutralfarben → Neutral-Rangliste (Silber vor Schwarz vor Weiß)', () => {
  assert.equal(glowColorName(['white', 'silver', 'black']), 'silver');
  assert.equal(glowColorName(['black', 'silver']), 'silver');
  assert.equal(glowColorName(['black', 'beige']), 'beige');
  assert.equal(glowColorName(['black', 'white']), 'black');
  assert.equal(glowColorName(['charcoal', 'black']), 'charcoal');
  assert.equal(glowColorName(['sand', 'beige']), 'beige');
  assert.equal(glowColorName(['sand', 'sage']), 'sage');               // Akzent schlägt Neutral
  assert.equal(glowColorName(['white']), 'white');
});

test('ohne Steckbrief-Farben: nächste Palettenfarbe zur Foto-Farbe, sonst keine', () => {
  assert.equal(glowColorName([], '#c0392b'), 'red');
  assert.equal(glowColorName(['Quatsch'], '#1c1c1c'), 'black');
  assert.equal(glowColorName(null, null), null);
});

test('Stärke immer 60 %; Weiß und „keine Farbe“ → heller Ersatzton', () => {
  assert.equal(glowFor(['red']).css, 'rgba(192,57,43,0.6)');
  assert.equal(glowFor(['black']).css, 'rgba(28,28,28,0.6)');
  assert.equal(glowFor(['white']).css, 'rgba(216,210,200,0.6)');
  assert.equal(glowFor([]).css, 'rgba(216,210,200,0.6)');
});

test('Bunt → Farbkreis am Rand (kein box-shadow), Ersatz-CSS hell', () => {
  const g = glowFor(['multicolor', 'black']);
  assert.equal(g.kind, 'multicolor');
  assert.equal(glowShadow(g, 22, 3), 'none');
  assert.equal(glowFor(['white', 'multicolor']).kind, 'multicolor'); // Bunt steht ganz oben
  assert.equal(glowShadow(glowFor(['red']), 22, 3), 'inset 0 0 22px 3px rgba(192,57,43,0.6)');
});
