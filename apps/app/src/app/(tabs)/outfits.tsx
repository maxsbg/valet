import { ScrollView, View } from 'react-native';
import { Header, Empty } from '@/components/ui';
import { useTheme, space } from '@/lib/theme';
import { useScreen } from '@/lib/useScreen';

export default function Outfits() {
  const t = useTheme();
  const scr = useScreen();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: scr.top, paddingBottom: scr.barTop + space.lg, alignItems: 'center' }}>
        <View style={{ width: scr.content + 2 * space.md }}><Header /></View>
        <Empty title="Outfits" text="Outfit-Karten, Baukasten und Würfel kommen als Nächstes." />
      </ScrollView>
    </View>
  );
}
