import { Pressable, StyleSheet, Text, View } from 'react-native';
import { glowFor } from '@valet/core';
import { itemTile } from '@valet/ui';
import { ItemPicture } from './ItemPicture';
import { TileGlow, glowBoxShadow } from './tile/TileGlow';
import { useTheme, radius } from '@/lib/theme';
import type { Person, Tile } from '@/lib/wardrobe';
import { Monogram } from './Monogram';
import { Icon } from '@/components/Icon';

// Wunschlisten-Karten (entschieden 14.11.2026, Entwurf docs/design/wunschliste/wunschlisten-karten.html):
// Aufbau wie die Outfit-Karte (Rand, Radius 22, Infozeile mit Personenpunkt), statt Board ein 2×2-Mosaik
// aus Kacheln (Radius 14, 8 px Innenabstand → konzentrisch zu 22).

const PAD = 8;
const GAP = 6;

/** Ganze Euro ohne Nachkommastellen („1.840 €“) */
export const euros = (n: number) => `${Math.round(n).toLocaleString('de-DE')} €`;

type Props = { title: string; sub: string; owner?: Pick<Person, 'name' | 'color'> | null; items: Tile[]; width: number; onPress: () => void; onLongPress?: () => void };

export function WishlistCard({ title, sub, owner, items, width, onPress, onLongPress }: Props) {
  const t = useTheme();
  const cell = (width - 2 - 2 * PAD - GAP) / 2;
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={400} accessibilityRole="button" accessibilityLabel={`${title}, ${sub}`}
      style={({ pressed }) => [s.card, { width, backgroundColor: t.surface, borderColor: t.hairline, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
      <View style={s.mosaic}>
        {[0, 1, 2, 3].map((n) => {
          const it = items[n];
          if (!it) return <View key={n} style={[s.cell, { width: cell, height: cell, backgroundColor: t.surfaceSunken }]} />;
          const glow = glowFor(it.colors, it.hex);
          return (
            <View key={it.id} style={[s.cell, { width: cell, height: cell, backgroundColor: itemTile.bg, boxShadow: glowBoxShadow(glow, itemTile.glow.blur, itemTile.glow.spread) }]}>
              <TileGlow glow={glow} radius={itemTile.radius} blur={itemTile.glow.blur} spread={itemTile.glow.spread} />
              <ItemPicture uri={it.thumb} category={it.kind} color={it.hex ?? itemTile.glow.fallback} inset="10%" />
            </View>
          );
        })}
      </View>
      <View style={[s.meta, { borderTopColor: t.hairline }]}>
        <Text style={[s.title, { color: t.ink }]} numberOfLines={1}>{title}</Text>
        <View style={s.line}>
          {owner ? <View style={s.mono}><Monogram person={owner} size="text" /></View> : null}
          <Text style={[s.sub, { color: t.inkMuted }]} numberOfLines={1}>{sub}</Text>
        </View>
      </View>
    </Pressable>
  );
}

/** Erste Karte „Neue Liste“ (wie bei Sorted). Farbe und Rand wie das Profil-Monogramm in der Kopfzeile. */
export function NewListCard({ width, onPress }: { width: number; onPress: () => void }) {
  const t = useTheme();
  const tone = t.blush;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Neue Liste anlegen"
      style={({ pressed }) => [s.card, s.add, { width, backgroundColor: tone + '1F', borderColor: tone + '73', transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
      <View style={[s.plus, { borderColor: tone + '73' }]}><Icon name="plus" size="button" color={tone} /></View>
      <Text style={[s.addText, { color: tone }]}>Neue Liste</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  mosaic: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, padding: PAD },
  cell: { borderRadius: itemTile.radius, overflow: 'hidden' },
  meta: { paddingTop: 9, paddingHorizontal: 11, paddingBottom: 11, borderTopWidth: 1 },
  title: { fontSize: 15, fontWeight: '500' },
  line: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  mono: { marginRight: 6 },
  sub: { fontSize: 14, flexShrink: 1 },
  add: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  plus: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  addText: { fontSize: 15, fontWeight: '500' },
});
