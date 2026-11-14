import Svg, { Circle, Path } from 'react-native-svg';
import { itemTile } from '@valet/ui';

// Symbole der Kachel-Plaketten – exakt aus docs/design/kachel/VALET_KACHEL_SPEC.md, Abschnitt 6.
// 24er-Raster, nur Linien, runde Enden; geometrisch zentriert (keine Korrektur nötig).

type El = { d?: string; c?: [number, number, number] };
const P = (d: string): El => ({ d });
const C = (cx: number, cy: number, r: number): El => ({ c: [cx, cy, r] });

export const TILE_ICONS = {
  hanger: [P('M12 7.5a2.2 2.2 0 1 1 2.2-2.2'), P('M12 7.5v1.2L3.2 15.6a1 1 0 0 0 .6 1.8h16.4a1 1 0 0 0 .6-1.8L12 8.7')],
  wash: [P('M4 10h16l-1.6 8.8a1.6 1.6 0 0 1-1.6 1.2H7.2a1.6 1.6 0 0 1-1.6-1.2z'), P('M8.5 10l3-6'), P('M15.5 10l-3-6')],
  repair: [C(6.5, 17.5, 2.5), C(17.5, 17.5, 2.5), P('M8.3 15.8L18 4'), P('M15.7 15.8L6 4')],
  /** verliehen: schräger Pfeil (getauscht 14.11.2026, der gerade gehört „Next Cop“) */
  lent: [P('M6.5 17.5l11-11'), P('M9 6.5h8.5V15')],
  /** eingelagert (Kiste) */
  stored: [P('M4.5 9h15v10a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1z'), P('M3 4.5h18V9H3z'), P('M10 13h4')],
  /** aussortiert: Kiste mit Pfeil nach oben (raus aus dem Schrank, soll verkauft werden) */
  out: [P('M4.5 11h15v8a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1z'), P('M12 2.5v11'), P('M8.5 6L12 2.5 15.5 6')],
  sold: [P('M3.5 12V4.5a1 1 0 0 1 1-1H12l8.5 8.5-8.5 8.5z'), C(8, 8, 1.4)],
  reversible: [P('M4.5 11a7.5 7.5 0 0 1 13-4.5L19.5 8.5'), P('M19.5 4v4.5H15'), P('M19.5 13a7.5 7.5 0 0 1-13 4.5L4.5 15.5'), P('M4.5 20v-4.5H9')],
  // Wunschliste – Kategorie oben links (WISH_TAGS in @valet/core, gleiche Schlüssel; Entwurf docs/design/wunschliste)
  grail: [P('M4.5 16l-1.2-8.5 5 3.8L12 5l3.7 6.3 5-3.8L19.5 16z'), P('M4.5 19.5h15')],
  watchlist: [P('M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z'), C(12, 12, 2.6)],
  nextcop: [P('M5 12h13'), P('M13 6l6 6-6 6')],
  someday: [P('M15.5 3.5l1.5 3.1 3.4.5-2.5 2.4.6 3.4-3-1.6-3 1.6.6-3.4-2.5-2.4 3.4-.5z'), P('M9.5 13.5l-6 6'), P('M12.5 16.5l-3 3'), P('M7 11l-3 3')],
  gift: [P('M4 9.5h16v3H4z'), P('M5.5 12.5V20h13v-7.5'), P('M12 9.5V20'), P('M12 9.5C10.5 6 7 5.5 7 7.5S10 9.5 12 9.5c2 0 5 0 5-2s-3.5-1.5-5 2')],
  // Outfit-Anlässe (OCCASIONS in @valet/core, entschieden 14.11.2026; Alltag = Fußspuren)
  occAlltag: [P('M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z'), P('M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z'), P('M16 17h4'), P('M4 13h4')],
  occBuero: [P('M5 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z'), P('M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2')],
  occDate: [P('M8 21h8'), P('M12 14v7'), P('M7 3h10l-.4 5.5a4.6 4.6 0 0 1-9.2 0Z')],
  occFormell: [P('M3 7v10l7-3.5v-3Z'), P('M21 7v10l-7-3.5v-3Z'), P('M11 10h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z')],
  occUrlaub: [P('M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z')],
  occLounge: [P('M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3'), P('M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Z'), P('M5 19v2'), P('M19 19v2')],
  occParty: [P('M12 2v2.5'), C(12, 13, 8.5), P('M3.5 13h17'), P('M4.5 9h15'), P('M4.5 17h15'), P('M12 4.5c-3.2 2.6-3.2 14.4 0 17'), P('M12 4.5c3.2 2.6 3.2 14.4 0 17')],
  occSport: [P('M6.5 6.5v11'), P('M17.5 6.5v11'), P('M3 9.5v5'), P('M21 9.5v5'), P('M6.5 12h11')],
  occBesonders: [P('M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9Z'), P('M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8Z')],
  occCampus: [P('M22 10 12 5 2 10l10 5 10-5Z'), P('M6 12v5c3 2 9 2 12 0v-5')],
  occStrand: [P('M3 11a9 9 0 0 1 18 0Z'), P('M12 11l-2.5 10'), P('M4 21h16')],
  occCafe: [P('M17 8h1a4 4 0 0 1 0 8h-1'), P('M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z'), P('M6 2v2'), P('M10 2v2'), P('M14 2v2')],
  occSonst: [C(12, 12, 9), P('M8 12h.01'), P('M12 12h.01'), P('M16 12h.01')],
} satisfies Record<string, El[]>;

export type TileIconName = keyof typeof TILE_ICONS;

/**
 * scale: ganze Plakette vergrößert (Outfit-Karte × 1,5) – Größe und Versatz wachsen mit, die Strichstärke im
 * 24er-Raster bleibt gleich (wirkt also proportional dicker, wie auf der Kachel).
 */
export function TileIcon({ name, color, size: sizeOverride, scale = 1 }: { name: TileIconName; color: string; size?: number; scale?: number }) {
  const base = name === 'hanger' ? itemTile.badge.hanger : itemTile.badge.icon;
  // size: nur außerhalb der Kachel (z. B. Filter-Chips); Strich wächst nicht mit, damit er nicht zu dick wird
  const size = sizeOverride ?? base.size * scale;
  const stroke = sizeOverride ? Math.min(base.stroke, 2) : base.stroke;
  // Bügel optisch mittig (Versatz aus den Tokens), alle anderen Symbole sind im Raster zentriert
  const offsetY = name === 'hanger' ? itemTile.badge.hanger.offsetY * scale : 0;
  const p = { fill: 'none', stroke: color, strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={offsetY ? { transform: [{ translateY: offsetY }] } : undefined}>
      {TILE_ICONS[name].map((e, i) => (e.d ? <Path key={i} d={e.d} {...p} /> : <Circle key={i} cx={e.c![0]} cy={e.c![1]} r={e.c![2]} {...p} />))}
    </Svg>
  );
}
