import Svg, { Path, Circle, Rect } from 'react-native-svg';

type P = { size?: number; color: string };
const stroke = (color: string, w = 2) => ({ fill: 'none', stroke: color, strokeWidth: w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

export const Icons = {
  wash: ({ size = 15, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M4 10h16l-2 10H6Z" {...stroke(color)} /><Path d="M8 10 11 4M16 10l-3-6" {...stroke(color)} /></Svg>),
  repair: ({ size = 15, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx={6} cy={6} r={3} {...stroke(color)} /><Circle cx={6} cy={18} r={3} {...stroke(color)} /><Path d="M8.5 7.5 20 18M8.5 16.5 20 6" {...stroke(color)} /></Svg>),
  lent: ({ size = 15, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M7 17 17 7M9 7h8v8" {...stroke(color, 2.2)} /></Svg>),
  out: ({ size = 15, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Rect x={3} y={4} width={18} height={5} rx={1} {...stroke(color)} /><Path d="M5 9v11h14V9M10 13h4" {...stroke(color)} /></Svg>),
  sold: ({ size = 15, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M3 12V4h8l10 10-8 8Z" {...stroke(color)} /><Circle cx={7.5} cy={8.5} r={1.3} fill={color} /></Svg>),
  reversible: ({ size = 15, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M20 11a8 8 0 0 0-14-5L4 8M4 4v4h4M4 13a8 8 0 0 0 14 5l2-2M20 20v-4h-4" {...stroke(color)} /></Svg>),
  hanger: ({ size = 15, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M12 8a2 2 0 1 1 2-2c0 1.2-2 1.6-2 3l9 6c.8.6.4 2-.6 2H3.6c-1 0-1.4-1.4-.6-2l9-6" {...stroke(color)} /></Svg>),
  layers: ({ size = 24, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Path d="m12 4 9 5-9 5-9-5Z" {...stroke(color)} /><Path d="m3 14 9 5 9-5" {...stroke(color)} /></Svg>),
  heart: ({ size = 24, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" {...stroke(color)} /></Svg>),
  chart: ({ size = 24, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M5 20V11M12 20V5M19 20v-6" {...stroke(color)} /></Svg>),
  plus: ({ size = 24, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M12 5v14M5 12h14" {...stroke(color, 2.4)} /></Svg>),
  search: ({ size = 20, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx={11} cy={11} r={6.5} {...stroke(color)} /><Path d="m16 16 4 4" {...stroke(color)} /></Svg>),
  close: ({ size = 18, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M6 6l12 12M18 6 6 18" {...stroke(color)} /></Svg>),
  sliders: ({ size = 20, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M4 7h10M18 7h2M4 17h4M12 17h8" {...stroke(color)} /><Circle cx={16} cy={7} r={2} {...stroke(color)} /><Circle cx={10} cy={17} r={2} {...stroke(color)} /></Svg>),
  sort: ({ size = 20, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M8 4v16M4 16l4 4 4-4M16 20V4M12 8l4-4 4 4" {...stroke(color)} /></Svg>),
  filter: ({ size = 18, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M4 7h16M7 12h10M10 17h4" {...stroke(color)} /></Svg>),
  back: ({ size = 22, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M15 5 8 12l7 7" {...stroke(color, 2.4)} /></Svg>),
  pencil: ({ size = 20, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M4 20h4L19 9l-4-4L4 16Z" {...stroke(color)} /></Svg>),
  check: ({ size = 22, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Path d="m5 12.5 4.5 4.5L19 7" {...stroke(color, 2.4)} /></Svg>),
  calendar: ({ size = 22, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Rect x={4} y={5} width={16} height={15} rx={3} {...stroke(color)} /><Path d="M4 10h16M9 3v4M15 3v4" {...stroke(color)} /></Svg>),
  closet: ({ size = 22, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Rect x={5} y={3} width={14} height={18} rx={2} {...stroke(color)} /><Path d="M12 3v18M10 12h.01M14 12h.01" {...stroke(color)} /></Svg>),
  chevron: ({ size = 16, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Path d="m9 6 6 6-6 6" {...stroke(color)} /></Svg>),
  help: ({ size = 20, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14" {...stroke(color)} /><Circle cx={12} cy={17.5} r={1.1} fill={color} /></Svg>),
};

/** Platzhalter-Silhouette je Kategorie, bis die freigestellten Fotos da sind. */
export function Silhouette({ category, color }: { category: string; color: string }) {
  const d: Record<string, string> = {
    shirt: 'M35 12 50 20 65 12 88 26 80 42 70 38 70 90 30 90 30 38 20 42 12 26Z',
    pants: 'M30 8h40l6 84H58L50 40 42 92H24Z',
    jacket: 'M34 10 50 18 66 10 90 28 84 60 72 56 72 92H52V30H48v62H28V56L16 60 10 28Z',
    shoe: 'M10 58c0-10 6-18 14-18 8 0 14 6 24 8 12 3 30 4 38 12 4 4 4 12 0 14H14c-3 0-4-8-4-16Z',
    cap: 'M20 60c0-22 13-36 30-36s30 14 30 36ZM50 58h40c4 0 4 8 0 8H50Z',
    bag: 'M22 40h56v46a6 6 0 0 1-6 6H28a6 6 0 0 1-6-6ZM36 40c0-16 28-16 28 0',
  };
  const kind =
    ({ oberteil: 'shirt', pullover: 'shirt', sport: 'shirt', hose: 'pants', shorts: 'pants', jacke: 'jacket', mantel: 'jacket', schuhe: 'shoe', tasche: 'bag', accessoire: 'cap' } as Record<string, string>)[category] ?? 'shirt';
  return (
    <Svg width="62%" height="62%" viewBox="0 0 100 100">
      <Path d={d[kind]} fill={color} opacity={0.9} />
    </Svg>
  );
}
