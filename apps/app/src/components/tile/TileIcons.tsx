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
  lent: [P('M5 12h13'), P('M13 6l6 6-6 6')],
  /** eingelagert / aussortiert (offener Punkt 10.2: evtl. getrennte Symbole) */
  out: [P('M4.5 9h15v10a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1z'), P('M3 4.5h18V9H3z'), P('M10 13h4')],
  sold: [P('M3.5 12V4.5a1 1 0 0 1 1-1H12l8.5 8.5-8.5 8.5z'), C(8, 8, 1.4)],
  reversible: [P('M4.5 11a7.5 7.5 0 0 1 13-4.5L19.5 8.5'), P('M19.5 4v4.5H15'), P('M19.5 13a7.5 7.5 0 0 1-13 4.5L4.5 15.5'), P('M4.5 20v-4.5H9')],
} satisfies Record<string, El[]>;

export type TileIconName = keyof typeof TILE_ICONS;

export function TileIcon({ name, color }: { name: TileIconName; color: string }) {
  const { size, stroke } = name === 'hanger' ? itemTile.badge.hanger : itemTile.badge.icon;
  // Bügel optisch mittig (Versatz aus den Tokens), alle anderen Symbole sind im Raster zentriert
  const offsetY = name === 'hanger' ? itemTile.badge.hanger.offsetY : 0;
  const p = { fill: 'none', stroke: color, strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={offsetY ? { transform: [{ translateY: offsetY }] } : undefined}>
      {TILE_ICONS[name].map((e, i) => (e.d ? <Path key={i} d={e.d} {...p} /> : <Circle key={i} cx={e.c![0]} cy={e.c![1]} r={e.c![2]} {...p} />))}
    </Svg>
  );
}
