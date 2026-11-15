import { useTabBarBottom } from '@/lib/bottomInset';
import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps } from 'expo-router/ui';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, TAB_BAR, TAB_SIDE } from '@/lib/theme';
import { Icon } from '@/components/Icon';
import type { SymbolName } from '@valet/ui';

type Btn = TabTriggerSlotProps & { label: string; icon: SymbolName };

function TabButton({ label, icon, isFocused, ref, ...props }: Btn) {
  const t = useTheme();
  const c = isFocused ? (t.dark ? t.accent : '#722638') : t.inkMuted;
  return (
    <Pressable ref={ref as never} {...props} accessibilityRole="tab" accessibilityState={{ selected: isFocused }} style={s.btn}>
      <Icon name={icon} size="bar" color={c} />
      <Text style={[s.label, { color: c, fontWeight: isFocused ? '600' : '500' }]}>{label}</Text>
    </Pressable>
  );
}

export default function TabLayout() {
  const t = useTheme();
  const bottom = useTabBarBottom();
  return (
    <Tabs style={{ flex: 1, backgroundColor: t.bg }}>
      <TabSlot style={{ flex: 1 }} />
      <TabList asChild>
        <View style={StyleSheet.flatten([s.bar, { bottom, backgroundColor: t.glass, borderColor: t.glassBorder },
          // Web: fest am Bildschirm, die Seite scrollt darunter
          Platform.OS === 'web' ? ({ position: 'fixed', zIndex: 30, backdropFilter: 'blur(24px) saturate(1.6)', WebkitBackdropFilter: 'blur(24px) saturate(1.6)' } as object) : null])}>
          <TabTrigger name="schrank" href="/" asChild><TabButton label="Schrank" icon="closet" /></TabTrigger>
          <TabTrigger name="outfits" href="/outfits" asChild><TabButton label="Outfits" icon="outfits" /></TabTrigger>
          <TabTrigger name="wunschliste" href="/wunschliste" asChild><TabButton label="Wunschliste" icon="heart" /></TabTrigger>
          <TabTrigger name="statistik" href="/statistik" asChild><TabButton label="Statistik" icon="chart" /></TabTrigger>
        </View>
      </TabList>
    </Tabs>
  );
}

const s = StyleSheet.create({
  bar: { position: 'absolute', left: TAB_SIDE, right: TAB_SIDE, height: TAB_BAR, borderRadius: 999, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  btn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, height: '100%' },
  label: { fontSize: 10 },
});
