import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Page } from '@/components/Page';
import { formatEur } from '@valet/core';
import { Header, Empty, Fab, useToast } from '@/components/ui';
import { Mosaic } from '@/components/Mosaic';
import { WAIT } from '@/components/ItemTile';
import { useSession } from '@/lib/session';
import { useTheme, space, radius, DISPLAY } from '@/lib/theme';
import { useScreen } from '@/lib/useScreen';

export default function Wunschliste() {
  const t = useTheme();
  const scr = useScreen();
  const { wardrobe } = useSession();
  const toast = useToast(scr.barTop + space.sm);
  const wishes = useMemo(() => (wardrobe?.items ?? []).filter((i) => i.isWish).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [wardrobe]);
  const total = wishes.reduce((n, i) => n + (i.price ?? 0), 0);
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Page contentContainerStyle={{ paddingTop: scr.top, paddingBottom: scr.barTop + 90, alignItems: 'center' }}>
        <View style={{ width: scr.content + 2 * space.md }}><Header /></View>
        <View style={{ width: scr.content, gap: space.sm }}>
          <View style={[s.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
            <Text style={{ color: t.inkMuted, fontSize: 13 }}>{wishes.length} Wunschteile · Gesamtpreis</Text>
            <Text style={{ fontFamily: DISPLAY, fontSize: 28, color: t.ink }}>{formatEur(total)}</Text>
            <Text style={{ color: t.inkMuted, fontSize: 13 }}>Bedenkzeit: {WAIT} Tage</Text>
          </View>
          {/* TODO Wunschliste: Preis- und Bedenkzeit-Plakette auf der Kachel nachtragen (Inhalt mit Max klären), siehe ItemTile */}
          {wishes.length ? (
            <Mosaic items={wishes} width={scr.content} onPress={(i) => router.push(`/teil/${i.id}`)} />
          ) : (
            <Empty title="Noch keine Wünsche" text="Teile, die du dir überlegst, landen hier mit 14 Tagen Bedenkzeit." />
          )}
        </View>
      </Page>
      <Fab bottom={scr.fabBottom} onPress={() => toast.show('Kommt in einem der nächsten Schritte.')} />
      {toast.node}
    </View>
  );
}

const s = StyleSheet.create({ card: { borderWidth: 1, borderRadius: radius.md, padding: space.md, gap: 2 } });
