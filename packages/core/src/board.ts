// Outfit-Fläche (Board) – automatische Anordnung wie im alten Valet.
// Koordinaten: x/y sind die Mitte eines Teils als Anteil von Breite/Höhe der Fläche (0–1).
// Die Fläche ist 4:5 (Höhe = 1,25 × Breite).

export const BOARD_AR = 1.25;
const BOARD_U = 0.3;
const BOARD_PAD = 0.06;

/** Was die Anordnung über ein Teil wissen muss */
export interface BoardItem {
  id: string;
  category: string;
  /** Grobe Form (layoutKind aus categories.ts); fehlt sie, gilt category als Form (alte Daten, Tests) */
  kind?: string;
  /** Unterkategorie (genauer Körperbereich bei Accessoires) */
  subcategory?: string | null;
  name: string;
  material?: string | null;
}

const kindOf = (i: BoardItem) => i.kind ?? i.category;

export interface BoardPos { x: number; y: number }
export interface BoardBox { w: number; h: number }
export interface BoardPlaced { item: BoardItem; left: number; top: number; width: number; height: number; z: number }

/** Kachelhöhe je Kategorie (wie TILE_AUTO/TILE_H im alten Valet) */
const TILE_H: Record<string, number> = { coat: 2, dress: 1.75, pants: 1.5, skirt: 1.1, jacket: 1.25, top: 1.25, sweater: 1.25, sport: 1.25, shoe: 0.75, headwear: 0.75, accessory: 0.75 };

const text = (i: BoardItem) => (i.name || '').toLowerCase();

export const isCap = (i: BoardItem | null | undefined): boolean =>
  !!i && (i.subcategory === 'cap' || ((kindOf(i) === 'headwear' || kindOf(i) === 'accessory') && !i.subcategory &&
  /\bcap\b|cappy|basecap|base cap|baseballcap|baseball-cap|baseball cap|kappe|snapback|trucker|fitted|5-panel|dad hat|schirmmütze/.test(text(i))));

/** Körperbereich je Unterkategorie (Keys; Schmuck, Accessoire) */
const BY_SUB: Record<string, { k: string; y: number }> = {
  glasses: { k: 'face', y: 0.21 }, scarf: { k: 'neck', y: 0.32 }, necklace: { k: 'neck', y: 0.32 }, suit_accessory: { k: 'neck', y: 0.32 },
  earring: { k: 'face', y: 0.21 }, belt: { k: 'waist', y: 0.48 }, bracelet: { k: 'hand', y: 0.56 }, watch: { k: 'hand', y: 0.56 },
  ring: { k: 'hand', y: 0.56 }, glove: { k: 'hand', y: 0.56 }, sock: { k: 'feet', y: 0.84 },
};

/** Bereich am Körper (Höhe als Anteil der Fläche) */
export function zoneOf(i: BoardItem): { k: string; y: number } {
  const c = kindOf(i), n = text(i);
  if (c === 'headwear') return { k: 'head', y: 0.09 };
  const sub = BY_SUB[i.subcategory ?? ''];
  if (c === 'accessory' && sub) return sub;
  if (c === 'accessory') {
    if (/cap|mütze|muetze|beanie|hut\b|hat\b|basecap|kappe|bucket/.test(n)) return { k: 'head', y: 0.09 };
    if (/brille|glasses|sunglass/.test(n)) return { k: 'face', y: 0.21 };
    if (/schal|kette|necklace|scarf|tuch|krawatte/.test(n)) return { k: 'neck', y: 0.32 };
    if (/gürtel|guertel|belt/.test(n)) return { k: 'waist', y: 0.48 };
    if (/armband|uhr|watch|bracelet|ring|handschuh/.test(n)) return { k: 'hand', y: 0.56 };
    if (/socke|sock/.test(n)) return { k: 'feet', y: 0.84 };
    return { k: 'acc', y: 0.4 };
  }
  const z: Record<string, { k: string; y: number }> = {
    dress: { k: 'top', y: 0.4 }, skirt: { k: 'legs', y: 0.57 },
    coat: { k: 'top', y: 0.31 }, jacket: { k: 'top', y: 0.3 }, sweater: { k: 'top', y: 0.29 }, sport: { k: 'top', y: 0.28 }, top: { k: 'top', y: 0.27 },
    pants: { k: 'legs', y: 0.62 }, shorts: { k: 'legs', y: 0.57 }, shoe: { k: 'feet', y: 0.89 }, bag: { k: 'thigh', y: 0.6 },
  };
  return z[c] ?? { k: 'acc', y: 0.45 };
}

/** Größe auf der Fläche: w als Anteil der Breite, h als Anteil der Höhe */
export function boxOf(i: BoardItem): BoardBox {
  const f = isCap(i) ? 0.75 : 1;
  const w = BOARD_U * f, h = BOARD_U * (TILE_H[kindOf(i)] ?? 1) * f;
  return { w, h: h / BOARD_AR };
}

/** Lagen bei Oberteilen (hinten → vorne): Mantel, Jacke, offene Lagen, Langarm/Hemd, T-Shirt, Pullover/Hoodie */
export function topRank(i: BoardItem): number {
  const c = kindOf(i), n = text(i);
  if (c === 'coat' || /mantel|parka|trenchcoat|\bcoat\b/.test(n)) return 0;
  if (/strickjacke|cardigan|zipper|\bzip\b|zip-up|zip up|full zip|half zip|half-zip|quarter zip|troyer/.test(n)) return 2;
  if (c === 'jacket' || /jacke|jacket|blouson|blazer|anorak|weste|gilet|bomber|overshirt|windbreaker/.test(n)) return 1;
  if (c === 'sweater' || /pulli|pullover|hoodie|sweat|strick|knit|crewneck/.test(n)) return 5;
  if (/longsleeve|long sleeve|langarm|hemd|bluse|shirt langarm|rollkragen|turtleneck|button/.test(n) && !/t-shirt|tshirt|\btee\b/.test(n)) return 3;
  return 4;
}

/** Stoffdicke grob: 2 dick, 1 normal, 0 dünn – dickere Teile liegen hinter dünneren */
export function thickOf(i: BoardItem): number {
  const n = `${i.name || ''} ${i.material || ''}`.toLowerCase().replace(/baumwolle/g, 'cotton');
  if (/mohair|wolle|wool|merino.*grob|chunky|grobstrick|fleece|sherpa|teddy|puffer|daunen|down|cord|corduroy|heavy|heavyweight|loopback|wattiert|gefüttert|lammfell|shearling|tweed|denim|leder|leather/.test(n)) return 2;
  if (/\bfein|feinstrick|jersey|baumwolle|cotton|leinen|linen|seide|silk|mesh|dünn|light|lightweight|\brib\b|ripp|tank|slim/.test(n)) return 0;
  if (/strick|knit|sweat|hoodie/.test(n)) return 2;
  return 1;
}

const isTop = (i: BoardItem) => ['coat', 'jacket', 'sweater', 'top', 'sport', 'dress'].includes(kindOf(i));

/** Ebene (größer = weiter vorne) */
export function baseZ(i: BoardItem): number {
  if (isTop(i)) { const r = topRank(i), d = thickOf(i); return r === 0 ? 77 : 84 + r * 3 + (d === 0 ? 1 : d === 2 ? -1 : 0); }
  const b = boxOf(i), z = Math.round(100 - b.w * b.h * 100 * BOARD_AR);
  return ['accessory', 'bag', 'headwear'].includes(kindOf(i)) ? z + 10 : z;
}

/** Ungefähr auf Körperhöhe und innerhalb der Fläche halten */
export function clampPos(i: BoardItem, x: number, y: number): BoardPos {
  const b = boxOf(i), z = zoneOf(i);
  y = Math.max(z.y - 0.18, Math.min(z.y + 0.18, y));
  const px = BOARD_PAD, py = BOARD_PAD / BOARD_AR;
  x = Math.max(b.w / 2 + px, Math.min(1 - b.w / 2 - px, x));
  y = Math.max(b.h / 2 + py, Math.min(1 - b.h / 2 - py, y));
  return { x, y };
}

function capSlotPos(i: BoardItem): BoardPos {
  const b = boxOf(i);
  return { x: 1 - b.w / 2 - BOARD_PAD, y: b.h / 2 + BOARD_PAD / BOARD_AR };
}

type Rect = { l: number; r: number; t: number; b: number };
const rect = (i: BoardItem, p: BoardPos): Rect => { const b = boxOf(i); return { l: p.x - b.w / 2, r: p.x + b.w / 2, t: p.y - b.h / 2, b: p.y + b.h / 2 }; };
const overlap = (a: Rect, b: Rect) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));

/** Anteil, den die Cap von einem anderen Teil höchstens verdeckt (ohne Bildmasken: Rechtecke) */
function capCover(c: BoardItem, cp: BoardPos, others: BoardItem[], L: Record<string, BoardPos>): number {
  const cr = rect(c, cp);
  let worst = 0;
  for (const o of others) {
    const p = L[o.id]; if (!p) continue;
    const r = rect(o, p), area = (r.r - r.l) * (r.b - r.t);
    if (area > 0) worst = Math.max(worst, overlap(cr, r) / area);
  }
  return worst;
}

/** Automatische Anordnung wie im alten Valet */
export function autoLayout(its: BoardItem[]): Record<string, BoardPos> {
  const L: Record<string, BoardPos> = {};
  const by = (k: string) => its.filter((i) => zoneOf(i).k === k);
  const spread = (arr: BoardItem[], cx: number, step: number, cy: number | null, dy = 0) =>
    arr.forEach((i, k) => { L[i.id] = { x: cx + (k - (arr.length - 1) / 2) * step, y: (cy == null ? zoneOf(i).y : cy) + k * dy }; });

  // Cap oben rechts
  its.filter(isCap).forEach((i, k) => { const p = capSlotPos(i); L[i.id] = { x: p.x - k * 0.12, y: p.y + k * 0.03 }; });
  // Oberteile: innen links, äußere Lagen versetzt darüber
  const tops = by('top').sort((a, b) => topRank(a) - topRank(b) || thickOf(b) - thickOf(a));
  spread(tops, 0.5, tops.length > 1 ? Math.min(0.22, 0.5 / (tops.length - 1)) : 0, null, 0.02);
  spread(by('legs'), 0.48, 0.24, null);
  spread(by('feet').filter((i) => kindOf(i) === 'shoe'), 0.5, 0.3, null);

  // Accessoires und Taschen links oder rechts auf Körperhöhe – dort, wo am wenigsten überlappt
  const placed = its.filter((i) => L[i.id]).map((i) => ({ main: true, r: rect(i, L[i.id]!) }));
  const rest = its.filter((i) => !L[i.id]).sort((a, b) => { const A = boxOf(a), B = boxOf(b); return B.w * B.h - A.w * A.h; });
  let flip = 0;
  for (const i of rest) {
    const z = zoneOf(i), b = boxOf(i);
    const xs = [b.w / 2 + BOARD_PAD, 1 - b.w / 2 - BOARD_PAD, b.w / 2 + 0.2, 1 - b.w / 2 - 0.2];
    let best: { c: number; p: BoardPos } | null = null;
    for (const [k, x] of xs.entries()) for (const dy of [0, -0.06, 0.06, -0.12, 0.12]) {
      const p = { x, y: z.y + dy }, r = rect(i, p);
      let cost = Math.abs(dy) * 0.2 + (k > 1 ? 0.004 : 0) + ((k % 2) !== (z.k === 'thigh' ? 0 : flip % 2) ? 0.0005 : 0);
      for (const q of placed) cost += overlap(r, q.r) * (q.main ? 1 : 3);
      if (!best || cost < best.c) best = { c: cost, p };
    }
    L[i.id] = best!.p;
    placed.push({ main: false, r: rect(i, best!.p) });
    flip++;
  }

  // Cap so nah wie möglich ans Outfit, aber höchstens 5 % eines anderen Teils verdecken
  const caps = its.filter(isCap);
  if (caps.length) {
    const c = caps[0]!, others = its.filter((i) => !isCap(i)), P0 = capSlotPos(c);
    let best = P0;
    for (let k = 0; k <= 24; k++) {
      const t = k / 24, p = { x: P0.x - 0.22 * (1 - t), y: P0.y + 0.08 * (1 - t) };
      if (capCover(c, p, others, L) <= 0.05) { best = p; break; }
    }
    caps.forEach((i, k) => { L[i.id] = { x: best.x - k * 0.12, y: best.y + k * 0.03 }; });
  }
  return L;
}

/** Fertige Anordnung (in Prozent der Fläche); gespeicherte Positionen haben Vorrang vor der automatischen */
export function boardLayout(its: BoardItem[], saved: Record<string, { x?: number | null; y?: number | null; z?: number | null }> = {}): BoardPlaced[] {
  const auto = autoLayout(its);
  return its.map((i) => {
    const b = boxOf(i), q = saved[i.id] ?? {}, a = auto[i.id]!;
    const pos = clampPos(i, q.x ?? a.x, q.y ?? a.y);
    return { item: i, left: (pos.x - b.w / 2) * 100, top: (pos.y - b.h / 2) * 100, width: b.w * 100, height: b.h * 100, z: q.z ?? baseZ(i) };
  });
}
