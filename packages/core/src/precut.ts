// Schon freigestellte Bilder erkennen (16.11.2026).
// Ein Bild mit durchsichtigem Rand muss nicht durchs Modell: Ist es sauber, wird es nur zugeschnitten.
// Hat es einen Schatten (vom Shop mitgeliefert), wird der Schatten entfernt – ebenfalls ohne Modell.
//
// Erkennung über das Alpha: Eine saubere Kante ist nur wenige Pixel breit halbtransparent.
// Ein Schatten ist halbtransparent und liegt weit weg vom deckenden Stoff.
// Gemessen an Max' Beispielen: sauber 0–7 % der halbtransparenten Pixel „weit weg“, mit Schatten 85 %.

/** Ab diesem Alpha zählt ein Pixel als deckender Stoff */
export const PRECUT_CORE = 240;
/** Unter diesem Alpha zählt ein Pixel als durchsichtig */
export const PRECUT_CLEAR = 8;
/** Ab diesem Anteil „weit weg“ liegender halbtransparenter Pixel gilt das Bild als „mit Schatten“ */
export const PRECUT_SHADOW_SHARE = 0.3;
/** Breite des Randsaums (px), der beim Schatten-Entfernen mit Original-Alpha erhalten bleibt */
export const PRECUT_FRINGE = 2;

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
  /** Alpha nach dem Aufräumen (nur bei „shadow“ verändert, sonst das Original) */
  alpha: Uint8Array;
  /** Ausschnitt ums Teil (x1/y1 exklusiv); null bei „photo“ */
  box: Box | null;
  /** Messwerte zum Nachvollziehen */
  info: { border: number; semi: number; far: number; share: number; farPx: number; core: number };
};

/** Anteil durchsichtiger Pixel am Bildrand (jeder 2. Pixel) */
export function borderClear(alpha: ArrayLike<number>, W: number, H: number): number {
  let n = 0, t = 0;
  const at = (x: number, y: number) => { n++; if (alpha[y * W + x]! < 128) t++; };
  for (let x = 0; x < W; x += 2) { at(x, 0); at(x, H - 1); }
  for (let y = 0; y < H; y += 2) { at(0, y); at(W - 1, y); }
  return n ? t / n : 0;
}

/**
 * Abstand jedes Pixels zum nächsten deckenden Pixel (Chamfer 3-4, ≈ euklidisch, in px).
 * Deckende Pixel haben 0.
 */
export function distanceToCore(alpha: ArrayLike<number>, W: number, H: number, core = PRECUT_CORE): Float32Array {
  const N = W * H, INF = 1e9, d = new Float32Array(N);
  for (let i = 0; i < N; i++) d[i] = alpha[i]! >= core ? 0 : INF;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; let v = d[i]!;
    if (v === 0) continue;
    if (x > 0) v = Math.min(v, d[i - 1]! + 3);
    if (y > 0) {
      v = Math.min(v, d[i - W]! + 3);
      if (x > 0) v = Math.min(v, d[i - W - 1]! + 4);
      if (x < W - 1) v = Math.min(v, d[i - W + 1]! + 4);
    }
    d[i] = v;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x; let v = d[i]!;
    if (v === 0) continue;
    if (x < W - 1) v = Math.min(v, d[i + 1]! + 3);
    if (y < H - 1) {
      v = Math.min(v, d[i + W]! + 3);
      if (x < W - 1) v = Math.min(v, d[i + W + 1]! + 4);
      if (x > 0) v = Math.min(v, d[i + W - 1]! + 4);
    }
    d[i] = v;
  }
  for (let i = 0; i < N; i++) d[i] = d[i]! / 3;
  return d;
}

/** Ausschnitt um alle Pixel mit Alpha ≥ th; null, wenn keiner */
export function alphaBox(alpha: ArrayLike<number>, W: number, H: number, th = PRECUT_CLEAR): Box | null {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (alpha[y * W + x]! >= th) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

/**
 * Entscheidet, ob ein Bild schon freigestellt ist, und räumt einen Schatten weg.
 * alpha: Alpha-Kanal (0–255), Zeile für Zeile.
 */
export function analyzePrecut(alpha: ArrayLike<number>, W: number, H: number): PrecutResult {
  const N = W * H, src = Uint8Array.from(alpha as ArrayLike<number>);
  // „weit weg“ wächst leicht mit der Bildgröße, damit weiche Kanten großer Bilder nicht als Schatten gelten
  const farPx = Math.max(3, Math.round(Math.max(W, H) / 400));
  const border = borderClear(src, W, H);
  let core = 0;
  for (let i = 0; i < N; i++) if (src[i]! >= PRECUT_CORE) core++;
  const info = { border, semi: 0, far: 0, share: 0, farPx, core: core / N };
  // Kein durchsichtiger Rand oder (fast) nichts Deckendes (z. B. sehr durchscheinender Stoff) → Modell
  if (border <= 0.5 || core < N * 0.01) return { kind: 'photo', alpha: src, box: null, info };

  const d = distanceToCore(src, W, H);
  let semi = 0, far = 0;
  for (let i = 0; i < N; i++) {
    const a = src[i]!;
    if (a >= PRECUT_CLEAR && a < PRECUT_CORE) { semi++; if (d[i]! > farPx) far++; }
  }
  info.semi = semi; info.far = far; info.share = semi ? far / semi : 0;

  if (info.share <= PRECUT_SHADOW_SHARE) return { kind: 'clean', alpha: src, box: alphaBox(src, W, H), info };

  // Schatten entfernen: deckender Kern + schmaler Randsaum mit Original-Alpha, alles andere durchsichtig
  const out = new Uint8Array(N);
  for (let i = 0; i < N; i++) out[i] = src[i]! >= PRECUT_CORE || d[i]! <= PRECUT_FRINGE ? src[i]! : 0;
  return { kind: 'shadow', alpha: out, box: alphaBox(out, W, H), info };
}
