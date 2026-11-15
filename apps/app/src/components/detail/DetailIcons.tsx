// Symbole für Steckbrief und Bearbeiten (Leinwand „Valet – Teil-Detailseite“): Saison, Wetter, Pflege
// Pflege-Symbole im 32er-Raster mit Ziffern (Waschen 30/40/60/95, Professionell P/F/W), sonst 24er-Raster.
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';

type El = { d?: string; c?: [number, number, number]; fill?: boolean; r?: [number, number, number, number, number]; t?: [number, number, string, number, number] };
type Icon = { vb: number; sw: number; els: El[] };

export const DETAIL_ICONS = {
  flower: { vb: 24, sw: 2, els: [{ c: [12, 12, 2.5] }, { d: 'M12 9.5C10 7 10 4 12 3c2 1 2 4 0 6.5z' }, { d: 'M14.5 12c2.5-2 5.5-2 6.5 0-1 2-4 2-6.5 0z' }, { d: 'M12 14.5c2 2.5 2 5.5 0 6.5-2-1-2-4 0-6.5z' }, { d: 'M9.5 12C7 14 4 14 3 12c1-2 4-2 6.5 0z' }] },
  sun: { vb: 24, sw: 2, els: [{ c: [12, 12, 4] }, { d: 'M12 2v2' }, { d: 'M12 20v2' }, { d: 'M4.9 4.9l1.4 1.4' }, { d: 'M17.7 17.7l1.4 1.4' }, { d: 'M2 12h2' }, { d: 'M20 12h2' }, { d: 'M4.9 19.1l1.4-1.4' }, { d: 'M17.7 6.3l1.4-1.4' }] },
  leaf: { vb: 24, sw: 2, els: [{ d: 'M5 19c0-8 5-14 15-15-1 10-7 15-15 15z' }, { d: 'M5 19l8-8' }] },
  snow: { vb: 24, sw: 2, els: [{ d: 'M12 2v20' }, { d: 'M3.3 7l17.4 10' }, { d: 'M3.3 17L20.7 7' }, { d: 'M9.5 4L12 6.5 14.5 4' }, { d: 'M9.5 20L12 17.5 14.5 20' }] },
  thermo: { vb: 24, sw: 2, els: [{ d: 'M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z' }] },
  drop: { vb: 24, sw: 2, els: [{ d: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z' }] },
  w30: { vb: 32, sw: 1.8, els: [{ d: 'M4 9l2.6 15h18.8L28 9' }, { d: 'M4 9c2 1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0 4-1.6 6 0' }, { t: [16, 21, '30', 8.5, 700] }, { d: 'M7 28h18' }] },
  w40: { vb: 32, sw: 1.8, els: [{ d: 'M4 9l2.6 15h18.8L28 9' }, { d: 'M4 9c2 1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0 4-1.6 6 0' }, { t: [16, 21, '40', 8.5, 700] }, { d: 'M7 28h18' }] },
  w60: { vb: 32, sw: 1.8, els: [{ d: 'M4 9l2.6 15h18.8L28 9' }, { d: 'M4 9c2 1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0 4-1.6 6 0' }, { t: [16, 21, '60', 8.5, 700] }, { d: 'M7 28h18' }] },
  w95: { vb: 32, sw: 1.8, els: [{ d: 'M4 9l2.6 15h18.8L28 9' }, { d: 'M4 9c2 1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0 4-1.6 6 0' }, { t: [16, 21, '95', 8.5, 700] }, { d: 'M7 28h18' }] },
  hand: { vb: 32, sw: 1.8, els: [{ d: 'M4 9l2.6 15h18.8L28 9' }, { d: 'M4 9c2 1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0 4-1.6 6 0' }, { d: 'M12 22v-6.5a1.5 1.5 0 0 1 3 0V18m0-3.5v-1a1.5 1.5 0 0 1 3 0V19' }] },
  nowash: { vb: 32, sw: 1.8, els: [{ d: 'M4 9l2.6 15h18.8L28 9' }, { d: 'M4 9c2 1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0 4-1.6 6 0' }, { d: 'M5 5l22 22' }, { d: 'M27 5L5 27' }] },
  bleach: { vb: 32, sw: 1.8, els: [{ d: 'M16 5L29 27H3z' }] },
  nochlor: { vb: 32, sw: 1.8, els: [{ d: 'M16 5L29 27H3z' }, { d: 'M13 13l-4 9' }, { d: 'M18 13l-4 9' }] },
  nobleach: { vb: 32, sw: 1.8, els: [{ d: 'M16 5L29 27H3z' }, { d: 'M8 11l16 18' }, { d: 'M24 11L8 29' }] },
  drylow: { vb: 32, sw: 1.8, els: [{ r: [4, 4, 24, 24, 3] }, { c: [16, 16, 8] }, { c: [16, 16, 1.4], fill: true }] },
  drynorm: { vb: 32, sw: 1.8, els: [{ r: [4, 4, 24, 24, 3] }, { c: [16, 16, 8] }, { c: [13, 16, 1.4], fill: true }, { c: [19, 16, 1.4], fill: true }] },
  nodry: { vb: 32, sw: 1.8, els: [{ r: [4, 4, 24, 24, 3] }, { c: [16, 16, 8] }, { d: 'M5 5l22 22' }, { d: 'M27 5L5 27' }] },
  line: { vb: 32, sw: 1.8, els: [{ r: [4, 4, 24, 24, 3] }, { d: 'M6 11c4-5 16-5 20 0' }] },
  flat: { vb: 32, sw: 1.8, els: [{ r: [4, 4, 24, 24, 3] }, { d: 'M9 16h14' }] },
  iron1: { vb: 32, sw: 1.8, els: [{ d: 'M4 24h24v-2c0-5-3.5-8-8-8H10L8 9H5' }, { c: [16.5, 19.5, 1.3], fill: true }] },
  iron2: { vb: 32, sw: 1.8, els: [{ d: 'M4 24h24v-2c0-5-3.5-8-8-8H10L8 9H5' }, { c: [14, 19.5, 1.3], fill: true }, { c: [19, 19.5, 1.3], fill: true }] },
  iron3: { vb: 32, sw: 1.8, els: [{ d: 'M4 24h24v-2c0-5-3.5-8-8-8H10L8 9H5' }, { c: [12, 19.5, 1.3], fill: true }, { c: [16.5, 19.5, 1.3], fill: true }, { c: [21, 19.5, 1.3], fill: true }] },
  noiron: { vb: 32, sw: 1.8, els: [{ d: 'M4 24h24v-2c0-5-3.5-8-8-8H10L8 9H5' }, { d: 'M6 8l20 17' }, { d: 'M26 8L6 25' }] },
  prof: { vb: 32, sw: 1.8, els: [{ c: [16, 16, 11] }, { t: [16, 20.5, 'P', 12, 600] }] },
  profF: { vb: 32, sw: 1.8, els: [{ c: [16, 16, 11] }, { t: [16, 20.5, 'F', 12, 600] }] },
  profW: { vb: 32, sw: 1.8, els: [{ c: [16, 16, 11] }, { t: [16, 20.5, 'W', 12, 600] }] },
  noprof: { vb: 32, sw: 1.8, els: [{ c: [16, 16, 11] }, { d: 'M8 8l16 16' }, { d: 'M24 8L8 24' }] },
  // Bedien-Ebene (Foto ändern, Infos auslesen, Etikett, Shop, Bestellung, Fotos, Pfeil, Link)
  camera: { vb: 24, sw: 2, els: [{ d: 'M4 8h3l2-3h6l2 3h3v11H4z' }, { c: [12, 13, 3.5] }] },
  label: { vb: 24, sw: 2, els: [{ d: 'M3 12V4h8l10 10-8 8z' }, { c: [7.5, 8.5, 1.3] }] },
  phone: { vb: 24, sw: 2, els: [{ r: [6, 2.5, 12, 19, 2.5] }, { d: 'M10 18.5h4' }, { d: 'M9 7h6' }, { d: 'M9 10.5h6' }] },
  bag: { vb: 24, sw: 2, els: [{ d: 'M5 8h14l-1 12H6z' }, { d: 'M9 8V6.5a3 3 0 0 1 6 0V8' }] },
  photos: { vb: 24, sw: 2, els: [{ r: [3, 5, 18, 14, 2] }, { c: [9, 10, 1.6] }, { d: 'M21 16l-5-5-8 8' }] },
  chevronDown: { vb: 24, sw: 2, els: [{ d: 'M6 9l6 6 6-6' }] },
  chevronRight: { vb: 24, sw: 2, els: [{ d: 'M9 6l6 6-6 6' }] },
  sparkle: { vb: 24, sw: 2, els: [{ d: 'M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9Z' }, { d: 'M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8Z' }] },
  link: { vb: 24, sw: 2, els: [{ d: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1' }, { d: 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1' }] },
} satisfies Record<string, Icon>;

export type DetailIconName = keyof typeof DETAIL_ICONS;

export function DetailIcon({ name, size = 20, color }: { name: DetailIconName; size?: number; color: string }) {
  const ic: Icon = DETAIL_ICONS[name];
  const p = { fill: 'none', stroke: color, strokeWidth: ic.sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${ic.vb} ${ic.vb}`} aria-hidden>
      {ic.els.map((e, i) => {
        if (e.d) return <Path key={i} d={e.d} {...p} />;
        if (e.c) return <Circle key={i} cx={e.c[0]} cy={e.c[1]} r={e.c[2]} {...p} {...(e.fill ? { fill: color, stroke: 'none' } : null)} />;
        if (e.r) return <Rect key={i} x={e.r[0]} y={e.r[1]} width={e.r[2]} height={e.r[3]} rx={e.r[4]} {...p} />;
        const [x, y, txt, fs, fw] = e.t!;
        return <SvgText key={i} x={x} y={y} textAnchor="middle" fontSize={fs} fontWeight={String(fw) as '700'} fill={color} stroke="none" fontFamily="-apple-system, Arial, sans-serif">{txt}</SvgText>;
      })}
    </Svg>
  );
}

/** Saison → Symbol */
export const SEASON_ICON: Record<string, DetailIconName> = { Frühling: 'flower', Sommer: 'sun', Herbst: 'leaf', Winter: 'snow' };
