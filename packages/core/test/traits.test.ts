import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STYLES } from '../src/attributes';
import { emptyProfile } from '../src/ai/profile';
import {
  COLOR_TRAIT_OVERRIDES, STYLE_FORMALITY, colorCheck, colorTrait, colorTraits, hexToOklch, matchTraits, paletteKeys, type MatchItem,
} from '../src/traits';

const near = (a: number, b: number, eps: number, msg: string) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} ≠ ${b}`);

test('OKLCH: Weiß, Schwarz und ein bekannter Wert', () => {
  const w = hexToOklch('#ffffff')!;
  near(w.L, 1, 1e-3, 'L Weiß'); near(w.C, 0, 1e-3, 'C Weiß');
  near(hexToOklch('#000')!.L, 0, 1e-6, 'L Schwarz');
  const red = hexToOklch('#ff0000')!; // Referenz OKLCH(0.628 0.258 29.2)
  near(red.L, 0.628, 0.002, 'L Rot'); near(red.C, 0.258, 0.002, 'C Rot'); near(red.h, 29.2, 0.5, 'h Rot');
  assert.equal(hexToOklch(''), null);
  assert.equal(hexToOklch('blau'), null);
});

// Grenzfälle aus Spec 5.1, gerechnet aus den HEX-Werten in COLORS. Ändert sich ein HEX-Wert, schlägt das bewusst fehl.
const CASES: [key: string, L: number, C: number, h: number | null, temp: string, light: number, chroma: number][] = [
  ['black', 0.23, 0, null, 'neutral', 1, 1],
  ['navy', 0.31, 0.072, 265, 'cool', 1, 2],
  ['ivory', 0.93, 0.028, null, 'neutral', 5, 1],
  ['taupe', 0.61, 0.028, null, 'neutral', 3, 1],
  ['beige', 0.84, 0.047, 82, 'warm', 5, 2],
  ['camel', 0.67, 0.09, 69, 'warm', 4, 3],
  ['brown', 0.44, 0.057, 56, 'warm', 2, 2],
  ['khaki', 0.66, 0.07, 102, 'warm', 4, 2],
  ['olive', 0.55, 0.088, 121, 'warm', 3, 3],
  ['silver', 0.799, 0.01, null, 'neutral', 4, 1],
  ['magenta', 0.54, 0.212, 353, 'cool', 3, 5],
  ['pink', 0.7, 0.133, 357, 'cool', 4, 4],
  ['rose', 0.84, 0.072, 1, 'cool', 5, 2],
];

test('colorTrait: Grenzfälle aus Spec 5.1', () => {
  for (const [key, L, C, h, temp, light, chroma] of CASES) {
    const t = colorTrait(key)!;
    assert.ok(t, key);
    near(t.L, L, key === 'silver' ? 0.0015 : 0.006, `${key} L`);
    near(t.C, C, 0.0015, `${key} C`);
    if (h != null) near(t.h, h, 1, `${key} h`);
    assert.equal(t.temperature, temp, `${key} temperature`);
    assert.equal(t.lightness, light, `${key} lightness`);
    assert.equal(t.chroma, chroma, `${key} chroma`);
  }
});

test('Overrides: nur temperature; Olivgrün wäre sonst kühl, Pink/Rosa/Magenta sonst warm; Altrosa bleibt warm', () => {
  assert.deepEqual(Object.keys(COLOR_TRAIT_OVERRIDES).sort(), ['magenta', 'olive', 'pink', 'rose']);
  const olive = colorTrait('olive')!;
  assert.ok(olive.h >= 115 && olive.h < 330 && olive.override); // ohne Override „cool“
  for (const k of ['pink', 'rose', 'magenta']) { const t = colorTrait(k)!; assert.ok((t.h < 115 || t.h >= 330) && t.override, k); }
  assert.equal(colorTrait('dusty_rose')!.temperature, 'warm');
  assert.equal(colorTrait('dusty_rose')!.override, false);
});

test('colorTrait: Bunt und Unbekanntes → null; jede andere Palettenfarbe hat Werte 1–5', () => {
  assert.equal(colorTrait('multicolor'), null);
  assert.equal(colorTrait('gibtsnicht'), null);
  for (const k of paletteKeys()) {
    if (k === 'multicolor') continue;
    const t = colorTrait(k)!;
    assert.ok(t, k);
    assert.ok(t.lightness >= 1 && t.lightness <= 5 && t.chroma >= 1 && t.chroma <= 5, k);
    assert.equal(t.neutral, t.temperature === 'neutral', k);
  }
});

test('colorTraits: Fälle aus Spec 13', () => {
  const bw = colorTraits(['black', 'white'])!;
  assert.equal(bw.contrast, 5); assert.equal(bw.distribution, 'neutral_contrast'); assert.equal(bw.temperature, 'neutral');
  assert.equal(colorTraits(['black', 'dark_grey', 'white'])!.distribution, 'neutral_contrast');
  assert.equal(colorTraits(['navy', 'blue'])!.distribution, 'tonal');
  const navy = colorTraits(['navy'])!;
  assert.deepEqual(navy, { temperature: 'cool', lightness: 1, chroma: 2, contrast: 1, distribution: 'solid' });
  assert.equal(colorTraits(['camel', 'navy'])!.temperature, 'mixed');
  assert.equal(colorTraits([]), null);
  assert.equal(colorTraits(null), null);
  const bunt = colorTraits(['multicolor'])!;
  assert.equal(bunt.temperature, 'mixed'); assert.equal(bunt.distribution, 'multicolor');
  assert.equal(bunt.lightness, 3); assert.equal(bunt.chroma, 5);
});

test('colorTraits: Gewichtung nach Rang, Prüfreihenfolge, Neutrale ignoriert', () => {
  // 2 Farben 0,7/0,3: Schwarz (1) + Weiß (5) → 2,2 → 2
  assert.equal(colorTraits(['black', 'white'])!.lightness, 2);
  // 3 Farben 0,6/0,3/0,1: Weiß 5, Schwarz 1, Weiß 5 … hier Weiß, Schwarz, Hellgrau (5) → 3+0,3+0,5 = 3,8 → 4
  assert.equal(colorTraits(['white', 'black', 'light_grey'])!.lightness, 4);
  // Neutrale ändern die Temperatur nicht
  assert.equal(colorTraits(['navy', 'white'])!.temperature, 'cool');
  assert.equal(colorTraits(['camel', 'beige'])!.temperature, 'warm');
  // Neutrale mit wenig Kontrast → nicht neutral_contrast; Weiß/Elfenbein ΔL < 0,15 → tonal
  assert.equal(colorTraits(['white', 'ivory'])!.distribution, 'tonal');
  // Zwei Familien mit großem Helligkeitsabstand → multicolor
  assert.equal(colorTraits(['red', 'white'])!.distribution, 'multicolor');
  // Bunt gewinnt auch neben anderen Farben, zählt als warm + kühl
  const mix = colorTraits(['multicolor', 'black'])!;
  assert.equal(mix.distribution, 'multicolor'); assert.equal(mix.temperature, 'mixed'); assert.equal(mix.contrast, 1);
  // Labels werden tolerant gelesen
  assert.equal(colorTraits(['Marineblau'])!.temperature, 'cool');
});

test('STYLE_FORMALITY deckt alle Stile ab, Bereiche gültig', () => {
  assert.deepEqual(Object.keys(STYLE_FORMALITY).sort(), STYLES.map((s) => s.key).sort());
  for (const [k, [lo, hi]] of Object.entries(STYLE_FORMALITY)) assert.ok(lo >= 1 && hi <= 5 && lo <= hi, k);
});

const item = (over: Partial<MatchItem> = {}): MatchItem => ({
  category: 'top', subcategory: 'sweater', colors: ['navy'], pattern: 'solid', materials: ['wool'], layers: [], fit: null, styles: [], analysis: null, ...over,
});

test('matchTraits: ohne Profil → partial, Ersatzwerte, keine Ausnahme', () => {
  const m = matchTraits(item());
  assert.equal(m.partial, true);
  assert.deepEqual(m.formality, [2, 3]);
  assert.equal(m.presence, 2); assert.equal(m.weight, 3); assert.equal(m.texture, 3);
  assert.equal(m.layerRole, null); assert.equal(m.statement, false);
  assert.equal(m.color?.distribution, 'solid');
  assert.doesNotThrow(() => matchTraits({ ...item(), colors: null, materials: null, layers: null, styles: null, analysis: { profile: 'kaputt' } }));
});

test('matchTraits: Lagen → Rolle (höchste gewinnt)', () => {
  assert.equal(matchTraits(item({ layers: [0] })).layerRole, 'base');
  assert.equal(matchTraits(item({ layers: [0, 1] })).layerRole, 'mid');
  assert.equal(matchTraits(item({ layers: [2] })).layerRole, 'mid');
  assert.equal(matchTraits(item({ layers: [3] })).layerRole, 'outer');
  assert.equal(matchTraits(item({ layers: [1, 3] })).layerRole, 'outer');
});

test('matchTraits: Ersatz-Formalität = Hülle der Stile, Ersatz-Auffälligkeit', () => {
  assert.deepEqual(matchTraits(item({ styles: ['casual', 'classic'] })).formality, [1, 4]);
  assert.deepEqual(matchTraits(item({ styles: ['formal'] })).formality, [4, 5]);
  assert.equal(matchTraits(item({ pattern: 'striped' })).presence, 3);
  assert.equal(matchTraits(item({ colors: ['red'] })).presence, 4); // Chroma 5
  const bunt = matchTraits(item({ colors: ['multicolor'] }));
  assert.equal(bunt.presence, 4); assert.equal(bunt.statement, true);
});

test('matchTraits: Profil-Werte gewinnen; nur aktive Felder zählen', () => {
  const profile = { ...emptyProfile(), formality: [3, 5], presence: 2, visual_weight: 4, texture_intensity: 1, pattern_contrast: 5 };
  const m = matchTraits(item({ analysis: { profile, vdesc: 'alt' } }));
  assert.deepEqual(m.formality, [3, 5]);
  assert.equal(m.presence, 2); assert.equal(m.weight, 4); assert.equal(m.texture, 1);
  assert.equal(m.partial, false);
  assert.equal(m.statement, false); // pattern_contrast gilt bei Unifarben nicht
  assert.equal(matchTraits(item({ pattern: 'striped', analysis: { profile } })).statement, true);
  assert.equal(matchTraits(item({ analysis: { profile: { ...profile, presence: 4 } } })).statement, true);
});

test('colorCheck: Rang 1 farbig und Foto-Farbton > 60° daneben → true', () => {
  const blue = [{ h: '#2d5fa8', s: 0.7 }, { h: '#f0f0f0', s: 0.3 }];
  assert.equal(colorCheck(['red'], blue), true);           // KI „Rot“, Foto eindeutig blau
  assert.equal(colorCheck(['blue'], blue), false);         // passt
  assert.equal(colorCheck(['navy'], blue), false);         // gleiche Richtung
  assert.equal(colorCheck(['black'], blue), false);        // Rang 1 neutral
  assert.equal(colorCheck(['multicolor'], blue), false);   // Bunt hat keinen Farbton
  assert.equal(colorCheck([], blue), false);
  assert.equal(colorCheck(['red'], []), false);
  assert.equal(colorCheck(['red'], null), false);
  // Neutrale Foto-Farben zählen nicht: grauer Schatten mit großem Anteil, Stoff rot
  assert.equal(colorCheck(['red'], [{ h: '#777777', s: 0.6 }, { h: '#c0392b', s: 0.4 }]), false);
  // nur neutrale Foto-Farben → keine Aussage
  assert.equal(colorCheck(['red'], [{ h: '#222222', s: 1 }]), false);
  // über 0°/360° hinweg: Magenta (353°) gegen Rot (≈ 29°) liegt unter 60°
  assert.equal(colorCheck(['magenta'], [{ h: '#c0392b', s: 1 }]), false);
  // Grenze genau: Farbton weniger als 60° entfernt (Gelb 93° vs. Orange 55°) → false
  assert.equal(colorCheck(['yellow'], [{ h: '#e8822e', s: 1 }]), false);
  // kaputte Einträge werden übersprungen
  assert.equal(colorCheck(['red'], [{ h: 'xyz', s: 1 }, { h: '#2d5fa8', s: 0 }] as never), false);
});
