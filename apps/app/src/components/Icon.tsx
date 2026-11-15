import { layoutKind } from '@valet/core';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

type P = { size?: number; color: string };
const stroke = (color: string, w = 2) => ({ fill: 'none', stroke: color, strokeWidth: w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

export const Icons = {
  // Tab-Leiste (15.11.2026): Schrank = Schrank-Symbol aus dem Status, Outfits = Karten-Stapel, Wunschliste = weiches Herz, Statistik = waagerechte Balken mit Ecke
  closet: ({ size = 24, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" {...stroke(color)} /><Path d="M12 3v18M9.5 11v2M14.5 11v2" {...stroke(color)} /></Svg>),
  layers: ({ size = 24, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M6.5 7h8A2.5 2.5 0 0 1 17 9.5v9a2.5 2.5 0 0 1-2.5 2.5h-8A2.5 2.5 0 0 1 4 18.5v-9A2.5 2.5 0 0 1 6.5 7Z" {...stroke(color)} /><Path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h7A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H17" {...stroke(color)} /></Svg>),
  heart: ({ size = 24, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M12 20.5c-.4 0-.8-.15-1.1-.4C6.6 16.4 3 13.2 3 8.9 3 6.2 5.1 4 7.7 4c1.7 0 3.2.9 4.3 2.3C13.1 4.9 14.6 4 16.3 4 18.9 4 21 6.2 21 8.9c0 4.3-3.6 7.5-7.9 11.2-.3.25-.7.4-1.1.4Z" {...stroke(color)} /></Svg>),
  chart: ({ size = 24, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M3 3v16a2 2 0 0 0 2 2h16" {...stroke(color)} /><Path d="M7 7h8M7 11.5h12M7 16h5" {...stroke(color)} /></Svg>),
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
  share: ({ size = 20, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M12 3v12M8 7l4-4 4 4" {...stroke(color)} /><Path d="M8 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 17.5 10H16" {...stroke(color)} /></Svg>),
  link: ({ size = 22, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" {...stroke(color)} /><Path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" {...stroke(color)} /></Svg>),
  chevron: ({ size = 16, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Path d="m9 6 6 6-6 6" {...stroke(color)} /></Svg>),
  more: ({ size = 20, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx={5} cy={12} r={1.7} fill={color} /><Circle cx={12} cy={12} r={1.7} fill={color} /><Circle cx={19} cy={12} r={1.7} fill={color} /></Svg>),
  gear: ({ size = 20, color }: P) => (<Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx={12} cy={12} r={3} {...stroke(color, 1.8)} /><Path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" {...stroke(color, 1.8)} /></Svg>),
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
  const KIND: Record<string, string> = { oberteil: 'shirt', pullover: 'shirt', sport: 'shirt', kleid: 'shirt', hose: 'pants', shorts: 'pants', rock: 'pants', jacke: 'jacket', mantel: 'jacket', schuhe: 'shoe', tasche: 'bag', kopf: 'cap', accessoire: 'cap' };
  // Form (layoutKind) oder Kategorie-Name
  const kind = KIND[category] ?? KIND[layoutKind(category)] ?? 'shirt';
  return (
    <Svg width="62%" height="62%" viewBox="0 0 100 100">
      <Path d={d[kind]} fill={color} opacity={0.9} />
    </Svg>
  );
}
