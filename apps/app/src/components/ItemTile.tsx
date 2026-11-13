import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Icons } from './Icon';
import { ItemPicture } from './ItemPicture';
import { tile, DISPLAY } from '@/lib/theme';
import type { Tile } from '@/lib/wardrobe';

const INK = '#2a1a1d';
const PERSON = { pink: '#D9668E', red: '#C8102E' } as const; // Plakette ist immer weiß → helle Werte

/** Standard-Bedenkzeit der Wunschliste in Tagen */
export const WAIT = 14;
const RING = 2 * Math.PI * 11;

export type TileStyle = 'glow' | 'edge' | 'grey' | 'flat';

/** Seitenverhältnis (Höhe : Breite) im Mosaik je Kategorie – wie im alten Valet. */
export const RATIO: Record<string, number> = { mantel: 1.6, hose: 1.45, jacke: 1.2, pullover: 1.15, oberteil: 1.1, sport: 1.1, shorts: 0.95, tasche: 0.95, schuhe: 0.72, accessoire: 0.72 };
export const tileHeight = (category: string, width: number) => Math.round(width * (RATIO[category] ?? 0.9));

type Props = {
  item: Tile;
  width: number;
  owner?: { letter: string; color: 'pink' | 'red' } | null;
  look?: TileStyle;
  /** Wunschliste: verbleibende Tage Bedenkzeit */
  daysLeft?: number;
  onPress?: () => void;
};

function Badge({ style, children }: { style: object; children: React.ReactNode }) {
  return <View style={[s.badge, style]}>{children}</View>;
}

export function ItemTile({ item, width, owner, look = 'glow', daysLeft, onPress }: Props) {
  const height = tileHeight(item.category, width);
  const c = item.hex ?? '#d8d2c8';
  const glow = owner === null && item.isWish ? 'flat' : look;
  const shadow =
    glow === 'glow' ? `inset 0 0 ${tile.glow.blur}px ${tile.glow.spread}px ${c}73, 0 2px 8px rgba(42,26,29,0.10)`
    : glow === 'edge' ? `inset 0 0 0 2px ${c}, 0 2px 8px rgba(42,26,29,0.10)`
    : glow === 'grey' ? `inset 0 0 0 1px rgba(42,26,29,0.12), 0 2px 8px rgba(42,26,29,0.10)`
    : '0 2px 8px rgba(42,26,29,0.10)';
  const StatusIcon = item.status ? Icons[item.status] : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[item.name, item.brand].filter(Boolean).join(', ')}
      style={({ pressed }) => [s.tile, { width, height, boxShadow: shadow, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
    >
      <View style={s.img}>
        <ItemPicture uri={item.thumb} category={item.category} color={c} />
      </View>
      {StatusIcon && !item.isWish && (
        <Badge style={s.tl}><StatusIcon color={INK} /></Badge>
      )}
      {item.isWish && daysLeft != null ? (
        <View style={[s.badge, s.tr, s.ring]}>
          <Svg width={26} height={26} viewBox="0 0 26 26" style={s.ringSvg}>
            <Circle cx={13} cy={13} r={11} fill="none" stroke="#e9e2d8" strokeWidth={2.5} />
            <Circle cx={13} cy={13} r={11} fill="none" stroke="#EF91B0" strokeWidth={2.5} strokeLinecap="round"
              strokeDasharray={`${(RING * Math.max(0, Math.min(daysLeft, WAIT))) / WAIT} ${RING}`} transform="rotate(-90 13 13)" />
          </Svg>
          <Text style={s.ringText}>{Math.max(0, daysLeft)}</Text>
        </View>
      ) : item.reversible ? (
        <Badge style={s.tr}><Icons.reversible color={INK} /></Badge>
      ) : null}
      {item.qty > 1 && <Text style={[s.qty, { top: item.reversible ? 37 : 10 }]}>×{item.qty}</Text>}
      {item.setId && !item.isWish && <Badge style={s.bl}><Icons.hanger color={INK} /></Badge>}
      {item.isWish && item.price != null && (
        <View style={s.price}><Text style={s.priceText}>{item.price.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</Text></View>
      )}
      {owner && (
        <Badge style={s.br}><Text style={[s.owner, { color: PERSON[owner.color] }]}>{owner.letter}</Text></Badge>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  tile: { backgroundColor: '#fff', borderRadius: tile.radius, overflow: 'hidden' },
  img: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', width: tile.badge, height: tile.badge, borderRadius: tile.badge / 2, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(42,26,29,0.16)' },
  tl: { top: 7, left: 7 }, tr: { top: 7, right: 7 }, bl: { bottom: 7, left: 7 }, br: { bottom: 7, right: 7 },
  owner: { fontFamily: DISPLAY, fontSize: 15, lineHeight: 18, paddingTop: 2 },
  qty: { position: 'absolute', right: 9, fontSize: 11, fontWeight: '700', color: INK },
  ring: { width: 30, height: 30, borderRadius: 15 },
  ringSvg: { position: 'absolute', top: 2, left: 2 },
  ringText: { fontSize: 11, fontWeight: '600', color: INK },
  price: { position: 'absolute', left: 7, bottom: 7, backgroundColor: '#fff', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, boxShadow: '0 1px 4px rgba(42,26,29,0.16)' },
  priceText: { fontSize: 13, fontWeight: '600', color: INK },
});
