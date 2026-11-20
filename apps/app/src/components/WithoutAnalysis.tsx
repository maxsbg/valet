// Profil-Blatt (20.11.2026, Max): kleine Übersicht der Teile ohne KI-Analyse (Schrank und Wunschliste).
// Antippen öffnet das Teil – dort „KI-Analyse ›“ → „Neu analysieren“. Bewusst schlicht: Anzahl + Vorschaubilder.
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/lib/theme';
import { useSession } from '@/lib/session';
import { itemsWithoutProfile } from '@/lib/profileBatch';

const SIZE = 44;

export function WithoutAnalysis({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const t = useTheme();
  const { wardrobe } = useSession();
  const [ids, setIds] = useState<string[] | null>(null);
  useEffect(() => {
    if (!open || !wardrobe) return;
    let alive = true;
    setIds(null);
    itemsWithoutProfile(wardrobe.id).then((r) => { if (alive) setIds(r); }).catch(() => { if (alive) setIds([]); });
    return () => { alive = false; };
  }, [open, wardrobe?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!wardrobe || ids == null) return null;
  const byId = new Map(wardrobe.items.map((i) => [i.id, i]));
  const items = ids.map((id) => byId.get(id)).filter((i): i is NonNullable<typeof i> => !!i);
  const wishes = items.filter((i) => i.isWish).length;
  return (
    <View style={{ gap: 8, marginTop: 14 }}>
      <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink }}>
        {items.length ? `Ohne KI-Analyse: ${items.length}${wishes ? ` (davon ${wishes} auf der Wunschliste)` : ''}` : 'Alle Teile haben eine KI-Analyse.'}
      </Text>
      {items.length > 0 && (
        <View style={s.wrap}>
          {items.map((i) => (
            <Pressable key={i.id} accessibilityRole="button" accessibilityLabel={i.name} onPress={() => { onNavigate(); router.push(`/teil/${i.id}`); }}
              style={({ pressed }) => [s.tile, { backgroundColor: t.surfaceSunken, borderColor: t.hairline, opacity: pressed ? 0.7 : 1 }]}>
              {i.thumb ? <Image source={{ uri: i.thumb }} style={s.img} resizeMode="contain" />
                : <Text style={{ fontSize: 15, fontWeight: '600', color: t.inkMuted }}>{i.name.trim().slice(0, 1).toUpperCase() || '?'}</Text>}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tile: { width: SIZE, height: SIZE, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  img: { width: SIZE - 6, height: SIZE - 6 },
});
