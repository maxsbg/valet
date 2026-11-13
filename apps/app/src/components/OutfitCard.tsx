import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatEur } from '@valet/core';
import { OutfitBoard } from './OutfitBoard';
import { useTheme, radius } from '@/lib/theme';
import { fmtShort, nextPlan, outfitValue, type Outfit } from '@/lib/outfits';
import type { Tile } from '@/lib/wardrobe';

type Props = { outfit: Outfit; byId: Map<string, Tile>; width: number; personColor?: string | null; onPress?: () => void };

/** Outfit-Karte wie im alten Valet: Board, darunter Person · Anzahl · Wert, „geplant“ und Anlässe */
export function OutfitCard({ outfit, byId, width, personColor, onPress }: Props) {
  const t = useTheme();
  const n = outfit.pieces.filter((p) => byId.has(p.id)).length;
  const nx = nextPlan(outfit);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Outfit mit ${n} Teilen`}
      style={({ pressed }) => [s.card, { width, backgroundColor: t.surface, borderColor: t.hairline, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
      <OutfitBoard pieces={outfit.pieces} byId={byId} width={width - 2} />
      <View style={[s.meta, { borderTopColor: t.hairline }]}>
        <View style={s.line}>
          {personColor && <View style={[s.dot, { backgroundColor: personColor }]} />}
          <Text style={[s.nm, { color: t.inkMuted }]} numberOfLines={1}>{n} Teile · {formatEur(outfitValue(outfit, byId))}</Text>
        </View>
        {nx && <Text style={[s.plan, { color: t.accent }]}>geplant: {fmtShort(nx.date)}</Text>}
        {outfit.occasions.length > 0 && (
          <View style={s.occs}>
            {outfit.occasions.map((o) => (
              <Text key={o} style={[s.occ, { color: t.inkMuted, borderColor: t.hairline }]}>{o}</Text>
            ))}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  meta: { paddingTop: 9, paddingHorizontal: 11, paddingBottom: 11, borderTopWidth: 1 },
  line: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  nm: { fontSize: 14, flexShrink: 1 },
  plan: { fontSize: 12, marginTop: 1 },
  occs: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  occ: { fontSize: 11, borderWidth: 1, borderRadius: 999, paddingVertical: 1, paddingHorizontal: 7, overflow: 'hidden' },
});
