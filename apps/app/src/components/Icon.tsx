// Symbole der App – gezeichnet ausschließlich aus dem Symbol-Pool (SYMBOLS in packages/ui/src/symbols.ts).
// Regeln: docs/design/symbole/VALET_SYMBOLE.md · Katalog: docs/design/symbole/symbol-katalog.html (`pnpm symbole`).
// Neue Funktion → zuerst im Pool ein passendes Symbol suchen; keine Symbole woanders zeichnen.
import { layoutKind } from '@valet/core';
import { ICON_SIZE, SYMBOLS, strokeFor, type IconSize, type SymbolDef, type SymbolName } from '@valet/ui';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

/** Zeichnet ein Pool-Symbol in px-Größe (für Icon und die Plaketten in TileIcon). */
export function SymbolSvg({ name, px, color, offsetY = 0, rotate = 0 }: { name: SymbolName; px: number; color: string; offsetY?: number; rotate?: number }) {
  const def = SYMBOLS[name] as SymbolDef;
  const grid = def.grid ?? 24;
  const p = { fill: 'none', stroke: color, strokeWidth: strokeFor(name), strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const transform = [...(offsetY ? [{ translateY: offsetY }] : []), ...(rotate ? [{ rotate: `${rotate}deg` }] : [])];
  return (
    <Svg width={px} height={px} viewBox={`0 0 ${grid} ${grid}`} aria-hidden style={transform.length ? { transform } : undefined}>
      {def.els.map((x, i) => {
        if (x.startsWith('c:') || x.startsWith('f:')) {
          const [cx, cy, r] = x.slice(2).split(',').map(Number);
          return x[0] === 'f' ? <Circle key={i} cx={cx} cy={cy} r={r} fill={color} /> : <Circle key={i} cx={cx} cy={cy} r={r} {...p} />;
        }
        if (x.startsWith('t:')) {
          const [tx, ty, fs, fw, ...t] = x.slice(2).split(',');
          return <SvgText key={i} x={tx} y={ty} textAnchor="middle" fontSize={fs} fontWeight={fw as '700'} fill={color} stroke="none" fontFamily="-apple-system, Arial, sans-serif">{t.join(',')}</SvgText>;
        }
        return <Path key={i} d={x} {...p} />;
      })}
    </Svg>
  );
}

/**
 * Symbol aus dem Pool. size = feste Stufe (ICON_SIZE): mini 12 · inline 16 · chip 18 · row 20 · button 22 · bar 24 · large 28.
 * rotate: Richtung (z. B. Chevron 90 = nach unten, 180 = nach links) – Richtungen werden gedreht, nicht neu gezeichnet.
 */
export function Icon({ name, size = 'row', color, rotate }: { name: SymbolName; size?: IconSize; color: string; rotate?: number }) {
  return <SymbolSvg name={name} px={ICON_SIZE[size]} color={color} rotate={rotate} />;
}

export type { IconSize, SymbolName };

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
  const KIND: Record<string, string> = { top: 'shirt', sweater: 'shirt', sport: 'shirt', dress: 'shirt', pants: 'pants', shorts: 'pants', skirt: 'pants', jacket: 'jacket', coat: 'jacket', shoe: 'shoe', bag: 'bag', headwear: 'cap', accessory: 'cap' };
  // Form (layoutKind) oder Kategorie-Name
  const kind = KIND[category] ?? KIND[layoutKind(category)] ?? 'shirt';
  return (
    <Svg width="62%" height="62%" viewBox="0 0 100 100">
      <Path d={d[kind]} fill={color} opacity={0.9} />
    </Svg>
  );
}
