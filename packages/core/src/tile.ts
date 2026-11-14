// Logik der Schrank-Kachel (ItemTile) – plattformunabhängig, für Web und iOS.
// Verbindlich: docs/design/kachel/VALET_KACHEL_SPEC.md und valet-kachel-referenz.html.
import { itemTile } from '@valet/ui';
import type { ItemStatus } from './catalog';

// ---------- Innenschein (Spec 3) ----------

export type Rgb = [number, number, number];

/** '#rrggbb' (auch ohne #, auch mit Alpha-Anteil) → [r, g, b]; ungültig → null */
export function hexToRgb(hex: string | null | undefined): Rgb | null {
  const h = (hex ?? '').trim().replace(/^#/, '');
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

/** Sättigung und Helligkeit (HSV), je 0–1 */
export function toHsv([r, g, b]: Rgb): { s: number; v: number } {
  const mx = Math.max(r, g, b) / 255;
  const mn = Math.min(r, g, b) / 255;
  return { s: mx === 0 ? 0 : (mx - mn) / mx, v: mx };
}

export type Glow = { rgb: Rgb; alpha: number; css: string };

/**
 * Farbe des Innenscheins:
 * farbig → Hauptfarbe 52 %; neutral mit Highlight → Highlight 52 %;
 * neutral ohne Highlight → Hauptfarbe 28 % (sehr hell → Ersatzfarbe); ohne Hauptfarbe → Ersatzfarbe 28 %.
 */
export function glowFor(main: string | null | undefined, highlight?: string | null): Glow {
  const g = itemTile.glow;
  const fallback = hexToRgb(g.fallback)!;
  const m = hexToRgb(main);
  let rgb: Rgb = fallback;
  let alpha: number = g.alphaSoft;
  if (m) {
    const { s, v } = toHsv(m);
    const neutral = s < g.satMin || v < g.valMin;
    const hl = hexToRgb(highlight);
    if (!neutral) { rgb = m; alpha = g.alphaStrong; }
    else if (hl) { rgb = hl; alpha = g.alphaStrong; }
    else rgb = v > g.valLight ? fallback : m;
  }
  return { rgb, alpha, css: `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})` };
}

// ---------- Status (Spec 5.1) ----------

/** Status oben links. „out“ = eingelagert / aussortiert (offener Punkt: evtl. getrennte Symbole). */
export const TILE_STATUS: Record<ItemStatus, { label: string; away: boolean }> = {
  wash: { label: 'Wäsche', away: false },
  repair: { label: 'Reparatur', away: true },
  lent: { label: 'Verliehen', away: true },
  out: { label: 'Eingelagert', away: true },
  sold: { label: 'Verkauft', away: true },
};

/** Foto abblenden? (alle Status außer Wäsche) */
export const isAway = (status: ItemStatus | null | undefined) => !!status && TILE_STATUS[status].away;

// ---------- Anzahl und Wendbar (Spec 5.2) ----------

export type CountLabel = { num: string; sym: '×' | '+' };

/** Anzahl als „2ד, „12ד, ab 100 „99+“; unter 2 → null (keine Plakette) */
export function countLabel(n: number | null | undefined): CountLabel | null {
  if (!n || n < 2) return null;
  return n > 99 ? { num: '99', sym: '+' } : { num: String(Math.floor(n)), sym: '×' };
}

export type TopRight = {
  reversible: boolean;
  /** circle = allein in der Ecke (20 × 20); capsule = unter Wendbar (20 × 14) */
  count: (CountLabel & { shape: 'circle' | 'capsule'; n: number }) | null;
};

/** Belegung oben rechts: Wendbar in der Ecke, Anzahl darunter als Kapsel – ohne Wendbar Anzahl als Kreis in der Ecke */
export function topRightFor(reversible: boolean, qty: number | null | undefined): TopRight | null {
  const c = countLabel(qty);
  if (!reversible && !c) return null;
  return { reversible, count: c ? { ...c, n: qty!, shape: reversible ? 'capsule' : 'circle' } : null };
}

// ---------- Besitzer (Spec 5.4) ----------

/** links → rechts; das letzte Element sitzt in der Ecke und liegt obenauf */
export type OwnerSlot = { person: string } | { more: number };

/**
 * Besitzer-Plaketten aus Sicht der angemeldeten Person `me`:
 * eigenes Monogramm in der Ecke (oben), links darunter die andere Person bzw. „+N“.
 * Gehört das Teil nur mir, gibt es keine Plakette.
 * Ohne mich: erste Person in der Ecke.
 */
export function ownersFor(owners: readonly string[] | null | undefined, me: string | null | undefined): OwnerSlot[] {
  const list = [...new Set(owners ?? [])];
  if (!list.length) return [];
  const anchor = me && list.includes(me) ? me : list[0]!;
  const rest = list.filter((o) => o !== anchor);
  // Gehört das Teil nur mir, braucht es keine Plakette (14.11.2026)
  if (rest.length === 0) return anchor === me ? [] : [{ person: anchor }];
  if (rest.length === 1) return [{ person: rest[0]! }, { person: anchor }];
  return [{ more: rest.length }, { person: anchor }];
}

// ---------- Barrierefreiheit (Spec 9) ----------

export type TileA11y = {
  name: string;
  status?: ItemStatus | null;
  reversible?: boolean;
  qty?: number | null;
  /** heute getragen bzw. reserviert – mit Namen der Person, sofern bekannt */
  today?: { name?: string | null } | null;
  /** Besitzer-Plaketten (aus ownersFor) mit aufgelösten Namen */
  owners?: ({ name: string } | { more: number })[];
};

/** Label der ganzen Kachel: Teilname plus Plaketten-Infos in Worten */
export function tileA11yLabel(t: TileA11y): string {
  const parts = [t.name];
  if (t.status) parts.push(TILE_STATUS[t.status].label);
  if (t.reversible) parts.push('Wendbar');
  if (countLabel(t.qty)) parts.push(`${t.qty} Stück`);
  if (t.today) parts.push(t.today.name ? `heute: ${t.today.name}` : 'heute getragen');
  if (t.owners?.length) parts.push(t.owners.map((o) => ('more' in o ? `${o.more} weitere` : o.name)).join(', '));
  return parts.filter(Boolean).join(', ');
}

// ---------- Wunschliste: Preis und Bedenkzeit (entschieden 14.11.2026) ----------
// Entwurf: docs/design/wunschliste/wunsch-kacheln.html

/**
 * Bedenkzeit der Wunschliste.
 * VORERST AUS (Max, 14.11.2026): Plakette ist fertig, wird aber erst angezeigt, wenn Max sagt „jetzt anmachen“.
 * Zum Einschalten nur `enabled` auf true setzen.
 */
export const WISH_WAIT = {
  enabled: false,
  /** Länge in Tagen, ab dem Tag, an dem das Teil auf die Liste kam */
  days: 14,
  /** ab so vielen Resttagen wird der Ring orange */
  warnAt: 3,
} as const;

export type WishWait = {
  /** verbleibende Tage (1 … days) */
  left: number;
  /** Anteil verbleibender Zeit 0–1 (voller Ring = gerade hinzugefügt) */
  progress: number;
  warn: boolean;
};

const DAY = 24 * 60 * 60 * 1000;

/**
 * Bedenkzeit-Plakette oben rechts. null = keine Plakette:
 * Funktion aus, Datum fehlt/ungültig oder Bedenkzeit vorbei (dann verschwindet die Plakette einfach).
 */
export function wishWait(
  addedAt: string | Date | null | undefined,
  now: Date = new Date(),
  opts: { enabled: boolean; days: number; warnAt: number } = WISH_WAIT,
): WishWait | null {
  if (!opts.enabled || !addedAt) return null;
  const start = new Date(addedAt);
  if (Number.isNaN(start.getTime())) return null;
  // in ganzen Kalendertagen rechnen (lokale Zeit): am Tag des Hinzufügens noch volle Bedenkzeit
  const d0 = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const d1 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const left = opts.days - Math.round((d1 - d0) / DAY);
  if (left <= 0) return null;
  const l = Math.min(left, opts.days);
  return { left: l, progress: l / opts.days, warn: l <= opts.warnAt };
}

/** Preis auf der Kachel: ganze Euro mit Tausenderpunkt („9“, „89“, „1.249“), ohne Preis → null */
export function priceLabel(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(Math.round(n));
}

// ---------- Wunschliste: Kategorie (entschieden 14.11.2026) ----------

/**
 * Kategorie eines Wunschteils, höchstens eine pro Teil. Keine Liste – nur Plakette oben links, Filter und Suche.
 * Symbole: TILE_ICONS in apps/app/src/components/tile/TileIcons.tsx (gleiche Schlüssel).
 */
export const WISH_TAGS = [
  { id: 'grail', label: 'Grail' },         // Krone
  { id: 'watchlist', label: 'Watchlist' }, // Auge
  { id: 'nextcop', label: 'Next Cop' },    // Pfeil gerade nach rechts
  { id: 'someday', label: 'Someday' },     // Sternschnuppe
  { id: 'gift', label: 'Gift' },           // Geschenk
] as const;
export type WishTag = (typeof WISH_TAGS)[number]['id'];
export const wishTagLabel = (id: string | null | undefined) => WISH_TAGS.find((w) => w.id === id)?.label ?? null;
export const isWishTag = (v: unknown): v is WishTag => WISH_TAGS.some((w) => w.id === v);
