import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Header, Empty } from '@/components/ui';
import { useSession } from '@/lib/session';
import { useTheme, space, radius } from '@/lib/theme';
import { useScreen } from '@/lib/useScreen';

export default function Statistik() {
  const t = useTheme();
  const scr = useScreen();
  const { wardrobe } = useSession();
  const withoutPicture = (wardrobe?.items ?? []).filter((i) => !i.thumb).length;
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: scr.top, paddingBottom: scr.barTop + space.lg, alignItems: 'center' }}>
        <View style={{ width: scr.content + 2 * space.md }}><Header /></View>
        <Empty title="Statistik" text="Ausgaben, Getragen und Bestand kommen nach den Outfits." />
        {/* Übergang vom alten Valet: Bilder zuordnen */}
        <Pressable onPress={() => router.push('/bilder-zuordnen')} accessibilityRole="button"
          style={({ pressed }) => ({ width: scr.content, borderWidth: 1, borderColor: t.hairline, backgroundColor: t.surface, borderRadius: radius.lg, padding: space.md, gap: 4, opacity: pressed ? 0.8 : 1 })}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: t.ink }}>Bilder zuordnen</Text>
          <Text style={{ fontSize: 15, color: t.inkMuted }}>
            {withoutPicture ? `${withoutPicture} Teile haben noch kein Bild. ` : ''}Mehrere Fotos wählen, freistellen und den Teilen zuordnen.
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
