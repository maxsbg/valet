import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Page } from '@/components/Page';
import { formatEur, WISH_WAIT } from '@valet/core';
import { Header, Empty, Fab, useToast } from '@/components/ui';
import { Mosaic } from '@/components/Mosaic';
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
            {WISH_WAIT.enabled && <Text style={{ color: t.inkMuted, fontSize: 13 }}>Bedenkzeit: {WISH_WAIT.days} Tage</Text>}
          </View>
          {wishes.length ? (
            <Mosaic items={wishes} width={scr.content} onPress={(i) => router.push(`/teil/${i.id}`)} />
          ) : (
            <Empty title="Noch keine Wünsche" text={WISH_WAIT.enabled ? `Teile, die du dir überlegst, landen hier mit ${WISH_WAIT.days} Tagen Bedenkzeit.` : 'Teile, die du dir überlegst, landen hier.'} />
          )}
        </View>
      </Page>
      <Fab bottom={scr.fabBottom} onPress={() => toast.show('Kommt in einem der nächsten Schritte.')} />
      {toast.node}
    </View>
  );
}

const s = StyleSheet.create({ card: { borderWidth: 1, borderRadius: radius.md, padding: space.md, gap: 2 } });
