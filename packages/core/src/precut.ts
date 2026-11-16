// Schon freigestellte Bilder erkennen (16.11.2026).
// Ein Bild mit durchsichtigem Rand muss nicht durchs Modell: Ist es sauber, wird es nur zugeschnitten.
// Hat es einen Schatten (vom Shop mitgeliefert), wird der Schatten entfernt – ebenfalls ohne Modell.
//
// Erkennung über Alpha und Farbe: Eine saubere Kante ist nur wenige Pixel breit halbtransparent.
// Ein Schatten ist halbtransparent, dunkel und farblos und liegt weit weg vom deckenden Stoff.
// Gemessen an Max' Beispielen: sauber 0 % solcher Pixel, mit Schatten 85 %.
//
// Kante am Schatten: Dort ist die weiche Stoffkante mit dem Schatten verrechnet (dunkler, deckender).
// Der Stoff-Anteil lässt sich zurückrechnen: Deckung = Alpha × Helligkeit des Pixels / Helligkeit des Stoffs daneben.
// So bleibt die Original-Kante erhalten, ohne dunklen Rand.

/** Ab diesem Alpha zählt ein Pixel als deckender Stoff */
export const PRECUT_CORE = 240;
/** Unter diesem Alpha zählt ein Pixel als durchsichtig */
export const PRECUT_CLEAR = 8;
/** Ab diesem Anteil schattenartiger, „weit weg“ liegender halbtransparenter Pixel gilt das Bild als „mit Schatten“ */
export const PRECUT_SHADOW_SHARE = 0.3;
/** Breite des Randsaums (px), in dem die Stoffkante liegt */
export const PRECUT_FRINGE = 2.5;
/** Schatten = dunkel (größter Farbkanal höchstens so hell) und farblos (Kanäle höchstens so weit auseinander) */
export const PRECUT_SHADOW_MAX = 96;
export const PRECUT_SHADOW_SAT = 40;
/** Stoff dunkler als das (Helligkeit 0–255): Kante lässt sich nicht vom Schatten trennen → nur 1 px Saum behalten */
const DARK_CLOTH = 48;
/** Pixel gilt erst als vom Schatten abgedunkelt, wenn es weniger als so hell ist wie der Stoff daneben */
const DIMMED = 0.85;

export type PrecutKind =
  /** kein durchsichtiger Rand → normales Foto, durchs Modell */
  | 'photo'
  /** schon sauber freigestellt → nur zuschneiden */
  | 'clean'
  /** freigestellt, aber mit Schatten → Schatten weg, zuschneiden */
  | 'shadow';

export type Box = { x0: number; y0: number; x1: number; y1: number };

export type PrecutResult = {
  kind: PrecutKind;
  /** Bild nach dem Aufräumen (RGBA; nur bei „shadow“ eine veränderte Kopie, sonst das Original) */
  data: Uint8ClampedArray;
  /** Ausschnitt ums Teil (x1/y1 exklusiv); null bei „photo“ */
  box: Box | null;
  /** Messwerte zum Nachvollziehen */
  info: { border: number; semi: number; far: number; share: number; farPx: number; core: number };
};

/** Anteil durchsichtiger Pixel am Bildrand (jeder 2. Pixel) */
export function borderClear(rgba: ArrayLike<number>, W: number, H: number): number {
  let n = 0, t = 0;
  const at = (x: number, y: number) => { n++; if (rgba[(y * W + x) * 4 + 3]! < 128) t++; };
  for (let x = 0; x < W; x += 2) { at(x, 0); at(x, H - 1); }
  for (let y = 0; y < H; y += 2) { at(0, y); at(W - 1, y); }
  return n ? t / n : 0;
}

/**
 * Abstand jedes Pixels zum nächsten deckenden Pixel (Chamfer 3-4, ≈ euklidisch, in px; deckende haben 0)
 * und der Index dieses nächsten deckenden Pixels (−1, wenn es keinen gibt).
 */
export function distanceToCore(rgba: ArrayLike<number>, W: number, H: number, core = PRECUT_CORE): { d: Float32Array; near: Int32Array } {
  const N = W * H, INF = 1e9, d = new Float32Array(N), near = new Int32Array(N);
  for (let i = 0; i < N; i++) { const c = rgba[i * 4 + 3]! >= core; d[i] = c ? 0 : INF; near[i] = c ? i : -1; }
  const take = (i: number, j: number, w: number) => { const v = d[j]! + w; if (v < d[i]!) { d[i] = v; near[i] = near[j]!; } };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (d[i] === 0) continue;
    if (x > 0) take(i, i - 1, 3);
    if (y > 0) { take(i, i - W, 3); if (x > 0) take(i, i - W - 1, 4); if (x < W - 1) take(i, i - W + 1, 4); }
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x;
    if (d[i] === 0) continue;
    if (x < W - 1) take(i, i + 1, 3);
    if (y < H - 1) { take(i, i + W, 3); if (x < W - 1) take(i, i + W + 1, 4); if (x > 0) take(i, i + W - 1, 4); }
  }
  for (let i = 0; i < N; i++) d[i] = d[i]! / 3;
  return { d, near };
}

/** Ausschnitt um alle Pixel mit Alpha ≥ th; null, wenn keiner */
export function alphaBox(rgba: ArrayLike<number>, W: number, H: number, th = PRECUT_CLEAR): Box | null {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (rgba[(y * W + x) * 4 + 3]! >= th) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

const lum = (p: ArrayLike<number>, o: number) => 0.299 * p[o]! + 0.587 * p[o + 1]! + 0.114 * p[o + 2]!;

/** dunkel und farblos, wie ein Schlagschatten */
function shadowLike(p: ArrayLike<number>, o: number): boolean {
  const r = p[o]!, g = p[o + 1]!, b = p[o + 2]!, mx = Math.max(r, g, b);
  return mx <= PRECUT_SHADOW_MAX && mx - Math.min(r, g, b) <= PRECUT_SHADOW_SAT;
}

/**
 * Entscheidet, ob ein Bild schon freigestellt ist, und räumt einen Schatten weg.
 * rgba: Bilddaten wie von getImageData (4 Werte je Pixel, nicht vormultipliziert).
 */
export function analyzePrecut(rgba: Uint8ClampedArray, W: number, H: number): PrecutResult {
  const N = W * H;
  // „weit weg“ wächst leicht mit der Bildgröße, damit weiche Kanten großer Bilder nicht als Schatten gelten
  const farPx = Math.max(3, Math.round(Math.max(W, H) / 400));
  const border = borderClear(rgba, W, H);
  let core = 0;
  for (let i = 0; i < N; i++) if (rgba[i * 4 + 3]! >= PRECUT_CORE) core++;
  const info = { border, semi: 0, far: 0, share: 0, farPx, core: core / N };
  // Kein durchsichtiger Rand oder (fast) nichts Deckendes (z. B. sehr durchscheinender Stoff) → Modell
  if (border <= 0.5 || core < N * 0.01) return { kind: 'photo', data: rgba, box: null, info };

  const { d, near } = distanceToCore(rgba, W, H);
  // Schatten-Pixel: halbtransparent, weit weg vom Stoff, dunkel und farblos
  const shade = new Uint8Array(N);
  let semi = 0, far = 0;
  for (let i = 0; i < N; i++) {
    const a = rgba[i * 4 + 3]!;
    if (a < PRECUT_CLEAR || a >= PRECUT_CORE) continue;
    semi++;
    if (d[i]! > farPx && shadowLike(rgba, i * 4)) { far++; shade[i] = 1; }
  }
  info.semi = semi; info.far = far; info.share = semi ? far / semi : 0;

  if (info.share <= PRECUT_SHADOW_SHARE) return { kind: 'clean', data: rgba, box: alphaBox(rgba, W, H), info };

  // Wo liegt Schatten in der Nähe? Nur dort wird die Kante angefasst; alle anderen Kanten bleiben original.
  const R = farPx + 2, rowHit = new Uint8Array(N), nearShade = new Uint8Array(N);
  for (let y = 0; y < H; y++) { let last = -1e9; const o = y * W;
    for (let x = 0; x < W; x++) { if (shade[o + x]) last = x; if (x - last <= R) rowHit[o + x] = 1; }
    last = 1e9; for (let x = W - 1; x >= 0; x--) { if (shade[o + x]) last = x; if (last - x <= R) rowHit[o + x] = 1; } }
  for (let x = 0; x < W; x++) { let last = -1e9;
    for (let y = 0; y < H; y++) { if (rowHit[y * W + x]) last = y; if (y - last <= R) nearShade[y * W + x] = 1; }
    last = 1e9; for (let y = H - 1; y >= 0; y--) { if (rowHit[y * W + x]) last = y; if (last - y <= R) nearShade[y * W + x] = 1; } }

  const out = new Uint8ClampedArray(rgba);
  for (let i = 0; i < N; i++) {
    const o = i * 4, a = rgba[o + 3]!;
    if (a === 0 || a >= PRECUT_CORE) continue;
    // kaum sichtbarer Rest (Auslauf des Schattens) außerhalb des Saums: ganz weg, sonst bleibt ein Hauch stehen
    if (a < PRECUT_CLEAR) { if (d[i]! > PRECUT_FRINGE) out[o + 3] = 0; continue; }
    const dark = shadowLike(rgba, o);
    if (d[i]! > PRECUT_FRINGE) {
      // außerhalb des Saums: Schatten weg; farbige, durchscheinende Stellen (kein Schatten) bleiben
      if (dark) out[o + 3] = 0;
      continue;
    }
    if (!nearShade[i]) continue; // Kante ohne Schatten daneben → Original
    const j = near[i]! * 4, cloth = lum(rgba, j);
    if (cloth < DARK_CLOTH) { if (d[i]! > 1.5 && dark) out[o + 3] = 0; continue; } // dunkler Stoff: 1 px Saum behalten
    const r = lum(rgba, o) / cloth;
    if (r >= DIMMED) continue; // nicht abgedunkelt → Original
    // Stoff-Anteil zurückrechnen, Farbe vom Stoff daneben (ohne Schattenstich)
    const na = Math.round(a * r / DIMMED);
    out[o + 3] = na < PRECUT_CLEAR ? 0 : na;
    out[o] = rgba[j]!; out[o + 1] = rgba[j + 1]!; out[o + 2] = rgba[j + 2]!;
  }
  return { kind: 'shadow', data: out, box: alphaBox(out, W, H), info };
}
