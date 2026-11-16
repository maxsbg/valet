import { test } from 'node:test';
import assert from 'node:assert/strict';
import { glowFor, glowColorName, glowShadow, GLOW_COLOR_RANK, GLOW_NEUTRAL_RANK } from '../src/glow';
import { COLORS, MULTICOLOR } from '../src/attributes';

// Regeln: docs/design/kachel/VALET_SCHEIN_REGELN.md (16.11.2026)

test('Ranglisten decken genau alle Palettenfarben ab (inkl. Bunt), ohne Doppelungen', () => {
  const all = COLORS.flatMap((c) => [c.name, ...c.nuances.map((n) => n.name)]);
  const ranked = [...GLOW_COLOR_RANK, ...GLOW_NEUTRAL_RANK];
  assert.equal(new Set(ranked).size, ranked.length);
  assert.deepEqual([...ranked].sort(), [...all].sort());
  assert.ok(GLOW_COLOR_RANK.includes(MULTICOLOR));
});

test('Regel 1: Rang 1 farbig → Rang 1, auch wenn eine stärkere Farbe folgt', () => {
  assert.equal(glowColorName(['Gelb', 'Blau']), 'Gelb'); // Flanellhemd
  assert.equal(glowColorName(['Rosa', 'Elfenbein']), 'Rosa');
});

test('Regel 2: Rang 1 neutral → farbige Farbe gewinnt immer, bei mehreren nach Rangliste', () => {
  assert.equal(glowColorName(['Weiß', 'Rot']), 'Rot');
  assert.equal(glowColorName(['Schwarz', 'Gelb']), 'Gelb');
  assert.equal(glowColorName(['Dunkelgrau', 'Rosa']), 'Rosa');             // Rosa schlägt Schwarz/Grau immer
  assert.equal(glowColorName(['Elfenbein', 'Marineblau']), 'Marineblau');
  assert.equal(glowColorName(['Schwarz', 'Elfenbein', 'Rot']), 'Rot');
  assert.equal(glowColorName(['Beige', 'Braun']), 'Braun');
  assert.equal(glowColorName(['Weiß', 'Himmelblau', 'Rot']), 'Rot');      // Rot steht vor Himmelblau
});

test('Regel 3: nur Neutralfarben → Neutral-Rangliste (Silber vor Schwarz vor Weiß)', () => {
  assert.equal(glowColorName(['Weiß', 'Silber', 'Schwarz']), 'Silber');
  assert.equal(glowColorName(['Schwarz', 'Silber']), 'Silber');
  assert.equal(glowColorName(['Schwarz', 'Beige']), 'Beige');
  assert.equal(glowColorName(['Schwarz', 'Weiß']), 'Schwarz');
  assert.equal(glowColorName(['Weiß']), 'Weiß');
});

test('ohne Steckbrief-Farben: nächste Palettenfarbe zur Foto-Farbe, sonst keine', () => {
  assert.equal(glowColorName([], '#c0392b'), 'Rot');
  assert.equal(glowColorName(['Quatsch'], '#1c1c1c'), 'Schwarz');
  assert.equal(glowColorName(null, null), null);
});

test('Stärke immer 60 %; Weiß und „keine Farbe“ → heller Ersatzton', () => {
  assert.equal(glowFor(['Rot']).css, 'rgba(192,57,43,0.6)');
  assert.equal(glowFor(['Schwarz']).css, 'rgba(28,28,28,0.6)');
  assert.equal(glowFor(['Weiß']).css, 'rgba(216,210,200,0.6)');
  assert.equal(glowFor([]).css, 'rgba(216,210,200,0.6)');
});

test('Bunt → Farbkreis am Rand (kein box-shadow), Ersatz-CSS hell', () => {
  const g = glowFor(['Bunt', 'Schwarz']);
  assert.equal(g.kind, 'bunt');
  assert.equal(glowShadow(g, 22, 3), 'none');
  assert.equal(glowFor(['Weiß', 'Bunt']).kind, 'bunt'); // Bunt steht ganz oben
  assert.equal(glowShadow(glowFor(['Rot']), 22, 3), 'inset 0 0 22px 3px rgba(192,57,43,0.6)');
});
